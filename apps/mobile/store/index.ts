import { create } from "zustand";
import { AlertRule, Position, Wallet } from "./types";

interface StoreState {
  wallets: Wallet[];
  positions: Position[];
  alerts: AlertRule[];
  userId: string | null;
  setUserId: (id: string) => void;
  addWallet: (wallet: Wallet) => void;
  removeWallet: (id: string) => void;
  setPositions: (positions: Position[]) => void;
  addAlert: (alert: AlertRule) => void;
  removeAlert: (id: string) => void;
  setWallets: (wallets: Wallet[]) => void;
}

export const useStore = create<StoreState>((set) => ({
  wallets: [],
  positions: [],
  alerts: [],
  userId: null,
  setUserId: (id) => set({ userId: id }),
  addWallet: (wallet) =>
    set((state) => ({ wallets: [...state.wallets, wallet] })),
  removeWallet: (id) =>
    set((state) => ({ wallets: state.wallets.filter((w) => w.id !== id) })),
  setPositions: (positions) => set({ positions }),
  addAlert: (alert) => set((state) => ({ alerts: [...state.alerts, alert] })),
  removeAlert: (id) =>
    set((state) => ({ alerts: state.alerts.filter((a) => a.id !== id) })),
  setWallets: (wallets) => set({ wallets }),
}));
