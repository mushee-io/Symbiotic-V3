import type { AmadeusSDK } from "@amadeus-protocol/sdk";
import { inspectTestnet, type TestnetHealth } from "../amadeus-health";
import { readTokenRegistration, type M4Symbol } from "../amadeus-tokens";
import { LiquidityUnavailableError, getCertifiedPool, require48ByteAddress } from "../liquidity/deployments";
import { parseActualCoinBalance, reconcileNativePool, type PoolSnapshot } from "../liquidity/read";
import { readFinalizedWalletSwaps, type FinalizedSwapCall } from "./history";

export type TerminalWalletBalance = Readonly<{
  address: string;
  amaAtomic: string;
  baseAtomic: string | null;
  baseStatus: "registered_chain_coin" | "token_not_issued";
  source: "amadeus_testnet_native_coin";
}>;
export type NativeTerminalData = Readonly<{
  network: "amadeus-testnet";
  status: "blocked" | "read_only";
  symbol: M4Symbol;
  pair: "TESTBTC/AMA" | "TESTUSD/AMA";
  health: Pick<TestnetHealth,"height"|"rootedHeight"|"checkedAt">;
  token: { status: "unregistered" | "registered"; supplyAtomic: string | null };
  pool: PoolSnapshot | null;
  wallet: TerminalWalletBalance | null;
  history: FinalizedSwapCall[] | null;
  chart: null;
  chartReason: "no_independently_verified_historical_reserve_series";
  tradingEnabled: false;
}>;

export type TerminalReader = Pick<AmadeusSDK,"chain"|"transaction"|"contract"|"wallet">;

/** Read-only wallet holdings, never fake a 0 TESTBTC/TESTUSD for unissued coins. */
export async function readTerminalWalletBalances(
  sdk: Pick<AmadeusSDK,"wallet">,
  owner: string, base: M4Symbol, registered: boolean,
): Promise<TerminalWalletBalance> {
  require48ByteAddress(owner);
  const [ama, coin] = await Promise.all([
    sdk.wallet.getBalance(owner, "AMA"),
    registered ? sdk.wallet.getBalance(owner, base) : Promise.resolve(null),
  ]);
  return {
    address: owner,
    amaAtomic: String(parseActualCoinBalance(ama, "AMA")),
    baseAtomic: coin ? String(parseActualCoinBalance(coin, base)) : null,
    baseStatus: registered ? "registered_chain_coin" : "token_not_issued",
    source: "amadeus_testnet_native_coin",
  };
}

/**
 * Health, token registry, pool storage/custody and canonical transactions are
 * independent public testnet reads. Bad data fails closed, never a fake chart.
 */
export async function readNativeTerminal(
  sdk: TerminalReader, base: M4Symbol, owner?: string,
): Promise<NativeTerminalData> {
  if (base !== "TESTBTC" && base !== "TESTUSD") throw new LiquidityUnavailableError("unsupported_market");
  if (owner !== undefined) require48ByteAddress(owner);
  const health = await inspectTestnet(sdk);
  const registration = await readTokenRegistration(sdk,base);
  const registered = registration.status === "registered";
  const wallet = owner ? await readTerminalWalletBalances(sdk,owner,base,registered) : null;

  let pool: PoolSnapshot | null = null;
  let history: FinalizedSwapCall[] | null = null;
  let status: NativeTerminalData["status"] = "blocked";
  try {
    const certificate = getCertifiedPool(base);
    if (!registered) throw new LiquidityUnavailableError("pool_token_not_issued");
    pool = await reconcileNativePool(sdk,certificate,owner);
    if (owner) {
      history = await readFinalizedWalletSwaps(sdk,certificate,owner,health.rootedHeight);
    }
    status = "read_only";
  } catch (error) {
    // Only the absence of a verified pool cert is an expected BLOCKED state.
    // If a certified pool exists but live history/custody fails, return HTTP
    // 503 from the route, not a partial/empty spoofed history or reserves.
    if (!(error instanceof LiquidityUnavailableError && error.reason === "pool_not_deployed")) {
      throw error;
    }
  }

  return {
    network:"amadeus-testnet",status,symbol:base,pair:base+"/AMA" as NativeTerminalData["pair"],
    health:{height:health.height,rootedHeight:health.rootedHeight,checkedAt:health.checkedAt},
    token:{status:registration.status,supplyAtomic:registration.supplyAtomic},
    pool,wallet,history,
    chart:null,
    chartReason:"no_independently_verified_historical_reserve_series",
    tradingEnabled:false,
  };
}
