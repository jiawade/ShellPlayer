// src/utils/theme.ts

export const COLORS = {
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

export const SCAN_DIRECTORIES = [
  '/storage/emulated/0/Music',
  '/storage/emulated/0/Download',
  '/storage/emulated/0/DCIM/Music',
  '/storage/emulated/0/netease/cloudmusic/Music',
  '/storage/emulated/0/qqmusic/song',
  '/storage/emulated/0/kugou/download',
];

export const SUPPORTED_FORMATS = ['.mp3', '.flac', '.m4a', '.wav', '.ogg'];
