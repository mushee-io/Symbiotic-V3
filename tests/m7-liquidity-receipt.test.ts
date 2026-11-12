import test from "node:test";
import assert from "node:assert/strict";
import { toBase58 } from "@amadeus-protocol/sdk";
import type { AmadeusSDK } from "@amadeus-protocol/sdk";
import { buildAddLiquidityIntent, buildRemoveLiquidityIntent } from "../lib/liquidity/intent";
import { verifyFinalizedLiquidityReceipt } from "../lib/liquidity/receipt";
import type { PoolSnapshot } from "../lib/liquidity/read";

const ADDRESS=toBase58(new Uint8Array(48).fill(5));
const OWNER=toBase58(new Uint8Array(48).fill(6));
const HASH=toBase58(new Uint8Array(32).fill(7));
const before:PoolSnapshot={
  symbol:"TESTBTC",pair:"TESTBTC/AMA",address:ADDRESS,
  reserveBase:"10000000",reserveAma:"20000000",totalLp:"14142135",
  custodyBase:"10000000",custodyAma:"20000000",
  owner:OWNER,ownerLp:"14141135",paused:false,reconciled:true,
};

function ledger(intent:ReturnType<typeof buildAddLiquidityIntent>) {
  const delta=(v:string)=>BigInt(v);
  return {
    ...before,
    reserveBase:String(BigInt(before.reserveBase)+delta(intent.expected.base)),
    reserveAma:String(BigInt(before.reserveAma)+delta(intent.expected.ama)),
    custodyBase:String(BigInt(before.custodyBase)+delta(intent.expected.base)),
    custodyAma:String(BigInt(before.custodyAma)+delta(intent.expected.ama)),
    totalLp:String(BigInt(before.totalLp)+delta(intent.expected.lp)),
    ownerLp:String(BigInt(before.ownerLp!)+delta(intent.expected.lp)),
  };
}

function fakeTx(intent:{contract:string;method:string;args:readonly string[];signer:string},opts:{success?:boolean;finalized?:boolean;wrongMethod?:boolean}={}) {
  let fetched=0;
  const transaction={
    get:async (hash:string)=>{
      assert.equal(hash,HASH);
      fetched++;
      return {
        hash:HASH,
        tx:{signer:intent.signer,action:{op:"call",contract:intent.contract,
          function:opts.wrongMethod?"swap_exact_in":intent.method,args:[...intent.args]}},
        receipt:{success:opts.success??true},
        metadata:{entry_height:77,status:opts.finalized===false?"confirmed":"finalized"},
      };
    },
  } as unknown as AmadeusSDK["transaction"];
  return {transaction,calls:()=>fetched};
}

test("finalized native add-liquidity receipt checks signer, method and exact reserves and LP",async()=>{
  const intent=buildAddLiquidityIntent(before,OWNER,"500000","1000000","1",100,120);
  const after=ledger(intent);
  const sdk=fakeTx(intent);
  const result=await verifyFinalizedLiquidityReceipt(sdk,HASH,intent,before,after);
  assert.equal(result.status,"finalized_and_reconciled");
  assert.equal(result.operation,"add_liquidity");
  assert.equal(result.hash,HASH);
  assert.equal(result.changeBase,intent.expected.base);
  assert.equal(result.changeLp,intent.expected.lp);
  assert.equal(sdk.calls(),1);
});

test("finalized native LP withdrawal must reduce reserves and caller shares by exact amounts",async()=>{
  const intent=buildRemoveLiquidityIntent(before,OWNER,"1000","1","1",100,120);
  const change=(v:string)=>BigInt(v);
  const after:PoolSnapshot={
    ...before,
    reserveBase:String(BigInt(before.reserveBase)-change(intent.expected.base)),
    reserveAma:String(BigInt(before.reserveAma)-change(intent.expected.ama)),
    custodyBase:String(BigInt(before.custodyBase)-change(intent.expected.base)),
    custodyAma:String(BigInt(before.custodyAma)-change(intent.expected.ama)),
    totalLp:String(BigInt(before.totalLp)-change(intent.expected.lp)),
    ownerLp:String(BigInt(before.ownerLp!)-change(intent.expected.lp)),
  };
  const result=await verifyFinalizedLiquidityReceipt(fakeTx(intent),HASH,intent,before,after);
  assert.equal(result.changeLp,"-1000");
  assert.equal(result.operation,"remove_liquidity");
});

test("hash alone, incorrect method, unfinalized execution and failed receipt are not success",async()=>{
  const intent=buildAddLiquidityIntent(before,OWNER,"500000","1000000","1",100,120);
  const after=ledger(intent);
  for(const flags of [{success:false},{finalized:false},{wrongMethod:true}]) {
    await assert.rejects(verifyFinalizedLiquidityReceipt(fakeTx(intent,flags),HASH,intent,before,after));
  }
  await assert.rejects(verifyFinalizedLiquidityReceipt(fakeTx(intent),"notahash",intent,before,after));
});

test("no fabricated success on stale or unreconciled custody/LP owner state",async()=>{
  const intent=buildAddLiquidityIntent(before,OWNER,"500000","1000000","1",100,120);
  const after=ledger(intent);
  for(const modified of [
    {...after,ownerLp:before.ownerLp},
    {...after, totalLp:before.totalLp},
    {...after,custodyAma:"0"},
    {...after,owner:ADDRESS},
    {...after, reserveBase:before.reserveBase},
    {...after,reconciled:false as true},
  ]) {
    await assert.rejects(verifyFinalizedLiquidityReceipt(fakeTx(intent),HASH,intent,before,modified));
  }
});
