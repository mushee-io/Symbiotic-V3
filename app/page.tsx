"use client";
import {useEffect,useState} from "react";
import {MARKETS,COMING_SOON} from "@/lib/markets";
import { AmadeusWalletPanel } from "@/components/AmadeusWalletPanel";
import { MarketTerminal } from "@/components/MarketTerminal";
import { AgentMonitorPanel } from "@/components/AgentMonitorPanel";

export default function Home(){
  const [pair,setPair]=useState(0);
  const [status,setStatus]=useState("Checking native testnet...");
  const [rpcHealthy,setRpcHealthy]=useState(false);
  const [walletAccount,setWalletAccount]=useState<string|null>(null);

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
        <a href="#m10-agent">AI risk research</a>
        <a href="/demo">Public evidence</a>
        <span className="muted">Perpetuals · Soon</span>
        <span className="muted">RWA · Soon</span>
        <a href="/roadmap">12 Milestones</a>
      </nav>
      <a className="headerWalletLink" href="#wallet-panel">Connect AMA Wallet</a>
    </header>
    <main className="shell">
      <section className="hero">
        <div className="eyebrow">SYMBIOTIC / NATIVE AMADEUS / PUBLIC TESTNET</div>
        <h1>Trading architecture.<br/><span className="demoAccent">Evidence first.</span></h1>
        <p>Only TESTBTC/AMA and TESTUSD/AMA. AMA is the sole quote asset. Live minting, liquidity, swaps and autonomous market-making remain disabled until independently verified acceptance.</p>
        <div className="demoHeroLinks">
          <a className="demoPrimary" href="/demo">View live readiness ↗</a>
          <a className="demoSecondary" href="#m9-terminal">Explore the terminal ↘</a>
        </div>
        <p className="demoHeroDisclaimer">RESEARCH PREVIEW · NO LIVE SWAPS · NO SYNTHETIC ACTIVITY</p>
      </section>
      <div className="status" role="status">{status}. Connectivity is not evidence of deployed pools or live trading.</div>
      <div className="main">
        <div className="terminalColumn">
          <section className="panel terminalMarketSwitch" aria-label="Select AMA spot market">
            <h3>Spot markets · AMA quote only</h3>
            <div className="pairs">{MARKETS.map((item,index)=>
              <button type="button" aria-pressed={index===pair}
                className={index===pair?"selected":""} onClick={()=>setPair(index)} key={item.id}>
                {item.label}
              </button>
            )}</div>
          </section>
          <MarketTerminal base={market.base} account={walletAccount} rpcHealthy={rpcHealthy} />
        </div>
        <div className="walletColumn">
          <AmadeusWalletPanel rpcHealthy={rpcHealthy} onAccountChange={setWalletAccount} />
        </div>
      </div>
      <AgentMonitorPanel base={market.base} account={walletAccount} rpcHealthy={rpcHealthy} />
      <section className="future">
        <article><strong>AI Market Maker</strong><p className="muted">M10 read-only guardrails and audit preview are available above. Live execution is locked.</p><small>RESEARCH ONLY</small></article>
        {COMING_SOON.map(item=><article key={item}><strong>{item}</strong><p className="muted">Future market; not active.</p><small>COMING SOON</small></article>)}
      </section>
      <p className="muted" style={{fontSize:12}}>
        Network status is informational, not proof of exchange readiness.{" "}
        <a href="https://testnet.explorer.ama.one" target="_blank" rel="noopener noreferrer">Amadeus testnet explorer ↗</a>
      </p>
    </main>
  </>;
}
