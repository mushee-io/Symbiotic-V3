import test from "node:test";
import assert from "node:assert/strict";
import {
  AMA_TESTNET_RPC,
  nativeTestnetSdk,
  resolveTestnetRpc,
  UnsafeRpcConfigError,
} from "../lib/amadeus";
import { inspectTestnet } from "../lib/amadeus-health";

test("always constructs the official native testnet SDK, never default mainnet", () => {
  assert.equal(resolveTestnetRpc(undefined), AMA_TESTNET_RPC);
  const sdk = nativeTestnetSdk(undefined);
  assert.equal(sdk.getConfig().baseUrl, AMA_TESTNET_RPC);
  assert.equal(sdk.getConfig().timeout, 6000);
});

test("rejects mainnet, blanks, alternate hosts and insecure URL without fallback", () => {
  for (const url of [
    "",
    "https://mainnet-rpc.ama.one/api",
    "http://testnet-rpc.ama.one/api",
    "https://testnet-rpc.ama.one/api/",
    "https://example.com/api",
    "https://testnet-rpc.ama.one/api?mode=mainnet",
  ]) {
    assert.throws(() => nativeTestnetSdk(url), UnsafeRpcConfigError);
  }
});

test("uses the SDK's real chain-tip and stats HTTP routes on the pinned host", async () => {
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    urls.push(url);
    if (url === AMA_TESTNET_RPC + "/chain/tip") {
      return Response.json({ error: "ok", entry: { header: { height: 146 } } });
    }
    if (url === AMA_TESTNET_RPC + "/chain/stats") {
      return Response.json({ error: "ok", stats: { height: 147, rooted_height: 145 } });
    }
    throw new Error("Unexpected HTTP destination: " + url);
  };
  try {
    const result = await inspectTestnet(nativeTestnetSdk(undefined));
    assert.equal(result.height, 146);
    assert.equal(result.rootedHeight, 145);
    assert.deepEqual(
      urls.sort(),
      [AMA_TESTNET_RPC + "/chain/tip", AMA_TESTNET_RPC + "/chain/stats"].sort(),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("an SDK HTTP failure never becomes an invented chain height", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ error: "node_unavailable" }, { status: 503 });
  try {
    await assert.rejects(inspectTestnet(nativeTestnetSdk(undefined)));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
