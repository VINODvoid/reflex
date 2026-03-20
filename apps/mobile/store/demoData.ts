import { AlertRule, Position, Wallet } from "./types";

export const DEMO_WALLETS: Wallet[] = [
  {
    id: "demo-wallet-evm",
    userId: "demo",
    address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    chainFamily: "evm",
    label: "ETH Main",
    createdAt: new Date().toISOString(),
  },
  {
    id: "demo-wallet-sol",
    userId: "demo",
    address: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    chainFamily: "solana",
    label: "Solana Main",
    createdAt: new Date().toISOString(),
  },
];

export const DEMO_POSITIONS: Position[] = [
  {
    // Near-danger: will trigger alert. Good for showing urgency.
    walletId: "demo-wallet-evm",
    protocol: "compound_v3",
    chainId: 8453,
    healthFactor: 1.21,
    collateralUsd: 8200,
    debtUsd: 5940,
    ltv: 0.724,
    liquidationThreshold: 0.825,
  },
  {
    // Warning zone: shows amber state
    walletId: "demo-wallet-evm",
    protocol: "aave_v3",
    chainId: 1,
    healthFactor: 1.78,
    collateralUsd: 24500,
    debtUsd: 12340,
    ltv: 0.504,
    liquidationThreshold: 0.80,
  },
  {
    // Healthy: shows green state
    walletId: "demo-wallet-sol",
    protocol: "marginfi",
    chainId: 0,
    healthFactor: 3.14,
    collateralUsd: 15200,
    debtUsd: 3180,
    ltv: 0.209,
    liquidationThreshold: 0.80,
  },
];

export const DEMO_ALERTS: AlertRule[] = [
  {
    id: "demo-alert-1",
    userId: "demo",
    walletId: "demo-wallet-evm",
    protocol: "compound_v3",
    alertType: "health_factor",
    threshold: 1.3,
    direction: "below",
    tokenAddress: null,
    chainId: 8453,
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "demo-alert-2",
    userId: "demo",
    walletId: "demo-wallet-evm",
    protocol: "aave_v3",
    alertType: "health_factor",
    threshold: 1.5,
    direction: "below",
    tokenAddress: null,
    chainId: 1,
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "demo-alert-3",
    userId: "demo",
    walletId: "demo-wallet-sol",
    protocol: "marginfi",
    alertType: "price_change",
    threshold: 0.2,
    direction: "change_pct",
    tokenAddress: "So11111111111111111111111111111111111111112",
    chainId: 0,
    active: true,
    createdAt: new Date().toISOString(),
  },
];
