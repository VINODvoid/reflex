import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, Stack } from "expo-router";
import { useEffect } from "react";
import { Appearance } from "react-native";
import { STORAGE_KEYS } from "../constants/storageKeys";
import { useStore, ThemePreference, RefreshInterval } from "../store";

export default function RootLayout() {
  const setTheme = useStore((state) => state.setTheme);
  const setSystemScheme = useStore((state) => state.setSystemScheme);
  const setNotifPush = useStore((state) => state.setNotifPush);
  const setNotifSound = useStore((state) => state.setNotifSound);
  const setNotifQuietHours = useStore((state) => state.setNotifQuietHours);
  const setRefreshInterval = useStore((state) => state.setRefreshInterval);

  useEffect(() => {
    // Seed the real system color scheme immediately
    const initial = Appearance.getColorScheme();
    setSystemScheme(initial === "dark" ? "dark" : "light");

    // Keep it in sync if the user changes their device theme while using the app
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme === "dark" ? "dark" : "light");
    });

    (async () => {
      const onboardingSeen = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_SEEN);
      if (!onboardingSeen) {
        router.replace("/onboarding");
      }

      // Restore persisted settings
      const savedTheme = await AsyncStorage.getItem(STORAGE_KEYS.THEME);
      if (savedTheme) setTheme(savedTheme as ThemePreference);

      const savedNotifPush = await AsyncStorage.getItem(STORAGE_KEYS.NOTIF_PUSH);
      if (savedNotifPush !== null) setNotifPush(savedNotifPush === "true");

      const savedNotifSound = await AsyncStorage.getItem(STORAGE_KEYS.NOTIF_SOUND);
      if (savedNotifSound !== null) setNotifSound(savedNotifSound === "true");

      const savedQuietHours = await AsyncStorage.getItem(STORAGE_KEYS.NOTIF_QUIET_HOURS);
      if (savedQuietHours !== null) setNotifQuietHours(savedQuietHours === "true");

      const savedInterval = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_INTERVAL);
      if (savedInterval) setRefreshInterval(Number(savedInterval) as RefreshInterval);
    })();

    return () => sub.remove();
  }, []);

  return <Stack screenOptions={{ headerShown: false }} />;
}
