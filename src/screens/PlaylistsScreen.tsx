import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, TextInput, Modal, Pressable,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useAppSelector, useAppDispatch } from '../store';
import { loadPlaylists, createPlaylist } from '../store/playlistSlice';
import { useTheme } from '../contexts/ThemeContext';
import { Playlist } from '../types';

const PlaylistsScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<any>();
  const { playlists } = useAppSelector(s => s.playlist);
  const { tracks } = useAppSelector(s => s.music);
  const { colors, sizes } = useTheme();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    dispatch(loadPlaylists());
  }, [dispatch]);

  const handleCreate = useCallback(() => {
    const name = newName.trim();
    if (!name) {
      Alert.alert('提示', '请输入歌单名称');
      return;
    }
    dispatch(createPlaylist(name));
    setNewName('');
    setShowCreate(false);
  }, [dispatch, newName]);

  const handleOpen = useCallback((pl: Playlist) => {
    navigation.navigate('PlaylistDetail', { playlistId: pl.id });
  }, [navigation]);

  const renderItem = useCallback(({ item }: { item: Playlist }) => {
    const count = item.trackIds.length;
    const firstTrack = count > 0 ? tracks.find(t => t.id === item.trackIds[0]) : null;
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
        onPress={() => handleOpen(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.cardCover, { backgroundColor: colors.bgElevated }]}>
          {firstTrack?.artwork ? (
            <View style={styles.cardCoverInner}>
              <Icon name="musical-notes" size={32} color={colors.accent} />
            </View>
          ) : (
            <Icon name="musical-notes" size={32} color={colors.textMuted} />
          )}
        </View>
        <Text style={[styles.cardName, { color: colors.textPrimary }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[styles.cardCount, { color: colors.textMuted }]}>{count} 首</Text>
      </TouchableOpacity>
    );
  }, [tracks, colors, handleOpen]);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>歌单</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)} hitSlop={8} style={styles.addBtn}>
          <Icon name="add-circle-outline" size={26} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {playlists.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.bgCard }]}>
            <Icon name="albums-outline" size={64} color={colors.textMuted} />
          </View>
          <Text style={{ fontSize: sizes.xl, fontWeight: '600', color: colors.textSecondary, marginTop: 4 }}>
            还没有歌单
          </Text>
          <Text style={{ fontSize: sizes.md, color: colors.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 22 }}>
            点击右上角 + 创建你的第一个歌单
          </Text>
          <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: colors.accent }]}
            onPress={() => setShowCreate(true)}
          >
            <Icon name="add" size={20} color={colors.bg} />
            <Text style={{ fontSize: sizes.md, fontWeight: '700', color: colors.bg }}>新建歌单</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={playlists}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={() => setShowCreate(false)}>
          <Pressable style={[styles.dialog, { backgroundColor: colors.bgElevated }]} onPress={() => {}}>
            <Text style={{ fontSize: sizes.xl, fontWeight: '700', color: colors.textPrimary, marginBottom: 16 }}>新建歌单</Text>
            <TextInput
              style={[styles.dialogInput, { backgroundColor: colors.bgCard, color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="歌单名称"
              placeholderTextColor={colors.textMuted}
              value={newName}
              onChangeText={setNewName}
              autoFocus
              maxLength={30}
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />
            <View style={styles.dialogBtns}>
              <TouchableOpacity
                style={[styles.dialogBtn, { backgroundColor: colors.bgCard }]}
                onPress={() => { setShowCreate(false); setNewName(''); }}
              >
                <Text style={{ fontSize: sizes.md, color: colors.textSecondary, fontWeight: '600' }}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogBtn, { backgroundColor: colors.accent }]}
                onPress={handleCreate}
              >
                <Text style={{ fontSize: sizes.md, color: colors.bg, fontWeight: '600' }}>创建</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12,
  },
  title: { fontSize: 36, fontWeight: '800', letterSpacing: -0.5 },
  addBtn: { padding: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: { width: 120, height: 120, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', marginTop: 24,
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, gap: 8,
  },
  grid: { paddingHorizontal: 16, paddingBottom: 140, paddingTop: 4 },
  gridRow: { gap: 12, marginBottom: 12 },
  card: {
    flex: 1, borderRadius: 16, padding: 12, borderWidth: 1, maxWidth: '50%',
  },
  cardCover: {
    width: '100%', aspectRatio: 1, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  cardCoverInner: {
    width: '100%', height: '100%', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  cardName: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  cardCount: { fontSize: 12 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  dialog: { width: '80%', borderRadius: 20, padding: 24 },
  dialogInput: {
    height: 44, borderRadius: 12, paddingHorizontal: 14,
    fontSize: 15, borderWidth: 1, marginBottom: 20,
  },
  dialogBtns: { flexDirection: 'row', gap: 12 },
  dialogBtn: {
    flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
});

export default PlaylistsScreen;
