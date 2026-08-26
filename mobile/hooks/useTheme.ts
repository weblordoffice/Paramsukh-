import { useThemeStore } from '../store/themeStore';

// Convenience hook for screens to access the active theme, its color palette,
// and helpers to change it. Pair with the <StatusBar /> style exported via colors.statusBarStyle.
export function useTheme() {
  const theme = useThemeStore((s) => s.theme);
  const isDark = useThemeStore((s) => s.isDark);
  const colors = useThemeStore((s) => s.colors);
  const setTheme = useThemeStore((s) => s.setTheme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  return { theme, isDark, colors, setTheme, toggleTheme };
}
