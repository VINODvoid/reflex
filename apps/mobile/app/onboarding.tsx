/**
 * REFLEX Onboarding
 * Fonts: bun add @expo-google-fonts/syne expo-font
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Syne_400Regular,
  Syne_600SemiBold,
  Syne_700Bold,
  Syne_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/syne";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors, Spacing, Radius, FontFamily } from "../design-system/tokens";
import { STORAGE_KEYS } from "../constants/storageKeys";

export const ONBOARDING_SEEN_KEY = STORAGE_KEYS.ONBOARDING_SEEN;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const VISUAL_HEIGHT = Math.min(290, Math.round(SCREEN_HEIGHT * 0.38));

// Ring sizes — all visuals share this bounding box
const G_OUTER = 224;
const G_MID   = 170;
const G_INNER = 114;

// ─── Slide Data ────────────────────────────────────────────────────────────────

const SLIDES = [
  {
    id: "hero",
    eyebrow: "REFLEX",
    headline: "Stay ahead\nof liquidation.",
    body: "The precision monitor for your DeFi positions. Know your risk before the market moves.",
    cta: "Get Started",
    showSkip: true,
  },
  {
    id: "positions",
    eyebrow: "POSITIONS",
    headline: "Every protocol.\nOne view.",
    body: "Aave, Compound, MarginFi, Solend — tracked in real time across EVM chains and Solana.",
    cta: "Next",
    showSkip: true,
  },
  {
    id: "alerts",
    eyebrow: "ALERTS",
    headline: "Notified before\nit's critical.",
    body: "Set health factor thresholds. We send a push notification before you reach liquidation territory.",
    cta: "Next",
    showSkip: true,
  },
  {
    id: "start",
    eyebrow: "GET STARTED",
    headline: "Add your\nfirst wallet.",
    body: "Paste any EVM or Solana address. No private keys, no custody. Read-only, always.",
    cta: "Let's go",
    showSkip: false,
  },
] as const;

// ─── Shared animation helpers ─────────────────────────────────────────────────

function useEntrance(delay = 0) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1, duration: 600, delay,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0, duration: 600, delay,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
    ]).start();
  }, []);
  return { opacity, transform: [{ translateY }] };
}

function useLoop(duration: number, direction: "cw" | "ccw" = "cw") {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, {
        toValue: 1, duration, easing: Easing.linear, useNativeDriver: true,
      })
    ).start();
  }, []);
  const out = direction === "cw"
    ? anim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] })
    : anim.interpolate({ inputRange: [0, 1], outputRange: ["360deg", "0deg"] });
  return out;
}

function usePulse(min: number, max: number, duration: number) {
  const anim = useRef(new Animated.Value(min)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: max, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(anim, { toValue: min, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return anim;
}

// ─── Visual Components ─────────────────────────────────────────────────────────

type VisualProps = { colors: ReturnType<typeof useColors>; isDark: boolean };

// ── Slide 1: Animated gauge rings ───────────────────────────────────────────

function HeroVisual({ colors, isDark }: VisualProps) {
  const entrance = useEntrance(0);
  const outerSpin  = useLoop(13000, "cw");
  const middleSpin = useLoop(8500, "ccw");
  const innerScale = usePulse(1, 1.045, 2200);

  const ringOuter  = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
  const ringMiddle = isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.11)";

  return (
    <Animated.View style={[styles.gaugeContainer, entrance]}>
      {/* Outer ring + accent marker */}
      <Animated.View style={[styles.gaugeOuter, {
        borderColor: ringOuter,
        transform: [{ rotate: outerSpin }],
      }]}>
        <View style={[styles.ringDot, { backgroundColor: colors.accent, top: -4, alignSelf: "center" }]} />
      </Animated.View>

      {/* Middle ring + subtle marker */}
      <Animated.View style={[styles.gaugeMid, {
        borderColor: ringMiddle,
        transform: [{ rotate: middleSpin }],
      }]}>
        <View style={[styles.ringDotSm, {
          backgroundColor: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.18)",
          top: -3, alignSelf: "center",
        }]} />
      </Animated.View>

      {/* Inner gauge — breathing */}
      <Animated.View style={[styles.gaugeInner, {
        borderColor: colors.accent,
        backgroundColor: isDark ? "rgba(212,168,67,0.11)" : colors.accentSoft,
        transform: [{ scale: innerScale }],
      }]}>
        <Text style={[styles.gaugeValue, { color: colors.accent, fontFamily: FontFamily.monoSemibold }]}>
          2.47
        </Text>
        <Text style={[styles.gaugeLabel, { color: colors.textTertiary, fontFamily: FontFamily.semibold }]}>
          HEALTH FACTOR
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

// ── Slide 2: Stacked cards — staggered entrance ─────────────────────────────

function PositionsVisual({ colors, isDark }: VisualProps) {
  const cards = [
    { protocol: "AAVE V3",   hf: "3.12", safe: true  },
    { protocol: "COMPOUND",  hf: "1.64", safe: false },
    { protocol: "MARGINFI",  hf: "2.01", safe: true  },
  ];

  const anims = [useEntrance(0), useEntrance(80), useEntrance(160)];

  return (
    <View style={styles.gaugeContainer}>
      <View style={styles.stackWrap}>
        {cards.map((card, i) => (
          <Animated.View key={card.protocol} style={[styles.stackCard, {
            backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "#FFFFFF",
            borderColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.05)",
            top: i * 24, left: i * 16, right: i * 16,
            zIndex: 3 - i, opacity: anims[i].opacity,
            transform: anims[i].transform,
          }]}>
            <Text style={[styles.stackProtocol, { color: colors.textSecondary, fontFamily: FontFamily.semibold }]}>
              {card.protocol}
            </Text>
            <Text style={[styles.stackHF, {
              color: card.safe ? colors.success : colors.warning,
              fontFamily: FontFamily.monoSemibold,
            }]}>
              {card.hf}
            </Text>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

// ── Slide 3: Alert card — pulsing dot + value ────────────────────────────────

function AlertsVisual({ colors, isDark }: VisualProps) {
  const entrance  = useEntrance(0);
  const dotPulse  = usePulse(1, 0, 900);
  const valPulse  = usePulse(1, 0.55, 1800);

  return (
    <Animated.View style={[styles.gaugeContainer, entrance]}>
      <View style={[styles.alertCard, {
        backgroundColor: isDark ? "rgba(248,113,113,0.11)" : colors.dangerSoft,
        borderColor: isDark ? "rgba(248,113,113,0.22)" : "rgba(192,57,43,0.18)",
      }]}>
        <View style={styles.alertHeader}>
          <Animated.View style={[styles.alertDot, { backgroundColor: colors.danger, opacity: dotPulse }]} />
          <Text style={[styles.alertTitle, { color: colors.danger, fontFamily: FontFamily.semibold }]}>
            HEALTH FACTOR ALERT
          </Text>
        </View>
        <Animated.Text style={[styles.alertValue, {
          color: isDark ? "#F87171" : colors.textPrimary,
          fontFamily: FontFamily.monoSemibold,
          opacity: valPulse,
        }]}>
          1.18
        </Animated.Text>
        <Text style={[styles.alertBody, { color: colors.textSecondary, fontFamily: FontFamily.body }]}>
          Below your threshold of 1.25 on Aave V3
        </Text>
      </View>
    </Animated.View>
  );
}

// ── Slide 4: Wallet field — slide in from left ───────────────────────────────

function WalletVisual({ colors, isDark }: VisualProps) {
  const fieldAnim = useRef(new Animated.Value(-24)).current;
  const fieldOpacity = useRef(new Animated.Value(0)).current;
  const chipsOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fieldAnim, {
          toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
        Animated.timing(fieldOpacity, {
          toValue: 1, duration: 500, useNativeDriver: true,
        }),
      ]),
      Animated.timing(chipsOpacity, {
        toValue: 1, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={[styles.gaugeContainer, { justifyContent: "center", alignItems: "flex-start" }]}>
      <Animated.View style={[styles.walletField, {
        backgroundColor: isDark ? "rgba(255,255,255,0.07)" : colors.bgSecondary,
        borderColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)",
        opacity: fieldOpacity,
        transform: [{ translateX: fieldAnim }],
        width: G_OUTER,
      }]}>
        <Text style={[styles.walletLabel, { color: colors.textTertiary, fontFamily: FontFamily.semibold }]}>
          WALLET ADDRESS
        </Text>
        <Text style={[styles.walletAddress, { color: colors.textPrimary, fontFamily: FontFamily.mono }]} numberOfLines={1}>
          0x71C7...F09E
        </Text>
      </Animated.View>
      <Animated.View style={[styles.walletChips, { opacity: chipsOpacity }]}>
        {["EVM", "SOLANA"].map((chain) => (
          <View key={chain} style={[styles.walletChip, {
            backgroundColor: isDark ? "rgba(212,168,67,0.14)" : colors.accentSoft,
            borderColor: isDark ? "rgba(212,168,67,0.28)" : "rgba(160,114,24,0.18)",
          }]}>
            <Text style={[styles.walletChipText, { color: colors.accent, fontFamily: FontFamily.semibold }]}>
              {chain}
            </Text>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

const VISUALS = [HeroVisual, PositionsVisual, AlertsVisual, WalletVisual];

// ─── Main Component ────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const colors = useColors();
  const scheme  = useColorScheme();
  const isDark  = scheme === "dark";

  const [fontsLoaded] = useFonts({
    Syne_400Regular,
    Syne_600SemiBold,
    Syne_700Bold,
    Syne_800ExtraBold,
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const ctaScale  = useRef(new Animated.Value(1)).current;

  if (!fontsLoaded) {
    return <View style={[styles.fill, { backgroundColor: isDark ? "#0B0A08" : "#FFFEF9" }]} />;
  }

  function handleCTA() {
    if (currentIndex < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: (currentIndex + 1) * SCREEN_WIDTH, animated: true });
    } else {
      AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_SEEN, "true").catch(() => {});
      router.replace("/(tabs)");
    }
  }

  function handleSkip() {
    AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_SEEN, "true").catch(() => {});
    router.replace("/(tabs)");
  }

  function onPressIn() {
    Animated.spring(ctaScale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  }
  function onPressOut() {
    Animated.spring(ctaScale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  }

  function onMomentumScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const raw = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    const i   = Math.max(0, Math.min(SLIDES.length - 1, raw));
    if (i !== currentIndex) setCurrentIndex(i);
  }

  const slide = SLIDES[currentIndex];

  // Luxury warm gradient — barely perceptible depth
  const bgColors: [string, string] = isDark
    ? ["#0B0A08", "#13110C"]
    : ["#FFFEF9", "#F5F0E6"];

  // Gold gradient CTA
  const ctaColors: [string, string] = isDark
    ? ["#B87820", "#D4A843"]
    : ["#8A5E10", "#A07218"];

  return (
    <LinearGradient colors={bgColors} style={styles.fill}>
      <SafeAreaView style={styles.fill}>
        <StatusBar style={isDark ? "light" : "dark"} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.fill} />
          <Pressable
            onPress={handleSkip}
            hitSlop={16}
            style={[styles.skipBtn, { opacity: slide.showSkip ? 1 : 0 }]}
            pointerEvents={slide.showSkip ? "auto" : "none"}
          >
            <Text style={[styles.skipText, { color: colors.textSecondary, fontFamily: FontFamily.semibold }]}>
              Skip
            </Text>
          </Pressable>
        </View>

        {/* Slides */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumScrollEnd}
          style={styles.fill}
        >
          {SLIDES.map((s, i) => {
            const SlideVisual = VISUALS[i];
            return (
              <View key={s.id} style={[styles.slide, { width: SCREEN_WIDTH }]}>
                {/* Fixed-height visual zone — identical across all slides */}
                <View style={styles.visualZone}>
                  <SlideVisual colors={colors} isDark={isDark} />
                </View>
                {/* Text always starts at the same Y */}
                <View style={styles.textBlock}>
                  <Text style={[styles.eyebrow, { color: colors.accent, fontFamily: FontFamily.semibold }]}>
                    {s.eyebrow}
                  </Text>
                  <Text style={[styles.headline, { color: colors.textPrimary, fontFamily: FontFamily.heading }]}>
                    {s.headline}
                  </Text>
                  <Text style={[styles.body, { color: colors.textSecondary, fontFamily: FontFamily.body }]}>
                    {s.body}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Controls */}
        <View style={styles.controls}>
          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <Animated.View key={i} style={[styles.dot, {
                backgroundColor: i === currentIndex
                  ? colors.accent
                  : isDark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.12)",
                width: i === currentIndex ? 24 : 8,
              }]} />
            ))}
          </View>
          <Pressable onPressIn={onPressIn} onPressOut={onPressOut} onPress={handleCTA}>
            <Animated.View style={{ transform: [{ scale: ctaScale }], borderRadius: Radius.pill, overflow: "hidden" }}>
              <LinearGradient colors={ctaColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaBtn}>
                <Text style={[styles.ctaText, { fontFamily: FontFamily.semibold }]}>{slide.cta}</Text>
              </LinearGradient>
            </Animated.View>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  fill: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    height: 48,
  },
  skipBtn: { paddingVertical: 8, paddingLeft: 16 },
  skipText: { fontSize: 15, letterSpacing: 0.1 },

  slide: {
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },

  // Fixed-height zone — all 4 slides identical
  visualZone: {
    height: VISUAL_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Gauge: all rings absolutely positioned within this container
  gaugeContainer: {
    width: G_OUTER,
    height: G_OUTER,
    justifyContent: "center",
    alignItems: "center",
  },
  gaugeOuter: {
    position: "absolute",
    width: G_OUTER, height: G_OUTER,
    borderRadius: G_OUTER / 2,
    borderWidth: 1,
  },
  gaugeMid: {
    position: "absolute",
    width: G_MID, height: G_MID,
    borderRadius: G_MID / 2,
    borderWidth: 1,
  },
  gaugeInner: {
    width: G_INNER, height: G_INNER,
    borderRadius: G_INNER / 2,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    gap: 3,
  },
  gaugeValue: { fontSize: 27, lineHeight: 32, letterSpacing: -0.5 },
  gaugeLabel: { fontSize: 7.5, letterSpacing: 1.2, textTransform: "uppercase" },
  ringDot: {
    width: 7, height: 7, borderRadius: 3.5,
    position: "absolute",
  },
  ringDotSm: {
    width: 5, height: 5, borderRadius: 2.5,
    position: "absolute",
  },

  // ── Positions
  stackWrap: {
    width: G_OUTER, height: 136, position: "relative",
  },
  stackCard: {
    position: "absolute",
    height: 64,
    borderRadius: Radius.card,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  stackProtocol: { fontSize: 11, letterSpacing: 0.8 },
  stackHF: { fontSize: 20, letterSpacing: -0.5 },

  // ── Alert
  alertCard: {
    width: G_OUTER,
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: 20,
    gap: 8,
  },
  alertHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  alertDot: { width: 7, height: 7, borderRadius: 3.5 },
  alertTitle: { fontSize: 10, letterSpacing: 1 },
  alertValue: { fontSize: 44, letterSpacing: -1.5, lineHeight: 48 },
  alertBody: { fontSize: 13, lineHeight: 19 },

  // ── Wallet
  walletField: {
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: 16,
    gap: 6,
    marginBottom: 12,
  },
  walletLabel: { fontSize: 10, letterSpacing: 1 },
  walletAddress: { fontSize: 15, letterSpacing: 0.3 },
  walletChips: { flexDirection: "row", gap: 8 },
  walletChip: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: Radius.sharp, borderWidth: 1,
  },
  walletChipText: { fontSize: 11, letterSpacing: 0.8 },

  // ── Text block
  textBlock: {
    paddingTop: Spacing.xl,
    gap: 10,
  },
  eyebrow: { fontSize: 11, letterSpacing: 2, textTransform: "uppercase" },
  headline: { fontSize: 38, lineHeight: 44, letterSpacing: -1 },
  body: { fontSize: 16, lineHeight: 25, letterSpacing: 0.1, marginTop: 2 },

  // ── Controls
  controls: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.md,
    gap: 20,
  },
  dots: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { height: 8, borderRadius: 4 },
  ctaBtn: {
    height: 56, borderRadius: Radius.pill,
    justifyContent: "center", alignItems: "center",
  },
  ctaText: { color: "#FFFFFF", fontSize: 16, letterSpacing: 0.3 },
});
