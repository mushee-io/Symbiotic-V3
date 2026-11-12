import test from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TerminalViewPage } from "../components/TerminalViews";
import { demoCandles } from "../components/TerminalMarketVisuals";

for (const view of ["markets", "portfolio", "liquidity", "mm", "rewards", "more", "private", "risk"] as const) {
  test(`${view} dashboard has shared terminal navigation, Amadeus branding and an accessible wallet entry`, () => {
    const html = renderToStaticMarkup(React.createElement(TerminalViewPage, { view }));
    assert.match(html, /SYMBASIS/);
    assert.match(html, /Amadeus Protocol/);
    assert.match(html, /Connect Wallet/);
    assert.ok(html.includes(`href="/${view}" aria-current="page"`));
    for (const href of ["/trade", "/markets", "/portfolio", "/liquidity", "/mm", "/rewards", "/more", "/setup"]) assert.ok(html.includes(`href="${href}"`));
    assert.doesNotMatch(html, /HORIZEN|2651420|sUSDC/);
  });
}
test("native dashboards do not infer disconnected holdings, pool liquidity or reward balances", () => {
  const portfolio = renderToStaticMarkup(React.createElement(TerminalViewPage, { view: "portfolio" }));
  const liquidity = renderToStaticMarkup(React.createElement(TerminalViewPage, { view: "liquidity" }));
  const rewards = renderToStaticMarkup(React.createElement(TerminalViewPage, { view: "rewards" }));
  assert.match(portfolio, /NOT CONNECTED/);
  assert.match(portfolio, /Historical account equity is not available/);
  assert.match(liquidity, /No verified historical reserve series/);
  assert.match(rewards, /Not announced/);
  assert.doesNotMatch(portfolio + liquidity + rewards, /\$500,000|\$0\.00|\+\$0\.00/);
});
test("simulated candles are deterministic, interval-specific and isolated to a labelled preview", () => {
  assert.deepEqual(demoCandles("TESTBTC", "1M"), demoCandles("TESTBTC", "1M"));
  assert.notDeepEqual(demoCandles("TESTBTC", "1M"), demoCandles("TESTBTC", "1H"));
  const mm = renderToStaticMarkup(React.createElement(TerminalViewPage, { view: "mm" }));
  assert.match(mm, /SIMULATED PREVIEW/);
  assert.match(mm, /NO REAL LIQUIDITY OR EXECUTION/);
  assert.match(mm, /illustrative simulated candlestick chart/);
  assert.doesNotMatch(mm, /Open long|Open short|Submit order/);
});
