import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const page=readFileSync(new URL("../app/sandbox/page.tsx",import.meta.url),"utf8");
const home=readFileSync(new URL("../app/page.tsx",import.meta.url),"utf8");
const evidence=readFileSync(new URL("../app/demo/page.tsx",import.meta.url),"utf8");

test("interactive MM demo is explicitly a simulation and never a signed transaction",()=>{
  assert.match(page,/SIMULATION ONLY/);
  assert.match(page,/NO ON-CHAIN EXECUTION/);
  assert.match(page,/No wallet connection, no network call/);
  assert.doesNotMatch(page,/submitAndWait|signTransaction|privateKey|fetch\(/);
});
test("demo keeps exactly two AMA quote markets",()=>{
  assert.match(page,/TESTBTC/);
  assert.match(page,/TESTUSD/);
  assert.match(page,/MARKETS/);
  assert.match(page,/AMA is the sole quote asset/);
  assert.doesNotMatch(page,/USDC\/|ETH\/|SOL\/|TESTBTC\/TESTUSD/);
});
test("demo supports swaps, inventory bounded MM cycles and reset",()=>{
  for(const phrase of ["Simulate {side}","Run extra MM cycle","Reset demo","FEE=0.003","share<0.45","share>0.55","Math.min(5","fresh()"]){
    assert.ok(page.includes(phrase),phrase);
  }
});
test("interactive demo is discoverable from public homepage and evidence",()=>{
  assert.match(home,/href="\/sandbox"/);
  assert.match(evidence,/href="\/sandbox"/);
});
