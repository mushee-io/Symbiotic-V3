import { createHash } from "node:crypto";
import type { AgentConfig, AgentControls, AgentEvaluation, AgentObservations } from "./policy";
import type { NativeTerminalData } from "../terminal/read";

/** Transparent canonical JSON. No mutable global logs or fabricated tx IDs. */
export function canonicalJson(value: unknown): string {
  if (value===null||typeof value==="string"||typeof value==="boolean")return JSON.stringify(value);
  if(typeof value==="number"){
    if(!Number.isFinite(value)||!Number.isSafeInteger(value))throw Error("invalid_audit_number");
    return JSON.stringify(value);
  }
  if(Array.isArray(value))return "["+value.map(canonicalJson).join(",")+"]";
  if(value&&typeof value==="object"){
    const obj=value as Record<string,unknown>;
    const keys=Object.keys(obj).sort();
    for(const key of keys)if(obj[key]===undefined)throw Error("invalid_audit_field");
    return "{"+keys.map(k=>JSON.stringify(k)+":"+canonicalJson(obj[k])).join(",")+"}";
  }
  throw Error("invalid_audit_value");
}

export type AgentAuditRecord=Readonly<{
  schema:"symbiotic.m10.decision.v1";
  network:"amadeus-testnet";
  policy:AgentConfig;
  controls:AgentControls;
  decision:AgentEvaluation;
  evidence:Readonly<{
    pair:"TESTBTC/AMA"|"TESTUSD/AMA";
    tipHeight:number;
    rootedHeight:number;
    poolCertified:boolean;
    tokenRegistered:boolean;
    walletReadVerified:boolean;
    referenceVerified:false;
    pnlVerified:false;
    source:"pinned_amadeus_testnet_read_only";
  }>;
}>;
export type AuditedAgentDecision=Readonly<{
  record:AgentAuditRecord;
  sha256:string;
  durableStorage:false;
  executionEnabled:false;
}>;

export function createAgentAudit(
  terminal:NativeTerminalData, config:AgentConfig,
  controls:AgentControls, decision:AgentEvaluation,
  data:AgentObservations,
):AuditedAgentDecision {
  if(data.reference!==null||data.pnl!==null||
      decision.canBroadcast!==false||decision.canSign!==false||
      decision.executionApproved!==false){
    throw Error("unauthorized_audit_evidence_or_execution");
  }
  const record:AgentAuditRecord={
    schema:"symbiotic.m10.decision.v1",network:"amadeus-testnet",
    policy:config,controls,decision,
    evidence:{
      pair:terminal.pair,tipHeight:terminal.health.height,rootedHeight:terminal.health.rootedHeight,
      poolCertified:terminal.pool!==null,
      tokenRegistered:terminal.token.status==="registered",
      walletReadVerified:terminal.wallet!==null,
      referenceVerified:false,pnlVerified:false,
      source:"pinned_amadeus_testnet_read_only",
    },
  };
  const sha256=createHash("sha256").update(canonicalJson(record),"utf8").digest("hex");
  return {record,sha256,durableStorage:false,executionEnabled:false};
}
