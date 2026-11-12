import { nativeTestnetSdk } from "../lib/amadeus";
import { inspectTestnet } from "../lib/amadeus-health";
import { M4_TEST_TOKENS, readTokenRegistration } from "../lib/amadeus-tokens";

// Read-only public testnet evidence. No keys, wallets, signatures or mint tx.
try {
  const sdk = nativeTestnetSdk();
  const health = await inspectTestnet(sdk);
  const registry = await Promise.all(
    M4_TEST_TOKENS.map((asset) => readTokenRegistration(sdk, asset.symbol)),
  );
  process.stdout.write(JSON.stringify({
    status: "read_only_testnet_registry",
    network: health.network,
    height: health.height,
    tokens: registry,
    mintExecuted: false,
    checkedAt: new Date().toISOString(),
  }) + "\n");
} catch {
  process.stderr.write("M4 native token registry could not be read; no minted-state inference.\n");
  process.exitCode = 1;
}
