import * as React from "react";
import { MILESTONE_INDEX, MILESTONE_STATUS_CHECKED, milestoneIssueUrl } from "@/lib/demo/milestones";

export const metadata={
  title:"12 Milestones | Symbiotic V3 Amadeus",
  description:"Honest, dated issue-state snapshot of Symbiotic V3 development and still-open live acceptance requirements.",
};

export default function Roadmap(){
  return <main className="shell">
    <nav className="demoFootNav" aria-label="Roadmap navigation">
      <a className="logo" href="/">SYMBIOTIC <b>V3</b></a>
      <a href="/demo">Public testnet evidence</a>
      <a href="/">Spot terminal</a>
      <a href="https://github.com/mushee-io/Symbiotic-V3/issues" target="_blank" rel="noopener noreferrer">GitHub issue tracker ↗</a>
    </nav>
    <section className="demoHero">
      <p className="eyebrow">AMA NATIVE · EXACTLY TWO SPOT MARKETS</p>
      <h1>12 milestones.<br/><span>Evidence at every step.</span></h1>
      <p>The source implementation and an independently witnessed on-chain release are not the same thing. This is a GitHub issue-status snapshot checked on {MILESTONE_STATUS_CHECKED}, not an automatically updated live issue feed.</p>
      <div className="demoHeroLinks"><a className="demoPrimary" href="/demo">Check on-chain readiness ↗</a></div>
    </section>
    <section className="demoRoadmapGrid" aria-label="Twelve Amadeus milestones">
      {MILESTONE_INDEX.map(m=><article className="demoMilestone" key={m.number}>
        <div className="demoMilestoneTop">
          <span className="eyebrow">M{String(m.number).padStart(2,"0")}</span>
          <span className={m.issueState==="closed"?"demoIssueClosed":"demoIssueOpen"}>
            {m.issueState==="closed"?"GitHub issue closed":"Live acceptance open"}
          </span>
        </div>
        <h2>{m.title}</h2>
        <p>{m.summary}</p>
        <div className="demoMilestoneGate"><strong>Acceptance required</strong><span>{m.acceptance}</span></div>
        <a href={milestoneIssueUrl(m.number)} target="_blank" rel="noopener noreferrer">Review actual issue &amp; evidence ↗</a>
      </article>)}
    </section>
    <p className="demoFooter">Issue state is a dated source-tracking snapshot. Closed M1/M2/M5 issues certify bounded engineering acceptance, not live exchange functionality. M3/M4/M6–M12 cannot be treated as complete without their independent chain, security and public deployment evidence.</p>
    <footer className="demoFootNav">
      <a href="/demo">Evidence dashboard</a>
      <a href="https://github.com/mushee-io/Symbiotic-V3/blob/main/docs/m12-public-testnet-demo.md" target="_blank" rel="noopener noreferrer">Demo checklist</a>
      <a href="https://github.com/mushee-io/Symbiotic-V3/blob/main/docs/m12-amadeus-ecosystem-proposal.md" target="_blank" rel="noopener noreferrer">Amadeus proposal</a>
    </footer>
  </main>;
}
