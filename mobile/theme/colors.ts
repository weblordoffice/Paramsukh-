// Central color palettes for light and dark themes.
// Screens should consume these via the useTheme() hook instead of hardcoding hex values.

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
  background: '#F9FAFB',
  surface: '#FFFFFF',
  surfaceSecondary: '#F3F4F6',
  text: '#111827',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  primary: '#3B82F6',
  danger: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',
  statusBarStyle: 'dark',
};

export const darkColors: ThemeColors = {
  background: '#0F172A',
  surface: '#1E293B',
  surfaceSecondary: '#334155',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  border: '#334155',
  primary: '#3B82F6',
  danger: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',
  statusBarStyle: 'light',
};

export type ThemeName = 'light' | 'dark';
