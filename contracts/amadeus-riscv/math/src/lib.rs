#![no_std]
// M5 reference arithmetic compiled on host for tests and intended for the
// Amadeus RISC-V (RV64IM + Zba/Zbb) runtime integration in M6.
// NOT a deployable contract; lacks host calls, storage and asset custody.

pub const FEE_BPS: u128 = 30;
pub const FEE_DENOM: u128 = 10_000;
pub const MIN_LOCKED_LP: u128 = 1000;
pub const MAX_RESERVE: u128 = 10_000_000_000_000_000;
const MAX_I128: u128 = i128::MAX as u128;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AmmError { InvalidAmount, ZeroLiquidity, Overflow, Dust, Slippage, Locked }

fn check(v: u128) -> Result<u128, AmmError> {
    if v > MAX_RESERVE { Err(AmmError::Overflow) } else { Ok(v) }
}
fn mul(a: u128, b: u128) -> Result<u128, AmmError> {
    let product = a.checked_mul(b).ok_or(AmmError::Overflow)?;
    if product > MAX_I128 { Err(AmmError::Overflow) } else { Ok(product) }
}
fn add(a: u128, b: u128, max: u128) -> Result<u128, AmmError> {
    let x = a.checked_add(b).ok_or(AmmError::Overflow)?;
    if x > max { Err(AmmError::Overflow) } else { Ok(x) }
}
pub fn integer_sqrt(v: u128) -> u128 {
    if v < 2 { return v; }
    let mut x = v;
    let mut y = x / 2 + 1;
    while y < x { x = y; y = (x + v / x) / 2; }
    x
}
fn div_ceil(a: u128, b: u128) -> Result<u128, AmmError> {
    if b == 0 { return Err(AmmError::InvalidAmount); }
    Ok(a / b + u128::from(a % b != 0))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Swap {
    pub out: u128,
    pub reserve_in: u128,
    pub reserve_out: u128,
    pub k_before: u128,
    pub k_after: u128,
}
pub fn quote_exact_in(
    reserve_in: u128, reserve_out: u128, amount: u128, minimum_out: u128,
) -> Result<Swap, AmmError> {
    check(reserve_in)?; check(reserve_out)?; check(amount)?; check(minimum_out)?;
    if reserve_in == 0 || reserve_out == 0 { return Err(AmmError::ZeroLiquidity); }
    if amount == 0 || minimum_out == 0 { return Err(AmmError::InvalidAmount); }
    let next_in = add(reserve_in, amount, MAX_RESERVE)?;
    let adjusted = mul(amount, FEE_DENOM - FEE_BPS)?;
    let numerator = mul(adjusted, reserve_out)?;
    let denominator = add(mul(reserve_in, FEE_DENOM)?, adjusted, MAX_I128)?;
    let out = numerator / denominator;
    if out == 0 || out >= reserve_out { return Err(AmmError::Dust); }
    if out < minimum_out { return Err(AmmError::Slippage); }
    let next_out = reserve_out - out;
    let before = mul(reserve_in, reserve_out)?;
    let after = mul(next_in, next_out)?;
    if after < before { return Err(AmmError::Overflow); }
    Ok(Swap{ out, reserve_in: next_in, reserve_out: next_out, k_before: before, k_after: after })
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AddLiquidity { pub base: u128, pub ama: u128, pub minted: u128, pub locked: u128 }
pub fn initial_liquidity(base: u128, ama: u128) -> Result<AddLiquidity, AmmError> {
    check(base)?; check(ama)?;
    if base == 0 || ama == 0 { return Err(AmmError::ZeroLiquidity); }
    let root = integer_sqrt(mul(base, ama)?);
    if root <= MIN_LOCKED_LP { return Err(AmmError::Dust); }
    Ok(AddLiquidity { base, ama, minted: root - MIN_LOCKED_LP, locked: MIN_LOCKED_LP })
}
pub fn add_liquidity(
    reserve_base: u128, reserve_ama: u128, lp_total: u128,
    desired_base: u128, desired_ama: u128, min_lp: u128,
) -> Result<AddLiquidity, AmmError> {
    for x in [reserve_base, reserve_ama, lp_total, desired_base, desired_ama, min_lp] { check(x)?; }
    if reserve_base == 0 || reserve_ama == 0 || lp_total == 0 { return Err(AmmError::ZeroLiquidity); }
    if desired_base == 0 || desired_ama == 0 || min_lp == 0 { return Err(AmmError::InvalidAmount); }
    let shares = core::cmp::min(
        mul(desired_base, lp_total)? / reserve_base,
        mul(desired_ama, lp_total)? / reserve_ama,
    );
    if shares == 0 { return Err(AmmError::Dust); }
    if shares < min_lp { return Err(AmmError::Slippage); }
    let base = div_ceil(mul(shares, reserve_base)?, lp_total)?;
    let ama = div_ceil(mul(shares, reserve_ama)?, lp_total)?;
    if base == 0 || ama == 0 || base > desired_base || ama > desired_ama {
        return Err(AmmError::InvalidAmount);
    }
    add(reserve_base, base, MAX_RESERVE)?;
    add(reserve_ama, ama, MAX_RESERVE)?;
    add(lp_total, shares, MAX_RESERVE)?;
    Ok(AddLiquidity { base, ama, minted: shares, locked: 0 })
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RemoveLiquidity { pub base_out: u128, pub ama_out: u128, pub lp_remaining: u128 }
pub fn remove_liquidity(
    reserve_base: u128, reserve_ama: u128, lp_total: u128,
    shares: u128, min_base: u128, min_ama: u128,
) -> Result<RemoveLiquidity, AmmError> {
    for x in [reserve_base, reserve_ama, lp_total, shares, min_base, min_ama] { check(x)?; }
    if reserve_base == 0 || reserve_ama == 0 || lp_total == 0 { return Err(AmmError::ZeroLiquidity); }
    if shares == 0 || min_base == 0 || min_ama == 0 { return Err(AmmError::InvalidAmount); }
    if shares > lp_total.saturating_sub(MIN_LOCKED_LP) { return Err(AmmError::Locked); }
    let base_out = mul(shares, reserve_base)? / lp_total;
    let ama_out = mul(shares, reserve_ama)? / lp_total;
    if base_out == 0 || ama_out == 0 { return Err(AmmError::Dust); }
    if base_out < min_base || ama_out < min_ama { return Err(AmmError::Slippage); }
    Ok(RemoveLiquidity { base_out, ama_out, lp_remaining: lp_total - shares })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn fee_quote_and_invariant() {
        let q = quote_exact_in(1_000_000,1_000_000,100_000,1).unwrap();
        assert_eq!(q.out, 90_661);
        assert_eq!(q.reserve_in,1_100_000);
        assert_eq!(q.reserve_out,909_339);
        assert!(q.k_after>=q.k_before);
    }
    #[test] fn initial_lock_and_lp_burn() {
        let l=initial_liquidity(1_000_000,4_000_000).unwrap();
        assert_eq!(l.minted,1_999_000);
        assert_eq!(l.locked,1_000);
        let r=remove_liquidity(1_000_000,4_000_000,2_000_000,1_999_000,1,1).unwrap();
        assert_eq!(r.lp_remaining,1_000);
    }
    #[test] fn rounding_and_invalid_zero() {
        assert_eq!(integer_sqrt(17),4);
        assert_eq!(quote_exact_in(0,1000,100,1),Err(AmmError::ZeroLiquidity));
        assert_eq!(quote_exact_in(1000,1000,1,1),Err(AmmError::Dust));
        assert_eq!(quote_exact_in(1000,1000,100,0),Err(AmmError::InvalidAmount));
        assert_eq!(quote_exact_in(MAX_RESERVE,1_000_000,1,1),Err(AmmError::Overflow));
    }
    #[test] fn property_seeded_swaps() {
        let mut x:u64=0x12345678;
        for _ in 0..1200 {
            x ^= x<<13; x ^= x>>7; x ^= x<<17;
            let a=100000 + (x%15000000) as u128;
            x ^= x<<13; x ^= x>>7; x ^= x<<17;
            let b=100000 + (x%15000000) as u128;
            let result=quote_exact_in(a,b,1000,1);
            if let Ok(q)=result {
                assert!(q.out>0&&q.out<b);
                assert_eq!(q.reserve_out+q.out,b);
                assert!(q.k_after>=q.k_before);
            } else { assert_eq!(result,Err(AmmError::Dust)); }
        }
    }
    #[test] fn lp_proportional() {
        let a=add_liquidity(10_000_000,20_000_000,14_142_135,500_000,1_700_000,1).unwrap();
        assert!(a.minted>0&&a.base<=500_000&&a.ama<=1_700_000);
        assert_eq!(add_liquidity(0,100,100,100,100,1),Err(AmmError::ZeroLiquidity));
    }
    #[test] fn adversarial_fee_and_price_impact_window() {
        let rin = 10_000_000u128;
        let rout = 25_000_000u128;
        let low = quote_exact_in(rin, rout, 1_000, 1).unwrap();
        let high = quote_exact_in(rin, rout, 1_000_000, 1).unwrap();
        assert!(high.out > low.out);
        assert!(high.k_after >= high.k_before);
        assert!(low.k_after >= low.k_before);
        assert_eq!(low.reserve_in, rin + 1_000);
        assert_eq!(high.reserve_out + high.out, rout);
        assert_eq!(quote_exact_in(rin, rout, 1_000_000, high.out + 1), Err(AmmError::Slippage));
    }
    #[test] fn adversarial_lp_withdrawal_keeps_permanently_locked_shares() {
        let first = initial_liquidity(4_000_000, 9_000_000).unwrap();
        let supply = first.minted + first.locked;
        assert_eq!(first.locked, MIN_LOCKED_LP);
        let second = add_liquidity(4_000_000, 9_000_000, supply, 1_000_000, 2_250_000, 1).unwrap();
        assert!(second.minted > 0);
        let full = supply + second.minted;
        let amount = remove_liquidity(4_000_000 + second.base,9_000_000 + second.ama,full,full - MIN_LOCKED_LP,1,1).unwrap();
        assert_eq!(amount.lp_remaining, MIN_LOCKED_LP);
        assert_eq!(remove_liquidity(4_000_000,9_000_000,supply,supply,1,1), Err(AmmError::Locked));
        assert_eq!(remove_liquidity(4_000_000,9_000_000,supply,1_000,1_000_000,1), Err(AmmError::Slippage));
    }
    #[test] fn adversarial_reserve_cap_overflow_underflow_and_zero_cases() {
        assert_eq!(quote_exact_in(MAX_RESERVE, MAX_RESERVE, 1, 1), Err(AmmError::Overflow));
        assert_eq!(quote_exact_in(MAX_RESERVE - 1, 1, 2, 1), Err(AmmError::Overflow));
        assert_eq!(quote_exact_in(0, 1_000, 100, 1), Err(AmmError::ZeroLiquidity));
        assert_eq!(initial_liquidity(1,1), Err(AmmError::Dust));
        assert_eq!(add_liquidity(1, 0, 1, 1, 1, 1), Err(AmmError::ZeroLiquidity));
        assert_eq!(remove_liquidity(1_000,1_000,1_001,1_002,1,1), Err(AmmError::Locked));
    }
    #[test] fn adversarial_seeded_integer_property_4000_cases() {
        let mut x: u64 = 0xA11CE1F;
        for _ in 0..4_000 {
            x ^= x << 13; x ^= x >> 7; x ^= x << 17;
            let base = 10_000 + (x % 50_000_000) as u128;
            x ^= x << 13; x ^= x >> 7; x ^= x << 17;
            let ama = 10_000 + (x % 50_000_000) as u128;
            x ^= x << 13; x ^= x >> 7; x ^= x << 17;
            let input = 1 + (x % 200_000) as u128;
            if let Ok(q) = quote_exact_in(base, ama, input, 1) {
                assert!(q.out > 0 && q.out < ama);
                assert_eq!(q.reserve_out + q.out, ama);
                assert_eq!(q.reserve_in, base + input);
                assert!(q.k_after >= q.k_before);
                assert!(q.k_before > 0);
            }
        }
    }

}
