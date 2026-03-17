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
- Single engine polls all wallets with active rules on a 60s ticker
- `Start(ctx)` blocks until ctx cancelled (SIGTERM/SIGINT via `signal.NotifyContext`)
- `pollOnce`: calls `storage.GetWalletsWithActiveRules`, fans out one goroutine per wallet
- Each wallet goroutine has `recover()` — panics are logged, never crash the engine
- `fetchPositions`: runs EVM or Solana fetchers concurrently via `sync.WaitGroup`; one fetcher failure logs and skips, partial results still evaluated (no errgroup cancel)
- Poll cycle per wallet:
  1. Fetch positions from relevant protocol clients concurrently
  2. `storage.UpsertPositions` — keeps position cache fresh (failure is non-fatal)
  3. `alerts.Evaluate(wallet.Rules, positions)` — pure function, returns triggered rules
  4. For each triggered rule: get push token → send push → if push fails, return (no cooldown stamp); if ok, `MarkRuleTriggered` + `InsertAlertEvent`

### Shared Fetcher Interface (`internal/protocols/fetch.go`)
```go
type Fetcher interface {
    FetchPositions(ctx context.Context, walletID, address string) ([]Position, error)
}
```
All four protocol clients (aave, compound, marginfi, solend) implement this. Used by both `PositionsHandler` and the monitor engine.

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
Pure function — no I/O, no DB. Takes `[]storage.AlertRule` + `[]protocols.Position`, returns `[]TriggeredRule`.

```go
type TriggeredRule struct {
    Rule    storage.AlertRule
    Message string   // human-readable notification body
    Value   float64  // health factor value at trigger time
}

func Evaluate(rules []storage.AlertRule, positions []protocols.Position) []TriggeredRule
```

Logic per rule:
- Skip if `!rule.Active`
- `health_factor`: find matching position by protocol + optional chainID → check direction (`below`/`above`) → check 30min cooldown via `last_triggered_at`
- `price_change`: stubbed, always skipped (Phase 5)
- Cooldown: `time.Since(*LastTriggeredAt) >= 30min` — nil pointer means never triggered

### Expo Push Client (`internal/notifications/expo.go`)
- Endpoint: `https://exp.host/--/api/v2/push/send`
- Batch size: 100 messages per request (splits automatically)
- Single retry on 5xx — checks `ctx.Err()` first to skip retry on cancelled context
- Non-200/5xx: body drained via `io.Copy(io.Discard)` before close (preserves TCP connection reuse)
- Response: `[]PushTicket` — caller checks `ticket.Details.Error == "DeviceNotRegistered"` and calls `storage.MarkPushTokenInactive`
- Push token invalidation: `token_active = FALSE` on users table (migration 003)

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
  → alerts.tsx: select wallet → protocol → direction → threshold (form)
  → api.ts: POST /alerts { userId, walletId, protocol, alertType, threshold, direction }
  → store: addAlert(created rule)

Alert rule deletion
  → alerts.tsx: delete button
  → api.ts: DELETE /alerts/:alertId?userId=
  → store: removeAlert(id)

Alert history
  → api.ts: GET /alerts/:userId/history
  → returns []AlertEvent { message, valueAtTrigger, sentAt }

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
| GET | `/alerts/:userId/history` | Alert event history (registered before `/:userId`) |
| GET | `/alerts/:userId` | List alert rules |
| DELETE | `/alerts/:alertId?userId=` | Delete alert rule (userId scopes ownership) |
