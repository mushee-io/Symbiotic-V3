import test from "node:test";
import assert from "node:assert/strict";
import {
  accountFromWalletEvent,
  checkWalletNetwork,
  findAmadeusProvider,
  isAmaAddress,
  requestAmaAccount,
  signingReadiness,
  WalletConnectionError,
  type AmadeusWalletProvider,
} from "../lib/amadeus-wallet";

const ADDRESS_ONE = "2".repeat(65);
const ADDRESS_TWO = "3".repeat(65);

function mockWallet(account: string): AmadeusWalletProvider {
  return {
    isAmadeus: true,
    requestAccounts: async () => [account],
    signTransaction: async () => { throw new Error("should never be invoked in M3"); },
  };
}

test("detects only official-style injected native provider without requesting permission", () => {
  assert.equal(findAmadeusProvider({}), null);
  assert.equal(findAmadeusProvider({ requestAccounts: async () => [] }), null);
  assert.equal(findAmadeusProvider({ isAmadeus: true }), null);
  const p = mockWallet(ADDRESS_ONE);
  assert.equal(findAmadeusProvider(p), p);
});

test("two different mock wallets can authorize different public accounts", async () => {
  assert.equal(await requestAmaAccount(mockWallet(ADDRESS_ONE)), ADDRESS_ONE);
  assert.equal(await requestAmaAccount(mockWallet(ADDRESS_TWO)), ADDRESS_TWO);
  assert.notEqual(ADDRESS_ONE, ADDRESS_TWO);
});

test("rejects invalid account formats, missing accounts and keys", async () => {
  for (const value of [
    [], [""], ["0x" + "f".repeat(40)], ["seed phrase private key"],
    ["bad!"], [null], { address: ADDRESS_ONE },
  ]) {
    await assert.rejects(
      requestAmaAccount({ isAmadeus: true, requestAccounts: async () => value }),
      WalletConnectionError,
    );
  }
  assert.equal(isAmaAddress(ADDRESS_ONE), true);
  assert.equal(isAmaAddress("0x" + "f".repeat(40)), false);
});

test("user rejection is handled without revealing arbitrary exception data", async () => {
  await assert.rejects(
    requestAmaAccount({
      isAmadeus: true,
      requestAccounts: async () => { throw new Error("sensitive wallet error"); },
    }),
    (err: unknown) => err instanceof WalletConnectionError &&
      err.code === "rejected" &&
      !err.message.includes("sensitive"),
  );
});

test("account-change event safely selects or clears account", () => {
  assert.equal(accountFromWalletEvent([ADDRESS_TWO]), ADDRESS_TWO);
  assert.equal(accountFromWalletEvent([]), null);
  assert.equal(accountFromWalletEvent(["not an address"]), null);
});

test("official documented provider without network attestation fails closed", async () => {
  const p = mockWallet(ADDRESS_ONE);
  assert.equal(await checkWalletNetwork(p), "unverified");
  assert.equal(signingReadiness(p, ADDRESS_ONE, "unverified", true), false);
  assert.equal(signingReadiness(p, ADDRESS_ONE, "testnet", false), false);
});

test("optional network reporting allows only strict testnet match", async () => {
  const p = mockWallet(ADDRESS_ONE);
  p.getNetwork = async () => "testnet";
  assert.equal(await checkWalletNetwork(p), "testnet");
  assert.equal(signingReadiness(p, ADDRESS_ONE, "testnet", true), true);
  p.getNetwork = async () => ({ network: "amadeus-testnet" });
  assert.equal(await checkWalletNetwork(p), "testnet");
  for (const name of ["mainnet", "not-testnet", "TESTNET", "something"]) {
    p.getNetwork = async () => name;
    assert.equal(await checkWalletNetwork(p), "wrong_network");
  }
  p.getNetwork = async () => { throw new Error("network unknown"); };
  assert.equal(await checkWalletNetwork(p), "unverified");
  p.getNetwork = async () => ({ chainId: 1 });
  assert.equal(await checkWalletNetwork(p), "unverified");
});
