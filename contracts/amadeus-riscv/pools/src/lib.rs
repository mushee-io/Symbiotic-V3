#![no_std]
// Minimal original Amadeus RISC-V host ABI bindings, per official node docs.
// No EVM adapter or external dependency on a mutable SDK repository.

pub const MAX_RESERVE: u128 = 10_000_000_000_000_000;
pub const KEY_BYTES: usize = 48;
pub mod security;

#[cfg(target_arch = "riscv64")]
#[inline(always)]
fn ecall(id: u64, args: [u64; 7]) -> u64 {
    let answer: u64;
    unsafe {
        core::arch::asm!(
            "ecall",
            inlateout("a0") args[0] => answer,
            in("a1") args[1], in("a2") args[2], in("a3") args[3],
            in("a4") args[4], in("a5") args[5], in("a6") args[6],
            in("a7") id,
            options(nostack)
        );
    }
    answer
}
#[cfg(not(target_arch = "riscv64"))]
fn ecall(_id: u64, _args: [u64; 7]) -> u64 {
    panic!("Native Amadeus host calls cannot run on this target")
}

fn ptr(b: &[u8]) -> u64 { b.as_ptr() as u64 }
fn len(b: &[u8]) -> u64 { b.len() as u64 }

pub fn abort(message: &[u8]) -> ! {
    ecall(15, [ptr(message), len(message), 0, 0, 0, 0, 0]);
    loop { core::hint::spin_loop(); }
}
pub fn return_bytes(message: &[u8]) -> ! {
    ecall(2, [ptr(message), len(message), 0, 0, 0, 0, 0]);
    loop { core::hint::spin_loop(); }
}
pub fn exit() -> ! {
    ecall(93, [0; 7]);
    loop { core::hint::spin_loop(); }
}

fn read_host(id: u64, args: [u64; 7], capacity: usize) -> usize {
    let n = ecall(id, args);
    if n == u64::MAX || n > capacity as u64 { abort(b"host_buffer_invalid"); }
    n as usize
}
pub fn get_function(out: &mut [u8; 48]) -> usize {
    read_host(14, [out.as_mut_ptr() as u64, out.len() as u64, 0, 0, 0, 0, 0], out.len())
}
pub fn get_arg(index: usize, out: &mut [u8; 80]) -> usize {
    read_host(13, [index as u64, out.as_mut_ptr() as u64, out.len() as u64, 0, 0, 0, 0], out.len())
}
pub fn arg_count() -> usize { ecall(12, [0; 7]) as usize }
pub fn read_env(field: u64, out: &mut [u8]) -> usize {
    read_host(11, [field, out.as_mut_ptr() as u64, len(out), 0, 0, 0, 0], out.len())
}
pub fn caller() -> [u8; KEY_BYTES] {
    let mut result = [0u8; KEY_BYTES];
    let n = read_env(51, &mut result);
    if n != KEY_BYTES { abort(b"invalid_caller"); }
    result
}
pub fn chain_height() -> u64 {
    let mut b = [0u8; 8];
    if read_env(11, &mut b) != 8 { abort(b"invalid_height"); }
    u64::from_le_bytes(b)
}
pub fn kv_put(key: &[u8], value: &[u8]) {
    ecall(4, [ptr(key), len(key), ptr(value), len(value), 0, 0, 0]);
}
pub fn kv_delete(key: &[u8]) {
    ecall(6, [ptr(key), len(key), 0, 0, 0, 0, 0]);
}
pub fn kv_exists(key: &[u8]) -> bool {
    ecall(8, [ptr(key), len(key), 0, 0, 0, 0, 0]) == 1
}
pub fn kv_get(key: &[u8], out: &mut [u8; 96]) -> Option<usize> {
    let n = ecall(7, [ptr(key), len(key), out.as_mut_ptr() as u64, out.len() as u64, 0, 0, 0]);
    if n == u64::MAX { return None; }
    if n > out.len() as u64 { abort(b"storage_buffer_invalid"); }
    Some(n as usize)
}

pub fn format_uint(mut value: u128, out: &mut [u8; 48]) -> &[u8] {
    let mut index = out.len();
    loop {
        index -= 1;
        out[index] = b'0' + (value % 10) as u8;
        value /= 10;
        if value == 0 { break; }
    }
    &out[index..]
}
pub fn parse_uint(bytes: &[u8]) -> Option<u128> {
    if bytes.is_empty() || (bytes.len() > 1 && bytes[0] == b'0') { return None; }
    let mut value = 0u128;
    for c in bytes {
        if !c.is_ascii_digit() { return None; }
        value = value.checked_mul(10)?.checked_add((c - b'0') as u128)?;
    }
    Some(value)
}
pub fn put_uint(key: &[u8], number: u128) {
    let mut buf = [0u8; 48];
    kv_put(key, format_uint(number, &mut buf));
}
pub fn get_uint(key: &[u8]) -> u128 {
    let mut buf = [0u8; 96];
    let n = kv_get(key, &mut buf).unwrap_or_else(|| abort(b"missing_state"));
    parse_uint(&buf[..n]).unwrap_or_else(|| abort(b"invalid_state_integer"))
}
pub fn get_uint_or_zero(key: &[u8]) -> u128 {
    let mut buf = [0u8; 96];
    match kv_get(key, &mut buf) {
        None => 0,
        Some(n) => parse_uint(&buf[..n]).unwrap_or_else(|| abort(b"invalid_owner_lp")),
    }
}
pub fn get_value(key: &[u8], out: &mut [u8; 96]) -> usize {
    kv_get(key, out).unwrap_or_else(|| abort(b"missing_state"))
}
pub fn lp_key(caller_key: &[u8; KEY_BYTES]) -> [u8; 51] {
    let mut key = [0u8; 51];
    key[..3].copy_from_slice(b"lp:");
    key[3..].copy_from_slice(caller_key);
    key
}

pub fn native_coin_transfer(to: &[u8; KEY_BYTES], amount: u128, symbol: &[u8]) {
    if amount == 0 || amount > MAX_RESERVE { abort(b"invalid_transfer_amount"); }
    let mut decimal = [0u8; 48];
    let amount = format_uint(amount, &mut decimal);
    let words: [&[u8]; 5] = [b"Coin", b"transfer", to, amount, symbol];
    let mut table = [0u64; 11];
    table[0] = 5;
    for (i, word) in words.iter().enumerate() {
        table[1 + 2 * i] = word.as_ptr() as u64;
        table[2 + 2 * i] = word.len() as u64;
    }
    let mut out = [0u8; 32];
    let n = ecall(3, [
        table.as_ptr() as u64, 0, 0,
        out.as_mut_ptr() as u64, out.len() as u64, 0, 0
    ]);
    if !security::transfer_ack(n, &out[..2]) { abort(b"native_transfer_failed"); }
}

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum AttachmentError { Encoding, UnexpectedSymbol, InvalidAmount, Duplicate, Count }

fn byte(data: &[u8], index: &mut usize) -> Result<u8, AttachmentError> {
    let ch = *data.get(*index).ok_or(AttachmentError::Encoding)?;
    *index += 1;
    Ok(ch)
}
fn vecpak_uint(data: &[u8], index: &mut usize) -> Result<u128, AttachmentError> {
    let header = byte(data,index)?;
    if header == 0 { return Ok(0); }
    let size = (header & 127) as usize;
    if header & 128 != 0 || size == 0 || size > 16 ||
        index.checked_add(size).filter(|end| *end <= data.len()).is_none() {
        return Err(AttachmentError::Encoding);
    }
    if data[*index] == 0 { return Err(AttachmentError::Encoding); }
    let mut out = 0u128;
    for &b in &data[*index..*index+size] { out = out * 256 + b as u128; }
    *index += size;
    Ok(out)
}

/** Decode canonical native vecpak binary-map with 1 or 2 positive Coin attachments. */
pub fn decode_coins(data: &[u8], base: &[u8], required: u8)
    -> Result<(u128, u128), AttachmentError> {
    let mut index = 0usize;
    if byte(data, &mut index)? != 7 { return Err(AttachmentError::Encoding); }
    let count = vecpak_uint(data,&mut index)?;
    if count != required as u128 || !(1..=2).contains(&required) {
        return Err(AttachmentError::Count);
    }
    let mut base_amount = 0u128;
    let mut ama_amount = 0u128;
    for _ in 0..count {
        if byte(data,&mut index)? != 5 { return Err(AttachmentError::Encoding); }
        let n = vecpak_uint(data,&mut index)?;
        if n > 32 || n == 0 || index+n as usize > data.len() {
            return Err(AttachmentError::Encoding);
        }
        let symbol = &data[index..index+n as usize];
        index += n as usize;
        if byte(data,&mut index)? != 3 { return Err(AttachmentError::Encoding); }
        let amount = vecpak_uint(data,&mut index)?;
        if amount == 0 || amount > MAX_RESERVE { return Err(AttachmentError::InvalidAmount); }
        if symbol == base {
            if base_amount != 0 { return Err(AttachmentError::Duplicate); }
            base_amount = amount;
        } else if symbol == b"AMA" {
            if ama_amount != 0 { return Err(AttachmentError::Duplicate); }
            ama_amount = amount;
        } else { return Err(AttachmentError::UnexpectedSymbol); }
    }
    if index != data.len() || (required == 2 && (base_amount == 0 || ama_amount == 0)) {
        return Err(AttachmentError::Encoding);
    }
    Ok((base_amount, ama_amount))
}

pub fn input_coins(base: &[u8], required: u8) -> (u128,u128) {
    let mut data = [0u8; 256];
    let n = read_env(70, &mut data);
    decode_coins(&data[..n], base, required)
        .unwrap_or_else(|_| abort(b"invalid_coin_attachments"))
}
pub fn require_no_attachments() {
    let mut data = [0u8; 256];
    if read_env(70, &mut data) != 0 { abort(b"unexpected_attachments"); }
}
pub fn ensure_arg_count(n: usize) {
    if arg_count() != n { abort(b"invalid_argument_count"); }
}
pub fn uint_arg(index: usize, maximum: u128) -> u128 {
    let mut data = [0u8; 80];
    let n = get_arg(index, &mut data);
    let value = parse_uint(&data[..n]).unwrap_or_else(|| abort(b"invalid_integer_arg"));
    if value == 0 || value > maximum { abort(b"invalid_integer_range"); }
    value
}
pub const MAX_DEADLINE_AHEAD: u64 = 20;

/// Native height-window check, including u64 edge handling. No wall clock.
pub fn deadline_is_valid(current: u64, deadline: u64) -> bool {
    deadline >= current && deadline - current <= MAX_DEADLINE_AHEAD
}

/// Zero-key or mismatched deployer identities must NEVER initialize a pool.
/// The checked-in guest binaries have no authorized deployer and remain inert.
pub fn authorized_initializer(caller: &[u8; KEY_BYTES], approved: &[u8; KEY_BYTES]) -> bool {
    approved.iter().any(|byte| *byte != 0) && caller == approved
}
pub fn enforce_deadline(deadline: u128) {
    if deadline > u64::MAX as u128 || !deadline_is_valid(chain_height(), deadline as u64) {
        abort(b"deadline_outside_native_height_window");
    }
}
pub fn unlocked() {
    if !security::no_reentrancy(kv_exists(b"guard")) { abort(b"reentrant_call"); }
}
pub fn lock() { unlocked(); kv_put(b"guard", b"1"); }
pub fn unlock() { kv_delete(b"guard"); }

#[cfg(test)]
mod tests {
    use super::*;
    // native vecpak encoder uses 0x07 map, count; 0x05 binary, byte length;
    // 0x03 integer, byte length. 1-byte lengths are canonical for small values.
    #[test] fn attachment_gate() {
        let one = [7,1,1,5,1,3,b'A',b'M',b'A',3,1,100];
        assert_eq!(decode_coins(&one,b"TESTBTC",1),Ok((0,100)));
        assert_eq!(decode_coins(&one,b"TESTBTC",2),Err(AttachmentError::Count));
        assert_eq!(decode_coins(&one,b"TESTUSD",1),Ok((0,100)));
        let pair = [7,1,2,5,1,3,b'A',b'M',b'A',3,1,100,5,1,7,b'T',b'E',b'S',b'T',b'B',b'T',b'C',3,1,100];
        assert_eq!(decode_coins(&pair,b"TESTBTC",2),Ok((100,100)));
        assert_eq!(decode_coins(&pair,b"TESTUSD",2),Err(AttachmentError::UnexpectedSymbol));
        let other=[7,1,1,5,1,4,b'U',b'S',b'D',b'C',3,1,1];
        assert_eq!(decode_coins(&other,b"TESTUSD",1),Err(AttachmentError::UnexpectedSymbol));
    }
    #[test] fn reject_duplicate_wrong_and_nft_coin_attachments() {
        let dup=[7,1,2,5,1,3,b'A',b'M',b'A',3,1,1,5,1,3,b'A',b'M',b'A',3,1,1];
        assert_eq!(decode_coins(&dup,b"TESTBTC",2),Err(AttachmentError::Duplicate));
        let negative=[7,1,1,5,1,3,b'A',b'M',b'A',3,0x81,1];
        assert_eq!(decode_coins(&negative,b"TESTBTC",1),Err(AttachmentError::Encoding));
        let zero=[7,1,1,5,1,3,b'A',b'M',b'A',3,0];
        assert_eq!(decode_coins(&zero,b"TESTBTC",1),Err(AttachmentError::InvalidAmount));
        let nft=[7,1,1,5,1,3,b'A',b'M',b'A',7,0];
        assert_eq!(decode_coins(&nft,b"TESTBTC",1),Err(AttachmentError::Encoding));
        let wrong=[7,1,1,5,1,3,b'U',b'S',b'D',3,1,1];
        assert_eq!(decode_coins(&wrong,b"TESTBTC",1),Err(AttachmentError::UnexpectedSymbol));
    }
    #[test] fn canonical_attachment_lengths_and_no_trailing_data() {
        let normal=[7,1,1,5,1,3,b'A',b'M',b'A',3,1,100];
        let mut trailing=normal.to_vec();trailing.push(0);
        assert_eq!(decode_coins(&trailing,b"TESTBTC",1),Err(AttachmentError::Encoding));
        for n in 0..normal.len() {
            assert!(decode_coins(&normal[..n],b"TESTBTC",1).is_err());
        }
        let missing_pair=[7,1,2,5,1,3,b'A',b'M',b'A',3,1,1,5,1,3,b'A',b'M',b'A',3,1,2];
        assert_eq!(decode_coins(&missing_pair,b"TESTBTC",2),Err(AttachmentError::Duplicate));
    }
    #[test] fn uint_encoding_and_strict_bounds() {
        let mut b=[0u8;48];
        for v in [0u128,1,1000,1000000000,MAX_RESERVE,u128::MAX] {
            assert_eq!(parse_uint(format_uint(v,&mut b)),Some(v));
        }
        for b in [&b""[..],b"-1",b"01",b"1.0",b" 1"] { assert_eq!(parse_uint(b),None); }
    }
    #[test] fn initializer_is_compile_time_bound_or_always_inert() {
        let approved = [7u8; KEY_BYTES];
        assert!(authorized_initializer(&approved, &approved));
        assert!(!authorized_initializer(&[8u8; KEY_BYTES], &approved));
        assert!(!authorized_initializer(&approved, &[0u8; KEY_BYTES]));
        assert!(!authorized_initializer(&[0u8; KEY_BYTES], &[0u8; KEY_BYTES]));
    }
    #[test] fn height_deadlines_reject_replay_and_overlong_windows() {
        assert!(deadline_is_valid(100, 100));
        assert!(deadline_is_valid(100, 120));
        assert!(!deadline_is_valid(100, 99));
        assert!(!deadline_is_valid(100, 121));
        assert!(deadline_is_valid(u64::MAX - 10, u64::MAX));
        assert!(!deadline_is_valid(u64::MAX - 21, u64::MAX));
    }
    #[test] fn caller_lp_key_is_binary_exact() {
        let addr=[3u8;48];let key=lp_key(&addr);
        assert_eq!(&key[..3],b"lp:");assert_eq!(&key[3..],&addr);
    }
}
