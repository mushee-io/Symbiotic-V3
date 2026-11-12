import { DemoReadinessPanel } from "@/components/DemoReadinessPanel";

export const metadata={
  title:"Public Testnet Evidence | Symbiotic V3",
  description:"Read-only Amadeus public testnet readiness, exactly TESTBTC/AMA and TESTUSD/AMA. No live spot trading or fabricated activity.",
};

export default function PublicDemo(){
  return <>
    <header className="header">
      <a className="logo" href="/">SYMBIOTIC <b>V3</b></a>
      <nav className="links" aria-label="Demo navigation">
        <a href="/">Spot terminal</a>
        <a className="accent" href="/demo">Public evidence</a>
        <a href="/roadmap">12 milestones</a>
      </nav>
      <a className="headerWalletLink" href="https://github.com/mushee-io/Symbiotic-V3/issues" target="_blank" rel="noopener noreferrer">Acceptance tracker ↗</a>
    </header>
    <main className="shell">
      <section className="demoHero">
        <div className="eyebrow">SYMBIOTIC V3 / AMADEUS / PUBLIC TESTNET</div>
        <h1>Show the chain.<br/><span>Prove the trade.</span></h1>
        <p>Our AMA-native spot trading research is open to inspect. These are public testnet observations and code milestones—not a claim that swaps are live.</p>
        <div className="demoHeroLinks">
          <a className="demoPrimary" href="#demo-readiness">Check readiness ↘</a>
          <a className="demoSecondary" href="/">Explore read-only spot ↗</a>
        </div>
      </section>
      <DemoReadinessPanel/>
      <section className="demoNarrative">
        <article><small>01 / NETWORK</small><h2>One chain.<br/>One quote asset.</h2><p>Symbiotic V3 is designed exclusively around native Amadeus transactions. TESTBTC and TESTUSD are the only experimental bases; every planned pool quotes in AMA.</p></article>
        <article><small>02 / ENGINEERING</small><h2>Build first.<br/>Verify always.</h2><p>Rust RISC-V guest contracts, deterministic AMM math, source-checked wallet paths and a disabled-by-default risk engine are documented in the GitHub repository.</p></article>
        <article><small>03 / ACCEPTANCE</small><h2>No fake<br/>market activity.</h2><p>Pool balances, prices, charts, mint receipts and trades remain unavailable until independently authenticated on-chain data exists. Missing evidence stays visibly missing.</p></article>
      </section>
      <section className="demoNext">
        <div><p className="eyebrow">M12 · ECOSYSTEM PROPOSAL</p><h2>Symbiotic V3 × 33JACK</h2><p>Two separate Amadeus-native product directions: verifiable AMA spot liquidity research and AI-assisted cross-border business payment workflows. Integration is proposed, not demonstrated.</p></div>
        <a className="demoSecondary" href="https://github.com/mushee-io/Symbiotic-V3/blob/main/docs/m12-amadeus-ecosystem-proposal.md" target="_blank" rel="noopener noreferrer">Read the proposal ↗</a>
      </section>
      <footer className="demoFootNav">
        <a href="/roadmap">Milestones</a><a href="https://testnet.explorer.ama.one" target="_blank" rel="noopener noreferrer">Amadeus explorer</a><a href="https://github.com/mushee-io/Symbiotic-V3" target="_blank" rel="noopener noreferrer">GitHub</a>
        <span>Public testnet · Read-only</span>
      </footer>
    </main>
  </>;
}
