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

## Phase 5 — Polish (complete)

Last updated: 2026-03-18

### What was built

**Design system & tokens**
- `design-system/tokens.ts` — full color token set (light + dark), `FontFamily`, `FontSize`, `Spacing`, `Radius`
- `getColors(scheme)` utility exported for non-hook usage
- `getHFColor`, `getHFBgColor` helpers for health factor color coding

**Theme engine**
- `store/index.ts` — added `theme: "system"|"light"|"dark"`, `systemScheme: "light"|"dark"`, notification prefs, `refreshInterval`
- `hooks/useThemeColors.ts` — `useThemeColors()` and `useIsDark()` hooks that read from Zustand store directly (not `useColorScheme`) — eliminates `Appearance.setColorScheme` race conditions
- `app/_layout.tsx` — seeds `systemScheme` from `Appearance.getColorScheme()` on boot, subscribes to `Appearance.addChangeListener` for live system theme changes
- All screens and components migrated from `useColors()` + `useColorScheme()` to `useThemeColors()` + `useIsDark()`

**New screens & components**
- `app/(tabs)/wallets.tsx` — dedicated Wallets tab: card per wallet with chain badge (EVM/Solana icon), label, truncated address, remove button, empty state CTA
- `app/alert-history.tsx` — alert event history screen with timestamp, protocol, value at trigger
- `components/HealthBar.tsx` — animated health factor bar with color transitions (green→yellow→red)
- `app/onboarding.tsx` — 4-slide onboarding with animated gauge rings, read-only messaging, skip/continue flow

**Premium tab bar**
- Replaced Expo Router default tab bar with fully custom `PremiumTabBar` component
- Floating pill design: `position: absolute`, `bottom: 20`, `borderRadius: 22`, surface bg, elevation 16 shadow
- Animated sliding accent-soft pill indicator (`Animated.spring`, `tension: 180, friction: 14`)
- Per-tab icon scale bounce on press (`0.82` → spring back)
- Active: accent icon (filled variant) + accent semibold label; inactive: tertiary at 70% opacity

**Settings screen (full rebuild)**
- Appearance: three theme preview cards showing actual mini UI mockup (header, content cards, tab bar) using real color tokens; System card splits left=light / right=dark using `200%` width clip trick
- Notifications: Push Alerts toggle, Sound toggle, Quiet Hours toggle — with cascading disable when push is off
- Monitoring: Refresh Interval chip selector (5/15/30/60 min)
- All settings persisted to AsyncStorage and restored on app launch

**Tab bar label fix**
- `height: 92`, `paddingTop: 10`, `lineHeight: 14`, `marginTop: 2` — labels no longer clip on any font scale

**Storage keys added**
- `THEME`, `NOTIF_PUSH`, `NOTIF_SOUND`, `NOTIF_QUIET_HOURS`, `REFRESH_INTERVAL`

### Key decisions made in Phase 5
- Don't use `Appearance.setColorScheme` to drive UI colors — Zustand store is source of truth; `systemScheme` tracked via `addChangeListener` independently
- `MockupContent` + `200%/−100%` clip pattern for system split preview — no pixel measurements needed
- Custom `tabBar` prop on `<Tabs>` for full control — Expo Router's default tabBar cannot achieve floating pill
- `108px` bottom padding on all tab screen lists so content clears the floating bar

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
