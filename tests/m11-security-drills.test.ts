import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { toBase58 } from "@amadeus-protocol/sdk";
import type { AmadeusSDK } from "@amadeus-protocol/sdk";
import type { PoolSnapshot } from "../lib/liquidity/read";
import { verifyLiquidityAttachmentEvidence } from "../lib/liquidity/receipt";
import { deadlineAt, requireDocumentedLiquiditySigningCapability } from "../lib/liquidity/intent";
import { quoteNativeSpot } from "../lib/spot/quote";
import { buildNativeSpotIntent, requireAttachmentAwareSwapWallet, requireRealSwapAcceptance } from "../lib/spot/intent";
import { verifyFinalizedNativeSwap, type TraderCoinBalances } from "../lib/spot/receipt";
import { evaluateAgent, DEFAULT_AGENT_CONFIG, DEFAULT_AGENT_CONTROLS, parseAgentQuery } from "../lib/agent/policy";
import { isAmaAddress, signingReadiness, requestAmaAccount, type AmadeusWalletProvider } from "../lib/amadeus-wallet";
import { VERIFIED_POOLS } from "../lib/liquidity/deployments";

const signer=toBase58(new Uint8Array(48).fill(4));
const contract=toBase58(new Uint8Array(48).fill(6));
const txHash=toBase58(new Uint8Array(32).fill(9));
const snapshot:PoolSnapshot={
  symbol:"TESTBTC",pair:"TESTBTC/AMA",address:contract,
  reserveBase:"1000000",reserveAma:"2000000",totalLp:"1414213",
  custodyBase:"1000000",custodyAma:"2000000",
  owner:signer,ownerLp:"0",paused:false,reconciled:true,
};

test("M11 native safety drill: unbound ELF guest cannot let first caller choose admin (static source, NOT runtime)",()=>{
  const guest=readFileSync(new URL("../contracts/amadeus-riscv/pools/examples/pool.rs",import.meta.url),"utf8");
  assert.match(guest,/const APPROVED_INITIALIZER: \[u8; h::KEY_BYTES\] = \[0u8; h::KEY_BYTES\]/);
  assert.match(guest,/authorized_initializer\(&owner,\s*&APPROVED_INITIALIZER\)/);
  assert.match(guest,/initializer_not_authorized/);
  assert.equal(VERIFIED_POOLS.TESTBTC,null);
  assert.equal(VERIFIED_POOLS.TESTUSD,null);
});

test("M11 native safety drill: deadline height cannot run beyond 20 blocks in client intent",()=>{
  assert.equal(deadlineAt(100,120),"120");
  for(const h of [100,99,121,500,Number.MAX_SAFE_INTEGER]){
    assert.throws(()=>deadlineAt(100,h));
  }
  assert.throws(()=>deadlineAt(-1,10));
  assert.throws(()=>deadlineAt(1,Number.MAX_SAFE_INTEGER+1));
});

test("M11 LP witness drill: fail on absent, wrong and forged native Coin attachments",()=>{
  const expected=[
    {symbol:"TESTBTC" as const,amount:"500000"},
    {symbol:"AMA" as const,amount:"1000000"},
  ];
  assert.doesNotThrow(()=>verifyLiquidityAttachmentEvidence([
    {symbol:"AMA",amount:"1000000"},{symbol:"TESTBTC",amount:"500000"},
  ],expected));
  for(const malformed of [
    null,undefined,[],[...expected,{symbol:"USDC",amount:"1"}],
    [expected[0],expected[0]],
    [{symbol:"USDC",amount:"500000"},expected[1]],
    [{symbol:"TESTBTC",amount:"500001"},expected[1]],
    [{symbol:"TESTBTC",amount:"0"},expected[1]],
    [{symbol:"TESTBTC",amount:"01"},expected[1]],
    [{symbol:"TESTBTC",amount:"-1"},expected[1]],
    [{symbol:"TESTBTC",amount:"1e6"},expected[1]],
    [{symbol:"TESTBTC",amount:500000},expected[1]],
  ])assert.throws(()=>verifyLiquidityAttachmentEvidence(malformed,expected));
  assert.doesNotThrow(()=>verifyLiquidityAttachmentEvidence([],[]));
  assert.throws(()=>verifyLiquidityAttachmentEvidence(undefined,[]));
});

test("M11 frontend slippage and fast-moving reserve drill fail closed without mutating initial state",()=>{
  const before=structuredClone(snapshot);
  const initial=quoteNativeSpot(snapshot,"BUY","10000",50);
  assert.equal(initial.inputSymbol,"AMA");
  const current={...snapshot,reserveBase:"800000",custodyBase:"800000"};
  assert.throws(()=>buildNativeSpotIntent(current,signer,"BUY","10000",50,100,101,119,initial),/quote_changed_reprice/);
  assert.throws(()=>buildNativeSpotIntent(snapshot,signer,"BUY","10000",50,100,104,119,initial),/stale_native_quote/);
  assert.throws(()=>quoteNativeSpot({...snapshot,custodyAma:"1900000"},"BUY","10000",50));
  assert.throws(()=>quoteNativeSpot({...snapshot,paused:true},"BUY","10000",50));
  assert.throws(()=>quoteNativeSpot(snapshot,"BUY","1",50));
  assert.deepEqual(snapshot,before);
});

test("M11 swap finality drill: a finalized label is insufficient without a rooted chain height",async()=>{
  const q=quoteNativeSpot(snapshot,"BUY","50000",50);
  const intent=buildNativeSpotIntent(snapshot,signer,"BUY","50000",50,100,101,120,q);
  const out=BigInt(intent.expectedOut);
  const after:PoolSnapshot={...snapshot,
    reserveBase:String(1000000n-out),custodyBase:String(1000000n-out),
    reserveAma:"2050000",custodyAma:"2050000",
  };
  const beforeWallet:TraderCoinBalances={
    owner:signer,baseSymbol:"TESTBTC",baseAtomic:"1000000",
    amaAtomic:"1000000",source:"native_testnet_coin",
  };
  const afterWallet:TraderCoinBalances={...beforeWallet,
    baseAtomic:String(1000000n+out),amaAtomic:"949990",
  };
  const sdk={transaction:{get:async()=>({
    hash:txHash,receipt:{success:true},
    metadata:{status:"finalized",entry_height:102},
    tx:{signer,action:{op:"call",contract,function:"swap_exact_in",
      args:[...intent.args],attached_symbol:"AMA",attached_amount:"50000"}},
  })}} as unknown as Pick<AmadeusSDK,"transaction">;
  for(const root of [-1,0,99,100,101,Number.MAX_SAFE_INTEGER+1]){
    await assert.rejects(verifyFinalizedNativeSwap(sdk,txHash,intent,snapshot,after,beforeWallet,afterWallet,root));
  }
  const okay=await verifyFinalizedNativeSwap(sdk,txHash,intent,snapshot,after,beforeWallet,afterWallet,102);
  assert.equal(okay.status,"finalized_and_reconciled");
  await assert.rejects(verifyFinalizedNativeSwap(sdk,signer,intent,snapshot,after,beforeWallet,afterWallet,102));
});

test("M11 wallet rejection drill: no private key and no chain signing following user refusal",async()=>{
  let signed=0;
  const provider:AmadeusWalletProvider={
    isAmadeus:true,
    requestAccounts:async()=>{throw Error("user rejected");},
    signTransaction:async()=>{signed++;return {txHash};},
  };
  await assert.rejects(requestAmaAccount(provider),/not approved/i);
  assert.equal(signingReadiness(provider,null,"unverified",false),false);
  assert.equal(signed,0);
  assert.throws(()=>requireAttachmentAwareSwapWallet(provider));
  assert.throws(()=>requireDocumentedLiquiditySigningCapability(provider));
  assert.equal(signed,0);
});

test("M11 signer identity drill rejects shortened, wrong chain and malformed native public account",()=>{
  assert.ok(isAmaAddress(signer));
  assert.equal(isAmaAddress(toBase58(new Uint8Array(32).fill(4))),false);
  assert.equal(isAmaAddress("0x"+"a".repeat(40)),false);
  assert.equal(isAmaAddress("private key secret"),false);
  assert.equal(isAmaAddress(null),false);
  for(const asset of ["TESTBTC","TESTUSD"] as const)assert.throws(()=>requireRealSwapAcceptance(asset));
});

test("M11 risk drill: absent independent pricing and daily PnL forces HOLD with kill switch active",()=>{
  for(const symbol of ["TESTBTC","TESTUSD"] as const){
    const result=evaluateAgent(DEFAULT_AGENT_CONFIG,DEFAULT_AGENT_CONTROLS,{
      symbol,rootedHeight:100,latestHeight:100,
      pool:null,wallet:null,reference:null,pnl:null,
    });
    assert.equal(result.status,"hold");
    assert.ok(result.checks.includes("kill_switch_engaged"));
    assert.ok(result.checks.includes("operator_paused"));
    assert.ok(result.checks.includes("independent_reference_unavailable"));
    assert.ok(result.checks.includes("daily_pnl_unavailable"));
    assert.equal(result.canBroadcast,false);
    assert.equal(result.canSign,false);
    assert.equal(result.executionApproved,false);
  }
});

test("M11 operator spoof drill cannot authorize bot via public API query parameters",()=>{
  for(const field of ["oracle","pnl","reference","operatorApproval","canBroadcast","executionEnabled","privateKey"]){
    assert.throws(()=>parseAgentQuery(new URLSearchParams({
      base:"TESTBTC",[field]:"true",operatorPaused:"false",killSwitchEngaged:"false",
    })));
  }
  const off=parseAgentQuery(new URLSearchParams({base:"TESTUSD",operatorPaused:"false",killSwitchEngaged:"false"}));
  assert.equal(off.controls.authenticatedOperatorApproval,false);
});

test("M11 missing native release evidence cannot upgrade open markets to live",()=>{
  assert.equal(VERIFIED_POOLS.TESTBTC,null);
  assert.equal(VERIFIED_POOLS.TESTUSD,null);
  const endpoints=["spot/quote","liquidity/status","agent/monitor","terminal/status"];
  for(const route of endpoints){
    const src=readFileSync(new URL("../app/api/"+route+"/route.ts",import.meta.url),"utf8");
    assert.doesNotMatch(src,/\bexport (?:async )?function (?:POST|PATCH|PUT|DELETE)\b/);
  }
});
