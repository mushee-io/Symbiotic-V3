import assert from "node:assert/strict";
import { test } from "node:test";
import { minOutputAfterSlippage, quoteSpotExactIn } from "../lib/amadeus-spot";

test("AMA-to-test-token and test-token-to-AMA quotes do not drain the pool", () => {
  const reserves = { amaAtomic: 1_000_000_000n, baseAtomic: 500_000_000n };
  for (const side of ["BUY", "SELL"] as const) {
    const q = quoteSpotExactIn(reserves, side, 10_000_000n);
    assert.ok(q.amountOutAtomic > 0n);
    assert.ok(q.minReserveOutAtomic > 0n);
    assert.ok(q.feeInputAtomic >= 0n);
  }
});

test("spot quote rejects nonexistent liquidity and invalid inputs", () => {
  assert.throws(() => quoteSpotExactIn({ amaAtomic: 0n, baseAtomic: 100n }, "BUY", 10n));
  assert.throws(() => quoteSpotExactIn({ amaAtomic: 100n, baseAtomic: 100n }, "BUY", 0n));
  assert.throws(() => quoteSpotExactIn({ amaAtomic: 100n, baseAtomic: 100n }, "BUY", 10n, 10000));
});

test("minimum output is integer and bounded", () => {
  assert.equal(minOutputAfterSlippage(10000n, 50), 9950n);
  assert.throws(() => minOutputAfterSlippage(10000n, 2000));
});
