import test from "node:test";
import assert from "node:assert/strict";
import { toBase58 } from "@amadeus-protocol/sdk";
import {
  parseNativeReserves, parseActualCoinBalance, reconcileNativePool,
} from "../lib/liquidity/read";
import type { PoolCertificate } from "../lib/liquidity/deployments";
import type { AmadeusSDK } from "@amadeus-protocol/sdk";

const ADDRESS = toBase58(new Uint8Array(48).fill(8));
const OWNER = toBase58(new Uint8Array(48).fill(9));
const HASH = toBase58(new Uint8Array(32).fill(10));
const cert: PoolCertificate = {
  symbol:"TESTUSD",address:ADDRESS,deploymentTx:HASH,initializationTx:HASH,
  elfSha256:"f".repeat(64),deploymentFinalized:true,initializationFinalized:true,
  runtimeTestsPassed:true,tokenMintFinalized:true,walletNetworkWitnessed:true,
  attachmentSigningVerified:true,
};

test("strict native reserves parsing demands 4 fields, nonzero reserves and locked LP",()=>{
  assert.deepEqual(parseNativeReserves("2000|3000|1234|0"),{
    reserveBase:2000n,reserveAma:3000n,totalLp:1234n,paused:false,
  });
  assert.equal(parseNativeReserves("2000|3000|1234|1").paused,true);
  for(const invalid of ["0|3000|2000|0","2000|0|2000|0","1000|1000|999|0","1|2|3",
    "1.5|2|4000|0","01|2|4000|0","1|2|3000|maybe","x|2|3000|0"]) {
      assert.throws(()=>parseNativeReserves(invalid));
  }
});

test("Coin.flat must be a safe exact integer and precise matching symbol",()=>{
  assert.equal(parseActualCoinBalance({balance:{symbol:"AMA",flat:3000,float:0.000003}},"AMA"),3000n);
  assert.equal(parseActualCoinBalance({balance:{symbol:"AMA",flat:0,float:0}},"AMA"),0n);
  for(const bad of [
    {balance:{symbol:"AMA",flat:1.3}},
    {balance:{symbol:"AMA",flat:-1}},
    {balance:{symbol:"TESTUSD",flat:3000}},
    {balance:{symbol:"AMA",flat:Number.MAX_SAFE_INTEGER+1}},
    {balance:{symbol:"AMA",flat:Infinity}},
    {balance:{symbol:"AMA",flat:"3000"}},
    {},null,
  ]) assert.throws(()=>parseActualCoinBalance(bad,"AMA"));
});

function mockReader({
  change=false, wrongBase=false, custodyMismatch=false, lp="1300", failView=false, unsafe=false,
}:{
  change?:boolean;wrongBase?:boolean;custodyMismatch?:boolean;lp?:string;
  failView?:boolean;unsafe?:boolean;
}={}) {
  const calls:string[]=[];
  let reserveReads=0;
  const client = {
    contract:{
      view:async ({contract,function:fn,pk}:{contract:string;function:string;pk?:Uint8Array})=>{
        assert.equal(contract,ADDRESS);
        calls.push(fn);
        if (failView) return {success:false,result:"",logs:[]};
        if(fn==="get_base")return {success:true,result:wrongBase?"TESTBTC":"TESTUSD",logs:[]};
        if(fn==="get_reserves"){
          reserveReads++;
          return {success:true,result:change&&reserveReads===2?"2000|3001|2300|0":"2000|3000|2300|0",logs:[]};
        }
        if(fn==="get_lp"){
          assert.ok(pk instanceof Uint8Array);
          assert.equal(pk.length,48);
          return {success:true,result:lp,logs:[]};
        }
        throw new Error("unknown view");
      },
    },
    wallet:{
      getBalance:async (contract:string,symbol:string)=>{
        assert.equal(contract,ADDRESS);
        calls.push("balance:"+symbol);
        return {balance:{
          symbol,flat:unsafe?Number.MAX_SAFE_INTEGER+1:
          symbol==="AMA"?(custodyMismatch?3001:3000):2000,float:0,
        }};
      },
    },
  } as unknown as Pick<AmadeusSDK,"contract"|"wallet">;
  return {client,calls};
}

test("read-only native views reconcile both actual Coin balances with reserves and caller LP",async()=>{
  const {client,calls}=mockReader();
  const s=await reconcileNativePool(client,cert,OWNER);
  assert.equal(s.symbol,"TESTUSD");
  assert.equal(s.pair,"TESTUSD/AMA");
  assert.equal(s.reserveBase,"2000");
  assert.equal(s.custodyBase,"2000");
  assert.equal(s.reserveAma,"3000");
  assert.equal(s.custodyAma,"3000");
  assert.equal(s.totalLp,"2300");
  assert.equal(s.ownerLp,"1300");
  assert.equal(s.reconciled,true);
  assert.deepEqual(calls.filter(x=>x==="get_reserves").length,2);
  assert.equal(calls.includes("balance:AMA"),true);
  assert.equal(calls.includes("balance:TESTUSD"),true);
});

test("unconnected public read is read-only and never invents caller LP",async()=>{
  const {client,calls}=mockReader();
  const r=await reconcileNativePool(client,cert);
  assert.equal(r.owner,null);
  assert.equal(r.ownerLp,null);
  assert.equal(calls.includes("get_lp"),false);
});

test("reject wrong on-chain symbol, stale tip, custody mismatch, failed view and unsafe precision",async()=>{
  for (const flags of [{wrongBase:true},{change:true},{custodyMismatch:true},{failView:true},{unsafe:true},{lp:"2000"}]) {
    await assert.rejects(reconcileNativePool(mockReader(flags).client,cert,OWNER));
  }
});

test("reject unverified certificate before querying any RPC view",async()=>{
  const {client,calls}=mockReader();
  await assert.rejects(reconcileNativePool(client,{...cert,tokenMintFinalized:false as true},OWNER));
  assert.equal(calls.length,0);
});
