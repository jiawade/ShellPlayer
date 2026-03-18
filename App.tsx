// App.tsx
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, StatusBar, ActivityIndicator, Text, NativeModules } from 'react-native';

NativeModules.DevLoadingView?.hide?.();
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';

import { store, useAppSelector, useAppDispatch } from './src/store';
import { loadUserPrefs, loadPlayHistory } from './src/store/musicSlice';
import AllSongsScreen from './src/screens/AllSongsScreen';
import FavoritesScreen from './src/screens/FavoritesScreen';
import PlaylistsScreen from './src/screens/PlaylistsScreen';
import PlaylistDetailScreen from './src/screens/PlaylistDetailScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import FullPlayerScreen from './src/screens/FullPlayerScreen';
import MiniPlayer from './src/components/MiniPlayer';
import { setupPlayer } from './src/utils/playerSetup';
import { initEqualizer } from './src/utils/equalizer';
import { ensureDefaultDirs } from './src/utils/defaultDirs';
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
        <Tab.Screen name="AllSongs" component={AllSongsScreen} options={{ tabBarLabel: '歌曲' }} />
        <Tab.Screen name="Playlists" component={PlaylistStackScreen} options={{ tabBarLabel: '歌单' }} />
        <Tab.Screen name="Favorites" component={FavoritesScreen} options={{ tabBarLabel: '喜欢' }} />
        <Tab.Screen name="History" component={HistoryScreen} options={{ tabBarLabel: '历史' }} />
        <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: '设置' }} />
      </Tab.Navigator>
      {currentTrack && !showFullPlayer && <MiniPlayer />}
    </View>
  );
}

function MainApp() {
  const dispatch = useAppDispatch();
  const { colors, isDark } = useTheme();

  useEffect(() => {
    dispatch(loadUserPrefs());
    dispatch(loadPlayHistory());
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
            name="FullPlayer"
            component={FullPlayerScreen}
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
  useEffect(() => {
    (async () => {
      const ok = await setupPlayer();
      if (ok) {
        await initEqualizer();
      }
      await ensureDefaultDirs();
      setReady(ok);
    })();
  }, []);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <StatusBar barStyle="light-content" backgroundColor={DARK_COLORS.bg} />
        <ActivityIndicator size="large" color={DARK_COLORS.accent} />
        <Text style={styles.loadTxt}>初始化播放器...</Text>
      </View>
    );
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
