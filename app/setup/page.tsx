"use client";
import * as React from "react";
import { useEffect, useState } from "react";
import { TESTNET_FAUCET_URL } from "@amadeus-protocol/sdk";
import { AmadeusWalletPanel } from "@/components/AmadeusWalletPanel";

export default function NativeTestnetSetup(){
  const [healthy,setHealthy]=useState(false);
  const [status,setStatus]=useState<"checking"|"connected"|"unavailable">("checking");
  const [height,setHeight]=useState<number|null>(null);
  const [refresh,setRefresh]=useState(0);
  const [account,setAccount]=useState<string|null>(null);
  useEffect(()=>{
    const controller=new AbortController();
    let active=true;
    setHealthy(false);setStatus("checking");setHeight(null);
    void fetch("/api/network",{cache:"no-store",signal:controller.signal})
      .then(async r=>{
        const v:unknown=await r.json();
        if(!active)return;
        if(!r.ok || !v || typeof v!=="object" || !("network" in v) ||
          v.network!=="amadeus-testnet" || !("status" in v) ||
          v.status!=="connected" || !("height" in v) ||
          !Number.isSafeInteger(v.height) || typeof v.height!=="number"){
          throw Error("unverified_native_rpc");
        }
        setHeight(v.height);setHealthy(true);setStatus("connected");
      })
      .catch(()=>{if(active){setHealthy(false);setStatus("unavailable");setHeight(null);}});
    return()=>{active=false;controller.abort();};
  },[refresh]);

  return <div className="nativeSetupPage">
    <header className="nativeSetupHeader">
      <a href="/" className="nativeSetupBrand">SYMBIOTIC <b>V3</b></a>
      <nav aria-label="Testnet setup navigation">
        <a href="/">Home</a><a href="/trade">Trade</a><a href="/demo">Readiness</a>
      </nav>
      <a className="nativeSetupTrade" href="/trade">Open trading terminal ↗</a>
    </header>
    <main className="nativeSetupMain">
      <div className="nativeSetupIntro">
        <span className="eyebrow">AMA NATIVE / USER-APPROVED / PUBLIC TESTNET</span>
        <h1>Make the testnet<br/><span>real.</span></h1>
        <p>Connect the official Amadeus wallet, verify your public AMA balance and, if eligible, authorize the creation of the two experimental native Coin assets. No private key or seed is requested.</p>
      </div>
      <section className="nativeSetupSteps" aria-label="Native testnet onboarding and acceptance">
        <article>
          <small>01 / WALLET</small><h2>Connect AMA wallet</h2>
          <p>The extension approval is manual. Confirm Testnet in the wallet settings. Connection alone is not proof that transaction signing uses the testnet domain.</p>
        </article>
        <article>
          <small>02 / TESTNET AMA</small><h2>Fund your test wallet</h2>
          <p>Use the officially listed Amadeus testnet faucet if your wallet has no test AMA. Never use mainnet funds or import your seed into Symbiotic.</p>
          <a href={TESTNET_FAUCET_URL} target="_blank" rel="noopener noreferrer">Official testnet faucet ↗</a>
        </article>
        <article>
          <small>03 / NATIVE MINT</small><h2>Verify and mint</h2>
          <p>TESTBTC and TESTUSD are fixed-supply experimental test tokens. Only an exact TESTNET-domain BLS signature is ever submitted; the wallet must show a user-approval prompt.</p>
        </article>
      </section>
      <section className="nativeSetupRpc" aria-label="Live native RPC status" role="status">
        <div><span className={healthy?"exLed":"exLed exLedOff"} aria-hidden="true"/><strong>{
          status==="connected"?"Amadeus public testnet connected":
          status==="checking"?"Checking public Amadeus testnet…":
          "Native RPC not verified — no transactions permitted"
        }</strong></div>
        <span>{height===null?"No verified block height":"Tip #"+height.toLocaleString("en-US")}</span>
        <button type="button" disabled={status==="checking"} onClick={()=>setRefresh(x=>x+1)}>Recheck network ↻</button>
      </section>
      <div className="nativeSetupWallet">
        <AmadeusWalletPanel rpcHealthy={healthy} onAccountChange={setAccount}/>
      </div>
      <section className="nativeSetupPending">
        <h2>What still needs independent testnet acceptance</h2>
        <div><span>M3</span><p><strong>Two distinct real wallet witnesses</strong> — one approved account or minted token cannot certify two-wallet behavior.</p></div>
        <div><span>M6</span><p><strong>Native pool deployment</strong> — real, authenticated pair-specific RISC-V deployment and initialization receipts.</p></div>
        <div><span>M7</span><p><strong>Actual funded liquidity</strong> — wallet-approved Coin attachments, custody and LP balance reconciliation.</p></div>
        <div><span>M8</span><p><strong>Four finalized swaps</strong> — genuine BUY and SELL receipts across both AMA pairs, with reserve and wallet delta evidence.</p></div>
        <p>Current wallet: {account?account.slice(0,10)+"…"+account.slice(-7):"Not connected"}. No automatic signing, pooling or trading is enabled by this setup page.</p>
        <a href="/demo">See complete public readiness ↗</a>
      </section>
    </main>
  </div>;
}
