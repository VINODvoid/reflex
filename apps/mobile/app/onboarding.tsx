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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Spacing, Radius, FontFamily } from "../design-system/tokens";
import { useThemeColors, useIsDark } from "../hooks/useThemeColors";
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

import { ColorTokens } from "../design-system/tokens";
type VisualProps = { colors: ColorTokens; isDark: boolean };

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

// ── Slide 2: Depth-shuffle card deck ─────────────────────────────────────────
// Front card slides DOWN into the back of the deck. No exits, no teleports.
// All 3 cards animate simultaneously to new positions — buttery smooth.

const DECK_Y  = [0, 28, 52];
const DECK_OP = [1, 0.68, 0.36];
const DECK_SC = [1, 0.93, 0.86];
const DECK_STEP = 580;
const DECK_PAUSE = 1600;

function PositionsVisual({ colors, isDark }: VisualProps) {
  const CARDS = [
    { protocol: "AAVE V3",  hf: "3.12", safe: true  },
    { protocol: "COMPOUND", hf: "1.64", safe: false },
    { protocol: "MARGINFI", hf: "2.01", safe: true  },
  ];

  const ty0 = useRef(new Animated.Value(DECK_Y[0])).current;
  const ty1 = useRef(new Animated.Value(DECK_Y[1])).current;
  const ty2 = useRef(new Animated.Value(DECK_Y[2])).current;
  const op0 = useRef(new Animated.Value(DECK_OP[0])).current;
  const op1 = useRef(new Animated.Value(DECK_OP[1])).current;
  const op2 = useRef(new Animated.Value(DECK_OP[2])).current;
  const sc0 = useRef(new Animated.Value(DECK_SC[0])).current;
  const sc1 = useRef(new Animated.Value(DECK_SC[1])).current;
  const sc2 = useRef(new Animated.Value(DECK_SC[2])).current;

  // z-order: front card renders last (highest z). Card 0 starts at front.
  const [zOrder, setZOrder] = useState([3, 2, 1]);
  const slotRef = useRef([0, 1, 2]); // slotRef.current[i] = slot of card i (0=front)

  useEffect(() => {
    const TY = [ty0, ty1, ty2];
    const OP = [op0, op1, op2];
    const SC = [sc0, sc1, sc2];
    const ease = Easing.bezier(0.4, 0, 0.2, 1); // smooth material ease

    function shuffle() {
      const s = slotRef.current;
      const front = s.indexOf(0);
      const mid   = s.indexOf(1);
      const back  = s.indexOf(2);

      // front → back, mid → front, back → mid
      slotRef.current = slotRef.current.map(v => (v + 2) % 3);

      // Update z-order BEFORE animation so no mid-animation re-render:
      // new front (was mid) gets highest z, front (going to back) drops to lowest
      setZOrder(() => {
        const z = [0, 0, 0];
        z[mid]   = 3; // rises to front
        z[back]  = 2; // rises to mid
        z[front] = 1; // sinks to back
        return z;
      });

      Animated.parallel([
        // Front sinks to back — shrinks and fades behind the others
        Animated.timing(TY[front], { toValue: DECK_Y[2], duration: DECK_STEP, easing: ease, useNativeDriver: true }),
        Animated.timing(OP[front], { toValue: DECK_OP[2], duration: DECK_STEP, useNativeDriver: true }),
        Animated.timing(SC[front], { toValue: DECK_SC[2], duration: DECK_STEP, easing: ease, useNativeDriver: true }),
        // Mid rises to front — expands and brightens
        Animated.timing(TY[mid], { toValue: DECK_Y[0], duration: DECK_STEP, easing: ease, useNativeDriver: true }),
        Animated.timing(OP[mid], { toValue: DECK_OP[0], duration: DECK_STEP, useNativeDriver: true }),
        Animated.timing(SC[mid], { toValue: DECK_SC[0], duration: DECK_STEP, easing: ease, useNativeDriver: true }),
        // Back advances to mid
        Animated.timing(TY[back], { toValue: DECK_Y[1], duration: DECK_STEP, easing: ease, useNativeDriver: true }),
        Animated.timing(OP[back], { toValue: DECK_OP[1], duration: DECK_STEP, useNativeDriver: true }),
        Animated.timing(SC[back], { toValue: DECK_SC[1], duration: DECK_STEP, easing: ease, useNativeDriver: true }),
      ]).start();
    }

    let interval: ReturnType<typeof setInterval>;
    const timeout = setTimeout(() => {
      shuffle();
      interval = setInterval(shuffle, DECK_PAUSE + DECK_STEP);
    }, 1000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  const TY = [ty0, ty1, ty2];
  const OP = [op0, op1, op2];
  const SC = [sc0, sc1, sc2];

  return (
    <View style={styles.gaugeContainer}>
      <View style={styles.stackWrap}>
        {CARDS.map((card, i) => (
          <Animated.View key={card.protocol} style={[styles.stackCard, {
            backgroundColor: isDark ? colors.surfaceElevated : colors.surface,
            borderColor: colors.borderSubtle,
            transform: [{ translateY: TY[i] }, { scale: SC[i] }],
            opacity: OP[i],
            zIndex: zOrder[i],
            elevation: zOrder[i],
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

// ── Slide 3: Push notification banners cycling ────────────────────────────────
// Each banner slides in from the top with a spring, holds, then swipes right
// off screen like a real dismiss — exactly what the user gets on their phone.

const PUSH_NOTIFS = [
  { protocol: "Aave V3",     hf: "1.18", message: "Health factor below 1.25", chain: "Ethereum" },
  { protocol: "Compound V3", hf: "1.44", message: "Health factor below 1.50", chain: "Base"     },
  { protocol: "MarginFi",    hf: "1.27", message: "Health factor below 1.30", chain: "Solana"   },
];

function AlertsVisual({ colors, isDark }: VisualProps) {
  const slideX  = useRef(new Animated.Value(-G_OUTER)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale   = useRef(new Animated.Value(0.94)).current;
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    // Reset — card waits off-screen to the left
    slideX.setValue(-G_OUTER);
    opacity.setValue(0);
    scale.setValue(0.94);

    const enter = setTimeout(() => {
      // Slide in from left
      Animated.parallel([
        Animated.timing(slideX,  { toValue: 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(scale,   { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start(() => {
        // Hold, then slide out to the right
        const dismiss = setTimeout(() => {
          Animated.parallel([
            Animated.timing(slideX,  { toValue: G_OUTER, duration: 400, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          ]).start(() => setIdx(i => (i + 1) % PUSH_NOTIFS.length));
        }, 2000);
        return () => clearTimeout(dismiss);
      });
    }, 400);

    return () => clearTimeout(enter);
  }, [idx]);

  const notif = PUSH_NOTIFS[idx];
  const cardBg   = isDark ? colors.surfaceElevated : colors.surface;
  const dotBlink = usePulse(1, 0.2, 700);

  return (
    <View style={styles.notifZone}>
      <Animated.View style={[styles.notifBanner, {
        backgroundColor: cardBg,
        borderColor: colors.borderSubtle,
        borderLeftColor: colors.danger,
        shadowColor: colors.danger,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: isDark ? 0.35 : 0.12,
        shadowRadius: 18,
        elevation: 8,
        transform: [{ translateX: slideX }, { scale }],
        opacity,
      }]}>
        {/* Header row */}
        <View style={styles.notifHead}>
          <Animated.View style={[styles.notifDot, { backgroundColor: colors.danger, opacity: dotBlink }]} />
          <Text style={[styles.notifApp, { color: colors.accent, fontFamily: FontFamily.semibold }]}>
            REFLEX
          </Text>
          <Text style={[styles.notifNow, { color: colors.textTertiary, fontFamily: FontFamily.body }]}>
            now
          </Text>
        </View>

        {/* Body */}
        <View style={styles.notifBody}>
          <View style={styles.notifTitleRow}>
            <Text style={[styles.notifProtocol, { color: colors.textPrimary, fontFamily: FontFamily.semibold }]}>
              {notif.protocol}
            </Text>
            <Text style={[styles.notifHF, { color: colors.danger, fontFamily: FontFamily.monoSemibold }]}>
              {notif.hf}
            </Text>
          </View>
          <Text style={[styles.notifMsg, { color: colors.textSecondary, fontFamily: FontFamily.body }]}>
            {notif.message} · {notif.chain}
          </Text>
        </View>
      </Animated.View>
    </View>
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
  const colors = useThemeColors();
  const isDark  = useIsDark();

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
    width: G_OUTER,
    height: 120,
    position: "relative",
  },
  stackCard: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
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
  },
  stackProtocol: { fontSize: 11, letterSpacing: 0.8 },
  stackHF: { fontSize: 20, letterSpacing: -0.5 },

  // ── Notification banner
  notifZone: {
    width: G_OUTER,
    height: G_OUTER,
    justifyContent: "center",
    alignItems: "center",
    overflow: "visible",
  },
  notifBanner: {
    width: G_OUTER,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderLeftWidth: 3,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  notifHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  notifDot: { width: 6, height: 6, borderRadius: 3 },
  notifApp: { flex: 1, fontSize: 10, letterSpacing: 1.2 },
  notifNow: { fontSize: 11 },
  notifBody: { gap: 3 },
  notifTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  notifProtocol: { fontSize: 13, letterSpacing: -0.1 },
  notifHF: { fontSize: 16, letterSpacing: -0.5 },
  notifMsg: { fontSize: 12, lineHeight: 17 },

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
