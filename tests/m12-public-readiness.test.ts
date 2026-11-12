import test from "node:test";
import assert from "node:assert/strict";
import type { TerminalReader } from "../lib/terminal/read";
import {
  DEMO_BASES, DEMO_EXPLORER, readPublicDemoReadiness,
} from "../lib/demo/readiness";

function sdkFixture(options?:{
  registered?:boolean;
  height?:number;
  rootedHeight?:number;
  divergentRoots?:boolean;
  rejectSecondRegistry?:boolean;
}){
  const calls:string[]=[];
  let statsReads=0;
  const sdk={
    chain:{
      getTip:async()=>{
        calls.push("tip");
        return {entry:{header:{height:options?.height??100}}};
      },
      getStats:async()=>{
        calls.push("stats");
        statsReads++;
        return {stats:{
          height:options?.height??100,
          rooted_height:options?.divergentRoots && statsReads===2
            ? (options?.rootedHeight??99)-40
            : (options?.rootedHeight??99),
        }};
      },
      getByFilter:async()=>{throw Error("unverified_pool_history_must_not_be_queried");},
    },
    contract:{
      get:async(key:Uint8Array)=>{
        const str=new TextDecoder().decode(key);
        calls.push("coin:"+str);
        if(options?.rejectSecondRegistry&&str.includes("TESTUSD"))throw Error("RPC state unavailable");
        return options?.registered?"1000000000000000":null;
      },
      view:async()=>{throw Error("unverified_pool_contract_must_not_be_viewed");},
    },
    transaction:{
      get:async()=>{throw Error("unverified_swap_must_not_be_queried");},
    },
    wallet:{
      getBalance:async()=>{throw Error("public readiness must not query an arbitrary wallet");},
    },
  } as unknown as TerminalReader;
  return {sdk,calls};
}

test("M12 allows only TESTBTC/AMA and TESTUSD/AMA, AMA as the sole quote",()=>{
  assert.deepEqual([...DEMO_BASES],["TESTBTC","TESTUSD"]);
  assert.equal(DEMO_EXPLORER,"https://testnet.explorer.ama.one");
});

test("unissued real native Coin state never becomes fake liquidity, pricing or exchange readiness",async()=>{
  const {sdk,calls}=sdkFixture();
  const evidence=await readPublicDemoReadiness(sdk);
  assert.equal(evidence.schema,"symbiotic.m12.public-readiness.v1");
  assert.equal(evidence.network,"amadeus-testnet");
  assert.equal(evidence.status,"research_demo_only");
  assert.equal(evidence.rootHeight,99);
  assert.equal(evidence.tipHeight,100);
  assert.equal(evidence.checks.rpcReachable,true);
  assert.equal(evidence.checks.twoPairAllowlist,true);
  assert.equal(evidence.checks.testTokensIndependentlyMinted,false);
  assert.equal(evidence.checks.twoNativePoolsDeployed,false);
  assert.equal(evidence.checks.nativePoolCustodyIndependentlyReconciled,false);
  assert.equal(evidence.checks.fourFinalizedBidirectionalSwapReceiptsVerified,false);
  assert.equal(evidence.checks.publicWebDeploymentVerified,false);
  assert.equal(evidence.tradingEnabled,false);
  assert.equal(evidence.signingEnabled,false);
  assert.equal(evidence.productionReady,false);
  assert.equal(evidence.grantSubmissionApproved,false);
  assert.equal(evidence.evidencePersistent,false);
  assert.match(evidence.evidenceDigestSha256,/^[a-f0-9]{64}$/);
  assert.deepEqual(evidence.markets.map(x=>x.pair),["TESTBTC/AMA","TESTUSD/AMA"]);
  for(const market of evidence.markets){
    assert.equal(market.nativeCoinRegistration,"unregistered");
    assert.equal(market.registeredSupplyAtomic,null);
    assert.equal(market.poolCertificateAvailable,false);
    assert.equal(market.poolAddress,null);
    assert.equal(market.reservesIndependentlyReconciled,false);
    assert.equal(market.verifiedHistoryAvailable,false);
    assert.equal(market.priceChartAvailable,false);
    assert.equal(market.liveSpotTradingEnabled,false);
  }
  assert.equal(calls.filter(x=>x.startsWith("coin:")).length,2);
  assert.ok(calls.every(x=>x==="tip"||x==="stats"||x.startsWith("coin:")));
  assert.ok(evidence.blockers.some(x=>x.includes("M8")));
});

test("a registered symbol owned by an unknown issuer is NOT independent mint acceptance",async()=>{
  const {sdk}=sdkFixture({registered:true});
  const evidence=await readPublicDemoReadiness(sdk);
  assert.deepEqual(evidence.markets.map(x=>x.nativeCoinRegistration),["registered","registered"]);
  assert.deepEqual(evidence.markets.map(x=>x.registeredSupplyAtomic),[
    "1000000000000000","1000000000000000",
  ]);
  assert.equal(evidence.checks.testTokensIndependentlyMinted,false);
  assert.equal(evidence.checks.realLiquidityAcceptanceVerified,false);
  assert.equal(evidence.checks.twoWalletTerminalAcceptanceVerified,false);
  assert.equal(evidence.tradingEnabled,false);
});

test("source digest is reproducible for identical native observations, changes with rooted state",async()=>{
  const a=await readPublicDemoReadiness(sdkFixture().sdk);
  const b=await readPublicDemoReadiness(sdkFixture().sdk);
  assert.equal(a.evidenceDigestSha256,b.evidenceDigestSha256);
  const c=await readPublicDemoReadiness(sdkFixture({height:101,rootedHeight:100}).sdk);
  assert.notEqual(a.evidenceDigestSha256,c.evidenceDigestSha256);
  assert.equal(a.evidencePersistent,false);
});

test("RPC inconsistency, a rollback or one unavailable pair must fail the whole two-pair readiness",async()=>{
  await assert.rejects(readPublicDemoReadiness(sdkFixture({divergentRoots:true}).sdk));
  await assert.rejects(readPublicDemoReadiness(sdkFixture({height:100,rootedHeight:101}).sdk));
  await assert.rejects(readPublicDemoReadiness(sdkFixture({rejectSecondRegistry:true}).sdk));
  const broken=sdkFixture();
  broken.sdk.chain.getTip=async()=>{throw Error("testnet offline");};
  await assert.rejects(readPublicDemoReadiness(broken.sdk));
});

test("no user wallet or private key is required or queried by public evidence endpoint",async()=>{
  const {sdk,calls}=sdkFixture();
  await readPublicDemoReadiness(sdk);
  assert.equal(calls.some(x=>x.includes("wallet")||x.includes("private")),false);
});
