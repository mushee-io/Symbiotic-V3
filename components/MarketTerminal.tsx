"use client";

import {useCallback,useEffect,useState} from "react";
import type {NativeTerminalData} from "@/lib/terminal/read";
import type {NativeSpotQuote,SpotSide} from "@/lib/spot/quote";

type TerminalResponse = {
  network:"amadeus-testnet";
  status:"blocked" | "read_only";
  market:NativeTerminalData;
  tradingEnabled:false;
};
type QuoteResponse = {
  network:"amadeus-testnet";
  status:"blocked" | "quoted_read_only";
  quote:NativeSpotQuote|null;
  snapshot:unknown|null;
  height?:number;
  tradingEnabled:false;
};

export function MarketTerminal({
  base,account,rpcHealthy,
}:{
  base:"TESTBTC"|"TESTUSD";
  account:string|null;
  rpcHealthy:boolean;
}){
  const [market,setMarket]=useState<NativeTerminalData|null>(null);
  const [status,setStatus]=useState<"loading"|"ready"|"blocked"|"unavailable">("loading");
  const [refreshKey,setRefreshKey]=useState(0);
  const [side,setSide]=useState<SpotSide>("BUY");
  const [amount,setAmount]=useState("");
  const [slippage,setSlippage]=useState(50);
  const [quote,setQuote]=useState<NativeSpotQuote|null>(null);
  const [quoteMessage,setQuoteMessage]=useState("");
  const [quoteBusy,setQuoteBusy]=useState(false);

  useEffect(()=>{
    let active=true;
    const controller=new AbortController();
    setMarket(null);
    setQuote(null);
    setQuoteMessage("");
    if(!rpcHealthy){
      setStatus("unavailable");
      return ()=>{active=false;controller.abort()};
    }
    setStatus("loading");
    const q=new URLSearchParams({base});
    if(account)q.set("owner",account);
    void fetch("/api/terminal/status?"+q.toString(),{
      cache:"no-store",signal:controller.signal,
    }).then(async response=>{
      const data:unknown=await response.json();
      if(!active)return;
      if(!response.ok || !data || typeof data!=="object" ||
          !("network" in data) || data.network!=="amadeus-testnet" ||
          !("tradingEnabled" in data) || data.tradingEnabled!==false ||
          !("status" in data) || (data.status!=="blocked"&&data.status!=="read_only") ||
          !("market" in data) || !data.market || typeof data.market!=="object") {
        throw Error("native_market_unavailable");
      }
      const value=data as TerminalResponse;
      if(value.market.pair!==base+"/AMA" || value.market.symbol!==base ||
          value.market.network!=="amadeus-testnet" ||
          (value.market.wallet?.address??null)!==(account??null) ||
          value.market.tradingEnabled!==false ||
          value.market.chart!==null) throw Error("unexpected_native_market_data");
      setMarket(value.market);
      setStatus(value.status==="blocked"?"blocked":"ready");
    }).catch(()=>{
      if(active){setMarket(null);setStatus("unavailable");}
    });
    return ()=>{active=false;controller.abort()};
  },[base,account,rpcHealthy,refreshKey]);

  useEffect(()=>{setQuote(null);setQuoteMessage("");},[base,account,side,amount,slippage]);

  const getQuote=useCallback(async()=>{
    setQuote(null);
    setQuoteMessage("");
    if(!market?.pool || !rpcHealthy || quoteBusy)return;
    setQuoteBusy(true);
    const query=new URLSearchParams({
      base,side,amount,slippageBps:String(slippage),
    });
    if(account)query.set("owner",account);
    try{
      const r=await fetch("/api/spot/quote?"+query.toString(),{cache:"no-store"});
      const v:unknown=await r.json();
      if(!r.ok || !v || typeof v!=="object" ||
          !("network" in v) || v.network!=="amadeus-testnet" ||
          !("status" in v) || v.status!=="quoted_read_only" ||
          !("tradingEnabled" in v) || v.tradingEnabled!==false ||
          !("quote" in v) || !v.quote || typeof v.quote!=="object") throw Error("quote_not_finalized");
      const data=v as QuoteResponse;
      if(!data.quote || data.quote.pair!==base+"/AMA" ||
          data.quote.side!==side || data.quote.amountIn!==amount ||
          data.quote.poolAddress!==market.pool.address)throw Error("quote_mismatch");
      setQuote(data.quote);
    }catch{
      setQuote(null);
      setQuoteMessage("No verified, current reserve-backed quote. Check liquidity and refresh.");
    }finally{setQuoteBusy(false);}
  },[market,rpcHealthy,quoteBusy,base,side,amount,slippage,account]);

  const balance=market?.wallet;
  const pool=market?.pool;
  const txs=market?.history ?? null;
  return <section className="panel terminalPanel" id="m9-terminal">
    <div className="terminalHeader">
      <div>
        <p className="eyebrow">M9 · ON-CHAIN SPOT TERMINAL</p>
        <h2>{base} <span className="muted">/ AMA</span></h2>
      </div>
      <button type="button" className="walletRefresh"
        disabled={status==="loading"}
        onClick={()=>setRefreshKey(i=>i+1)}>Refresh native data</button>
    </div>
    <div className="terminalMeta" role="status" aria-live="polite">
      {status==="loading"?"Reading native Amadeus testnet…":
       status==="unavailable"?"RPC or native data unavailable — no values shown":
       status==="blocked"?"Read-only · contract/liquidity not independently verified":
       "Read-only · reserve and Coin custody verified"}
      {market?.health&&" · Tip "+market.health.height+" · Rooted "+market.health.rootedHeight}
    </div>
    <div className="terminalMetrics">
      <div><small>Pool BASE reserve</small><strong>{pool?pool.reserveBase+" atomic "+base:"—"}</strong></div>
      <div><small>Pool AMA reserve</small><strong>{pool?pool.reserveAma+" atomic AMA":"—"}</strong></div>
      <div><small>Current pool status</small><strong>{pool?"Verified custody":"Unavailable"}</strong></div>
      <div><small>Token registration</small><strong>{market?.token.status??"Unverified"}</strong></div>
    </div>
    <div className="terminalChartPlaceholder" role="status">
      <div className="eyebrow">HISTORICAL PRICE CHART</div>
      <strong>No independently verified historical reserve series</strong>
      <p>Charts will appear only when genuine archived testnet reserve observations are available. No synthetic candles or volume.</p>
    </div>
    <div className="terminalBalances">
      <h3>Public wallet balances</h3>
      {!account?<p className="muted terminalInset">Connect an Amadeus public wallet to read its real Coin holdings.</p>:
       !balance?<p className="muted terminalInset">Wallet balances unavailable. No inferred zero balances.</p>:
       <div className="terminalMetrics">
         <div><small>AMA native Coin</small><strong>{balance.amaAtomic} atomic AMA</strong></div>
         <div><small>{base} native Coin</small><strong>{balance.baseAtomic===null?"Not issued / unavailable":balance.baseAtomic+" atomic "+base}</strong></div>
       </div>}
      {balance&&<p className="terminalInset muted">Chain-reported holdings only; testnet token ownership and any market value are not implied.</p>}
    </div>
    <div className="terminalQuote">
      <h3>Reserve-backed exact-input quote</h3>
      <p className="muted terminalInset">Read-only quote, 30 bps swap fee. Signing and broadcasts remain disabled.</p>
      <div className="terminalForm">
        <label>Direction
          <select value={side} onChange={e=>setSide(e.target.value as SpotSide)}>
            <option value="BUY">BUY {base} with AMA</option>
            <option value="SELL">SELL {base} for AMA</option>
          </select>
        </label>
        <label>Amount (atomic {side==="BUY"?"AMA":base})
          <input inputMode="numeric" placeholder="Exact atomic amount" value={amount} onChange={e=>setAmount(e.target.value)}/>
        </label>
        <label>Slippage
          <select value={slippage} onChange={e=>setSlippage(Number(e.target.value))}>
            <option value={10}>0.10%</option>
            <option value={50}>0.50%</option>
            <option value={100}>1.00%</option>
            <option value={300}>3.00%</option>
            <option value={500}>5.00%</option>
          </select>
        </label>
      </div>
      <div className="terminalActions">
        <button type="button" className="walletRefresh" onClick={()=>void getQuote()}
          disabled={!pool || quoteBusy || !/^[1-9][0-9]*$/.test(amount)}>
          {quoteBusy?"Verifying…":"Get on-chain quote"}
        </button>
        <button type="button" disabled className="walletConnect">Execute swap — locked</button>
      </div>
      <div className="terminalMetrics">
        <div><small>Receive (expected)</small><strong>{quote?quote.expectedOut+" atomic "+quote.outputSymbol:"—"}</strong></div>
        <div><small>Minimum received</small><strong>{quote?quote.minimumOut+" atomic "+quote.outputSymbol:"—"}</strong></div>
      </div>
      {quoteMessage&&<p className="walletError" role="alert">{quoteMessage}</p>}
    </div>
    <div className="terminalHistory">
      <h3>Finalized native swap calls</h3>
      {!account?<p className="terminalInset muted">Connect a wallet to query its on-chain testnet transaction history.</p>:
       !pool || txs===null?<p className="terminalInset muted">History unavailable until the native pool and wallet are verified. No invented transactions.</p>:
       txs.length===0?<p className="terminalInset muted">No independently verified finalized swap calls were found for this wallet.</p>:
       <div className="terminalTxList">
         {txs.map(tx=><article key={tx.hash}>
           <div className="terminalTxTop">
             <strong>{tx.side} · {tx.pair}</strong>
             <small>Finalized · height {tx.height}</small>
           </div>
           <p>{tx.amountInAtomic} atomic {tx.attachedSymbol} sent · minimum output {tx.minimumOutAtomic} atomic units</p>
           <small>Actual output and trade value not independently reconciled</small>
           <a href={tx.explorerUrl} target="_blank" rel="noopener noreferrer">View verified tx on Amadeus testnet explorer</a>
         </article>)}
       </div>}
    </div>
    <p className="terminalFooter">M3/M4/M6/M7/M8 live acceptance remains open. No artificial token prices, volume or trading history. AMA is the only quote currency.</p>
  </section>;
}
