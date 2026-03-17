import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { registerForPushNotifications } from "../services/notifications";
import { registerUser, getWallets } from "../services/api";
import { useStore } from "../store";

const USER_ID_KEY = "userId";

export default function RootLayout() {
  const setUserId = useStore((state) => state.setUserId);
  const setWallets = useStore((state) => state.setWallets);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(USER_ID_KEY);
        if (stored) {
          setUserId(stored);
          const wallets = await getWallets(stored);
          setWallets(wallets);
          return;
        }
        const token = await registerForPushNotifications();
        if (!token) return;
        const { id } = await registerUser(token);
        await AsyncStorage.setItem(USER_ID_KEY, id);
        setUserId(id);
      } catch (e) {
        console.error("registration failed:", e);
      }
    })();
  }, []);

  return <Stack screenOptions={{ headerShown: false }} />;
}
