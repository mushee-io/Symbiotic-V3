"use client";

import { useCallback, useEffect, useState } from "react";
import {
  buildAddLiquidityIntent, buildRemoveLiquidityIntent, type LiquidityIntent,
} from "@/lib/liquidity/intent";
import type { PoolSnapshot } from "@/lib/liquidity/read";
import type { M4Symbol } from "@/lib/amadeus-tokens";
import type { AmadeusWalletProvider, WalletNetworkState } from "@/lib/amadeus-wallet";

type PoolRow = {
  symbol: M4Symbol;
  pair: string;
  status: "blocked" | "reconciled";
  reason: string | null;
  state: PoolSnapshot | null;
};
type ReadOnlyStatus = {
  network: string;
  status: string;
  height?: number;
  pools: PoolRow[];
  tradingEnabled: false;
  liquidityEnabled: false;
};

export function NativeLiquidityPanel({
  provider, account, network, rpcHealthy,
}: {
  provider: AmadeusWalletProvider | null;
  account: string | null;
  network: WalletNetworkState;
  rpcHealthy: boolean;
}) {
  const [pair, setPair] = useState<M4Symbol>("TESTBTC");
  const [mode, setMode] = useState<"add" | "remove">("add");
  const [baseAmount, setBaseAmount] = useState("");
  const [amaAmount, setAmaAmount] = useState("");
  const [minLp, setMinLp] = useState("");
  const [shares, setShares] = useState("");
  const [minBase, setMinBase] = useState("");
  const [minAma, setMinAma] = useState("");
  const [status, setStatus] = useState<ReadOnlyStatus | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [preview, setPreview] = useState<LiquidityIntent | null>(null);

  useEffect(() => {
    setPreview(null);
    setStatus(null);
    if (!rpcHealthy) {
      setError("Amadeus testnet RPC is unavailable.");
      return;
    }
    let active = true;
    const controller = new AbortController();
    setError("");
    void fetch("/api/liquidity/status" + (account ? "?owner=" + encodeURIComponent(account) : ""), {
      cache: "no-store", signal: controller.signal,
    }).then(async (response) => {
      const value: unknown = await response.json();
      if (!active) return;
      if (!response.ok || !value || typeof value !== "object" ||
          !("network" in value) || value.network !== "amadeus-testnet" ||
          !("pools" in value) || !Array.isArray(value.pools) ||
          !("tradingEnabled" in value) || value.tradingEnabled !== false ||
          !("liquidityEnabled" in value) || value.liquidityEnabled !== false) {
        throw Error("native_pool_read_unavailable");
      }
      const result = value as ReadOnlyStatus;
      if (result.pools.length !== 2 ||
          !["TESTBTC", "TESTUSD"].every((symbol) =>
            result.pools.some((p) => p.symbol === symbol && p.pair === symbol + "/AMA" &&
              (p.status === "blocked" || p.status === "reconciled")))) {
        throw Error("unexpected_pool_status");
      }
      setStatus(result);
    }).catch(() => {
      if (!active) return;
      setStatus(null);
      setError("Native testnet pool state could not be independently verified.");
    });
    return () => { active = false; controller.abort(); };
  }, [account, rpcHealthy, refresh]);

  useEffect(() => setPreview(null), [account, network, pair, mode]);

  const current = status?.pools.find((p) => p.symbol === pair) ?? null;
  const state = current?.status === "reconciled" ? current.state : null;
  const prepare = useCallback(() => {
    setPreview(null);
    if (!state || !account || !status?.height || !Number.isSafeInteger(status.height)) {
      setError("Pool and wallet state must both be verified.");
      return;
    }
    try {
      const expiration = status.height + 20;
      const intent = mode === "add"
        ? buildAddLiquidityIntent(state, account, baseAmount, amaAmount, minLp, status.height, expiration)
        : buildRemoveLiquidityIntent(state, account, shares, minBase, minAma, status.height, expiration);
      setPreview(intent);
      setError("");
    } catch {
      setError("Invalid liquidity inputs or expired/unverified on-chain state. No transaction was made.");
    }
  }, [state, account, status, mode, baseAmount, amaAmount, minLp, shares, minBase, minAma]);

  return (
    <section className="panel tokenPanel" id="m7-liquidity">
      <h3>M7 · Native AMA liquidity</h3>
      <div className="swap">
        <p className="muted">Only TESTBTC/AMA and TESTUSD/AMA. Read-only native storage and custody checks; no simulated reserves or liquidity.</p>
        <div className="walletLine">
          <span>Market</span>
          <select value={pair} onChange={(e) => setPair(e.target.value as M4Symbol)} aria-label="Liquidity market">
            <option value="TESTBTC">TESTBTC/AMA</option>
            <option value="TESTUSD">TESTUSD/AMA</option>
          </select>
        </div>
        <div className="walletLine">
          <span>On-chain pool</span>
          <strong>{current?.status === "reconciled" ? "Custody reconciled" : "Not verified / not deployed"}</strong>
        </div>
        <div className="walletLine">
          <span>Verified base reserves</span>
          <strong>{state ? state.reserveBase + " atomic " + pair : "—"}</strong>
        </div>
        <div className="walletLine">
          <span>Verified AMA reserves</span>
          <strong>{state ? state.reserveAma + " atomic AMA" : "—"}</strong>
        </div>
        <div className="walletLine">
          <span>Your verified LP shares</span>
          <strong>{state?.ownerLp ?? "—"}</strong>
        </div>
        <div className="walletLine">
          <span>Swap trading</span>
          <strong>Disabled until M8</strong>
        </div>
        <div className="walletActions">
          <button type="button" className="walletRefresh" onClick={() => setRefresh((n) => n + 1)}>
            Refresh live state
          </button>
        </div>
        <div className="walletActions">
          <button type="button" className="walletRefresh" onClick={() => setMode("add")} aria-pressed={mode === "add"}>Add liquidity</button>
          <button type="button" className="walletRefresh" onClick={() => setMode("remove")} aria-pressed={mode === "remove"}>Remove liquidity</button>
        </div>
        {mode === "add" ? (
          <div className="liquidityFields">
            <label>Base token deposit (atomic units)<input value={baseAmount} onChange={(e) => setBaseAmount(e.target.value)} inputMode="numeric" placeholder="Unverified until contract deployment"/></label>
            <label>AMA deposit (atomic units)<input value={amaAmount} onChange={(e) => setAmaAmount(e.target.value)} inputMode="numeric" placeholder="Actual AMA required"/></label>
            <label>Minimum LP shares<input value={minLp} onChange={(e) => setMinLp(e.target.value)} inputMode="numeric" placeholder="Slippage protection"/></label>
          </div>
        ) : (
          <div className="liquidityFields">
            <label>LP shares to burn<input value={shares} onChange={(e) => setShares(e.target.value)} inputMode="numeric" placeholder="Only your owned shares"/></label>
            <label>Minimum base received (atomic)<input value={minBase} onChange={(e) => setMinBase(e.target.value)} inputMode="numeric" placeholder="Slippage protection"/></label>
            <label>Minimum AMA received (atomic)<input value={minAma} onChange={(e) => setMinAma(e.target.value)} inputMode="numeric" placeholder="Slippage protection"/></label>
          </div>
        )}
        <button type="button" className="walletConnect" disabled={!state || !account || !status?.height} onClick={prepare}>
          Review native {mode === "add" ? "deposit" : "withdrawal"} intent
        </button>
        {preview && <div className="note" role="status">
          <p>Unsigned review only: {preview.method} on {preview.pair}.</p>
          <p>Method arguments: {preview.args.join(", ")}</p>
          <p>Coin attachments: {preview.attachments.length ? preview.attachments.map((a) => a.amount + " atomic " + a.symbol).join(" + ") : "None (LP withdrawal)"}</p>
          <p>Expected base: {preview.expected.base}; AMA: {preview.expected.ama}; LP: {preview.expected.lp}.</p>
          <p>Wallet approval and broadcast remain blocked until native attachment-signing support and M3/M4/M6 acceptance are independently verified.</p>
        </div>}
        {error && <p className="walletError" role="alert">{error}</p>}
        <p className="note">Pool status is read from real Amadeus native contract views and actual Coin custody when deployed. No approved deployed pools are recorded. Current wallet extension signing does not document native Coin attachments; no liquidity transaction can be submitted. {provider && network === "testnet" ? "A testnet-reported wallet alone is insufficient." : "Wallet signing network is not independently verified."}</p>
      </div>
    </section>
  );
}
