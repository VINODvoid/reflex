import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useThemeColors } from "../hooks/useThemeColors";
import { useStore } from "../store";
import { FontFamily, FontSize, Spacing } from "../design-system/tokens";

interface AppHeaderProps {
  right?: React.ReactNode;
}

export function AppHeader({ right }: AppHeaderProps) {
  const colors = useThemeColors();
  const isDemo = useStore((s) => s.isDemo);
  const exitDemo = useStore((s) => s.exitDemo);

  return (
    <>
      <View style={styles.header}>
        <View style={styles.brand}>
          <MaterialCommunityIcons name="chart-line-variant" size={16} color={colors.accent} />
          <Text style={[styles.brandText, { color: colors.accent, fontFamily: FontFamily.heading }]}>
            REFLEX
          </Text>
        </View>
        <View style={styles.rightSlot}>{right ?? null}</View>
      </View>

      {isDemo && (
        <View style={[styles.demoBanner, { backgroundColor: colors.accentSoft, borderBottomColor: colors.accent }]}>
          <MaterialCommunityIcons name="play-box-outline" size={13} color={colors.accent} />
          <Text style={[styles.demoText, { color: colors.accent, fontFamily: FontFamily.semibold }]}>
            DEMO MODE — data is simulated
          </Text>
          <Pressable onPress={exitDemo} hitSlop={8}>
            <Text style={[styles.demoExit, { color: colors.accent, fontFamily: FontFamily.semibold }]}>
              Exit
            </Text>
          </Pressable>
        </View>
      )}
    </>
  );
}

export function HeaderIconButton({
  icon,
  onPress,
}: {
  icon: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.5 : 1 }]}
    >
      <MaterialCommunityIcons name={icon as any} size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    height: 56,
  },
  demoBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
  },
  demoText: {
    flex: 1,
    fontSize: FontSize.caption,
    letterSpacing: 0.4,
    textAlign: "center",
  },
  demoExit: {
    fontSize: FontSize.caption,
    letterSpacing: 0.3,
    textDecorationLine: "underline",
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  brandText: {
    fontSize: 14,
    letterSpacing: 4,
  },
  rightSlot: {
    minWidth: 36,
    alignItems: "flex-end",
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
});
