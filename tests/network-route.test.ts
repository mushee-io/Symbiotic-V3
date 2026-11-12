import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/network/route";
import { AMA_TESTNET_RPC } from "../lib/amadeus";

async function withRpcMock(
  mock: typeof fetch,
  check: () => Promise<void>,
) {
  const originalFetch = globalThis.fetch;
  const originalEnv = process.env.AMADEUS_RPC_URL;
  delete process.env.AMADEUS_RPC_URL;
  globalThis.fetch = mock;
  try {
    await check();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalEnv === undefined) delete process.env.AMADEUS_RPC_URL;
    else process.env.AMADEUS_RPC_URL = originalEnv;
  }
}

test("health route returns 200, verified tip/stats and no-store headers", async () => {
  await withRpcMock(async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === AMA_TESTNET_RPC + "/chain/tip") {
      return Response.json({ error: "ok", entry: { header: { height: 200 } } });
    }
    if (url === AMA_TESTNET_RPC + "/chain/stats") {
      return Response.json({ error: "ok", stats: { height: 200, rooted_height: 199 } });
    }
    throw new Error("Unexpected destination");
  }, async () => {
    const response = await GET();
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control") || "", /no-store/);
    assert.equal(data.network, "amadeus-testnet");
    assert.equal(data.height, 200);
    assert.equal(data.rootedHeight, 199);
    assert.equal(data.tradingEnabled, false);
    assert.equal(data.contractsVerified, false);
  });
});

test("health route returns 503 and null heights when SDK RPC fails", async () => {
  await withRpcMock(async () => Response.json({ error: "unavailable" }, { status: 503 }), async () => {
    const response = await GET();
    const data = await response.json();
    assert.equal(response.status, 503);
    assert.equal(data.status, "unavailable");
    assert.equal(data.height, null);
    assert.equal(data.reason, "rpc_unavailable");
    assert.equal(data.tradingEnabled, false);
    assert.match(response.headers.get("cache-control") || "", /no-store/);
  });
});

test("health route rejects bad chain values with 503, never reports connected", async () => {
  await withRpcMock(async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    return Response.json(url.endsWith("/tip")
      ? { error: "ok", entry: { header: { height: -11 } } }
      : { error: "ok", stats: { height: 10, rooted_height: 5 } });
  }, async () => {
    const response = await GET();
    const data = await response.json();
    assert.equal(response.status, 503);
    assert.equal(data.reason, "invalid_chain_data");
    assert.equal(data.height, null);
  });
});

test("misconfigured mainnet URL fails closed without fetching anywhere", async () => {
  await withRpcMock(async () => { throw new Error("fetch must never be called"); }, async () => {
    process.env.AMADEUS_RPC_URL = "https://mainnet-rpc.ama.one/api";
    const response = await GET();
    const data = await response.json();
    assert.equal(response.status, 503);
    assert.equal(data.reason, "unsafe_rpc_config");
  });
});
