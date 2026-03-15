# REFLEX — Claude Project Instructions

## What This Is

REFLEX is a mobile-first DeFi position monitoring app. It watches lending protocol positions (Aave, Compound, MarginFi, Solend) and fires push notifications before liquidation happens. Part of a DeFi mobile OS alongside NUCLEUS (wallet reader) and CORTEX (AI agent swarm).

---

## Stack

| Layer | Technology |
|-------|-----------|
| Mobile | Expo SDK 52 / React Native (TypeScript) |
| Navigation | Expo Router (file-based) |
| State | Zustand |
| EVM Wallet | Reown AppKit (WalletConnect v2) + manual address input |
| Solana Wallet | @solana-mobile/mobile-wallet-adapter-react-native + manual input |
| Push Notifications | Expo Push Notification Service (FCM + APNs) |
| Backend | Go 1.22+ |
| API | net/http + chi router |
| Database | PostgreSQL |
| EVM RPC | Alchemy (Ethereum, Base, Arbitrum, Polygon) |
| Solana RPC | Helius |
| Prices | CoinGecko free tier (MVP) |

---

## How to Run

### Backend
```bash
cd services/monitor
make dev          # starts server + postgres via docker-compose
make migrate      # runs SQL migrations
go test ./...     # run tests
```

### Mobile
```bash
cd apps/mobile
bunx expo start        # start dev server
bunx expo run:android
bunx expo run:ios
```

---

## What NOT to Do

- Never commit `.env` files or API keys — use environment variables
- Never hardcode RPC URLs or push tokens in source code
- Never use `any` type in TypeScript — always define proper interfaces
- Never skip error handling in Go — always return `error`, never panic in handlers
- Never store private keys — REFLEX is read-only, no custody
- Never add features beyond what's in the active phase in `.claude/context.md`

---

## Go Conventions

- Package layout: `internal/` for all app code, `cmd/` for entry points only
- Error wrapping: `fmt.Errorf("context: %w", err)` — always add context
- No global state — dependency inject everything via structs
- Use `context.Context` as first arg in all functions that do I/O
- Database: use `pgx/v5` directly — no ORM

## TypeScript Conventions

- File naming: `PascalCase` for components, `camelCase` for hooks/services
- Exports: named exports only, no default exports (except Expo Router screens)
- Styles: use `StyleSheet.create()` — no inline styles
- API calls: all in `services/api.ts` — never fetch directly from components

---

## Environment Variables

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
