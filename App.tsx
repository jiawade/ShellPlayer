// App.tsx
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, StatusBar, Modal, ActivityIndicator, Text } from 'react-native';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';

import { store, useAppSelector } from './src/store';
import AllSongsScreen from './src/screens/AllSongsScreen';
import FavoritesScreen from './src/screens/FavoritesScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import FullPlayerScreen from './src/screens/FullPlayerScreen';
import MiniPlayer from './src/components/MiniPlayer';
import { setupPlayer } from './src/utils/playerSetup';
import { COLORS, SIZES } from './src/utils/theme';

const Tab = createBottomTabNavigator();

function MainApp() {
  const { currentTrack, showFullPlayer } = useAppSelector(s => s.music);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      <NavigationContainer
        theme={{
          dark: true,
          colors: {
            primary: COLORS.accent,
            background: COLORS.bg,
            card: COLORS.bgCard,
            text: COLORS.textPrimary,
            border: COLORS.border,
            notification: COLORS.accent,
          },
        }}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarStyle: {
              backgroundColor: COLORS.bgElevated,
              borderTopColor: COLORS.border,
              height: SIZES.tabBarHeight,
              paddingBottom: 8,
              paddingTop: 6,
            },
            tabBarActiveTintColor: COLORS.accent,
            tabBarInactiveTintColor: COLORS.textMuted,
            tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
            tabBarIcon: ({ color, size }: { color: string; size: number }) => {
              let iconName = 'musical-notes';
              if (route.name === 'Favorites') iconName = 'heart';
              if (route.name === 'Settings') iconName = 'settings';
              return <Icon name={iconName} size={size} color={color} />;
            },
          })}>
          <Tab.Screen name="AllSongs" component={AllSongsScreen} options={{ tabBarLabel: '全部歌曲' }} />
          <Tab.Screen name="Favorites" component={FavoritesScreen} options={{ tabBarLabel: '我喜欢的' }} />
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
    setupPlayer().then(ok => setReady(ok));
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

  return (
    <Provider store={store}>
      <MainApp />
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  loading: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  loadTxt: { color: COLORS.textSecondary, fontSize: SIZES.md, marginTop: 16 },
});
