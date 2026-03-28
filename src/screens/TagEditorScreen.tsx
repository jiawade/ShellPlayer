// src/screens/TagEditorScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Track } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { useAppDispatch } from '../store';
import { updateTrackMetadata } from '../store/musicSlice';
import { updateTrackTags } from '../utils/tagWriter';

type ParamList = { TagEditor: { track: Track } };

const TagEditorScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'TagEditor'>>();
  const { track } = route.params;
  const { colors, sizes } = useTheme();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const [title, setTitle] = useState(track.title);
  const [artist, setArtist] = useState(track.artist);
  const [album, setAlbum] = useState(track.album);

  const handleSave = async () => {
    const changes: Partial<Pick<Track, 'title' | 'artist' | 'album'>> = {};
    if (title !== track.title) changes.title = title;
    if (artist !== track.artist) changes.artist = artist;
    if (album !== track.album) changes.album = album;

    if (Object.keys(changes).length === 0) {
      navigation.goBack();
      return;
    }

    try {
      const ok = await updateTrackTags(track.filePath, changes);
      if (ok === false) {
        // Tags written to memory only (file not writable)
        dispatch(updateTrackMetadata({ trackId: track.id, changes }));
        Alert.alert('', t('tagEditor.memoryOnly'));
        navigation.goBack();
        return;
      }
      dispatch(updateTrackMetadata({ trackId: track.id, changes }));
      Alert.alert('', t('tagEditor.saveSuccess'));
      navigation.goBack();
    } catch {
      Alert.alert('', t('tagEditor.saveFailed'));
    }
  };

  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.bgCard,
      color: colors.textPrimary,
      borderColor: colors.border,
      fontSize: sizes.md,
    },
  ];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Icon name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary, fontSize: sizes.lg }]}>
          {t('tagEditor.title')}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
        <Text style={[styles.label, { color: colors.textSecondary, fontSize: sizes.sm }]}>
          {t('tagEditor.titleField')}
        </Text>
        <TextInput
          style={inputStyle}
          value={title}
          onChangeText={setTitle}
          placeholderTextColor={colors.textMuted}
          returnKeyType="next"
        />

        <Text style={[styles.label, { color: colors.textSecondary, fontSize: sizes.sm }]}>
          {t('tagEditor.artistField')}
        </Text>
        <TextInput
          style={inputStyle}
          value={artist}
          onChangeText={setArtist}
          placeholderTextColor={colors.textMuted}
          returnKeyType="next"
        />

        <Text style={[styles.label, { color: colors.textSecondary, fontSize: sizes.sm }]}>
          {t('tagEditor.albumField')}
        </Text>
        <TextInput
          style={inputStyle}
          value={album}
          onChangeText={setAlbum}
          placeholderTextColor={colors.textMuted}
          returnKeyType="done"
        />

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.accent }]}
          onPress={handleSave}
          activeOpacity={0.7}>
          <Text style={[styles.saveBtnText, { fontSize: sizes.md }]}>{t('tagEditor.save')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontWeight: '700' },
  form: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  label: { marginBottom: 6, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
  },
  saveBtn: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700' },
});

export default TagEditorScreen;
