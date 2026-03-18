import { create } from "zustand";
import { AlertRule, Position, Wallet } from "./types";

export type ThemePreference = "system" | "light" | "dark";
export type RefreshInterval = 5 | 15 | 30 | 60;

interface StoreState {
  wallets: Wallet[];
  positions: Position[];
  alerts: AlertRule[];
  userId: string | null;

  // Settings
  theme: ThemePreference;
  systemScheme: "light" | "dark"; // real device scheme, tracked independently
  notifPush: boolean;
  notifSound: boolean;
  notifQuietHours: boolean;
  refreshInterval: RefreshInterval;

  setUserId: (id: string) => void;
  addWallet: (wallet: Wallet) => void;
  removeWallet: (id: string) => void;
  setPositions: (positions: Position[]) => void;
  setAlerts: (alerts: AlertRule[]) => void;
  addAlert: (alert: AlertRule) => void;
  removeAlert: (id: string) => void;
  setWallets: (wallets: Wallet[]) => void;

  setTheme: (theme: ThemePreference) => void;
  setSystemScheme: (scheme: "light" | "dark") => void;
  setNotifPush: (v: boolean) => void;
  setNotifSound: (v: boolean) => void;
  setNotifQuietHours: (v: boolean) => void;
  setRefreshInterval: (v: RefreshInterval) => void;
}

export const useStore = create<StoreState>((set) => ({
  wallets: [],
  positions: [],
  alerts: [],
  userId: null,

  theme: "system",
  systemScheme: "light",
  notifPush: true,
  notifSound: true,
  notifQuietHours: false,
  refreshInterval: 15,

  setUserId: (id) => set({ userId: id }),
  addWallet: (wallet) =>
    set((state) => ({ wallets: [...state.wallets, wallet] })),
  removeWallet: (id) =>
    set((state) => ({ wallets: state.wallets.filter((w) => w.id !== id) })),
  setPositions: (positions) => set({ positions }),
  setAlerts: (alerts) => set({ alerts }),
  addAlert: (alert) => set((state) => ({ alerts: [...state.alerts, alert] })),
  removeAlert: (id) =>
    set((state) => ({ alerts: state.alerts.filter((a) => a.id !== id) })),
  setWallets: (wallets) => set({ wallets }),

  setTheme: (theme) => set({ theme }),
  setSystemScheme: (systemScheme) => set({ systemScheme }),
  setNotifPush: (notifPush) => set({ notifPush }),
  setNotifSound: (notifSound) => set({ notifSound }),
  setNotifQuietHours: (notifQuietHours) => set({ notifQuietHours }),
  setRefreshInterval: (refreshInterval) => set({ refreshInterval }),
}));
