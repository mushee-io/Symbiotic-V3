"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./spot.module.css";

const markets = [
  { id: "TESTBTC", title: "Test Bitcoin", pair: "TESTBTC / AMA" },
  { id: "TESTUSD", title: "Test Dollar", pair: "TESTUSD / AMA" },
] as const;
type MarketId = typeof markets[number]["id"];
type WalletProvider = { requestAccounts: () => Promise<string[]> };
type Status = { network: string; reachable: boolean; height: number | null; tradingEnabled: false; contractsDeployed: false };
function walletProvider(): WalletProvider | null {
  if (typeof window === "undefined") return null;
  const provider = (window as Window & { amadeus?: unknown }).amadeus;
  if (provider && typeof provider === "object" && "requestAccounts" in provider &&
      typeof (provider as WalletProvider).requestAccounts === "function") return provider as WalletProvider;
  return null;
}

export default function AmadeusSpotPage() {
  const [market, setMarket] = useState<MarketId>("TESTBTC");
  const [side, setSide] = useState<"Buy" | "Sell">("Buy");
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [network, setNetwork] = useState<Status | null>(null);
  const [statusError, setStatusError] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/amadeus/status", { cache: "no-store" });
      const status = await response.json() as Status;
      setNetwork(status);
      setStatusError(!response.ok || !status.reachable);
    } catch { setNetwork(null); setStatusError(true); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  async function connect() {
    setWalletError("");
    const provider = walletProvider();
    if (!provider) {
      setWalletError("Amadeus Wallet extension not detected. Install the official extension to connect.");
      return;
    }
    setConnecting(true);
    try {
      const accounts = await provider.requestAccounts();
      if (!accounts.length || typeof accounts[0] !== "string") throw new Error("No wallet account returned");
      setAddress(accounts[0]);
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : "Wallet connection declined");
    } finally { setConnecting(false); }
  }
  const selected = markets.find((m) => m.id === market)!;
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}><span className={styles.brandIcon}>A</span><div><strong>AMA SPOT</strong><small>AI trading on Amadeus</small></div></div>
        <div className={styles.headerRight}><span className={styles.testnet}>AMA TESTNET</span>
          <button className={styles.wallet} onClick={() => void connect()} disabled={connecting} type="button">
            {connecting ? "Connecting…" : address ? `${address.slice(0, 6)}…${address.slice(-5)}` : "Connect AMA Wallet"}
          </button>
        </div>
      </header>

      <div className={styles.topNav} role="navigation" aria-label="Products">
        <span className={styles.active}>Spot <small>Testnet build</small></span>
        <span>Perpetuals <small>Coming soon</small></span>
        <span>RWA <small>Coming soon</small></span>
        <span>Notional <small>Coming soon</small></span>
      </div>

      <section className={styles.notice}>
        <div><strong>Amadeus testnet integration</strong><p>The live network health check below reads Amadeus testnet. Test asset minting, AMM deployment, swaps, and AI market-maker execution are not deployed yet. No demonstration trades or fake liquidity are shown.</p></div>
        <a href="https://testnet.explorer.ama.one" target="_blank" rel="noreferrer">Testnet explorer ↗</a>
      </section>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.sectionTop}><h2>Markets</h2><span>2 planned</span></div>
          <p className={styles.helper}>Every initial spot pair is quoted in native AMA.</p>
          {markets.map((m) =>
            <button key={m.id} type="button" className={market === m.id ? styles.pairActive : styles.pair}
              onClick={() => { setMarket(m.id); setAmount(""); }}>
              <span className={styles.coinIcon}>{m.id === "TESTBTC" ? "₿" : "$"}</span>
              <span><strong>{m.pair}</strong><small>{m.title} · pending mint</small></span>
              <span className={styles.noPrice}>—</span>
            </button>
          )}
          <div className={styles.sidebarFooter}>No live pair reserves or on-chain trades yet.</div>
        </aside>

        <section className={styles.center}>
          <div className={styles.ticker}><div><small>Spot market</small><h1>{selected.pair}</h1></div><span className={styles.pending}>POOL NOT DEPLOYED</span></div>
          <div className={styles.metrics}>
            <div><small>Last traded price</small><strong>— AMA</strong></div>
            <div><small>24h volume</small><strong>—</strong></div>
            <div><small>Pool reserves</small><strong>—</strong></div>
            <div><small>AI market maker</small><strong>Not active</strong></div>
          </div>
          <div className={styles.chart}>
            <div className={styles.sectionTop}><h2>Market chart</h2><span>On-chain data only</span></div>
            <div className={styles.chartEmpty}>
              <div className={styles.chartGraphic} aria-hidden="true">⌁</div>
              <strong>Awaiting first confirmed trade</strong>
              <p>Candles and order history will appear after the AMM pool and indexer are verified on Amadeus testnet.</p>
            </div>
          </div>
          <div className={styles.activity}><div className={styles.sectionTop}><h2>Recent transactions</h2><span>Testnet</span></div><p>No verified market transactions yet.</p></div>
        </section>

        <aside className={styles.trade}>
          <div className={styles.sectionTop}><h2>Spot trade</h2><span>AMA quote</span></div>
          <div className={styles.switch}>
            <button type="button" className={side === "Buy" ? styles.buyActive : ""} onClick={() => setSide("Buy")}>Buy</button>
            <button type="button" className={side === "Sell" ? styles.sellActive : ""} onClick={() => setSide("Sell")}>Sell</button>
          </div>
          <label htmlFor="quantity">Amount ({side === "Buy" ? "AMA" : market})</label>
          <div className={styles.amountField}><input id="quantity" inputMode="decimal" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} /><b>{side === "Buy" ? "AMA" : market}</b></div>
          <div className={styles.orderLine}><span>Expected output</span><strong>Unavailable</strong></div>
          <div className={styles.orderLine}><span>Network fees</span><strong>Unavailable</strong></div>
          <button type="button" className={styles.blocked} disabled>Trading unavailable — awaiting pool deployment</button>
          <p className={styles.tradeHelp}>Trades will require wallet approval and verified Amadeus testnet receipts. No orders are recorded locally as fills.</p>
          <div className={styles.networkPanel}>
            <strong>Network status</strong>
            <p>{statusError ? "Unable to verify RPC" : network?.reachable ? "Amadeus testnet RPC reachable" : "Checking network…"}</p>
            <span>Observed height: {network?.height ?? "—"}</span>
            <button type="button" onClick={() => void refresh()}>Refresh status</button>
          </div>
          {walletError && <p role="alert" className={styles.error}>{walletError}</p>}
          <a className={styles.faucet} href="https://mcp.ama.one/testnet-faucet" target="_blank" rel="noreferrer">Get testnet AMA ↗</a>
        </aside>
      </div>
      <footer className={styles.footer}>An isolated prototype derived from Symbiotic V2. Original Cardano contracts and markets remain unchanged.</footer>
    </main>
  );
}
