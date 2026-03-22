// src/components/BatteryOptimizationGuide.tsx
import React, {memo, useState} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView, Platform, Linking} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {useTheme} from '../contexts/ThemeContext';
import {useTranslation} from 'react-i18next';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const BatteryOptimizationGuide: React.FC<Props> = ({visible, onClose}) => {
  const {colors, sizes} = useTheme();
  const {t} = useTranslation();

  if (Platform.OS !== 'android') return null;

  const openBatterySettings = () => {
    Linking.openSettings().catch(() => {});
  };

  const steps = [
    t('battery.step1'),
    t('battery.step2'),
    t('battery.step3'),
    t('battery.step4'),
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.overlay, {backgroundColor: colors.overlay}]} onPress={onClose}>
        <Pressable style={[styles.sheet, {backgroundColor: colors.bgElevated}]} onPress={() => {}}>
          <View style={[styles.header, {borderBottomColor: colors.border}]}>
            <Text style={[styles.title, {color: colors.textPrimary}]}>{t('battery.title')}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Icon name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={[styles.warningCard, {backgroundColor: colors.secondaryDim}]}>
              <Icon name="warning-outline" size={20} color={colors.secondary} />
              <Text style={[styles.warningText, {color: colors.secondary}]}>{t('battery.warning')}</Text>
            </View>
            {steps.map((step, i) => (
              <View key={i} style={[styles.stepRow, {borderBottomColor: colors.border}]}>
                <View style={[styles.stepNum, {backgroundColor: colors.accentDim}]}>
                  <Text style={[styles.stepNumText, {color: colors.accent}]}>{i + 1}</Text>
                </View>
                <Text style={[styles.stepText, {color: colors.textPrimary}]}>{step}</Text>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.settingsBtn, {backgroundColor: colors.accent}]}
              activeOpacity={0.8}
              onPress={openBatterySettings}>
              <Icon name="settings-outline" size={18} color={colors.bg} />
              <Text style={[styles.settingsBtnText, {color: colors.bg}]}>{t('battery.openSettings')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {flex: 1, justifyContent: 'flex-end'},
  sheet: {borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', paddingBottom: 40},
  header: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1},
  title: {fontSize: 18, fontWeight: '700'},
  content: {paddingHorizontal: 20, paddingTop: 16},
  warningCard: {flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, marginBottom: 16},
  warningText: {flex: 1, fontSize: 13, lineHeight: 18},
  stepRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth},
  stepNum: {width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center'},
  stepNumText: {fontSize: 14, fontWeight: '700'},
  stepText: {flex: 1, fontSize: 14, lineHeight: 22},
  settingsBtn: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, marginTop: 20},
  settingsBtnText: {fontSize: 15, fontWeight: '600'},
});

export default memo(BatteryOptimizationGuide);
