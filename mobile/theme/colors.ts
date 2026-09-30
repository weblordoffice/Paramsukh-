// Central color palettes for light and dark themes.
// Screens must consume these via the useTheme() hook instead of hardcoding hex values.
//
// Light = warm cream/earth brand (matches tab bar, header, and screen surfaces).
// Dark  = warm charcoal companion — same brand accents, no navy clash.

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceSecondary: string;
  text: string;
  textSecondary: string;
  border: string;
  primary: string;
  danger: string;
  success: string;
  warning: string;
  statusBarStyle: 'light' | 'dark';
}

export const lightColors: ThemeColors = {
  background: '#F4F3EB',
  surface: '#FFFFFF',
  surfaceSecondary: '#EBE5D3',
  text: '#2C2420',
  textSecondary: '#8C7B73',
  border: '#E2DAC6',
  primary: '#F1842D',
  danger: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',
  statusBarStyle: 'dark',
};

export const darkColors: ThemeColors = {
  background: '#1C1917',
  surface: '#292524',
  surfaceSecondary: '#44403C',
  text: '#FAF7F1',
  textSecondary: '#A8A29E',
  border: '#44403C',
  primary: '#F1842D',
  danger: '#F87171',
  success: '#34D399',
  warning: '#FBBF24',
  statusBarStyle: 'light',
};

export type ThemeName = 'light' | 'dark';
