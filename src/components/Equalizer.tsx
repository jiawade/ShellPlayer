// src/components/Equalizer.tsx
import React, { memo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS, SIZES } from '../utils/theme';

const EQ_PRESETS = [
  { id: 'off', name: '关闭', icon: 'ban-outline', desc: '原始音效' },
  { id: '3d', name: '3D丽音', icon: 'globe-outline', desc: '立体环绕声场' },
  { id: 'jazz', name: '爵士', icon: 'wine-outline', desc: '温暖中频增强' },
  { id: 'pop', name: '流行', icon: 'star-outline', desc: '人声突出，节奏感强' },
  { id: 'rock', name: '摇滚', icon: 'flash-outline', desc: '低音和高音增强' },
  { id: 'classical', name: '古典', icon: 'musical-note-outline', desc: '宽广动态范围' },
  { id: 'hiphop', name: '嘻哈', icon: 'mic-outline', desc: '重低音增强' },
  { id: 'electronic', name: '电子', icon: 'pulse-outline', desc: '低音和高频提升' },
  { id: 'rnb', name: 'R&B', icon: 'heart-outline', desc: '柔和中低频' },
  { id: 'vocal', name: '人声', icon: 'person-outline', desc: '人声频段增强' },
  { id: 'bass', name: '重低音', icon: 'volume-high-outline', desc: '极致低频' },
  { id: 'live', name: '现场', icon: 'people-outline', desc: '模拟现场效果' },
];

interface Props { visible: boolean; onClose: () => void; }

const Equalizer: React.FC<Props> = ({ visible, onClose }) => {
  const [active, setActive] = useState('off');
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.overlayBg} onPress={onClose} activeOpacity={1} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>音效模式</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Icon name="close" size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          {EQ_PRESETS.map(p => {
            const on = active === p.id;
            return (
              <TouchableOpacity key={p.id} style={[styles.card, on && styles.cardOn]} onPress={() => setActive(p.id)} activeOpacity={0.7}>
                <View style={[styles.iconW, on && styles.iconWOn]}>
                  <Icon name={p.icon} size={24} color={on ? COLORS.bg : COLORS.textSecondary} />
                </View>
                <Text style={[styles.cardName, on && { color: COLORS.accent }]}>{p.name}</Text>
                <Text style={styles.cardDesc}>{p.desc}</Text>
                {on && <View style={styles.badge}><Icon name="checkmark-circle" size={16} color={COLORS.accent} /></View>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <Text style={styles.note}>音效功能将在后续版本中通过 Android AudioEffect 完整实现</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' },
  overlayBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: COLORS.overlay },
  sheet: { backgroundColor: COLORS.bg, borderTopLeftRadius: SIZES.radiusXl, borderTopRightRadius: SIZES.radiusXl, paddingTop: 20, paddingBottom: 34, maxHeight: '75%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 16 },
  title: { fontSize: SIZES.xl, fontWeight: '700', color: COLORS.textPrimary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 10 },
  card: { width: '30%', minWidth: 100, backgroundColor: COLORS.bgCard, borderRadius: SIZES.radius, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, position: 'relative' },
  cardOn: { borderColor: COLORS.accent, backgroundColor: COLORS.accentDim },
  iconW: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.bgElevated, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  iconWOn: { backgroundColor: COLORS.accent },
  cardName: { fontSize: SIZES.md, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 4 },
  cardDesc: { fontSize: 10, color: COLORS.textMuted, textAlign: 'center' },
  badge: { position: 'absolute', top: 8, right: 8 },
  note: { fontSize: SIZES.xs, color: COLORS.textMuted, textAlign: 'center', paddingHorizontal: 20, marginTop: 16 },
});

export default memo(Equalizer);
