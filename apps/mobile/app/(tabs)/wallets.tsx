import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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

export default function WalletsScreen() {
  const colors = useThemeColors();
  const isDark = useIsDark();
  const wallets = useStore((state) => state.wallets);
  const removeWallet = useStore((state) => state.removeWallet);

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: colors.bgPrimary }]}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>

        <View style={styles.header}>
          <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: FontFamily.heading }]}>
            Wallets
          </Text>
          <Pressable
            onPress={() => router.push("/wallet/connect")}
            style={[styles.addBtn, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}
          >
            <MaterialCommunityIcons name="plus" size={14} color={colors.accent} />
            <Text style={[styles.addBtnText, { color: colors.accent, fontFamily: FontFamily.semibold }]}>
              Add Wallet
            </Text>
          </Pressable>
        </View>

        {wallets.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="wallet-outline" size={40} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.textSecondary, fontFamily: FontFamily.semibold }]}>
              No wallets connected
            </Text>
            <Text style={[styles.emptyBody, { color: colors.textTertiary, fontFamily: FontFamily.body }]}>
              Add a wallet address to start monitoring your DeFi positions.
            </Text>
            <Pressable
              style={[styles.ctaBtn, { backgroundColor: colors.accent }]}
              onPress={() => router.push("/wallet/connect")}
            >
              <Text style={[styles.ctaBtnText, { fontFamily: FontFamily.semibold }]}>
                Connect Wallet
              </Text>
            </Pressable>
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
      </View>
    </SafeAreaView>
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
  const chainIcon = wallet.chainFamily === "solana" ? "alpha-s-circle-outline" : "ethereum";

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
      <View style={styles.cardTop}>
        <View style={[styles.chainBadge, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
          <MaterialCommunityIcons name={chainIcon} size={13} color={colors.textTertiary} />
          <Text style={[styles.chainText, { color: colors.textTertiary, fontFamily: FontFamily.semibold }]}>
            {chainLabel}
          </Text>
        </View>
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          style={[styles.removeBtn, { backgroundColor: colors.dangerSoft }]}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={15} color={colors.danger} />
        </Pressable>
      </View>

      <Text style={[styles.walletName, { color: colors.textPrimary, fontFamily: FontFamily.semibold }]}>
        {wallet.label || `Wallet ${index + 1}`}
      </Text>
      <Text style={[styles.walletAddress, { color: colors.textTertiary, fontFamily: FontFamily.mono }]}>
        {wallet.address.slice(0, 12)}…{wallet.address.slice(-8)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  heading: {
    fontSize: FontSize.h2,
    letterSpacing: -0.4,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.sharp,
    borderWidth: 1,
  },
  addBtnText: {
    fontSize: FontSize.bodySmall,
  },
  list: {
    gap: Spacing.sm,
    paddingBottom: 108,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 80,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: FontSize.h4,
    letterSpacing: -0.2,
    marginTop: Spacing.sm,
  },
  emptyBody: {
    fontSize: FontSize.bodySmall,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 260,
  },
  ctaBtn: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderRadius: Radius.card,
  },
  ctaBtnText: {
    color: "#FFFFFF",
    fontSize: FontSize.bodySmall,
  },
  card: {
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.xs,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  chainBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sharp,
    borderWidth: 1,
  },
  chainText: {
    fontSize: FontSize.caption,
    letterSpacing: 0.3,
  },
  removeBtn: {
    width: 30,
    height: 30,
    borderRadius: Radius.sharp,
    justifyContent: "center",
    alignItems: "center",
  },
  walletName: {
    fontSize: FontSize.body,
  },
  walletAddress: {
    fontSize: FontSize.caption,
    letterSpacing: 0.2,
  },
});
