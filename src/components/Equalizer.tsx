// src/components/Equalizer.tsx
import React, { memo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Pressable } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { applyEQPreset, getSavedPresetId } from '../utils/equalizer';
import { useTheme } from '../contexts/ThemeContext';

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
  const { colors, sizes } = useTheme();
  const [active, setActive] = useState(0);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (visible) {
      getSavedPresetId().then(id => setActive(id));
    }
  }, [visible]);

  const handleSelect = async (id: number) => {
    setActive(id);
    setApplying(true);
    await applyEQPreset(id);
    setApplying(false);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.bgElevated }]} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={{ fontSize: sizes.xl, fontWeight: '700', color: colors.textPrimary, flex: 1 }}>音效模式</Text>
            {applying && <Text style={{ fontSize: sizes.xs, color: colors.accent, marginRight: 12 }}>应用中...</Text>}
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Icon name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
            {EQ_PRESETS.map(p => {
              const on = active === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.card, {
                    backgroundColor: on ? colors.accentDim : colors.bgCard,
                    borderColor: on ? colors.accent : colors.border,
                  }]}
                  onPress={() => handleSelect(p.id)}
                  activeOpacity={0.7}>
                  <View style={[styles.iconW, {
                    backgroundColor: on ? colors.accent : colors.bgElevated,
                  }]}>
                    <Icon name={p.icon} size={24} color={on ? colors.bg : colors.textSecondary} />
                  </View>
                  <Text style={{ fontSize: sizes.md, fontWeight: '600', color: on ? colors.accent : colors.textPrimary, marginBottom: 4 }}>{p.name}</Text>
                  <Text style={{ fontSize: 10, color: colors.textMuted, textAlign: 'center' }}>{p.desc}</Text>
                  {on && <View style={styles.badge}><Icon name="checkmark-circle" size={16} color={colors.accent} /></View>}
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
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 16, paddingBottom: 34, maxHeight: '75%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 10 },
  card: { width: '30%', minWidth: 100, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, position: 'relative' },
  iconW: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  badge: { position: 'absolute', top: 8, right: 8 },
});

export default memo(Equalizer);
