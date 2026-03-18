import { StyleSheet, Text, View, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useStore } from "../../store";
import {
  useColors,
  FontFamily,
  FontSize,
  Spacing,
  Radius,
} from "../../design-system/tokens";

export default function Settings() {
  const colors = useColors();
  const isDark = useColorScheme() === "dark";
  const wallets = useStore((state) => state.wallets);
  const userId = useStore((state) => state.userId);

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: colors.bgPrimary }]}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>

        <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: FontFamily.heading }]}>
          Settings
        </Text>

        {/* Wallets section */}
        <Text style={[styles.sectionLabel, { color: colors.textTertiary, fontFamily: FontFamily.semibold }]}>
          WALLETS
        </Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
          {wallets.length === 0 ? (
            <Text style={[styles.rowValue, { color: colors.textTertiary, fontFamily: FontFamily.body }]}>
              No wallets added
            </Text>
          ) : (
            wallets.map((w, i) => (
              <View key={w.id}>
                {i > 0 && <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />}
                <View style={styles.row}>
                  <View style={styles.rowLeft}>
                    <Text style={[styles.rowLabel, { color: colors.textSecondary, fontFamily: FontFamily.semibold }]}>
                      {w.label || "Wallet"}
                    </Text>
                    <Text style={[styles.rowMeta, { color: colors.textTertiary, fontFamily: FontFamily.mono }]} numberOfLines={1}>
                      {w.address.slice(0, 8)}…{w.address.slice(-6)}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Account section */}
        <Text style={[styles.sectionLabel, { color: colors.textTertiary, fontFamily: FontFamily.semibold }]}>
          ACCOUNT
        </Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textSecondary, fontFamily: FontFamily.semibold }]}>
              User ID
            </Text>
            <Text style={[styles.rowValue, { color: colors.textTertiary, fontFamily: FontFamily.mono }]} numberOfLines={1}>
              {userId ? `${userId.slice(0, 8)}…` : "—"}
            </Text>
          </View>
        </View>

        {/* App section */}
        <Text style={[styles.sectionLabel, { color: colors.textTertiary, fontFamily: FontFamily.semibold }]}>
          APP
        </Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textSecondary, fontFamily: FontFamily.semibold }]}>
              Version
            </Text>
            <Text style={[styles.rowValue, { color: colors.textTertiary, fontFamily: FontFamily.mono }]}>
              1.0.0
            </Text>
          </View>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
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
  },
  divider: {
    height: 1,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.md,
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
  },
  rowValue: {
    fontSize: FontSize.bodySmall,
    flexShrink: 1,
  },
});
