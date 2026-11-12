import test from "node:test";
import { toBase58 } from "@amadeus-protocol/sdk";
import assert from "node:assert/strict";
import { parseAmaBalance, InvalidWalletBalanceError } from "../lib/ama-balance";
import { GET } from "../app/api/wallet/balance/route";
import { AMA_TESTNET_RPC } from "../lib/amadeus";

const ADDRESS = toBase58(new Uint8Array(48).fill(2));

function validBalance(float: number, symbol: string = "AMA") {
  return { error: "ok", balance: { float, flat: float * 1e9, symbol } };
}

test("accepts valid actual SDK AMA balance envelope, including real zero", () => {
  const b = parseAmaBalance(validBalance(15), ADDRESS);
  assert.equal(b.amount, "15");
  assert.equal(b.network, "amadeus-testnet");
  const zero = parseAmaBalance(validBalance(0), ADDRESS);
  assert.equal(zero.amount, "0");
});

test("fails closed for invalid, negative, missing or misquoted AMA balances", () => {
  for (const payload of [
    null, {}, { balance: {} }, { balance: { float: NaN, flat: 0, symbol: "AMA" } },
    { balance: { float: -5, flat: -5000000000, symbol: "AMA" } },
    { balance: { float: 12, flat: 12000000000, symbol: "OTHER" } },
  ]) assert.throws(() => parseAmaBalance(payload, ADDRESS), InvalidWalletBalanceError);
});

async function withFetchStub(
  callback: (url: string) => Response,
  check: () => Promise<void>,
) {
  const originalFetch = globalThis.fetch;
  const originalRpc = process.env.AMADEUS_RPC_URL;
  delete process.env.AMADEUS_RPC_URL;
  const urls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    urls.push(url);
    return callback(url);
  };
  try {
    await check();
    assert.ok(urls.every((url) => url.startsWith(AMA_TESTNET_RPC + "/")));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalRpc === undefined) delete process.env.AMADEUS_RPC_URL;
    else process.env.AMADEUS_RPC_URL = originalRpc;
  }
}

function testnetResponse(url: string): Response {
  if (url === AMA_TESTNET_RPC + "/chain/tip") {
    return Response.json({ error: "ok", entry: { header: { height: 100 } } });
  }
  if (url === AMA_TESTNET_RPC + "/chain/stats") {
    return Response.json({ error: "ok", stats: { height: 100, rooted_height: 99 } });
  }
  if (url === AMA_TESTNET_RPC + "/wallet/balance/" + ADDRESS) return Response.json(validBalance(11.75));
  return Response.json({ error: "not_found" }, { status: 404 });
}

test("wallet balance API queries only native AMA on pinned testnet", async () => {
  await withFetchStub(testnetResponse, async () => {
    const r = await GET(new Request("https://symbiotic.example/api/wallet/balance?address=" + ADDRESS));
    const data = await r.json();
    assert.equal(r.status, 200);
    assert.equal(data.network, "amadeus-testnet");
    assert.equal(data.address, ADDRESS);
    assert.equal(data.symbol, "AMA");
    assert.equal(data.amount, "11.75");
    assert.match(r.headers.get("cache-control") || "", /no-store/);
  });
});

test("balance API rejects invalid public address before RPC calls", async () => {
  await withFetchStub(() => { throw new Error("should not fetch"); }, async () => {
    const r = await GET(new Request("https://symbiotic.example/api/wallet/balance?address=0xdeadbeef"));
    assert.equal(r.status, 400);
    assert.equal((await r.json()).balance, null);
  });
});

test("unreachable balance API fails closed without fabricated zero", async () => {
  await withFetchStub((url) => {
    if (url.endsWith("/chain/tip")) return testnetResponse(url);
    if (url.endsWith("/chain/stats")) return testnetResponse(url);
    return Response.json({ error: "node_unavailable" }, { status: 503 });
  }, async () => {
    const r = await GET(new Request("https://symbiotic.example/api/wallet/balance?address=" + ADDRESS));
    assert.equal(r.status, 503);
    assert.equal((await r.json()).balance, null);
  });
});

test("wrong RPC network configuration never requests mainnet balance", async () => {
  await withFetchStub(() => { throw new Error("should never fetch"); }, async () => {
    process.env.AMADEUS_RPC_URL = "https://mainnet-rpc.ama.one/api";
    const r = await GET(new Request("https://symbiotic.example/api/wallet/balance?address=" + ADDRESS));
    const data = await r.json();
    assert.equal(r.status, 503);
    assert.equal(data.reason, "unsafe_rpc_config");
  });
});
