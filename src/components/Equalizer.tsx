// src/components/Equalizer.tsx
import React, { memo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Pressable } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { applyEQPreset, getSavedPresetId } from '../utils/equalizer';
import { COLORS, SIZES } from '../utils/theme';

const EQ_PRESETS = [
  { id: 0, name: '关闭', icon: 'ban-outline', desc: '原始音效' },
  { id: 1, name: '3D丽音', icon: 'globe-outline', desc: '立体环绕声场' },
  { id: 2, name: '爵士', icon: 'wine-outline', desc: '温暖中频增强' },
  { id: 3, name: '流行', icon: 'star-outline', desc: '人声突出' },
  { id: 4, name: '摇滚', icon: 'flash-outline', desc: '低高音增强' },
  { id: 5, name: '古典', icon: 'musical-note-outline', desc: '宽广动态' },
  { id: 6, name: '嘻哈', icon: 'mic-outline', desc: '重低音增强' },
  { id: 7, name: '电子', icon: 'pulse-outline', desc: '低+高频提升' },
  { id: 8, name: 'R&B', icon: 'heart-outline', desc: '柔和中低频' },
  { id: 9, name: '人声', icon: 'person-outline', desc: '人声频段增强' },
  { id: 10, name: '重低音', icon: 'volume-high-outline', desc: '极致低频' },
  { id: 11, name: '现场', icon: 'people-outline', desc: '模拟现场效果' },
];

interface Props { visible: boolean; onClose: () => void; }

const Equalizer: React.FC<Props> = ({ visible, onClose }) => {
  const [active, setActive] = useState(0);
  const [applying, setApplying] = useState(false);

  // 加载已保存的预设
  useEffect(() => {
    if (visible) {
      getSavedPresetId().then(id => setActive(id));
    }
  }, [visible]);

  const handleSelect = async (id: number) => {
    setActive(id); // 立即 UI 反馈
    setApplying(true);
    await applyEQPreset(id);
    setApplying(false);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>音效模式</Text>
            {applying && <Text style={styles.applyingTxt}>应用中...</Text>}
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Icon name="close" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
            {EQ_PRESETS.map(p => {
              const on = active === p.id;
              return (
                <TouchableOpacity key={p.id} style={[styles.card, on && styles.cardOn]} onPress={() => handleSelect(p.id)} activeOpacity={0.7}>
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
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.bgElevated, borderTopLeftRadius: SIZES.radiusXl, borderTopRightRadius: SIZES.radiusXl, paddingTop: 16, paddingBottom: 34, maxHeight: '75%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
  title: { fontSize: SIZES.xl, fontWeight: '700', color: COLORS.textPrimary, flex: 1 },
  applyingTxt: { fontSize: SIZES.xs, color: COLORS.accent, marginRight: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 10 },
  card: { width: '30%', minWidth: 100, backgroundColor: COLORS.bgCard, borderRadius: SIZES.radius, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, position: 'relative' },
  cardOn: { borderColor: COLORS.accent, backgroundColor: COLORS.accentDim },
  iconW: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.bgElevated, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  iconWOn: { backgroundColor: COLORS.accent },
  cardName: { fontSize: SIZES.md, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 4 },
  cardDesc: { fontSize: 10, color: COLORS.textMuted, textAlign: 'center' },
  badge: { position: 'absolute', top: 8, right: 8 },
});

export default memo(Equalizer);
