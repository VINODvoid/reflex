export interface Wallet {
  id: string;
  userId: string;
  address: string;
  chainFamily: "evm" | "solana";
  label: string;
  createdAt: string;
}

export interface Position {
  walletId: string;
  protocol: "aave_v3" | "compound_v3" | "marginfi" | "solend";
  chainId: number;
  healthFactor: number;
  collateralUsd: number;
  debtUsd: number;
}

export interface AlertEvent {
  id: string;
  ruleId: string;
  userId: string;
  message: string;
  valueAtTrigger: number;
  sentAt: string;
}

export interface AlertRule {
  id: string;
  userId: string;
  walletId: string;
  protocol: "aave_v3" | "compound_v3" | "marginfi" | "solend";
  chainId: number | null;
  alertType: "health_factor" | "price_change";
  threshold: number;
  direction: "below" | "above" | "change_pct";
  tokenAddress: string | null;
  active: boolean;
  createdAt: string;
}
