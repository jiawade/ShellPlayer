// src/utils/theme.ts

export const DARK_COLORS = {
  bg: '#0B0E17',
  bgCard: '#141829',
  bgElevated: '#1A1F35',
  bgGlass: 'rgba(20, 24, 41, 0.85)',
  accent: '#00E5C3',
  accentDim: 'rgba(0, 229, 195, 0.15)',
  accentGlow: 'rgba(0, 229, 195, 0.4)',
  secondary: '#FF8A50',
  secondaryDim: 'rgba(255, 138, 80, 0.15)',
  heart: '#FF4F8A',
  heartDim: 'rgba(255, 79, 138, 0.15)',
  textPrimary: '#F0F2FF',
  textSecondary: '#8B90B0',
  textMuted: '#4A4F6E',
  border: 'rgba(255, 255, 255, 0.06)',
  overlay: 'rgba(0, 0, 0, 0.6)',
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

export const LIGHT_COLORS = {
  bg: '#F5F6FA',
  bgCard: '#FFFFFF',
  bgElevated: '#EDF0F5',
  bgGlass: 'rgba(255, 255, 255, 0.9)',
  accent: '#00B89C',
  accentDim: 'rgba(0, 184, 156, 0.12)',
  accentGlow: 'rgba(0, 184, 156, 0.3)',
  secondary: '#E87040',
  secondaryDim: 'rgba(232, 112, 64, 0.12)',
  heart: '#E8457A',
  heartDim: 'rgba(232, 69, 122, 0.12)',
  textPrimary: '#1A1D2E',
  textSecondary: '#5C6080',
  textMuted: '#9598B0',
  border: 'rgba(0, 0, 0, 0.08)',
  overlay: 'rgba(0, 0, 0, 0.3)',
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

// 默认深色
export let COLORS = { ...DARK_COLORS };

export function setThemeColors(mode: 'dark' | 'light') {
  const src = mode === 'light' ? LIGHT_COLORS : DARK_COLORS;
  Object.assign(COLORS, src);
}

export const SIZES = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 36,
  radius: 12,
  radiusLg: 20,
  radiusXl: 28,
  miniPlayerHeight: 72,
  tabBarHeight: 60,
};

export const SUPPORTED_FORMATS = ['.mp3', '.flac', '.m4a', '.wav', '.ogg'];
