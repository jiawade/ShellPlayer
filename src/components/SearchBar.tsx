// src/components/SearchBar.tsx
import React, { memo, useRef, useEffect, useCallback } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

const SearchBar: React.FC<Props> = ({ value, onChangeText, placeholder = '搜索歌曲、歌手...' }) => {
  const { colors, sizes } = useTheme();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const handleChange = useCallback((text: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (text.length === 0) {
      onChangeText(text);
    } else {
      timerRef.current = setTimeout(() => onChangeText(text), 300);
    }
  }, [onChangeText]);

  const handleClear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onChangeText('');
  }, [onChangeText]);

  return (
    <View style={[styles.container, {
      backgroundColor: colors.bgElevated,
      borderColor: colors.border,
    }]}>
      <Icon name="search-outline" size={18} color={colors.textMuted} style={styles.icon} />
      <TextInput
        style={[styles.input, { fontSize: sizes.md, color: colors.textPrimary }]}
        defaultValue={value}
        onChangeText={handleChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="never"
        returnKeyType="search"
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={handleClear} style={styles.clearBtn} hitSlop={8}>
          <Icon name="close-circle" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginVertical: 8, paddingHorizontal: 14,
    height: 42, borderRadius: 21, borderWidth: 1,
  },
  icon: { marginRight: 8 },
  input: { flex: 1, padding: 0 },
  clearBtn: { marginLeft: 8 },
});

export default memo(SearchBar);
