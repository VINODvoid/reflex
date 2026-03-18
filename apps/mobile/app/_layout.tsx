import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, Stack } from "expo-router";
import { useEffect } from "react";
import { registerForPushNotifications } from "../services/notifications";
import { registerUser, getWallets } from "../services/api";
import { useStore } from "../store";
import { STORAGE_KEYS } from "../constants/storageKeys";

export default function RootLayout() {
  const setUserId = useStore((state) => state.setUserId);
  const setWallets = useStore((state) => state.setWallets);

  useEffect(() => {
    (async () => {
      try {
        const onboardingSeen = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_SEEN);
        if (!onboardingSeen) {
          router.replace("/onboarding");
          return;
        }

        const stored = await AsyncStorage.getItem(STORAGE_KEYS.USER_ID);
        if (stored) {
          setUserId(stored);
          const wallets = await getWallets(stored);
          setWallets(wallets);
          return;
        }
        const token = await registerForPushNotifications();
        if (!token) return;
        const { id } = await registerUser(token);
        await AsyncStorage.setItem(STORAGE_KEYS.USER_ID, id);
        setUserId(id);
      } catch (e) {
        console.error("registration failed:", e);
      }
    })();
  }, []);

  return <Stack screenOptions={{ headerShown: false }} />;
}
