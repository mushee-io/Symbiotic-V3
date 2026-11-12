import test from "node:test";
import assert from "node:assert/strict";
import {
  MILESTONE_INDEX,MILESTONE_STATUS_CHECKED,milestoneIssueUrl,
} from "../lib/demo/milestones";
import { MARKETS, COMING_SOON } from "../lib/markets";

test("M12 roadmap includes all 12 distinct tracked issues in original milestone order",()=>{
  assert.equal(MILESTONE_INDEX.length,12);
  assert.deepEqual(MILESTONE_INDEX.map(m=>m.number),Array.from({length:12},(_,i)=>i+1));
  assert.equal(new Set(MILESTONE_INDEX.map(m=>m.title)).size,12);
  for(const m of MILESTONE_INDEX){
    assert.ok(m.summary.length>25);
    assert.ok(m.acceptance.length>10);
    assert.equal(milestoneIssueUrl(m.number),
      "https://github.com/mushee-io/Symbiotic-V3/issues/"+m.number);
  }
});

test("snapshot distinguishes only M1/M2/M5 closed from open independent on-chain evidence",()=>{
  assert.equal(MILESTONE_STATUS_CHECKED,"2026-11-12");
  assert.deepEqual(
    MILESTONE_INDEX.filter(m=>m.issueState==="closed").map(m=>m.number),
    [1,2,5],
  );
  assert.deepEqual(
    MILESTONE_INDEX.filter(m=>m.issueState==="open").map(m=>m.number),
    [3,4,6,7,8,9,10,11,12],
  );
  for(const m of MILESTONE_INDEX.filter(m=>m.issueState==="open")){
    assert.ok(!/live swap completed|funded pools verified|production ready/i.test(m.summary));
  }
});

test("nonexistent milestone is rejected, never an invented GitHub issue",()=>{
  for(const n of [-1,0,13,99,1.5,NaN,Infinity]){
    assert.throws(()=>milestoneIssueUrl(n),/invalid_milestone_number/);
  }
});

test("AMA testnet market list is limited to two non-executing spot assets",()=>{
  assert.deepEqual(MARKETS.map(m=>m.base),["TESTBTC","TESTUSD"]);
  assert.deepEqual(MARKETS.map(m=>m.label),["TESTBTC / AMA","TESTUSD / AMA"]);
  for(const m of MARKETS){
    assert.equal(m.quote,"AMA");
    assert.equal(m.enabled,false);
  }
  assert.deepEqual([...COMING_SOON],["Perpetuals","RWA","Notional","Options"]);
});
