import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DemoReadinessPanel } from "../components/DemoReadinessPanel";
import DemoPage from "../app/demo/page";
import Roadmap from "../app/roadmap/page";

test("M12 public demo renders both AMA pairs and disclosure without synthetic market results",()=>{
  const markup=renderToStaticMarkup(createElement(DemoPage));
  assert.match(markup,/TESTBTC\/AMA/);
  assert.match(markup,/TESTUSD\/AMA/);
  assert.match(markup,/Check readiness/);
  assert.match(markup,/Swaps and signing disabled/);
  assert.match(markup,/No synthetic|not a claim that swaps are live|No fake market activity/i);
  assert.match(markup,/33JACK/);
  assert.doesNotMatch(markup,/\$\d+(?:,\d{3})+(?:\.\d+)?/);
});

test("readiness panel static fallback communicates unavailable data, never zero balances or live quotes",()=>{
  const markup=renderToStaticMarkup(createElement(DemoReadinessPanel));
  assert.match(markup,/Checking official Amadeus testnet/);
  assert.match(markup,/Not verified/);
  assert.match(markup,/No observation/);
  assert.match(markup,/Swaps and signing disabled/);
  assert.match(markup,/Refresh on-chain evidence/);
  assert.doesNotMatch(markup,/Transactions executed|Volume:\s*100000|Live trading enabled/i);
});

test("roadmap SSR shows dated issue snapshot, exactly three closed issues and nine open ones",()=>{
  const markup=renderToStaticMarkup(createElement(Roadmap));
  assert.equal((markup.match(/GitHub issue closed/g)||[]).length,3);
  assert.equal((markup.match(/Live acceptance open/g)||[]).length,9);
  for(let number=1;number<=12;number++){
    assert.ok(markup.includes("issues/"+number),String(number));
  }
  assert.match(markup,/2026-11-12/);
});
