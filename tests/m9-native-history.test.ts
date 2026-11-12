import test from "node:test";
import assert from "node:assert/strict";
import {toBase58} from "@amadeus-protocol/sdk";
import type {AmadeusSDK} from "@amadeus-protocol/sdk";
import type {PoolCertificate} from "../lib/liquidity/deployments";
import {LiquidityUnavailableError} from "../lib/liquidity/deployments";
import {
  validNativeTxHash,explorerAccountUrl,explorerTxUrl,TESTNET_EXPLORER_URL,
  MAX_HISTORY_RESULTS,verifyFinalizedSwapCall,readFinalizedWalletSwaps,
} from "../lib/terminal/history";

const OWNER=toBase58(new Uint8Array(48).fill(7));
const CONTRACT=toBase58(new Uint8Array(48).fill(6));
const HASH=toBase58(new Uint8Array(32).fill(8));
const HASH2=toBase58(new Uint8Array(32).fill(9));
const certificate:PoolCertificate={
  symbol:"TESTBTC",address:CONTRACT,deploymentTx:HASH,initializationTx:HASH2,
  elfSha256:"a".repeat(64),deploymentFinalized:true,initializationFinalized:true,
  runtimeTestsPassed:true,tokenMintFinalized:true,walletNetworkWitnessed:true,
  attachmentSigningVerified:true,
};
function tx(changes:Record<string,unknown>={}):unknown {
  return {
    hash:changes.hash??HASH,receipt:{success:changes.success??true},
    metadata:{status:changes.finalized===false?"confirmed":"finalized",entry_height:changes.height??101},
    tx:{
      signer:changes.owner??OWNER,
      action:{
        op:"call",contract:changes.contract??CONTRACT,
        function:changes.function??"swap_exact_in",
        args:changes.args??["100","150"],
        attached_symbol:changes.symbol??"AMA",
        attached_amount:changes.amount??"50000",
      },
    },
  };
}
function sdk(candidateHashes:string[],changes:Record<string,unknown>={}) {
  const queries:unknown[]=[];
  let gets=0;
  const client={
    chain:{getByFilter:async q=>{queries.push(q);return {cursor:null,txs:candidateHashes.map(hash=>({hash}))};}},
    transaction:{get:async hash=>{gets++;return tx({...changes,hash});}},
  } as unknown as Pick<AmadeusSDK,"chain"|"transaction">;
  return {client,queries,gets:()=>gets};
}

test("only canonical native Base58 hashes/addresses produce TESTNET explorer URLs",()=>{
  assert.equal(validNativeTxHash(HASH),true);
  assert.equal(explorerTxUrl(HASH),TESTNET_EXPLORER_URL+"/network/tx/"+HASH);
  assert.equal(explorerAccountUrl(OWNER),TESTNET_EXPLORER_URL+"/network/address/"+OWNER);
  for(const bad of ["",null,"0x"+"1".repeat(64),"not_base58",OWNER]){
    assert.equal(validNativeTxHash(bad),false);
    assert.throws(()=>explorerTxUrl(String(bad)),LiquidityUnavailableError);
  }
});

test("finalized successful native call has bounded chain height and exact AMA attachment, not fake fills",()=>{
  const x=verifyFinalizedSwapCall(tx(),HASH,certificate,OWNER,102);
  assert.deepEqual({
    hash:x.hash,pair:x.pair,side:x.side,symbol:x.attachedSymbol,amount:x.amountInAtomic,
    minimum:x.minimumOutAtomic,status:x.status,output:x.outputVerified,
  },{
    hash:HASH,pair:"TESTBTC/AMA",side:"BUY",symbol:"AMA",amount:"50000",
    minimum:"100",status:"finalized_successful_call",output:false,
  });
  assert.equal(x.height,101);
  const sell=verifyFinalizedSwapCall(tx({symbol:"TESTBTC"}),HASH,certificate,OWNER,102);
  assert.equal(sell.side,"SELL");
  assert.equal(sell.attachedSymbol,"TESTBTC");
});

test("reject wrong signer, pool, method, symbol, attachment, receipt, finality and height",()=>{
  const invalid=[
    {owner:CONTRACT},{contract:OWNER},{function:"transfer"},{symbol:"USDC"},
    {symbol:"TESTUSD"},{amount:"0"},{amount:"1.5"},{args:["1","100"]},
    {args:["0","150"]},{args:["1","1.5"]},{args:[]},{finalized:false},
    {success:false},{height:105},{height:-1},{hash:HASH2},
  ];
  for(const change of invalid){
    assert.throws(()=>verifyFinalizedSwapCall(tx(change),HASH,certificate,OWNER,102),
      LiquidityUnavailableError,JSON.stringify(change));
  }
  assert.throws(()=>verifyFinalizedSwapCall(tx(),HASH,certificate,OWNER,-1));
  assert.throws(()=>verifyFinalizedSwapCall(tx(),HASH,certificate,OWNER,100));
});

test("history is scoped to verified testnet wallet, fixed deployed pool/function; re-fetches each hash",async()=>{
  const fixture=sdk([HASH]);
  const result=await readFinalizedWalletSwaps(fixture.client,certificate,OWNER,120);
  assert.equal(result.length,1);
  assert.equal(result[0].hash,HASH);
  assert.equal(fixture.gets(),1);
  assert.deepEqual(fixture.queries,[{
    signer:OWNER,contract_b58:CONTRACT,function:"swap_exact_in",
    sort:"desc",limit:MAX_HISTORY_RESULTS,
  }]);
});

test("true empty certified history is []; missing cert and corrupted records throw, never fake 0 trades",async()=>{
  const fixture=sdk([]);
  assert.deepEqual(await readFinalizedWalletSwaps(fixture.client,certificate,OWNER,120),[]);
  assert.equal(fixture.gets(),0);
  const bad=sdk([HASH],{success:false});
  await assert.rejects(readFinalizedWalletSwaps(bad.client,certificate,OWNER,120));
  const wrong=sdk([HASH],{symbol:"USDC"});
  await assert.rejects(readFinalizedWalletSwaps(wrong.client,certificate,OWNER,120));
  await assert.rejects(readFinalizedWalletSwaps(fixture.client,{...certificate,runtimeTestsPassed:false as true},OWNER,120));
  await assert.rejects(readFinalizedWalletSwaps(fixture.client,certificate,CONTRACT+"invalid",120));
});

test("duplicate/filter-manipulated/overflow history cannot pass as independent verified calls",async()=>{
  const dupe=sdk([HASH,HASH]);
  await assert.rejects(readFinalizedWalletSwaps(dupe.client,certificate,OWNER,120));
  assert.equal(dupe.gets(),1);
  const many=sdk(Array(MAX_HISTORY_RESULTS+1).fill(HASH));
  await assert.rejects(readFinalizedWalletSwaps(many.client,certificate,OWNER,120));
  assert.equal(many.gets(),0);
  const future=sdk([HASH],{height:125});
  await assert.rejects(readFinalizedWalletSwaps(future.client,certificate,OWNER,120));
});
