import * as React from "react";
import type { Metadata } from "next";

export const metadata:Metadata={
  title:"Symbiotic V3 | AMA-Native Spot Markets",
  description:"Explore Symbiotic V3: two AMA-quoted spot market designs, native Amadeus RISC-V AMM architecture, honest public-testnet evidence, and a read-only trading terminal.",
};

const markets=[
  {base:"TESTBTC",avatar:"B",kind:"Experimental base asset",index:"01"},
  {base:"TESTUSD",avatar:"U",kind:"Experimental base asset",index:"02"},
] as const;

const capabilities=[
  {number:"01",name:"Spot trading",tag:"READ-ONLY DEMO",summary:"An AMA-native terminal with exact-input AMM quotes, pool accounting, and finalized transaction views only where verifiable chain data exists.",href:"/trade",link:"Explore terminal"},
  {number:"02",name:"Liquidity architecture",tag:"LIVE ACCEPTANCE PENDING",summary:"Native RISC-V pool contracts, reserve conservation and LP share accounting. Production-like interaction waits for deployed contracts and funded pools.",href:"/demo",link:"View pool readiness"},
  {number:"03",name:"AI risk research",tag:"NON-EXECUTING",summary:"Deterministic inventory, spread and loss-limit analysis with readable decisions. No autonomous trading, fabricated market making or signing.",href:"/trade#ai-research",link:"Explore risk controls"},
] as const;

export default function HomePage(){
  return <div className="hmSite">
    <header className="hmHeader">
      <a href="/" className="hmBrand" aria-label="Symbiotic V3 homepage">
        <span className="hmBrandIcon" aria-hidden="true">S</span>
        <span>SYMBIOTIC <b>V3</b></span>
      </a>
      <nav className="hmNav" aria-label="Main navigation">
        <a className="hmNavCurrent" href="/" aria-current="page">Home</a>
        <a href="/trade">Trade</a>
        <a href="#markets">Markets</a>
        <a href="#liquidity">Liquidity</a>
        <a href="#ai-risk">AI Risk</a>
        <a href="/demo">Evidence</a>
      </nav>
      <a href="/trade" className="hmNavAction">Launch App <span aria-hidden="true">↗</span></a>
    </header>

    <main>
      <section className="hmHero" aria-label="Symbiotic V3 overview">
        <div className="hmHeroInner">
          <div className="hmHeroCopy">
            <div className="hmKicker"><span className="hmBeacon" aria-hidden="true"/> AMADEUS NATIVE / PUBLIC TESTNET</div>
            <h1>SPOT.<br/><span>WITHOUT</span><br/>COMPROMISE.</h1>
            <p>A purpose-built spot exchange architecture on Amadeus. Two test markets. One native quote asset: AMA. Open engineering, verifiable data, and a terminal designed for trading.</p>
            <div className="hmHeroActions">
              <a href="/trade" className="hmButtonPrimary">Explore Trading Terminal <span aria-hidden="true">↗</span></a>
              <a href="/demo" className="hmButtonSecondary">View Testnet Evidence <span aria-hidden="true">↗</span></a>
            </div>
            <div className="hmHeroCaveat"><span className="hmCaveatDot" aria-hidden="true"/> Research preview · Live mints, funded pools and swaps not yet verified</div>
          </div>
          <div className="hmPreview" aria-label="Two AMA market overview without simulated prices or activity">
            <div className="hmPreviewTop"><span>SYMBIOTIC / MARKET OVERVIEW</span><span className="hmPreviewTag">TESTNET ONLY</span></div>
            <div className="hmPreviewHero">
              <span className="hmMicroLabel">THE NATIVE SPOT EXPERIENCE</span>
              <strong>Two markets.<br/><span>One settlement asset.</span></strong>
              <div className="hmPreviewQuote">AMA <span>ONLY</span></div>
            </div>
            <div className="hmPreviewHead"><span>MARKET</span><span>LAST PRICE</span><span>STATUS</span></div>
            {markets.map(m=><div className="hmPreviewRow" key={m.base}>
              <span className="hmPreviewMarket"><span className="hmAvatar">{m.avatar}</span><span><b>{m.base}<i>/AMA</i></b><small>{m.kind}</small></span></span>
              <span className="hmPreviewPrice">— <small>Unavailable</small></span>
              <span className="hmPreviewPending">Not live</span>
            </div>)}
            <div className="hmPreviewBottom">
              <span>AMM · NATIVE RISC-V</span>
              <a href="/trade">OPEN TERMINAL <span aria-hidden="true">↗</span></a>
            </div>
          </div>
        </div>
        <div className="hmHeroIndex" aria-hidden="true">
          <span>01 / NATIVE SPOT</span><span>02 / AMA LIQUIDITY</span><span>03 / RISK RESEARCH</span>
        </div>
      </section>

      <section className="hmSection hmMarkets" id="markets">
        <div className="hmSectionTop"><div><span className="hmMicroLabel">01 — MARKET UNIVERSE</span><h2>Only the markets<br/><span>we can verify.</span></h2></div>
          <p>No imaginary order books or manufactured trading volume. Market prices and charts will be shown only after real AMM deployments, reserves and finalized history are independently verified.</p></div>
        <div className="hmMarketCards">
          {markets.map(m=><a className="hmMarketCard" href="/trade" key={m.base} aria-label={"Explore "+m.base+"/AMA terminal"}>
            <div className="hmMarketCardHead"><span>MARKET {m.index}</span><span>AMA QUOTE ONLY</span></div>
            <div className="hmMarketCardPair"><span className="hmLargeAvatar">{m.avatar}</span><strong>{m.base}<i>/AMA</i></strong></div>
            <div className="hmMarketCardMeta"><span>Verified market price</span><strong>—</strong></div>
            <div className="hmMarketCardFoot"><span>Trading awaits finalized native testnet acceptance</span><span aria-hidden="true">↗</span></div>
          </a>)}
        </div>
      </section>

      <section className="hmSection hmCapabilities" id="liquidity">
        <div className="hmSectionTop"><div><span className="hmMicroLabel">02 — BUILDING BLOCKS</span><h2>Built for an<br/><span>on-chain market.</span></h2></div>
          <p>Spot execution, liquidity and automated risk analysis have distinct safety and verification boundaries. Source completion is not the same as financial readiness.</p></div>
        <div className="hmCapabilityGrid">
          {capabilities.map(c=><article key={c.number} className="hmCapabilityCard" id={c.number==="03"?"ai-risk":undefined}>
            <div className="hmCapabilityHeader"><span>{c.number} / PROTOCOL</span><span className="hmCapabilityTag">{c.tag}</span></div>
            <h3>{c.name}</h3><p>{c.summary}</p>
            <a href={c.href}>{c.link} <span aria-hidden="true">↗</span></a>
          </article>)}
        </div>
      </section>

      <section className="hmEvidence" id="resources">
        <div><span className="hmMicroLabel">03 — TRUST THROUGH EVIDENCE</span><h2>Don't take the interface's<br/>word for it.</h2><p>Inspect independent native-chain observations, the open issues and the security evidence. Missing receipts are disclosed, not invented.</p></div>
        <div className="hmEvidenceActions">
          <a href="/demo">Read public testnet evidence <span aria-hidden="true">↗</span></a>
          <a href="/roadmap">Explore 12 milestones <span aria-hidden="true">↗</span></a>
          <a href="https://github.com/mushee-io/Symbiotic-V3" target="_blank" rel="noopener noreferrer">View GitHub repository <span aria-hidden="true">↗</span></a>
        </div>
      </section>
    </main>
    <footer className="hmFooter">
      <div className="hmFooterBrand"><span className="hmBrandIcon" aria-hidden="true">S</span><strong>SYMBIOTIC V3</strong></div>
      <span>Native Amadeus testnet · AMA-quoted research · No live trades</span>
      <div><a href="/trade">Trade</a><a href="/demo">Evidence</a><a href="/roadmap">Roadmap</a></div>
    </footer>
  </div>;
}
