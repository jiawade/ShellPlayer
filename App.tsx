// App.tsx
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, StatusBar, Modal, ActivityIndicator, Text } from 'react-native';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';

import { store, useAppSelector, useAppDispatch } from './src/store';
import { loadUserPrefs, loadPlayHistory } from './src/store/musicSlice';
import AllSongsScreen from './src/screens/AllSongsScreen';
import FavoritesScreen from './src/screens/FavoritesScreen';
import BrowseScreen from './src/screens/BrowseScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import FullPlayerScreen from './src/screens/FullPlayerScreen';
import MiniPlayer from './src/components/MiniPlayer';
import { setupPlayer } from './src/utils/playerSetup';
import { initEqualizer } from './src/utils/equalizer';
import { COLORS, SIZES } from './src/utils/theme';

const Tab = createBottomTabNavigator();

function MainApp() {
  const dispatch = useAppDispatch();
  const { currentTrack, showFullPlayer } = useAppSelector(s => s.music);

  useEffect(() => {
    dispatch(loadUserPrefs());
    dispatch(loadPlayHistory());
  }, [dispatch]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <NavigationContainer
        theme={{
          dark: true,
          colors: { primary: COLORS.accent, background: COLORS.bg, card: COLORS.bgCard, text: COLORS.textPrimary, border: COLORS.border, notification: COLORS.accent },
        }}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarStyle: { backgroundColor: COLORS.bgElevated, borderTopColor: COLORS.border, height: SIZES.tabBarHeight, paddingBottom: 6, paddingTop: 4 },
            tabBarActiveTintColor: COLORS.accent,
            tabBarInactiveTintColor: COLORS.textMuted,
            tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
            tabBarIcon: ({ color, size }: { color: string; size: number }) => {
              const icons: Record<string, string> = {
                AllSongs: 'musical-notes', Browse: 'albums', Favorites: 'heart',
                History: 'time', Settings: 'settings',
              };
              return <Icon name={icons[route.name] || 'ellipse'} size={size - 2} color={color} />;
            },
          })}>
          <Tab.Screen name="AllSongs" component={AllSongsScreen} options={{ tabBarLabel: '歌曲' }} />
          <Tab.Screen name="Browse" component={BrowseScreen} options={{ tabBarLabel: '浏览' }} />
          <Tab.Screen name="Favorites" component={FavoritesScreen} options={{ tabBarLabel: '喜欢' }} />
          <Tab.Screen name="History" component={HistoryScreen} options={{ tabBarLabel: '历史' }} />
          <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: '设置' }} />
        </Tab.Navigator>
      </NavigationContainer>
      {currentTrack && !showFullPlayer && <MiniPlayer />}
      <Modal visible={showFullPlayer} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent>
        <FullPlayerScreen />
      </Modal>
    </View>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    (async () => {
      const ok = await setupPlayer();
      if (ok) {
        // 初始化均衡器并恢复上次的音效设置
        await initEqualizer();
      }
      setReady(ok);
    })();
  }, []);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadTxt}>初始化播放器...</Text>
      </View>
    );
  }
  return <Provider store={store}><MainApp /></Provider>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  loading: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  loadTxt: { color: COLORS.textSecondary, fontSize: SIZES.md, marginTop: 16 },
});
