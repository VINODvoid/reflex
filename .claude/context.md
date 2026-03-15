# REFLEX — Current Build Context

## Status: Phase 1 — Foundation (not started)

Active phase: **Phase 1**
Last updated: 2026-03-15

---

## Active Phase: 1 — Foundation

### Goal
Get a running skeleton: Go server connects to postgres, Expo app boots with nav shell and empty store.

### Checklist
- [ ] Monorepo root: `package.json` (workspaces), `.gitignore`
- [ ] Go backend: `services/monitor/go.mod`, `cmd/server/main.go`, `Makefile`
- [ ] DB migrations: `001_init.sql` (full schema)
- [ ] Docker Compose: postgres for local dev
- [ ] Expo app: `apps/mobile/package.json`, Expo Router layout
- [ ] Zustand store shape: `apps/mobile/store/index.ts`
- [ ] API client stub: `apps/mobile/services/api.ts`
- [ ] Push token registration: `apps/mobile/services/notifications.ts`
- [ ] Go health check: `GET /health` returns `{"status":"ok"}`

### Done When
- `make dev` in `services/monitor` starts server with no errors
- `GET http://localhost:8080/health` returns 200
- `npx expo start` in `apps/mobile` boots without errors
- Tabs visible: Dashboard, Alerts, Settings (all empty)

---

## Phase 2 — Wallet Input (not started)

- Paste-address flow (EVM + Solana)
- WalletConnect v2 via Reown AppKit
- Solana Mobile Wallet Adapter
- POST /wallets, persist to DB
- Push token → POST /users

## Phase 3 — Position Data (not started)

- Aave V3 health factor (Ethereum, Base, Arbitrum)
- Compound V3 health factor
- MarginFi (Solana)
- Solend (Solana)
- CoinGecko price feed
- GET /positions/:walletId

## Phase 4 — Alert Engine (not started)

- Alert CRUD API
- Monitor goroutine engine
- Rule evaluator + cooldown
- Expo push delivery
- Alert history endpoint

## Phase 5 — Polish (not started)

- HealthBar component
- Alert history screen
- Notification deep links
- Onboarding flow

---

## Key Decisions Made

| Decision | Reason |
|----------|--------|
| Expo SDK 52 (not bare RN) | Faster iteration, OTA updates, Expo Router |
| chi router (not gin/echo) | Minimal, idiomatic, stdlib-compatible |
| pgx/v5 directly (no ORM) | Full SQL control, no magic, better perf |
| Anonymous users (push token = identity) | No auth friction for MVP |
| CoinGecko free tier for prices | Zero cost for MVP, swap to Pyth later |
| 60s poll interval default | Balance between freshness and RPC cost |
| 30min alert cooldown | Prevent notification spam on slow decline |

---

## Known Issues / Watch Points

- Aave V3 `UiPoolDataProvider` ABI is large — generate Go bindings with `abigen`, don't hand-write
- MarginFi uses Borsh encoding — use `near-api-go` or write a minimal Borsh decoder
- Expo push token format changed in SDK 49+ — must use `getExpoPushTokenAsync({ projectId })` not the old form
- Reown AppKit for React Native is still relatively new — check their docs for latest installation steps before Phase 2
- Solana Mobile Wallet Adapter only works on Android with a wallet installed — need fallback UX for iOS

---

## Environment Setup

Local dev requires:
- Docker (for postgres via compose)
- Go 1.22+
- Bun (latest) — used instead of Node/npm for all JS tooling
- `abigen` from go-ethereum: `go install github.com/ethereum/go-ethereum/cmd/abigen@latest`
