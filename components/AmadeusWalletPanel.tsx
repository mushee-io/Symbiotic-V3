"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AMADEUS_EXTENSION_URL,
  accountFromWalletEvent,
  checkWalletNetwork,
  findAmadeusProvider,
  requestAmaAccount,
  signingReadiness,
  type AmadeusWalletProvider,
  type WalletNetworkState,
} from "@/lib/amadeus-wallet";
import { TokenIssuancePanel } from "@/components/TokenIssuancePanel";
import { NativeSpotPanel } from "@/components/NativeSpotPanel";
import { NativeLiquidityPanel } from "@/components/NativeLiquidityPanel";

type BalanceResult = { amount: string; checkedAt: string; address: string };
type BalanceStatus = "idle" | "loading" | "ready" | "error";

function detectInjectedWallet(): AmadeusWalletProvider | null {
  if (typeof window === "undefined") return null;
  return findAmadeusProvider(
    (window as Window & { amadeus?: unknown }).amadeus
  );
}

export function AmadeusWalletPanel({ rpcHealthy }: { rpcHealthy: boolean }) {
  const [provider, setProvider] = useState<AmadeusWalletProvider | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [network, setNetwork] = useState<WalletNetworkState>("unverified");
  const [busy, setBusy] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState("");
  const [balance, setBalance] = useState<BalanceResult | null>(null);
  const [balanceStatus, setBalanceStatus] = useState<BalanceStatus>("idle");
  const [balanceRefresh, setBalanceRefresh] = useState(0);
  const connectionEpoch = useRef(0);

  useEffect(() => {
    // Discovery never requests account permission. Only the Connect button does.
    const detect = () => setProvider(detectInjectedWallet());
    detect();
    window.addEventListener("amadeus#initialized", detect);
    return () => window.removeEventListener("amadeus#initialized", detect);
  }, []);

  useEffect(() => {
    if (!provider || typeof provider.on !== "function") return;
    const onAccount = (value: unknown) => {
      if (!account) return; // Do not implicitly reconnect after local disconnect.
      const next = accountFromWalletEvent(value);
      const epoch = ++connectionEpoch.current;
      setAccount(next);
      setNetwork("unverified");
      setConnectionMessage(next ? "" : "Wallet disconnected or locked.");
      setBalance(null);
      if (next) void checkWalletNetwork(provider).then((result) => {
        if (connectionEpoch.current === epoch) setNetwork(result);
      });
    };
    const onDisconnect = () => {
      connectionEpoch.current += 1;
      setAccount(null);
      setNetwork("unverified");
      setBalance(null);
      setConnectionMessage("Wallet disconnected.");
    };
    provider.on("accountsChanged", onAccount);
    provider.on("disconnect", onDisconnect);
    return () => {
      if (typeof provider.off === "function") {
        provider.off("accountsChanged", onAccount);
        provider.off("disconnect", onDisconnect);
      } else if (typeof provider.removeListener === "function") {
        provider.removeListener("accountsChanged", onAccount);
        provider.removeListener("disconnect", onDisconnect);
      }
    };
  }, [provider, account]);

  const connect = useCallback(async () => {
    if (!provider || busy) return;
    const epoch = ++connectionEpoch.current;
    setBusy(true);
    setConnectionMessage("");
    try {
      const approvedAccount = await requestAmaAccount(provider);
      const selectedNetwork = await checkWalletNetwork(provider);
      if (connectionEpoch.current !== epoch) return;
      setAccount(approvedAccount);
      setNetwork(selectedNetwork);
    } catch {
      if (connectionEpoch.current !== epoch) return;
      setAccount(null);
      setNetwork("unverified");
      setConnectionMessage("Wallet connection was rejected or no valid account was returned.");
    } finally {
      setBusy(false);
    }
  }, [provider, busy]);

  const disconnect = useCallback(() => {
    connectionEpoch.current += 1;
    setAccount(null);
    setNetwork("unverified");
    setBalance(null);
    setConnectionMessage("Disconnected in Symbiotic V3. Revoke this site's permission in the wallet extension if needed.");
  }, []);

  useEffect(() => {
    if (!account || !rpcHealthy) {
      setBalance(null);
      setBalanceStatus("idle");
      return;
    }
    let active = true;
    const controller = new AbortController();
    setBalance(null);
    setBalanceStatus("loading");
    void fetch("/api/wallet/balance?address=" + encodeURIComponent(account), {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const data: unknown = await response.json();
        if (!active) return;
        if (!response.ok ||
          !data || typeof data !== "object" ||
          !("amount" in data) || typeof data.amount !== "string" ||
          !("address" in data) || data.address !== account ||
          !("network" in data) || data.network !== "amadeus-testnet"
        ) {
          throw new Error("No verified AMA balance");
        }
        const parsed: BalanceResult = {
          amount: data.amount,
          address: account,
          checkedAt: "checkedAt" in data && typeof data.checkedAt === "string"
            ? data.checkedAt
            : "",
        };
        setBalance(parsed);
        setBalanceStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setBalance(null);
        setBalanceStatus("error");
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [account, rpcHealthy, balanceRefresh]);

  const canSign = signingReadiness(provider, account, network, rpcHealthy);
  const signerDetected = typeof provider?.signTransaction === "function";

  return (
    <section id="wallet-panel" className="panel walletPanel">
      <h3>Native AMA Wallet · Testnet</h3>
      <div className="swap">
        <p className="muted">
          Connect the official Amadeus extension. Public balances are read from
          Amadeus testnet only; spot trading remains disabled.
        </p>
        {!provider && (
          <p className="note">
            Extension not detected.{" "}
            <a href={AMADEUS_EXTENSION_URL} target="_blank" rel="noopener noreferrer">
              Install Amadeus Wallet
            </a>
          </p>
        )}
        <div className="walletActions">
          {!account ? (
            <button
              type="button"
              className="walletConnect"
              disabled={!provider || busy}
              onClick={() => void connect()}
            >
              {busy ? "Waiting for wallet approval…" : "Connect AMA Wallet"}
            </button>
          ) : (
            <button type="button" className="walletDisconnect" onClick={disconnect}>
              Disconnect
            </button>
          )}
          {account && rpcHealthy && (
            <button
              type="button"
              className="walletRefresh"
              onClick={() => setBalanceRefresh((x) => x + 1)}
              disabled={balanceStatus === "loading"}
            >
              Refresh balance
            </button>
          )}
        </div>
        {connectionMessage && <p className="walletError" role="alert">{connectionMessage}</p>}
        {account && <>
          <div className="walletLine">
            <span>Public account</span>
            <code title={account}>{account.slice(0, 11)}…{account.slice(-8)}</code>
          </div>
          <div className="walletLine">
            <span>Testnet AMA balance</span>
            <strong>
              {!rpcHealthy ? "RPC unavailable" :
              balanceStatus === "loading" ? "Loading…" :
              balanceStatus === "error" ? "Unavailable" :
              balance ? balance.amount + " AMA" : "—"}
            </strong>
          </div>
          <div className="walletLine">
            <span>Wallet network</span>
            <strong className={network === "testnet" ? "accent" : ""}>
              {network === "testnet" ? "Testnet (wallet-reported)" :
                network === "wrong_network" ? "Wrong network" :
                "Unverified by extension"}
            </strong>
          </div>
          <div className="walletLine">
            <span>Signing approval API</span>
            <strong>{signerDetected ? "Detected" : "Unavailable"}</strong>
          </div>
          <p className="note">
            {network === "unverified"
              ? "The documented extension API does not provide a network query. We cannot verify its signing network, so signing remains blocked."
              : network === "wrong_network"
              ? "Your wallet reports a different network. Switch to Amadeus testnet before future signing."
              : "Provider reports testnet. Test-token issuance requires a separate explicit wallet approval."}
          </p>
          <p className="muted walletCaption">
            Wallet-signing readiness: {canSign ? "Prerequisites met; trading remains disabled" : "Blocked"}
            . No secret keys, transactions, or signatures are requested.
          </p>
        </>}
      </div>
      <TokenIssuancePanel provider={provider} account={account} network={network} rpcHealthy={rpcHealthy} />
      <NativeLiquidityPanel provider={provider} account={account} network={network} rpcHealthy={rpcHealthy} />
      <NativeSpotPanel provider={provider} account={account} network={network} rpcHealthy={rpcHealthy} />
    </section>
  );
}
