"use client";

import { useState } from "react";
import "./sandbox.css";

type Pair = "TESTBTC" | "TESTUSD";
type Side = "BUY" | "SELL";
type Pool = { base: number; ama: number; chart: number[] };
type Trade = { id: number; pair: Pair; side: Side; amount: number; received: number; actor: string; price: number };
type Wallet = { AMA: number; TESTBTC: number; TESTUSD: number };
const START: Record<Pair,Pool> = {
  TESTBTC: {base:100,ama:10000,chart:[95,97,96,99,98,100]},
  TESTUSD: {base:100000,ama:10000,chart:[0.098,0.099,0.1,0.099,0.101,0.1]},
};
const fresh = () => ({
  pools: structuredClone(START),
  trader: {AMA:200,TESTBTC:1,TESTUSD:100} as Wallet,
  maker: {AMA:400,TESTBTC:2,TESTUSD:2000} as Wallet,
  trades: [] as Trade[],
  step:0,
});
type SandboxState = ReturnType<typeof fresh>;
const fmt=(n:number,d=4)=>Number.isFinite(n)?n.toLocaleString("en-US",{maximumFractionDigits:d}):"—";
const price=(p:Pool)=>p.ama/p.base;
const FEE=0.003;
function execute(s:SandboxState,pair:Pair,side:Side,amount:number,actor:"trader"|"maker"):SandboxState|null{
  if(!Number.isFinite(amount)||amount<=0) return null;
  const p=s.pools[pair], wallet=s[actor], input=side==="BUY"?"AMA":pair;
  if(wallet[input]<amount) return null;
  const output=side==="BUY"?(p.base*(amount*(1-FEE)))/(p.ama+amount*(1-FEE)):
    (p.ama*(amount*(1-FEE)))/(p.base+amount*(1-FEE));
  if(!Number.isFinite(output)||output<=0) return null;
  const next=structuredClone(s);
  const q=next.pools[pair], w=next[actor];
  if(side==="BUY"){q.ama+=amount;q.base-=output;w.AMA-=amount;w[pair]+=output;}
  else{q.base+=amount;q.ama-=output;w[pair]-=amount;w.AMA+=output;}
  if(q.base<=0||q.ama<=0) return null;
  const marketPrice=price(q);
  q.chart=[...q.chart.slice(-24),marketPrice];
  next.trades=[{id:s.step+1,pair,side,amount,received:output,actor:actor==="maker"?"Demo MM":"You (simulated)",price:marketPrice},...s.trades].slice(0,12);
  next.step+=1;
  return next;
}
export default function SandboxPage(){
  const [state,setState]=useState<SandboxState>(fresh);
  const [pair,setPair]=useState<Pair>("TESTBTC");
  const [side,setSide]=useState<Side>("BUY");
  const [amount,setAmount]=useState("5");
  const [running,setRunning]=useState(false);
  const [message,setMessage]=useState("Sandbox ready. Nothing here is connected to a wallet or blockchain.");
  const pool=state.pools[pair], current=price(pool);
  const qty=Number(amount);
  const estimate=Number.isFinite(qty)&&qty>0?
    (side==="BUY"?pool.base*qty*(1-FEE)/(pool.ama+qty*(1-FEE)):pool.ama*qty*(1-FEE)/(pool.base+qty*(1-FEE))):0;
  const valid=Number.isFinite(qty)&&qty>0&&qty<=state.trader[side==="BUY"?"AMA":pair];
  function trade(){
    const next=execute(state,pair,side,qty,"trader");
    if(!next){setMessage("Trade rejected: enter a positive amount within your simulated balance.");return;}
    setState(next);setMessage("Simulated "+side+" executed. No real tokens moved.");
  }
  function cycle(){
    if(!running){setMessage("Enable the demo MM first.");return;}
    let s=state, executed=0;
    for(const symbol of ["TESTBTC","TESTUSD"] as Pair[]){
      const p=s.pools[symbol], value=s.maker[symbol]*price(p);
      const share=value/(value+s.maker.AMA);
      // Inventory target 50% with a 5% deadband; cap each action to 5 AMA.
      if(share<0.45){
        const spend=Math.min(5,Math.max(0,s.maker.AMA-20));
        if(spend>0){const next=execute(s,symbol,"BUY",spend,"maker");if(next){s=next;executed++;}}
      }else if(share>0.55){
        const sell=Math.min(s.maker[symbol]*0.05,5/price(p));
        if(sell>0){const next=execute(s,symbol,"SELL",sell,"maker");if(next){s=next;executed++;}}
      }
    }
    setState(s);setMessage(executed?"Demo MM executed "+executed+" inventory rebalance(s).":"Demo MM HOLD: inventory is within its target band.");
  }
  const values=pool.chart;
  const lo=Math.min(...values)*0.985, hi=Math.max(...values)*1.015;
  const pts=values.map((p,i)=>`${(i/(values.length-1))*100},${90-(p-lo)/(hi-lo)*80}`).join(" ");
  return <div className="sb">
    <header className="sbTop"><a href="/" className="sbLogo">◈ SYMBIOTIC <b>V3</b></a><nav><a href="/">Home</a><a href="/trade">On-chain terminal</a><a href="/demo">Evidence</a><a className="sbCurrent" href="/sandbox">MM Sandbox</a></nav><span className="sbBadge">SIMULATION ONLY</span></header>
    <div className="sbAlert" role="status"><strong>INTERACTIVE DEMO · NO ON-CHAIN EXECUTION</strong><span>All prices, funds, charts and transactions are fictional, local browser state. AMA testnet tokens are not used.</span></div>
    <main className="sbMain">
      <div className="sbHeading"><div><p className="sbKicker">AMA-QUOTED SPOT · PRODUCT WALKTHROUGH</p><h1>Market-maker <em>sandbox.</em></h1><p>Test how automated inventory rebalancing and constant-product swaps behave before native Amadeus deployment.</p></div><button className="sbReset" onClick={()=>{setState(fresh());setRunning(false);setMessage("Sandbox reset. All activity cleared.");}}>↻ Reset demo</button></div>
      <div className="sbStats"><div><small>MARKETS</small><b>02</b><span>TESTBTC/AMA · TESTUSD/AMA</span></div><div><small>NETWORK</small><b>Local simulation</b><span>Zero blockchain broadcasts</span></div><div><small>AMM FEE</small><b>0.30%</b><span>Illustrative constant product</span></div><div><small>DEMO ACTIONS</small><b>{state.step}</b><span>Generated in this browser</span></div></div>
      <div className="sbLayout">
        <aside className="sbPanel sbMarkets"><div className="sbPanelHead"><span>MARKETS</span><small>Demo reserves</small></div>{(["TESTBTC","TESTUSD"] as Pair[]).map(x=><button className={"sbMarket "+(pair===x?"active":"")} onClick={()=>setPair(x)} key={x}><span className="sbAvatar">{x==="TESTBTC"?"₿":"$"}</span><span><b>{x}<i>/AMA</i></b><small>Simulated price</small></span><strong>{fmt(price(state.pools[x]),5)} <small>AMA</small></strong></button>)}<div className="sbHint">AMA is the sole quote asset. This sandbox cannot sign transactions or access your wallet.</div></aside>
        <section className="sbPanel sbChart"><div className="sbPanelHead"><span>{pair}/AMA <small>· SIMULATED PRICE</small></span><strong>{fmt(current,5)} AMA</strong></div><div className="sbChartBody"><div className="sbChartNumbers"><span>{fmt(hi,4)}</span><span>{fmt((hi+lo)/2,4)}</span><span>{fmt(lo,4)}</span></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Simulated market price movement"><defs><linearGradient id="sbFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c7fe43" stopOpacity=".24"/><stop offset="1" stopColor="#c7fe43" stopOpacity="0"/></linearGradient></defs><path d={`M ${pts.replaceAll(" "," L ")} L 100,100 L 0,100 Z`} fill="url(#sbFill)"/><polyline points={pts} fill="none" stroke="#c7fe43" strokeWidth="1.25" vectorEffect="non-scaling-stroke"/></svg><div className="sbGridlines"/></div><div className="sbReserves"><div><small>POOL BASE RESERVE</small><b>{fmt(pool.base,5)} {pair}</b></div><div><small>POOL QUOTE RESERVE</small><b>{fmt(pool.ama,5)} AMA</b></div><div><small>CONSTANT PRODUCT</small><b>{fmt(pool.base*pool.ama,2)}</b></div></div></section>
        <aside className="sbPanel sbTicket"><div className="sbPanelHead"><span>SWAP TICKET</span><small>SIMULATED</small></div><div className="sbSwitch"><button className={side==="BUY"?"buy":""} onClick={()=>setSide("BUY")}>Buy {pair}</button><button className={side==="SELL"?"sell":""} onClick={()=>setSide("SELL")}>Sell {pair}</button></div><label htmlFor="sbAmount">You pay ({side==="BUY"?"AMA":pair})</label><input id="sbAmount" type="number" step="any" min="0" value={amount} onChange={e=>setAmount(e.target.value)}/><p className="sbAvailable">Available: {fmt(state.trader[side==="BUY"?"AMA":pair],6)}</p><div className="sbEstimate"><small>Estimated receive</small><b>{valid?fmt(estimate,6):"—"} {side==="BUY"?pair:"AMA"}</b><span>Includes illustrative 0.30% fee · no gas</span></div><button className="sbExecute" disabled={!valid} onClick={trade}>Simulate {side} →</button><p className="sbTiny">No wallet connection, no network call, no money at risk.</p></aside>
        <section className="sbPanel sbOperator"><div className="sbPanelHead"><span>MARKET-MAKER OPERATOR</span><span className={running?"sbOn":"sbOff"}>{running?"ARMED · DEMO":"PAUSED"}</span></div><div className="sbOperatorInner"><div><h2>Inventory rebalancing</h2><p>A deterministic MM targets 50% base-token inventory, with a ±5% hold band, a 5 AMA action cap and a 20 AMA gas-reserve-style floor. Run each cycle manually.</p></div><div className="sbOperatorActions"><button className={running?"sbPause":"sbArm"} onClick={()=>{setRunning(!running);setMessage(!running?"Demo MM armed. Run a cycle to simulate trades.":"Demo MM paused.");}}>{running?"■ Pause MM":"▶ Arm demo MM"}</button><button onClick={cycle} disabled={!running}>Run one MM cycle ↻</button></div></div><div className="sbBalances"><div><small>MM AMA</small><strong>{fmt(state.maker.AMA)}</strong></div><div><small>MM TESTBTC</small><strong>{fmt(state.maker.TESTBTC,6)}</strong></div><div><small>MM TESTUSD</small><strong>{fmt(state.maker.TESTUSD,5)}</strong></div><div><small>USER AMA</small><strong>{fmt(state.trader.AMA)}</strong></div></div><p className="sbStatus" role="status">{message}</p></section>
        <section className="sbPanel sbHistory"><div className="sbPanelHead"><span>DEMO ACTIVITY</span><small>{state.trades.length} simulated actions</small></div><div className="sbTableWrap"><table><thead><tr><th>Actor</th><th>Market</th><th>Side</th><th>Paid</th><th>Received</th></tr></thead><tbody>{state.trades.length?state.trades.map(t=><tr key={t.id}><td>{t.actor}</td><td>{t.pair}/AMA</td><td className={t.side==="BUY"?"sbGreen":"sbOrange"}>{t.side}</td><td>{fmt(t.amount,5)} {t.side==="BUY"?"AMA":t.pair}</td><td>{fmt(t.received,6)} {t.side==="BUY"?t.pair:"AMA"}</td></tr>):<tr><td colSpan={5} className="sbEmpty">No simulated activity yet. Try a swap or run an MM cycle.</td></tr>}</tbody></table></div></section>
      </div><footer className="sbFooter">SIMULATED DATA · NOT PROOF OF TESTNET SETTLEMENT <a href="/demo">View real testnet evidence →</a></footer>
    </main>
  </div>;
}
