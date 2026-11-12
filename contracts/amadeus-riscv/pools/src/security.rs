//! M11 deterministic security gates. Host/runtime acceptance is a separate testnet task.
use crate::KEY_BYTES;

/// Fail-closed until an independently witnessed deployment account is pinned
/// in a reviewed build. Never infer an administrator from the first caller.
/// A future reviewed deployment PR may replace None with a known *public* key,
/// and must prove the actual ELF hash and initialized owner on testnet.
pub const VERIFIED_INITIALIZER: Option<[u8; KEY_BYTES]> = None;

/// Reject unconfigured/zero addresses and compare all bytes rather than
/// trusting an unverified wallet/display string.
pub fn approved_initializer(caller: &[u8; KEY_BYTES], configured: Option<&[u8; KEY_BYTES]>) -> bool {
    let Some(expected) = configured else { return false };
    let mut diff = 0u8;
    let mut nonzero = 0u8;
    for i in 0..KEY_BYTES {
        diff |= caller[i] ^ expected[i];
        nonzero |= expected[i];
    }
    diff == 0 && nonzero != 0
}

pub fn safe_deadline(entry_height: u64, expiry: u128) -> bool {
    expiry <= u64::MAX as u128 && entry_height <= expiry as u64 && expiry > 0
}

pub fn transfer_ack(status: u64, bytes: &[u8]) -> bool {
    status == 2 && bytes == b"ok"
}

pub fn no_reentrancy(guard_exists: bool) -> bool { !guard_exists }

#[cfg(test)]
mod tests {
    use super::*;

    #[test] fn initializer_is_default_deny_not_first_caller_wins() {
        let caller = [7u8; KEY_BYTES];
        assert!(!approved_initializer(&caller, VERIFIED_INITIALIZER.as_ref()));
        assert!(!approved_initializer(&caller, None));
        assert!(!approved_initializer(&[0u8; KEY_BYTES], Some(&[0u8; KEY_BYTES])));
        assert!(approved_initializer(&caller, Some(&caller)));
        for offset in 0..KEY_BYTES {
            let mut wrong = caller;
            wrong[offset] ^= 1;
            assert!(!approved_initializer(&wrong, Some(&caller)));
        }
    }

    #[test] fn deadline_rejects_expired_overflow_and_zero() {
        assert!(safe_deadline(100, 100));
        assert!(safe_deadline(100, 120));
        assert!(!safe_deadline(121, 120));
        assert!(!safe_deadline(0, 0));
        assert!(!safe_deadline(0, u128::MAX));
        assert!(!safe_deadline(u64::MAX, u64::MAX as u128 + 1));
    }

    #[test] fn transfer_requires_exact_host_ack() {
        assert!(transfer_ack(2, b"ok"));
        assert!(!transfer_ack(2, b"ok\n"));
        assert!(!transfer_ack(3, b"ok"));
        assert!(!transfer_ack(u64::MAX, b"ok"));
        assert!(!transfer_ack(2, b"no"));
        assert!(!transfer_ack(0, b""));
    }

    #[test] fn nested_call_guard_blocks_only_when_set() {
        assert!(no_reentrancy(false));
        assert!(!no_reentrancy(true));
    }
}
