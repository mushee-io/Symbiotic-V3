"use client";

import { useEffect, useState } from "react";
import type { PublicDemoReadiness } from "@/lib/demo/readiness";
import { DEMO_EXPLORER, DEMO_GITHUB } from "@/lib/demo/readiness";

type API = {
  network:"amadeus-testnet";
  status:"verified_read_only_observation";
  readiness:PublicDemoReadiness;
  tradingEnabled:false;
  signingEnabled:false;
};

/** Public, evidence-linked demo only. Never has signing, trading or mint controls. */
export function DemoReadinessPanel(){
  const [data,setData]=useState<PublicDemoReadiness|null>(null);
  const [status,setStatus]=useState<"loading"|"observed"|"unavailable">("loading");
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    let active=true;
    setData(null);setStatus("loading");
    void fetch("/api/demo/readiness",{cache:"no-store",signal:controller.signal})
      .then(async response=>{
        const value:unknown=await response.json();
        if(!active)return;
        if(!response.ok||!value||typeof value!=="object"||
            !("status" in value)||value.status!=="verified_read_only_observation"||
            !("network" in value)||value.network!=="amadeus-testnet"||
            !("tradingEnabled" in value)||value.tradingEnabled!==false||
            !("signingEnabled" in value)||value.signingEnabled!==false||
            !("readiness" in value)||!value.readiness||typeof value.readiness!=="object"){
          throw Error("unverified_demo_response");
        }
        const v=value as API;
        if(v.readiness.network!=="amadeus-testnet"||
            v.readiness.status!=="research_demo_only"||
            v.readiness.tradingEnabled!==false||
            v.readiness.signingEnabled!==false||
            v.readiness.markets.length!==2||
            v.readiness.markets[0].pair!=="TESTBTC/AMA"||
            v.readiness.markets[1].pair!=="TESTUSD/AMA"||
            !/^[0-9a-f]{64}$/.test(v.readiness.evidenceDigestSha256)){
          throw Error("unverified_pair_or_execution_state");
        }
        setData(v.readiness);setStatus("observed");
      })
      .catch(()=>{if(active){setData(null);setStatus("unavailable");}});
    return ()=>{active=false;controller.abort();};
  },[refresh]);

  const checks=[
    {label:"Public RPC and rooted chain reads",passed:Boolean(data?.checks.rpcReachable),stage:"M2"},
    {label:"Two independent wallet signing witnesses",passed:Boolean(data?.checks.walletSigningDomainIndependentlyVerified),stage:"M3"},
    {label:"Authentic native test token mint receipts",passed:Boolean(data?.checks.testTokensIndependentlyMinted),stage:"M4"},
    {label:"Two deployed and verified pool contracts",passed:Boolean(data?.checks.twoNativePoolsDeployed),stage:"M6"},
    {label:"Real funded liquidity and custody",passed:Boolean(data?.checks.realLiquidityAcceptanceVerified),stage:"M7"},
    {label:"Four finalized BUY/SELL receipts",passed:Boolean(data?.checks.fourFinalizedBidirectionalSwapReceiptsVerified),stage:"M8"},
    {label:"Two-wallet terminal acceptance",passed:Boolean(data?.checks.twoWalletTerminalAcceptanceVerified),stage:"M9"},
    {label:"Operator/AI production acceptance",passed:Boolean(data?.checks.aiAgentRealExecutionAcceptanceVerified),stage:"M10"},
    {label:"Native VM runtime security assessment",passed:Boolean(data?.checks.nativeVmSecurityAcceptanceVerified),stage:"M11"},
    {label:"Independently verified public demo deployment",passed:Boolean(data?.checks.publicWebDeploymentVerified),stage:"M12"},
  ];

  return <section className="demoPanel panel" id="demo-readiness" aria-label="Amadeus public testnet readiness">
    <div className="demoPanelHead">
      <div>
        <p className="eyebrow">LIVE READS, NOT LIVE TRADING</p>
        <h2>Evidence &amp; readiness</h2>
        <p className="muted">This page can verify public network and Coin registry data. It does not substitute a transaction receipt or external security assessment.</p>
      </div>
      <button className="walletRefresh" type="button" onClick={()=>setRefresh(x=>x+1)}>Refresh on-chain evidence</button>
    </div>
    <div className="demoStatusStrip" role="status" aria-live="polite">
      <span className="demoDot" aria-hidden="true"/>
      <strong>{status==="observed"?"Read-only observations available":
        status==="loading"?"Checking official Amadeus testnet…":
        "Public chain observations unavailable — no readiness claimed"}</strong>
      {data&&<span>Rooted block {data.rootHeight.toLocaleString("en-US")}</span>}
      <span className="demoNoTrade">Swaps and signing disabled</span>
    </div>
    <div className="demoMarketGrid">
      {["TESTBTC/AMA","TESTUSD/AMA"].map((pair,index)=>{
        const market=data?.markets[index];
        return <article className="demoMarketCard" key={pair}>
          <div className="demoMarketName"><strong>{pair}</strong><small>AMA QUOTE ONLY</small></div>
          <dl>
            <div><dt>Native Coin registration</dt><dd>{market?
              market.nativeCoinRegistration==="registered"?"Registered (issuer unverified)":"Not registered":"Unavailable"}</dd></div>
            <div><dt>Deployed pool</dt><dd>{market?.poolCertificateAvailable?"Certificate present":"Not verified"}</dd></div>
            <div><dt>On-chain liquidity</dt><dd>{market?.reservesIndependentlyReconciled?"Reserve/custody reconciled":"Not verified"}</dd></div>
            <div><dt>Trading</dt><dd>Disabled</dd></div>
          </dl>
          {market?.poolAddress&&<a href={DEMO_EXPLORER+"/network/address/"+market.poolAddress} target="_blank" rel="noopener noreferrer" className="demoTextLink">Inspect verified pool in explorer</a>}
        </article>;
      })}
    </div>
    <div className="demoSplit">
      <div className="demoChecks">
        <h3>Independent acceptance gates</h3>
        <div className="demoCheckList">
          {checks.map(item=><div className="demoCheck" key={item.stage}>
            <span className={data&&item.passed?"demoCheckMark":"demoCheckBlocked"} aria-hidden="true">{data&&item.passed?"✓":"–"}</span>
            <span>{item.label}</span>
            <a href={DEMO_GITHUB+"/issues/"+item.stage.slice(1)} target="_blank" rel="noopener noreferrer">{item.stage}</a>
          </div>)}
        </div>
        {!data&&<p className="muted demoDisclaimer">Current public-chain availability could not be verified; no missing evidence has been promoted to complete.</p>}
      </div>
      <div className="demoEvidence">
        <h3>Evidence provenance</h3>
        <p>Network: <strong>Amadeus public testnet</strong></p>
        <p>Data source: <code>testnet-rpc.ama.one</code></p>
        <p>Observed at: {data?new Date(data.checkedAt).toLocaleString():"No observation"}</p>
        <p>SHA-256 snapshot digest (not a transaction ID):</p>
        <code className="demoDigest">{data?.evidenceDigestSha256??"Unavailable"}</code>
        <p className="muted demoDisclaimer">This read-only digest is reproducible from observed state, but no permanent record is stored here. Public web hosting must be checked independently.</p>
        <div className="demoLinks">
          <a href={DEMO_EXPLORER} target="_blank" rel="noopener noreferrer">Native explorer ↗</a>
          <a href={DEMO_GITHUB+"/actions"} target="_blank" rel="noopener noreferrer">GitHub CI ↗</a>
          <a href={DEMO_GITHUB+"/blob/main/docs/m12-public-testnet-demo.md"} target="_blank" rel="noopener noreferrer">Demo guide ↗</a>
        </div>
      </div>
    </div>
    <p className="demoFooter">TESTBTC and TESTUSD are experimental test symbols, not representations of or claims on real BTC or USD. The roadmap is source implementation and research until independently verified, finalized on-chain activity proves otherwise.</p>
  </section>;
}
