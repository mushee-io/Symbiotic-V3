"use client";
import * as React from "react";

import { useCallback, useEffect, useState } from "react";
import type { AmadeusWalletProvider, WalletNetworkState } from "@/lib/amadeus-wallet";
import { buildNativeSpotIntent, type NativeSpotIntent } from "@/lib/spot/intent";
import type { NativeSpotQuote, SpotSide } from "@/lib/spot/quote";
import type { PoolSnapshot } from "@/lib/liquidity/read";

type PublicQuote = {
  network: "amadeus-testnet";
  status: "blocked" | "quoted_read_only";
  tradingEnabled: false;
  height?: number;
  quote: NativeSpotQuote | null;
  snapshot: PoolSnapshot | null;
  checkedAt?: string;
};

export function NativeSpotPanel({
  provider, account, network, rpcHealthy,
}: {
  provider: AmadeusWalletProvider | null;
  account: string | null;
  network: WalletNetworkState;
  rpcHealthy: boolean;
}) {
  const [base, setBase] = useState<"TESTBTC" | "TESTUSD">("TESTBTC");
  const [side, setSide] = useState<SpotSide>("BUY");
  const [amount, setAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState(50);
  const [quoted, setQuoted] = useState<PublicQuote | null>(null);
  const [intent, setIntent] = useState<NativeSpotIntent | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setQuoted(null);
    setIntent(null);
    setMessage("");
  }, [base, side, amount, slippageBps, account, network, rpcHealthy]);

  const urlFor = useCallback(() => {
    const params = new URLSearchParams({
      base, side, amount, slippageBps: String(slippageBps),
    });
    if (account) params.set("owner", account);
    return "/api/spot/quote?" + params.toString();
  }, [base, side, amount, slippageBps, account]);

  const fetchQuote = useCallback(async (): Promise<PublicQuote> => {
    const response = await fetch(urlFor(), { cache: "no-store" });
    const data: unknown = await response.json();
    if (!response.ok || !data || typeof data !== "object" ||
        !("network" in data) || data.network !== "amadeus-testnet" ||
        !("tradingEnabled" in data) || data.tradingEnabled !== false ||
        !("status" in data) || (data.status !== "quoted_read_only" && data.status !== "blocked") ||
        !("quote" in data) || !("snapshot" in data)) {
      throw new Error("native_quote_unavailable");
    }
    return data as PublicQuote;
  }, [urlFor]);

  const refresh = useCallback(async () => {
    if (!rpcHealthy || loading) return;
    setQuoted(null);
    setIntent(null);
    setMessage("");
    setLoading(true);
    try {
      const value = await fetchQuote();
      if (value.status === "quoted_read_only" && value.quote && value.snapshot &&
          Number.isSafeInteger(value.height) &&
          value.quote.pair === base + "/AMA" && value.quote.side === side &&
          value.quote.amountIn === amount) {
        setQuoted(value);
      } else {
        setMessage("No independently verified native pool liquidity exists for this market. No executable quote is available.");
      }
    } catch {
      setMessage("Real testnet quote unavailable. No simulated price or reserve has been substituted.");
    } finally {
      setLoading(false);
    }
  }, [rpcHealthy, loading, fetchQuote, base, side, amount]);

  const review = useCallback(async () => {
    if (!quoted?.quote || !quoted.snapshot || !account || network !== "testnet" || loading) return;
    setIntent(null);
    setMessage("");
    setLoading(true);
    try {
      // Verify a second independently read, fresh on-chain snapshot.
      const fresh = await fetchQuote();
      if (fresh.status !== "quoted_read_only" || !fresh.snapshot || !fresh.quote ||
          !Number.isSafeInteger(fresh.height) ||
          !Number.isSafeInteger(quoted.height)) {
        throw new Error("quote_not_live");
      }
      const next = buildNativeSpotIntent(
        fresh.snapshot, account, side, amount, slippageBps,
        quoted.height!, fresh.height!, fresh.height! + 20,
        quoted.quote,
      );
      setIntent(next);
      setMessage("Unsigned review prepared. Execution remains blocked until M3–M7 and native wallet attachment signing are verified.");
    } catch {
      setIntent(null);
      setQuoted(null);
      setMessage("Quote expired or changed, or signing/network prerequisites are missing. Refresh the on-chain quote.");
    } finally {
      setLoading(false);
    }
  }, [quoted, account, network, loading, fetchQuote, side, amount, slippageBps]);

  return (
    <section id="m8-spot" className="panel tokenPanel">
      <h3>M8 · Native AMA spot BUY / SELL</h3>
      <div className="swap">
        <p className="muted">
          On-chain reserve-backed quotes only. No manufactured prices, chart activity,
          swap fills, volumes or automatic trading.
        </p>
        <div className="walletActions">
          <button type="button" className="walletRefresh" aria-pressed={side === "BUY"}
            onClick={() => setSide("BUY")}>BUY with AMA</button>
          <button type="button" className="walletRefresh" aria-pressed={side === "SELL"}
            onClick={() => setSide("SELL")}>SELL for AMA</button>
        </div>
        <div className="walletLine">
          <label htmlFor="m8-base">Spot market</label>
          <select id="m8-base" value={base} onChange={e => setBase(e.target.value as "TESTBTC" | "TESTUSD")}>
            <option value="TESTBTC">TESTBTC/AMA</option>
            <option value="TESTUSD">TESTUSD/AMA</option>
          </select>
        </div>
        <div className="liquidityFields">
          <label htmlFor="m8-input">Pay amount — atomic {side === "BUY" ? "AMA" : base}
            <input id="m8-input" inputMode="numeric" value={amount}
              placeholder="Enter exact native atomic units"
              onChange={e => setAmount(e.target.value)} />
          </label>
          <label htmlFor="m8-slippage">Maximum slippage
            <select id="m8-slippage" value={slippageBps}
              onChange={e => setSlippageBps(Number(e.target.value))}>
              <option value={10}>0.10%</option>
              <option value={50}>0.50%</option>
              <option value={100}>1.00%</option>
              <option value={300}>3.00%</option>
              <option value={500}>5.00%</option>
            </select>
          </label>
        </div>
        <button type="button" className="walletRefresh" disabled={!rpcHealthy || loading || !/^[1-9][0-9]*$/.test(amount)}
          onClick={() => void refresh()}>
          {loading ? "Checking native testnet…" : "Get verified on-chain quote"}
        </button>
        <div className="walletLine">
          <span>Expected {side === "BUY" ? base : "AMA"}</span>
          <strong>{quoted?.quote ? quoted.quote.expectedOut + " atomic units" : "—"}</strong>
        </div>
        <div className="walletLine">
          <span>Minimum received</span>
          <strong>{quoted?.quote ? quoted.quote.minimumOut + " atomic units" : "—"}</strong>
        </div>
        <div className="walletLine">
          <span>AMM fee</span>
          <strong>{quoted?.quote ? "30 bps (0.30%)" : "—"}</strong>
        </div>
        <div className="walletLine">
          <span>Quote source</span>
          <strong>{quoted?.height !== undefined ? "Amadeus native testnet height " + quoted.height : "Unverified"}</strong>
        </div>
        <button type="button" className="walletRefresh"
          disabled={!quoted?.quote || !account || network !== "testnet" || loading}
          onClick={() => void review()}>
          Review wallet approval intent
        </button>
        {intent && <div className="note" role="status">
          <p>Unsigned native {intent.side} intention: {intent.pair}</p>
          <p>One Coin attachment: {intent.attachments[0].amount} atomic {intent.attachments[0].symbol}</p>
          <p>Method: {intent.method}({intent.args.join(", ")})</p>
          <p>Expected return {intent.expectedOut} atomic units, minimum {intent.minimumOut}.</p>
          <p>Expires at chain height {intent.deadlineHeight}. No wallet signature or transaction submitted.</p>
        </div>}
        {message && <p className="note" role="status">{message}</p>}
        <button className="walletConnect" type="button" disabled>
          Execute {side} — locked until M3–M7 live acceptance
        </button>
        <p className="note">
          The documented Amadeus extension cannot attest native testnet signing and
          attached Coin transfers for this flow. No private keys are requested.
          Spot swaps remain disabled; M8 must not claim executed trades or volumes.
          {provider && network === "testnet" ? " A wallet-reported testnet alone does not unlock trading." : ""}
        </p>
      </div>
    </section>
  );
}
