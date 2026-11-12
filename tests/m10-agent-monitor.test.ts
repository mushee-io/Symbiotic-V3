import test from "node:test";
import assert from "node:assert/strict";
import { toBase58 } from "@amadeus-protocol/sdk";
import type { AmadeusSDK } from "@amadeus-protocol/sdk";
import { DEFAULT_AGENT_CONFIG, DEFAULT_AGENT_CONTROLS, evaluateAgent } from "../lib/agent/policy";
import { canonicalJson, createAgentAudit } from "../lib/agent/audit";
import { monitorAgent } from "../lib/agent/monitor";

const OWNER=toBase58(new Uint8Array(48).fill(6));
function makeSdk(registered=false, invalidAma=false){
  const events:string[]=[];
  const sdk={
    chain:{
      getTip:async()=>{events.push("tip");return {entry:{header:{height:9010}}};},
      getStats:async()=>{events.push("stats");return {stats:{height:9009,rooted_height:9008}};},
      getByFilter:async()=>{throw Error("history should never be queried without certified pool");},
    },
    contract:{
      get:async(_key:Uint8Array)=>{events.push("coin_supply");return registered?"1000000000000000":null;},
      view:async()=>{throw Error("unverified pool must not trigger contract view");},
    },
    transaction:{get:async()=>{throw Error("no transactions");}},
    wallet:{
      getBalance:async(_owner:string,symbol:string)=>{
        assert.equal(_owner,OWNER);events.push("balance:"+symbol);
        return {balance:{symbol,flat:invalidAma?Number.MAX_SAFE_INTEGER+1:symbol==="AMA"?1234567890:2000,float:0}};
      },
    },
  } as unknown as AmadeusSDK;
  return {sdk,events};
}

test("real-data-only monitor reports HOLD without an issuer, pool, oracle or daily PnL",async()=>{
  for(const symbol of ["TESTBTC","TESTUSD"] as const){
    const {sdk,events}=makeSdk(false);
    const {terminal,audit}=await monitorAgent(sdk,symbol,OWNER,DEFAULT_AGENT_CONFIG,DEFAULT_AGENT_CONTROLS);
    assert.equal(terminal.network,"amadeus-testnet");
    assert.equal(terminal.status,"blocked");
    assert.equal(terminal.pair,symbol+"/AMA");
    assert.equal(terminal.wallet?.amaAtomic,"1234567890");
    assert.equal(terminal.wallet?.baseAtomic,null);
    assert.equal(terminal.token.status,"unregistered");
    assert.equal(audit.record.evidence.poolCertified,false);
    assert.equal(audit.record.evidence.referenceVerified,false);
    assert.equal(audit.record.evidence.pnlVerified,false);
    assert.equal(audit.record.decision.status,"hold");
    assert.ok(audit.record.decision.checks.includes("pool_not_verified"));
    assert.ok(audit.record.decision.checks.includes("independent_reference_unavailable"));
    assert.ok(audit.record.decision.checks.includes("daily_pnl_unavailable"));
    assert.equal(audit.record.decision.canBroadcast,false);
    assert.equal(audit.executionEnabled,false);
    assert.equal(audit.durableStorage,false);
    assert.equal(events.includes("balance:"+symbol),false);
  }
});

test("chain-registered native tokens permit read balance but not strategy execution or fake oracle",async()=>{
  const {sdk,events}=makeSdk(true);
  const result=await monitorAgent(sdk,"TESTBTC",OWNER,DEFAULT_AGENT_CONFIG,{
    operatorPaused:false,killSwitchEngaged:false,authenticatedOperatorApproval:false,
  });
  assert.equal(result.terminal.wallet?.baseAtomic,"2000");
  assert.equal(result.terminal.status,"blocked");
  assert.equal(result.audit.record.decision.status,"hold");
  assert.equal(result.audit.executionEnabled,false);
  assert.ok(result.audit.record.decision.checks.includes("pool_not_verified"));
  assert.equal(events.includes("balance:TESTBTC"),true);
});

test("stable canonical JSON and SHA-256 digest are reproducible, detect policy tampering",async()=>{
  const {sdk}=makeSdk(false);
  const {terminal,audit}=await monitorAgent(sdk,"TESTBTC",OWNER,DEFAULT_AGENT_CONFIG,DEFAULT_AGENT_CONTROLS);
  const same=createAgentAudit(terminal,DEFAULT_AGENT_CONFIG,DEFAULT_AGENT_CONTROLS,
    audit.record.decision,{
      symbol:"TESTBTC",rootedHeight:terminal.health.rootedHeight,
      latestHeight:terminal.health.height,pool:null,wallet:terminal.wallet,
      reference:null,pnl:null,
    });
  assert.equal(audit.sha256,same.sha256);
  assert.match(audit.sha256,/^[a-f0-9]{64}$/);
  const differentPolicy={...DEFAULT_AGENT_CONFIG,maxSlippageBps:40};
  const different=createAgentAudit(terminal,differentPolicy,DEFAULT_AGENT_CONTROLS,
    audit.record.decision,{
      symbol:"TESTBTC",rootedHeight:terminal.health.rootedHeight,
      latestHeight:terminal.health.height,pool:null,wallet:terminal.wallet,
      reference:null,pnl:null,
    });
  assert.notEqual(audit.sha256,different.sha256);
  assert.equal(canonicalJson({b:1,a:2}),canonicalJson({a:2,b:1}));
  assert.throws(()=>canonicalJson({value:NaN}),/invalid_audit_number/);
  assert.throws(()=>canonicalJson({value:undefined}),/invalid_audit_field/);
});

test("forged execution and invented reference/PnL are rejected by audit boundary",async()=>{
  const {sdk}=makeSdk(false);
  const {terminal,audit}=await monitorAgent(sdk,"TESTUSD",OWNER,DEFAULT_AGENT_CONFIG,DEFAULT_AGENT_CONTROLS);
  const witness={
    symbol:"TESTUSD" as const,rootedHeight:terminal.health.rootedHeight,latestHeight:terminal.health.height,
    pool:null,wallet:terminal.wallet,reference:null,pnl:null,
  };
  assert.throws(()=>createAgentAudit(
    terminal,DEFAULT_AGENT_CONFIG,DEFAULT_AGENT_CONTROLS,
    {...audit.record.decision,canBroadcast:true as false},witness,
  ),/unauthorized_audit_evidence_or_execution/);
  assert.throws(()=>createAgentAudit(
    terminal,DEFAULT_AGENT_CONFIG,DEFAULT_AGENT_CONTROLS,
    audit.record.decision,{
      ...witness,reference:{
        source:"independently_verified_oracle",amaPerBaseNumerator:"2",
        amaPerBaseDenominator:"1",observedAtRootedHeight:9008,independentlyVerified:true,
      },
    },
  ),/unauthorized_audit_evidence_or_execution/);
});

test("native RPC invalid precision and missing wallet data never produce success audit",async()=>{
  const {sdk}=makeSdk(false,true);
  await assert.rejects(monitorAgent(sdk,"TESTBTC",OWNER,DEFAULT_AGENT_CONFIG,DEFAULT_AGENT_CONTROLS));
});

test("agent analysis without an account does not imply positions or user PnL",async()=>{
  const {sdk,events}=makeSdk(false);
  const {terminal,audit}=await monitorAgent(sdk,"TESTUSD",undefined,DEFAULT_AGENT_CONFIG,DEFAULT_AGENT_CONTROLS);
  assert.equal(terminal.wallet,null);
  assert.ok(audit.record.decision.checks.includes("inventory_not_independently_verified"));
  assert.equal(events.some(x=>x.startsWith("balance:")),false);
});
