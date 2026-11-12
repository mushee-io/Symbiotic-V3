import test from "node:test";
import assert from "node:assert/strict";
import { toBase58 } from "@amadeus-protocol/sdk";
import { inspectTestnet } from "../lib/amadeus-health";
import { isAmaAddress, signingReadiness, VERIFIED_M3_SIGNING_DOMAIN, type AmadeusWalletProvider } from "../lib/amadeus-wallet";
import { getCertifiedPool, LiquidityUnavailableError } from "../lib/liquidity/deployments";
import { parseActualCoinBalance, parseNativeReserves, type PoolSnapshot } from "../lib/liquidity/read";
import { quoteNativeSpot } from "../lib/spot/quote";
import { buildNativeSpotIntent, requireAttachmentAwareSwapWallet } from "../lib/spot/intent";
import { verifyFinalizedSwapCall } from "../lib/terminal/history";
import { evaluateAgent, DEFAULT_AGENT_CONFIG, DEFAULT_AGENT_CONTROLS, parseAgentQuery } from "../lib/agent/policy";
import { issueNativeTestToken } from "../lib/amadeus-token-issuance";

const USER=toBase58(new Uint8Array(48).fill(3));
const POOL=toBase58(new Uint8Array(48).fill(4));
const HASH=toBase58(new Uint8Array(32).fill(5));
const BASES=["TESTBTC","TESTUSD"] as const;
function pool(base:"TESTBTC"|"TESTUSD",a=2000000n,b=1000000n):PoolSnapshot {
  return {
    symbol:base,pair:(base+"/AMA") as PoolSnapshot["pair"],address:POOL,
    reserveBase:b.toString(),reserveAma:a.toString(),totalLp:"1414213",
    custodyBase:b.toString(),custodyAma:a.toString(),
    owner:USER,ownerLp:"0",paused:false,reconciled:true,
  };
}

test("M11: no M3 signing witness means every public wallet is read-only, even if it reports testnet",async()=>{
  let signed=0,submitted=0;
  const wallet:AmadeusWalletProvider={
    isAmadeus:true,requestAccounts:async()=>[USER],
    getNetwork:async()=>({network:"amadeus-testnet"}),
    signTransaction:async()=>{signed++;throw Error("never call");},
  };
  assert.equal(isAmaAddress(USER),true);
  assert.equal(isAmaAddress(HASH),false);
  assert.equal(VERIFIED_M3_SIGNING_DOMAIN,false);
  assert.equal(signingReadiness(wallet,USER,"testnet",true),false);
  assert.throws(()=>requireAttachmentAwareSwapWallet(wallet),/unverified/);
  await assert.rejects(issueNativeTestToken({
    sdk:{transaction:{submitAndWait:async()=>{submitted++;throw Error("never submit");}}} as never,
    provider:wallet,account:USER,network:"testnet",rpcHealthy:true,
  },"TESTBTC"),/m3_two_wallet_signing_domain_unverified/);
  assert.equal(signed,0);
  assert.equal(submitted,0);
});

test("M11: neither AMA pair has deployment permission, invented pool balances cannot unlock it",()=>{
  for(const base of BASES)assert.throws(()=>getCertifiedPool(base),/pool_not_deployed/);
  assert.equal(BASES.length,2);
});

test("M11: unsafe native Coin precision and malformed reserve states always fail closed",()=>{
  for(const bad of [
    {balance:{symbol:"AMA",flat:Number.MAX_SAFE_INTEGER+1}},
    {balance:{symbol:"AMA",flat:-1}},
    {balance:{symbol:"AMA",flat:3.5}},
    {balance:{symbol:"TESTUSD",flat:100}},
    {balance:{symbol:"AMA",flat:"1000"}},
    {},
  ])assert.throws(()=>parseActualCoinBalance(bad,"AMA"),LiquidityUnavailableError);
  for(const bad of [
    "0|2000000|1414213|0","1000000|0|1414213|0",
    "1|2|3|0","1000|2000|3000|2","1000|2000|3000|-1",
    "1000|2000|3000|0|extra","1000|2000|1e6|0",
  ])assert.throws(()=>parseNativeReserves(bad),LiquidityUnavailableError);
});

test("M11: 2048 deterministic AMM quote variations preserve native fee and reserve invariants",()=>{
  let state=0xa51fe173;
  const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return state>>>0;};
  for(let i=0;i<2048;i++){
    const base=BASES[i%2];
    const side=i%3?"BUY":"SELL";
    const reserveAma=BigInt(1000000+random()%50000000);
    const reserveBase=BigInt(1000000+random()%50000000);
    const input=BigInt(1000+random()%200000);
    try {
      const q=quoteNativeSpot(pool(base,reserveAma,reserveBase),side,String(input),50);
      assert.equal(q.feeBps,30);
      assert.equal(q.pair,base+"/AMA");
      assert.ok(BigInt(q.expectedOut)>=BigInt(q.minimumOut));
      assert.ok(BigInt(q.minimumOut)>0n);
      assert.ok(BigInt(q.invariantAfter)>=BigInt(q.invariantBefore));
      assert.ok(BigInt(q.reserveOutAfter)>0n);
    }catch(error){
      assert.ok(error instanceof LiquidityUnavailableError);
      assert.ok(["dust_or_empty_pool","slippage_rounding_to_zero","invalid_reference_reserve_ratio"].includes(error.reason),error.reason);
    }
  }
});

test("M11: front-run reserve drift, expired entry height, extra Coin and wrong signer cannot create valid swap intents",()=>{
  for(const base of BASES){
    const p=pool(base);
    const displayed=quoteNativeSpot(p,"BUY","50000",50);
    assert.throws(()=>buildNativeSpotIntent({...p,reserveAma:"2500000",custodyAma:"2500000"},
      USER,"BUY","50000",50,100,101,120,displayed),/quote_changed_reprice/);
    assert.throws(()=>buildNativeSpotIntent(p,USER,"BUY","50000",50,100,104,120,displayed),/stale_native_quote/);
    assert.throws(()=>buildNativeSpotIntent(p,USER,"BUY","50000",50,100,100,121,displayed),/deadline_too_far/);
    assert.throws(()=>buildNativeSpotIntent(p,POOL,"BUY","50000",50,100,100,120,displayed),/wallet_snapshot_not_bound/);
    const good=buildNativeSpotIntent(p,USER,"BUY","50000",50,100,100,120,displayed);
    assert.equal(good.attachments.length,1);
    assert.equal(good.attachments[0].symbol,"AMA");
    assert.equal(good.broadcastEnabled,false);
  }
});

test("M11: forged native swap history cannot certify failed, unrooted, wrong-pool or wrong Coin transfers",()=>{
  const cert={
    symbol:"TESTUSD" as const,address:POOL,
    deploymentTx:HASH,initializationTx:HASH,elfSha256:"a".repeat(64),
    deploymentFinalized:true as const,initializationFinalized:true as const,
    runtimeTestsPassed:true as const,tokenMintFinalized:true as const,
    walletNetworkWitnessed:true as const,attachmentSigningVerified:true as const,
  };
  const value=(change:Record<string,unknown>={})=>({
    hash:HASH,
    metadata:{status:change.status??"finalized",entry_height:change.height??101},
    receipt:{success:change.success??true},
    tx:{signer:USER,action:{op:"call",contract:change.contract??POOL,
      function:"swap_exact_in",args:["1","130"],
      attached_symbol:change.symbol??"AMA",attached_amount:"1000"}},
  });
  assert.equal(verifyFinalizedSwapCall(value(),HASH,cert,USER,110).outputVerified,false);
  for(const mods of [
    {status:"confirmed"},{success:false},{height:111},{height:-1},
    {contract:USER},{symbol:"TESTBTC"},
  ])assert.throws(()=>verifyFinalizedSwapCall(value(mods),HASH,cert,USER,110));
  assert.throws(()=>verifyFinalizedSwapCall(value(),HASH,cert,USER,100));
});

test("M11: untrusted price, daily PnL and operator approval query injection is never accepted",()=>{
  for(const key of ["oraclePrice","realizedPnl","operatorApproval","execute","sign","privateKey"]){
    const q=new URLSearchParams({base:"TESTBTC",[key]:"true"});
    assert.throws(()=>parseAgentQuery(q));
  }
  const unset=evaluateAgent(DEFAULT_AGENT_CONFIG,
    {...DEFAULT_AGENT_CONTROLS,operatorPaused:false,killSwitchEngaged:false},
    {symbol:"TESTBTC",rootedHeight:100,latestHeight:100,pool:null,wallet:null,reference:null,pnl:null});
  assert.equal(unset.status,"hold");
  assert.equal(unset.canSign,false);
  assert.equal(unset.canBroadcast,false);
  assert.ok(unset.checks.includes("independent_reference_unavailable"));
  assert.ok(unset.checks.includes("daily_pnl_unavailable"));
});

test("M11: rooted chain regression and corrupt health are rejected, never silently accepted",async()=>{
  const read=(tip:number,stats:number,root:number)=>inspectTestnet({chain:{
    getTip:async()=>({entry:{header:{height:tip}}}),
    getStats:async()=>({stats:{height:stats,rooted_height:root}}),
  }});
  const actual=await read(100,100,99);
  assert.equal(actual.network,"amadeus-testnet");
  await assert.rejects(read(100,99,100));
  await assert.rejects(read(100,100,-1));
  await assert.rejects(read(100.5,100,99));
  await assert.rejects(read(100,Number.MAX_SAFE_INTEGER+10,99));
});
