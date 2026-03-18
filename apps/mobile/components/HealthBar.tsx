import { StyleSheet, Text, View } from "react-native";
import {
  FontFamily,
  FontSize,
  Radius,
  getHFColor,
} from "../design-system/tokens";
import { useThemeColors } from "../hooks/useThemeColors";

interface HealthBarProps {
  healthFactor: number;
  /** Show the numeric value label below the bar. Default true. */
  showLabel?: boolean;
  /** Height of the bar track. Default 6. */
  height?: number;
}

// Bar represents 0 → MAX_HF; anything at or above MAX_HF fills the bar completely.
const MAX_HF = 3.0;

export function HealthBar({ healthFactor, showLabel = true, height = 6 }: HealthBarProps) {
  const colors = useThemeColors();
  const fill = Math.min(1, Math.max(0, healthFactor / MAX_HF));
  const barColor = getHFColor(healthFactor, colors);

  return (
    <View style={styles.root}>
      {/* Track */}
      <View style={[styles.track, {
        height,
        borderRadius: height / 2,
        backgroundColor: colors.bgSecondary,
      }]}>
        {/* Fill */}
        <View style={[styles.fill, {
          width: `${fill * 100}%`,
          height,
          borderRadius: height / 2,
          backgroundColor: barColor,
        }]} />
      </View>

      {showLabel && (
        <View style={styles.labelRow}>
          <Text style={[styles.hfValue, { color: barColor, fontFamily: FontFamily.monoSemibold }]}>
            {healthFactor.toFixed(2)}
          </Text>
          <Text style={[styles.hfLabel, { color: colors.textTertiary, fontFamily: FontFamily.semibold }]}>
            HF
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 6,
  },
  track: {
    width: "100%",
    overflow: "hidden",
  },
  fill: {},
  labelRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  hfValue: {
    fontSize: FontSize.h4,
    letterSpacing: -0.4,
  },
  hfLabel: {
    fontSize: FontSize.caption,
    letterSpacing: 0.5,
  },
});
