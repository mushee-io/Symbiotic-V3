import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/home.module.css", import.meta.url), "utf8");

test("homepage follows the supplied Symbasis reference and uses Amadeus Protocol", () => {
  for (const text of ["SYMBASIS", "Private AI", "perpetual infrastructure", "for global markets.", "Structure brings volatility into focus.", "There is", "volatility.", "Amadeus Protocol"]) assert.ok(home.includes(text), text);
  assert.doesNotMatch(home, /Horiz[eo]n|2651420/i);
  assert.match(home, /Live swaps and perpetual execution are not yet available/);
});

test("homepage navigation targets existing terminal sections and evidence routes", () => {
  const trade = readFileSync(new URL("../app/trade/page.tsx", import.meta.url), "utf8");
  const components = ["AmadeusWalletPanel", "NativeLiquidityPanel", "TokenIssuancePanel"].map(name => readFileSync(new URL(`../components/${name}.tsx`, import.meta.url), "utf8")).join("\n");
  for (const target of [...home.matchAll(/\/trade#([\w-]+)/g)].map(match => match[1])) assert.ok((trade + components).includes(`id="${target}"`), `missing target ${target}`);
  assert.match(home, /const terminal = "\/trade"/);
  assert.match(home, /href="\/demo"/);
  assert.match(home, /href="\/roadmap"/);
  assert.match(home, /https:\/\/testnet.explorer.ama.one/);
});

test("homepage styles stay scoped and support mobile and keyboard navigation", () => {
  assert.match(home, /import styles from "\.\/home.module.css"/);
  assert.doesNotMatch(css, /(?:^|\})\s*(?:body|html|:root)\s*\{/);
  assert.match(css, /@media\(max-width:650px\)/);
  assert.match(css, /:focus-visible/);
  assert.match(home, /aria-label="Main navigation"/);
  assert.match(home, /<details/);
  assert.match(home, /<summary>More<\/summary>/);
});
