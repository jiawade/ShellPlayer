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

export const SUPPORTED_FORMATS = ['.mp3', '.flac', '.m4a', '.wav', '.ogg', '.aac', '.wma', '.aiff', '.alac', '.opus', '.ape', '.webm'];

// Known encrypted / proprietary formats that cannot be decoded
export const UNSUPPORTED_FORMATS = ['.kgg', '.kgm', '.ncm', '.qmc', '.qmc0', '.qmc3', '.qmcflac', '.mflac', '.mgg', '.mgg1', '.tm0', '.tm3', '.tm6', '.vpr', '.tkm', '.bkcmp3', '.bkcflac', '.joox'];

// --- Preset Themes ---

export interface PresetTheme {
  key: string;
  accent: string;
}

export const PRESET_THEMES: PresetTheme[] = [
  { key: 'default', accent: '#00E5C3' },
  { key: 'ocean', accent: '#3B82F6' },
  { key: 'forest', accent: '#22C55E' },
  { key: 'sunset', accent: '#F59E0B' },
  { key: 'rose', accent: '#EC4899' },
  { key: 'midnight', accent: '#8B5CF6' },
  { key: 'crimson', accent: '#EF4444' },
  { key: 'gold', accent: '#EAB308' },
];

const hexToRgb = (hex: string): {r: number; g: number; b: number} => {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
};

const darken = (hex: string, amount: number): string => {
  const { r, g, b } = hexToRgb(hex);
  const f = 1 - amount;
  const nr = Math.round(r * f);
  const ng = Math.round(g * f);
  const nb = Math.round(b * f);
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
};

export const generateThemeFromColor = (
  primary: string,
  isDark: boolean,
): typeof DARK_COLORS => {
  const { r, g, b } = hexToRgb(primary);

  if (isDark) {
    return {
      bg: darken(primary, 0.92),
      bgCard: darken(primary, 0.88),
      bgElevated: darken(primary, 0.84),
      bgGlass: `rgba(${Math.round(r * 0.12)}, ${Math.round(g * 0.12)}, ${Math.round(b * 0.12)}, 0.85)`,
      accent: primary,
      accentDim: `rgba(${r}, ${g}, ${b}, 0.15)`,
      accentGlow: `rgba(${r}, ${g}, ${b}, 0.4)`,
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
  }

  return {
    bg: '#F5F6FA',
    bgCard: '#FFFFFF',
    bgElevated: '#EDF0F5',
    bgGlass: 'rgba(255, 255, 255, 0.9)',
    accent: primary,
    accentDim: `rgba(${r}, ${g}, ${b}, 0.12)`,
    accentGlow: `rgba(${r}, ${g}, ${b}, 0.3)`,
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
};
