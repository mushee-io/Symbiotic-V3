import type { AmadeusSDK } from "@amadeus-protocol/sdk";
import { readNativeTerminal, type NativeTerminalData } from "../terminal/read";
import type { AgentConfig, AgentControls, AgentMarket, AgentObservations } from "./policy";
import { evaluateAgent } from "./policy";
import { createAgentAudit, type AuditedAgentDecision } from "./audit";

/** Public native testnet reads only: NO oracle or PnL witness is available. */
export async function monitorAgent(
  sdk:Pick<AmadeusSDK,"chain"|"transaction"|"contract"|"wallet">,
  symbol:AgentMarket, owner:string|undefined,
  config:AgentConfig, controls:AgentControls,
):Promise<{ terminal:NativeTerminalData; audit:AuditedAgentDecision }> {
  const terminal=await readNativeTerminal(sdk,symbol,owner);
  const observations:AgentObservations={
    symbol,
    rootedHeight:terminal.health.rootedHeight,
    latestHeight:terminal.health.height,
    pool:terminal.pool,
    wallet:terminal.wallet,
    // No independent oracle integration or finalized daily PnL ledger exists.
    // NEVER accept values for these fields from public HTTP parameters.
    reference:null,
    pnl:null,
  };
  const evaluation=evaluateAgent(config,controls,observations);
  const audit=createAgentAudit(terminal,config,controls,evaluation,observations);
  return {terminal,audit};
}
