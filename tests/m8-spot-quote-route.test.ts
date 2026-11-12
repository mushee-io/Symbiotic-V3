import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/spot/quote/route";
import { AMA_TESTNET_RPC } from "../lib/amadeus";
import { toBase58 } from "@amadeus-protocol/sdk";

const OWNER = toBase58(new Uint8Array(48).fill(4));
const baseUrl = "https://symbiotic.example/api/spot/quote";
function query(params:Record<string,string>={}){
  const p = new URLSearchParams({base:"TESTBTC",side:"BUY",amount:"10000",slippageBps:"50",...params});
  return new Request(baseUrl + "?" + p.toString());
}
function healthy(url:string):Response {
  if(url.endsWith("/chain/tip"))
    return Response.json({error:"ok",entry:{header:{height:8210000}}});
  if(url.endsWith("/chain/stats"))
    return Response.json({error:"ok",stats:{height:8209999,rooted_height:8209998}});
  throw new Error("unverified pool must not be viewed or assigned balances");
}
async function mockNativeRpc(
  responder:(url:string)=>Response,
  check:(calls:string[])=>Promise<void>,
){
  const original=globalThis.fetch;
  const configured=process.env.AMADEUS_RPC_URL;
  delete process.env.AMADEUS_RPC_URL;
  const calls:string[]=[];
  globalThis.fetch=async (input)=>{
    const url=input instanceof Request?input.url:String(input);
    calls.push(url);
    if(!url.startsWith(AMA_TESTNET_RPC+"/"))throw Error("mainnet or alternate RPC");
    return responder(url);
  };
  try{await check(calls);}finally{
    globalThis.fetch=original;
    if(configured===undefined)delete process.env.AMADEUS_RPC_URL;
    else process.env.AMADEUS_RPC_URL=configured;
  }
}

test("real RPC with no deployed pool cannot fabricate prices, volume or swap activity",async()=>{
  await mockNativeRpc(healthy,async calls=>{
    for(const base of ["TESTBTC","TESTUSD"]){
      for(const side of ["BUY","SELL"]){
        const r=await GET(query({base,side,owner:OWNER}));
        assert.equal(r.status,200);
        const json=await r.json();
        assert.equal(json.network,"amadeus-testnet");
        assert.equal(json.status,"blocked");
        assert.equal(json.quote,null);
        assert.equal(json.snapshot,null);
        assert.equal(json.tradingEnabled,false);
        assert.match(r.headers.get("cache-control")||"",/no-store/);
      }
    }
    assert.equal(calls.some(x=>x.includes("/contract/")||x.includes("/wallet/")),false);
  });
});

test("invalid pair, side, input, slippage and public owner fail before querying RPC",async()=>{
  await mockNativeRpc(()=>{throw new Error("no RPC expected");},async calls=>{
    const bad=[
      {base:"TESTETH"},{base:"BTC"},{base:"AMA"},{side:"EXACT_OUT"},
      {side:"SWAP"},{amount:"0"},{amount:"0.5"},{amount:"-100"},
      {amount:"9999999999999999999999999999999999999"},
      {slippageBps:"0"},{slippageBps:"501"},{slippageBps:"1.5"},
      {slippageBps:"050"},{owner:"0xfake"},
    ];
    for(const params of bad){
      const r=await GET(query(params));
      assert.equal(r.status,400);
      const payload=await r.json();
      assert.equal(payload.quote,null);
      assert.equal(payload.tradingEnabled,false);
    }
    assert.equal(calls.length,0);
  });
});

test("native RPC outage is 503 with null quote, no mainnet fallback",async()=>{
  await mockNativeRpc(()=>Response.json({error:"unavailable"},{status:503}),async calls=>{
    const r=await GET(query());
    assert.equal(r.status,503);
    const body=await r.json();
    assert.equal(body.status,"unavailable");
    assert.equal(body.quote,null);
    assert.equal(body.tradingEnabled,false);
    assert.ok(calls.every(x=>x.startsWith(AMA_TESTNET_RPC+"/")));
  });
});

test("explicit mainnet URL is forbidden without any requests",async()=>{
  await mockNativeRpc(()=>{throw new Error("should not fetch");},async calls=>{
    process.env.AMADEUS_RPC_URL="https://mainnet-rpc.ama.one/api";
    const r=await GET(query());
    assert.equal(r.status,503);
    assert.equal((await r.json()).quote,null);
    assert.equal(calls.length,0);
  });
});
