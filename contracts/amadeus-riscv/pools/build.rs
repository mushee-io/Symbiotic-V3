// Build-time public account binding. No private material or RPC involved.
// Without AMA_POOL_INITIALIZER the compiled guest is intentionally inert.
use std::{env, fs, path::PathBuf};

fn decode_base58_48(input: &str) -> Result<[u8; 48], &'static str> {
    const ALPHABET: &str = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    if input.is_empty() || input.len() > 100 { return Err("invalid address length"); }
    let mut out = [0u8; 48];
    for c in input.chars() {
        let digit = ALPHABET.find(c).ok_or("invalid base58 character")? as u32;
        let mut carry = digit;
        for slot in out.iter_mut().rev() {
            carry += (*slot as u32) * 58;
            *slot = (carry & 255) as u8;
            carry >>= 8;
        }
        if carry != 0 { return Err("address exceeds 48 bytes"); }
    }
    let leading_ones = input.bytes().take_while(|b| *b == b'1').count();
    if leading_ones != out.iter().take_while(|b| **b == 0).count() {
        return Err("non-canonical base58 address");
    }
    if out.iter().all(|v| *v == 0) { return Err("zero address forbidden"); }
    Ok(out)
}

fn main() {
    println!("cargo:rerun-if-env-changed=AMA_POOL_INITIALIZER");
    let out_dir = PathBuf::from(env::var("OUT_DIR").expect("Cargo OUT_DIR"));
    let bytes = match env::var("AMA_POOL_INITIALIZER") {
        Ok(address) => decode_base58_48(&address).expect("Invalid public AMA_POOL_INITIALIZER"),
        Err(env::VarError::NotPresent) => [0u8; 48],
        Err(_) => panic!("Non-Unicode AMA_POOL_INITIALIZER"),
    };
    let array = bytes.iter().map(|v| format!("{v}u8")).collect::<Vec<_>>().join(", ");
    fs::write(out_dir.join("pool_initializer.rs"), format!("[{array}]"))
        .expect("write approved initializer");
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_invalid_deployer_accounts() {
        assert!(decode_base58_48("").is_err());
        assert!(decode_base58_48("0OIl").is_err());
        assert!(decode_base58_48("1").is_err());
        assert!(decode_base58_48(&"z".repeat(100)).is_err());
    }
    #[test]
    fn accepts_canonical_48_byte_public_key() {
        let mut data = [0u8; 48];
        data[0] = 1;
        data[47] = 250;
        const ABC: &[u8] = b"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
        let mut num = data.to_vec();
        let mut chars = Vec::new();
        while num.iter().any(|b| *b != 0) {
            let mut rem = 0u32;
            for byte in num.iter_mut() {
                let cur = rem * 256 + *byte as u32;
                *byte = (cur / 58) as u8;
                rem = cur % 58;
            }
            chars.push(ABC[rem as usize] as char);
        }
        chars.reverse();
        let address: String = chars.into_iter().collect();
        assert_eq!(decode_base58_48(&address), Ok(data));
    }
}
