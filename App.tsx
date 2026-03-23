// App.tsx
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, StatusBar, ActivityIndicator, Text, NativeModules } from 'react-native';

NativeModules.DevLoadingView?.hide?.();
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import './src/i18n';
import i18n, { getDeviceLanguage } from './src/i18n';
import { store, useAppSelector, useAppDispatch } from './src/store';
import { loadUserPrefs, loadPlayHistory } from './src/store/musicSlice';
import { loadProStatus } from './src/store/proSlice';
import { loadStats } from './src/store/statsSlice';
import AllSongsScreen from './src/screens/AllSongsScreen';
import FavoritesScreen from './src/screens/FavoritesScreen';
import PlaylistsScreen from './src/screens/PlaylistsScreen';
import PlaylistDetailScreen from './src/screens/PlaylistDetailScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import GeneralSettingsScreen from './src/screens/GeneralSettingsScreen';
import FullPlayerScreen from './src/screens/FullPlayerScreen';
import RhythmLightScreen from './src/screens/RhythmLightScreen';
import ProScreen from './src/screens/ProScreen';
import LicensesScreen from './src/screens/LicensesScreen';
import StatisticsScreen from './src/screens/StatisticsScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import CarModeScreen from './src/screens/CarModeScreen';
import ThemeEditorScreen from './src/screens/ThemeEditorScreen';
import TagEditorScreen from './src/screens/TagEditorScreen';
import MiniPlayer from './src/components/MiniPlayer';
import { setupPlayer } from './src/utils/playerSetup';
import { initEqualizer } from './src/utils/equalizer';
import { ensureDefaultDirs } from './src/utils/defaultDirs';
import { initIAP } from './src/utils/iap';
import { checkAndPromptReview } from './src/utils/reviewPrompt';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { DARK_COLORS, SIZES } from './src/utils/theme';

const Tab = createBottomTabNavigator();
const PlaylistStack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();

function PlaylistStackScreen() {
  return (
    <PlaylistStack.Navigator screenOptions={{ headerShown: false }}>
      <PlaylistStack.Screen name="PlaylistList" component={PlaylistsScreen} />
      <PlaylistStack.Screen name="PlaylistDetail" component={PlaylistDetailScreen} />
    </PlaylistStack.Navigator>
  );
}

function TabsWithMiniPlayer() {
  const { currentTrack, showFullPlayer } = useAppSelector(s => s.music);
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: { backgroundColor: colors.bgElevated, borderTopColor: colors.border, height: SIZES.tabBarHeight, paddingBottom: 6, paddingTop: 4 },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
          tabBarIcon: ({ color, size }: { color: string; size: number }) => {
            const icons: Record<string, string> = {
              AllSongs: 'musical-notes', Playlists: 'albums', Favorites: 'heart',
              History: 'time', Settings: 'settings',
            };
            return <Icon name={icons[route.name] || 'ellipse'} size={size - 2} color={color} />;
          },
        })}>
        <Tab.Screen name="AllSongs" component={AllSongsScreen} options={{ tabBarLabel: t('tabs.songs') }} />
        <Tab.Screen name="Playlists" component={PlaylistStackScreen} options={{ tabBarLabel: t('tabs.playlists') }} />
        <Tab.Screen name="Favorites" component={FavoritesScreen} options={{ tabBarLabel: t('tabs.favorites') }} />
        <Tab.Screen name="History" component={HistoryScreen} options={{ tabBarLabel: t('tabs.history') }} />
        <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: t('tabs.settings') }} />
      </Tab.Navigator>
      {currentTrack && !showFullPlayer && <MiniPlayer />}
    </View>
  );
}

function MainApp() {
  const dispatch = useAppDispatch();
  const { colors, isDark } = useTheme();

  useEffect(() => {
    dispatch(loadUserPrefs()).then((result: any) => {
      const lang = result.payload?.language;
      if (lang) {
        i18n.changeLanguage(lang);
      } else {
        // No saved preference — re-detect device language
        // (native bridge may not be ready at module-init time on iOS)
        const deviceLang = getDeviceLanguage();
        if (i18n.language !== deviceLang) {
          i18n.changeLanguage(deviceLang);
        }
      }
    });
    dispatch(loadPlayHistory());
    dispatch(loadProStatus());
    dispatch(loadStats());
    initIAP().catch(() => {});
    // Delay review prompt so it doesn't block startup
    setTimeout(() => checkAndPromptReview().catch(() => {}), 5000);
  }, [dispatch]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <NavigationContainer
        theme={{
          dark: isDark,
          colors: { primary: colors.accent, background: colors.bg, card: colors.bgCard, text: colors.textPrimary, border: colors.border, notification: colors.accent },
        }}>
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          <RootStack.Screen name="Main" component={TabsWithMiniPlayer} />
          <RootStack.Screen
            name="GeneralSettings"
            component={GeneralSettingsScreen}
            options={{
              gestureEnabled: true,
              animation: 'slide_from_right',
            }}
          />
          <RootStack.Screen
            name="FullPlayer"
            component={FullPlayerScreen}
            options={{
              gestureEnabled: true,
              animation: 'slide_from_right',
            }}
          />
          <RootStack.Screen
            name="RhythmLight"
            component={RhythmLightScreen}
            options={{
              gestureEnabled: true,
              animation: 'slide_from_right',
            }}
          />
          <RootStack.Screen
            name="Pro"
            component={ProScreen}
            options={{
              gestureEnabled: true,
              animation: 'slide_from_bottom',
            }}
          />
          <RootStack.Screen
            name="Licenses"
            component={LicensesScreen}
            options={{
              gestureEnabled: true,
              animation: 'slide_from_right',
            }}
          />
          <RootStack.Screen
            name="Statistics"
            component={StatisticsScreen}
            options={{
              gestureEnabled: true,
              animation: 'slide_from_right',
            }}
          />
          <RootStack.Screen
            name="CarMode"
            component={CarModeScreen}
            options={{
              gestureEnabled: true,
              animation: 'slide_from_bottom',
            }}
          />
          <RootStack.Screen
            name="ThemeEditor"
            component={ThemeEditorScreen}
            options={{
              gestureEnabled: true,
              animation: 'slide_from_right',
            }}
          />
          <RootStack.Screen
            name="TagEditor"
            component={TagEditorScreen}
            options={{
              gestureEnabled: true,
              animation: 'slide_from_right',
            }}
          />
        </RootStack.Navigator>
      </NavigationContainer>
    </View>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    (async () => {
      const [ok, onboardingDone] = await Promise.all([
        setupPlayer(),
        AsyncStorage.getItem('@onboarding_done'),
        ensureDefaultDirs(),
      ]);
      if (ok) {
        initEqualizer(); // fire-and-forget, non-blocking
      }
      if (!onboardingDone) {
        setShowOnboarding(true);
      }
      setReady(ok as boolean);
    })();
  }, []);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <StatusBar barStyle="light-content" backgroundColor={DARK_COLORS.bg} />
        <ActivityIndicator size="large" color={DARK_COLORS.accent} />
        <Text style={styles.loadTxt}>{t('loading.initPlayer')}</Text>
      </View>
    );
  }

  if (showOnboarding) {
    return <OnboardingScreen onDone={() => setShowOnboarding(false)} />;
  }

  return (
    <Provider store={store}>
      <ThemeProvider>
        <MainApp />
      </ThemeProvider>
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, backgroundColor: DARK_COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  loadTxt: { color: DARK_COLORS.textSecondary, fontSize: SIZES.md, marginTop: 16 },
});
