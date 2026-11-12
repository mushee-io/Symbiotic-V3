import * as React from "react";
import type { Metadata } from "next";
import styles from "./home.module.css";

export const metadata: Metadata = {
  title: "Symbasis | Amadeus Protocol",
  description: "Private AI perpetual market infrastructure for global markets. Explore Symbasis on Amadeus Protocol testnet.",
};

const terminal = "/trade";
const docs = "https://github.com/mushee-io/Symbiotic-V3#readme";
const groups = [
  { title: "Product", links: [["Trade", terminal], ["Markets", "/trade#market-watchlist"], ["Portfolio", "/trade#wallet-panel"], ["Liquidity", "/trade#m7-liquidity"]] },
  { title: "Systems", links: [["MM Interactive Demo", "/sandbox"], ["Risk", "/trade#ai-research"], ["Private markets", "/roadmap"], ["Testnet rewards", "/demo"]] },
  { title: "Network", links: [["Explorer ↗", "https://testnet.explorer.ama.one"], ["Faucet ↗", "/setup"], ["Protocol information", "/demo"]] },
  { title: "Resources", links: [["Documentation ↗", docs], ["GitHub ↗", "https://github.com/mushee-io/Symbiotic-V3"], ["Status", "/demo"]] },
];

function Dome({ small = false }: { small?: boolean }) {
  return <span aria-hidden="true" className={small ? styles.mark : styles.dome} />;
}

export default function HomePage() {
  return <div className={styles.site}>
    <header className={styles.header}>
      <a href="/" className={styles.brand} aria-label="Symbasis homepage"><Dome small /><span>SYMBASIS</span></a>
      <nav className={styles.nav} aria-label="Main navigation">
        <a href={terminal}>Trade</a><a href="/trade#market-watchlist">Markets</a><a href="/trade#wallet-panel">Portfolio</a><a href="/trade#m7-liquidity">Liquidity</a><a href="/trade#ai-research">MM</a><a href="/sandbox">MM Demo</a><a href="/demo">Evidence</a>
        <details className={styles.more}><summary>More</summary><div><a href={docs}>Documentation ↗</a><a href="/roadmap">Roadmap</a><a href="/demo">Testnet evidence</a><a href="/setup">Testnet setup</a></div></details>
      </nav>
      <a href="/demo" className={styles.network}><i /> <span>Amadeus Protocol testnet</span></a>
      <a href={terminal} className={styles.headerLaunch}>Launch terminal →</a>
    </header>
    <main>
      <section className={styles.hero} aria-label="Symbasis overview">
        <div className={styles.copy}>
          <div className={styles.eyebrow}><span>▪ &nbsp;01 / Autonomous perpetual infrastructure</span><span>Amadeus Protocol &nbsp;▪</span></div>
          <h1>Private AI<br />perpetual infrastructure<br />for global markets.</h1>
          <p>Symbasis builds autonomous, on-chain market infrastructure powered by AI. Trade perpetuals with institutional-grade execution, private strategy commitments and verifiable testnet settlement.</p>
          <div className={styles.actions}><a className={styles.launch} href={terminal}>Launch terminal →</a><a className={styles.documentation} href={docs}>Read the documentation ↗</a></div>
        </div>
        <aside className={styles.aside} aria-label="Network overview">
          <div className={styles.metrics}>
            <div><span>Engine</span><strong>Research preview</strong><small><i /> Testnet</small></div>
            <div><span>Network</span><strong>Amadeus Protocol</strong><small>Testnet</small></div>
            <div><span>Settlement</span><strong>AMA</strong><small>Native asset</small></div>
            <div><span>Markets</span><strong>TESTBTC / TESTUSD</strong><small>AMA quoted</small></div>
            <div><span>Oracle mode</span><strong>Demo / research</strong><small>• Live acceptance pending</small></div>
            <div><span>Build</span><strong>v0.2.0</strong><small>Testnet</small></div>
          </div>
          <div className={styles.art}><Dome /></div>
          <p className={styles.caption}>Structure brings volatility into focus.</p>
        </aside>
      </section>
      <section className={styles.features} aria-label="Protocol capabilities">
        <div><strong>24/7</strong><span>Autonomous markets</span></div><div><strong>AI</strong><span>Risk &amp; liquidity</span></div><div><strong>Private</strong><span>Strategy commitments</span></div><div><strong>On-chain</strong><span>Verifiable infrastructure</span></div>
      </section>
    </main>
    <footer className={styles.footer}>
      <div className={styles.eyebrow}><span>▪ &nbsp;02 / Built for a more efficient financial system</span><span>Markets are more efficient on-chain &nbsp;▪</span></div>
      <div className={styles.footerBody}>
        <div className={styles.statement}><h2>There is<br />structure<br />inside<br />volatility.</h2><p>Symbasis makes it executable. A new class of on-chain markets, powered by AI, designed for performance, privacy and global access.</p><p className={styles.disclaimer}>Research preview on Amadeus Protocol testnet. Live swaps and perpetual execution are not yet available.</p></div>
        <div className={styles.footerLinks}>
          <div className={styles.footerBrand}><a href="/" aria-label="Symbasis homepage"><Dome small /><strong>SYMBASIS</strong></a><p>Private AI perpetual<br />market infrastructure</p></div>
          {groups.map(group => <nav key={group.title} aria-label={group.title}><h3>{group.title}</h3>{group.links.map(([label, href]) => <a key={label} href={href}>{label}</a>)}</nav>)}
        </div>
      </div>
    </footer>
  </div>;
}

