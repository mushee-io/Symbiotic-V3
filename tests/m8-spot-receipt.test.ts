import test from "node:test";
import assert from "node:assert/strict";
import { toBase58 } from "@amadeus-protocol/sdk";
import type { AmadeusSDK } from "@amadeus-protocol/sdk";
import type { PoolSnapshot } from "../lib/liquidity/read";
import { quoteNativeSpot } from "../lib/spot/quote";
import { buildNativeSpotIntent, type NativeSpotIntent } from "../lib/spot/intent";
import {
  verifyFinalizedNativeSwap, readTraderCoinBalances,
  type TraderCoinBalances,
} from "../lib/spot/receipt";

const CONTRACT=toBase58(new Uint8Array(48).fill(7));
const OWNER=toBase58(new Uint8Array(48).fill(8));
const HASH=toBase58(new Uint8Array(32).fill(9));
const before:PoolSnapshot = {
  symbol:"TESTBTC",pair:"TESTBTC/AMA",address:CONTRACT,
  reserveBase:"1000000",reserveAma:"2000000",totalLp:"1414213",
  custodyBase:"1000000",custodyAma:"2000000",
  owner:OWNER,ownerLp:"0",paused:false,reconciled:true,
};

function fixture(side:"BUY"|"SELL") {
  const quote=quoteNativeSpot(before,side,"50000",50);
  const intent=buildNativeSpotIntent(before,OWNER,side,"50000",50,100,101,120,quote);
  const input=BigInt(intent.attachments[0].amount);
  const out=BigInt(intent.expectedOut);
  const baseChange=side==="BUY"?-out:input;
  const amaChange=side==="BUY"?input:-out;
  const after:PoolSnapshot = {
    ...before,
    reserveBase:String(BigInt(before.reserveBase)+baseChange),
    reserveAma:String(BigInt(before.reserveAma)+amaChange),
    custodyBase:String(BigInt(before.custodyBase)+baseChange),
    custodyAma:String(BigInt(before.custodyAma)+amaChange),
  };
  const walletBefore:TraderCoinBalances = {
    owner:OWNER,baseSymbol:"TESTBTC",baseAtomic:"1000000",amaAtomic:"1000000",
    source:"native_testnet_coin",
  };
  const walletAfter:TraderCoinBalances = {
    ...walletBefore,
    baseAtomic:String(BigInt(walletBefore.baseAtomic)-(baseChange)),
    amaAtomic:String(BigInt(walletBefore.amaAtomic)+(-amaChange)-10n),
  };
  return {quote,intent,after,walletBefore,walletAfter};
}
function fakeSdk(intent:NativeSpotIntent, changes:Record<string,unknown>={}) {
  let requests=0;
  const transaction={
    get:async (hash:string)=>{
      assert.equal(hash,HASH);
      requests++;
      return {
        hash:changes.hash??HASH,
        receipt:{success:changes.success??true},
        metadata:{status:changes.finalized===false?"confirmed":"finalized",entry_height:changes.height??102},
        tx:{
          signer:changes.signer??intent.signer,
          action:{
            op:"call",
            contract:changes.contract??intent.contract,
            function:changes.method??intent.method,
            args:changes.args??[...intent.args],
            attached_symbol:changes.attached_symbol??intent.attachments[0].symbol,
            attached_amount:changes.attached_amount??intent.attachments[0].amount,
          },
        },
      };
    },
  } as unknown as AmadeusSDK["transaction"];
  return { sdk:{transaction} as Pick<AmadeusSDK,"transaction">,calls:()=>requests };
}

test("both native BUY and SELL require finalized transaction, exact Coin attachment, reserves and wallet changes",async()=>{
  for(const side of ["BUY","SELL"] as const){
    const f=fixture(side);
    const s=fakeSdk(f.intent);
    const result=await verifyFinalizedNativeSwap(
      s.sdk,HASH,f.intent,before,f.after,f.walletBefore,f.walletAfter,
    );
    assert.equal(result.status,"finalized_and_reconciled");
    assert.equal(result.side,side);
    assert.equal(result.pair,"TESTBTC/AMA");
    assert.equal(result.hash,HASH);
    assert.equal(result.received,f.intent.expectedOut);
    assert.equal(s.calls(),1);
  }
});

test("unfinalized, failed, wrong contract/action/signer, wrong attached native Coin cannot certify swaps",async()=>{
  const f=fixture("BUY");
  for(const changes of [
    {success:false},{finalized:false},{signer:CONTRACT},{contract:OWNER},
    {method:"add_liquidity"},{args:["1","120"]},{attached_symbol:"USDC"},
    {attached_symbol:"TESTBTC"},{attached_amount:"10000"},
    {hash:OWNER},{height:121},{height:99},
  ]){
    await assert.rejects(verifyFinalizedNativeSwap(
      fakeSdk(f.intent,changes).sdk,HASH,f.intent,before,f.after,f.walletBefore,f.walletAfter,
    ),Error);
  }
  await assert.rejects(verifyFinalizedNativeSwap(
    fakeSdk(f.intent).sdk,"0xbad",f.intent,before,f.after,f.walletBefore,f.walletAfter,
  ));
});

test("wallet base Coin transfer must match; AMA can include gas but cannot exceed gross swap output",async()=>{
  for(const side of ["BUY","SELL"] as const){
    const f=fixture(side);
    const altered=side==="BUY"
      ? {...f.walletAfter,baseAtomic:String(BigInt(f.walletAfter.baseAtomic)+1n)}
      : {...f.walletAfter,baseAtomic:String(BigInt(f.walletAfter.baseAtomic)+1n)};
    await assert.rejects(verifyFinalizedNativeSwap(
      fakeSdk(f.intent).sdk,HASH,f.intent,before,f.after,f.walletBefore,altered,
    ),/trader_coin_balances_do_not_reconcile/);
    const extraAma=side==="BUY"
      ? String(BigInt(f.walletBefore.amaAtomic)-49999n)
      : String(BigInt(f.walletBefore.amaAtomic)+BigInt(f.intent.expectedOut)+1n);
    await assert.rejects(verifyFinalizedNativeSwap(
      fakeSdk(f.intent).sdk,HASH,f.intent,before,f.after,f.walletBefore,
      {...f.walletAfter,amaAtomic:extraAma},
    ),/trader_coin_balances_do_not_reconcile/);
  }
});

test("tampered native reserves, pool Coin balances, LP supply or account identity fail closed",async()=>{
  const f=fixture("SELL");
  const after=f.after;
  for(const candidate of [
    {...after,reserveAma:"1"},
    {...after,reserveBase:"1"},
    {...after,custodyBase:"0"},
    {...after,custodyAma:"0"},
    {...after,totalLp:"1414212"},
    {...after,ownerLp:"1"},
    {...after,owner:CONTRACT},
    {...after,paused:true},
    {...after,reconciled:false as true},
  ]){
    await assert.rejects(verifyFinalizedNativeSwap(
      fakeSdk(f.intent).sdk,HASH,f.intent,before,candidate,f.walletBefore,f.walletAfter,
    ),Error);
  }
});

test("recalculate quote from original snapshot; altered intent cannot fake a filled amount",async()=>{
  const f=fixture("BUY");
  const tampered={...f.intent,expectedOut:String(BigInt(f.intent.expectedOut)+1n)};
  await assert.rejects(verifyFinalizedNativeSwap(
    fakeSdk(tampered).sdk,HASH,tampered,before,f.after,f.walletBefore,f.walletAfter,
  ),/swap_quote_mismatch/);
});

test("real native wallet balance queries reject unsafe JS Coin precision and unknown symbols",async()=>{
  const client={
    wallet:{
      getBalance:async (_owner:string,symbol:string)=>({
        balance:{symbol,flat:symbol==="AMA"?700000:300000,float:0},
      }),
    },
  } as unknown as Pick<AmadeusSDK,"wallet">;
  const result=await readTraderCoinBalances(client,OWNER,"TESTBTC");
  assert.deepEqual(result,{
    owner:OWNER,baseSymbol:"TESTBTC",baseAtomic:"300000",amaAtomic:"700000",
    source:"native_testnet_coin",
  });
  await assert.rejects(readTraderCoinBalances(client,"0xinvalid","TESTBTC"));
  await assert.rejects(readTraderCoinBalances(client,OWNER,"TESTETH" as never));
  const unsafe={
    wallet:{getBalance:async(_owner:string,symbol:string)=>({
      balance:{symbol,flat:Number.MAX_SAFE_INTEGER+1,float:0},
    })},
  } as unknown as Pick<AmadeusSDK,"wallet">;
  await assert.rejects(readTraderCoinBalances(unsafe,OWNER,"TESTBTC"));
});
