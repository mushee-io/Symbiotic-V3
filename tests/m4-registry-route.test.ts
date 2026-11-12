import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/tokens/status/route";
import { AMA_TESTNET_RPC } from "../lib/amadeus";

const keyText = new TextDecoder();

async function withMock(
  responder: (path: string, key: string | null) => Response,
  check: (requests: string[]) => Promise<void>,
) {
  const oldFetch = globalThis.fetch;
  const oldRpc = process.env.AMADEUS_RPC_URL;
  const calls: string[] = [];
  delete process.env.AMADEUS_RPC_URL;
  globalThis.fetch = async (request, init) => {
    const url = request instanceof Request ? request.url : String(request);
    assert.ok(url.startsWith(AMA_TESTNET_RPC + "/"));
    const key = init?.body instanceof Uint8Array ?
      keyText.decode(init.body) : null;
    calls.push(url + (key === null ? "" : " :: " + key));
    return responder(url, key);
  };
  try { await check(calls); } finally {
    globalThis.fetch = oldFetch;
    if (oldRpc === undefined) delete process.env.AMADEUS_RPC_URL;
    else process.env.AMADEUS_RPC_URL = oldRpc;
  }
}

function healthy(path: string, key: string | null): Response {
  if (path.endsWith("/chain/tip")) return Response.json({ error: "ok", entry: { header: { height: 200 } } });
  if (path.endsWith("/chain/stats")) return Response.json({ error: "ok", stats: { height: 200, rooted_height: 199 } });
  if (path.endsWith("/contract/get")) {
    if (key === "coin:TESTBTC:totalSupply") return Response.json(null);
    if (key === "coin:TESTUSD:totalSupply") return Response.json("1000000000000000");
  }
  return Response.json({ error: "not_found" }, { status: 404 });
}

test("checks exactly two native Coin states with no extra token or exchange claims", async () => {
  await withMock(healthy, async (calls) => {
    const r = await GET();
    const body = await r.json();
    assert.equal(r.status, 200);
    assert.match(r.headers.get("cache-control") || "", /no-store/);
    assert.equal(body.mintingEnabled, false);
    assert.equal(body.tradingEnabled, false);
    assert.equal(body.tokens.length, 2);
    assert.equal(body.tokens[0].symbol, "TESTBTC");
    assert.equal(body.tokens[0].status, "unregistered");
    assert.equal(body.tokens[1].symbol, "TESTUSD");
    assert.equal(body.tokens[1].status, "registered");
    assert.equal(body.tokens[1].supplyAtomic, "1000000000000000");
    assert.equal(calls.filter(x => x.includes(" :: ")).length, 2);
    assert.equal(calls.some(x => x.includes("TESTETH")), false);
  });
});

test("unknown token state fails closed rather than mislabeling symbol as available", async () => {
  await withMock((path, key) => {
    if (path.endsWith("/contract/get") && key === "coin:TESTBTC:totalSupply") {
      return Response.json({ unexpected: "payload" });
    }
    return healthy(path, key);
  }, async () => {
    const r = await GET();
    const body = await r.json();
    assert.equal(r.status, 503);
    assert.equal(body.status, "unavailable");
    assert.deepEqual(body.tokens, []);
  });
});

test("public RPC outage rejects issuance registry reads and never falls back to mainnet", async () => {
  await withMock(() => Response.json({ error: "unavailable" }, { status: 503 }), async () => {
    const r = await GET();
    const body = await r.json();
    assert.equal(r.status, 503);
    assert.equal(body.mintingEnabled, false);
  });
});

test("disallowed alternate RPC never fetches any endpoint", async () => {
  await withMock(() => { throw new Error("no request expected"); }, async (calls) => {
    process.env.AMADEUS_RPC_URL = "https://mainnet-rpc.ama.one/api";
    const r = await GET();
    assert.equal(r.status, 503);
    assert.equal(calls.length, 0);
  });
});
