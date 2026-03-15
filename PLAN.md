# REFLEX — Product Plan

## Problem

DeFi traders open leveraged positions on lending protocols (Aave, Compound, MarginFi, Solend) and have no reliable mobile-native way to know when those positions approach liquidation.

**Existing solutions are all bad:**
- Desktop dashboards (Aave UI, Zapper) — passive, no push alerts
- Telegram bots — hacky, require trust, no deep mobile integration
- Protocol email alerts — too slow, often hours late
- DeBank — good reader but weak alerting, no Solana

**REFLEX fills the gap:** push notifications on mobile that alert users *before* liquidation happens, with a clean read-only UX that requires no custody of funds.

---

## Ecosystem Position

| App | Role |
|-----|------|
| NUCLEUS | Wallet reader — portfolio balances, token prices |
| REFLEX | Risk monitor — lending positions, liquidation alerts |
| CORTEX | AI agent swarm — autonomous DeFi execution |

REFLEX is the risk layer. It reads the same wallets NUCLEUS tracks but focuses entirely on lending protocol health and alert delivery.

---

## Core Value Props

1. **Pre-liquidation alerts** — user sets a health factor threshold (e.g. 1.3), gets a push notification before hitting 1.0
2. **Multi-protocol** — Aave V3, Compound V3 (EVM), MarginFi, Solend (Solana) in one view
3. **Multi-chain** — Ethereum, Base, Arbitrum, Polygon, Optimism, Solana
4. **Read-only, no custody** — paste an address or connect WalletConnect, no signing required for monitoring
5. **Mobile-first** — built for Expo, not a web dashboard wrapped in React Native

---

## Build Phases

### Phase 1 — Foundation
- Monorepo scaffold: `apps/mobile`, `services/monitor`
- Expo app: blank nav shell, Zustand store, API client stub
- Go server: chi router, health check endpoint, PostgreSQL connection, migrations
- Docker Compose for local postgres

### Phase 2 — Wallet Input
- Paste-address wallet addition (EVM + Solana)
- WalletConnect v2 via Reown AppKit for EVM
- Solana Mobile Wallet Adapter
- POST /wallets on backend, persist to DB
- Expo push token registration on app start → POST /users

### Phase 3 — Position Data
- Aave V3 health factor polling (Ethereum + Base + Arbitrum)
- Compound V3 health factor
- MarginFi (Solana)
- Solend (Solana)
- CoinGecko price feed for price alerts
- GET /positions/:walletId endpoint aggregating all protocols

### Phase 4 — Alert Engine
- Alert rule CRUD API (POST/GET/DELETE /alerts)
- Monitor engine: polling goroutines per wallet
- Rule evaluator with cooldown logic
- Expo push delivery with error handling
- Alert history endpoint

### Phase 5 — Polish
- HealthBar component with color transitions
- Alert history screen
- Notification deep-link → opens relevant position
- Multi-wallet support in dashboard
- Onboarding flow (explain read-only, no custody)

---

## Non-Goals (MVP)

- No trading or transaction signing
- No price charts or historical data
- No social features
- No web app
- No DEX position monitoring (Uniswap LP, etc.) — lending only for MVP
- No self-hosted push infrastructure — Expo Push handles delivery

---

## Success Criteria

- User adds a wallet with an Aave V3 position
- Health factor is displayed correctly (matches app.aave.com)
- Alert rule fires within 2 poll cycles of threshold breach
- Push notification received on device, tapping it opens the relevant position
