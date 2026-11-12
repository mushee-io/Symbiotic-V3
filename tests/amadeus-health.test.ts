import test from "node:test";
import assert from "node:assert/strict";
import {
  asHeight,
  inspectTestnet,
  InvalidChainDataError,
  type ChainReader,
} from "../lib/amadeus-health";

function sdkStub(tip: unknown, stats: unknown): ChainReader {
  return {
    chain: {
      getTip: async () => tip,
      getStats: async () => stats,
    },
  };
}
const tip = { entry: { header: { height: 101 } } };
const stats = { stats: { height: 101, rooted_height: 99 } };

test("reads native tip and rooted statistics as connected", async () => {
  const health = await inspectTestnet(sdkStub(tip, stats));
  assert.equal(health.network, "amadeus-testnet");
  assert.equal(health.height, 101);
  assert.equal(health.statsHeight, 101);
  assert.equal(health.rootedHeight, 99);
  assert.match(health.checkedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("accepts safe decimal-encoded heights and plausible endpoint timing differences", async () => {
  const health = await inspectTestnet(sdkStub(
    { entry: { header: { height: "103" } } },
    { stats: { height: "104", rooted_height: "102" } },
  ));
  assert.equal(health.height, 103);
  assert.equal(health.rootedHeight, 102);
});

test("rejects malformed, unsafe or negative heights", () => {
  for (const value of [null, undefined, NaN, Infinity, -1, 1.5, "1.0", "1e3", "001", "abc", {}, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => asHeight(value, "height"), InvalidChainDataError);
  }
  assert.equal(asHeight(0, "height"), 0);
});

test("fails closed if the RPC returns a malformed native tip", async () => {
  for (const broken of [undefined, null, {}, { entry: {} }, { entry: { header: { height: -1 } } }]) {
    await assert.rejects(inspectTestnet(sdkStub(broken, stats)), InvalidChainDataError);
  }
});

test("fails closed for missing or incoherent chain statistics", async () => {
  for (const broken of [
    undefined,
    { stats: {} },
    { stats: { height: 99, rooted_height: 100 } },
    { stats: { height: 50, rooted_height: Number.POSITIVE_INFINITY } },
  ]) {
    await assert.rejects(inspectTestnet(sdkStub(tip, broken)), InvalidChainDataError);
  }
});

test("does not announce connectivity when either endpoint is unreachable", async () => {
  const chain: ChainReader["chain"] = {
    getTip: async () => tip,
    getStats: async () => { throw new Error("RPC unavailable"); },
  };
  await assert.rejects(inspectTestnet({ chain }), /RPC unavailable/);
});
