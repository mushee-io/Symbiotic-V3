import { nativeTestnetSdk } from "../lib/amadeus";
import { inspectTestnet } from "../lib/amadeus-health";

// Live public-testnet smoke test; separate from deterministic mock unit tests.
// This command must exit nonzero if the RPC is unavailable or chain data invalid.
try {
  const health = await inspectTestnet(nativeTestnetSdk());
  process.stdout.write(
    JSON.stringify({ ...health, exchangeReady: false, check: "live-testnet-rpc" }) + "\n",
  );
} catch {
  process.stderr.write("Amadeus native testnet smoke check failed (no fallback).\n");
  process.exitCode = 1;
}
