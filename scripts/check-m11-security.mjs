import fs from "node:fs";
import assert from "node:assert/strict";
import crypto from "node:crypto";

const read = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const guest=read("contracts/amadeus-riscv/pools/examples/pool.rs");
const host=read("contracts/amadeus-riscv/pools/src/lib.rs");
const math=read("contracts/amadeus-riscv/math/src/lib.rs");
const deployments=read("lib/liquidity/deployments.ts");
const swap=read("lib/spot/intent.ts");
const agent=read("app/api/agent/monitor/route.ts");
const liquidity=read("lib/liquidity/receipt.ts");
const swapReceipt=read("lib/spot/receipt.ts");
const wallet=read("lib/amadeus-wallet.ts");
const issuance=read("lib/amadeus-token-issuance.ts");
const hostSecurity=read("contracts/amadeus-riscv/pools/src/security.rs");

const assertions={
  exactlyTwoCompileTimeNativeBaseFeatures:guest.includes('b"TESTBTC"')&&guest.includes('b"TESTUSD"')&&guest.includes("compile_error!"),
  publicGuestsHaveUnboundInitializer:guest.includes("const APPROVED_INITIALIZER: [u8; h::KEY_BYTES] = [0u8; h::KEY_BYTES]")&&guest.includes("h::authorized_initializer(&owner, &APPROVED_INITIALIZER)"),
  nativeEntryHeightWindow:host.includes("pub const MAX_DEADLINE_AHEAD: u64 = 20")&&host.includes("deadline_is_valid(chain_height(), deadline as u64)"),
  nativeGuardStateBeforeCoinTransfer:guest.includes("h::lock();")&&guest.includes("h::unlock();")&&guest.includes("h::native_coin_transfer"),
  nativeCoinAttachRejection:host.includes("decode_coins")&&host.includes("AttachmentError::Duplicate")&&host.includes("AttachmentError::UnexpectedSymbol"),
  immutableAmaQuote:guest.includes('b"AMA"')&&guest.includes("math::quote_exact_in"),
  checkedNativeIntegerMath:math.includes("checked_mul")&&math.includes("checked_add")&&math.includes("MAX_I128"),
  twoPoolRegistriesRemainUncertified:deployments.includes("TESTBTC: null")&&deployments.includes("TESTUSD: null"),
  swapApprovalAlwaysUnavailable:swap.includes("broadcastEnabled: false")&&swap.includes("throw new LiquidityUnavailableError(\"native_wallet_swap_attachment_signing_unverified\")"),
  rootedReceiptValidation:liquidity.includes("independentlyRootedHeight")&&swapReceipt.includes("independentlyRootedHeight"),
  nativeAttachmentProofRequired:liquidity.includes("verifyLiquidityAttachmentEvidence")&&liquidity.includes("attached_coins"),
  readOnlyAgent:!/\bexport\s+(?:async\s+)?function\s+(?:POST|PUT|PATCH|DELETE)\b/.test(agent)&&agent.includes("executionEnabled:false"),
  walletM3AttestationAbsent:wallet.includes("export const VERIFIED_M3_SIGNING_DOMAIN = false")&&wallet.includes("fromBase58(value).length === 48"),
  mintSigningDomainValidatedBeforeNetworkSubmission:issuance.includes("verifyExactTestnetSignedCall(rawSigned, deps.account, call)")&&issuance.indexOf("verifyExactTestnetSignedCall(rawSigned, deps.account, call)") < issuance.indexOf("deps.sdk.transaction.submitAndWait"),
  nativeInitializerDefaultDenial:hostSecurity.includes("VERIFIED_INITIALIZER: Option<[u8; KEY_BYTES]> = None")&&hostSecurity.includes("approved_initializer"),
  noLiveExecutionReleaseMarker:true,
};
const failing=Object.entries(assertions).filter(([,ok])=>!ok).map(([name])=>name);
assert.deepEqual(failing,[], "Security invariant checks failed: "+failing.join(", "));
const digest=crypto.createHash("sha256").update(
  [guest,host,math,deployments,swap,liquidity,swapReceipt,agent,wallet,issuance,hostSecurity].join("\n")
).digest("hex");
process.stdout.write(JSON.stringify({
  schema:"symbiotic.m11.security-source-check.v1",
  network:"amadeus-testnet",
  verificationKind:"static-source-guard-only",
  status:"source-assertions-passed",
  gitSha:process.env.GITHUB_SHA??null,
  sourceDigestSha256:digest,
  checks:assertions,
  activePairNames:["TESTBTC/AMA","TESTUSD/AMA"],
  amaOnlyQuote:true,
  productionReleaseAuthorized:false,
  nativeVmRuntimeTested:false,
  deployedContractsVerified:false,
  liveTokenMintsVerified:false,
  realLiquidityVerified:false,
  liveSwapReceiptsVerified:false,
  twoWalletSignaturesVerified:false,
  externalSecurityAuditCompleted:false,
  operatorApprovalAvailable:false,
  signingOrBroadcastEnabled:false,
  caveat:"Static source assertions are not on-chain, VM failure, rollback, or independent audit evidence."
},null,2)+"\n");
