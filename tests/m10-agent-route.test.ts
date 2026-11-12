import test from "node:test";
import assert from "node:assert/strict";
import { toBase58 } from "@amadeus-protocol/sdk";
import { GET } from "../app/api/agent/monitor/route";
import { AMA_TESTNET_RPC } from "../lib/amadeus";

const OWNER=toBase58(new Uint8Array(48).fill(4));
const baseUrl="https://symbiotic.example/api/agent/monitor";
function request(params:Record<string,string>={}){
  const q=new URLSearchParams({base:"TESTBTC",...params});
  return new Request(baseUrl+"?"+q.toString());
}
async function withRpc(
  responder:(url:string)=>Response,
  check:(calls:string[])=>Promise<void>,
){
  const oldFetch=globalThis.fetch;
  const oldRpc=process.env.AMADEUS_RPC_URL;
  delete process.env.AMADEUS_RPC_URL;
  const calls:string[]=[];
  globalThis.fetch=async input=>{
    const url=input instanceof Request?input.url:String(input);
    if(!url.startsWith(AMA_TESTNET_RPC+"/"))throw Error("outside pinned Amadeus testnet");
    calls.push(url);
    return responder(url);
  };
  try{await check(calls);}finally{
    globalThis.fetch=oldFetch;
    if(oldRpc===undefined)delete process.env.AMADEUS_RPC_URL;
    else process.env.AMADEUS_RPC_URL=oldRpc;
  }
}
function healthy(url:string):Response{
  if(url.endsWith("/chain/tip"))
    return Response.json({error:"ok",entry:{header:{height:8200000}}});
  if(url.endsWith("/chain/stats"))
    return Response.json({error:"ok",stats:{height:8199999,rooted_height:8199998}});
  if(url.endsWith("/contract/get"))return Response.json(null);
  if(url.includes("/wallet/balance/"))return Response.json({
    balance:{symbol:"AMA",flat:500000000,float:0.5},
  });
  throw Error("unverified pool may not read native contract or fabricate price/volumes");
}

test("both AMA markets produce read-only HOLD audits, actual network status and no fabricated reserves",async()=>{
  await withRpc(healthy,async calls=>{
    for(const base of ["TESTBTC","TESTUSD"]){
      const r=await GET(request({base,owner:OWNER}));
      assert.equal(r.status,200);
      assert.match(r.headers.get("cache-control")||"",/no-store/);
      const data=await r.json();
      assert.equal(data.network,"amadeus-testnet");
      assert.equal(data.status,"read_only");
      assert.equal(data.executionEnabled,false);
      assert.equal(data.signingEnabled,false);
      assert.equal(data.terminal.pair,base+"/AMA");
      assert.equal(data.terminal.pool,null);
      assert.equal(data.terminal.wallet.amaAtomic,"500000000");
      assert.equal(data.terminal.wallet.baseAtomic,null);
      assert.equal(data.terminal.history,null);
      assert.equal(data.terminal.chart,null);
      assert.equal(data.audit.record.decision.status,"hold");
      assert.equal(data.audit.record.decision.canSign,false);
      assert.equal(data.audit.record.decision.canBroadcast,false);
      assert.equal(data.audit.record.decision.signal,null);
      assert.equal(data.audit.record.evidence.referenceVerified,false);
      assert.equal(data.audit.record.evidence.pnlVerified,false);
      assert.equal(data.audit.executionEnabled,false);
      assert.equal(data.audit.durableStorage,false);
      assert.match(data.audit.sha256,/^[a-f0-9]{64}$/);
    }
    assert.equal(calls.some(c=>c.includes("/chain/tx")||c.includes("/contract/view")),false);
  });
});

test("public custom limits and unchecked local pause switch cannot authorize trading",async()=>{
  await withRpc(healthy,async()=>{
    const r=await GET(request({
      base:"TESTBTC",owner:OWNER,
      killSwitchEngaged:"false",operatorPaused:"false",
      targetSpreadBps:"120",maxSlippageBps:"25",
      maxTradeAmaAtomic:"500000000",
    }));
    assert.equal(r.status,200);
    const data=await r.json();
    assert.equal(data.audit.record.policy.targetSpreadBps,120);
    assert.equal(data.audit.record.policy.maxSlippageBps,25);
    assert.equal(data.audit.record.controls.killSwitchEngaged,false);
    assert.equal(data.audit.record.controls.operatorPaused,false);
    assert.equal(data.audit.record.controls.authenticatedOperatorApproval,false);
    assert.equal(data.audit.record.decision.status,"hold");
    assert.equal(data.audit.record.decision.executionApproved,false);
    assert.equal(data.executionEnabled,false);
  });
});

test("unknown token, spoofed oracle/PnL/approval, unauthorized wallet and unbounded risk reject BEFORE RPC",async()=>{
  await withRpc(()=>{throw Error("no rpc");},async calls=>{
    const invalid=[
      {base:"TESTETH"},{base:"AMA"},{base:"TESTBTC",owner:"0x123"},
      {base:"TESTBTC",oraclePrice:"200"},
      {base:"TESTBTC",dailyPnl:"10000"},
      {base:"TESTBTC",authenticatedOperatorApproval:"true"},
      {base:"TESTBTC",enableTrading:"true"},
      {base:"TESTBTC",maxSlippageBps:"101"},
      {base:"TESTUSD",targetSpreadBps:"29"},
      {base:"TESTUSD",maxTradeAmaAtomic:"10000000000000000"},
      {base:"TESTUSD",killSwitchEngaged:"anything"},
    ];
    for(const args of invalid){
      const q=new URLSearchParams();
      for(const [key,value] of Object.entries(args))if(typeof value==="string")q.set(key,value);
      const r=await GET(new Request(baseUrl+"?"+q.toString()));
      assert.equal(r.status,400);
      const v=await r.json();
      assert.equal(v.audit,null);
      assert.equal(v.terminal,null);
      assert.equal(v.executionEnabled,false);
    }
    assert.equal(calls.length,0);
  });
});

test("RPC outage and unsafe mainnet config fail closed, no fabricated audit",async()=>{
  await withRpc(()=>Response.json({error:"rpc_down"},{status:503}),async calls=>{
    const r=await GET(request({owner:OWNER}));
    assert.equal(r.status,503);
    const data=await r.json();
    assert.equal(data.audit,null);
    assert.equal(data.terminal,null);
    assert.equal(data.executionEnabled,false);
    assert.ok(calls.every(c=>c.startsWith(AMA_TESTNET_RPC+"/")));
  });
  await withRpc(()=>{throw Error("must not fetch");},async calls=>{
    process.env.AMADEUS_RPC_URL="https://mainnet-rpc.ama.one/api";
    const r=await GET(request());
    assert.equal(r.status,503);
    assert.equal((await r.json()).executionEnabled,false);
    assert.equal(calls.length,0);
  });
});

test("agent exposes only GET, no endpoint for automated transaction submission",async()=>{
  const api=await import("../app/api/agent/monitor/route");
  assert.equal(typeof api.GET,"function");
  assert.equal("POST" in api,false);
  assert.equal("PUT" in api,false);
  assert.equal("DELETE" in api,false);
});
