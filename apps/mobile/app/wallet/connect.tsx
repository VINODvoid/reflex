import { useState, useRef, useEffect } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppKit, useAccount } from "@reown/appkit-react-native";
import { useStore } from "../../store";
import { createWallet } from "../../services/api";
import {
  FontFamily,
  FontSize,
  Spacing,
  Radius,
} from "../../design-system/tokens";
import { useThemeColors, useIsDark } from "../../hooks/useThemeColors";

export default function ConnectWallet() {
  const colors = useThemeColors();
  const isDark = useIsDark();

  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [chainFamily, setChainFamily] = useState<"evm" | "solana">("evm");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const btnScale = useRef(new Animated.Value(1)).current;

  const userId = useStore((state) => state.userId);
  const addWallet = useStore((state) => state.addWallet);

  const { open, disconnect } = useAppKit();
  const { address: wcAddress, isConnected } = useAccount();

  // When WalletConnect returns an address, auto-save and dismiss
  useEffect(() => {
    if (!isConnected || !wcAddress || !userId) return;

    setLoading(true);
    setError(null);
    createWallet(userId, wcAddress, "evm", label.trim() || undefined)
      .then((created) => {
        addWallet(created);
        disconnect("eip155");
        router.back();
      })
      .catch(() => {
        setError("Failed to add wallet. Try again.");
        disconnect("eip155");
      })
      .finally(() => setLoading(false));
  }, [isConnected, wcAddress]);

  function onPressIn() {
    Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  }
  function onPressOut() {
    Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  }

  async function handleAdd() {
    if (!userId) {
      setError("Registration not complete. Please restart the app.");
      return;
    }
    const trimmed = address.trim();
    if (!trimmed) {
      setError("Enter a wallet address.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const created = await createWallet(userId, trimmed, chainFamily, label.trim() || undefined);
      addWallet(created);
      router.back();
    } catch {
      setError("Failed to add wallet. Check the address and try again.");
    } finally {
      setLoading(false);
    }
  }

  const CHAINS: { id: "evm" | "solana"; label: string; icon: string }[] = [
    { id: "evm", label: "EVM", icon: "ethereum" },
    { id: "solana", label: "Solana", icon: "currency-sign" },
  ];

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: colors.bgPrimary }]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: FontFamily.heading }]}>
          Add Wallet
        </Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.body}>

        {/* Chain selector */}
        <Text style={[styles.fieldLabel, { color: colors.textTertiary, fontFamily: FontFamily.semibold }]}>
          NETWORK
        </Text>
        <View style={styles.chainRow}>
          {CHAINS.map((c) => {
            const active = chainFamily === c.id;
            return (
              <Pressable
                key={c.id}
                style={[styles.chainChip, {
                  backgroundColor: active ? colors.accentSoft : colors.bgSecondary,
                  borderColor: active ? colors.accent : colors.border,
                  flex: 1,
                }]}
                onPress={() => setChainFamily(c.id)}
              >
                <MaterialCommunityIcons
                  name={c.icon as any}
                  size={18}
                  color={active ? colors.accent : colors.textTertiary}
                />
                <Text style={[styles.chainLabel, {
                  color: active ? colors.accent : colors.textSecondary,
                  fontFamily: FontFamily.semibold,
                }]}>
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* WalletConnect button — EVM only */}
        {chainFamily === "evm" && (
          <>
            <Pressable
              style={[styles.wcButton, {
                backgroundColor: colors.accentSoft,
                borderColor: colors.accent,
              }]}
              onPress={() => open({ view: "Connect" })}
              disabled={loading}
            >
              <MaterialCommunityIcons name="wallet-outline" size={18} color={colors.accent} />
              <Text style={[styles.wcButtonText, { color: colors.accent, fontFamily: FontFamily.semibold }]}>
                Connect with WalletConnect
              </Text>
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.borderSubtle }]} />
              <Text style={[styles.dividerText, { color: colors.textTertiary, fontFamily: FontFamily.body }]}>
                or paste address
              </Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.borderSubtle }]} />
            </View>
          </>
        )}

        {/* Address input */}
        <Text style={[styles.fieldLabel, { color: colors.textTertiary, fontFamily: FontFamily.semibold }]}>
          WALLET ADDRESS
        </Text>
        <TextInput
          style={[styles.input, {
            backgroundColor: colors.bgSecondary,
            borderColor: colors.border,
            color: colors.textPrimary,
            fontFamily: FontFamily.mono,
          }]}
          value={address}
          onChangeText={(t) => { setAddress(t); setError(null); }}
          placeholder={chainFamily === "evm" ? "0x..." : "Enter Solana address"}
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          multiline={false}
        />

        {/* Optional label */}
        <Text style={[styles.fieldLabel, { color: colors.textTertiary, fontFamily: FontFamily.semibold }]}>
          LABEL <Text style={{ color: colors.textTertiary, fontFamily: FontFamily.body }}>— optional</Text>
        </Text>
        <TextInput
          style={[styles.input, {
            backgroundColor: colors.bgSecondary,
            borderColor: colors.border,
            color: colors.textPrimary,
            fontFamily: FontFamily.body,
          }]}
          value={label}
          onChangeText={setLabel}
          placeholder="e.g. Main wallet"
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="words"
          autoCorrect={false}
        />

        {/* Error */}
        {error && (
          <Text style={[styles.error, { color: colors.danger, fontFamily: FontFamily.body }]}>
            {error}
          </Text>
        )}

        {/* Hint */}
        <Text style={[styles.hint, { color: colors.textTertiary, fontFamily: FontFamily.body }]}>
          Read-only — no private keys required.
        </Text>

        {/* CTA */}
        <Pressable onPressIn={onPressIn} onPressOut={onPressOut} onPress={handleAdd} disabled={loading}>
          <Animated.View style={[styles.ctaBtn, {
            backgroundColor: colors.accent,
            opacity: loading ? 0.7 : 1,
            transform: [{ scale: btnScale }],
          }]}>
            <Text style={[styles.ctaText, { fontFamily: FontFamily.semibold }]}>
              {loading ? "Adding…" : "Add Wallet"}
            </Text>
          </Animated.View>
        </Pressable>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    height: 56,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  heading: {
    fontSize: FontSize.h4,
    letterSpacing: -0.2,
  },
  body: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.sm,
  },
  fieldLabel: {
    fontSize: FontSize.label,
    letterSpacing: 0.5,
    marginTop: Spacing.sm,
  },
  chainRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  chainChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.card,
    borderWidth: 1,
  },
  chainLabel: {
    fontSize: FontSize.bodySmall,
  },
  wcButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: Radius.card,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  wcButtonText: {
    fontSize: FontSize.bodySmall,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: FontSize.caption,
    letterSpacing: 0.2,
  },
  input: {
    borderRadius: Radius.card,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: FontSize.bodySmall,
  },
  error: {
    fontSize: FontSize.bodySmall,
    lineHeight: 20,
  },
  hint: {
    fontSize: FontSize.caption,
    letterSpacing: 0.1,
    marginTop: 2,
  },
  ctaBtn: {
    height: 56,
    borderRadius: Radius.pill,
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.md,
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: FontSize.body,
    letterSpacing: 0.3,
  },
});
