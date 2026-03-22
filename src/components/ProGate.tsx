// src/components/ProGate.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useAppSelector } from '../store';
import { useTheme } from '../contexts/ThemeContext';

interface ProGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  compact?: boolean;
}

export default function ProGate({ children, fallback, compact }: ProGateProps) {
  const isPro = useAppSelector(s => s.pro.isPro);
  if (isPro) return <>{children}</>;
  if (fallback) return <>{fallback}</>;
  return compact ? <ProBadge /> : <UpgradePrompt />;
}

function ProBadge() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  return (
    <TouchableOpacity
      style={[styles.badge, { backgroundColor: colors.accentDim }]}
      onPress={() => navigation.navigate('Pro')}>
      <Icon name="lock-closed" size={10} color={colors.accent} />
      <Text style={[styles.badgeText, { color: colors.accent }]}>PRO</Text>
    </TouchableOpacity>
  );
}

function UpgradePrompt() {
  const { t } = useTranslation();
  const { colors, sizes } = useTheme();
  const navigation = useNavigation<any>();
  return (
    <View style={[styles.prompt, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <Icon name="lock-closed-outline" size={28} color={colors.accent} />
      <Text style={[styles.promptTitle, { color: colors.textPrimary, fontSize: sizes.lg }]}>
        {t('pro.title')}
      </Text>
      <TouchableOpacity
        style={[styles.promptBtn, { backgroundColor: colors.accent }]}
        onPress={() => navigation.navigate('Pro')}>
        <Text style={[styles.promptBtnText, { color: colors.black }]}>{t('pro.purchase')}</Text>
      </TouchableOpacity>
    </View>
  );
}

export { ProBadge };

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  prompt: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  promptTitle: {
    fontWeight: '600',
  },
  promptBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 4,
  },
  promptBtnText: {
    fontWeight: '700',
    fontSize: 14,
  },
});
