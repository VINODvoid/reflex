# REFLEX — System Architecture

## Overview

```
Mobile App (Expo)
      │
      │  REST API (JSON)
      ▼
Go Backend (chi router)
      │
      ├── PostgreSQL (wallets, alert rules, alert events)
      │
      ├── Monitor Engine (goroutines per wallet×protocol)
      │     │
      │     ├── Aave V3 → Alchemy EVM RPC → ABI call → health factor
      │     ├── Compound V3 → Alchemy EVM RPC → ABI call → borrow capacity
      │     ├── MarginFi → Helius Solana RPC → program account parse
      │     └── Solend → Helius Solana RPC → obligation account parse
      │
      ├── Alert Evaluator (rules → triggers → cooldown check)
      │
      └── Expo Push Client → exp.host/--/api/v2/push/send → FCM/APNs → Device
```

---

## Backend Internals

### Entry Point (`cmd/server/main.go`)
- Reads env vars
- Initializes DB pool (pgx/v5)
- Wires all internal dependencies
- Starts chi HTTP server
- Starts monitor engine in background goroutine

### API Layer (`internal/api/`)
- `wallets.go` — CRUD for wallet addresses
- `alerts.go` — CRUD for alert rules
- `positions.go` — read-only position data fetch on-demand

All handlers receive dependencies via a `Handler` struct. No globals.

### Monitor Engine (`internal/monitor/engine.go`)
- Maintains a `map[walletID]cancelFunc` for goroutine lifecycle
- On wallet add/remove: spawns or kills goroutine
- Each goroutine polls on a ticker (configurable interval, default 60s)
- Poll cycle:
  1. Fetch positions from all relevant protocols for wallet
  2. Load active alert rules for wallet from DB
  3. Run `alerts.Evaluator.Evaluate(rules, positions)`
  4. For each triggered rule: check cooldown, send push, write `alert_events` row

### Protocol Clients

#### Aave V3 (`internal/protocols/aave/`)
- Target contract: `Pool` (per chain)
- Method: `getUserAccountData(user)` — returns healthFactor directly as uint256 in 1e18
- Pool addresses: Ethereum `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2`, Base `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5`, Arbitrum `0x794a61358D6845594F94dc1DB02A252b5b4814aD`
- ABI: minimal fragment in `internal/protocols/aave/abi/Pool.json`

#### Compound V3 (`internal/protocols/compound/`)
- Target: Comet contract per market
- Calls: `borrowBalanceOf`, `collateralBalanceOf`, `getAssetInfo`, `numAssets`
- Health factor = sum(collateral × liquidateCollateralFactor × price) / debtUSD
- Markets: Ethereum USDC `0xc3d688B66703497DAA19211EEdff47f25384cdc3`, Base USDC `0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf`
- Token → CoinGecko ID map in `internal/protocols/compound/assets.go`

#### MarginFi (`internal/protocols/marginfi/`)
- Program ID: `MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA` (mainnet)
- Filter: `GetProgramAccounts` with memcmp at offset 40 (authority field)
- Decode: Borsh via `gagliardetto/binary`, skip 8-byte Anchor discriminator
- I80F48 fixed-point: 16-byte little-endian i128, divide by 2^48
- Bank accounts batch-fetched via `GetMultipleAccounts`
- ⚠️ Bank struct byte offsets need verification against MarginFi V2 IDL

#### Solend (`internal/protocols/solend/`)
- Program ID: `So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo`
- Filter: `GetProgramAccounts` with memcmp at offset 42 (owner field)
- Custom binary layout (not Anchor) — Decimal = u128 scaled to 1e18
- Health factor = `allowedBorrowValue / borrowedValue` (pre-computed USD in obligation)
- ⚠️ Owner offset 42 needs verification against Solend program source

### Alert Evaluator (`internal/alerts/evaluator.go`)
```go
type Rule struct {
    AlertType  string  // "health_factor" | "price_change"
    Threshold  float64
    Direction  string  // "below" | "above"
    Protocol   string
}

type Position struct {
    Protocol    string
    HealthFactor float64
    // ...
}

func Evaluate(rules []Rule, positions []Position) []TriggeredRule
```

Cooldown: default 30 minutes per rule — prevents spam on a slowly declining HF.

### Expo Push Client (`internal/notifications/expo.go`)
- Endpoint: `https://exp.host/--/api/v2/push/send`
- Batch size: 100 tokens per request
- Response handling: `DeviceNotRegistered` → mark token inactive in DB
- Retry: single retry on 5xx, then log and move on

---

## Database

See `/services/monitor/internal/storage/migrations/001_init.sql` for full schema.

Key design decisions:
- Users are anonymous — identified only by Expo push token
- `wallets.chain_family` is `'evm'` or `'solana'` — chain ID stored separately for EVM
- Alert cooldown enforced via `last_triggered_at` — checked in evaluator before firing
- `alert_events` is append-only — never delete, used for history screen

---

## Mobile Data Flow

```
App start
  → notifications.ts: get Expo push token
  → api.ts: POST /users { expoPushToken }
  → store: save userId

Add wallet
  → wallet/connect.tsx: address + chain
  → api.ts: POST /wallets { userId, address, chainFamily }
  → store: append wallet

Dashboard load
  → api.ts: GET /positions/:walletId (per wallet)
  → store: update positions
  → PositionCard renders with HealthBar

Alert rule creation
  → alerts.tsx: select wallet → protocol → metric → threshold
  → api.ts: POST /alerts { ruleParams }
  → store: append rule

Push notification received
  → notifications.ts handler
  → deep link: /wallet/[address]?protocol=aave
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness check |
| POST | `/users` | Register push token, get userId |
| POST | `/wallets` | Add wallet to monitoring |
| GET | `/wallets/:userId` | List wallets for user |
| DELETE | `/wallets/:walletId` | Remove wallet |
| GET | `/positions/:walletId` | Fetch current positions across all protocols |
| POST | `/alerts` | Create alert rule |
| GET | `/alerts/:userId` | List alert rules |
| DELETE | `/alerts/:alertId` | Delete alert rule |
| GET | `/alerts/:userId/history` | Alert event history |
