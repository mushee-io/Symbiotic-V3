"use client";

import { useCallback, useEffect, useState } from "react";
import type { AmadeusWalletProvider, WalletNetworkState } from "@/lib/amadeus-wallet";
import { signingReadiness } from "@/lib/amadeus-wallet";
import {
  M4_TEST_TOKENS, type M4Symbol, type TokenAvailability,
} from "@/lib/amadeus-tokens";
import {
  issuanceTestnetSdk, issueNativeTestToken,
} from "@/lib/amadeus-token-issuance";

type Status = { symbol: M4Symbol; status: TokenAvailability; supplyAtomic: string | null; pair: string };
type MintProof = { symbol: M4Symbol; hash: string; height: number; supplyAtomic: string; status: "finalized" };

export function TokenIssuancePanel({
  provider,
  account,
  network,
  rpcHealthy,
}: {
  provider: AmadeusWalletProvider | null;
  account: string | null;
  network: WalletNetworkState;
  rpcHealthy: boolean;
}) {
  const [tokens, setTokens] = useState<Status[]>([]);
  const [checking, setChecking] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [minting, setMinting] = useState<M4Symbol | null>(null);
  const [mintProof, setMintProof] = useState<MintProof | null>(null);
  const [mintError, setMintError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const canSign = signingReadiness(provider, account, network, rpcHealthy);

  useEffect(() => {
    if (!rpcHealthy) {
      setTokens([]);
      setStatusError("Native testnet RPC unavailable.");
      return;
    }
    const controller = new AbortController();
    let active = true;
    setChecking(true);
    setTokens([]);
    setStatusError("");
    void fetch("/api/tokens/status", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload: unknown = await response.json();
        if (!active) return;
        if (!response.ok || !payload || typeof payload !== "object" ||
            !("status" in payload) || payload.status !== "verified_state" ||
            !("tokens" in payload) || !Array.isArray(payload.tokens) ||
            payload.tokens.length !== 2) throw new Error("Unable to verify token registry");
        const rows = payload.tokens as Status[];
        if (rows.some((t) =>
          !M4_TEST_TOKENS.some((known) =>
            known.symbol === t.symbol && known.pair === t.pair &&
            (t.status === "registered" || t.status === "unregistered")
          ))) throw new Error("Unexpected chain token registry");
        setTokens(rows);
      })
      .catch(() => {
        if (!active) return;
        setTokens([]);
        setStatusError("Token registration cannot be verified. Creation blocked.");
      })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; controller.abort(); };
  }, [rpcHealthy, refresh]);

  useEffect(() => {
    setMintProof(null);
    setMintError("");
  }, [account, network]);

  const mint = useCallback(async (symbol: M4Symbol) => {
    if (!provider || !account || !canSign || minting || checking) return;
    if (tokens.find((t) => t.symbol === symbol)?.status !== "unregistered") return;
    setMinting(symbol);
    setMintProof(null);
    setMintError("");
    try {
      // Only a human click invokes the wallet extension approval dialog.
      const proof = await issueNativeTestToken({
        sdk: issuanceTestnetSdk(),
        provider,
        account,
        network,
        rpcHealthy,
      }, symbol);
      setMintProof(proof);
      setRefresh((n) => n + 1);
    } catch {
      // A timeout after submission is ambiguous; never blindly retry or fake a receipt.
      setMintError("Mint not verified. Check the wallet and testnet explorer before attempting another submission.");
      setRefresh((n) => n + 1);
    } finally {
      setMinting(null);
    }
  }, [provider, account, canSign, minting, checking, tokens, network, rpcHealthy]);

  return (
    <section className="panel tokenPanel" id="m4-tokens">
      <h3>M4 · Native test-token issuance</h3>
      <div className="swap">
        <p className="muted">
          Exactly two native Amadeus test assets. Both quote in AMA. Native
          token creation is separate from liquidity pools and spot trading.
        </p>
        {M4_TEST_TOKENS.map((token) => {
          const state = tokens.find((t) => t.symbol === token.symbol);
          const available = state?.status === "unregistered";
          const blocked = !canSign || !account || !available ||
            checking || Boolean(minting) || Boolean(statusError);
          return (
            <div className="tokenItem" key={token.symbol}>
              <div className="walletLine">
                <strong>{token.symbol} / AMA</strong>
                <span>{
                  checking ? "Checking on-chain…" :
                  statusError ? "Unavailable" :
                  state?.status === "registered" ? "Already registered" :
                  state?.status === "unregistered" ? "No Coin registry entry" :
                  "Not verified"
                }</span>
              </div>
              <p className="muted walletCaption">
                {token.name} · initial supply {token.supply} · {token.decimals} decimals
                · fixed supply · issuer retains permission · no further minting
              </p>
              <button
                type="button"
                className="walletConnect"
                disabled={blocked}
                onClick={() => void mint(token.symbol)}
              >
                {minting === token.symbol ? "Waiting for finality…" :
                  "Approve & mint " + token.symbol}
              </button>
            </div>
          );
        })}
        <div className="walletActions">
          <button className="walletRefresh" type="button" disabled={checking || Boolean(minting)}
            onClick={() => setRefresh((n) => n + 1)}>Refresh token registry</button>
        </div>
        {mintProof && (
          <p className="walletSuccess" role="status">
            Verified finalized native mint for {mintProof.symbol} at height {mintProof.height}.
            Transaction hash: <code>{mintProof.hash}</code>.
          </p>
        )}
        {mintError && <p className="walletError" role="alert">{mintError}</p>}
        {statusError && <p className="walletError" role="status">{statusError}</p>}
        <p className="note">
          {!account ? "Connect your Amadeus wallet to inspect readiness. " :
            !canSign ? "Wallet signing network is not independently attested as testnet; mint approval is blocked. " :
              "Only click an eligible mint button if you intend to issue the selected native test token. "}
          A registered symbol may belong to another issuer. No mainnet fallback,
          no fabricated mint receipts. AMA-paired swaps remain disabled until M8.
        </p>
      </div>
    </section>
  );
}
