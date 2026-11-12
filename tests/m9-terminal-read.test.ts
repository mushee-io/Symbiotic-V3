import test from "node:test";
import assert from "node:assert/strict";
import {toBase58} from "@amadeus-protocol/sdk";
import type {AmadeusSDK} from "@amadeus-protocol/sdk";
import {
  readNativeTerminal,readTerminalWalletBalances,
} from "../lib/terminal/read";
import {LiquidityUnavailableError} from "../lib/liquidity/deployments";

const OWNER=toBase58(new Uint8Array(48).fill(11));
function mock(registered=false, unsafeAma=false){
  const calls:string[]=[];
  const sdk={
    chain:{
      getTip:async()=>{calls.push("tip");return {entry:{header:{height:100}}};},
      getStats:async()=>{calls.push("stats");return {stats:{height:100,rooted_height:99}};},
      getByFilter:async()=>{throw Error("no deployed contract permits history queries");},
    },
    contract:{
      get:async (key:Uint8Array)=>{
        calls.push("registration:"+new TextDecoder().decode(key));
        return registered?"1000000000000000":null;
      },
      view:async()=>{throw Error("unverified pool must not be viewed");},
    },
    wallet:{
      getBalance:async (_owner:string,symbol:string)=>{
        assert.equal(_owner,OWNER);
        calls.push("balance:"+symbol);
        return {balance:{symbol,flat:symbol==="AMA"?
          (unsafeAma?Number.MAX_SAFE_INTEGER+1:1234567890):2000,float:0}};
      },
    },
    transaction:{get:async()=>{throw Error("no live trades");}},
  } as unknown as AmadeusSDK;
  return {sdk,calls};
}

test("both pairs show actual AMA balance only; unissued asset is NULL, not invented zero",async()=>{
  for(const base of ["TESTBTC","TESTUSD"] as const){
    const {sdk,calls}=mock(false);
    const r=await readNativeTerminal(sdk,base,OWNER);
    assert.equal(r.network,"amadeus-testnet");
    assert.equal(r.pair,base+"/AMA");
    assert.equal(r.status,"blocked");
    assert.equal(r.token.status,"unregistered");
    assert.equal(r.wallet?.amaAtomic,"1234567890");
    assert.equal(r.wallet?.baseAtomic,null);
    assert.equal(r.wallet?.baseStatus,"token_not_issued");
    assert.equal(r.pool,null);
    assert.equal(r.history,null);
    assert.equal(r.chart,null);
    assert.equal(r.chartReason,"no_independently_verified_historical_reserve_series");
    assert.equal(r.tradingEnabled,false);
    assert.deepEqual(r.health,{height:100,rootedHeight:99,checkedAt:r.health.checkedAt});
    assert.equal(calls.includes("balance:"+base),false);
    assert.equal(calls.some(x=>x.startsWith("registration:")),true);
  }
});

test("unconnected wallet is null; read-only two-pair token statuses still query native chain",async()=>{
  const {sdk,calls}=mock(false);
  const r=await readNativeTerminal(sdk,"TESTBTC");
  assert.equal(r.status,"blocked");
  assert.equal(r.wallet,null);
  assert.equal(r.history,null);
  assert.equal(calls.some(x=>x.startsWith("balance:")),false);
});

test("registered native Coin can show exactly chain-reported asset balance without promoting it as official M4 mint",async()=>{
  const {sdk,calls}=mock(true);
  const r=await readNativeTerminal(sdk,"TESTUSD",OWNER);
  assert.equal(r.token.status,"registered");
  assert.equal(r.token.supplyAtomic,"1000000000000000");
  assert.equal(r.wallet?.baseAtomic,"2000");
  assert.equal(r.wallet?.baseStatus,"registered_chain_coin");
  assert.equal(r.status,"blocked");
  assert.equal(calls.includes("balance:TESTUSD"),true);
});

test("invalid owner, unapproved market, or imprecise native JS Coin flat always fail closed",async()=>{
  const {sdk,calls}=mock(false);
  await assert.rejects(readNativeTerminal(sdk,"TESTETH" as never,OWNER),LiquidityUnavailableError);
  await assert.rejects(readNativeTerminal(sdk,"TESTBTC","bad"),LiquidityUnavailableError);
  assert.equal(calls.length,0);
  const unsafe=mock(true,true);
  await assert.rejects(readNativeTerminal(unsafe.sdk,"TESTBTC",OWNER),LiquidityUnavailableError);
});

test("wallet balance helper uses actual native Coin symbol, precision and explicit public address",async()=>{
  const {sdk,calls}=mock(true);
  const b=await readTerminalWalletBalances(sdk,OWNER,"TESTBTC",true);
  assert.equal(b.amaAtomic,"1234567890");
  assert.equal(b.baseAtomic,"2000");
  assert.equal(b.source,"amadeus_testnet_native_coin");
  assert.equal(calls.length,2);
  const blocked=mock(false);
  const unissued=await readTerminalWalletBalances(blocked.sdk,OWNER,"TESTUSD",false);
  assert.equal(unissued.baseAtomic,null);
  assert.deepEqual(blocked.calls,["balance:AMA"]);
});

test("RPC chain failures or unknown token registration cannot silently yield an empty market",async()=>{
  const x=mock(false);
  const reader=x.sdk;
  reader.chain.getStats=async()=>{throw Error("public RPC offline")};
  await assert.rejects(readNativeTerminal(reader,"TESTBTC",OWNER));
  const y=mock(false);
  y.sdk.contract.get=async()=>({"invalid":"Coin state"}) as never;
  await assert.rejects(readNativeTerminal(y.sdk,"TESTBTC"));
});
