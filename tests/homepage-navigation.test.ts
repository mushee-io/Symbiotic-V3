import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import HomePage from "../app/page";
import TradePage from "../app/trade/page";

test("site root is a dedicated homepage with clear Trade navigation",()=>{
  const home=renderToStaticMarkup(createElement(HomePage));
  const trade=renderToStaticMarkup(createElement(TradePage));
  assert.match(home,/SYMBIOTIC/);
  assert.match(home,/SPOT\./);
  assert.match(home,/WITHOUT/);
  assert.match(home,/COMPROMISE/);
  assert.match(home,/aria-current="page">Home/);
  assert.match(home,/href="\/trade"/);
  assert.match(home,/Explore Trading Terminal/);
  assert.match(home,/Launch App/);
  assert.match(home,/View Testnet Evidence/);
  assert.match(trade,/href="\/">Home/);
  assert.match(trade,/href="\/trade">Trade/);
  assert.match(trade,/Spot pairs/);
  assert.match(trade,/Price chart/);
  assert.match(trade,/Spot trade/);
  assert.doesNotMatch(home,/exTradingGrid/);
  assert.doesNotMatch(home,/Chart awaiting on-chain data/);
  assert.doesNotMatch(trade,/SPOT\.<\/?/);
});

test("homepage carries both AMA markets and no made-up price, volume or wallet holdings",()=>{
  const home=renderToStaticMarkup(createElement(HomePage));
  for(const name of ["TESTBTC","TESTUSD"])assert.match(home,new RegExp(name));
  assert.match(home,/AMA QUOTE ONLY/);
  assert.match(home,/Last price|LAST PRICE/);
  assert.match(home,/Unavailable/);
  assert.match(home,/Not live/);
  assert.match(home,/Live mints, funded pools and swaps not yet verified/);
  assert.doesNotMatch(home,/USD\/USDT|BTC\/USDT|ETH\/USDT/);
  assert.doesNotMatch(home,/\$4,300|\$500,000|100,000 trades/);
  assert.doesNotMatch(home,/Transaction executed|Total value locked/);
});

test("homepage links to market overview, liquidity, nonexecuting AI and verified evidence",()=>{
  const home=renderToStaticMarkup(createElement(HomePage));
  for(const anchor of ['id="markets"','id="liquidity"','id="ai-risk"','id="resources"']){
    assert.ok(home.includes(anchor),"missing homepage section "+anchor);
  }
  assert.match(home,/Spot trading/);
  assert.match(home,/Liquidity architecture/);
  assert.match(home,/AI risk research/);
  assert.match(home,/href="\/demo"/);
  assert.match(home,/href="\/roadmap"/);
  assert.match(home,/href="https:\/\/github.com\/mushee-io\/Symbiotic-V3"/);
  assert.match(home,/no live trades/i);
});

test("homepage is responsive, keyboard accessible and avoids chart-like fake metrics",()=>{
  const css=readFileSync(new URL("../app/globals.css",import.meta.url),"utf8");
  for(const selector of [".hmSite{",".hmHeader{",".hmHeroInner{",".hmPreview{",
    ".hmMarketCards{",".hmCapabilityGrid{",".hmEvidence{"]){
    assert.ok(css.includes(selector),"missing "+selector);
  }
  assert.match(css,/@media\(max-width:920px\)/);
  assert.match(css,/@media\(max-width:600px\)/);
  assert.match(css,/prefers-reduced-motion/);
  assert.match(css,/.hmSite a:focus-visible/);
});
