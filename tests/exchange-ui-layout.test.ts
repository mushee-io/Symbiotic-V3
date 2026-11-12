import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import TradePage from "../app/trade/onchain/page";

const render = () => renderToStaticMarkup(createElement(TradePage));

test("/trade/onchain exchange route starts with AMA trading panels, not a marketing hero", () => {
  const html=render();
  assert.match(html,/SYMBASIS/);
  assert.match(html,/Spot pairs/);
  assert.match(html,/TESTBTC/);
  assert.match(html,/TESTUSD/);
  assert.match(html,/Price chart/);
  assert.match(html,/Spot trade/);
  assert.match(html,/On-chain activity/);
  assert.match(html,/Wallet balances/);
  assert.match(html,/Connect Wallet/);
  assert.match(html,/href="\/"[^>]*>Home<\/a>/);
  assert.match(html,/href="\/trade"/);
  assert.doesNotMatch(html,/Trading architecture/);
  assert.doesNotMatch(html,/Evidence first/);
  assert.ok(html.indexOf("Spot pairs") < html.indexOf("Price chart"));
  assert.ok(html.indexOf("Price chart") < html.indexOf("AI Risk Research"));
});

test("read-only chart has native-data empty state, never synthetic candles or fake spot market price", () => {
  const html=render();
  assert.match(html,/Chart awaiting on-chain data/);
  assert.match(html,/No finalized price history/);
  assert.match(html,/Zero simulated candles/);
  assert.match(html,/No verified price/);
  assert.match(html,/No synthetic depth/);
  assert.match(html,/Public testnet/);
  assert.doesNotMatch(html,/Volume:\s*\$[\d,.]+/);
  assert.doesNotMatch(html,/BTC\/USDT/);
  assert.doesNotMatch(html,/ETH\/USDT/);
});

test("order-entry UI has real side selector and hard disabled spot execution", () => {
  const html=render();
  assert.match(html,/Spot order side/);
  assert.match(html,/Buy/);
  assert.match(html,/Sell/);
  assert.match(html,/Slippage tolerance/);
  assert.match(html,/Swap fee/);
  assert.match(html,/Preview on-chain quote/);
  assert.match(html,/Buy TESTBTC — Unavailable/);
  assert.match(html,/Signing and swaps stay locked/);
  assert.match(html,/disabled=""/);
  assert.match(html,/AMM exact input/);
});

test("live wallet tooling stays in accessible drawer; AI risk research has collapsed optional section", () => {
  const html=render();
  assert.match(html,/aria-label="Primary"/);
  assert.match(html,/aria-expanded="false"/);
  assert.match(html,/Open research/);
  assert.match(html,/Connect Wallet/);
  assert.match(html,/Evidence/);
  assert.match(html,/Roadmap/);
  assert.doesNotMatch(html,/Approve execution — unavailable/);
});

test("desktop and mobile layouts have distinct grid/media breakpoints and no fake chart plots", () => {
  const css=readFileSync(new URL("../app/globals.css", import.meta.url),"utf8");
  for(const name of [".exWorkspace{",".exTradingGrid{",".exChartGridBg{",
    ".exWatchlist{",".exTicket{",".exWalletDrawer{",
    ".exActivityTabs{",".exBuySelected{",".exSellSelected{"]){
    assert.ok(css.includes(name), "missing exchange layout selector "+name);
  }
  assert.match(css,/@media\(max-width:1070px\)/);
  assert.match(css,/@media\(max-width:800px\)/);
  assert.match(css,/@media\(max-width:580px\)/);
  assert.match(css,/prefers-reduced-motion/);
});
