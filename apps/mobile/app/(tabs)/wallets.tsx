import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { GradientBackground } from "../../components/GradientBackground";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useStore } from "../../store";
import { Wallet } from "../../store/types";
import {
  FontFamily,
  FontSize,
  Spacing,
  Radius,
} from "../../design-system/tokens";
import { useThemeColors, useIsDark } from "../../hooks/useThemeColors";
import { AppHeader, HeaderIconButton } from "../../components/AppHeader";

export default function WalletsScreen() {
  const colors = useThemeColors();
  const isDark = useIsDark();
  const wallets = useStore((state) => state.wallets);
  const removeWallet = useStore((state) => state.removeWallet);
  const isDemo = useStore((s) => s.isDemo);
  const enterDemo = useStore((s) => s.enterDemo);
  const exitDemo = useStore((s) => s.exitDemo);

  return (
    <GradientBackground edges={["top"]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <AppHeader
        right={
          <HeaderIconButton
            icon="plus"
            onPress={() => router.push("/wallet/connect")}
          />
        }
      />

      {wallets.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View
            style={[
              styles.emptyIconBox,
              {
                backgroundColor: colors.bgSecondary,
                borderColor: colors.borderSubtle,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="wallet-outline"
              size={40}
              color={colors.accent}
            />
          </View>

          <View style={styles.emptyText}>
            <Text
              style={[
                styles.emptyTitle,
                { color: colors.textPrimary, fontFamily: FontFamily.heading },
              ]}
            >
              No wallets yet
            </Text>
            <Text
              style={[
                styles.emptyBody,
                { color: colors.textSecondary, fontFamily: FontFamily.body },
              ]}
            >
              Connect a wallet address to monitor your DeFi positions in real
              time.
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.ctaBtn,
              { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={() => router.push("/wallet/connect")}
          >
            <MaterialCommunityIcons name="plus" size={18} color={colors.surfaceElevated} />
            <Text
              style={[styles.ctaBtnText, { color: colors.surfaceElevated, fontFamily: FontFamily.semibold }]}
            >
              Connect Wallet
            </Text>
          </Pressable>

          <Text
            style={[
              styles.hint,
              { color: colors.textTertiary, fontFamily: FontFamily.body },
            ]}
          >
            Read-only · Non-custodial · Multi-chain
          </Text>

          <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

          <Pressable
            style={({ pressed }) => [
              styles.demoBtn,
              { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={enterDemo}
          >
            <MaterialCommunityIcons name="play-box-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.demoBtnText, { color: colors.textSecondary, fontFamily: FontFamily.body }]}>
              Try Demo
            </Text>
          </Pressable>
          <Text style={[styles.demoHint, { color: colors.textTertiary, fontFamily: FontFamily.body }]}>
            Explore with simulated positions and alerts
          </Text>
        </View>
      ) : (
        <FlatList
          data={wallets}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <WalletCard
              wallet={item}
              index={index}
              onRemove={() => removeWallet(item.id)}
            />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        />
      )}
    </GradientBackground>
  );
}

function WalletCard({
  wallet,
  index,
  onRemove,
}: {
  wallet: Wallet;
  index: number;
  onRemove: () => void;
}) {
  const colors = useThemeColors();
  const chainLabel = wallet.chainFamily === "solana" ? "Solana" : "EVM";
  const chainIcon =
    wallet.chainFamily === "solana" ? "alpha-s-circle-outline" : "ethereum";

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.borderSubtle },
      ]}
    >
      {/* Left gold accent line */}
      <View style={[styles.cardAccent, { backgroundColor: colors.accent }]} />

      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={styles.chainRow}>
            <MaterialCommunityIcons
              name={chainIcon as any}
              size={13}
              color={colors.accent}
            />
            <Text
              style={[
                styles.chainText,
                { color: colors.accent, fontFamily: FontFamily.semibold },
              ]}
            >
              {chainLabel}
            </Text>
          </View>
          <Pressable
            onPress={onRemove}
            hitSlop={8}
            style={({ pressed }) => [
              styles.removeBtn,
              {
                backgroundColor: colors.dangerSoft,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="trash-can-outline"
              size={14}
              color={colors.danger}
            />
          </Pressable>
        </View>

        <Text
          style={[
            styles.walletName,
            { color: colors.textPrimary, fontFamily: FontFamily.semibold },
          ]}
        >
          {wallet.label || `Wallet ${index + 1}`}
        </Text>
        <Text
          style={[
            styles.walletAddress,
            { color: colors.textTertiary, fontFamily: FontFamily.mono },
          ]}
        >
          {wallet.address.slice(0, 14)}…{wallet.address.slice(-10)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingBottom: 80,
    gap: Spacing.md,
  },
  emptyIconBox: {
    width: 96,
    height: 96,
    borderRadius: Radius.large,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  emptyText: {
    alignItems: "center",
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: FontSize.h3,
    letterSpacing: -0.3,
    textAlign: "center",
  },
  emptyBody: {
    fontSize: FontSize.bodySmall,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 280,
    opacity: 0.75,
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    height: 52,
    borderRadius: Radius.pill,
    marginTop: Spacing.sm,
  },
  ctaBtnText: {
    fontSize: FontSize.body,
    letterSpacing: 0.3,
  },
  hint: {
    fontSize: FontSize.caption,
    letterSpacing: 0.3,
    opacity: 0.6,
  },
  divider: {
    width: "60%",
    height: 1,
    marginVertical: Spacing.sm,
  },
  demoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  demoBtnText: {
    fontSize: FontSize.bodySmall,
    letterSpacing: 0.2,
  },
  demoHint: {
    fontSize: FontSize.caption,
    letterSpacing: 0.2,
    opacity: 0.55,
    textAlign: "center",
  },

  // Wallet list
  list: {
    padding: Spacing.md,
    gap: Spacing.sm,
    paddingBottom: 108,
  },
  card: {
    flexDirection: "row",
    borderRadius: Radius.card,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  cardAccent: {
    width: 3,
  },
  cardContent: {
    flex: 1,
    padding: Spacing.md,
    gap: 6,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  chainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  chainText: {
    fontSize: FontSize.caption,
    letterSpacing: 0.3,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: Radius.sharp,
    justifyContent: "center",
    alignItems: "center",
  },
  walletName: {
    fontSize: FontSize.body,
  },
  walletAddress: {
    fontSize: FontSize.caption,
    letterSpacing: 0.3,
    opacity: 0.75,
  },
});
