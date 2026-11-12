import test from "node:test";
import assert from "node:assert/strict";
import {
  NetworkType, toBase58, seed64ToKeypair, buildUnsigned, signUnsigned, decode, encode,
  type AmadeusSDK,
} from "@amadeus-protocol/sdk";
import {
  NativeSigningError, verifyExactTestnetSignedCall,
} from "../lib/wallet/verify-testnet-signature";
import { issueNativeTestToken } from "../lib/amadeus-token-issuance";
import { buildNativeMintCall, M4_TEST_TOKENS, TokenIssuanceError } from "../lib/amadeus-tokens";
import { VERIFIED_M3_SIGNING_DOMAIN } from "../lib/amadeus-wallet";

const [PK, SK]=seed64ToKeypair(new Uint8Array(64).fill(17));
const OWNER=toBase58(PK);
const CALL=buildNativeMintCall("TESTBTC");
const MINT_SUPPLY="1000000000000000";
function signed(
  network:NetworkType=NetworkType.TESTNET,
  method=CALL.method,
  args=[...CALL.args],
){
  return signUnsigned(buildUnsigned(PK,CALL.contract,method,args),SK,network);
}
function mustReject(code:NativeSigningError["code"],fn:()=>unknown){
  assert.throws(fn,(error:unknown)=>error instanceof NativeSigningError&&error.code===code);
}

test("M4 validates both native Coin mint definitions with cryptographic TESTNET signatures",()=>{
  for(const definition of M4_TEST_TOKENS){
    const call=buildNativeMintCall(definition.symbol);
    const v=signUnsigned(buildUnsigned(PK,call.contract,call.method,[...call.args]),SK,NetworkType.TESTNET);
    const proof=verifyExactTestnetSignedCall(v,OWNER,call);
    assert.equal(proof.txHash,v.txHash);
    assert.equal(proof.signingNetwork,"testnet");
    assert.deepEqual(Array.from(proof.txPacked),Array.from(v.txPacked));
    // Extension's official demo documents number[]; the SDK signs Uint8Array.
    const fromExtension=verifyExactTestnetSignedCall({
      txHash:v.txHash, txPacked:Array.from(v.txPacked),
    },OWNER,call);
    assert.deepEqual(fromExtension.txPacked, v.txPacked);
  }
});

test("M4 refuses a valid MAINNET signature despite matching hash, payload and account",()=>{
  const tx=signed(NetworkType.MAINNET);
  mustReject("wrong_signing_network",()=>verifyExactTestnetSignedCall(tx,OWNER,CALL));
  // Testnet signature is a different domain, NOT just an untrusted UI label.
  const testnet=signed(NetworkType.TESTNET);
  assert.equal(verifyExactTestnetSignedCall(testnet,OWNER,CALL).signingNetwork,"testnet");
  assert.equal(VERIFIED_M3_SIGNING_DOMAIN,false);
});

test("M4 refuses a perfectly signed DIFFERENT contract method, amount, issuer or token",()=>{
  mustReject("unexpected_signed_action",()=>verifyExactTestnetSignedCall(
    signed(NetworkType.TESTNET,"transfer"),OWNER,CALL));
  mustReject("unexpected_signed_action",()=>verifyExactTestnetSignedCall(
    signed(NetworkType.TESTNET,CALL.method,["TESTBTC","2","9","false","false","false"]),OWNER,CALL));
  mustReject("unexpected_signed_action",()=>verifyExactTestnetSignedCall(
    signed(NetworkType.TESTNET,CALL.method,["TESTUSD",MINT_SUPPLY,"9","false","false","false"]),OWNER,CALL));
  mustReject("wrong_signed_account",()=>verifyExactTestnetSignedCall(
    signed(),toBase58(new Uint8Array(48).fill(12)),CALL));
});

test("M4 refuses forged transaction hash, altered signature bytes and noncanonical envelope",()=>{
  const good=signed();
  const changed={txHash:toBase58(new Uint8Array(32).fill(6)),txPacked:good.txPacked};
  mustReject("signed_hash_mismatch",()=>verifyExactTestnetSignedCall(changed,OWNER,CALL));
  const decoded=decode(good.txPacked);
  assert.ok(decoded instanceof Map);
  const corrupted=new Map(decoded);
  for(const [k] of corrupted) {
    if(k instanceof Uint8Array && new TextDecoder().decode(k)==="signature"){
      const fake=new Uint8Array(96).fill(0);
      corrupted.set(k,fake);
      break;
    }
  }
  mustReject("wrong_signing_network",()=>verifyExactTestnetSignedCall({
    txHash:good.txHash,txPacked:encode(corrupted),
  },OWNER,CALL));
  mustReject("malformed_signed_payload",()=>verifyExactTestnetSignedCall({
    txHash:good.txHash,txPacked:[],
  },OWNER,CALL));
  mustReject("malformed_signed_payload",()=>verifyExactTestnetSignedCall({
    txHash:"invalid!",txPacked:good.txPacked,
  },OWNER,CALL));
});

function fixture(network:NetworkType,alreadyIssued=false){
  let signCount=0,submitCount=0,registered=alreadyIssued;
  const walletPayload=signed(network);
  const hash=walletPayload.txHash;
  const provider={
    isAmadeus:true,requestAccounts:async()=>[OWNER],
    getAccount:async()=>OWNER,
    signTransaction:async (_call:unknown)=>{
      signCount++;
      return walletPayload;
    },
  };
  const sdk={
    chain:{
      getTip:async()=>({entry:{header:{height:110}}}),
      getStats:async()=>({stats:{height:110,rooted_height:110}}),
    },
    contract:{get:async()=>registered?MINT_SUPPLY:null},
    wallet:{getBalance:async (_:string,symbol:string)=>({
      balance:{symbol,flat:Number(MINT_SUPPLY),float:1000000},
    })},
    transaction:{
      submitAndWait:async (_payload:Uint8Array, options:{finalized:boolean})=>{
        submitCount++;
        assert.equal(options.finalized,true);
        registered=true;
        return {hash,metadata:{entry_height:105,status:"finalized"},receipt:{success:true}};
      },
      get:async()=>({
        hash,tx:{signer:OWNER,action:{contract:"Coin",function:"create_and_mint"}},
        receipt:{success:true},metadata:{status:"finalized",entry_height:105},
      }),
    },
  };
  return {provider,sdk:sdk as unknown as AmadeusSDK,
    counters:()=>({signCount,submitCount})};
}

test("M4 a cryptographically valid testnet wallet approval can mint once, with real RPC receipt verification mocked in tests ONLY",async()=>{
  const {sdk,provider,counters}=fixture(NetworkType.TESTNET);
  const proof=await issueNativeTestToken({
    sdk,provider,account:OWNER,network:"unverified",rpcHealthy:true,
  },"TESTBTC");
  assert.equal(proof.status,"finalized");
  assert.equal(proof.symbol,"TESTBTC");
  assert.equal(proof.supplyAtomic,MINT_SUPPLY);
  assert.equal(proof.height,105);
  assert.deepEqual(counters(),{signCount:1,submitCount:1});
});

test("M4 rejects MAINNET domain and never submits a single RPC transaction",async()=>{
  const {sdk,provider,counters}=fixture(NetworkType.MAINNET);
  await assert.rejects(issueNativeTestToken({
    sdk,provider,account:OWNER,network:"unverified",rpcHealthy:true,
  },"TESTBTC"),(err:unknown)=>err instanceof NativeSigningError&&err.code==="wrong_signing_network");
  assert.deepEqual(counters(),{signCount:1,submitCount:0});
});

test("M4 rechecks symbol, wallet signer and explicit wrong network before any wallet approval",async()=>{
  const known=fixture(NetworkType.TESTNET,true);
  await assert.rejects(issueNativeTestToken({
    sdk:known.sdk,provider:known.provider,account:OWNER,network:"unverified",rpcHealthy:true,
  },"TESTBTC"),TokenIssuanceError);
  assert.deepEqual(known.counters(),{signCount:0,submitCount:0});
  const wrong=fixture(NetworkType.TESTNET);
  await assert.rejects(issueNativeTestToken({
    sdk:wrong.sdk,provider:wrong.provider,account:OWNER,network:"wrong_network",rpcHealthy:true,
  },"TESTBTC"),TokenIssuanceError);
  assert.deepEqual(wrong.counters(),{signCount:0,submitCount:0});
  const stale=fixture(NetworkType.TESTNET);
  stale.provider.getAccount=async()=>toBase58(new Uint8Array(48).fill(7));
  await assert.rejects(issueNativeTestToken({
    sdk:stale.sdk,provider:stale.provider,account:OWNER,network:"unverified",rpcHealthy:true,
  },"TESTBTC"),(e:unknown)=>e instanceof TokenIssuanceError&&e.code==="wallet_account_changed");
  assert.deepEqual(stale.counters(),{signCount:0,submitCount:0});
});

test("M4 fails closed on unrooted chain and never fabricates a finalized success",async()=>{
  const f=fixture(NetworkType.TESTNET);
  f.sdk.chain.getStats=async()=>({stats:{height:110,rooted_height:100}}) as never;
  await assert.rejects(issueNativeTestToken({
    sdk:f.sdk,provider:f.provider,account:OWNER,network:"unverified",rpcHealthy:true,
  },"TESTBTC"),(e:unknown)=>e instanceof TokenIssuanceError&&e.code==="mint_not_independently_rooted");
  assert.deepEqual(f.counters(),{signCount:1,submitCount:1});
});
