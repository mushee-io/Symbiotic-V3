#!/usr/bin/env bash
# Pure compile/verification: NO wallet, signing, broadcast, or deployment.
set -euo pipefail
cd "$(dirname "$0")"
command -v rustup >/dev/null || { echo "Rustup required" >&2; exit 1; }
command -v readelf >/dev/null || { echo "readelf required" >&2; exit 1; }
rustup +nightly component add rust-src
target="$PWD/riscv64im-zba-zbb-none.json"
mkdir -p artifacts
export RUSTFLAGS="-C panic=abort"
for base in testbtc testusd; do
  cargo +nightly build --release --example pool --features "$base" --target "$target" \
    -Z build-std=core -Z json-target-spec
  cp target/riscv64im-zba-zbb-none/release/examples/pool "artifacts/$base-ama.elf"
  test "$(head -c 4 "artifacts/$base-ama.elf" | od -An -tx1 | tr -d ' \n')" = "7f454c46"
  readelf -h "artifacts/$base-ama.elf" | grep -E 'Machine:.*RISC-V'
  test "$(stat -c %s "artifacts/$base-ama.elf")" -le 524288
  sha256sum "artifacts/$base-ama.elf"
done
test "$(sha256sum artifacts/testbtc-ama.elf | awk '{print $1}')" != \
  "$(sha256sum artifacts/testusd-ama.elf | awk '{print $1}')"
printf '\nTwo distinct Amadeus native RISC-V ELFs compiled. NOT DEPLOYED.\n'
