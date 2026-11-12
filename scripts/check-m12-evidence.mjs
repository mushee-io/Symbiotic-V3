import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";

const read=(p)=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const paths=[
  "lib/demo/readiness.ts",
  "app/api/demo/readiness/route.ts",
  "components/DemoReadinessPanel.tsx",
  "app/demo/page.tsx",
  "app/page.tsx",
  "app/trade/page.tsx",
  "app/trade/onchain/page.tsx",
  "app/sandbox/page.tsx",
  "components/TerminalShell.tsx",
  "lib/markets.ts",
  "lib/liquidity/deployments.ts",
  "lib/amadeus-wallet.ts",
  "docs/m12-public-testnet-demo.md",
  "docs/m12-amadeus-ecosystem-proposal.md",
  "docs/m11-security-acceptance.md",
];
const inputs=Object.fromEntries(paths.map(p=>[p,read(p)]));
const readiness=inputs["lib/demo/readiness.ts"];
const route=inputs["app/api/demo/readiness/route.ts"];
const component=inputs["components/DemoReadinessPanel.tsx"];
const demoPage=inputs["app/demo/page.tsx"];
const landing=inputs["app/page.tsx"];
const trade=inputs["app/trade/page.tsx"];
const nativeTrade=inputs["app/trade/onchain/page.tsx"];
const sandbox=inputs["app/sandbox/page.tsx"];
const terminalShell=inputs["components/TerminalShell.tsx"];
const markets=inputs["lib/markets.ts"];
const deployments=inputs["lib/liquidity/deployments.ts"];
const wallet=inputs["lib/amadeus-wallet.ts"];
const doc=inputs["docs/m12-public-testnet-demo.md"];
const grant=inputs["docs/m12-amadeus-ecosystem-proposal.md"];
const checks={
  separateHomepageAndSpotTerminal: (landing.includes('href="/trade"') ||
    (landing.includes('const terminal = "/trade"') && landing.includes("href={terminal}"))) &&
    landing.includes("HomePage") && trade.includes("SandboxPage") &&
    sandbox.includes("SIMULATION ONLY") &&
    nativeTrade.includes("MarketTerminal") && nativeTrade.includes("TerminalShell") &&
    terminalShell.includes("AmadeusWalletPanel") &&
    terminalShell.includes("href=\"/\""),
  exactlyTwoAmaQuotedMarkets:markets.includes('["TESTBTC","TESTUSD"]') &&
    markets.includes('quote:"AMA"'),
  onlyNativeAmadeusRpc:readiness.includes('AMA_TESTNET_RPC') &&
    route.includes("nativeTestnetSdk()") &&
    readiness.includes('network:AMA_NETWORK'),
  noCallerControlledReadinessFlags:route.includes("if(q.size!==0)") &&
    !/\bexport\s+(?:async\s+)?function\s+(?:POST|PUT|PATCH|DELETE)\b/.test(route),
  honestNoTradeRelease:readiness.includes("tradingEnabled:false") &&
    readiness.includes("signingEnabled:false") &&
    readiness.includes("productionReady:false"),
  noInventedMintsOrReceipts:readiness.includes("testTokensIndependentlyMinted:false") &&
    readiness.includes("fourFinalizedBidirectionalSwapReceiptsVerified:false") &&
    readiness.includes("realLiquidityAcceptanceVerified:false"),
  noInventedPublicWebDeployment:readiness.includes("publicWebDeploymentVerified:false") &&
    doc.includes("Vercel") && doc.includes("NOT prove"),
  poolsRequireRealCertification:deployments.includes("TESTBTC: null") &&
    deployments.includes("TESTUSD: null"),
  noIndependentWalletApproval:wallet.includes("VERIFIED_M3_SIGNING_DOMAIN = false"),
  demoShowsOnlyTwoPairs:component.includes('["TESTBTC/AMA","TESTUSD/AMA"]') &&
    demoPage.includes("Show the chain."),
  visibleNoTradeDisclosure:component.includes("Swaps and signing disabled") &&
    demoPage.includes("not a claim that swaps are live"),
  fullPublicDocs:doc.includes("four receipts total") &&
    grant.includes("33JACK") && grant.includes("not a functioning live spot exchange"),
};
const failed=Object.entries(checks).filter(([,pass])=>!pass).map(([name])=>name);
assert.deepEqual(failed,[],"M12 static source guard failures: "+failed.join(","));
const sources=paths.map(path=>({
  path, sha256:crypto.createHash("sha256").update(inputs[path],"utf8").digest("hex"),
  bytes:Buffer.byteLength(inputs[path],"utf8"),
}));
const manifest={
  schema:"symbiotic.m12.public-demo-source-evidence.v1",
  network:"amadeus-testnet",
  verifiedKind:"reproducible-source-and-CI-guards-only",
  gitSha:process.env.GITHUB_SHA??null,
  generatedAt:process.env.GITHUB_RUN_ID?new Date().toISOString():null,
  officialExplorer:"https://testnet.explorer.ama.one",
  activePairNames:["TESTBTC/AMA","TESTUSD/AMA"],
  quoteAsset:"AMA",
  checks,
  sources,
  sourceDigestSha256:crypto.createHash("sha256").update(
    sources.map(x=>x.path+"\t"+x.sha256).join("\n"),"utf8").digest("hex"),
  liveMintReceiptsVerified:false,
  livePoolDeploymentsVerified:false,
  realLiquidityVerified:false,
  fourRealSwapReceiptsVerified:false,
  twoWalletAcceptanceVerified:false,
  productionSigningEnabled:false,
  tradingEnabled:false,
  publicVercelDeploymentIndependentlyVerified:false,
  externalSecurityAuditCompleted:false,
  grantAwardConfirmed:false,
  caveat:"This artifact is a static source/CI integrity report, not a live blockchain receipt, Vercel deployment status, native VM security audit or external grant outcome.",
};
process.stdout.write(JSON.stringify(manifest,null,2)+"\n");
