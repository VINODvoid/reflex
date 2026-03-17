# REFLEX — Current Build Context

## Status: Phase 4 — Alert Engine (complete)

Active phase: **Phase 5**
Last updated: 2026-03-17

---

## Phase 1 — Foundation (complete)

- Monorepo: `apps/mobile` (Expo SDK 55, Expo Router, Zustand) + `services/monitor` (Go, chi, pgx)
- Go backend: `cmd/server/main.go` — loads .env, connects to postgres, chi router
- DB: postgres via Docker Compose, `001_init.sql` migrated
- Makefile: `make dev`, `make migrate`, `make test`
- Mobile: Expo Router 3 tabs, Zustand store, `services/api.ts`

---

## Phase 2 — Wallet Input (complete)

- `POST /users` — push token registration, returns userId
- `POST /wallets` — add EVM or Solana wallet
- `GET /wallets/:userId` — list wallets
- Mobile: `wallet/connect.tsx` — paste address UI wired to store + API
- Mobile: `_layout.tsx` — push token registered on boot, userId persisted via AsyncStorage
- Mobile: `store/types.ts` — Wallet, Position, AlertRule types defined
- Branch: `feat/phase-2-wallet-ui` merged

---

## Phase 3 — Position Data (complete)

- DB: `002_positions.sql` — positions table with upsert unique constraint
- `internal/protocols/types.go` — shared Position struct with JSON tags
- `internal/prices/coingecko.go` — CoinGecko client with 60s in-memory cache
- `internal/protocols/aave/` — Aave V3 via `Pool.getUserAccountData` (Ethereum, Base, Arbitrum)
- `internal/protocols/compound/` — Compound V3 collateral/borrow HF (Ethereum, Base)
- `internal/protocols/marginfi/` — MarginFi V2 Borsh decode + I80F48 math
- `internal/protocols/solend/` — Solend obligation binary decode
- `internal/storage/positions.go` — batch upsert via pgx SendBatch
- `internal/api/positions.go` — `GET /positions/:walletId`, concurrent protocol fetch via errgroup
- Mobile: `getPositions` in api.ts, dashboard with PositionCard + health factor colour coding
- Branch: `feat/phase-3-positions` (open, not yet merged)

### Key decisions made in Phase 3
- Aave: use `Pool.getUserAccountData` (returns HF directly) — not UiPoolDataProvider
- MarginFi Bank struct offsets verified by hand — see VERIFY AGAINST IDL comment in client.go
- Solend owner field at offset 42 — verify against source before production use
- Borsh library: `gagliardetto/binary` (not near-api-go)
- Separate `PositionsHandler` struct — not added to existing `Handler`

---

## Phase 4 — Alert Engine (complete)

- Alert CRUD API (`POST /alerts`, `GET /alerts/:userId`, `DELETE /alerts/:alertId`)
- Monitor goroutine engine (`internal/monitor/engine.go`) — 60s ticker, goroutine per wallet, panic recovery
- Rule evaluator + 30min cooldown (`internal/alerts/evaluator.go`) — pure function, health_factor only
- Expo push delivery (`internal/notifications/expo.go`) — 100-msg batching, single retry on 5xx
- Alert history endpoint (`GET /alerts/:userId/history`)
- Storage layer (`internal/storage/alerts.go`) — full CRUD + push token management
- Shared `protocols.Fetcher` interface (`internal/protocols/fetch.go`)
- DB migration `003_users_token_active.sql` — adds `token_active` column to users
- Mobile: `AlertEvent` type, `setAlerts` store action, 4 API functions, full alerts screen
- `main.go` upgraded with graceful shutdown via SIGTERM/SIGINT

### Key decisions made in Phase 4
- `price_change` alert type stubbed in evaluator — fires nothing, Phase 5 enhancement
- `token_active` column added to users table (migration 003) — cleaner than REVOKED: prefix hack
- Engine polls only wallets with active rules — no wasted RPC calls
- Push is fire-and-forget (log errors, never block the poll cycle)
- Graceful HTTP server shutdown on SIGTERM with 5s timeout

## Phase 5 — Polish (not started)

- HealthBar component
- Alert history screen
- Notification deep links
- Onboarding flow

---

## Key Decisions Made

| Decision | Reason |
|----------|--------|
| Expo SDK 55 (not bare RN) | Faster iteration, OTA updates, Expo Router |
| chi router (not gin/echo) | Minimal, idiomatic, stdlib-compatible |
| pgx/v5 directly (no ORM) | Full SQL control, no magic, better perf |
| Anonymous users (push token = identity) | No auth friction for MVP |
| CoinGecko free tier for prices | Zero cost for MVP, swap to Pyth later |
| 60s poll interval default | Balance between freshness and RPC cost |
| 30min alert cooldown | Prevent notification spam on slow decline |
| Pool.getUserAccountData for Aave | Returns HF directly — simpler than UiPoolDataProvider |
| gagliardetto/binary for Borsh | near-api-go has no Borsh decoder |
| Separate PositionsHandler | Keeps wallet handler focused, avoids god object |

---

## Known Issues / Watch Points

- MarginFi Bank struct byte offsets need verification against IDL — see VERIFY AGAINST IDL comment
- Solend Obligation owner offset (42) needs verification against program source
- Expo push token: must use `getExpoPushTokenAsync({ projectId })` (SDK 49+ requirement)
- Reown AppKit / Solana Mobile Wallet Adapter skipped in Phase 2 — paste-address only for now
- Solana Mobile Wallet Adapter only works on Android — needs fallback UX for iOS

---

## Environment Setup

Local dev requires:
- Docker (for postgres via compose)
- Go 1.22+
- Bun (latest) — used instead of Node/npm for all JS tooling
- `abigen` from go-ethereum: `go install github.com/ethereum/go-ethereum/cmd/abigen@latest`

### Backend (`services/monitor/.env`)
```
DATABASE_URL=postgres://...
ALCHEMY_API_KEY=...
HELIUS_API_KEY=...
COINGECKO_API_KEY=...
PORT=8080
```

### Mobile (`apps/mobile/.env`)
```
EXPO_PUBLIC_API_URL=http://localhost:8080
```
