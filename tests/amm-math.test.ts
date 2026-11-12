import test from "node:test";
import assert from "node:assert/strict";
import {
  AMM_FEE_BPS, BPS_DENOMINATOR, MAX_I128, MAX_RESERVE, MIN_LOCKED_LP,
  AmmMathError, sqrtFloor, checkedMul, checkedAdd, ceilDiv,
  initialLiquidity, addLiquidity, removeLiquidity, quoteExactIn,
} from "../lib/amm/math";
import {
  initializePool, setPaused, validatePool, depositLp, withdrawLp,
  swapExactIn, requirePair,
} from "../lib/amm/pool";

const A = "2".repeat(65);
const B = "3".repeat(65);
const C = "4".repeat(65);
const ONE = 1_000_000_000n;
const baseUnit = ONE; // 9 native Coin decimals

test("explicit fee schedule and signed-i128-compatible reserve limits", () => {
  assert.equal(AMM_FEE_BPS, 30n);
  assert.equal(BPS_DENOMINATOR, 10000n);
  assert.equal(MIN_LOCKED_LP, 1000n);
  assert.equal(MAX_RESERVE, 10n ** 16n);
  assert.equal(checkedMul(MAX_RESERVE, MAX_RESERVE), 10n ** 32n);
  assert.throws(() => checkedMul(MAX_I128, 2n), AmmMathError);
  assert.throws(() => checkedAdd(MAX_I128, 1n), AmmMathError);
});

test("integer sqrt floors correctly with no floating point or rounding over", () => {
  for (const [n, want] of [
    [0n,0n],[1n,1n],[2n,1n],[3n,1n],[4n,2n],
    [15n,3n],[16n,4n],[17n,4n],[99980001n,9999n],
  ]) assert.equal(sqrtFloor(n),want);
  for(let n=1n;n<2000n;n+=3n){
    const r=sqrtFloor(n);
    assert.ok(r*r<=n&&(r+1n)*(r+1n)>n);
  }
  assert.throws(()=>sqrtFloor(-1n),AmmMathError);
  assert.throws(()=>ceilDiv(2n,0n),AmmMathError);
});

test("both native AMA pairs and no third token",()=>{
  assert.equal(requirePair("TESTBTC"),"TESTBTC");
  assert.equal(requirePair("TESTUSD"),"TESTUSD");
  for (const bad of ["AMA","BTC","TESTETH","USDC","TESTBTC/ETH","TESTUSD/USDC"]) {
    assert.throws(()=>requirePair(bad),AmmMathError);
  }
  for (const base of ["TESTBTC","TESTUSD"]) {
    const pool=initializePool(base,A,1000n*baseUnit,2000n*baseUnit);
    assert.equal(pool.pair,base+"/AMA");
    assert.equal(pool.quote,"AMA");
    assert.equal(pool.admin,A);
    assert.equal(pool.lpBalances[A]+MIN_LOCKED_LP,pool.totalLp);
    validatePool(pool);
  }
});

test("classic fee-inclusive exact-input quote and reserve conservation",()=>{
  const q=quoteExactIn(1_000_000n,1_000_000n,100_000n,1n);
  const expected=(100_000n*9970n*1_000_000n)/
    (1_000_000n*10_000n+100_000n*9970n);
  assert.equal(q.amountOut,expected);
  assert.equal(q.newReserveIn,1_100_000n);
  assert.equal(q.newReserveOut,1_000_000n-expected);
  assert.ok(q.amountOut<1_000_000n);
  assert.ok(q.invariantAfter>=q.invariantBefore);
  assert.equal(q.newReserveIn* q.newReserveOut,q.invariantAfter);
  assert.equal(q.feeBps,30n);
});

test("slippage, zero reserves, dust, zero input and capped balances fail closed",()=>{
  assert.throws(()=>quoteExactIn(0n,1000n,50n,1n),/zero_liquidity/);
  assert.throws(()=>quoteExactIn(1000n,0n,50n,1n),/zero_liquidity/);
  assert.throws(()=>quoteExactIn(1000n,1000n,0n,1n),/zero_input/);
  assert.throws(()=>quoteExactIn(1000n,1000n,1n,1n),/dust_or_empty_pool/);
  assert.throws(()=>quoteExactIn(100000n,100000n,1000n,0n),/minimum_output_required/);
  assert.throws(()=>quoteExactIn(100000n,100000n,1000n,100000n),/slippage_exceeded/);
  assert.throws(()=>quoteExactIn(MAX_RESERVE,1_000_000n,1n,1n),/overflow/);
  assert.throws(()=>quoteExactIn(1000n,1000n,-1n,1n),AmmMathError);
  assert.throws(()=>quoteExactIn(MAX_RESERVE+1n,100n,1n,1n),AmmMathError);
});

test("locked genesis liquidity ensures no provider can drain last shares",()=>{
  assert.throws(()=>initialLiquidity(1n,1n),/initial_liquidity_too_small/);
  assert.throws(()=>initialLiquidity(0n,100000n),/zero_liquidity/);
  const first=initialLiquidity(1_000_000n,4_000_000n);
  assert.equal(first.mintedLp,1_999_000n);
  assert.equal(first.lockedLp,MIN_LOCKED_LP);
  const p=initializePool("TESTBTC",A,1_000_000n,4_000_000n);
  const w=withdrawLp(p,A,p.lpBalances[A],1n,1n);
  assert.equal(w.pool.totalLp,MIN_LOCKED_LP);
  assert.ok(w.pool.reserveBase>0n);
  assert.ok(w.pool.reserveAma>0n);
  assert.equal(w.pool.lpBalances[A],0n);
  assert.throws(()=>withdrawLp(w.pool,A,1n,1n,1n),/lp_not_owned/);
});

test("proportional add LP uses ceil deposits, refuses excess and refunds unspent",()=>{
  const p=initializePool("TESTUSD",A,10_000_000n,20_000_000n);
  const q=addLiquidity(p.reserveBase,p.reserveAma,p.totalLp,500_000n,1_700_000n,1n);
  assert.ok(q.mintedLp>0n);
  assert.ok(q.usedBase<=500_000n&&q.usedAma<=1_700_000n);
  const next=depositLp(p,B,500_000n,1_700_000n,1n);
  assert.equal(next.pool.lpBalances[B],next.mintedLp);
  assert.equal(next.pool.reserveBase,p.reserveBase+next.usedBase);
  assert.equal(next.pool.reserveAma,p.reserveAma+next.usedAma);
  assert.equal(next.pool.totalLp,p.totalLp+next.mintedLp);
  assert.equal(next.usedBase,q.usedBase);
  assert.equal(next.usedAma,q.usedAma);
  validatePool(next.pool);
  assert.throws(()=>addLiquidity(p.reserveBase,p.reserveAma,p.totalLp,1n,1n,1n),AmmMathError);
  assert.throws(()=>depositLp(p,B,100n,100n,p.totalLp),/slippage_exceeded/);
});

test("withdraw owned LP atomically and preserve owner share accounting",()=>{
  const p=initializePool("TESTBTC",A,10_000_000n,10_000_000n);
  const d=depositLp(p,B,2_000_000n,2_000_000n,1n);
  const w=withdrawLp(d.pool,B,d.mintedLp,1n,1n);
  assert.equal(w.pool.lpBalances[B],0n);
  assert.equal(w.pool.totalLp,p.totalLp);
  assert.ok(w.baseOut>0n && w.amaOut>0n);
  assert.equal(w.pool.reserveBase+w.baseOut,d.pool.reserveBase);
  assert.equal(w.pool.reserveAma+w.amaOut,d.pool.reserveAma);
  assert.throws(()=>withdrawLp(d.pool,C,1n,1n,1n),/lp_not_owned/);
  assert.throws(()=>withdrawLp(d.pool,A,d.mintedLp+1n,1n,1n),AmmMathError);
  assert.throws(()=>withdrawLp(d.pool,B,d.mintedLp,MAX_RESERVE,1n),/slippage_exceeded/);
});

test("only original admin can pause; paused swaps/adds stop but LP exit remains available",()=>{
  const p=initializePool("TESTBTC",A,10_000_000n,20_000_000n);
  assert.throws(()=>setPaused(p,B,true),/admin_only/);
  const suspended=setPaused(p,A,true);
  assert.ok(suspended.paused);
  assert.throws(()=>swapExactIn(suspended,"AMA_TO_BASE",B,1000n,1n),/paused/);
  assert.throws(()=>depositLp(suspended,B,200n,200n,1n),/paused/);
  const exit=withdrawLp(suspended,A,1000n,1n,1n);
  assert.ok(exit.baseOut>0n&&exit.amaOut>0n);
  assert.equal(setPaused(suspended,A,false).paused,false);
});

test("both trade directions update only intended reserves, without changing LP shares",()=>{
  for (const side of ["AMA_TO_BASE","BASE_TO_AMA"] as const) {
    const p=initializePool("TESTBTC",A,500_000_000n,500_000_000n);
    const q=swapExactIn(p,side,B,10_000n,1n);
    assert.equal(q.pool.totalLp,p.totalLp);
    assert.equal(q.pool.lpBalances[A],p.lpBalances[A]);
    assert.ok(q.amountOut>0n);
    assert.ok(q.pool.reserveBase*q.pool.reserveAma>=p.reserveBase*p.reserveAma);
    assert.equal(q.pool.reserveBase+q.pool.reserveAma,
      p.reserveBase+p.reserveAma+10_000n-q.amountOut);
    validatePool(q.pool);
  }
  const p=initializePool("TESTBTC",A,500_000_000n,500_000_000n);
  assert.throws(()=>swapExactIn(p,"AMA_TO_USDC" as never,B,1000n,1n),/invalid_direction/);
});

test("tampered pool state is rejected before any transition",()=>{
  const p=initializePool("TESTUSD",A,1_000_000n,1_000_000n);
  assert.throws(()=>validatePool({...p,quote:"USDC" as "AMA"}),/wrong_quote/);
  assert.throws(()=>validatePool({...p,totalLp:p.totalLp+1n}),/lp_supply_mismatch/);
  assert.throws(()=>validatePool({...p,reserveAma:0n}),/zero_liquidity/);
  assert.throws(()=>validatePool({...p,lpBalances:{[B]:p.lpBalances[A]}}),AmmMathError);
});

test("seeded 1,200 case fuzz: no k decrease, no over-withdrawal, no reserve overflow",()=>{
  let seed=0x12345678;
  const next=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0;};
  for(let i=0;i<1200;i++){
    const x=BigInt(100000+next()%15000000);
    const y=BigInt(100000+next()%15000000);
    const input=BigInt(1+next()%100000);
    const min=1n;
    try{
      const quote=quoteExactIn(x,y,input,min);
      assert.ok(quote.amountOut>0n&&quote.amountOut<y);
      assert.equal(quote.newReserveIn,x+input);
      assert.equal(quote.newReserveOut+quote.amountOut,y);
      assert.ok(quote.invariantAfter>=quote.invariantBefore);
      assert.ok(quote.newReserveIn<=MAX_RESERVE);
    }catch(error){
      assert.ok(error instanceof AmmMathError);
      assert.ok(["dust_or_empty_pool"].includes(error.code),error.code);
    }
    const root=sqrtFloor(x*y);
    assert.ok(root*root<=x*y&&(root+1n)*(root+1n)>x*y);
  }
});
