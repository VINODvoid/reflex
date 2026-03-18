import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Tabs, router } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { registerForPushNotifications } from "../../services/notifications";
import { registerUser, getWallets } from "../../services/api";
import { useStore } from "../../store";
import { FontFamily, FontSize, Radius } from "../../design-system/tokens";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { useThemeColors, useIsDark } from "../../hooks/useThemeColors";

// ── Tab config ───────────────────────────────────────────────────────────────

const TAB_ROUTES = [
  { name: "index",    label: "Positions", icon: "view-dashboard",  iconOut: "view-dashboard-outline" },
  { name: "wallets",  label: "Wallets",   icon: "wallet",          iconOut: "wallet-outline" },
  { name: "alerts",   label: "Alerts",    icon: "bell",            iconOut: "bell-outline" },
  { name: "settings", label: "Settings",  icon: "cog",             iconOut: "cog-outline" },
] as const;

// ── Custom floating tab bar ──────────────────────────────────────────────────

function PremiumTabBar({ state, navigation }: BottomTabBarProps) {
  const colors = useThemeColors();
  const isDark = useIsDark();
  const [barWidth, setBarWidth] = useState(0);
  const tabWidth = barWidth > 0 ? barWidth / state.routes.length : 0;

  const slideAnim = useRef(new Animated.Value(0)).current;
  const scaleAnims = useRef(state.routes.map(() => new Animated.Value(1))).current;

  useEffect(() => {
    if (tabWidth === 0) return;
    Animated.spring(slideAnim, {
      toValue: state.index * tabWidth,
      useNativeDriver: true,
      tension: 180,
      friction: 14,
    }).start();
  }, [state.index, tabWidth]);

  function handlePress(index: number, routeName: string) {
    // Bounce the pressed icon
    Animated.sequence([
      Animated.timing(scaleAnims[index], { toValue: 0.82, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnims[index], { toValue: 1, tension: 200, friction: 10, useNativeDriver: true }),
    ]).start();

    const event = navigation.emit({ type: "tabPress", target: routeName, canPreventDefault: true });
    if (!event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  }

  return (
    <View style={styles.outerWrap} pointerEvents="box-none">
      <View
        style={[
          styles.bar,
          {
            backgroundColor: colors.surface,
            borderColor: colors.borderSubtle,
            shadowColor: isDark ? "#000" : "#8B6914",
          },
        ]}
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      >
        {/* Sliding active pill */}
        {tabWidth > 0 && (
          <Animated.View
            style={[
              styles.activePill,
              {
                width: tabWidth - 8,
                backgroundColor: colors.accentSoft,
                borderColor: colors.accent,
                transform: [{ translateX: Animated.add(slideAnim, new Animated.Value(4)) }],
              },
            ]}
          />
        )}

        {/* Tab items */}
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
            >
              <Animated.View style={[styles.tabInner, { transform: [{ scale: scaleAnims[index] }] }]}>
                <MaterialCommunityIcons
                  name={(focused ? tab.icon : tab.iconOut) as any}
                  size={22}
                  color={focused ? colors.accent : colors.textTertiary}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color: focused ? colors.accent : colors.textTertiary,
                      fontFamily: focused ? FontFamily.semibold : FontFamily.body,
                      opacity: focused ? 1 : 0.7,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              </Animated.View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrap: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
  },
  bar: {
    flexDirection: "row",
    borderRadius: 22,
    borderWidth: 1,
    height: 68,
    paddingVertical: 0,
    alignItems: "center",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 16,
    position: "relative",
    overflow: "hidden",
  },
  activePill: {
    position: "absolute",
    top: 4,
    bottom: 4,
    borderRadius: 16,
    borderWidth: 1,
  },
  tabItem: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  tabInner: {
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: 0.2,
  },
});

// ── Layout ───────────────────────────────────────────────────────────────────

export default function TabLayout() {
  const setUserId = useStore((state) => state.setUserId);
  const setWallets = useStore((state) => state.setWallets);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEYS.USER_ID);
        if (stored) {
          setUserId(stored);
          const wallets = await getWallets(stored);
          setWallets(wallets);
          return;
        }
        const token = await registerForPushNotifications();
        const fallback = `no-push-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const { id } = await registerUser(token ?? fallback);
        await AsyncStorage.setItem(STORAGE_KEYS.USER_ID, id);
        setUserId(id);
      } catch (e) {
        console.error("registration failed:", e);
      }
    })();
  }, []);

  return (
    <Tabs
      tabBar={(props) => <PremiumTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="wallets" />
      <Tabs.Screen name="alerts" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
