"use client";
import {useEffect,useState} from "react";
import {MARKETS,COMING_SOON} from "@/lib/markets";
import { AmadeusWalletPanel } from "@/components/AmadeusWalletPanel";

export default function Home(){
  const [pair,setPair]=useState(0);
  const [status,setStatus]=useState("Checking native testnet...");
  const [rpcHealthy,setRpcHealthy]=useState(false);

  useEffect(()=>{
    let active=true;
    fetch("/api/network",{cache:"no-store"})
      .then(async response=>{
        const data=await response.json();
        if(active) {
          const healthy = response.ok && data.status === "connected";
          setRpcHealthy(healthy);
          setStatus(healthy ? "Amadeus testnet connected · height "+data.height : "Testnet RPC unavailable");
        }
      })
      .catch(()=>{if(active){setStatus("Testnet RPC unavailable");setRpcHealthy(false);}});
    return ()=>{active=false;};
  },[]);

  const market=MARKETS[pair];
  return <>
    <header className="header">
      <a className="logo" href="/">SYMBIOTIC <b>V3</b></a>
      <nav className="links">
        <a className="accent" href="/">Spot</a>
        <span className="muted">AI Agents · Soon</span>
        <span className="muted">Perpetuals · Soon</span>
        <span className="muted">RWA · Soon</span>
        <a href="/roadmap">12 Milestones</a>
      </nav>
      <a className="headerWalletLink" href="#wallet-panel">Connect AMA Wallet</a>
    </header>
    <main className="shell">
      <section className="hero">
        <div className="eyebrow">AMA NATIVE · TESTNET · AI SPOT TRADING</div>
        <h1>AI trading on Amadeus.</h1>
        <p>Every listed token pairs with AMA. Spot first; autonomous liquidity management and advanced markets are coming soon.</p>
      </section>
      <div className="status" role="status">{status}</div>
      <div className="main">
        <section className="panel">
          <h3>Spot markets · AMA pairs only</h3>
          <div className="pairs">{MARKETS.map((item,index)=>
            <button className={index===pair?"selected":""} onClick={()=>setPair(index)} key={item.id}>{item.label}</button>
          )}</div>
          <div className="empty">
            <div className="eyebrow">{market.label}</div>
            <h2>Awaiting native liquidity pools</h2>
            <p>Only independently verified reserves and confirmed swaps will generate displayed prices and trading activity. No simulated market data.</p>
          </div>
        </section>
        <div className="walletColumn"><aside className="panel">
          <h3>Spot swap · AMA quote</h3>
          <div className="swap">
            <p className="muted">Wallet signing and spot execution will be enabled only after verified Amadeus testnet pool deployment.</p>
            <label>Pay</label>
            <div className="field">0.00 <strong>AMA</strong></div>
            <label>Receive</label>
            <div className="field">0.00 <strong>{market.base}</strong></div>
            <button className="full" disabled>Spot trading coming after M8</button>
            <p className="note">Testnet build in progress. No token issuance, native pools, real swaps or AI orders have been verified yet.</p>
          </div>
        </aside>
        <AmadeusWalletPanel rpcHealthy={rpcHealthy} />
        </div>
      </div>
      <section className="future">
        <article><strong>AI Trading Agent</strong><p className="muted">Automated liquidity and risk controls (M10).</p><small>COMING SOON</small></article>
        {COMING_SOON.map(item=><article key={item}><strong>{item}</strong><p className="muted">Future market; not active.</p><small>COMING SOON</small></article>)}
      </section>
      <p className="muted" style={{fontSize:12}}>
        Network status is informational, not proof of exchange readiness.{" "}
        <a href="https://testnet-ama.ddns.net" target="_blank" rel="noopener noreferrer">Amadeus testnet explorer ↗</a>
      </p>
    </main>
  </>;
}
