"use client";
import * as React from "react";
import { useState } from "react";

export function handleTabKeys(event: React.KeyboardEvent<HTMLElement>) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="tab"]'));
  const current = tabs.indexOf(event.target as HTMLButtonElement);
  if (current < 0 || tabs.length === 0) return;
  event.preventDefault();
  const index = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  tabs[index].focus(); tabs[index].click();
}

// Explicit UI-only illustration. Never used by quotes, balances, signing, or API reads.
export function demoCandles(base: string, interval = "1M") {
  const scale = base === "TESTUSD" ? 1 : 100;
  const phase = ({ "1M": 0, "5M": 1, "15M": 2, "1H": 3, "1D": 6 } as Record<string, number>)[interval] ?? 0;
  return Array.from({ length: 54 }, (_, i) => {
    const open = 44 + Math.sin((i + phase) * .45) * 10 + i * .23;
    const close = 44 + Math.sin((i + 1 + phase) * .45) * 10 + (i + 1) * .23;
    return { open, close, high: Math.max(open, close) + 3 + (i * 7 % 6), low: Math.min(open, close) - 3 - (i * 3 % 5), volume: 4 + (i * 11 % 17), price: (close * scale).toFixed(2) };
  });
}
export function DemoChart({ base, interval = "1M" }: { base: string; interval?: string }) {
  const candles = demoCandles(base, interval);
  return <div className="tdDemoChart"><span className="tdSimulationBadge">SIMULATED PREVIEW · NOT LIVE MARKET DATA</span><svg viewBox="0 0 900 440" role="img" aria-label={base + " illustrative simulated candlestick chart"} preserveAspectRatio="none">
    {Array.from({ length: 9 }, (_, i) => <line key={"x" + i} x1={i * 110 + 10} x2={i * 110 + 10} y1="40" y2="420" stroke="#1c2022" />)}
    {Array.from({ length: 7 }, (_, i) => <line key={"y" + i} x1="10" x2="890" y1={40 + i * 60} y2={40 + i * 60} stroke="#1c2022" />)}
    {candles.map((c, i) => { const color = c.close >= c.open ? "#56df92" : "#ee6174"; const y = (value: number) => 360 - value * 3.7; return <g key={i}><line x1={20 + i * 16} x2={20 + i * 16} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth="1.2" /><rect x={16 + i * 16} y={Math.min(y(c.open), y(c.close))} width="8" height={Math.max(2, Math.abs(c.close - c.open) * 3.7)} fill={color} /><rect x={16 + i * 16} y={425 - c.volume} width="8" height={c.volume} fill={color} opacity=".25" /></g>; })}
    <line x1="10" x2="890" y1="174" y2="174" stroke="#ddd" strokeDasharray="5 6" opacity=".5" />
  </svg><div className="tdChartLegend"><span>{base}/AMA · UI illustration</span><span>Deterministic sample · No execution</span></div></div>;
}
export function DepthPanel({ base, simulated = false }: { base: string; simulated?: boolean }) {
  const [tab, setTab] = useState<"depth" | "fills">("depth");
  const rows = Array.from({ length: 8 }, (_, i) => ({ ask: ((base === "TESTUSD" ? 1 : 100) * (42.983 + i * .003)).toFixed(3), bid: ((base === "TESTUSD" ? 1 : 100) * (42.977 - i * .003)).toFixed(3), size: (2.1 + i * .713).toFixed(3), total: ((i + 1) * 2.1 + .713 * i * (i + 1) / 2).toFixed(3) }));
  return <aside className={"tdDepth" + (simulated ? " tdDepthSim" : "")} aria-label={simulated ? "Simulated order book" : "Market depth"}>
    <div className="tdDepthTabs" role="tablist" aria-label="Market data" onKeyDown={handleTabKeys}><button type="button" role="tab" tabIndex={tab === "depth" ? 0 : -1} aria-selected={tab === "depth"} onClick={() => setTab("depth")}>Order book</button><button type="button" role="tab" tabIndex={tab === "fills" ? 0 : -1} aria-selected={tab === "fills"} onClick={() => setTab("fills")}>Live fills</button></div>
    <div className="tdDepthLabel">{simulated ? "SIMULATED PREVIEW / NOT LIVE" : "NATIVE AMM / NO LIMIT ORDER BOOK"}</div>
    <div className="tdDepthHead"><span>{tab === "depth" ? "Price" : "Time"}</span><span>Size</span><span>{tab === "depth" ? "Total" : "Side"}</span></div>
    {tab === "depth" ? <>
      <div className="tdDepthRows">{rows.slice().reverse().map((row, i) => <div key={i} className="tdAsk"><span className="tdDepthBar" style={{ width: (100 - i * 11) + "%" }} /><span>{simulated ? row.ask : "—"}</span><span>{simulated ? row.size : "—"}</span><span>{simulated ? row.total : "—"}</span></div>)}</div>
      <div className="tdMidPrice"><strong>{simulated ? (base === "TESTUSD" ? "42.980" : "4,298.000") : "—"}</strong><span>{base}/AMA<small>{simulated ? "Illustrative price" : "No verified order-book price"}</small></span></div>
      <div className="tdDepthRows">{rows.map((row, i) => <div key={i} className="tdBid"><span className="tdDepthBar" style={{ width: (15 + i * 11) + "%" }} /><span>{simulated ? row.bid : "—"}</span><span>{simulated ? row.size : "—"}</span><span>{simulated ? row.total : "—"}</span></div>)}</div>
    </> : <div className="tdDepthEmpty">{simulated ? "This preview does not generate execution receipts or wallet fills." : "No verified fills available. Finalized wallet transactions appear in on-chain activity."}</div>}
    <p className="tdDepthNote">{simulated ? "Sample depth is a design illustration. It does not represent exchange liquidity or counterparties." : "Spot execution uses native AMM reserves. Order-book depth is not provided by this protocol."}</p>
  </aside>;
}
