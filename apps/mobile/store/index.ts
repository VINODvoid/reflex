import { create } from "zustand";
import { AlertRule, Position, Wallet } from "./types";

interface StoreState {
  wallets: Wallet[];
  positions: Position[];
  alerts: AlertRule[];
  addWallet: (wallet: Wallet) => void;
  removeWallet: (id: string) => void;
  setPositions: (positions: Position[]) => void;
  addAlert: (alert: AlertRule) => void;
  removeAlert: (id: string) => void;
}

export const useStore = create<StoreState>((set) => ({
  wallets: [],
  positions: [],
  alerts: [],
  addWallet: (wallet) =>
    set((state) => ({ wallets: [...state.wallets, wallet] })),
  removeWallet: (id) =>
    set((state) => ({ wallets: state.wallets.filter((w) => w.id !== id) })),
  setPositions: (positions) => set({ positions }),
  addAlert: (alert) => set((state) => ({ alerts: [...state.alerts, alert] })),
  removeAlert: (id) =>
    set((state) => ({ alerts: state.alerts.filter((a) => a.id !== id) })),
}));
