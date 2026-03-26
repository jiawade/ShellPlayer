// src/screens/ThemeEditorScreen.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {useAppDispatch, useAppSelector} from '../store';
import {setThemeMode, setCustomAccent} from '../store/musicSlice';
import {useTheme} from '../contexts/ThemeContext';
import {PRESET_THEMES} from '../utils/theme';
import type {ThemeMode} from '../types';

const ThemeEditorScreen: React.FC = () => {
  const navigation = useNavigation();
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const {colors} = useTheme();
  const themeMode = useAppSelector(s => s.music.themeMode);
  const customAccent = useAppSelector(s => s.music.customAccent);

  const activeAccent = customAccent ?? PRESET_THEMES[0].accent;

  const handleThemeToggle = (mode: ThemeMode) => {
    dispatch(setThemeMode(mode));
  };

  const handlePreset = (accent: string) => {
    // Default preset = null (use built-in colors)
    if (accent === PRESET_THEMES[0].accent) {
      dispatch(setCustomAccent(null));
    } else {
      dispatch(setCustomAccent(accent));
    }
  };

  const handleReset = () => {
    dispatch(setCustomAccent(null));
  };

  const appearanceModes: {mode: ThemeMode; icon: string; label: string}[] = [
    {mode: 'dark', icon: 'moon', label: t('themeEditor.dark')},
    {mode: 'light', icon: 'sunny', label: t('themeEditor.light')},
    {mode: 'system', icon: 'phone-portrait-outline', label: t('themeEditor.system')},
  ];

  return (
    <SafeAreaView style={[styles.root, {backgroundColor: colors.bg}]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, {color: colors.textPrimary}]}>
          {t('themeEditor.title')}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Appearance */}
        <View style={styles.section}>
          <Text style={[styles.secTitle, {color: colors.textMuted}]}>
            {t('themeEditor.appearance')}
          </Text>
          <View style={[styles.card, {backgroundColor: colors.bgCard, borderColor: colors.border}]}>
            <View style={styles.row}>
              {appearanceModes.map(({mode, icon, label}) => (
                <TouchableOpacity
                  key={mode}
                  style={[
                    styles.modeBtn,
                    {backgroundColor: colors.bgElevated},
                    themeMode === mode && {backgroundColor: colors.accent},
                  ]}
                  onPress={() => handleThemeToggle(mode)}>
                  <Icon
                    name={icon}
                    size={18}
                    color={themeMode === mode ? colors.bg : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.modeTxt,
                      {color: colors.textMuted},
                      themeMode === mode && {color: colors.bg},
                    ]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Presets */}
        <View style={styles.section}>
          <Text style={[styles.secTitle, {color: colors.textMuted}]}>
            {t('themeEditor.presets')}
          </Text>
          <View style={styles.grid}>
            {PRESET_THEMES.map(preset => {
              const isActive = preset.accent === activeAccent;
              return (
                <TouchableOpacity
                  key={preset.key}
                  style={[
                    styles.presetCard,
                    {
                      backgroundColor: colors.bgCard,
                      borderColor: isActive ? preset.accent : colors.border,
                      borderWidth: isActive ? 2 : 1,
                    },
                  ]}
                  onPress={() => handlePreset(preset.accent)}
                  activeOpacity={0.7}>
                  <View style={styles.presetInner}>
                    <View
                      style={[
                        styles.colorCircle,
                        {backgroundColor: preset.accent},
                      ]}>
                      {isActive && (
                        <Icon name="checkmark" size={16} color="#fff" />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.presetName,
                        {color: colors.textPrimary},
                        isActive && {color: preset.accent, fontWeight: '700'},
                      ]}>
                      {t(`themeEditor.preset_${preset.key}`)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Reset */}
        {customAccent && (
          <TouchableOpacity
            style={[styles.resetBtn, {backgroundColor: colors.accentDim}]}
            onPress={handleReset}>
            <Icon name="refresh-outline" size={18} color={colors.accent} />
            <Text style={[styles.resetTxt, {color: colors.accent}]}>
              {t('themeEditor.resetDefault')}
            </Text>
          </TouchableOpacity>
        )}

        <View style={{height: 80}} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  backBtn: {width: 40, alignItems: 'center'},
  headerTitle: {fontSize: 18, fontWeight: '700'},
  content: {paddingHorizontal: 20},
  section: {marginBottom: 28},
  secTitle: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  card: {borderRadius: 20, padding: 16, borderWidth: 1},
  row: {flexDirection: 'row', gap: 12},
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  modeTxt: {fontSize: 14, fontWeight: '600'},
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  presetCard: {
    width: '47%',
    borderRadius: 16,
    padding: 16,
  },
  presetInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetName: {fontSize: 14, fontWeight: '600'},
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 4,
  },
  resetTxt: {fontSize: 14, fontWeight: '600'},
});

export default ThemeEditorScreen;
