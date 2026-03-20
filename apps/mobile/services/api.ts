import { AlertEvent, AlertRule, Position, Wallet } from "../store/types";

interface HealthInterface {
  status: string;
}

export async function getHealth(): Promise<HealthInterface> {
  const data = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/health`);
  const response = await data.json();
  return response;
}

export async function registerUser(
  expoPushToken: string,
): Promise<{ id: string }> {
  const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expoPushToken }),
  });
  if (!res.ok) throw new Error("failed to register user");
  return res.json();
}

export async function updatePushToken(
  userId: string,
  expoPushToken: string,
): Promise<void> {
  const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/users/${userId}/token`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expoPushToken }),
  });
  if (!res.ok) throw new Error("failed to update push token");
}

export async function createWallet(
  userId: string,
  address: string,
  chainFamily: "evm" | "solana",
  label?: string,
): Promise<Wallet> {
  const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/wallets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, address, chainFamily, label }),
  });
  if (!res.ok) throw new Error("failed to create wallet");
  return res.json();
}

export async function getWallets(userId: string): Promise<Wallet[]> {
  const res = await fetch(
    `${process.env.EXPO_PUBLIC_API_URL}/wallets/${userId}`,
  );
  if (!res.ok) throw new Error("failed to fetch wallets");
  const data = await res.json();
  return data.wallets ?? [];
}

export async function getPositions(walletId: string): Promise<Position[]> {
  const res = await fetch(
    `${process.env.EXPO_PUBLIC_API_URL}/positions/${walletId}`,
  );
  if (!res.ok) throw new Error("failed to fetch positions");
  const data = await res.json();
  return data.positions ?? [];
}

export async function createAlert(
  userId: string,
  walletId: string,
  protocol: AlertRule["protocol"],
  alertType: AlertRule["alertType"],
  threshold: number,
  direction: AlertRule["direction"],
  chainId?: number | null,
  tokenAddress?: string | null,
): Promise<AlertRule> {
  const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/alerts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      walletId,
      protocol,
      alertType,
      threshold,
      direction,
      chainId: chainId ?? null,
      tokenAddress: tokenAddress ?? null,
    }),
  });
  if (!res.ok) throw new Error("failed to create alert");
  return res.json();
}

export async function getAlerts(userId: string): Promise<AlertRule[]> {
  const res = await fetch(
    `${process.env.EXPO_PUBLIC_API_URL}/alerts/${userId}`,
  );
  if (!res.ok) throw new Error("failed to fetch alerts");
  const data = await res.json();
  return data.alerts ?? [];
}

export async function deleteAlert(alertId: string, userId: string): Promise<void> {
  const res = await fetch(
    `${process.env.EXPO_PUBLIC_API_URL}/alerts/${alertId}?userId=${encodeURIComponent(userId)}`,
    { method: "DELETE" },
  );
  if (!res.ok) throw new Error("failed to delete alert");
}

export async function getAlertHistory(userId: string): Promise<AlertEvent[]> {
  const res = await fetch(
    `${process.env.EXPO_PUBLIC_API_URL}/alerts/${userId}/history`,
  );
  if (!res.ok) throw new Error("failed to fetch alert history");
  const data = await res.json();
  return data.events ?? [];
}
