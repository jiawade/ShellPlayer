// src/utils/reviewPrompt.ts
import { Platform, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REVIEW_PREFS_KEY = '@review_prompt';
const MIN_DAYS = 3;
const MIN_PLAYS = 20;

interface ReviewPrefs {
  firstOpenDate: string;
  totalPlays: number;
  hasPrompted: boolean;
}

async function getPrefs(): Promise<ReviewPrefs> {
  try {
    const raw = await AsyncStorage.getItem(REVIEW_PREFS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const prefs: ReviewPrefs = {
    firstOpenDate: new Date().toISOString().slice(0, 10),
    totalPlays: 0,
    hasPrompted: false,
  };
  await AsyncStorage.setItem(REVIEW_PREFS_KEY, JSON.stringify(prefs));
  return prefs;
}

async function savePrefs(prefs: ReviewPrefs) {
  await AsyncStorage.setItem(REVIEW_PREFS_KEY, JSON.stringify(prefs));
}

export async function recordPlay() {
  const prefs = await getPrefs();
  prefs.totalPlays += 1;
  await savePrefs(prefs);
}

export async function checkAndPromptReview() {
  const prefs = await getPrefs();
  if (prefs.hasPrompted) return;

  const daysSinceFirst = Math.floor(
    (Date.now() - new Date(prefs.firstOpenDate).getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysSinceFirst >= MIN_DAYS && prefs.totalPlays >= MIN_PLAYS) {
    prefs.hasPrompted = true;
    await savePrefs(prefs);

    // Use native in-app review if available, fallback to store link
    try {
      if (Platform.OS === 'ios') {
        const StoreReview = require('react-native').default;
        // Try native requestReview
        if (StoreReview?.requestReview) {
          StoreReview.requestReview();
          return;
        }
      }
    } catch {}

    //TODO Fallback: show alert with store link
    Alert.alert(
      'Enjoying ShellPlayer?',
      'Please rate us on the store!',
      [
        { text: 'Later', style: 'cancel' },
        {
          text: 'Rate Now',
          onPress: () => {
            const storeUrl = Platform.select({
              ios: 'https://apps.apple.com/app/idXXXXXXXX', // Replace with actual ID
              android: 'market://details?id=com.musicplayer',
            });
            if (storeUrl) Linking.openURL(storeUrl).catch(() => {});
          },
        },
      ],
    );
  }
}
