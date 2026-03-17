# Implementation Plan: Phase 3 — Position Data

## Overview

Implement on-chain position fetching for Aave V3 (Ethereum, Base, Arbitrum), Compound V3, MarginFi (Solana), and Solend (Solana). Add a CoinGecko price feed. Wire everything into a `GET /positions/:walletId` endpoint that the mobile app calls to populate the dashboard.

## Assumptions

- Phase 2 wallet input is considered complete enough that wallets exist in DB with correct `chain_family` and `address` — the positions endpoint queries by walletId, not by userId, matching the existing DB schema.
- EVM chain IDs in scope: 1 (Ethereum), 8453 (Base), 42161 (Arbitrum). Polygon and Optimism are in architecture.md but not listed in Phase 3 scope — excluded for now.
- Compound V3 markets in scope: USDC on Ethereum mainnet (`0xc3d688B66703497DAA19211EEdff47f25384cdc3`) and USDC on Base (`0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf`) — these are the highest TVL markets.
- CoinGecko free tier is rate-limited to 10–30 req/min. Prices are fetched once per poll cycle and reused across all protocols in that cycle, not per-position.
- The `positions` table does not exist in the DB schema yet (`001_init.sql` has no positions table). A migration is needed.
- MarginFi and Solend Borsh parsing will be done with a minimal hand-written decoder — no external Borsh library exists for Go that is production-ready. The `near-api-go` library (mentioned in context.md) does not actually contain a Borsh decoder; use `github.com/gagliardetto/binary` (part of the Solana Go ecosystem) instead.
- `abigen` is assumed to be installed (`go install github.com/ethereum/go-ethereum/cmd/abigen@latest`).
- The Go module path is `reflex/services/monitor` (confirmed from go.mod).

## Architecture Changes

- `services/monitor/internal/storage/migrations/002_positions.sql`: new `positions` table to cache fetched data
- `services/monitor/internal/protocols/aave/client.go`: Aave V3 health factor via `UiPoolDataProvider`
- `services/monitor/internal/protocols/aave/abi/UiPoolDataProvider.json`: ABI file for abigen
- `services/monitor/internal/protocols/aave/bindings.go`: generated Go bindings (via abigen)
- `services/monitor/internal/protocols/compound/client.go`: Compound V3 health factor via Comet ABI
- `services/monitor/internal/protocols/compound/abi/Comet.json`: minimal Comet ABI (3 methods only)
- `services/monitor/internal/protocols/compound/bindings.go`: generated Go bindings
- `services/monitor/internal/protocols/marginfi/client.go`: MarginFi account fetch + Borsh decode
- `services/monitor/internal/protocols/solend/client.go`: Solend obligation fetch + manual parse
- `services/monitor/internal/prices/coingecko.go`: CoinGecko price client with in-memory cache
- `services/monitor/internal/protocols/types.go`: shared `Position` struct used by all protocol clients
- `services/monitor/internal/api/positions.go`: `GET /positions/:walletId` handler
- `services/monitor/cmd/server/main.go`: wire new dependencies, register route, add env vars
- `apps/mobile/services/api.ts`: add `getPositions(walletId)` function
- `apps/mobile/store/index.ts`: add `setPositions` action (read existing store first)

---

## Implementation Steps

### Phase 1: DB Migration + Shared Types — independently deployable, unblocks all protocol work

1. **Add positions migration** (`services/monitor/internal/storage/migrations/002_positions.sql`)
   - Action: Create table `positions` with columns: `id UUID PK`, `wallet_id UUID FK wallets(id) ON DELETE CASCADE`, `protocol TEXT NOT NULL`, `chain_id INT`, `health_factor NUMERIC`, `collateral_usd NUMERIC`, `debt_usd NUMERIC`, `fetched_at TIMESTAMPTZ DEFAULT NOW()`. Add `UNIQUE(wallet_id, protocol, chain_id)` so upserts work cleanly.
   - Why: The API handler and protocol clients need somewhere to cache results. Without this the `GET /positions/:walletId` endpoint has nothing to read from.
   - Depends on: None
   - Risk: Low

2. **Define shared Position type** (`services/monitor/internal/protocols/types.go`)
   - Action: Create package `protocols` with exported struct `Position { WalletID, Protocol, ChainID, HealthFactor, CollateralUSD, DebtUSD }`. All four protocol clients return `[]Position`. This is different from the DB type — it is the in-memory transfer object.
   - Why: Prevents import cycles. All protocol packages import this one shared type rather than each other.
   - Depends on: None
   - Risk: Low

---

### Phase 2: CoinGecko Price Feed — independently deployable, needed by Compound + Solana protocols

3. **CoinGecko price client** (`services/monitor/internal/prices/coingecko.go`)
   - Action: Create struct `Client { apiKey, httpClient, cache sync.Map }`. Implement `func (c *Client) GetUSDPrices(ctx context.Context, coinIDs []string) (map[string]float64, error)`. Call `https://api.coingecko.com/api/v3/simple/price?ids=<ids>&vs_currencies=usd`. Cache results for 60 seconds using `sync.Map` with a timestamp entry — re-fetch only if stale. Pass `x-cg-demo-api-key` header when `apiKey` is non-empty (free tier key).
   - Why: Compound V3 health factor requires USD values of collateral assets. MarginFi and Solend also need prices to compute USD-denominated health. Without this the health factor calculation is incomplete.
   - Depends on: None
   - Risk: Low — pure HTTP + JSON, no ABI encoding
   - Gotcha: Free tier rate limit is 30 req/min. The 60s cache per coin set keeps requests to 1/min per poll cycle. Do not call per-asset — batch all coin IDs in one request.

---

### Phase 3: EVM Protocol Clients (Aave V3, Compound V3)

4. **Fetch and commit Aave V3 UiPoolDataProvider ABI** (`services/monitor/internal/protocols/aave/abi/UiPoolDataProvider.json`)
   - Action: Download the ABI from the Aave V3 periphery repo at `https://github.com/aave/aave-v3-periphery` — specifically `contracts/misc/UiPoolDataProvider.sol`. Extract only the `getUserReservesData` function ABI fragment to keep the file manageable. Save as `UiPoolDataProvider.json`.
   - Why: abigen needs the ABI file to generate Go bindings. The full ABI is large (architecture.md explicitly warns about this) — use only the needed function fragment.
   - Depends on: None
   - Risk: Medium — ABI format must exactly match the deployed contract. Verify the fragment against mainnet via Etherscan if the generated call reverts.
   - Gotcha: The `UiPoolDataProvider` returns a complex nested struct. The Go binding will use auto-generated struct names like `IUiPoolDataProviderAggregatedReserveData`. These names are ugly but functional — do not rename them in the generated file.

5. **Generate Aave Go bindings** (`services/monitor/internal/protocols/aave/bindings.go`)
   - Action: Run `abigen --abi=internal/protocols/aave/abi/UiPoolDataProvider.json --pkg=aave --type=UiPoolDataProvider --out=internal/protocols/aave/bindings.go` from `services/monitor/`. Commit the generated file.
   - Why: Hand-writing ABI encoding for complex Solidity structs is error-prone. abigen handles encoding/decoding correctly.
   - Depends on: Step 4
   - Risk: Low once ABI file is correct

6. **Aave V3 client** (`services/monitor/internal/protocols/aave/client.go`)
   - Action: Create struct `Client { rpcURLs map[int]string }` where keys are chain IDs. Implement `func (c *Client) FetchPositions(ctx context.Context, address string) ([]protocols.Position, error)`. For each chain (1, 8453, 42161): dial `ethclient.DialContext`, instantiate `UiPoolDataProvider` binding with the correct contract address, call `GetUserReservesData(opts, poolAddressProvider, common.HexToAddress(address))`. Compute health factor: `totalCollateralBaseETH * weightedAvgLiquidationThreshold / totalDebtBaseETH / 10000`. Convert from 1e18 fixed point by dividing `big.Int` result with `new(big.Float).SetInt(result)` then dividing by `1e18`. Return a `Position` for each chain where `totalDebtBaseETH > 0` (skip chains with no debt — health factor is infinity).
   - Why: Core of Phase 3. Aave V3 is the most used EVM lending protocol.
   - Depends on: Steps 2, 5
   - Risk: Medium
   - Gotcha: `UiPoolDataProvider.GetUserReservesData` returns `([]AggregatedReserveData, UserReserveData, uint256, error)`. The health factor is NOT directly in the return — it must be computed from the reserves. The architecture.md formula uses `totalCollateralBase * avgLiquidationThreshold / totalDebtBase` — implement this by summing `(reserveData.UsageAsCollateralEnabled && userReserveData.UsedAsCollateralEnabled) ? scaledBalance * price * liquidationThreshold` across all reserves. The simpler path is to call `Comet.getUserAccountData` — but that method is on the `Pool` contract, not `UiPoolDataProvider`. Use the `Pool` contract's `getUserAccountData(address)` instead — it returns `healthFactor` directly as a `uint256` in 1e18. This is far simpler. Update the ABI to use `Pool.json` with only `getUserAccountData`. Contract addresses for `Pool`: Ethereum `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2`, Base `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5`, Arbitrum `0x794a61358D6845594F94dc1DB02A252b5b4814aD`.
   - Red Flag: The original architecture.md description of computing HF from `UiPoolDataProvider` reserves is correct but complex (>50 lines). Using `Pool.getUserAccountData` is the simpler, more direct approach and should be preferred.

7. **Fetch and commit Compound V3 Comet ABI** (`services/monitor/internal/protocols/compound/abi/Comet.json`)
   - Action: Extract only three function fragments from the Comet ABI: `borrowBalanceOf(address) returns (uint256)`, `collateralBalanceOf(address, address) returns (uint128)`, `getAssetInfo(uint8) returns (AssetInfo)`. Save as `Comet.json`. Market addresses: Ethereum USDC `0xc3d688B66703497DAA19211EEdff47f25384cdc3`, Base USDC `0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf`.
   - Why: Compound V3 uses a single Comet contract per market rather than a registry. Only three methods are needed.
   - Depends on: None
   - Risk: Low
   - Gotcha: `collateralBalanceOf` requires the asset address as second arg — you must iterate over all supported collateral assets. Call `numAssets()` first, then loop `getAssetInfo(i)` to get each `AssetInfo.asset` address. Add `numAssets() returns (uint8)` to the ABI fragment.

8. **Generate Compound Go bindings** (`services/monitor/internal/protocols/compound/bindings.go`)
   - Action: Run `abigen --abi=internal/protocols/compound/abi/Comet.json --pkg=compound --type=Comet --out=internal/protocols/compound/bindings.go` from `services/monitor/`.
   - Depends on: Step 7
   - Risk: Low

9. **Compound V3 client** (`services/monitor/internal/protocols/compound/client.go`)
   - Action: Create struct `Client { rpcURLs map[int]string, priceClient *prices.Client }`. Implement `func (c *Client) FetchPositions(ctx context.Context, address string) ([]protocols.Position, error)`. For each market: call `borrowBalanceOf(address)` — if zero, skip (no debt, no position). Call `numAssets()`, then for each asset call `collateralBalanceOf(address, assetAddr)`. Fetch USD prices for each collateral token via `priceClient`. Compute `collateralUSD = sum(balance * price)`. Compute `debtUSD = borrowBalance * usdcPrice` (USDC is $1 for MVP — no need to fetch, hardcode 1.0 but add a TODO comment to replace with real price). Health factor proxy = `collateralUSD * liquidationFactor / debtUSD`. `liquidationFactor` per asset is in `AssetInfo.liquidateCollateralFactor` (1e18 scale).
   - Depends on: Steps 2, 3, 8
   - Risk: Medium
   - Gotcha: `AssetInfo.liquidateCollateralFactor` is a `uint64` scaled to 1e18. Prices for collateral assets require CoinGecko coin IDs — you need a hardcoded map from ERC-20 token address to CoinGecko ID for the assets in each Comet market (e.g., WETH → `ethereum`, WBTC → `wrapped-bitcoin`, cbBTC → `coinbase-wrapped-btc`). Add this map as a package-level `var` in a separate `assets.go` file, not inline in `client.go`.

---

### Phase 4: Solana Protocol Clients (MarginFi, Solend)

10. **Add go-ethereum and Solana Go dependencies** (`services/monitor/go.mod`)
    - Action: Run `go get github.com/ethereum/go-ethereum@latest` and `go get github.com/gagliardetto/solana-go@latest` from `services/monitor/`. The `solana-go` library provides RPC client, account fetching, and Borsh decoding via `github.com/gagliardetto/binary`.
    - Why: EVM clients need `go-ethereum` for `ethclient` and `common.HexToAddress`. Solana clients need `solana-go` for RPC and account deserialization.
    - Depends on: None (can be done any time before Steps 6, 9, 11, 12)
    - Risk: Low
    - Gotcha: `go-ethereum` is a large dependency (~50MB). It will significantly increase build time. Acceptable for this project size.

11. **MarginFi client** (`services/monitor/internal/protocols/marginfi/client.go`)
    - Action: Create struct `Client { rpcURL string }` (Helius URL). Implement `func (c *Client) FetchPositions(ctx context.Context, address string) ([]protocols.Position, error)`. Use `solana-go` RPC client. Call `GetProgramAccounts` with filter: `memcmp` at offset 40 (the authority pubkey field in the MarginFi account layout) matching `address`. For each returned account, Borsh-decode the `MarginfiAccount` struct. The account discriminator is the first 8 bytes (Anchor standard) — skip it. Fields needed: `group` (32 bytes pubkey), `authority` (32 bytes), `lending_account.balances` (array of `Balance` structs). Each `Balance` has `active bool`, `bank_pk pubkey`, `asset_shares f64`, `liability_shares f64`. Fetch each active bank account to get `asset_share_value` and `liability_share_value` (both f64) and the bank's oracle price. Health factor = `sum(asset_shares * asset_share_value * price * asset_weight_maint) / sum(liability_shares * liability_share_value * price * liability_weight_maint)`.
    - Depends on: Steps 2, 3, 10
    - Risk: High
    - Gotcha 1: MarginFi uses Anchor's Borsh layout. The discriminator (first 8 bytes) is `sha256("account:MarginfiAccount")[0:8]`. Skip these before decoding. Use `gagliardetto/binary` decoder with `bin.NewBorshDecoder(data[8:])`.
    - Gotcha 2: The authority offset of 40 bytes assumes: 8 bytes discriminator + 32 bytes group pubkey = offset 40 for authority. Verify this against the actual IDL at `https://github.com/mrgnlabs/marginfi-v2` before hardcoding.
    - Gotcha 3: Bank account fetching is one RPC call per bank. A wallet with 5 positions triggers 5 bank lookups. Use `GetMultipleAccounts` to batch these into a single RPC call.
    - Gotcha 4: Helius RPC has a different base URL pattern from Alchemy. Helius URLs include the API key in the path: `https://mainnet.helius-rpc.com/?api-key=<KEY>`. Pass this as the `rpcURL` in the struct — do not construct it from parts inside the client.

12. **Solend client** (`services/monitor/internal/protocols/solend/client.go`)
    - Action: Create struct `Client { rpcURL string }`. Implement `func (c *Client) FetchPositions(ctx context.Context, address string) ([]protocols.Position, error)`. Program ID: `So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo`. Call `GetProgramAccounts` with `memcmp` filter at offset 25 matching the owner pubkey (Solend Obligation layout: 1 byte version + 8 bytes last_update + 32 bytes lending_market + offset 41 is actually the owner — verify against `https://github.com/solendprotocol/solend-sdk`). The Obligation account has `deposited_value`, `borrowed_value`, `allowed_borrow_value` as `Decimal` types (16 bytes each, little-endian fixed point with 18 decimal places). Health factor = `allowed_borrow_value / borrowed_value`. If `borrowed_value == 0`, skip.
    - Depends on: Steps 2, 10
    - Risk: High
    - Gotcha 1: Solend does NOT use Anchor — it uses a custom binary layout. There is no discriminator prefix. The `Decimal` type is a `u128` scaled to 1e18. Decode as `binary.LittleEndian.Uint128` then divide by 1e18.
    - Gotcha 2: The owner field offset in Obligation must be verified against the Solend program source. Incorrect offset silently returns all obligations or none. Cross-check by fetching a known obligation address on devnet.
    - Gotcha 3: `collateral_usd = deposited_value` and `debt_usd = borrowed_value` are already USD-denominated in the Obligation account — Solend stores pre-computed USD values. No need to call CoinGecko for Solend.

---

### Phase 5: Position Storage + API Endpoint

13. **Position storage helper** (`services/monitor/internal/storage/positions.go`)
    - Action: Create package `storage` with function `func UpsertPositions(ctx context.Context, db *pgxpool.Pool, positions []protocols.Position) error`. Use `INSERT INTO positions (...) ON CONFLICT (wallet_id, protocol, chain_id) DO UPDATE SET health_factor=EXCLUDED.health_factor, collateral_usd=EXCLUDED.collateral_usd, debt_usd=EXCLUDED.debt_usd, fetched_at=NOW()`. Use `pgx/v5`'s `pgxpool.Pool.SendBatch` for batch upserts when len > 1.
    - Why: Separates DB logic from handler. Keeps `positions.go` handler small. Follows the existing pattern in the codebase where DB interactions are direct SQL via pgx.
    - Depends on: Step 1
    - Risk: Low

14. **Positions API handler** (`services/monitor/internal/api/positions.go`)
    - Action: Add method `func (h *Handler) GetPositions(w http.ResponseWriter, r *http.Request)`. Extend the `Handler` struct to hold protocol clients — but do NOT add them directly to the existing `Handler` struct in `wallets.go`. Instead create a new `PositionsHandler` struct: `type PositionsHandler struct { db *pgxpool.Pool, aave *aave.Client, compound *compound.Client, marginfi *marginfi.Client, solend *solend.Client }`. Wire it separately in `main.go`. The handler: gets `walletId` from URL param, loads wallet from DB (to get `address` and `chain_family`), calls the appropriate protocol clients concurrently using `errgroup`, calls `storage.UpsertPositions`, then reads back from DB and returns JSON. Timeout via `context.WithTimeout(r.Context(), 10*time.Second)` wrapping all protocol fetches.
    - Why: Concurrent protocol fetching is essential — Aave has 3 chains and Compound has 2 markets; sequential calls would take 5× longer. `errgroup` (from `golang.org/x/sync/errgroup`) handles this cleanly and is already an indirect dependency.
    - Depends on: Steps 1, 2, 3, 6, 9, 11, 12, 13
    - Risk: Medium
    - Gotcha: A wallet with `chain_family = 'solana'` should only call marginfi and solend clients. A wallet with `chain_family = 'evm'` should only call aave and compound. Gate protocol dispatch on `chain_family` — otherwise EVM address strings will be passed to Solana RPC and cause confusing errors.

15. **Wire new route in main.go** (`services/monitor/cmd/server/main.go`)
    - Action: Read env vars `ALCHEMY_API_KEY`, `HELIUS_API_KEY`, `COINGECKO_API_KEY`. Construct `rpcURLs` map for Aave/Compound using Alchemy base URLs: `https://eth-mainnet.g.alchemy.com/v2/<key>`, `https://base-mainnet.g.alchemy.com/v2/<key>`, `https://arb-mainnet.g.alchemy.com/v2/<key>`. Construct Helius URL. Instantiate all protocol clients and `prices.Client`. Instantiate `PositionsHandler`. Register route `router.Get("/positions/{walletId}", ph.GetPositions)`.
    - Depends on: Step 14
    - Risk: Low

---

### Phase 6: Mobile Integration

16. **Add getPositions to API client** (`apps/mobile/services/api.ts`)
    - Action: Add `export async function getPositions(walletId: string): Promise<Position[]>`. Fetch `GET /positions/:walletId`. The response shape is `{ positions: Position[] }` — match the pattern already used by `getWallets`. Import `Position` from `../store/types`.
    - Depends on: Step 14 (backend must exist first)
    - Risk: Low

17. **Add positions state to store** (`apps/mobile/store/index.ts`)
    - Action: Read the existing file first. Add `positions: Position[]` to store state and `setPositions: (positions: Position[]) => void` action. Follow the exact same Zustand pattern used for `wallets` in the existing store.
    - Depends on: Step 16
    - Risk: Low

18. **Dashboard positions fetch** (`apps/mobile/app/(tabs)/index.tsx`)
    - Action: Read the existing file. Replace the placeholder `Home` component with a real dashboard that: reads `wallets` and `positions` from store, calls `getPositions(walletId)` for each wallet on mount (via `useEffect`), calls `setPositions` on success, renders a flat list of position cards showing `protocol`, `healthFactor` (2 decimal places), `collateralUsd`, `debtUsd`. Use `StyleSheet.create()` — no inline styles. No UI library dependency — plain `View`/`Text`/`FlatList`.
    - Depends on: Steps 16, 17
    - Risk: Low

---

## Testing Strategy

- **Unit — Aave health factor math** (`services/monitor/internal/protocols/aave/client_test.go`): table-driven tests with hardcoded `getUserAccountData` responses, verify HF is parsed from 1e18 correctly (e.g., input `1500000000000000000` → output `1.5`).
- **Unit — Compound HF computation** (`services/monitor/internal/protocols/compound/client_test.go`): mock RPC responses, verify collateral sum with liquidation factors.
- **Unit — CoinGecko cache** (`services/monitor/internal/prices/coingecko_test.go`): verify second call within 60s does not hit HTTP.
- **Unit — Borsh decode** (`services/monitor/internal/protocols/marginfi/client_test.go`): take a real serialized MarginFi account from devnet, assert decoded fields match expected values.
- **Unit — Solend Obligation decode** (`services/monitor/internal/protocols/solend/client_test.go`): same approach with a real devnet Obligation account binary.
- **Integration — positions endpoint** (`services/monitor/internal/api/positions_test.go`): spin up a test DB with `pgxtest`, insert a wallet row, mock all protocol clients returning known positions, call the handler, assert JSON response shape and that DB upsert happened.
- **E2E — manual**: with valid Alchemy + Helius keys in `.env`, call `GET /positions/<real-wallet-id>` for a wallet known to have Aave positions on mainnet. Verify health factor matches what Aave's own UI shows (within 1%).

---

## Risks & Mitigations

- **Aave ABI complexity**: Using `Pool.getUserAccountData` instead of `UiPoolDataProvider` eliminates the multi-struct decode complexity. The Pool contract returns HF directly in one call. Mitigation: commit and document the chosen contract address per chain.
- **Borsh decode for MarginFi**: The layout can shift across protocol upgrades. Mitigation: pin to a specific IDL version and add a discriminator check at the start of decode — if discriminator does not match expected, return an error rather than silently producing garbage data.
- **Solend non-Anchor layout**: No discriminator means no format verification. Mitigation: check `version` byte (first byte of Obligation) is `1` before parsing. Return an error if not.
- **Helius vs Alchemy RPC differences**: Alchemy uses `eth_call` over JSON-RPC. Helius uses Solana JSON-RPC (`getProgramAccounts` with filters). They are entirely different APIs — there is no shared client code. Mitigation: keep EVM and Solana protocol clients in completely separate packages with no shared RPC layer.
- **CoinGecko rate limiting**: Free tier is ~30 req/min. With 10 wallets polled every 60s, and one price batch per poll cycle, that is 10 req/min — within limits. Risk increases as wallet count grows. Mitigation: the 60s `sync.Map` cache is per coin-set, not per wallet. Deduplicate coin IDs across all wallets in a poll cycle and fetch once. Add a TODO to upgrade to CoinGecko Pro or switch to Pyth at >50 wallets.
- **go-ethereum module size**: Pulling in all of `go-ethereum` for `ethclient` and `common` is heavyweight. Mitigation: acceptable at MVP scale. Alternative for later phases: use a minimal JSON-RPC client and encode ABI calls manually — but that is premature optimization now.
- **Missing EVM wallet chain_id column**: The `wallets` table has `chain_family` (`evm`/`solana`) but no `chain_id` column. The Aave client queries all 3 EVM chains regardless. For Compound, the market address already implies the chain. No schema change needed for Phase 3 — the protocol clients iterate all chains internally. Add per-chain wallet tracking as a Phase 5 enhancement.

---

## Success Criteria

- [ ] `002_positions.sql` migration runs without error via `make migrate`
- [ ] `GET /positions/:walletId` returns HTTP 200 with valid JSON `{ "positions": [...] }` for a known EVM wallet
- [ ] `GET /positions/:walletId` returns HTTP 200 with valid JSON for a known Solana wallet
- [ ] Aave V3 health factor for a test address matches Aave UI within 1%
- [ ] Compound V3 health factor for a test address is a positive finite float64
- [ ] MarginFi health factor for a test address is a positive finite float64
- [ ] Solend health factor for a test address is a positive finite float64
- [ ] A wallet with no positions on a protocol returns that protocol omitted from the array (not returned with HF=infinity or NaN)
- [ ] CoinGecko is not called more than once per 60-second window for the same coin set
- [ ] `go test ./...` passes
- [ ] Mobile dashboard screen shows at least one position card for a wallet with known Aave debt
- [ ] No `any` types introduced in TypeScript files
- [ ] No inline styles in new React Native components
