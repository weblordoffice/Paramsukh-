import { create } from 'zustand';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ThemeName } from '../theme/colors';
import { lightColors, darkColors, ThemeColors } from '../theme/colors';

const THEME_STORAGE_KEY = 'app_theme';

interface ThemeState {
  theme: ThemeName;
  isDark: boolean;
  colors: ThemeColors;
  setTheme: (theme: ThemeName) => Promise<void>;
  toggleTheme: () => Promise<void>;
  loadTheme: () => Promise<void>;
  syncWithSystem: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'light',
  isDark: false,
  colors: lightColors,

  setTheme: async (theme) => {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, theme);
    set({
      theme,
      isDark: theme === 'dark',
      colors: theme === 'dark' ? darkColors : lightColors,
    });
  },

  toggleTheme: async () => {
    const next: ThemeName = get().isDark ? 'light' : 'dark';
    await get().setTheme(next);
  },

  syncWithSystem: () => {
    const systemDark = Appearance.getColorScheme() === 'dark';
    set({
      theme: systemDark ? 'dark' : 'light',
      isDark: systemDark,
      colors: systemDark ? darkColors : lightColors,
    });
  },

  loadTheme: async () => {
    try {
      const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') {
        set({
          theme: stored,
          isDark: stored === 'dark',
          colors: stored === 'dark' ? darkColors : lightColors,
        });
        return;
      }
    } catch {
      // Ignore storage errors
    }
    const systemDark = Appearance.getColorScheme() === 'dark';
    set({
      theme: systemDark ? 'dark' : 'light',
      isDark: systemDark,
      colors: systemDark ? darkColors : lightColors,
    });
  },
}));
