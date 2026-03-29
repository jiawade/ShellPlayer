// App.tsx
import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, StatusBar, Text, NativeModules, Platform, Appearance, Animated } from 'react-native';

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
import ImportSongsScreen from './src/screens/ImportSongsScreen';
import WifiTransferScreen from './src/screens/WifiTransferScreen';
import MiniPlayer from './src/components/MiniPlayer';
import { setupPlayer } from './src/utils/playerSetup';
import { initEqualizer } from './src/utils/equalizer';
import { ensureDefaultDirs } from './src/utils/defaultDirs';
import { initIAP } from './src/utils/iap';
import { checkAndPromptReview } from './src/utils/reviewPrompt';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { DARK_COLORS, LIGHT_COLORS, SIZES } from './src/utils/theme';

// Synchronous: read once at module load to match native splash background
const _sysIsDark = Appearance.getColorScheme() !== 'light';
const _loadingColors = _sysIsDark ? DARK_COLORS : LIGHT_COLORS;

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
  const { currentTrack, showFullPlayer, playbackErrorMsg } = useAppSelector(s => s.music);
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
      {!!playbackErrorMsg && (
        <View style={{ position: 'absolute', top: 80, left: 20, right: 20, backgroundColor: colors.bgElevated, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, borderWidth: 1, borderColor: colors.border, zIndex: 9999 }}>
          <Icon name="warning-outline" size={20} color={colors.secondary} />
          <Text style={{ flex: 1, fontSize: 13, color: colors.textPrimary }} numberOfLines={2}>{playbackErrorMsg}</Text>
        </View>
      )}
    </View>
  );
}

function MainApp() {
  const dispatch = useAppDispatch();
  const { colors, isDark } = useTheme();

  useEffect(() => {
    // loadUserPrefs already dispatched in App() setup phase
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
              animation: Platform.OS === 'android' ? 'fade' : 'slide_from_right',
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
          <RootStack.Screen
            name="ImportSongs"
            component={ImportSongsScreen}
            options={{
              gestureEnabled: true,
              animation: 'slide_from_right',
            }}
          />
          <RootStack.Screen
            name="WifiTransfer"
            component={WifiTransferScreen}
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
  const [showOnBoarding, setShowOnBoarding] = useState(false);
  const fadeAnim = useRef(new Animated.Value(Platform.OS === 'android' ? 1 : 0)).current;

  useEffect(() => {
    (async () => {
      // Load user prefs early so theme is correct on first MainApp render
      const [ok, onboardingDone, , prefsResult] = await Promise.all([
        setupPlayer(),
        AsyncStorage.getItem('@onboarding_done'),
        ensureDefaultDirs(),
        store.dispatch(loadUserPrefs()),
      ]);
      // Apply language from loaded prefs
      const lang = (prefsResult as any)?.payload?.language;
      if (lang) {
        i18n.changeLanguage(lang);
      } else {
        const deviceLang = getDeviceLanguage();
        if (i18n.language !== deviceLang) {
          i18n.changeLanguage(deviceLang);
        }
      }
      if (ok) {
        initEqualizer(); // fire-and-forget, non-blocking
      }
      if (!onboardingDone) {
        setShowOnBoarding(true);
      }
      setReady(ok as boolean);
      // Avoid launch-window layering artifact on Android startup.
      if (Platform.OS !== 'android') {
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }).start();
      }
    })();
  }, [fadeAnim]);

  if (!ready) {
    return (
      <View style={[styles.loading, { backgroundColor: _loadingColors.bg }]}>
        <StatusBar barStyle={_sysIsDark ? 'light-content' : 'dark-content'} backgroundColor={_loadingColors.bg} />
      </View>
    );
  }

  if (showOnBoarding) {
    return <OnboardingScreen onDone={() => setShowOnBoarding(false)} />;
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Provider store={store}>
        <ThemeProvider>
          <MainApp />
        </ThemeProvider>
      </Provider>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1 },
});
