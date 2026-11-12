import test from "node:test";
import assert from "node:assert/strict";
import {TEST_ASSETS,MARKETS,COMING_SOON} from "../lib/markets";
test("two AMA spot test markets and nothing else",()=>{assert.deepEqual([...TEST_ASSETS],["TESTBTC","TESTUSD"]);assert.equal(MARKETS.length,2);assert.ok(MARKETS.every(m=>m.quote==="AMA"&&!m.enabled));});
test("deferred markets",()=>assert.deepEqual([...COMING_SOON],["Perpetuals","RWA","Notional","Options"]));
