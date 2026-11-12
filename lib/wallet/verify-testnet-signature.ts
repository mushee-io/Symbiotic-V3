import { bls12_381 } from "@noble/curves/bls12-381";
import { sha256 } from "@noble/hashes/sha2";
import {
  decode, encode, fromBase58, toBase58,
  NetworkType, txDstForNetwork,
  type DecodedValue,
} from "@amadeus-protocol/sdk";
import { isAmaAddress } from "../amadeus-wallet";

/**
 * Protects the ONLY wallet-approved path that can create a native test token.
 * Independently checks the precise Coin call, signer, canonical transaction
 * hash and BLS TESTNET domain before ever forwarding bytes to the network.
 * No raw seed, public RPC override, arbitrary contract or unreviewed amount.
 */
export class NativeSigningError extends Error {
  constructor(public readonly code:
    | "malformed_signed_payload"
    | "wrong_signed_account"
    | "unexpected_signed_action"
    | "signed_hash_mismatch"
    | "wrong_signing_network") {
    super(code);
    this.name = "NativeSigningError";
  }
}

export type ExactNativeCall = Readonly<{
  contract: string;
  method: string;
  args: readonly string[];
}>;

export type VerifiedTestnetSignature = Readonly<{
  txHash: string;
  txPacked: Uint8Array;
  signingNetwork: "testnet";
}>;

const MAX_PACKED_BYTES = 65536;
const decoder = new TextDecoder("utf-8", { fatal: true });
const encoder = new TextEncoder();

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let different = 0;
  for (let i = 0; i < a.length; i++) different |= a[i] ^ b[i];
  return different === 0;
}

function asMap(value: DecodedValue): Map<DecodedValue,DecodedValue> {
  if (!(value instanceof Map)) throw new NativeSigningError("malformed_signed_payload");
  return value;
}

function asByteString(value: DecodedValue | undefined): Uint8Array {
  if (!(value instanceof Uint8Array)) throw new NativeSigningError("malformed_signed_payload");
  return value;
}

function requireExactKeys(map: Map<DecodedValue,DecodedValue>, allowed: readonly string[]) {
  if (map.size !== allowed.length) throw new NativeSigningError("unexpected_signed_action");
  const keys: string[] = [];
  for (const key of map.keys()) {
    try { keys.push(decoder.decode(asByteString(key))); }
    catch { throw new NativeSigningError("malformed_signed_payload"); }
  }
  if (new Set(keys).size !== allowed.length ||
      keys.some(k => !allowed.includes(k))) {
    throw new NativeSigningError("unexpected_signed_action");
  }
}

function item(map: Map<DecodedValue,DecodedValue>, key: string): DecodedValue {
  for (const [field, value] of map) {
    if (field instanceof Uint8Array) {
      try { if (decoder.decode(field) === key) return value; }
      catch { throw new NativeSigningError("malformed_signed_payload"); }
    }
  }
  throw new NativeSigningError("malformed_signed_payload");
}

function matchesString(value: DecodedValue, expected: string): boolean {
  return value instanceof Uint8Array &&
    equalBytes(value, encoder.encode(expected));
}

function packedBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) {
    if (value.length < 128 || value.length > MAX_PACKED_BYTES) {
      throw new NativeSigningError("malformed_signed_payload");
    }
    return value;
  }
  if (!Array.isArray(value) || value.length < 128 ||
      value.length > MAX_PACKED_BYTES ||
      !value.every(x => typeof x === "number" && Number.isInteger(x) && x >= 0 && x <= 255)) {
    throw new NativeSigningError("malformed_signed_payload");
  }
  return Uint8Array.from(value);
}

/**
 * Verify a wallet's real signed VecPak payload, rather than trusting its
 * self-reported getNetwork() response or the requesting dApp's parameters.
 * Signing on mainnet produces a DIFFERENT BLS DST and is never broadcast.
 */
export function verifyExactTestnetSignedCall(
  result: unknown, owner: string, expected: ExactNativeCall,
): VerifiedTestnetSignature {
  if (!isAmaAddress(owner)) throw new NativeSigningError("wrong_signed_account");
  if (!result || typeof result !== "object") {
    throw new NativeSigningError("malformed_signed_payload");
  }
  const data = result as Record<string,unknown>;
  if (typeof data.txHash !== "string") {
    throw new NativeSigningError("malformed_signed_payload");
  }
  const bytes = packedBytes(data.txPacked);
  let txHashBytes: Uint8Array;
  try { txHashBytes = fromBase58(data.txHash); }
  catch { throw new NativeSigningError("malformed_signed_payload"); }
  if (txHashBytes.length !== 32 || toBase58(txHashBytes) !== data.txHash) {
    throw new NativeSigningError("malformed_signed_payload");
  }

  let decoded: DecodedValue;
  try { decoded = decode(bytes); }
  catch { throw new NativeSigningError("malformed_signed_payload"); }
  const outer = asMap(decoded);
  requireExactKeys(outer, ["tx", "hash", "signature"]);
  const tx = asMap(item(outer,"tx"));
  requireExactKeys(tx, ["signer", "nonce", "action"]);

  const signer = asByteString(item(tx,"signer"));
  if (!equalBytes(signer, fromBase58(owner))) {
    throw new NativeSigningError("wrong_signed_account");
  }
  const nonce=item(tx,"nonce");
  if (typeof nonce !== "bigint" || nonce <= 0n) {
    throw new NativeSigningError("malformed_signed_payload");
  }
  const action=asMap(item(tx,"action"));
  requireExactKeys(action,["op","contract","function","args"]);
  const args=item(action,"args");
  if (!matchesString(item(action,"op"),"call") ||
      !matchesString(item(action,"contract"),expected.contract) ||
      !matchesString(item(action,"function"),expected.method) ||
      !Array.isArray(args) || args.length !== expected.args.length ||
      args.some((arg,i)=>!matchesString(arg,expected.args[i]))) {
    throw new NativeSigningError("unexpected_signed_action");
  }

  const hash=asByteString(item(outer,"hash"));
  const signature=asByteString(item(outer,"signature"));
  if (hash.length !== 32 || signature.length !== 96 ||
      !equalBytes(hash,txHashBytes) ||
      !equalBytes(sha256(encode(tx)), hash)) {
    throw new NativeSigningError("signed_hash_mismatch");
  }
  let valid=false;
  try {
    valid=bls12_381.verify(signature,hash,signer,{
      DST:txDstForNetwork(NetworkType.TESTNET),
    });
  } catch {
    valid=false;
  }
  if (!valid) throw new NativeSigningError("wrong_signing_network");
  return { txHash:data.txHash, txPacked:bytes, signingNetwork:"testnet" };
}
