# REFLEX

> Mobile-first DeFi position monitor. Get push alerts before liquidation happens.

REFLEX watches your lending positions on Aave, Compound, MarginFi, and Solend — and fires push notifications to your phone before your health factor hits the liquidation threshold.

No custody. No private keys. Read-only.

---

## The Problem

You open a leveraged position on Aave. ETH drops 15% overnight. You wake up liquidated.

Existing tools are either desktop dashboards (passive), Telegram bots (fragile), or protocol emails (too slow). REFLEX is a native mobile app that watches your positions in real-time and alerts you before it's too late.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Mobile | Expo SDK 55 / React Native (TypeScript) |
| Navigation | Expo Router |
| State | Zustand |
| Backend | Go 1.22+ / chi router |
| Database | PostgreSQL (pgx/v5) |
| EVM RPC | Alchemy |
| Solana RPC | Helius |
| Push | Expo Push Notification Service |

---

## Supported Protocols

| Protocol | Chain |
|----------|-------|
| Aave V3 | Ethereum, Base, Arbitrum, Polygon, Optimism |
| Compound V3 | Ethereum, Base |
| MarginFi | Solana |
| Solend | Solana |

---

## Project Structure

```
reflex/
├── apps/
│   └── mobile/          # Expo app
└── services/
    └── monitor/         # Go backend
```

---

## Getting Started

### Prerequisites

- Go 1.22+
- Bun
- Docker

### Backend

```bash
# Start postgres
docker compose up -d

# Run migrations
cd services/monitor
make migrate

# Start server
make dev
```

Server runs on `http://localhost:8080`.

### Mobile

```bash
cd apps/mobile
bun install
bunx expo run:android
# or
bunx expo run:ios
```

### Environment Variables

**Backend** — `services/monitor/.env`
```
DATABASE_URL=postgres://reflex:reflex_dev@localhost:5432/reflex?sslmode=disable
ALCHEMY_API_KEY=
HELIUS_API_KEY=
COINGECKO_API_KEY=
PORT=8080
```

**Mobile** — `apps/mobile/.env`
```
EXPO_PUBLIC_API_URL=http://localhost:8080
```

---

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health check |
| POST | `/users` | Register push token |
| POST | `/wallets` | Add wallet to monitoring |
| GET | `/wallets/:userId` | List wallets for user |
| GET | `/positions/:walletId` | Fetch current positions |
| POST | `/alerts` | Create alert rule |
| GET | `/alerts/:userId` | List alert rules |
| GET | `/alerts/:userId/history` | Alert event history |
| DELETE | `/alerts/:alertId?userId=` | Delete alert rule |

---

## Roadmap

- [x] Phase 1 — Foundation: server, DB, Expo shell
- [x] Phase 2 — Wallet Input: add wallets via paste or WalletConnect
- [x] Phase 3 — Position Data: Aave, Compound, MarginFi, Solend
- [x] Phase 4 — Alert Engine: polling, rule evaluation, push delivery
- [ ] Phase 5 — Polish: deep links, onboarding, multi-wallet dashboard

---

## Part of the DeFi Mobile OS

| App | Role |
|-----|------|
| NUCLEUS | Wallet reader — portfolio balances, token prices |
| **REFLEX** | Risk monitor — lending positions, liquidation alerts |
| CORTEX | AI agent swarm — autonomous DeFi execution |

---

## License

MIT — see [LICENSE](LICENSE)
