import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useStore, ThemePreference, RefreshInterval } from "../../store";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import {
  FontFamily,
  FontSize,
  Spacing,
  Radius,
} from "../../design-system/tokens";
import { useThemeColors, useIsDark } from "../../hooks/useThemeColors";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

// Fixed preview palettes — always render the actual theme colors regardless of current theme
const PREVIEW = {
  light: {
    bg: "#FFFEF9",
    surface: "#FFFFFF",
    border: "#EDE9E0",
    headerLine: "#DDD8CC",
    text: "#1A1814",
    textMuted: "#C5BFB5",
    accent: "#A07218",
    tabBg: "#FFFEF9",
    tabBorder: "#EDE9E0",
  },
  dark: {
    bg: "#0B0A08",
    surface: "#191710",
    border: "#232018",
    headerLine: "#332E22",
    text: "#F0EDE4",
    textMuted: "#3A3528",
    accent: "#D4A843",
    tabBg: "#0B0A08",
    tabBorder: "#232018",
  },
};

const INTERVAL_OPTIONS: { value: RefreshInterval; label: string }[] = [
  { value: 5, label: "5 min" },
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hr" },
];

export default function Settings() {
  const colors = useThemeColors();
  const isDark = useIsDark();

  const userId = useStore((state) => state.userId);
  const theme = useStore((state) => state.theme);
  const notifPush = useStore((state) => state.notifPush);
  const notifSound = useStore((state) => state.notifSound);
  const notifQuietHours = useStore((state) => state.notifQuietHours);
  const refreshInterval = useStore((state) => state.refreshInterval);

  const setTheme = useStore((state) => state.setTheme);
  const setNotifPush = useStore((state) => state.setNotifPush);
  const setNotifSound = useStore((state) => state.setNotifSound);
  const setNotifQuietHours = useStore((state) => state.setNotifQuietHours);
  const setRefreshInterval = useStore((state) => state.setRefreshInterval);

  async function handleThemeChange(t: ThemePreference) {
    setTheme(t);
    await AsyncStorage.setItem(STORAGE_KEYS.THEME, t);
  }

  async function handleNotifPush(v: boolean) {
    setNotifPush(v);
    await AsyncStorage.setItem(STORAGE_KEYS.NOTIF_PUSH, String(v));
  }

  async function handleNotifSound(v: boolean) {
    setNotifSound(v);
    await AsyncStorage.setItem(STORAGE_KEYS.NOTIF_SOUND, String(v));
  }

  async function handleNotifQuietHours(v: boolean) {
    setNotifQuietHours(v);
    await AsyncStorage.setItem(STORAGE_KEYS.NOTIF_QUIET_HOURS, String(v));
  }

  async function handleRefreshInterval(v: RefreshInterval) {
    setRefreshInterval(v);
    await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_INTERVAL, String(v));
  }

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: colors.bgPrimary }]}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.container, { backgroundColor: colors.bgPrimary }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: FontFamily.heading }]}>
          Settings
        </Text>

        {/* ── Appearance ── */}
        <SectionLabel label="APPEARANCE" colors={colors} />
        <View style={styles.themeCardRow}>
          {THEME_OPTIONS.map((opt) => (
            <ThemePreviewCard
              key={opt.value}
              value={opt.value}
              label={opt.label}
              active={theme === opt.value}
              accentColor={colors.accent}
              borderSubtle={colors.borderSubtle}
              onPress={() => handleThemeChange(opt.value)}
            />
          ))}
        </View>

        {/* ── Notifications ── */}
        <SectionLabel label="NOTIFICATIONS" colors={colors} />
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
          <ToggleRow
            label="Push Alerts"
            sublabel="Receive alerts when health factor changes"
            value={notifPush}
            onToggle={handleNotifPush}
            colors={colors}
          />
          <Divider colors={colors} />
          <ToggleRow
            label="Sound"
            sublabel="Play sound with alert notifications"
            value={notifSound}
            onToggle={handleNotifSound}
            colors={colors}
            disabled={!notifPush}
          />
          <Divider colors={colors} />
          <ToggleRow
            label="Quiet Hours"
            sublabel="Suppress alerts between 11 PM – 7 AM"
            value={notifQuietHours}
            onToggle={handleNotifQuietHours}
            colors={colors}
            disabled={!notifPush}
          />
        </View>

        {/* ── Monitoring ── */}
        <SectionLabel label="MONITORING" colors={colors} />
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
          <View style={styles.intervalHeader}>
            <Text style={[styles.rowLabel, { color: colors.textSecondary, fontFamily: FontFamily.semibold }]}>
              Refresh Interval
            </Text>
            <Text style={[styles.rowMeta, { color: colors.textTertiary, fontFamily: FontFamily.body }]}>
              How often positions update
            </Text>
          </View>
          <View style={styles.intervalRow}>
            {INTERVAL_OPTIONS.map((opt) => {
              const active = refreshInterval === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={[
                    styles.intervalChip,
                    {
                      backgroundColor: active ? colors.accentSoft : colors.bgSecondary,
                      borderColor: active ? colors.accent : colors.border,
                    },
                  ]}
                  onPress={() => handleRefreshInterval(opt.value)}
                >
                  <Text
                    style={[
                      styles.intervalChipText,
                      {
                        color: active ? colors.accent : colors.textSecondary,
                        fontFamily: active ? FontFamily.semibold : FontFamily.body,
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── Alerts ── */}
        <SectionLabel label="ALERTS" colors={colors} />
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
          <Pressable style={styles.row} onPress={() => router.push("/alert-history")}>
            <View style={styles.rowLeft}>
              <Text style={[styles.rowLabel, { color: colors.textSecondary, fontFamily: FontFamily.semibold }]}>
                Alert History
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textTertiary} />
          </Pressable>
        </View>

        {/* ── Account ── */}
        <SectionLabel label="ACCOUNT" colors={colors} />
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textSecondary, fontFamily: FontFamily.semibold }]}>
              User ID
            </Text>
            <Text
              style={[styles.rowValue, { color: colors.textTertiary, fontFamily: FontFamily.mono }]}
              numberOfLines={1}
            >
              {userId ? `${userId.slice(0, 8)}…` : "—"}
            </Text>
          </View>
        </View>

        {/* ── App ── */}
        <SectionLabel label="APP" colors={colors} />
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textSecondary, fontFamily: FontFamily.semibold }]}>
              Version
            </Text>
            <Text style={[styles.rowValue, { color: colors.textTertiary, fontFamily: FontFamily.mono }]}>
              1.0.0
            </Text>
          </View>
          <Divider colors={colors} />
          <Pressable
            style={styles.row}
            onPress={() => Linking.openURL("https://github.com/VINODvoid/reflex/issues")}
          >
            <Text style={[styles.rowLabel, { color: colors.textSecondary, fontFamily: FontFamily.semibold }]}>
              Report a Bug
            </Text>
            <MaterialCommunityIcons name="open-in-new" size={16} color={colors.textTertiary} />
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textTertiary, fontFamily: FontFamily.body }]}>
            REFLEX — DeFi Position Monitor
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

// Renders one full mockup using a given palette
function MockupContent({ p }: { p: typeof PREVIEW.light }) {
  return (
    <View style={[previewStyles.mockup, { backgroundColor: p.bg }]}>
      <View style={[previewStyles.mockHeader, { backgroundColor: p.surface, borderBottomColor: p.border }]}>
        <View style={[previewStyles.mockHeaderTitle, { backgroundColor: p.text }]} />
        <View style={[previewStyles.mockHeaderDot, { backgroundColor: p.accent }]} />
      </View>
      <View style={previewStyles.mockBody}>
        <View style={[previewStyles.mockCard, { backgroundColor: p.surface, borderColor: p.border }]}>
          <View style={[previewStyles.mockLine, { width: "55%", backgroundColor: p.accent }]} />
          <View style={[previewStyles.mockLine, { width: "80%", backgroundColor: p.textMuted, marginTop: 4 }]} />
          <View style={[previewStyles.mockLine, { width: "65%", backgroundColor: p.textMuted, marginTop: 3 }]} />
        </View>
        <View style={[previewStyles.mockCard, { backgroundColor: p.surface, borderColor: p.border }]}>
          <View style={[previewStyles.mockLine, { width: "45%", backgroundColor: p.text }]} />
          <View style={[previewStyles.mockLine, { width: "70%", backgroundColor: p.textMuted, marginTop: 4 }]} />
        </View>
      </View>
      <View style={[previewStyles.mockTabBar, { backgroundColor: p.tabBg, borderTopColor: p.tabBorder }]}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[previewStyles.mockTabDot, { backgroundColor: i === 0 ? p.accent : p.textMuted }]} />
        ))}
      </View>
    </View>
  );
}

function ThemePreviewCard({
  value,
  label,
  active,
  accentColor,
  borderSubtle,
  onPress,
}: {
  value: ThemePreference;
  label: string;
  active: boolean;
  accentColor: string;
  borderSubtle: string;
  onPress: () => void;
}) {
  const isSystem = value === "system";
  const p = value === "dark" ? PREVIEW.dark : PREVIEW.light;

  return (
    <Pressable
      style={({ pressed }) => [previewStyles.card, { opacity: pressed ? 0.8 : 1 }]}
      onPress={onPress}
    >
      <View style={[
        previewStyles.cardInner,
        { borderColor: active ? accentColor : borderSubtle, borderWidth: active ? 2 : 1 },
      ]}>

        {isSystem ? (
          // Split: left half = light mockup, right half = dark mockup
          <View style={previewStyles.splitContainer}>
            {/* Left half — light */}
            <View style={previewStyles.splitHalf}>
              <View style={previewStyles.splitInnerLeft}>
                <MockupContent p={PREVIEW.light} />
              </View>
            </View>

            {/* Divider */}
            <View style={previewStyles.splitDivider} />

            {/* Right half — dark */}
            <View style={previewStyles.splitHalf}>
              <View style={previewStyles.splitInnerRight}>
                <MockupContent p={PREVIEW.dark} />
              </View>
            </View>
          </View>
        ) : (
          <MockupContent p={p} />
        )}

        {active && (
          <View style={[previewStyles.checkBadge, { backgroundColor: accentColor }]}>
            <MaterialCommunityIcons name="check" size={11} color="#FFFFFF" />
          </View>
        )}
      </View>

      <Text style={[
        previewStyles.cardLabel,
        { color: active ? accentColor : "#9C9080", fontFamily: active ? FontFamily.semibold : FontFamily.body },
      ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const previewStyles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  cardInner: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  mockup: {
    width: "100%",
    height: 148,
    flexDirection: "column",
  },
  // System split
  splitContainer: {
    flexDirection: "row",
    height: 148,
  },
  splitHalf: {
    flex: 1,
    overflow: "hidden",
  },
  // Each half renders the full mockup at 2× width, then shifts left/right to show only its half
  splitInnerLeft: {
    width: "200%",
  },
  splitInnerRight: {
    width: "200%",
    marginLeft: "-100%",
  },
  splitDivider: {
    width: 1,
    backgroundColor: "rgba(128,100,40,0.3)",
    zIndex: 2,
  },
  mockHeader: {
    height: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  mockHeaderTitle: {
    height: 7,
    width: 40,
    borderRadius: 3,
    opacity: 0.9,
  },
  mockHeaderDot: {
    height: 7,
    width: 14,
    borderRadius: 3,
  },
  mockBody: {
    flex: 1,
    paddingHorizontal: 6,
    paddingTop: 6,
    gap: 5,
  },
  mockCard: {
    borderRadius: 6,
    borderWidth: 1,
    padding: 6,
  },
  mockLine: {
    height: 5,
    borderRadius: 2.5,
  },
  mockTabBar: {
    height: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 10,
    borderTopWidth: 1,
  },
  mockTabDot: {
    width: 14,
    height: 14,
    borderRadius: 3,
    opacity: 0.85,
  },
  checkBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  cardLabel: {
    fontSize: FontSize.label,
    letterSpacing: 0.2,
  },
});

function SectionLabel({ label, colors }: { label: string; colors: ReturnType<typeof import("../../design-system/tokens").useColors> }) {
  return (
    <Text style={[styles.sectionLabel, { color: colors.textTertiary, fontFamily: FontFamily.semibold }]}>
      {label}
    </Text>
  );
}

function Divider({ colors }: { colors: ReturnType<typeof import("../../design-system/tokens").useColors> }) {
  return <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />;
}

function ToggleRow({
  label,
  sublabel,
  value,
  onToggle,
  colors,
  disabled = false,
}: {
  label: string;
  sublabel: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  colors: ReturnType<typeof import("../../design-system/tokens").useColors>;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.row, disabled && styles.disabledRow]}>
      <View style={styles.rowLeft}>
        <Text style={[styles.rowLabel, { color: disabled ? colors.textTertiary : colors.textSecondary, fontFamily: FontFamily.semibold }]}>
          {label}
        </Text>
        <Text style={[styles.rowMeta, { color: colors.textTertiary, fontFamily: FontFamily.body }]}>
          {sublabel}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  container: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 108,
  },
  heading: {
    fontSize: FontSize.h2,
    letterSpacing: -0.4,
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    fontSize: FontSize.label,
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  section: {
    borderRadius: Radius.card,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    overflow: "hidden",
  },
  divider: {
    height: 1,
    marginHorizontal: -Spacing.md,
  },
  // Appearance — preview cards
  themeCardRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 4,
  },
  // Notifications / rows
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  disabledRow: {
    opacity: 0.45,
  },
  rowLeft: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: FontSize.bodySmall,
  },
  rowMeta: {
    fontSize: FontSize.caption,
    lineHeight: 16,
  },
  rowValue: {
    fontSize: FontSize.bodySmall,
    flexShrink: 1,
  },
  // Monitoring
  intervalHeader: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: 2,
  },
  intervalRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  intervalChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: Radius.sharp,
    borderWidth: 1,
    alignItems: "center",
  },
  intervalChipText: {
    fontSize: FontSize.label,
  },
  // Footer
  footer: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    alignItems: "center",
  },
  footerText: {
    fontSize: FontSize.caption,
    letterSpacing: 0.5,
  },
});
