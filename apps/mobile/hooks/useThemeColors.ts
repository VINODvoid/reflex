import { useStore } from "../store";
import { getColors, ColorTokens } from "../design-system/tokens";

export function useThemeColors(): ColorTokens {
  const theme = useStore((state) => state.theme);
  const systemScheme = useStore((state) => state.systemScheme);
  const scheme = theme === "system" ? systemScheme : theme;
  return getColors(scheme);
}

export function useIsDark(): boolean {
  const theme = useStore((state) => state.theme);
  const systemScheme = useStore((state) => state.systemScheme);
  return (theme === "system" ? systemScheme : theme) === "dark";
}
