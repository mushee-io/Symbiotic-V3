import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SetupPage from "../app/setup/page";
import { TokenIssuancePanel } from "../components/TokenIssuancePanel";

test("real native setup page offers extension, official faucet and wallet-first testnet steps",()=>{
  const html=renderToStaticMarkup(createElement(SetupPage));
  assert.match(html,/Make the testnet/);
  assert.match(html,/Connect AMA wallet/);
  assert.match(html,/Fund your test wallet/);
  assert.match(html,/Official testnet faucet/);
  assert.match(html,/testnet-faucet/);
  assert.match(html,/Verify and mint/);
  assert.match(html,/Native RPC not verified|Checking public Amadeus testnet/);
  assert.match(html,/No automatic signing/);
  assert.match(html,/href="\/trade"/);
  assert.match(html,/href="\/demo"/);
  assert.doesNotMatch(html,/Live market making enabled/);
});

test("native issuance UI displays testnet domain consent and two unavailable unregistered tokens",()=>{
  const html=renderToStaticMarkup(createElement(TokenIssuancePanel,{
    provider:null,account:null,network:"unverified",rpcHealthy:false,
  }));
  assert.match(html,/Native test-token issuance/);
  assert.match(html,/TESTBTC \/ AMA/);
  assert.match(html,/TESTUSD \/ AMA/);
  assert.match(html,/cryptographically rejects mainnet signatures/);
  assert.match(html,/I have selected/);
  assert.match(html,/Approve &amp; mint TESTBTC/);
  assert.match(html,/Approve &amp; mint TESTUSD/);
  assert.match(html,/disabled=""/);
  assert.match(html,/M3 acceptance/);
  assert.doesNotMatch(html,/Mint succeeded/);
});

test("home and trading terminal explicitly link to user-run native testnet setup",async()=>{
  const Home=(await import("../app/page")).default;
  const Trade=(await import("../app/trade/page")).default;
  assert.match(renderToStaticMarkup(createElement(Home)),/href="\/setup"/);
  assert.match(renderToStaticMarkup(createElement(Trade)),/href="\/setup"/);
});
