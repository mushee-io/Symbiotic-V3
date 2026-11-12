# M2 — Amadeus native testnet RPC connectivity

Milestone tracker: https://github.com/mushee-io/Symbiotic-V3/issues/2

## Official network

The ONLY permitted server RPC is https://testnet-rpc.ama.one/api. The client SDK's unconfigured default points to mainnet, so we always construct the SDK with an explicit, validated testnet base URL.

- Native SDK: @amadeus-protocol/sdk ^1.8.0 (ESM).
- Read endpoints through SDK: GET /api/chain/tip and GET /api/chain/stats.
- Response from this app: GET /api/network, with no-store and no cached success response.
- No unrestricted RPC override, chain fallback or alternative host.
- Both endpoints must return valid safe nonnegative integer heights. Rooted height must not exceed stats height.
- The endpoints may be observed in different moments, so do not require tip height and stats height to be equal.

## Failure contract

The app returns HTTP 503 with status unavailable, null heights, no trading authorization, and one sanitized error category:

- unsafe_rpc_config: a blank, mainnet or alternate RPC value was supplied.
- invalid_chain_data: the RPC response structure or heights are invalid.
- rpc_timeout: the SDK request was aborted for exceeding the timeout.
- rpc_unavailable: transport/HTTP/other failure.

The app returns HTTP 200 only for SDK tip + stats responses which pass validation. Even then tradingEnabled and contractsVerified are always false: network reachability is not proof of pools, tokens or executable trading.

The constant Amadeus testnet endpoint provides environment isolation. This health check does not cryptographically verify chain identity or consensus. That will require authoritative genesis/network anchoring in a later security gate.

## Reproduction

1. Run npm install (Node 22), npm run typecheck, npm test, and npm run build.
2. Run npm run testnet:check to query the live public testnet. Exit status 0 and a height-bearing JSON result is a verified response; exit 1 means live check not verified.
3. Start the app and request /api/network. Disconnect the network or configure AMADEUS_RPC_URL=https://mainnet-rpc.ama.one/api; it must fail closed with HTTP 503 and no mainnet request.
4. Confirm TESTBTC/AMA and TESTUSD/AMA remain the only proposed spot pairs and the swap button stays disabled.

## Automated test cases

- Native SDK configured strictly with pinned testnet origin + path
- Refuse mainnet, HTTP, trailing slash, alternate host, blank env and query-string overrides
- SDK routes perform the expected native HTTP GET calls
- Healthy tip and stats correctly parsed, including safe decimal strings
- Invalid tip, malformed stats, impossible rooted height, unsafe integers and RPC failures rejected
- Health API outputs correct success/no-store and safe 503 error behaviors
- Live smoke test separately reported as a nonblocking CI step

**M2 completion gate:** deterministic CI must pass AND the live testnet smoke step must succeed. A green deterministic CI alone does not complete M2.
