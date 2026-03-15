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
- Target contract: `UiPoolDataProvider` (different address per chain, see below)
- Method: `getUserReservesData(poolAddressProvider, user)`
- Health factor computed from response: `totalCollateralBase * avgLiquidationThreshold / totalDebtBase`
- HF is returned in 18-decimal fixed point — divide by 1e18

**Contract addresses:**
| Chain | UiPoolDataProvider | PoolAddressesProvider |
|-------|-------------------|----------------------|
| Ethereum (1) | `0x91c0eA31b49B69Ea18607702c5d9aC360bf3dE7d` | `0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e` |
| Base (8453) | `0x174446a6741300cD2E7C1b1A636Fee99c8F83F9b` | `0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64b` |
| Arbitrum (42161) | `0x5c5228aC8BC1528482514aF3e27E692495148717` | `0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb` |
| Polygon (137) | `0xC69728f11E9E6127733751c8410432913123acf1` | `0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb` |
| Optimism (10) | `0xbd83DdBE37fc91923d59C8c1E0bDe0CccCa332d5` | `0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb` |

#### Compound V3 (`internal/protocols/compound/`)
- Target: Comet contract per market
- Calls: `getBorrowableOf(account)` and `borrowBalanceOf(account)` and `collateralBalanceOf(account, asset)`
- Health factor proxy = sum(collateral_value × liquidation_factor) / borrow_balance

#### MarginFi (`internal/protocols/marginfi/`)
- Program ID: `MFv2hWf31Z9kbCa1snEPdcgp7nZFuubnBXf8Ygy3cK` (mainnet)
- Fetch MarginfiAccount program accounts filtered by authority (user pubkey)
- Decode via Borsh: extract `lending_pool_balances` to compute weighted health

#### Solend (`internal/protocols/solend/`)
- Program ID: `So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo`
- Fetch `Obligation` accounts filtered by owner
- Parse `depositedValue`, `borrowedValue`, `allowedBorrowValue` → health = allowedBorrowValue / borrowedValue

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
