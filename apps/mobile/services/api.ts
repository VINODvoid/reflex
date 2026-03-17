import { Position, Wallet } from "../store/types";

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
  return data.wallets;
}

export async function getPositions(walletId: string): Promise<Position[]> {
  const res = await fetch(
    `${process.env.EXPO_PUBLIC_API_URL}/positions/${walletId}`,
  );
  if (!res.ok) throw new Error("failed to fetch positions");
  const data = await res.json();
  return data.positions;
}
