const milestones = [
  {
    "number": 1,
    "title": "Amadeus-only extraction",
    "summary": "Replace imported chain-specific code with native testnet starter app and CI; no incompatible dependencies. Validate build, architecture, and deletion.",
    "acceptance": "Clean tree, passing tests, no legacy code.",
    "url": "https://github.com/mushee-io/Symbiotic-V3/issues/1"
  },
  {
    "number": 2,
    "title": "Testnet SDK & connectivity",
    "summary": "RPC, chain tip, errors, reconnection and no mainnet fallback.",
    "acceptance": "Real SDK chain height, fail-closed offline state.",
    "url": "https://github.com/mushee-io/Symbiotic-V3/issues/2"
  },
  {
    "number": 3,
    "title": "Native AMA wallets",
    "summary": "Connect/disconnect, wallet network detection, balances, explicit signing.",
    "acceptance": "Two test wallets verified on Amadeus testnet.",
    "url": "https://github.com/mushee-io/Symbiotic-V3/issues/3"
  },
  {
    "number": 4,
    "title": "Two native test assets",
    "summary": "Create TESTBTC and TESTUSD with on-chain mint receipts and independent balance checks.",
    "acceptance": "Two verified native test token issuance records.",
    "url": "https://github.com/mushee-io/Symbiotic-V3/issues/4"
  },
  {
    "number": 5,
    "title": "Spot AMM contract design",
    "summary": "Specify native constant-product swaps, fee accounting, slippage, precision and LP math.",
    "acceptance": "Reviewed design and tested AMM invariants.",
    "url": "https://github.com/mushee-io/Symbiotic-V3/issues/5"
  },
  {
    "number": 6,
    "title": "Deploy two native AMA pools",
    "summary": "Build/deploy smart contracts for TESTBTC/AMA and TESTUSD/AMA only.",
    "acceptance": "Contract addresses and public testnet deployments.",
    "url": "https://github.com/mushee-io/Symbiotic-V3/issues/6"
  },
  {
    "number": 7,
    "title": "Seed real liquidity",
    "summary": "Fund pools with test AMA and issued test assets; add and remove liquidity.",
    "acceptance": "Verified pool reserve state and liquidity receipts.",
    "url": "https://github.com/mushee-io/Symbiotic-V3/issues/7"
  },
  {
    "number": 8,
    "title": "Real spot buy/sell",
    "summary": "Wallet-sign, submit and verify swaps in both directions for both pairs.",
    "acceptance": "Four independently verifiable spot swap scenarios.",
    "url": "https://github.com/mushee-io/Symbiotic-V3/issues/8"
  },
  {
    "number": 9,
    "title": "On-chain spot terminal",
    "summary": "Live native balances, reserves, swap history and source-linked pool price.",
    "acceptance": "No fictitious markets, balances, prices, candles or fills.",
    "url": "https://github.com/mushee-io/Symbiotic-V3/issues/9"
  },
  {
    "number": 10,
    "title": "Guardrailed AI market maker",
    "summary": "Automate bounded liquidity actions with operator pause, logs, inventory caps and verified prices.",
    "acceptance": "Agent audit trail with real testnet action receipts; no wash volume.",
    "url": "https://github.com/mushee-io/Symbiotic-V3/issues/10"
  },
  {
    "number": 11,
    "title": "Security & CI acceptance",
    "summary": "Resilience, slippage, failure-mode, wallet rejection, precision and contract security testing.",
    "acceptance": "CI passing; risks documented; fail-closed drills.",
    "url": "https://github.com/mushee-io/Symbiotic-V3/issues/11"
  },
  {
    "number": 12,
    "title": "Public demo & ecosystem proposal",
    "summary": "Deploy truthful testnet spot demo, link explorer evidence, and prepare companion 33JACK pitch.",
    "acceptance": "Public demo, two-wallet demo and proposal; advanced markets Coming Soon.",
    "url": "https://github.com/mushee-io/Symbiotic-V3/issues/12"
  }
];
export default function Roadmap(){return <main className="shell"><a className="logo" href="/">SYMBIOTIC <b>V3</b></a><section className="hero" style={{marginTop:30}}><div className="eyebrow">AMA NATIVE · TESTNET ROADMAP</div><h1>12 milestones</h1><p>Spot is the first real product. Perpetuals, RWA, Notional and Options stay Coming Soon.</p></section><section className="future" style={{gridTemplateColumns:"repeat(auto-fit,minmax(235px,1fr))"}}>{milestones.map(m=><article key={m.number}><small>M{m.number} · PLANNED</small><h3>{m.title}</h3><p className="muted" style={{lineHeight:1.6}}>{m.summary}</p><p className="muted" style={{fontSize:12}}><strong>Acceptance:</strong> {m.acceptance}</p><a className="accent" target="_blank" rel="noopener noreferrer" href={m.url}>Open GitHub issue ↗</a></article>)}</section></main>}