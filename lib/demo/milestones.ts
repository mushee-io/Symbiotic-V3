/**
 * GitHub issue-state snapshot verified on 12 November 2026.
 * NOT a live GitHub API feed and NOT a live-chain accomplishment statement.
 */
export const MILESTONE_STATUS_CHECKED="2026-11-12" as const;
export const MILESTONE_INDEX=[
  {number:1,title:"Amadeus-only repository",summary:"Independent native Amadeus application, AMA pairs, clean CI.",acceptance:"Source extraction and baseline tests",issueState:"closed"},
  {number:2,title:"Native SDK & testnet",summary:"Pinned public testnet RPC, chain tip/root and no-mainnet fallback.",acceptance:"SDK connectivity and error handling",issueState:"closed"},
  {number:3,title:"Native wallet signing",summary:"Wallet discovery and real public AMA balances. Two-wallet signing proof pending.",acceptance:"Independent wallet/network signing witnesses",issueState:"open"},
  {number:4,title:"Two native test tokens",summary:"TESTBTC and TESTUSD native Coin issuance validation code; mint receipts pending.",acceptance:"Real finalized two-token issuance",issueState:"open"},
  {number:5,title:"AMM mathematics",summary:"Native integer x*y=k spot math, 30 bps fee, bounded LP shares and rounding tests.",acceptance:"Pure arithmetic and design",issueState:"closed"},
  {number:6,title:"Native RISC-V pools",summary:"Two feature-locked compiled guests; approved initialization and deployment pending.",acceptance:"Two real native deployed pool receipts",issueState:"open"},
  {number:7,title:"AMA-paired liquidity",summary:"LP intention and reconciliation code; real pool funding and LP receipts pending.",acceptance:"Finalized LP deposits/withdrawals and custody",issueState:"open"},
  {number:8,title:"Spot BUY / SELL",summary:"Reserve-backed read-only quotes and native receipt checking; swaps disabled.",acceptance:"Four independent finalized spot receipts",issueState:"open"},
  {number:9,title:"On-chain spot terminal",summary:"Read-only balances, reserve, finalized-call provenance and honest empty states.",acceptance:"Two real-wallet terminal acceptance",issueState:"open"},
  {number:10,title:"Guardrailed AI research",summary:"Deterministic inventory/risk monitor with no signing or autonomous trading.",acceptance:"Authenticated agent/operator chain evidence",issueState:"open"},
  {number:11,title:"Security & failure drills",summary:"Source hardening, negative tests and verified build artifacts; native VM audit pending.",acceptance:"Independent runtime security and rollback",issueState:"open"},
  {number:12,title:"Public demo & proposal",summary:"Evidence-linked public demo source and proposed complementary 33JACK pathway.",acceptance:"Verified public deployment and real four-direction demo",issueState:"open"},
] as const;

export const MILESTONE_REPO="https://github.com/mushee-io/Symbiotic-V3" as const;
export function milestoneIssueUrl(number:number):string {
  if(!Number.isInteger(number)||number<1||number>12)throw Error("invalid_milestone_number");
  return MILESTONE_REPO+"/issues/"+number;
}
