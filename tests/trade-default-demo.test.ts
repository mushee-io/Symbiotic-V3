import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path:string) => readFileSync(new URL("../"+path,import.meta.url),"utf8");
const trade = read("app/trade/page.tsx");
const demo = read("app/sandbox/page.tsx");
const native = read("app/trade/onchain/page.tsx");
const home = read("app/page.tsx");

test("/trade opens interactive demo immediately instead of read-only wallet ticket",()=>{
  assert.match(trade,/import SandboxPage from/);
  assert.match(trade,/return <SandboxPage \/>/);
  assert.doesNotMatch(trade,/MarketTerminal|read.only/);
});
test("demo has exactly two AMA-quoted market bases and up-front simulated disclosure",()=>{
  assert.match(demo,/TESTBTC/);
  assert.match(demo,/TESTUSD/);
  assert.match(demo,/SIMULATION ONLY/);
  assert.match(demo,/NO ON-CHAIN EXECUTION/);
  assert.match(demo,/AMA is the sole quote asset/);
  assert.doesNotMatch(demo,/submitAndWait\(|signTransaction\(|fetch\(/);
});
test("demo autopopulates sample trades and auto-updates market maker without user action",()=>{
  assert.match(demo,/useState<SandboxState>\(initialDemoState\)/);
  assert.match(demo,/useState\(true\)/);
  assert.match(demo,/setInterval\(/);
  assert.match(demo,/3000/);
  assert.match(demo,/runMakerCycle\(afterFlow\)/);
  assert.match(demo,/Simulated order flow/);
  assert.match(demo,/Simulate \{side\}/);
  assert.match(demo,/Pause autoplay/);
});
test("real read-only testnet route remains accessible, with working homepage links",()=>{
  assert.match(native,/MarketTerminal/);
  assert.match(native,/AgentMonitorPanel/);
  assert.match(demo,/href="\/trade\/onchain"/);
  assert.match(home,/\/trade#demo-mm/);
});
