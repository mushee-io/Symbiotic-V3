import { createHash } from "node:crypto";
import type { AmadeusSDK } from "@amadeus-protocol/sdk";
import { AMA_NETWORK, AMA_TESTNET_RPC } from "../amadeus";
import { VERIFIED_M3_SIGNING_DOMAIN } from "../amadeus-wallet";
import { VERIFIED_POOLS } from "../liquidity/deployments";
import { readNativeTerminal, type TerminalReader, type NativeTerminalData } from "../terminal/read";

export const DEMO_BASES = ["TESTBTC", "TESTUSD"] as const;
export const DEMO_EXPLORER = "https://testnet.explorer.ama.one" as const;
export const DEMO_GITHUB = "https://github.com/mushee-io/Symbiotic-V3" as const;

export type DemoMarketEvidence = Readonly<{
  pair: "TESTBTC/AMA" | "TESTUSD/AMA";
  nativeCoinRegistration: "registered" | "unregistered";
  registeredSupplyAtomic: string | null;
  poolCertificateAvailable: boolean;
  reservesIndependentlyReconciled: boolean;
  poolAddress: string | null;
  verifiedHistoryAvailable: boolean;
  priceChartAvailable: false;
  liveSpotTradingEnabled: false;
}>;

export type PublicDemoReadiness = Readonly<{
  schema: "symbiotic.m12.public-readiness.v1";
  network: typeof AMA_NETWORK;
  rpc: typeof AMA_TESTNET_RPC;
  explorer: typeof DEMO_EXPLORER;
  status: "research_demo_only";
  checkedAt: string;
  rootHeight: number;
  tipHeight: number;
  markets: readonly [DemoMarketEvidence, DemoMarketEvidence];
  checks: Readonly<{
    rpcReachable: true;
    twoPairAllowlist: true;
    walletSigningDomainIndependentlyVerified: boolean;
    testTokensIndependentlyMinted: false;
    twoNativePoolsDeployed: boolean;
    nativePoolCustodyIndependentlyReconciled: boolean;
    realLiquidityAcceptanceVerified: false;
    fourFinalizedBidirectionalSwapReceiptsVerified: false;
    twoWalletTerminalAcceptanceVerified: false;
    aiAgentRealExecutionAcceptanceVerified: false;
    nativeVmSecurityAcceptanceVerified: false;
    publicWebDeploymentVerified: false;
  }>;
  blockers: readonly string[];
  tradingEnabled: false;
  signingEnabled: false;
  grantSubmissionApproved: false;
  productionReady: false;
  /** SHA-256 of an observed/read-only status report, NOT a transaction hash. */
  evidenceDigestSha256: string;
  evidencePersistent: false;
}>;

function asMarket(value: NativeTerminalData, base: typeof DEMO_BASES[number]): DemoMarketEvidence {
  if (value.network !== AMA_NETWORK || value.symbol !== base || value.pair !== base + "/AMA" ||
      value.tradingEnabled !== false || value.chart !== null ||
      !Number.isSafeInteger(value.health.rootedHeight) ||
      !Number.isSafeInteger(value.health.height) ||
      value.health.rootedHeight < 0 || value.health.rootedHeight > value.health.height ||
      (value.token.status !== "registered" && value.token.status !== "unregistered")) {
    throw Error("native_demo_market_not_verified");
  }
  if (value.token.status === "unregistered" && value.token.supplyAtomic !== null) {
    throw Error("unregistered_coin_has_supply");
  }
  const certificateAvailable = VERIFIED_POOLS[base] !== null;
  if (value.pool !== null && !certificateAvailable) throw Error("uncertified_pool_reported");
  if (value.status === "read_only" && (!value.pool || value.pool.reconciled !== true)) {
    throw Error("unverified_pool_marked_read_only");
  }
  if (value.pool !== null && (
    value.pool.reconciled !== true || value.pool.pair !== base + "/AMA" ||
    value.pool.reserveAma !== value.pool.custodyAma ||
    value.pool.reserveBase !== value.pool.custodyBase
  )) throw Error("pool_custody_not_reconciled");

  return {
    pair:value.pair,
    nativeCoinRegistration:value.token.status,
    registeredSupplyAtomic:value.token.supplyAtomic,
    poolCertificateAvailable:certificateAvailable,
    reservesIndependentlyReconciled:value.pool !== null,
    poolAddress:value.pool?.address ?? null,
    verifiedHistoryAvailable:value.history !== null,
    priceChartAvailable:false,
    liveSpotTradingEnabled:false,
  };
}

/**
 * Real pinned Amadeus testnet observations. Runtime does not accept caller
 * supplied contracts, prices, receipts, stage overrides or wallet keys.
 * No M3–M11 live acceptance may be inferred from compilation or a token symbol
 * merely being registered by an unknown issuer.
 */
export async function readPublicDemoReadiness(
  sdk: TerminalReader,
): Promise<PublicDemoReadiness> {
  const [btc,usd] = await Promise.all([
    readNativeTerminal(sdk, "TESTBTC"),
    readNativeTerminal(sdk, "TESTUSD"),
  ]);
  if (btc.network !== AMA_NETWORK || usd.network !== AMA_NETWORK ||
      btc.health.rootedHeight > btc.health.height ||
      usd.health.rootedHeight > usd.health.height ||
      Math.abs(btc.health.height-usd.health.height) > 20 ||
      Math.abs(btc.health.rootedHeight-usd.health.rootedHeight) > 20) {
    throw Error("inconsistent_native_testnet_observations");
  }
  const markets = [asMarket(btc,"TESTBTC"),asMarket(usd,"TESTUSD")] as const;
  const poolsDeployed=markets.every(m=>m.poolCertificateAvailable);
  const custodyReconciled=markets.every(m=>m.reservesIndependentlyReconciled);
  const checks = {
    rpcReachable:true,
    twoPairAllowlist:true,
    walletSigningDomainIndependentlyVerified:VERIFIED_M3_SIGNING_DOMAIN,
    // Real mint issuer receipt verification and bidirectional swap acceptance
    // are separate prerequisites. Coin registration alone does not prove them.
    testTokensIndependentlyMinted:false,
    twoNativePoolsDeployed:poolsDeployed,
    nativePoolCustodyIndependentlyReconciled:custodyReconciled,
    realLiquidityAcceptanceVerified:false,
    fourFinalizedBidirectionalSwapReceiptsVerified:false,
    twoWalletTerminalAcceptanceVerified:false,
    aiAgentRealExecutionAcceptanceVerified:false,
    nativeVmSecurityAcceptanceVerified:false,
    // A remote web deployment is verified externally, never by its own API.
    publicWebDeploymentVerified:false,
  } as const;
  const blockers=[
    ...(!checks.walletSigningDomainIndependentlyVerified?["M3 two-wallet native signing acceptance missing"]:[]),
    ...(!checks.testTokensIndependentlyMinted?["M4 both native Coin mint receipts missing"]:[]),
    ...(!checks.twoNativePoolsDeployed?["M6 pair-specific native pool deployment receipts missing"]:[]),
    ...(!checks.realLiquidityAcceptanceVerified?["M7 verified funded liquidity and LP receipts missing"]:[]),
    ...(!checks.fourFinalizedBidirectionalSwapReceiptsVerified?["M8 finalized BUY and SELL receipts for both AMA pairs missing"]:[]),
    ...(!checks.twoWalletTerminalAcceptanceVerified?["M9 independent two-wallet terminal acceptance missing"]:[]),
    ...(!checks.aiAgentRealExecutionAcceptanceVerified?["M10 independent operator/agent acceptance missing"]:[]),
    ...(!checks.nativeVmSecurityAcceptanceVerified?["M11 native VM security and rollback acceptance missing"]:[]),
    ...(!checks.publicWebDeploymentVerified?["M12 independently verified public deployment and demo pending"]:[]),
  ];
  const evidence = {
    network:AMA_NETWORK,rpc:AMA_TESTNET_RPC,rootHeight:Math.min(btc.health.rootedHeight,usd.health.rootedHeight),
    tipHeight:Math.min(btc.health.height,usd.health.height),markets,checks,blockers,
  };
  const digest = createHash("sha256").update(JSON.stringify(evidence),"utf8").digest("hex");
  return {
    schema:"symbiotic.m12.public-readiness.v1",
    network:AMA_NETWORK,rpc:AMA_TESTNET_RPC,explorer:DEMO_EXPLORER,
    status:"research_demo_only",checkedAt:new Date().toISOString(),
    rootHeight:evidence.rootHeight,tipHeight:evidence.tipHeight,
    markets,checks,blockers,
    tradingEnabled:false,signingEnabled:false,
    grantSubmissionApproved:false,productionReady:false,
    evidenceDigestSha256:digest,evidencePersistent:false,
  };
}

/** A run can read the public chain only. No SDK signer or submit API is required. */
export type PublicReadinessSDK = Pick<AmadeusSDK,"chain"|"transaction"|"contract"|"wallet">;
