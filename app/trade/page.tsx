"use client";
import * as React from "react";
import { useState } from "react";
import { TerminalShell, useTerminal, MarketSelector } from "@/components/TerminalShell";
import { MarketTerminal } from "@/components/MarketTerminal";
import { AgentMonitorPanel } from "@/components/AgentMonitorPanel";

function TradeWorkspace() {
  const { base, account, balance, rpcHealthy, openWallet } = useTerminal();
  const [riskOpen, setRiskOpen] = useState(false);
  return <>
    <section className="tdTicker" aria-label="Account and market summary">
      <div><small>TESTBTC / AMA</small><strong>—</strong></div><div><small>TESTUSD / AMA</small><strong>—</strong></div><div><small>Wallet balance</small><strong>{balance === null ? "—" : balance} <span>AMA</span></strong></div><div><small>Execution</small><strong>Read-only</strong></div><div><small>Network</small><strong>Amadeus <span>testnet</span></strong></div>
    </section>
    <main className="exWorkspace" aria-label="AMA native spot trading terminal">
      <MarketTerminal base={base} account={account} rpcHealthy={rpcHealthy} marketSelector={<div className="tdTradeMarketBar" id="market-watchlist"><small>Spot pairs / native market</small><MarketSelector /></div>} />
    </main>
    <section className="tdTradeLower">
      <div className="tdSession"><div className="tdPanelHeading"><div><small>ACTIVITY</small><h2>Session trade history</h2></div><a href="#exchange-activity">View on-chain activity ↑</a></div><p>Confirmed wallet calls appear in on-chain activity after independently verified native settlement. No simulated trade is added to your account.</p><div className="tdEmptyGrid">{account ? "Awaiting verified settlement history" : "Connect your wallet to view account activity"}</div></div>
      <aside className="tdOperations"><div className="tdPanelHeading"><div><small>TESTNET ASSETS</small><h2>AMA wallet &amp; liquidity</h2></div></div><div className="tdOperationsBody"><div className="tdCompactMetrics"><div><small>WALLET</small><strong>{balance === null ? "—" : balance}</strong></div><div><small>POOL</small><strong>Unverified</strong></div><div><small>QUOTE</small><strong>AMA</strong></div></div><button type="button" className="tdWideButton" onClick={openWallet}>Open wallet &amp; native operations</button><a href="/setup">Get Amadeus testnet AMA ↗</a></div><div className="tdPanelHeading"><div><small>CONFIDENTIAL INTENT / RESEARCH</small><h2>Private agent mandate</h2></div></div><div className="tdOperationsBody"><p>Explore local strategy commitments and deterministic risk controls. Autonomous execution remains unavailable.</p><a className="tdWideButton" href="/private">Configure private mandate →</a></div></aside>
    </section>
    <section className="exSubfooter" id="ai-research"><button type="button" className="exResearchToggle" aria-expanded={riskOpen} onClick={() => setRiskOpen(value => !value)}><span><strong>AI Risk Research</strong><small>Read-only operator limits and decision audits</small></span><span>{riskOpen ? "Hide research −" : "Open research +"}</span></button>{riskOpen && <AgentMonitorPanel base={base} account={account} rpcHealthy={rpcHealthy} />}</section>
  </>;
}
export default function TradePage() { return <TerminalShell active="trade"><TradeWorkspace /></TerminalShell>; }
