"use client";
import * as React from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { AmadeusWalletPanel } from "./AmadeusWalletPanel";
import type { NativeTerminalData } from "@/lib/terminal/read";

export type TerminalView = "trade" | "markets" | "portfolio" | "liquidity" | "mm" | "rewards" | "more" | "private" | "risk";
type TerminalContextValue = { base: "TESTBTC" | "TESTUSD"; setBase: (base: "TESTBTC" | "TESTUSD") => void; account: string | null; rpcHealthy: boolean; status: string; openWallet: () => void; balance: string | null };
const TerminalContext = createContext<TerminalContextValue | null>(null);
export function useTerminal() { const value = useContext(TerminalContext); if (!value) throw Error("Terminal shell required"); return value; }
export function useTerminalMarket() {
  const { base, account, rpcHealthy } = useTerminal();
  const [data, setData] = useState<NativeTerminalData | null>(null);
  useEffect(() => {
    setData(null);
    if (!rpcHealthy) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ base });
    if (account) query.set("owner", account);
    void fetch("/api/terminal/status?" + query, { cache: "no-store", signal: controller.signal }).then(async response => {
      const value = await response.json();
      if (!controller.signal.aborted && response.ok && value.network === "amadeus-testnet" && value.tradingEnabled === false && value.market?.symbol === base && (value.market.wallet?.address ?? null) === account) setData(value.market);
    }).catch(() => {});
    return () => controller.abort();
  }, [base, account, rpcHealthy]);
  return data;
}
const navigation = ["trade", "markets", "portfolio", "liquidity", "mm", "rewards", "more"] as const;
export function TerminalShell({ active, children }: { active: TerminalView; children: React.ReactNode }) {
  const [base, setBase] = useState<"TESTBTC" | "TESTUSD">("TESTBTC");
  const [account, setAccount] = useState<string | null>(null);
  const [rpcHealthy, setHealthy] = useState(false);
  const [status, setStatus] = useState("Checking native Amadeus RPC…");
  const [balance, setBalance] = useState<string | null>(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletMounted, setWalletMounted] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const walletButton = useRef<HTMLButtonElement>(null);
  const openWallet = () => { setWalletMounted(true); setWalletOpen(true); };
  useEffect(() => {
    const selected = new URLSearchParams(location.search).get("market");
    if (selected === "TESTBTC" || selected === "TESTUSD") setBase(selected);
    const controller = new AbortController();
    void fetch("/api/network", { cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok || data.network !== "amadeus-testnet" || data.status !== "connected" || !Number.isSafeInteger(data.height)) throw Error("unverified_rpc");
      if (!controller.signal.aborted) { setHealthy(true); setStatus("RPC connected · block " + data.height.toLocaleString("en-US")); }
    }).catch(() => { if (!controller.signal.aborted) { setHealthy(false); setStatus("Native testnet RPC unavailable"); } });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    setBalance(null);
    if (!account || !rpcHealthy) return;
    const controller = new AbortController();
    void fetch("/api/wallet/balance?address=" + encodeURIComponent(account), { cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!controller.signal.aborted && response.ok && data.network === "amadeus-testnet" && data.address === account && typeof data.amount === "string") setBalance(data.amount);
    }).catch(() => {});
    return () => controller.abort();
  }, [account, rpcHealthy]);
  useEffect(() => {
    if (walletOpen) dialogRef.current?.showModal();
    else if (dialogRef.current?.open) { dialogRef.current.close(); walletButton.current?.focus(); }
  }, [walletOpen]);
  useEffect(() => {
    const openHash = () => { if (["#wallet-panel", "#m7-liquidity", "#m4-tokens"].includes(location.hash)) openWallet(); };
    openHash(); window.addEventListener("hashchange", openHash);
    return () => window.removeEventListener("hashchange", openHash);
  }, []);
  return <TerminalContext.Provider value={{ base, setBase, account, rpcHealthy, status, openWallet, balance }}>
    <div className="exApp terminalDesign">
      <header className="tdHeader">
        <a href="/" className="tdBrand" aria-label="Symbasis homepage"><span className="tdDome" aria-hidden="true" />SYMBASIS</a>
        <nav className="tdNav" aria-label="Primary">{navigation.map(item => <a key={item} href={"/" + item} aria-current={active === item ? "page" : undefined}>{item === "mm" ? "MM" : item}</a>)}</nav>
        <div className="tdHeaderMeta"><span><i className={rpcHealthy ? "tdLed" : "tdLed tdLedPending"} />Amadeus Protocol testnet</span><a href="/private" aria-current={active === "private" ? "page" : undefined}>Private</a><a href="/risk" aria-current={active === "risk" ? "page" : undefined}>Risk</a></div>
      </header>
      <div className="tdUtility"><span role="status"><i className={rpcHealthy ? "tdLed" : "tdLed tdLedPending"} />{status}</span><span className="tdReadOnly">Public testnet · AMA quote only · Read-only</span><a href="/setup">Testnet Setup ↗</a><button ref={walletButton} type="button" onClick={openWallet}>{account ? account.slice(0, 7) + "…" + account.slice(-5) : "Connect Wallet"}</button></div>
      {children}
      <footer className="tdFooter"><span>SYMBASIS / AMADEUS PROTOCOL TESTNET</span><div><a href="/demo">Evidence ↗</a><a href="/roadmap">Roadmap ↗</a><a href="/">Home</a></div><span>TESTNET ONLY · NOT FOR REAL FUNDS</span></footer>
      <dialog ref={dialogRef} className="tdWalletDialog" aria-label="Amadeus wallet and native testnet operations" onCancel={() => setWalletOpen(false)} onClick={event => { if (event.target === event.currentTarget) setWalletOpen(false); }}>
        <div className="tdWalletInner"><div className="tdPanelHeading"><div><small>NATIVE AMADEUS TESTNET</small><h2>Wallet &amp; assets</h2></div><button type="button" onClick={() => setWalletOpen(false)} aria-label="Close wallet drawer">✕</button></div>
          {walletMounted && <AmadeusWalletPanel rpcHealthy={rpcHealthy} onAccountChange={setAccount} />}
        </div>
      </dialog>
    </div>
  </TerminalContext.Provider>;
}
export function MarketSelector() { const { base, setBase } = useTerminal(); return <div className="tdMarketSelector" role="group" aria-label="Spot pairs">{(["TESTBTC", "TESTUSD"] as const).map(symbol => <button type="button" key={symbol} aria-pressed={base === symbol} onClick={() => setBase(symbol)}>{symbol}<span>/AMA</span></button>)}</div>; }
