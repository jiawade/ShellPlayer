import React, { useState, useCallback, useMemo, useRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  Pressable,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import TrackItem from '../components/TrackItem';
import SearchBar from '../components/SearchBar';
import TrackMenu from '../components/TrackMenu';
import PlaylistCover from '../components/PlaylistCover';
import SwipeBackWrapper from '../components/SwipeBackWrapper';
import { useAppSelector, useAppDispatch } from '../store';
import {
  renamePlaylist,
  deletePlaylist,
  addTracksToPlaylist,
  removeTracksFromPlaylist,
} from '../store/playlistSlice';
import { playTrack, toggleFavorite } from '../store/musicSlice';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Track, SortMode } from '../types';
import { deduplicateTracks } from '../utils/dedup';
import AlphabetIndex from '../components/AlphabetIndex';
import { useAlphabetIndex } from '../hooks/useAlphabetIndex';
import LocatePlayingButton, { LocatePlayingRef } from '../components/LocatePlayingButton';
import { generateM3U, exportToFile } from '../utils/m3uParser';

const SORT_OPTIONS_KEYS: { mode: SortMode; labelKey: string; icon: string }[] = [
  { mode: 'title', labelKey: 'playlistDetail.sort.byName', icon: 'text-outline' },
  { mode: 'artist', labelKey: 'playlistDetail.sort.byArtist', icon: 'person-outline' },
];

const PlaylistDetailScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const playlistId: string = route.params?.playlistId;
  const { playlists } = useAppSelector(s => s.playlist);
  const { tracks, currentTrack, repeatMode, hideDuplicates } = useAppSelector(s => s.music);
  const { colors, sizes } = useTheme();
  const { t } = useTranslation();

  const playlist = playlists.find(p => p.id === playlistId);

  const playlistArtworks = useMemo(() => {
    if (!playlist) {
      return [];
    }
    const idToTrack = new Map(tracks.map(t => [t.id, t]));
    const arts: string[] = [];
    for (const id of playlist.trackIds) {
      const t = idToTrack.get(id);
      if (t?.artwork) {
        arts.push(t.artwork);
      }
      if (arts.length >= 9) {
        break;
      }
    }
    return arts;
  }, [playlist, tracks]);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('title');
  const [showSort, setShowSort] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [renameTxt, setRenameTxt] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [menuTrack, setMenuTrack] = useState<Track | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const locateRef = useRef<LocatePlayingRef>(null);

  // Base filtered tracks (without pinyin sort)
  const baseTracks = useMemo(() => {
    if (!playlist) {
      return [];
    }
    const idSet = new Set(playlist.trackIds);
    const list = tracks.filter(t => idSet.has(t.id));
    return hideDuplicates ? deduplicateTracks(list) : list;
  }, [playlist, tracks, hideDuplicates]);

  const {
    sortedTracks: pinyinSorted,
    letters,
    onSelectLetter,
    onIndexTouchStart,
    onIndexTouchEnd,
    onScroll: onAlphabetScroll,
  } = useAlphabetIndex(baseTracks, flatListRef);

  const playlistTracks = useMemo(() => {
    let list = sortMode === 'title' ? [...pinyinSorted] : [...baseTracks];
    if (sortMode === 'artist') {
      list.sort((a, b) => a.artist.localeCompare(b.artist, 'zh-CN'));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        t =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.fileName.toLowerCase().includes(q),
      );
    }
    return list;
  }, [baseTracks, pinyinSorted, sortMode, searchQuery]);

  const handlePlay = useCallback(
    (t: Track) => {
      dispatch(playTrack({ track: t, queue: playlistTracks, shuffle: repeatMode === 'queue' }));
    },
    [dispatch, playlistTracks, repeatMode],
  );

  const handlePlayAll = useCallback(() => {
    if (playlistTracks.length === 0) {
      return;
    }
    dispatch(playTrack({ track: playlistTracks[0], queue: playlistTracks }));
  }, [dispatch, playlistTracks]);

  const handleShuffleAll = useCallback(() => {
    if (playlistTracks.length === 0) {
      return;
    }
    const idx = Math.floor(Math.random() * playlistTracks.length);
    dispatch(playTrack({ track: playlistTracks[idx], queue: playlistTracks, shuffle: true }));
  }, [dispatch, playlistTracks]);

  const handleFav = useCallback(
    (id: string) => {
      dispatch(toggleFavorite(id));
    },
    [dispatch],
  );
  const handleOpenMenu = useCallback((t: Track) => {
    setMenuTrack(t);
    setShowMenu(true);
  }, []);

  const handleRename = useCallback(() => {
    const name = renameTxt.trim();
    if (!name) {
      Alert.alert(t('playlists.createAlert.title'), t('playlists.createAlert.message'));
      return;
    }
    dispatch(renamePlaylist({ id: playlistId, name }));
    setShowRename(false);
  }, [dispatch, playlistId, renameTxt]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      t('playlistDetail.deleteAlert.title'),
      t('playlistDetail.deleteAlert.message', { name: playlist?.name }),
      [
        { text: t('common.cancel') },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            dispatch(deletePlaylist(playlistId));
            navigation.goBack();
          },
        },
      ],
    );
  }, [dispatch, playlistId, playlist, navigation]);

  const handleRemoveTrack = useCallback(
    (trackId: string) => {
      Alert.alert(t('playlistDetail.removeTrack.title'), t('playlistDetail.removeTrack.message'), [
        { text: t('common.cancel') },
        {
          text: t('playlistDetail.removeTrack.confirm'),
          style: 'destructive',
          onPress: () => {
            dispatch(removeTracksFromPlaylist({ playlistId, trackIds: [trackId] }));
          },
        },
      ]);
    },
    [dispatch, playlistId],
  );

  const handleExportM3U = useCallback(async () => {
    if (playlistTracks.length === 0) {
      return;
    }
    try {
      const content = generateM3U(playlistTracks);
      const safeName = (playlist?.name || 'playlist').replace(/[^a-zA-Z0-9_\-\u4e00-\u9fff]/g, '_');
      const filePath = await exportToFile(content, safeName);
      Alert.alert(t('common.ok'), t('playlistDetail.exportSuccess', { path: filePath }));
    } catch {
      Alert.alert(t('common.hint'), t('playlistDetail.exportFailed'));
    }
  }, [playlistTracks, playlist, t]);

  const renderItem = useCallback(
    ({ item }: { item: Track }) => (
      <View style={styles.trackRow}>
        <View style={{ flex: 1 }}>
          <TrackItem
            track={item}
            isActive={currentTrack?.id === item.id}
            onPress={handlePlay}
            onToggleFavorite={handleFav}
            onOpenMenu={handleOpenMenu}
          />
        </View>
        <TouchableOpacity
          onPress={() => handleRemoveTrack(item.id)}
          style={styles.removeBtn}
          hitSlop={8}>
          <Icon name="remove-circle-outline" size={20} color={colors.secondary || '#EF4444'} />
        </TouchableOpacity>
      </View>
    ),
    [currentTrack?.id, handlePlay, handleFav, handleOpenMenu, handleRemoveTrack, colors],
  );

  if (!playlist) {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <Icon name="chevron-back" size={26} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text
            style={{
              flex: 1,
              fontSize: sizes.xl,
              fontWeight: '700',
              color: colors.textPrimary,
              marginLeft: 8,
            }}>
            {t('playlistDetail.notFound')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Icon name="chevron-back" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text
          style={{
            flex: 1,
            fontSize: sizes.xl,
            fontWeight: '700',
            color: colors.textPrimary,
            marginLeft: 8,
          }}
          numberOfLines={1}>
          {playlist.name}
        </Text>
        <TouchableOpacity
          onPress={() => {
            setRenameTxt(playlist.name);
            setShowRename(true);
          }}
          hitSlop={8}
          style={{ marginRight: 12 }}>
          <Icon name="create-outline" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete} hitSlop={8} style={{ marginRight: 12 }}>
          <Icon name="trash-outline" size={22} color={colors.secondary || '#EF4444'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleExportM3U} hitSlop={8} style={{ marginRight: 12 }}>
          <Icon name="download-outline" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowImport(true)} hitSlop={8}>
          <Icon name="add-circle-outline" size={22} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Playlist Cover */}
      {playlistArtworks.length > 0 && (
        <View style={styles.coverSection}>
          <PlaylistCover artworks={playlistArtworks} size={160} borderRadius={16} />
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.accent }]}
          onPress={handlePlayAll}>
          <Icon name="play" size={18} color={colors.bg} />
          <Text style={{ fontSize: sizes.sm, fontWeight: '600', color: colors.bg }}>
            {t('playlistDetail.playAll')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.actionBtn,
            { backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: 1 },
          ]}
          onPress={handleShuffleAll}>
          <Icon name="shuffle" size={18} color={colors.textPrimary} />
          <Text style={{ fontSize: sizes.sm, fontWeight: '600', color: colors.textPrimary }}>
            {t('playlistDetail.shuffleAll')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowSort(!showSort)}
          style={styles.sortToggle}
          hitSlop={8}>
          <Icon name="swap-vertical-outline" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {showSort && (
        <View style={styles.sortRow}>
          {SORT_OPTIONS_KEYS.map(o => (
            <TouchableOpacity
              key={o.mode}
              style={[
                styles.sortBtn,
                { backgroundColor: colors.bgCard },
                sortMode === o.mode && { backgroundColor: colors.accent },
              ]}
              onPress={() => {
                setSortMode(o.mode);
                setShowSort(false);
              }}>
              <Icon
                name={o.icon}
                size={14}
                color={sortMode === o.mode ? colors.bg : colors.textMuted}
              />
              <Text
                style={[
                  styles.sortTxt,
                  { color: colors.textMuted },
                  sortMode === o.mode && { color: colors.bg },
                ]}>
                {t(o.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={t('playlistDetail.searchPlaceholder')}
      />

      <Text
        style={{
          fontSize: sizes.sm,
          color: colors.textMuted,
          paddingHorizontal: 20,
          paddingBottom: 4,
        }}>
        {searchQuery
          ? t('playlistDetail.resultCount.found', { count: playlistTracks.length })
          : t('playlistDetail.resultCount.total', { count: playlist.trackIds.length })}
      </Text>

      {playlistTracks.length === 0 && !searchQuery ? (
        <View style={styles.emptyList}>
          <Icon name="musical-notes-outline" size={48} color={colors.textMuted} />
          <Text style={{ fontSize: sizes.md, color: colors.textMuted, marginTop: 12 }}>
            {t('playlistDetail.empty.empty')}
          </Text>
          <TouchableOpacity
            style={[styles.importBtnEmpty, { backgroundColor: colors.accent }]}
            onPress={() => setShowImport(true)}>
            <Icon name="add" size={18} color={colors.bg} />
            <Text style={{ fontSize: sizes.md, fontWeight: '600', color: colors.bg }}>
              {t('playlistDetail.empty.importButton')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <FlatList
            ref={flatListRef}
            data={playlistTracks}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingBottom: 140 }}
            showsVerticalScrollIndicator
            onScrollBeginDrag={() => {
              if (sortMode === 'title' && !searchQuery) {
                onAlphabetScroll();
              }
              locateRef.current?.show();
            }}
            initialNumToRender={20}
            maxToRenderPerBatch={15}
          />
          {sortMode === 'title' && !searchQuery && letters.length > 0 && (
            <AlphabetIndex
              letters={letters}
              visible={true}
              onSelectLetter={onSelectLetter}
              onTouchStart={onIndexTouchStart}
              onTouchEnd={onIndexTouchEnd}
            />
          )}
          <LocatePlayingButton
            ref={locateRef}
            flatListRef={flatListRef}
            tracks={playlistTracks}
            currentTrack={currentTrack}
          />
        </View>
      )}

      {/* Rename Modal */}
      <Modal
        visible={showRename}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRename(false)}>
        <Pressable
          style={[styles.overlay, { backgroundColor: colors.overlay }]}
          onPress={() => setShowRename(false)}>
          <Pressable
            style={[styles.dialog, { backgroundColor: colors.bgElevated }]}
            onPress={() => {}}>
            <Text
              style={{
                fontSize: sizes.xl,
                fontWeight: '700',
                color: colors.textPrimary,
                marginBottom: 16,
              }}>
              {t('playlistDetail.renameDialog.title')}
            </Text>
            <TextInput
              style={[
                styles.dialogInput,
                {
                  backgroundColor: colors.bgCard,
                  color: colors.textPrimary,
                  borderColor: colors.border,
                },
              ]}
              value={renameTxt}
              onChangeText={setRenameTxt}
              autoFocus
              maxLength={30}
              returnKeyType="done"
              onSubmitEditing={handleRename}
            />
            <View style={styles.dialogBtns}>
              <TouchableOpacity
                style={[styles.dialogBtn, { backgroundColor: colors.bgCard }]}
                onPress={() => setShowRename(false)}>
                <Text
                  style={{ fontSize: sizes.md, color: colors.textSecondary, fontWeight: '600' }}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogBtn, { backgroundColor: colors.accent }]}
                onPress={handleRename}>
                <Text style={{ fontSize: sizes.md, color: colors.bg, fontWeight: '600' }}>
                  {t('common.confirm')}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Import Songs Modal */}
      <ImportSongsModal
        visible={showImport}
        onClose={() => setShowImport(false)}
        playlistId={playlistId}
        existingTrackIds={playlist.trackIds}
      />

      <TrackMenu
        track={menuTrack}
        visible={showMenu}
        onClose={() => {
          setShowMenu(false);
          setMenuTrack(null);
        }}
      />
    </View>
  );
};

// ---- Import Row (memoized to prevent re-render on sibling selection changes) ----
interface ImportRowProps {
  item: Track;
  isSelected: boolean;
  isExisting: boolean;
  onToggle: (id: string) => void;
  colors: any;
  sizes: any;
  alreadyAddedLabel: string;
}

const ImportRow = memo<ImportRowProps>(
  ({ item, isSelected, isExisting, onToggle, colors, sizes, alreadyAddedLabel }) => (
    <TouchableOpacity
      style={[styles.importRow, isExisting && { opacity: 0.4 }]}
      onPress={() => {
        if (!isExisting) {
          onToggle(item.id);
        }
      }}
      activeOpacity={0.7}
      disabled={isExisting}>
      <Icon
        name={isExisting ? 'checkmark-circle' : isSelected ? 'checkbox' : 'square-outline'}
        size={22}
        color={isExisting ? colors.textMuted : isSelected ? colors.accent : colors.textMuted}
        style={{ marginRight: 12 }}
      />
      <View style={{ flex: 1 }}>
        <Text
          style={{ fontSize: sizes.md, color: colors.textPrimary, fontWeight: '500' }}
          numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={{ fontSize: sizes.sm, color: colors.textSecondary }} numberOfLines={1}>
          {item.artist}
        </Text>
      </View>
      {isExisting && (
        <Text style={{ fontSize: 10, color: colors.textMuted }}>{alreadyAddedLabel}</Text>
      )}
    </TouchableOpacity>
  ),
);

// ---- Import Songs Modal ----

interface ImportProps {
  visible: boolean;
  onClose: () => void;
  playlistId: string;
  existingTrackIds: string[];
}

const ImportSongsModal: React.FC<ImportProps> = ({
  visible,
  onClose,
  playlistId,
  existingTrackIds,
}) => {
  const dispatch = useAppDispatch();
  const { tracks } = useAppSelector(s => s.music);
  const { colors, sizes } = useTheme();
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const existingSet = useMemo(() => new Set(existingTrackIds), [existingTrackIds]);

  const filtered = useMemo(() => {
    let list = tracks;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        t =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.fileName.toLowerCase().includes(q),
      );
    }
    return list;
  }, [tracks, search]);

  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const nonExisting = filtered.filter(t => !existingSet.has(t.id));
    setSelected(new Set(nonExisting.map(t => t.id)));
  }, [filtered, existingSet]);

  const handleConfirm = useCallback(() => {
    if (selected.size === 0) {
      Alert.alert(t('playlistDetail.importAlert.title'), t('playlistDetail.importAlert.message'));
      return;
    }
    dispatch(addTracksToPlaylist({ playlistId, trackIds: Array.from(selected) }));
    setSelected(new Set());
    setSearch('');
    onClose();
  }, [dispatch, playlistId, selected, onClose]);

  const handleClose = useCallback(() => {
    setSelected(new Set());
    setSearch('');
    onClose();
  }, [onClose]);

  const renderItem = useCallback(
    ({ item }: { item: Track }) => (
      <ImportRow
        item={item}
        isSelected={selected.has(item.id)}
        isExisting={existingSet.has(item.id)}
        onToggle={toggleSelect}
        colors={colors}
        sizes={sizes}
        alreadyAddedLabel={t('playlistDetail.import.alreadyAdded')}
      />
    ),
    [selected, existingSet, toggleSelect, colors, sizes, t],
  );

  const ITEM_HEIGHT = 58;
  const getItemLayout = useCallback(
    (_: any, i: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * i,
      index: i,
    }),
    [],
  );

  if (!visible) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <SwipeBackWrapper onSwipeBack={handleClose}>
        <SafeAreaView style={[styles.importRoot, { backgroundColor: colors.bg }]}>
          <View style={styles.importHeader}>
            <TouchableOpacity onPress={handleClose} hitSlop={12}>
              <Icon name="close" size={26} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text
              style={{
                flex: 1,
                fontSize: sizes.xl,
                fontWeight: '700',
                color: colors.textPrimary,
                marginLeft: 12,
              }}>
              {t('playlistDetail.import.title')}
            </Text>
            <TouchableOpacity onPress={handleSelectAll} style={{ marginRight: 12 }}>
              <Text style={{ fontSize: sizes.sm, color: colors.accent, fontWeight: '600' }}>
                {t('playlistDetail.import.selectAll')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleConfirm}>
              <View style={[styles.confirmBtn, { backgroundColor: colors.accent }]}>
                <Text style={{ fontSize: sizes.sm, fontWeight: '600', color: colors.bg }}>
                  {t('playlistDetail.import.addButton')}
                  {selected.size > 0 ? ` (${selected.size})` : ''}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder={t('playlistDetail.import.searchPlaceholder')}
          />

          <Text
            style={{
              fontSize: sizes.sm,
              color: colors.textMuted,
              paddingHorizontal: 20,
              paddingBottom: 4,
            }}>
            {search
              ? t('playlistDetail.import.found', { count: filtered.length })
              : t('playlistDetail.import.total', { count: tracks.length })}
          </Text>

          <FlatList
            data={filtered}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator
            initialNumToRender={20}
            maxToRenderPerBatch={15}
            windowSize={11}
            removeClippedSubviews={true}
            getItemLayout={getItemLayout}
          />
        </SafeAreaView>
      </SwipeBackWrapper>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  coverSection: { alignItems: 'center', paddingVertical: 8 },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 8,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sortToggle: { marginLeft: 'auto', padding: 6 },
  sortRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 4 },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  sortTxt: { fontSize: 10, fontWeight: '600' },
  trackRow: { flexDirection: 'row', alignItems: 'center' },
  removeBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  emptyList: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  importBtnEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  dialog: { width: '80%', borderRadius: 20, padding: 24 },
  dialogInput: {
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    borderWidth: 1,
    marginBottom: 20,
  },
  dialogBtns: { flexDirection: 'row', gap: 12 },
  dialogBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importRoot: { flex: 1, paddingTop: 8 },
  importHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  confirmBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  importRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 58,
  },
});

export default PlaylistDetailScreen;
