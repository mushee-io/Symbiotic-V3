import test from "node:test";
import assert from "node:assert/strict";
import { toBase58 } from "@amadeus-protocol/sdk";
import {
  VERIFIED_POOLS, requireLiquiditySymbol, require48ByteAddress,
  getCertifiedPool, validatePoolCertificate, LiquidityUnavailableError,
  type PoolCertificate,
} from "../lib/liquidity/deployments";
import {
  buildAddLiquidityIntent, buildRemoveLiquidityIntent,
  positiveAtomic, deadlineAt, requireDocumentedLiquiditySigningCapability,
} from "../lib/liquidity/intent";
import type { PoolSnapshot } from "../lib/liquidity/read";

const ADDR = toBase58(new Uint8Array(48).fill(7));
const USER = toBase58(new Uint8Array(48).fill(8));
const HASH = toBase58(new Uint8Array(32).fill(9));
const certificate: PoolCertificate = {
  symbol: "TESTBTC", address: ADDR, deploymentTx: HASH,
  initializationTx: HASH, elfSha256: "a".repeat(64),
  deploymentFinalized: true, initializationFinalized: true,
  runtimeTestsPassed: true, tokenMintFinalized: true,
  walletNetworkWitnessed: true, attachmentSigningVerified: true,
};
const snapshot: PoolSnapshot = {
  symbol: "TESTBTC", pair: "TESTBTC/AMA", address: ADDR,
  reserveBase: "10000000", reserveAma: "20000000",
  totalLp: "14142135", paused: false,
  custodyBase: "10000000", custodyAma: "20000000",
  owner: USER, ownerLp: "14141135", reconciled: true,
};

test("production registry deliberately lacks ALL deployed pools and fails closed", () => {
  assert.deepEqual(Object.keys(VERIFIED_POOLS).sort(), ["TESTBTC", "TESTUSD"]);
  assert.equal(VERIFIED_POOLS.TESTBTC, null);
  assert.equal(VERIFIED_POOLS.TESTUSD, null);
  for (const base of ["TESTBTC", "TESTUSD"] as const) {
    assert.throws(() => getCertifiedPool(base), /pool_not_deployed/);
  }
});

test("only exact pair and 48-byte encoded Amadeus addresses accepted", () => {
  assert.equal(requireLiquiditySymbol("TESTBTC"), "TESTBTC");
  assert.equal(requireLiquiditySymbol("TESTUSD"), "TESTUSD");
  assert.throws(() => requireLiquiditySymbol("USDC"), LiquidityUnavailableError);
  assert.equal(require48ByteAddress(ADDR), ADDR);
  for (const v of ["0x" + "a".repeat(40), "not_an_address", HASH, "5".repeat(100), null]) {
    assert.throws(() => require48ByteAddress(v), LiquidityUnavailableError);
  }
  assert.equal(validatePoolCertificate(certificate,"TESTBTC"), certificate);
  assert.throws(() => validatePoolCertificate(certificate, "TESTUSD"), LiquidityUnavailableError);
  assert.throws(() => validatePoolCertificate({...certificate, tokenMintFinalized: false as true},"TESTBTC"), LiquidityUnavailableError);
  assert.throws(() => validatePoolCertificate({...certificate, initializationTx: ""},"TESTBTC"), LiquidityUnavailableError);
});

test("atomic unit and chain-height parsing rejects floating, zero, negative and stale inputs", () => {
  assert.equal(positiveAtomic("1000000000","base"),1000000000n);
  assert.equal(deadlineAt(100, 101),"101");
  for (const s of ["1.5","-1","0","01","1e6","","999999999999999999999999"]) {
    assert.throws(() => positiveAtomic(s,"base"), LiquidityUnavailableError);
  }
  for (const h of [100,99,601,0,Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => deadlineAt(100,h),LiquidityUnavailableError);
  }
});

test("native add intent includes BOTH full incoming coin attachments and slippage, no broadcasting", () => {
  const q = buildAddLiquidityIntent(snapshot,USER,"500000","1000000","1",100,120);
  assert.equal(q.contract,ADDR);
  assert.equal(q.method,"add_liquidity");
  assert.deepEqual(q.args,["1","120"]);
  assert.deepEqual(q.attachments,[
    {symbol:"TESTBTC",amount:"500000"},{symbol:"AMA",amount:"1000000"},
  ]);
  assert.equal(q.pair,"TESTBTC/AMA");
  assert.equal(q.walletApprovalRequired,true);
  assert.equal(q.broadcastEnabled,false);
  assert.ok(BigInt(q.expected.lp)>0n);
  assert.equal(q.signer,USER);
});

test("native remove intent burns only caller-owned LP and uses zero attached coins", () => {
  const q = buildRemoveLiquidityIntent(snapshot,USER,"1000","1","1",100,120);
  assert.equal(q.method,"remove_liquidity");
  assert.deepEqual(q.args,["1000","1","1","120"]);
  assert.deepEqual(q.attachments,[]);
  assert.equal(q.expected.lp,"1000");
  assert.equal(q.broadcastEnabled,false);
  assert.ok(BigInt(q.expected.base)>0n);
  assert.ok(BigInt(q.expected.ama)>0n);
  assert.throws(() => buildRemoveLiquidityIntent(snapshot,USER,"14141136","1","1",100,120),/lp_not_owned/);
});

test("paused pool permits emergency LP exit, not deposits", () => {
  const paused = {...snapshot,paused:true};
  assert.throws(() => buildAddLiquidityIntent(paused,USER,"500000","1000000","1",100,120),/pool_paused/);
  assert.equal(buildRemoveLiquidityIntent(paused,USER,"1000","1","1",100,120).method,"remove_liquidity");
});

test("snapshots must prove matching signer, exact AMA quote and actual custody", () => {
  assert.throws(() => buildAddLiquidityIntent(snapshot,ADDR,"10000","20000","1",100,120),/snapshot_not_authenticated/);
  assert.throws(() => buildAddLiquidityIntent({...snapshot,custodyAma:"1"},USER,"10000","20000","1",100,120),/snapshot_not_authenticated/);
  assert.throws(() => buildAddLiquidityIntent({...snapshot,ownerLp:null},USER,"10000","20000","1",100,120),/snapshot_not_authenticated/);
  assert.throws(() => buildAddLiquidityIntent({...snapshot,pair:"TESTUSD/AMA"},USER,"10000","20000","1",100,120),/snapshot_not_authenticated/);
  assert.throws(() => buildAddLiquidityIntent(snapshot,USER,"10000","20000","99999999",100,120),LiquidityUnavailableError);
});

test("undocumented native-attachment wallet signing always fails closed", () => {
  let calls = 0;
  const provider = {signTransaction: () => {calls++; return Promise.resolve({txHash: HASH});}};
  assert.throws(() => requireDocumentedLiquiditySigningCapability(provider),/wallet_attachment_signing_not_verified/);
  assert.equal(calls,0);
});
