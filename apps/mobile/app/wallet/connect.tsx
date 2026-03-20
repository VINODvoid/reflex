import { useState, useRef, useEffect } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Animated,
} from "react-native";
import { GradientBackground } from "../../components/GradientBackground";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppKit, useAccount } from "@reown/appkit-react-native";
import {
  transact,
  SolanaMobileWalletAdapterError,
  SolanaMobileWalletAdapterErrorCode,
} from "@solana-mobile/mobile-wallet-adapter-protocol";
import bs58 from "bs58";
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

  async function connectSolanaWallet() {
    if (!userId) {
      setError("Registration not complete. Please restart the app.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const authResult = await transact(async (wallet) => {
        return await wallet.authorize({
          identity: { name: "REFLEX" },
          chain: "solana:mainnet",
        });
      });

      const account = authResult.accounts[0];
      if (!account) {
        setError("No account returned by wallet.");
        return;
      }

      let base58Address: string;
      if ("publicKey" in account) {
        base58Address = account.address;
      } else {
        const pubkeyBytes = new Uint8Array(Buffer.from(account.address, "base64"));
        base58Address = bs58.encode(pubkeyBytes);
      }

      const created = await createWallet(userId, base58Address, "solana", label.trim() || undefined);
      addWallet(created);
      router.back();
    } catch (err) {
      if (err instanceof SolanaMobileWalletAdapterError) {
        if (err.code === SolanaMobileWalletAdapterErrorCode.ERROR_WALLET_NOT_FOUND) {
          setError("No Solana wallet found. Install Phantom or Solflare.");
        } else if (err.code === SolanaMobileWalletAdapterErrorCode.ERROR_ASSOCIATION_CANCELLED) {
          // user dismissed — silent
        } else {
          setError("Wallet connection failed. Try again.");
        }
      } else {
        setError("Failed to add wallet. Try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  const CHAINS: { id: "evm" | "solana"; label: string; icon: string }[] = [
    { id: "evm", label: "EVM", icon: "ethereum" },
    { id: "solana", label: "Solana", icon: "currency-sign" },
  ];

  return (
    <GradientBackground>
      <StatusBar style={isDark ? "light" : "dark"} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: FontFamily.heading }]}>
          Add Wallet
        </Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Chain selector */}
        <Text style={[styles.fieldLabel, { color: colors.accent, fontFamily: FontFamily.semibold }]}>
          NETWORK
        </Text>
        <View style={styles.chainRow}>
          {CHAINS.map((c) => {
            const active = chainFamily === c.id;
            return (
              <Pressable
                key={c.id}
                style={({ pressed }) => [
                  styles.chainBtn,
                  {
                    backgroundColor: active ? colors.accentSoft : colors.bgSecondary,
                    borderColor: active ? colors.accent : colors.border,
                    opacity: pressed ? 0.85 : 1,
                    flex: 1,
                  },
                ]}
                onPress={() => setChainFamily(c.id)}
              >
                <MaterialCommunityIcons
                  name={c.icon as any}
                  size={20}
                  color={active ? colors.accent : colors.textTertiary}
                />
                <Text style={[styles.chainLabel, {
                  color: active ? colors.accent : colors.textSecondary,
                  fontFamily: active ? FontFamily.semibold : FontFamily.body,
                }]}>
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* WalletConnect — EVM */}
        {chainFamily === "evm" && (
          <>
            <Pressable
              style={({ pressed }) => [
                styles.connectBtn,
                {
                  backgroundColor: colors.accentSoft,
                  borderColor: colors.accent,
                  opacity: (loading || pressed) ? 0.75 : 1,
                },
              ]}
              onPress={() => open({ view: "Connect" })}
              disabled={loading}
            >
              <MaterialCommunityIcons name="wallet-outline" size={20} color={colors.accent} />
              <Text style={[styles.connectBtnText, { color: colors.accent, fontFamily: FontFamily.semibold }]}>
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

        {/* Solana Mobile Wallet Adapter — Android only */}
        {chainFamily === "solana" && Platform.OS === "android" && (
          <>
            <Pressable
              style={({ pressed }) => [
                styles.connectBtn,
                {
                  backgroundColor: colors.accentSoft,
                  borderColor: colors.accent,
                  opacity: (loading || pressed) ? 0.75 : 1,
                },
              ]}
              onPress={connectSolanaWallet}
              disabled={loading}
            >
              <MaterialCommunityIcons name="wallet-outline" size={20} color={colors.accent} />
              <Text style={[styles.connectBtnText, { color: colors.accent, fontFamily: FontFamily.semibold }]}>
                Connect Solana Wallet
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

        {/* iOS note */}
        {chainFamily === "solana" && Platform.OS === "ios" && (
          <View style={[styles.infoNote, { backgroundColor: colors.bgSecondary, borderColor: colors.borderSubtle }]}>
            <MaterialCommunityIcons name="information-outline" size={15} color={colors.textTertiary} />
            <Text style={[styles.infoNoteText, { color: colors.textTertiary, fontFamily: FontFamily.body }]}>
              Wallet connection is Android-only. Paste your Solana address below.
            </Text>
          </View>
        )}

        {/* Address input */}
        <Text style={[styles.fieldLabel, { color: colors.accent, fontFamily: FontFamily.semibold }]}>
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

        {/* Label input */}
        <Text style={[styles.fieldLabel, { color: colors.accent, fontFamily: FontFamily.semibold }]}>
          LABEL{" "}
          <Text style={{ color: colors.textTertiary, fontFamily: FontFamily.body, letterSpacing: 0 }}>
            — optional
          </Text>
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

        {error && (
          <Text style={[styles.error, { color: colors.danger, fontFamily: FontFamily.body }]}>
            {error}
          </Text>
        )}

        <Text style={[styles.hint, { color: colors.textTertiary, fontFamily: FontFamily.body }]}>
          Read-only — no private keys required.
        </Text>

        {/* CTA */}
        <Pressable
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onPress={handleAdd}
          disabled={loading}
        >
          <Animated.View style={[styles.ctaBtn, {
            backgroundColor: colors.accent,
            opacity: loading ? 0.65 : 1,
            transform: [{ scale: btnScale }],
          }]}>
            <Text style={[styles.ctaText, { fontFamily: FontFamily.semibold }]}>
              {loading ? "Adding…" : "Add Wallet"}
            </Text>
          </Animated.View>
        </Pressable>
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    height: 56,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: {
    fontSize: FontSize.h4,
    letterSpacing: -0.2,
  },
  body: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: 48,
    gap: Spacing.sm,
  },
  fieldLabel: {
    fontSize: FontSize.label,
    letterSpacing: 0.8,
    marginTop: Spacing.sm,
  },
  chainRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  chainBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: Radius.card,
    borderWidth: 1,
  },
  chainLabel: {
    fontSize: FontSize.bodySmall,
  },
  connectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: Radius.card,
    borderWidth: 1,
    marginTop: 4,
  },
  connectBtnText: {
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
  infoNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderRadius: Radius.card,
    borderWidth: 1,
    marginTop: 4,
  },
  infoNoteText: {
    flex: 1,
    fontSize: FontSize.caption,
    lineHeight: 18,
  },
  input: {
    borderRadius: Radius.card,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: 16,
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
    color: "#0B0A08",
    fontSize: FontSize.body,
    letterSpacing: 0.3,
  },
});
