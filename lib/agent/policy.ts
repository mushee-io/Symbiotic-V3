import type { PoolSnapshot } from "../liquidity/read";
import type { TerminalWalletBalance } from "../terminal/read";
import { LiquidityUnavailableError } from "../liquidity/deployments";
import { quoteNativeSpot, type NativeSpotQuote, type SpotSide } from "../spot/quote";

export type AgentMarket = "TESTBTC" | "TESTUSD";
export type AgentConfig = Readonly<{
  targetBaseBps: number;
  inventoryBandBps: number;
  targetSpreadBps: number;
  maxSlippageBps: number;
  maxPoolUtilizationBps: number;
  maxReferenceDivergenceBps: number;
  maxTradeAmaAtomic: string;
  maxPositionAmaAtomic: string;
  dailyLossCapAmaAtomic: string;
  gasReserveAmaAtomic: string;
}>;
export type AgentControls = Readonly<{
  operatorPaused: boolean;
  killSwitchEngaged: boolean;
  /** This is intentionally never set by a public HTTP request. */
  authenticatedOperatorApproval: false;
}>;

export const DEFAULT_AGENT_CONFIG: AgentConfig = Object.freeze({
  targetBaseBps: 5000,
  inventoryBandBps: 500,
  targetSpreadBps: 80,
  maxSlippageBps: 50,
  maxPoolUtilizationBps: 100,
  maxReferenceDivergenceBps: 200,
  maxTradeAmaAtomic: "1000000000",
  maxPositionAmaAtomic: "10000000000",
  dailyLossCapAmaAtomic: "1000000000",
  gasReserveAmaAtomic: "100000000",
});
export const DEFAULT_AGENT_CONTROLS: AgentControls = Object.freeze({
  operatorPaused: true, killSwitchEngaged: true,
  authenticatedOperatorApproval: false,
});

/** Strict decimal integer parsing, no JS rounding or exponential notation. */
export function atomic(value: unknown, label: string, allowZero = false): bigint {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new LiquidityUnavailableError("invalid_" + label);
  }
  const n = BigInt(value);
  if (n > 10n ** 16n || (!allowZero && n === 0n)) {
    throw new LiquidityUnavailableError("invalid_" + label);
  }
  return n;
}
function integer(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new LiquidityUnavailableError("invalid_" + label);
  }
  return value;
}

export function validateAgentConfig(input: AgentConfig): AgentConfig {
  integer(input.targetBaseBps, "target_inventory", 1000, 9000);
  integer(input.inventoryBandBps, "inventory_band", 1, 1500);
  if (input.inventoryBandBps >= input.targetBaseBps ||
      input.targetBaseBps + input.inventoryBandBps >= 10000) {
    throw new LiquidityUnavailableError("invalid_inventory_bounds");
  }
  integer(input.targetSpreadBps, "target_spread", 30, 1000);
  integer(input.maxSlippageBps, "max_slippage", 1, 100);
  integer(input.maxPoolUtilizationBps, "pool_utilization", 1, 100);
  integer(input.maxReferenceDivergenceBps, "reference_divergence", 1, 500);
  const maxTrade = atomic(input.maxTradeAmaAtomic, "max_trade");
  const maxPosition = atomic(input.maxPositionAmaAtomic, "max_position");
  const loss = atomic(input.dailyLossCapAmaAtomic, "daily_loss_cap");
  const gas = atomic(input.gasReserveAmaAtomic, "gas_reserve");
  if (maxTrade > maxPosition || maxTrade > 100n * 10n ** 9n ||
      maxPosition > 1000n * 10n ** 9n ||
      loss > 100n * 10n ** 9n ||
      gas < 1000000n || gas > 10n * 10n ** 9n) {
    throw new LiquidityUnavailableError("agent_policy_hard_cap_exceeded");
  }
  return input;
}

export function parseAgentQuery(search: URLSearchParams): { config: AgentConfig; controls: AgentControls } {
  // Reject unknown keys, especially PnL/oracle/approval spoofing from a public client.
  const allowed = new Set([
    "base","owner","targetBaseBps","inventoryBandBps","targetSpreadBps",
    "maxSlippageBps","maxPoolUtilizationBps","maxReferenceDivergenceBps",
    "maxTradeAmaAtomic","maxPositionAmaAtomic","dailyLossCapAmaAtomic",
    "gasReserveAmaAtomic","operatorPaused","killSwitchEngaged",
  ]);
  for (const key of search.keys()) {
    if (!allowed.has(key) || search.getAll(key).length !== 1) {
      throw new LiquidityUnavailableError("untrusted_agent_parameter");
    }
  }
  const value = <K extends keyof AgentConfig>(key: K): AgentConfig[K] => {
    const raw = search.get(key);
    if (raw === null) return DEFAULT_AGENT_CONFIG[key];
    if (typeof DEFAULT_AGENT_CONFIG[key] === "number") {
      if (!/^(0|[1-9][0-9]*)$/.test(raw)) throw new LiquidityUnavailableError("invalid_config_integer");
      return Number(raw) as AgentConfig[K];
    }
    return raw as AgentConfig[K];
  };
  const flag = (key: "operatorPaused" | "killSwitchEngaged"): boolean => {
    const raw=search.get(key);
    if (raw===null) return true;
    if (raw !== "true" && raw !== "false") throw new LiquidityUnavailableError("invalid_control");
    return raw === "true";
  };
  const config=validateAgentConfig({
    targetBaseBps:value("targetBaseBps"), inventoryBandBps:value("inventoryBandBps"),
    targetSpreadBps:value("targetSpreadBps"), maxSlippageBps:value("maxSlippageBps"),
    maxPoolUtilizationBps:value("maxPoolUtilizationBps"),
    maxReferenceDivergenceBps:value("maxReferenceDivergenceBps"),
    maxTradeAmaAtomic:value("maxTradeAmaAtomic"),
    maxPositionAmaAtomic:value("maxPositionAmaAtomic"),
    dailyLossCapAmaAtomic:value("dailyLossCapAmaAtomic"),
    gasReserveAmaAtomic:value("gasReserveAmaAtomic"),
  });
  return {config,controls:{
    operatorPaused:flag("operatorPaused"),
    killSwitchEngaged:flag("killSwitchEngaged"),
    authenticatedOperatorApproval:false,
  }};
}

export type ReferenceWitness = Readonly<{
  source: "independently_verified_oracle";
  amaPerBaseNumerator: string;
  amaPerBaseDenominator: string;
  observedAtRootedHeight: number;
  independentlyVerified: true;
}>;
export type PnlWitness = Readonly<{
  source: "finalized_native_receipts";
  day: string;
  realizedAmaAtomic: string; // signed, negative = net loss
  observedAtRootedHeight: number;
  independentlyReconciled: true;
}>;
export type AgentObservations = Readonly<{
  symbol: AgentMarket;
  rootedHeight: number | null;
  latestHeight: number | null;
  pool: PoolSnapshot | null;
  wallet: TerminalWalletBalance | null;
  reference: ReferenceWitness | null;
  pnl: PnlWitness | null;
}>;

export type AgentSignal = Readonly<{
  direction: SpotSide;
  amountInAtomic: string;
  inputSymbol: "AMA" | AgentMarket;
  indicativeQuote: NativeSpotQuote;
  inventoryBaseBps: string;
  poolReferenceDivergenceBps: string;
  /** Indicative pricing band only, not actionable limit orders. */
  indicativeBidAmaNumerator: string;
  indicativeAskAmaNumerator: string;
  indicativePriceDenominator: string;
}>;

export type AgentEvaluation = Readonly<{
  pair: "TESTBTC/AMA" | "TESTUSD/AMA";
  status: "hold" | "candidate_only";
  checks: readonly string[];
  signal: AgentSignal | null;
  snapshotHeight: number | null;
  canSign: false;
  canBroadcast: false;
  executionApproved: false;
  decisionType: "read_only_analysis";
}>;

function signedPnl(v: string): bigint {
  if (typeof v!=="string" || !/^(0|-?[1-9][0-9]*)$/.test(v)) throw new LiquidityUnavailableError("invalid_daily_pnl");
  const n=BigInt(v);
  if (n > 10n ** 16n || n < -(10n ** 16n)) throw new LiquidityUnavailableError("invalid_daily_pnl");
  return n;
}
const abs = (n:bigint)=>n<0n?-n:n;
const min = (a:bigint,b:bigint)=>a<b?a:b;

/**
 * Pure, deterministic, never signs. Runtime supplies reference and daily PnL
 * as null until genuine independent attestation exists. Tests may supply
 * synthetic fixtures ONLY to exercise the arithmetic: never live evidence.
 */
export function evaluateAgent(
  configInput: AgentConfig, controls: AgentControls, data: AgentObservations,
): AgentEvaluation {
  const config=validateAgentConfig(configInput);
  if (data.symbol!=="TESTBTC"&&data.symbol!=="TESTUSD") throw new LiquidityUnavailableError("unsupported_market");
  const checks:string[]=[];
  if (controls.killSwitchEngaged)checks.push("kill_switch_engaged");
  if (controls.operatorPaused)checks.push("operator_paused");
  if (controls.authenticatedOperatorApproval!==false)checks.push("operator_approval_not_attested");
  if (!Number.isSafeInteger(data.rootedHeight)||data.rootedHeight===null||
      data.rootedHeight<0||!Number.isSafeInteger(data.latestHeight)||
      data.latestHeight===null||data.latestHeight<data.rootedHeight||
      data.latestHeight-data.rootedHeight>100)checks.push("stale_or_unverified_chain");
  const pool=data.pool;
  if (!pool||pool.reconciled!==true||pool.symbol!==data.symbol||
      pool.pair!==data.symbol+"/AMA"||pool.paused||
      pool.reserveAma!==pool.custodyAma||pool.reserveBase!==pool.custodyBase)checks.push("pool_not_verified");
  const wallet=data.wallet;
  if (!wallet||wallet.source!=="amadeus_testnet_native_coin"||
      wallet.baseStatus!=="registered_chain_coin"||wallet.baseAtomic===null||
      !pool||pool.owner!==wallet.address)checks.push("inventory_not_independently_verified");
  const ref=data.reference;
  if (!ref||ref.source!=="independently_verified_oracle"||ref.independentlyVerified!==true||
      data.rootedHeight===null||ref.observedAtRootedHeight>data.rootedHeight||
      data.rootedHeight-ref.observedAtRootedHeight>20)checks.push("independent_reference_unavailable");
  const pnl=data.pnl;
  if (!pnl||pnl.source!=="finalized_native_receipts"||pnl.independentlyReconciled!==true||
      data.rootedHeight===null||pnl.observedAtRootedHeight>data.rootedHeight||
      data.rootedHeight-pnl.observedAtRootedHeight>20||
      !/^\d{4}-\d{2}-\d{2}$/.test(pnl.day)) checks.push("daily_pnl_unavailable");
  const hold=(extra?:string):AgentEvaluation=>({
    pair:(data.symbol+"/AMA") as AgentEvaluation["pair"],
    status:"hold",checks:extra?[...checks,extra]:checks,signal:null,
    snapshotHeight:data.rootedHeight,canSign:false,canBroadcast:false,
    executionApproved:false,decisionType:"read_only_analysis",
  });
  if(checks.length)return hold();
  if(!pool||!wallet||!ref||!pnl)return hold("incomplete_witness");

  try {
    const reserveBase=atomic(pool.reserveBase,"base_reserve");
    const reserveAma=atomic(pool.reserveAma,"ama_reserve");
    const base=atomic(wallet.baseAtomic,"base_inventory",true);
    const ama=atomic(wallet.amaAtomic,"ama_inventory",true);
    const referenceNum=atomic(ref.amaPerBaseNumerator,"reference_numerator");
    const referenceDen=atomic(ref.amaPerBaseDenominator,"reference_denominator");
    if (pool.totalLp==="0"||reserveBase===0n||reserveAma===0n)return hold("empty_pool");
    const actualValue=base*reserveAma/reserveBase;
    const totalValue=actualValue+ama;
    if(totalValue===0n)return hold("empty_inventory");
    const inventoryBps=actualValue*10000n/totalValue;
    const deviation=abs(reserveAma*referenceDen-referenceNum*reserveBase)*10000n/(referenceNum*reserveBase);
    if(deviation>BigInt(config.maxReferenceDivergenceBps))return hold("pool_reference_divergence");
    const realized=signedPnl(pnl.realizedAmaAtomic);
    if (realized<0n && -realized>=atomic(config.dailyLossCapAmaAtomic,"daily_loss_cap")) {
      return hold("daily_loss_limit_reached");
    }
    const maxPosition=atomic(config.maxPositionAmaAtomic,"max_position");
    const maxTrade=atomic(config.maxTradeAmaAtomic,"max_trade");
    const gas=atomic(config.gasReserveAmaAtomic,"gas_reserve");
    if (ama <= gas) return hold("gas_reserve_insufficient");
    const lower=BigInt(config.targetBaseBps-config.inventoryBandBps);
    const upper=BigInt(config.targetBaseBps+config.inventoryBandBps);
    if(inventoryBps>=lower&&inventoryBps<=upper)return hold("inventory_within_band");
    const side:SpotSide=inventoryBps<lower?"BUY":"SELL";
    if(side==="BUY"&&actualValue>=maxPosition)return hold("max_position_reached");
    // Exact pool utilization cap + owner's available native Coin inventory.
    const poolAmaLimit=reserveAma*BigInt(config.maxPoolUtilizationBps)/10000n;
    const amountAma=side==="BUY"
      ?min(min(maxTrade,ama>gas?ama-gas:0n),min(poolAmaLimit,maxPosition-actualValue))
      :min(min(maxTrade,actualValue),poolAmaLimit);
    if(amountAma<=0n)return hold("budget_or_gas_reserve_insufficient");
    const input=side==="BUY"?amountAma:min(base,amountAma*reserveBase/reserveAma);
    if(input<=0n)return hold("insufficient_base_atomic_inventory");
    const q=quoteNativeSpot(pool,side,String(input),config.maxSlippageBps);
    if(BigInt(q.effectivePriceImpactBps)>BigInt(config.maxSlippageBps))return hold("price_impact_exceeds_tolerance");
    // Target spread is a policy reference band, NOT a programmable AMM fee.
    const half=BigInt(config.targetSpreadBps)/2n;
    const bid=referenceNum*(10000n-half);
    const ask=referenceNum*(10000n+half);
    return {
      pair:pool.pair,status:"candidate_only",
      checks:["independent_sources_verified","not_authorized_for_execution"],
      signal:{
        direction:side,amountInAtomic:String(input),
        inputSymbol:side==="BUY"?"AMA":data.symbol,
        indicativeQuote:q,inventoryBaseBps:String(inventoryBps),
        poolReferenceDivergenceBps:String(deviation),
        indicativeBidAmaNumerator:String(bid),
        indicativeAskAmaNumerator:String(ask),
        indicativePriceDenominator:String(referenceDen*10000n),
      },
      snapshotHeight:data.rootedHeight,
      canSign:false,canBroadcast:false,executionApproved:false,
      decisionType:"read_only_analysis",
    };
  } catch {
    // Fail closed on impossible precision, overflow, math/dust or untrusted evidence.
    return hold("risk_calculation_unavailable");
  }
}
