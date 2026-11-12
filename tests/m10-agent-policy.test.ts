import test from "node:test";
import assert from "node:assert/strict";
import { toBase58 } from "@amadeus-protocol/sdk";
import {
  DEFAULT_AGENT_CONFIG,DEFAULT_AGENT_CONTROLS,
  atomic,parseAgentQuery,validateAgentConfig,evaluateAgent,
  type AgentConfig,type AgentControls,type AgentObservations,
} from "../lib/agent/policy";
import type {PoolSnapshot} from "../lib/liquidity/read";
import type {TerminalWalletBalance} from "../lib/terminal/read";

const ADDRESS=toBase58(new Uint8Array(48).fill(8));
const snapshot:PoolSnapshot={
  symbol:"TESTBTC",pair:"TESTBTC/AMA",address:ADDRESS,
  reserveBase:"1000000000000",reserveAma:"2000000000000",
  totalLp:"1414213562373",custodyBase:"1000000000000",custodyAma:"2000000000000",
  owner:ADDRESS,ownerLp:"0",paused:false,reconciled:true,
};
const wallet:TerminalWalletBalance={
  address:ADDRESS,baseAtomic:"1000000000",amaAtomic:"20000000000",
  baseStatus:"registered_chain_coin",source:"amadeus_testnet_native_coin",
};
const active:AgentControls={
  operatorPaused:false,killSwitchEngaged:false,authenticatedOperatorApproval:false,
};
const fixture:AgentObservations={
  symbol:"TESTBTC",rootedHeight:100,latestHeight:100,
  pool:snapshot,wallet,
  reference:{
    source:"independently_verified_oracle",
    amaPerBaseNumerator:"2",amaPerBaseDenominator:"1",
    observedAtRootedHeight:99,independentlyVerified:true,
  },
  pnl:{
    source:"finalized_native_receipts",day:"2026-11-12",
    realizedAmaAtomic:"-100",observedAtRootedHeight:99,
    independentlyReconciled:true,
  },
};
const copy=(v:Partial<AgentObservations>):AgentObservations=>({...fixture,...v});

test("M10 policy is bounded and immutable defaults are exactly the AMA-only preview",()=>{
  assert.equal(DEFAULT_AGENT_CONTROLS.operatorPaused,true);
  assert.equal(DEFAULT_AGENT_CONTROLS.killSwitchEngaged,true);
  assert.equal(DEFAULT_AGENT_CONTROLS.authenticatedOperatorApproval,false);
  assert.equal(validateAgentConfig(DEFAULT_AGENT_CONFIG),DEFAULT_AGENT_CONFIG);
  for(const bad of [
    {...DEFAULT_AGENT_CONFIG,maxSlippageBps:0},
    {...DEFAULT_AGENT_CONFIG,maxSlippageBps:501},
    {...DEFAULT_AGENT_CONFIG,targetBaseBps:10000},
    {...DEFAULT_AGENT_CONFIG,inventoryBandBps:6000},
    {...DEFAULT_AGENT_CONFIG,targetSpreadBps:2},
    {...DEFAULT_AGENT_CONFIG,maxPoolUtilizationBps:1000},
    {...DEFAULT_AGENT_CONFIG,maxReferenceDivergenceBps:501},
    {...DEFAULT_AGENT_CONFIG,maxTradeAmaAtomic:"100000000000000000000"},
    {...DEFAULT_AGENT_CONFIG,maxPositionAmaAtomic:"1000"},
    {...DEFAULT_AGENT_CONFIG,gasReserveAmaAtomic:"0"},
    {...DEFAULT_AGENT_CONFIG,dailyLossCapAmaAtomic:"-5"},
  ]) assert.throws(()=>validateAgentConfig(bad),Error);
});

test("query limits admit only exact integer policy and session controls, reject fake oracle/pnl/approval",()=>{
  const q=new URLSearchParams({
    base:"TESTBTC",operatorPaused:"false",killSwitchEngaged:"false",
    maxSlippageBps:"20",maxTradeAmaAtomic:"100000000",
  });
  const result=parseAgentQuery(q);
  assert.equal(result.config.maxSlippageBps,20);
  assert.equal(result.config.maxTradeAmaAtomic,"100000000");
  assert.equal(result.controls.operatorPaused,false);
  assert.equal(result.controls.killSwitchEngaged,false);
  assert.equal(result.controls.authenticatedOperatorApproval,false);
  for(const entries of [
    {base:"TESTBTC",pnl:"1000"},
    {base:"TESTUSD",oracle:"200"},
    {base:"TESTBTC",operatorApproved:"true"},
    {base:"TESTBTC",maxSlippageBps:"NaN"},
    {base:"TESTBTC",maxSlippageBps:"0.5"},
    {base:"TESTUSD",maxSlippageBps:"10000"},
    {base:"TESTBTC",operatorPaused:"yes"},
    {base:"TESTUSD",maxTradeAmaAtomic:"1e9"},
  ]) assert.throws(()=>parseAgentQuery(new URLSearchParams(Object.entries(entries).filter((entry):entry is [string,string]=>typeof entry[1]==="string"))),Error);
  const dup=new URLSearchParams("base=TESTBTC&maxSlippageBps=30&maxSlippageBps=40");
  assert.throws(()=>parseAgentQuery(dup),Error);
});

test("positive BigInt atomic bounds never round floating or negative balances",()=>{
  assert.equal(atomic("1000000000","test"),1000000000n);
  assert.equal(atomic("0","test",true),0n);
  for(const bad of ["0","01","1.2","-5","1e9","","NaN","1000000000000000000000",1]) {
    assert.throws(()=>atomic(bad,"test"),Error);
  }
});

test("fail closed on missing pools, oracle, daily PnL, wallets or stale rooted RPC",()=>{
  for(const changes of [
    {pool:null},{wallet:null},{reference:null},{pnl:null},
    {latestHeight:201},{latestHeight:99},{rootedHeight:null},
    {pool:{...snapshot,paused:true}},
    {pool:{...snapshot,custodyAma:"1"}},
    {pool:{...snapshot,pair:"TESTBTC/USDC" as PoolSnapshot["pair"]}},
    {wallet:{...wallet,baseAtomic:null}},
    {wallet:{...wallet,address:toBase58(new Uint8Array(48).fill(3))}},
  ]) {
    const result=evaluateAgent(DEFAULT_AGENT_CONFIG,active,copy(changes as Partial<AgentObservations>));
    assert.equal(result.status,"hold");
    assert.equal(result.signal,null);
    assert.equal(result.canSign,false);
    assert.equal(result.canBroadcast,false);
    assert.equal(result.executionApproved,false);
  }
});

test("default kill-switch and operator pause both prevent a candidate, even with synthetic full fixtures",()=>{
  const pause=evaluateAgent(DEFAULT_AGENT_CONFIG,{...active,operatorPaused:true},fixture);
  assert.equal(pause.status,"hold");
  assert.ok(pause.checks.includes("operator_paused"));
  const kill=evaluateAgent(DEFAULT_AGENT_CONFIG,{...active,killSwitchEngaged:true},fixture);
  assert.ok(kill.checks.includes("kill_switch_engaged"));
  assert.equal(kill.signal,null);
});

test("synthetic unit fixture: below target inventory suggests BUY with correct AMA attachment only",()=>{
  const evald=evaluateAgent(DEFAULT_AGENT_CONFIG,active,fixture);
  assert.equal(evald.status,"candidate_only",JSON.stringify(evald.checks));
  assert.equal(evald.pair,"TESTBTC/AMA");
  assert.equal(evald.signal?.direction,"BUY");
  assert.equal(evald.signal?.inputSymbol,"AMA");
  assert.equal(evald.signal?.indicativeQuote.inputSymbol,"AMA");
  assert.equal(evald.signal?.indicativeQuote.outputSymbol,"TESTBTC");
  assert.ok(BigInt(evald.signal!.amountInAtomic)<=BigInt(DEFAULT_AGENT_CONFIG.maxTradeAmaAtomic));
  assert.equal(evald.signal?.indicativeQuote.feeBps,30);
  assert.equal(evald.canSign,false);
  assert.equal(evald.canBroadcast,false);
  assert.equal(evald.executionApproved,false);
  assert.equal(evald.decisionType,"read_only_analysis");
});

test("synthetic unit fixture: above target inventory suggests SELL for AMA (both markets)",()=>{
  const high={...wallet,baseAtomic:"100000000000",amaAtomic:"1000000000"};
  for(const symbol of ["TESTBTC","TESTUSD"] as const){
    const pool={...snapshot,symbol,pair:(symbol+"/AMA") as PoolSnapshot["pair"]};
    const data:AgentObservations={...fixture,symbol,pool,wallet:high};
    const e=evaluateAgent(DEFAULT_AGENT_CONFIG,active,data);
    assert.equal(e.status,"candidate_only",JSON.stringify(e.checks));
    assert.equal(e.signal?.direction,"SELL");
    assert.equal(e.signal?.inputSymbol,symbol);
    assert.equal(e.signal?.indicativeQuote.outputSymbol,"AMA");
    assert.equal(e.canBroadcast,false);
  }
});

test("daily loss cap, reference divergence, stale external proofs and inventory band force HOLD",()=>{
  const lost=copy({pnl:{...fixture.pnl!,realizedAmaAtomic:"-1000000000"}});
  assert.ok(evaluateAgent(DEFAULT_AGENT_CONFIG,active,lost).checks.includes("daily_loss_limit_reached"));
  const mismatch=copy({reference:{...fixture.reference!,amaPerBaseNumerator:"100"}});
  assert.ok(evaluateAgent(DEFAULT_AGENT_CONFIG,active,mismatch).checks.includes("pool_reference_divergence"));
  const stale=copy({reference:{...fixture.reference!,observedAtRootedHeight:50}});
  assert.ok(evaluateAgent(DEFAULT_AGENT_CONFIG,active,stale).checks.includes("independent_reference_unavailable"));
  const walletMiddle={...wallet,baseAtomic:"10000000000",amaAtomic:"20000000000"};
  const inside=copy({wallet:walletMiddle});
  assert.ok(evaluateAgent(DEFAULT_AGENT_CONFIG,active,inside).checks.includes("inventory_within_band"));
});

test("budget, position cap, price impact and gas reserve limitations never create an executable action",()=>{
  const lowAma=copy({wallet:{...wallet,amaAtomic:"0"}});
  assert.equal(evaluateAgent(DEFAULT_AGENT_CONFIG,active,lowAma).status,"hold");
  const tooTight=validateAgentConfig({...DEFAULT_AGENT_CONFIG,maxSlippageBps:1});
  assert.equal(evaluateAgent(tooTight,active,fixture).status,"hold");
  const limit=validateAgentConfig({...DEFAULT_AGENT_CONFIG,maxPositionAmaAtomic:"1000000000",maxTradeAmaAtomic:"100000000"});
  assert.ok(evaluateAgent(limit,active,fixture).checks.includes("max_position_reached"));
  const almostZero=copy({wallet:{...wallet,amaAtomic:"100000000"}});
  assert.equal(evaluateAgent(DEFAULT_AGENT_CONFIG,active,almostZero).canBroadcast,false);
});

test("market scope is only exact TESTBTC/AMA and TESTUSD/AMA; no other chain quote",()=>{
  assert.throws(()=>evaluateAgent(DEFAULT_AGENT_CONFIG,active,{...fixture,symbol:"USDC" as never}),Error);
  for(const symbol of ["TESTBTC","TESTUSD"] as const){
    const state={...snapshot,symbol,pair:(symbol+"/AMA") as PoolSnapshot["pair"]};
    const e=evaluateAgent(DEFAULT_AGENT_CONFIG,active,{...fixture,symbol,pool:state});
    assert.equal(e.pair,symbol+"/AMA");
  }
});
