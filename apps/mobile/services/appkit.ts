import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createAppKit,
  AppKitProvider,
  AppKit,
} from "@reown/appkit-react-native";
import { EthersAdapter } from "@reown/appkit-ethers-react-native";
import type { AppKitNetwork, Storage } from "@reown/appkit-react-native";

export { AppKitProvider, AppKit };
export let appKitInstance: ReturnType<typeof createAppKit>;

// ── Networks ──────────────────────────────────────────────────────────────────

const ethereum: AppKitNetwork = {
  id: 1,
  name: "Ethereum",
  chainNamespace: "eip155",
  caipNetworkId: "eip155:1",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://cloudflare-eth.com"] } },
  blockExplorers: { default: { name: "Etherscan", url: "https://etherscan.io" } },
};

const arbitrum: AppKitNetwork = {
  id: 42161,
  name: "Arbitrum One",
  chainNamespace: "eip155",
  caipNetworkId: "eip155:42161",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://arb1.arbitrum.io/rpc"] } },
  blockExplorers: { default: { name: "Arbiscan", url: "https://arbiscan.io" } },
};

const base: AppKitNetwork = {
  id: 8453,
  name: "Base",
  chainNamespace: "eip155",
  caipNetworkId: "eip155:8453",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://mainnet.base.org"] } },
  blockExplorers: { default: { name: "Basescan", url: "https://basescan.org" } },
};

// ── AsyncStorage adapter ───────────────────────────────────────────────────────

const asyncStorageAdapter: Storage = {
  async getKeys(): Promise<string[]> {
    const keys = await AsyncStorage.getAllKeys();
    return [...keys];
  },
  async getEntries<T>(): Promise<[string, T][]> {
    const keys = await AsyncStorage.getAllKeys();
    const pairs = await AsyncStorage.multiGet([...keys]);
    return pairs
      .filter((pair): pair is [string, string] => pair[1] !== null)
      .map(([k, v]) => [k, JSON.parse(v) as T]);
  },
  async getItem<T>(key: string): Promise<T | undefined> {
    const value = await AsyncStorage.getItem(key);
    if (value === null) return undefined;
    return JSON.parse(value) as T;
  },
  async setItem<T>(key: string, value: T): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },
  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },
};

// ── Init ──────────────────────────────────────────────────────────────────────

const projectId = process.env.EXPO_PUBLIC_REOWN_PROJECT_ID ?? "";

appKitInstance = createAppKit({
  projectId,
  metadata: {
    name: "Reflex",
    description: "DeFi position monitoring — read-only",
    url: "https://github.com/VINODvoid/reflex",
    icons: [],
    redirect: { native: "reflex://" },
  },
  adapters: [new EthersAdapter()],
  networks: [ethereum, arbitrum, base],
  storage: asyncStorageAdapter,
  enableAnalytics: false,
  features: {
    onramp: false,
    swaps: false,
    showWallets: true,
  },
});
