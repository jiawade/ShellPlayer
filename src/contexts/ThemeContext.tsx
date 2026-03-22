// src/contexts/ThemeContext.tsx
import React, {createContext, useContext, useMemo} from 'react';
import {useColorScheme} from 'react-native';
import {useAppSelector} from '../store';
import {DARK_COLORS, LIGHT_COLORS, SIZES, generateThemeFromColor} from '../utils/theme';
import type {ThemeMode} from '../types';

export type ThemeColors = typeof DARK_COLORS;

interface ThemeContextValue {
  colors: ThemeColors;
  sizes: typeof SIZES;
  themeMode: ThemeMode;
  isDark: boolean;
  customAccent: string | null;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: DARK_COLORS,
  sizes: SIZES,
  themeMode: 'system',
  isDark: true,
  customAccent: null,
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const themeMode = useAppSelector(s => s.music.themeMode);
  const customAccent = useAppSelector(s => s.music.customAccent);
  const systemScheme = useColorScheme();

  const value = useMemo<ThemeContextValue>(() => {
    const effectiveDark =
      themeMode === 'system'
        ? systemScheme !== 'light'
        : themeMode === 'dark';

    let colors: ThemeColors;
    if (customAccent) {
      colors = generateThemeFromColor(customAccent, effectiveDark);
    } else {
      colors = effectiveDark ? DARK_COLORS : LIGHT_COLORS;
    }

    return {
      colors,
      sizes: SIZES,
      themeMode,
      isDark: effectiveDark,
      customAccent,
    };
  }, [themeMode, systemScheme, customAccent]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export default ThemeContext;
