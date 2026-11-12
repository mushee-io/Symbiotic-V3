"use client";
import * as React from "react";

import {useCallback,useEffect,useRef,useState} from "react";
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
  const [bottomTab,setBottomTab]=useState<"activity"|"balances"|"pool">("activity");
  const quoteEpoch=useRef(0);

  useEffect(()=>{
    let active=true;
    const controller=new AbortController();
    setMarket(null);
    quoteEpoch.current += 1;
    setQuote(null);
    setQuoteBusy(false);
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

  useEffect(()=>{quoteEpoch.current+=1;setQuote(null);setQuoteBusy(false);setQuoteMessage("");},[base,account,side,amount,slippage]);

  const getQuote=useCallback(async()=>{
    setQuote(null);
    setQuoteMessage("");
    if(!market?.pool || !rpcHealthy || quoteBusy)return;
    setQuoteBusy(true);
    const currentQuoteEpoch=++quoteEpoch.current;
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
      if(currentQuoteEpoch===quoteEpoch.current)setQuote(data.quote);
    }catch{
      if(currentQuoteEpoch===quoteEpoch.current){
        setQuote(null);
        setQuoteMessage("No verified, current reserve-backed quote. Check liquidity and refresh.");
      }
    }finally{
      if(currentQuoteEpoch===quoteEpoch.current)setQuoteBusy(false);
    }
  },[market,rpcHealthy,quoteBusy,base,side,amount,slippage,account]);

  const balance=market?.wallet;
  const pool=market?.pool;
  const txs=market?.history ?? null;
  const marketStatus=status==="ready"?"Pool custody verified":
    status==="blocked"?"Awaiting verified liquidity":
    status==="loading"?"Checking chain state…":"Chain data unavailable";
  return <section className="exTerminal" id="m9-terminal" aria-label="Native Amadeus spot terminal">
    <div className="exPairBar">
      <div className="exPairIdentity">
        <span className="exPairCoin" aria-hidden="true">{base==="TESTBTC"?"TB":"TU"}</span>
        <div><h1>{base}<span>/AMA</span></h1><small>Native AMM · Spot</small></div>
      </div>
      <div className="exPairLast"><span>Last price</span><strong>—</strong><small>No verified price</small></div>
      <div className="exPairStat"><span>24h change</span><strong>—</strong></div>
      <div className="exPairStat"><span>24h volume</span><strong>—</strong></div>
      <div className="exPairStat"><span>Pool liquidity</span><strong>{pool?"Verified on-chain":"—"}</strong></div>
      <button type="button" className="exRefresh" disabled={status==="loading"}
        onClick={()=>setRefreshKey(n=>n+1)} title="Recheck native pool and public chain reads">↻ <span>Refresh</span></button>
    </div>
    <div className="exMarketInfo" role="status" aria-live="polite">
      <span className={status==="ready"?"exStateOk":"exStatePending"}>{marketStatus}</span>
      <span>{market?.health?"Rooted #"+market.health.rootedHeight.toLocaleString("en-US"):"No verified rooted snapshot"}</span>
      <span>AMA only · Testnet</span>
      <span>All market figures must originate on-chain</span>
    </div>

    <div className="exTradingGrid">
      <div className="exPrimaryPane">
        <section className="exChartPanel" aria-label="Historical market chart">
          <div className="exPanelTop">
            <div className="exPanelTitle"><strong>Price chart</strong><span className="exPanelDivider">|</span><span>{base}/AMA</span></div>
            <span className="exChartControlDisabled" title="Historical chart intervals require verified price observations">
              15m&nbsp;&nbsp; 1H&nbsp;&nbsp; 4H&nbsp;&nbsp; 1D
            </span>
            <span className="exChartDataBadge">Historical data unavailable</span>
          </div>
          <div className="exChartView" role="status" aria-label="No independently verified historical spot price series">
            <div className="exChartGridBg" aria-hidden="true"/>
            <div className="exChartAxisY" aria-hidden="true"><span>—</span><span>—</span><span>—</span><span>—</span><span>—</span></div>
            <div className="exChartOverlay">
              <div className="exChartEmptyGlyph" aria-hidden="true">
                <span/><span/><span/><span/>
              </div>
              <strong>Chart awaiting on-chain data</strong>
              <p>No finalized price history exists for this verified market yet. Candles will appear only from real archived reserve observations.</p>
              <a href="/demo">Check deployment readiness ↗</a>
            </div>
            <div className="exChartBrand" aria-hidden="true">SYMBIOTIC</div>
          </div>
          <div className="exChartBottom">
            <span>HISTORICAL PRICE · NOT AVAILABLE</span>
            <span>Zero simulated candles</span>
          </div>
        </section>

        <section className="exReserveStrip" aria-label="AMM reserve status">
          <div><small>BASE RESERVE</small><strong>{pool?pool.reserveBase+" atomic":"—"}</strong><span>{base}</span></div>
          <div><small>AMA RESERVE</small><strong>{pool?pool.reserveAma+" atomic":"—"}</strong><span>AMA</span></div>
          <div><small>COIN REGISTRY</small><strong>{market?.token.status==="registered"?"Registered":"—"}</strong><span>{market?.token.status==="unregistered"?"Symbol not issued":"Native testnet"}</span></div>
          <div><small>POOL STATUS</small><strong>{pool?"Reconciled":"Not verified"}</strong><span>No synthetic depth</span></div>
        </section>

        <section id="exchange-activity" className="exActivityPanel" aria-label="Account, activity and pool information">
          <div className="exActivityTabs" role="tablist" aria-label="Terminal details">
            <button type="button" role="tab" aria-selected={bottomTab==="activity"}
              className={bottomTab==="activity"?"exActivityActive":""} onClick={()=>setBottomTab("activity")}>On-chain activity</button>
            <button type="button" role="tab" aria-selected={bottomTab==="balances"}
              className={bottomTab==="balances"?"exActivityActive":""} onClick={()=>setBottomTab("balances")}>Wallet balances</button>
            <button type="button" role="tab" aria-selected={bottomTab==="pool"}
              className={bottomTab==="pool"?"exActivityActive":""} onClick={()=>setBottomTab("pool")}>Pool overview</button>
          </div>
          {bottomTab==="activity"&&<div className="exActivityBody">
            <div className="exActivityTableHead"><span>Transaction / Type</span><span>Input</span><span>Rooted block</span><span>Explorer</span></div>
            {!account?<div className="exNoActivity"><strong>No wallet selected</strong><p>Connect your AMA wallet to inspect its independently verified finalized swap calls.</p></div>:
             !pool||txs===null?<div className="exNoActivity"><strong>On-chain swap history unavailable</strong><p>Neither a pool nor completed trades are claimed until contract and receipt evidence is verified.</p></div>:
             txs.length===0?<div className="exNoActivity"><strong>No verified swap calls found</strong><p>History is empty for this connected wallet and certified pool.</p></div>:
             <div className="exActivityRows">{txs.map(tx=><div className="exActivityRow" key={tx.hash}>
               <div><strong>{tx.side} {tx.pair}</strong><small>Finalized native contract call · received output unverified</small></div>
               <span>{tx.amountInAtomic} {tx.attachedSymbol} atomic</span>
               <span>{tx.height}</span>
               <a href={tx.explorerUrl} target="_blank" rel="noopener noreferrer">View receipt ↗</a>
             </div>)}</div>}
          </div>}
          {bottomTab==="balances"&&<div className="exActivityBody exBalancesBody">
            {!account?<div className="exNoActivity"><strong>Wallet not connected</strong><p>Connect the Amadeus extension to read native public balances.</p></div>:
             !balance?<div className="exNoActivity"><strong>Balance data unavailable</strong><p>No inferred or mocked wallet holdings are displayed.</p></div>:
             <><div><span>AMA · native balance</span><strong>{balance.amaAtomic} atomic</strong></div>
               <div><span>{base} · native balance</span><strong>{balance.baseAtomic===null?"Unissued / unavailable":balance.baseAtomic+" atomic"}</strong></div>
               <a href={"https://testnet.explorer.ama.one/network/address/"+balance.address}
                 target="_blank" rel="noopener noreferrer">Inspect account on explorer ↗</a></>}
          </div>}
          {bottomTab==="pool"&&<div className="exActivityBody exBalancesBody">
            <div><span>Market</span><strong>{base}/AMA</strong></div>
            <div><span>Native custody reconciliation</span><strong>{pool?"Verified for current snapshot":"Not yet verified"}</strong></div>
            <div><span>LP share supply</span><strong>{pool?pool.totalLp+" atomic":"—"}</strong></div>
            <div><span>Pool contract</span><strong>{pool?pool.address:"No certified deployment"}</strong></div>
            <p>No order book is fabricated. Native liquidity will be displayed only after an authenticated AMM pool is funded.</p>
          </div>}
        </section>
      </div>

      <aside className="exTicket" aria-label="Spot trading ticket">
        <div className="exTicketHeading"><strong>Spot trade</strong><span>TESTNET · READ ONLY</span></div>
        <div className="exSideSwitch" role="group" aria-label="Spot order side">
          <button className={side==="BUY"?"exBuySelected":""} type="button"
            aria-pressed={side==="BUY"} onClick={()=>setSide("BUY")}>Buy</button>
          <button className={side==="SELL"?"exSellSelected":""} type="button"
            aria-pressed={side==="SELL"} onClick={()=>setSide("SELL")}>Sell</button>
        </div>
        <div className="exTicketBody">
          <div className="exTicketMarket"><span>Market</span><strong>{base}/AMA</strong></div>
          <div className="exTicketMarket"><span>Execution method</span><strong>AMM exact input</strong></div>
          <div className="exTicketMarket"><span>Price</span><strong>—</strong></div>
          <label className="exInputLabel">
            <span>You pay <small>{side==="BUY"?"AMA":base} · atomic units</small></span>
            <div className="exInputWrapper">
              <input type="text" inputMode="numeric" value={amount}
                onChange={e=>setAmount(e.target.value)} placeholder="0" aria-label="Exact atomic input amount"/>
              <strong>{side==="BUY"?"AMA":base}</strong>
            </div>
          </label>
          <label className="exInputLabel">
            <span>Slippage tolerance</span>
            <select className="exSlippage" value={slippage} onChange={e=>setSlippage(Number(e.target.value))}>
              <option value={10}>0.10%</option><option value={50}>0.50%</option>
              <option value={100}>1.00%</option><option value={300}>3.00%</option>
              <option value={500}>5.00%</option>
            </select>
          </label>
          <div className="exQuoteDetails">
            <div><span>Swap fee</span><strong>0.30% (AMM design)</strong></div>
            <div><span>Expected receive</span><strong>{quote?quote.expectedOut+" atomic "+quote.outputSymbol:"—"}</strong></div>
            <div><span>Minimum receive</span><strong>{quote?quote.minimumOut+" atomic "+quote.outputSymbol:"—"}</strong></div>
          </div>
          <button className="exPreviewButton" type="button"
            disabled={!pool||quoteBusy||!/^[1-9][0-9]*$/.test(amount)}
            onClick={()=>void getQuote()}>{quoteBusy?"Checking reserves…":"Preview on-chain quote"}</button>
          {quoteMessage&&<p className="exTicketError" role="alert">{quoteMessage}</p>}
          <button className="exTradeLocked" type="button" disabled>
            {side==="BUY"?"Buy ":"Sell "}{base} — Unavailable
          </button>
          <p className="exTicketNotice">Signing and swaps stay locked until verified native token issuance, deployed pools, real reserves, wallet approvals and finalized testnet receipts.</p>
        </div>
        <div className="exTicketAccount">
          <span>ACCOUNT</span>
          <strong>{account?account.slice(0,8)+"…"+account.slice(-6):"Not connected"}</strong>
          <small>{account?"Wallet public account connected":"Use Connect Wallet in the header to view native holdings."}</small>
        </div>
      </aside>
    </div>
  </section>;
}
