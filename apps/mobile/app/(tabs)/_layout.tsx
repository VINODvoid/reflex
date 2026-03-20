import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Tabs } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { registerForPushNotifications } from "../../services/notifications";
import { registerUser, updatePushToken, getWallets } from "../../services/api";
import { useStore } from "../../store";
import { FontFamily } from "../../design-system/tokens";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useNotificationDeepLink } from "../../hooks/useNotificationDeepLink";

// ── Tab config ────────────────────────────────────────────────────────────────

const TAB_ROUTES = [
  { name: "wallets",  label: "Wallets",   icon: "wallet",         iconOut: "wallet-outline" },
  { name: "index",    label: "Positions", icon: "view-dashboard", iconOut: "view-dashboard-outline" },
  { name: "alerts",   label: "Alerts",    icon: "bell",           iconOut: "bell-outline" },
  { name: "settings", label: "Settings",  icon: "tune-variant",   iconOut: "tune-variant" },
] as const;

// ── Tab bar ───────────────────────────────────────────────────────────────────

function LuxuryTabBar({ state, navigation }: BottomTabBarProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const scaleAnims = useRef(state.routes.map(() => new Animated.Value(1))).current;

  function handlePress(index: number, routeName: string) {
    Animated.sequence([
      Animated.timing(scaleAnims[index], { toValue: 0.82, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnims[index], { toValue: 1, tension: 300, friction: 12, useNativeDriver: true }),
    ]).start();

    const event = navigation.emit({ type: "tabPress", target: routeName, canPreventDefault: true });
    if (!event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  }

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.bgSecondary,
          borderTopColor: colors.borderSubtle,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const tab = TAB_ROUTES.find((t) => t.name === route.name);
        if (!tab) return null;

        return (
          <Pressable
            key={route.key}
            style={styles.tabItem}
            onPress={() => handlePress(index, route.name)}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: focused }}
          >
            {/* Active indicator — thin gold line at top of tab */}
            <View style={[styles.indicator, focused && { backgroundColor: colors.accent }]} />

            <Animated.View style={{ transform: [{ scale: scaleAnims[index] }] }}>
              <MaterialCommunityIcons
                name={(focused ? tab.icon : tab.iconOut) as any}
                size={22}
                color={focused ? colors.accent : colors.textTertiary}
              />
            </Animated.View>
            <Text
              style={[
                styles.tabLabel,
                {
                  color: focused ? colors.accent : colors.textTertiary,
                  fontFamily: focused ? FontFamily.semibold : FontFamily.body,
                  opacity: focused ? 1 : 0.45,
                },
              ]}
              numberOfLines={1}
            >
              {tab.label.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingBottom: 4,
    gap: 3,
  },
  indicator: {
    width: 20,
    height: 2,
    borderRadius: 1,
    marginBottom: 8,
    backgroundColor: "transparent",
  },
  tabLabel: {
    fontSize: 9,
    letterSpacing: 0.7,
  },
});

// ── Layout ────────────────────────────────────────────────────────────────────

export default function TabLayout() {
  const setUserId = useStore((state) => state.setUserId);
  const setWallets = useStore((state) => state.setWallets);

  useNotificationDeepLink();

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEYS.USER_ID);
        const token = await registerForPushNotifications();

        if (stored) {
          setUserId(stored);
          const wallets = await getWallets(stored);
          setWallets(wallets);
          // Refresh push token in case it changed or was previously a fake/missing token
          if (token) {
            await updatePushToken(stored, token).catch(() => {});
          }
          return;
        }

        // First boot — register. Only proceed if we have a real push token.
        if (!token) {
          console.warn("Push notifications permission denied — alerts will not fire.");
        }
        const { id } = await registerUser(token ?? "");
        await AsyncStorage.setItem(STORAGE_KEYS.USER_ID, id);
        setUserId(id);
      } catch (e) {
        console.error("registration failed:", e);
      }
    })();
  }, []);

  return (
    <Tabs
      tabBar={(props) => <LuxuryTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="wallets" />
      <Tabs.Screen name="index" />
      <Tabs.Screen name="alerts" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
