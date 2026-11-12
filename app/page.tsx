"use client";
import * as React from "react";

import { useEffect, useState } from "react";
import { MARKETS, COMING_SOON } from "@/lib/markets";
import { AmadeusWalletPanel } from "@/components/AmadeusWalletPanel";
import { MarketTerminal } from "@/components/MarketTerminal";
import { AgentMonitorPanel } from "@/components/AgentMonitorPanel";

/**
 * Exchange-first read-only testnet surface. All market statistics come from
 * native verified chain reads inside MarketTerminal; never insert demo prices.
 */
export default function Home() {
  const [pair, setPair] = useState(0);
  const [status, setStatus] = useState("Checking native Amadeus RPC…");
  const [rpcHealthy, setRpcHealthy] = useState(false);
  const [walletAccount, setWalletAccount] = useState<string | null>(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletEverOpened, setWalletEverOpened] = useState(false);
  const openWallet = () => { setWalletEverOpened(true); setWalletOpen(true); };
  const [riskOpen, setRiskOpen] = useState(false);
  const market = MARKETS[pair];

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void fetch("/api/network", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data: unknown = await response.json();
        if (!active) return;
        if (!response.ok || !data || typeof data !== "object" ||
            !("status" in data) || data.status !== "connected" ||
            !("height" in data) || typeof data.height !== "number" ||
            !Number.isSafeInteger(data.height)) {
          throw Error("unverified_rpc");
        }
        setRpcHealthy(true);
        setStatus("RPC connected · block " + data.height.toLocaleString("en-US"));
      })
      .catch(() => {
        if (active) {
          setStatus("Native testnet RPC unavailable");
          setRpcHealthy(false);
        }
      });
    return () => { active = false; controller.abort(); };
  }, []);

  useEffect(() => {
    if (!walletOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setWalletOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [walletOpen]);

  return (
    <div className="exApp">
      <header className="exHeader">
        <div className="exHeaderLeft">
          <a className="exBrand" href="/" aria-label="Symbiotic V3 Spot">
            <span className="exBrandMark" aria-hidden="true">S</span>
            <span>SYMBIOTIC <b>V3</b></span>
          </a>
          <span className="exHeaderDivider" aria-hidden="true"/>
          <nav className="exNav" aria-label="Primary">
            <a className="exNavActive" href="#m9-terminal">Trade</a>
            <a href="#market-watchlist">Markets</a>
            <a href="#exchange-activity">Activity</a>
            <a href="#ai-research">AI Risk</a>
            <a href="/demo">Evidence</a>
            <a href="/roadmap">Roadmap</a>
          </nav>
        </div>
        <div className="exHeaderRight">
          <span className="exChainPill"><span className={rpcHealthy ? "exLed" : "exLed exLedOff"}/>
            AMA Testnet
          </span>
          <button type="button" className="exHeaderWallet" onClick={openWallet}>
            {walletAccount ? walletAccount.slice(0, 7) + "…" + walletAccount.slice(-5) : "Connect Wallet"}
          </button>
        </div>
      </header>

      <div className="exNetworkBar" role="status">
        <span className="exNetworkStatus">
          <span className={rpcHealthy ? "exLed" : "exLed exLedOff"} aria-hidden="true"/>
          {status}
        </span>
        <span>AMA quoted markets only</span>
        <span className="exNetworkWarning">Public testnet · Read-only · No live orders</span>
        <a href="https://testnet.explorer.ama.one" target="_blank" rel="noopener noreferrer">Explorer ↗</a>
      </div>

      <main className="exWorkspace" aria-label="AMA native spot trading terminal">
        <aside className="exWatchlist" id="market-watchlist" aria-label="Spot market list">
          <div className="exWatchHeader">
            <div><span className="exMicroLabel">MARKETS</span><h2>Spot pairs</h2></div>
            <span className="exWatchCount">02</span>
          </div>
          <div className="exWatchFilters"><span className="exSelectedFilter">All markets</span><span>AMA pairs</span></div>
          <div className="exWatchHeadings"><span>Pair</span><span>Last</span></div>
          <div className="exWatchRows">
            {MARKETS.map((item, index) => (
              <button type="button" className={"exWatchRow" + (index === pair ? " exWatchRowSelected" : "")}
                key={item.id} aria-pressed={index === pair} onClick={() => setPair(index)}>
                <span className="exTokenAvatar" aria-hidden="true">{item.base === "TESTBTC" ? "TB" : "TU"}</span>
                <span className="exWatchPair">
                  <strong>{item.base}<small>/AMA</small></strong>
                  <span>Native test asset</span>
                </span>
                <span className="exWatchQuote">—<small>No verified price</small></span>
              </button>
            ))}
          </div>
          <div className="exWatchBottom">
            <span className="exMicroLabel">AMM SPOT</span>
            <p>Pool prices appear only after verified native contracts hold real reserves.</p>
            <a href="/demo">Network readiness ↗</a>
          </div>
        </aside>

        <MarketTerminal base={market.base} account={walletAccount} rpcHealthy={rpcHealthy}/>
      </main>

      <section className="exSubfooter" id="ai-research">
        <button type="button" className="exResearchToggle" aria-expanded={riskOpen}
          onClick={() => setRiskOpen(current => !current)}>
          <span><strong>AI Risk Research</strong><small>Deterministic, read-only operator limits and decision audits</small></span>
          <span>{riskOpen ? "Hide research −" : "Open research +"}</span>
        </button>
        {riskOpen && <AgentMonitorPanel base={market.base} account={walletAccount} rpcHealthy={rpcHealthy}/>}
      </section>
      <footer className="exFooter">
        <span>SYMBIOTIC V3 · AMADEUS TESTNET</span>
        <span>{COMING_SOON.join("  ·  ")} · Coming soon</span>
        <a href="/demo">Verification &amp; evidence ↗</a>
      </footer>

      {walletEverOpened && <div className={"exWalletOverlay" + (walletOpen ? " exWalletOverlayOpen" : "")} aria-hidden={!walletOpen}>
        <button className="exWalletScrim" type="button" onClick={() => setWalletOpen(false)}
          aria-label="Close wallet drawer"/>
        <aside className="exWalletDrawer" aria-label="Amadeus wallet and native testnet operations">
          <div className="exDrawerHeading">
            <div><span className="exMicroLabel">NATIVE TESTNET</span><h2>Wallet &amp; assets</h2></div>
            <button type="button" onClick={() => setWalletOpen(false)} aria-label="Close wallet drawer">✕</button>
          </div>
          <AmadeusWalletPanel rpcHealthy={rpcHealthy} onAccountChange={setWalletAccount}/>
        </aside>
      </div>}
    </div>
  );
}
