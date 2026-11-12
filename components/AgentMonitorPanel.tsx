"use client";
import * as React from "react";

import { useEffect, useState } from "react";
import {
  DEFAULT_AGENT_CONFIG, type AgentConfig,
} from "@/lib/agent/policy";
import type { AuditedAgentDecision } from "@/lib/agent/audit";
import type { NativeTerminalData } from "@/lib/terminal/read";

type ReadResponse=Readonly<{
  network:"amadeus-testnet";
  status:"read_only";
  executionEnabled:false;
  signingEnabled:false;
  terminal:NativeTerminalData;
  audit:AuditedAgentDecision;
}>;

const numericSettings:ReadonlyArray<{
  id:keyof AgentConfig;name:string;detail:string;
}>= [
  {id:"targetBaseBps",name:"Base inventory target (bps)",detail:"10,000 bps = 100%"},
  {id:"inventoryBandBps",name:"Rebalance deadband (bps)",detail:"No recommendation inside this band"},
  {id:"targetSpreadBps",name:"Indicative spread (bps)",detail:"Reference band only, not a tradable order"},
  {id:"maxSlippageBps",name:"Maximum slippage (bps)",detail:"Hard policy cap: 100 bps"},
  {id:"maxPoolUtilizationBps",name:"Max pool allocation (bps)",detail:"Hard cap: 100 bps"},
  {id:"maxReferenceDivergenceBps",name:"Reference divergence (bps)",detail:"No independent oracle currently integrated"},
  {id:"maxTradeAmaAtomic",name:"Max trade (atomic AMA)",detail:"Review-only proposal budget"},
  {id:"maxPositionAmaAtomic",name:"Max position (atomic AMA)",detail:"Inventory exposure limit"},
  {id:"dailyLossCapAmaAtomic",name:"Daily loss cap (atomic AMA)",detail:"Requires independently reconciled receipts"},
  {id:"gasReserveAmaAtomic",name:"Min gas reserve (atomic AMA)",detail:"Do not consume wallet fee reserve"},
];

export function AgentMonitorPanel({
  base, account, rpcHealthy,
}:{
  base:"TESTBTC"|"TESTUSD";
  account:string|null;
  rpcHealthy:boolean;
}){
  const [config,setConfig]=useState<AgentConfig>(DEFAULT_AGENT_CONFIG);
  const [operatorPaused,setOperatorPaused]=useState(true);
  const [killSwitchEngaged,setKillSwitchEngaged]=useState(true);
  const [result,setResult]=useState<ReadResponse|null>(null);
  const [status,setStatus]=useState<"loading"|"hold"|"unavailable">("loading");
  const [refreshKey,setRefreshKey]=useState(0);
  const [copyStatus,setCopyStatus]=useState("");

  useEffect(()=>{
    let active=true;
    const controller=new AbortController();
    let inFlight=false;
    setResult(null);
    setCopyStatus("");
    if(!rpcHealthy){setStatus("unavailable");return ()=>{active=false;controller.abort();};}
    const request=async()=>{
      if(inFlight)return;
      inFlight=true;
      const q=new URLSearchParams({
        base,operatorPaused:String(operatorPaused),
        killSwitchEngaged:String(killSwitchEngaged),
      });
      if(account)q.set("owner",account);
      for(const {id} of numericSettings)q.set(id,String(config[id]));
      try{
        const response=await fetch("/api/agent/monitor?"+q.toString(),{
          cache:"no-store",signal:controller.signal,
        });
        const data:unknown=await response.json();
        if(!active)return;
        if(!response.ok||!data||typeof data!=="object"||
            !("network" in data)||data.network!=="amadeus-testnet"||
            !("status" in data)||data.status!=="read_only"||
            !("executionEnabled" in data)||data.executionEnabled!==false||
            !("signingEnabled" in data)||data.signingEnabled!==false||
            !("terminal" in data)||!data.terminal||typeof data.terminal!=="object"||
            !("audit" in data)||!data.audit||typeof data.audit!=="object"){
          throw Error("agent_not_verified");
        }
        const value=data as ReadResponse;
        if(value.terminal.pair!==base+"/AMA"||
            value.terminal.network!=="amadeus-testnet"||
            (value.terminal.wallet?.address??null)!==(account??null)||
            value.terminal.tradingEnabled!==false||
            value.audit.executionEnabled!==false||
            value.audit.record.decision.canSign!==false||
            value.audit.record.decision.canBroadcast!==false||
            value.audit.record.decision.executionApproved!==false||
            value.audit.record.decision.pair!==base+"/AMA"||
            !/^[a-f0-9]{64}$/.test(value.audit.sha256)||
            value.audit.record.controls.killSwitchEngaged!==killSwitchEngaged||
            value.audit.record.controls.operatorPaused!==operatorPaused){
          throw Error("unexpected_agent_execution_or_market");
        }
        setResult(value);setStatus("hold");
      }catch{
        if(active){setResult(null);setStatus("unavailable");}
      }finally{inFlight=false;}
    };
    setStatus("loading");
    void request();
    // Monitoring is read-only; never polls a signing or trading endpoint.
    const timer=setInterval(()=>void request(),60000);
    return ()=>{active=false;controller.abort();clearInterval(timer);};
  },[base,account,rpcHealthy,config,operatorPaused,killSwitchEngaged,refreshKey]);

  const evidence=result?.audit.record.evidence;
  const decision=result?.audit.record.decision;
  const exportAudit=()=>{
    if(!result)return;
    const payload=JSON.stringify(result.audit,null,2);
    void navigator.clipboard?.writeText(payload).then(
      ()=>setCopyStatus("Read-only audit JSON copied. Save it externally for durable retention."),
      ()=>setCopyStatus("Copy failed. View the JSON digest below."),
    );
  };
  return (
    <section id="m10-agent" className="panel agentPanel">
      <div className="agentTitle">
        <div>
          <p className="eyebrow">M10 · AMA NATIVE RISK DESK</p>
          <h3>AI-assisted market-making monitor</h3>
        </div>
        <button type="button" className="walletRefresh" onClick={()=>setRefreshKey(x=>x+1)}>
          Refresh evidence
        </button>
      </div>
      <p className="agentIntro">Deterministic strategy research, not an autonomous execution service. Only {base}/AMA. Live submission is disabled until all M3–M9 on-chain acceptance and independent operator approvals are proven.</p>
      <div className="agentControls">
        <label><input type="checkbox" checked={operatorPaused} onChange={e=>setOperatorPaused(e.target.checked)}/>
          Pause analysis previews</label>
        <label><input type="checkbox" checked={killSwitchEngaged} onChange={e=>setKillSwitchEngaged(e.target.checked)}/>
          Local kill switch engaged</label>
        <p className="muted">Controls change only this session's read-only evaluation. The server's signing and execution locks cannot be overridden here, including when both switches are unchecked.</p>
      </div>
      <div className="agentGrid">
        {numericSettings.map(field=><label key={field.id} title={field.detail}>
          {field.name}
          <input value={String(config[field.id])} inputMode="numeric"
            onChange={e=>{
              const raw=e.target.value;
              setConfig(old=>({
                ...old,
                [field.id]:typeof DEFAULT_AGENT_CONFIG[field.id]==="number"
                  ?(raw===""?NaN:Number(raw)):raw,
              }));
            }}/>
          <small>{field.detail}</small>
        </label>)}
      </div>
      <div className="terminalMeta" role="status" aria-live="polite">
        {status==="loading"?"Reading native testnet pool and wallet evidence…":
         status==="unavailable"?"Data unavailable or policy invalid — all signals held":
         "Read-only audit recorded in this response · execution blocked"}
        {result?.terminal.health&&" · Rooted height "+result.terminal.health.rootedHeight}
      </div>
      <div className="terminalMetrics">
        <div><small>Market</small><strong>{base}/AMA</strong></div>
        <div><small>Pool custody</small><strong>{evidence?.poolCertified?"Verified in this response":"Not certified"}</strong></div>
        <div><small>Independent price oracle</small><strong>{evidence?.referenceVerified?"Verified":"Unavailable"}</strong></div>
        <div><small>Realized daily P&amp;L ledger</small><strong>{evidence?.pnlVerified?"Verified":"Unavailable"}</strong></div>
        <div><small>Strategy decision</small><strong>{decision?.status==="candidate_only"?"Research candidate only":"HOLD — no action"}</strong></div>
        <div><small>Signing and broadcasting</small><strong>Hard-disabled</strong></div>
      </div>
      <div className="agentDecision">
        <h3>Auditable risk decisions</h3>
        {!decision?<p>Nothing to evaluate until validated native testnet evidence is available.</p>:
          <ul>{decision.checks.map((reason,i)=><li key={reason+"-"+i}>{reason.replaceAll("_"," ")}</li>)}</ul>}
        {decision?.signal&&<div className="note">
          <p>Research-only {decision.signal.direction} signal · {decision.signal.amountInAtomic} atomic {decision.signal.inputSymbol}.</p>
          <p>Indicative quote: {decision.signal.indicativeQuote.expectedOut} atomic output. Not an order; no wallet approval obtained.</p>
        </div>}
        <div className="agentAudit">
          <small>Reproducible decision SHA-256 (not a transaction hash)</small>
          <code>{result?.audit.sha256??"—"}</code>
          <button type="button" className="walletRefresh" disabled={!result} onClick={exportAudit}>Copy JSON audit</button>
          {copyStatus&&<p className="muted" role="status">{copyStatus}</p>}
        </div>
        <p className="muted">Audit envelopes are reproducible but not stored by the server. Save the JSON externally if you need durable evidence. No P&amp;L is inferred from unverified transaction history.</p>
      </div>
      <div className="agentActions">
        <button type="button" className="walletConnect" disabled>Approve execution — unavailable</button>
        <button type="button" className="walletConnect" disabled>Start market maker — locked</button>
        <button type="button" className="walletConnect" disabled>Sign / broadcast — locked</button>
      </div>
    </section>
  );
}
