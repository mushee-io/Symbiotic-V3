import test from "node:test";
import assert from "node:assert/strict";
import { toBase58 } from "@amadeus-protocol/sdk";
import type { PoolSnapshot } from "../lib/liquidity/read";
import { LiquidityUnavailableError } from "../lib/liquidity/deployments";
import { quoteNativeSpot, validateSlippageBps, requireSpotSide } from "../lib/spot/quote";
import { buildNativeSpotIntent, requireAttachmentAwareSwapWallet, requireRealSwapAcceptance, VERIFIED_SWAP_ACCEPTANCE } from "../lib/spot/intent";
import { quoteExactIn } from "../lib/amm/math";

const CONTRACT = toBase58(new Uint8Array(48).fill(4));
const OWNER = toBase58(new Uint8Array(48).fill(7));
function pool(base: "TESTBTC" | "TESTUSD" = "TESTBTC", reserveBase = 1_000_000n, reserveAma = 2_000_000n): PoolSnapshot {
  return {
    symbol: base, pair: base + "/AMA" as PoolSnapshot["pair"], address: CONTRACT,
    reserveBase: String(reserveBase), reserveAma: String(reserveAma), totalLp: "1414213",
    custodyBase: String(reserveBase), custodyAma: String(reserveAma),
    owner: OWNER, ownerLp: "0", paused: false, reconciled: true,
  };
}

test("only two AMA-quoted markets, with native BUY and SELL directions", () => {
  for (const b of ["TESTBTC", "TESTUSD"] as const) {
    for (const side of ["BUY", "SELL"] as const) {
      const quote = quoteNativeSpot(pool(b), side, "10000", 50);
      assert.equal(quote.pair, b + "/AMA");
      assert.equal(quote.side, side);
      assert.equal(quote.inputSymbol, side === "BUY" ? "AMA" : b);
      assert.equal(quote.outputSymbol, side === "BUY" ? b : "AMA");
      assert.equal(quote.feeBps, 30);
      assert.equal(quote.slippageBps, 50);
      assert.ok(BigInt(quote.expectedOut) >= BigInt(quote.minimumOut));
      assert.ok(BigInt(quote.minimumOut) > 0n);
      assert.ok(BigInt(quote.invariantAfter) >= BigInt(quote.invariantBefore));
      assert.equal(quote.poolAddress, CONTRACT);
    }
  }
  for (const side of ["BID", "EXACT_OUT", "SELL_USDC", null]) {
    assert.throws(() => requireSpotSide(side), LiquidityUnavailableError);
  }
});

test("integer exact-input output matches M5 fee-inclusive x*y=k in both directions", () => {
  const state = pool();
  for (const side of ["BUY", "SELL"] as const) {
    const q = quoteNativeSpot(state, side, "50000", 100);
    const reserveIn = BigInt(side === "BUY" ? state.reserveAma : state.reserveBase);
    const reserveOut = BigInt(side === "BUY" ? state.reserveBase : state.reserveAma);
    const expected = quoteExactIn(reserveIn, reserveOut, 50000n, 1n);
    assert.equal(q.expectedOut, String(expected.amountOut));
    assert.equal(q.minimumOut, String(expected.amountOut * 9900n / 10000n));
    assert.equal(q.reserveInAfter, String(expected.newReserveIn));
    assert.equal(q.reserveOutAfter, String(expected.newReserveOut));
  }
});

test("slippage only accepts 1–500 basis points; no floats or negative inputs", () => {
  for (const good of [1, 10, 50, 100, 500]) assert.equal(validateSlippageBps(good), good);
  for (const bad of [-1, 0, 0.5, 501, Infinity, NaN, "50", undefined]) {
    assert.throws(() => validateSlippageBps(bad), LiquidityUnavailableError);
  }
  for (const bad of ["0", "-1", "1.5", "01", "1e9", "", "999999999999999999999999999"]) {
    assert.throws(() => quoteNativeSpot(pool(), "BUY", bad, 50), LiquidityUnavailableError);
  }
});

test("unfunded, paused, spoofed pair or mismatched Coin custody cannot produce prices", () => {
  const p = pool();
  for (const invalid of [
    {...p, paused:true}, {...p, reserveAma:"0",custodyAma:"0"},
    {...p, pair:"TESTBTC/USDC" as PoolSnapshot["pair"]},
    {...p, custodyBase:"123"}, {...p, reconciled:false as true},
    {...p, reserveBase:"abc",custodyBase:"abc"},
  ]) assert.throws(() => quoteNativeSpot(invalid,"BUY","1000",50));
  assert.throws(() => quoteNativeSpot(pool(),"BUY","1",50),/dust_or_empty_pool/);
});

test("proper BUY intent attaches AMA; SELL attaches base; deadline, slippage and signer bound", () => {
  for (const side of ["BUY", "SELL"] as const) {
    const snapshot = pool("TESTUSD");
    const q = quoteNativeSpot(snapshot,side,"10000",50);
    const intent = buildNativeSpotIntent(snapshot,OWNER,side,"10000",50,100,101,118,q);
    assert.equal(intent.method,"swap_exact_in");
    assert.equal(intent.contract,CONTRACT);
    assert.deepEqual(intent.args,[q.minimumOut,"118"]);
    assert.deepEqual(intent.attachments,[{
      symbol:side==="BUY"?"AMA":"TESTUSD",amount:"10000",
    }]);
    assert.equal(intent.walletApprovalRequired,true);
    assert.equal(intent.broadcastEnabled,false);
    assert.equal(intent.pair,"TESTUSD/AMA");
  }
});

test("user can trade with zero LP but must own real authenticated wallet snapshot", () => {
  const p=pool();
  const q=quoteNativeSpot(p,"BUY","10000",50);
  assert.equal(buildNativeSpotIntent(p,OWNER,"BUY","10000",50,100,100,120,q).signer,OWNER);
  assert.throws(()=>buildNativeSpotIntent({...p,owner:null,ownerLp:null},OWNER,"BUY","10000",50,100,100,120,q),/wallet_snapshot_not_bound/);
  assert.throws(()=>buildNativeSpotIntent(p,CONTRACT,"BUY","10000",50,100,100,120,q),/wallet_snapshot_not_bound/);
});

test("old quote, expired height, too-distant deadline, changed price or different pool reject", () => {
  const p=pool();
  const q=quoteNativeSpot(p,"BUY","10000",50);
  for (const [quoteHeight,height,expiry] of [
    [100,104,120],[100,99,120],[100,100,100],
    [100,100,121],[100,100,601],[Number.MAX_SAFE_INTEGER,100,120],
  ]) assert.throws(()=>buildNativeSpotIntent(p,OWNER,"BUY","10000",50,quoteHeight,height,expiry,q));
  assert.throws(()=>buildNativeSpotIntent(p,OWNER,"BUY","10000",50,100,100,120,{...q,expectedOut:"10000000"}),/quote_changed_reprice/);
  assert.throws(()=>buildNativeSpotIntent({...p,reserveAma:"2500000",custodyAma:"2500000"},OWNER,"BUY","10000",50,100,100,120,q),/quote_changed_reprice/);
  assert.throws(()=>buildNativeSpotIntent(p,OWNER,"BUY","10000",50,100,100,120,{...q,poolAddress:OWNER}),/quote_changed_reprice/);
});

test("real trade acceptance is empty and wallet never receives a signing request", () => {
  assert.deepEqual(Object.keys(VERIFIED_SWAP_ACCEPTANCE).sort(),["TESTBTC","TESTUSD"]);
  assert.equal(VERIFIED_SWAP_ACCEPTANCE.TESTBTC,null);
  assert.equal(VERIFIED_SWAP_ACCEPTANCE.TESTUSD,null);
  assert.throws(()=>requireRealSwapAcceptance("TESTBTC"),LiquidityUnavailableError);
  assert.throws(()=>requireRealSwapAcceptance("TESTUSD"),LiquidityUnavailableError);
  let calls=0;
  const provider={signTransaction:()=>{calls++;return Promise.resolve({});}};
  assert.throws(()=>requireAttachmentAwareSwapWallet(provider),/native_wallet_swap_attachment_signing_unverified/);
  assert.equal(calls,0);
});

test("1,400 deterministic property cases preserve k, full fee & slippage for only AMA pairs", () => {
  let seed=0x7fd1ab42;
  const rand=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0;};
  for(let i=0;i<1400;i++){
    const b=BigInt(100_000 + rand()%5_000_000);
    const a=BigInt(100_000 + rand()%5_000_000);
    const input=BigInt(50 + rand()%150_000);
    const side=i%2?"SELL":"BUY";
    try {
      const q=quoteNativeSpot(pool(i%3?"TESTBTC":"TESTUSD",b,a),side,String(input),50);
      assert.ok(BigInt(q.expectedOut)>=BigInt(q.minimumOut));
      assert.ok(BigInt(q.expectedOut)>0n);
      assert.ok(BigInt(q.invariantAfter)>=BigInt(q.invariantBefore));
      assert.ok(BigInt(q.effectivePriceImpactBps)<=10000n);
    } catch (error) {
      assert.ok(error instanceof LiquidityUnavailableError);
      assert.ok(["dust_or_empty_pool","slippage_rounding_to_zero","invalid_reference_reserve_ratio"].includes(error.reason),error.reason);
    }
  }
});
