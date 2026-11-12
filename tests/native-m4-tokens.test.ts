import test from "node:test";
import assert from "node:assert/strict";
import { AmadeusSDK, toBase58 } from "@amadeus-protocol/sdk";
import {
  M4_TEST_TOKENS, TokenIssuanceError, buildNativeMintCall,
  requireM4Symbol, validateTokenDefinition, parseTotalSupply,
  readTokenRegistration, supplyKey, requireIssuer,
} from "../lib/amadeus-tokens";
import {
  parseSignedMint, issueNativeTestToken, verifyNativeMint,
} from "../lib/amadeus-token-issuance";
import type { AmadeusWalletProvider } from "../lib/amadeus-wallet";

const OWNER = toBase58(new Uint8Array(48).fill(2));
const HASH = toBase58(new Uint8Array(32).fill(3));
const AMOUNT = "1000000000000000";

test("M4 is exactly two unique test assets quoted only in AMA", () => {
  assert.deepEqual(M4_TEST_TOKENS.map(x => x.symbol), ["TESTBTC", "TESTUSD"]);
  assert.deepEqual(M4_TEST_TOKENS.map(x => x.pair), ["TESTBTC/AMA", "TESTUSD/AMA"]);
  for (const t of M4_TEST_TOKENS) {
    const v = validateTokenDefinition(t.symbol);
    assert.equal(v.decimals, 9);
    assert.equal(v.atomicSupply, AMOUNT);
    assert.equal(v.mintable, false);
    assert.equal(v.pausable, false);
    assert.equal(v.soulbound, false);
  }
  for (const value of ["AMA", "BTC", "TESTETH", "TESTBTC/ETH", null, "", "testusd"]) {
    assert.throws(() => requireM4Symbol(value), TokenIssuanceError);
  }
});

test("Coin create_and_mint matches native six-argument Rust contract ABI", () => {
  for (const token of M4_TEST_TOKENS) {
    assert.deepEqual(buildNativeMintCall(token.symbol), {
      contract: "Coin",
      method: "create_and_mint",
      args: [token.symbol, AMOUNT, "9", "false", "false", "false"],
      description: "Issue 1000000 test " + token.symbol + " (" + token.symbol + "/AMA) on Amadeus testnet",
    });
    assert.equal(new TextDecoder().decode(supplyKey(token.symbol)), "coin:" + token.symbol + ":totalSupply");
  }
});

test("zero supply is registered; only explicit null means absent", async () => {
  assert.equal(parseTotalSupply(null), null);
  assert.equal(parseTotalSupply("0"), 0n);
  assert.equal((await readTokenRegistration({ contract: { get: async () => "0" } }, "TESTBTC")).status, "registered");
  assert.equal((await readTokenRegistration({ contract: { get: async () => null } }, "TESTUSD")).status, "unregistered");
  for (const bad of [undefined, {}, [], "", "-1", "1.5", "1e9", true, 100, "01"]) {
    assert.throws(() => parseTotalSupply(bad), TokenIssuanceError);
  }
});

test("requires public issuer, attested wallet testnet and healthy RPC", () => {
  assert.equal(requireIssuer(OWNER, "testnet", true), OWNER);
  assert.throws(() => requireIssuer(OWNER, "unverified", true), TokenIssuanceError);
  assert.throws(() => requireIssuer(OWNER, "mainnet", true), TokenIssuanceError);
  assert.throws(() => requireIssuer(OWNER, "testnet", false), TokenIssuanceError);
  assert.throws(() => requireIssuer("0x1234", "testnet", true), TokenIssuanceError);
});

test("signed payload cannot be empty, arbitrary object, unbounded, or invalid bytes", () => {
  const good = parseSignedMint({ txHash: HASH, txPacked: new Array(12).fill(1) });
  assert.equal(good.txPacked.length, 12);
  for (const bad of [
    null, {}, { txHash: "0x5", txPacked: [1,2,3,4,5,6,7,8] },
    { txHash: HASH, txPacked: [1,2,3] },
    { txHash: HASH, txPacked: new Array(12).fill(-1) },
    { txHash: HASH, txPacked: new Array(12).fill(256) },
    { txHash: HASH, txPacked: new Array(12).fill("1") },
    { txHash: HASH, txPacked: new Array(65537).fill(1) },
  ]) assert.throws(() => parseSignedMint(bad), TokenIssuanceError);
});

function fakeSdk(existing = false, outcomeSuccess = true, registeredCorrectly = true) {
  let submitted = 0, signed = 0, supplied = existing;
  const record = {
    chain: {
      getTip: async () => ({ entry: { header: { height: 100 } } }),
      getStats: async () => ({ stats: { height: 100, rooted_height: 99 } }),
    },
    contract: {
      get: async (_key: Uint8Array) => supplied ?
        registeredCorrectly ? AMOUNT : "4" : null,
    },
    wallet: {
      getBalance: async (_owner: string, symbol: string) => ({
        balance: { symbol, flat: Number(AMOUNT), float: 1000000 },
      }),
    },
    transaction: {
      submitAndWait: async (_packed: Uint8Array, opts: { finalized?: boolean }) => {
        submitted++;
        assert.equal(opts.finalized, true);
        supplied = true;
        return {
          hash: HASH,
          metadata: { entry_height: 101, status: "finalized" },
          receipt: { success: outcomeSuccess },
        };
      },
      get: async (_hash: string) => ({
        hash: HASH,
        tx: { signer: OWNER, action: { contract: "Coin", function: "create_and_mint" } },
        metadata: { entry_height: 101, status: "finalized" },
        receipt: { success: outcomeSuccess },
      }),
    },
  };
  const provider: AmadeusWalletProvider = {
    isAmadeus: true,
    requestAccounts: async () => [OWNER],
    signTransaction: async (call) => {
      signed++;
      assert.deepEqual(call.args, ["TESTBTC", AMOUNT, "9", "false", "false", "false"]);
      return { txHash: HASH, txPacked: new Array(12).fill(1) };
    },
  };
  return {
    sdk: record as unknown as AmadeusSDK, provider,
    calls: () => ({ submitted, signed }),
  };
}

test("M11: independent M3 attestation blocks an otherwise valid native mint before wallet signing", async () => {
  const fixture = fakeSdk();
  await assert.rejects(issueNativeTestToken({
    sdk: fixture.sdk, provider: fixture.provider, account: OWNER,
    network: "testnet", rpcHealthy: true,
  }, "TESTBTC"), (err: unknown) =>
    err instanceof TokenIssuanceError && err.code === "m3_two_wallet_signing_domain_unverified");
  assert.deepEqual(fixture.calls(), { submitted: 0, signed: 0 });
});

test("finalized native mint proof verifier remains independently testable WITHOUT broadcasting", async () => {
  const fixture = fakeSdk(true);
  const evidence={hash:HASH,metadata:{entry_height:101,status:"finalized"},receipt:{success:true}};
  const proof=await verifyNativeMint(fixture.sdk,"TESTBTC",OWNER,HASH,evidence);
  assert.equal(proof.status,"finalized");
  assert.equal(proof.hash,HASH);
  assert.equal(proof.pair,"TESTBTC/AMA");
  assert.equal(proof.supplyAtomic,AMOUNT);
  assert.deepEqual(fixture.calls(), { submitted: 0, signed: 0 });
});

test("existing global symbol is never signed or reissued", async () => {
  const fixture = fakeSdk(true);
  await assert.rejects(issueNativeTestToken({
    sdk: fixture.sdk, provider: fixture.provider, account: OWNER,
    network: "testnet", rpcHealthy: true,
  }, "TESTBTC"), TokenIssuanceError);
  assert.deepEqual(fixture.calls(), { submitted: 0, signed: 0 });
});

test("unverified wallet signing network does not request approval", async () => {
  const fixture = fakeSdk();
  await assert.rejects(issueNativeTestToken({
    sdk: fixture.sdk, provider: fixture.provider, account: OWNER,
    network: "unverified", rpcHealthy: true,
  }, "TESTBTC"), TokenIssuanceError);
  assert.deepEqual(fixture.calls(), { submitted: 0, signed: 0 });
});

test("a reverted execution receipt is not a successful mint", async () => {
  const fixture = fakeSdk(false, false);
  await assert.rejects(issueNativeTestToken({
    sdk: fixture.sdk, provider: fixture.provider, account: OWNER,
    network: "testnet", rpcHealthy: true,
  }, "TESTBTC"), TokenIssuanceError);
  assert.deepEqual(fixture.calls(), { submitted: 0, signed: 0 });
});

test("mint cannot be declared verified if supply differs on chain", async () => {
  const fixture = fakeSdk(false, true, false);
  await assert.rejects(issueNativeTestToken({
    sdk: fixture.sdk, provider: fixture.provider, account: OWNER,
    network: "testnet", rpcHealthy: true,
  }, "TESTBTC"), TokenIssuanceError);
  assert.deepEqual(fixture.calls(), { submitted: 0, signed: 0 });
});
