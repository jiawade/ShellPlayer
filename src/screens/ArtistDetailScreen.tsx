import React, {useMemo, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {useTranslation} from 'react-i18next';
import {useTheme} from '../contexts/ThemeContext';
import {useAppSelector, useAppDispatch} from '../store';
import {playTrack, toggleFavorite} from '../store/musicSlice';
import TrackItem from '../components/TrackItem';
import TrackMenu from '../components/TrackMenu';
import CoverArt from '../components/CoverArt';
import {Track} from '../types';

interface ArtistDetailScreenProps {
  artistName: string;
  onBack: () => void;
  onSelectAlbum: (albumName: string) => void;
}

type TabKey = 'songs' | 'albums';

interface ArtistAlbum {
  name: string;
  trackCount: number;
  artwork: string | undefined;
}

const COLUMN_COUNT = 2;
const HORIZONTAL_PADDING = 16;
const GAP = 12;
const screenWidth = Dimensions.get('window').width;
const cardWidth =
  (screenWidth - HORIZONTAL_PADDING * 2 - GAP * (COLUMN_COUNT - 1)) /
  COLUMN_COUNT;

const ArtistDetailScreen: React.FC<ArtistDetailScreenProps> = ({
  artistName,
  onBack,
  onSelectAlbum,
}) => {
  const {colors, sizes} = useTheme();
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const {tracks, currentTrack} = useAppSelector(s => s.music);

  const [activeTab, setActiveTab] = useState<TabKey>('songs');
  const [menuTrack, setMenuTrack] = useState<Track | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  const artistTracks = useMemo(
    () => (tracks as Track[]).filter(tr => tr.artist === artistName),
    [tracks, artistName],
  );

  const artistAlbums = useMemo(() => {
    const map = new Map<string, {count: number; artwork: string | undefined}>();
    for (const tr of artistTracks) {
      const album = tr.album || t('albums.unknownAlbum');
      const entry = map.get(album);
      if (!entry) {
        map.set(album, {count: 1, artwork: tr.artwork || undefined});
      } else {
        entry.count += 1;
        if (!entry.artwork && tr.artwork) {
          entry.artwork = tr.artwork;
        }
      }
    }
    const result: ArtistAlbum[] = [];
    map.forEach((val, name) => {
      result.push({name, trackCount: val.count, artwork: val.artwork});
    });
    result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [artistTracks, t]);

  const handleTrackPress = useCallback(
    (track: Track) => {
      dispatch(playTrack({track, queue: artistTracks, shuffle: false}));
    },
    [dispatch, artistTracks],
  );

  const handleToggleFavorite = useCallback(
    (id: string) => {
      dispatch(toggleFavorite(id));
    },
    [dispatch],
  );

  const handleOpenMenu = useCallback((track: Track) => {
    setMenuTrack(track);
    setShowMenu(true);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setShowMenu(false);
  }, []);

  const renderSongItem = useCallback(
    ({item}: {item: Track}) => (
      <TrackItem
        track={item}
        isActive={currentTrack?.id === item.id}
        onPress={handleTrackPress}
        onToggleFavorite={handleToggleFavorite}
        onOpenMenu={handleOpenMenu}
      />
    ),
    [currentTrack?.id, handleTrackPress, handleToggleFavorite, handleOpenMenu],
  );

  const renderAlbumItem = useCallback(
    ({item}: {item: ArtistAlbum}) => (
      <TouchableOpacity
        style={[styles.card, {backgroundColor: colors.bgCard}]}
        activeOpacity={0.7}
        onPress={() => onSelectAlbum(item.name)}>
        <CoverArt artwork={item.artwork} size={cardWidth} />
        <View style={styles.cardText}>
          <Text
            style={[styles.albumName, {color: colors.textPrimary, fontSize: sizes.md}]}
            numberOfLines={1}>
            {item.name}
          </Text>
          <Text
            style={[styles.trackCount, {color: colors.textMuted, fontSize: sizes.xs}]}>
            {t('albums.trackCount', {count: item.trackCount})}
          </Text>
        </View>
      </TouchableOpacity>
    ),
    [colors, sizes, t, onSelectAlbum],
  );

  const renderHeader = () => (
    <View>
      {/* Artist info */}
      <View style={styles.infoSection}>
        <Text style={[styles.artistTitle, {color: colors.textPrimary}]}>
          {artistName}
        </Text>
        <Text style={[styles.stats, {color: colors.textMuted}]}>
          {t('artists.songCount', {count: artistTracks.length})}
          {'  ·  '}
          {t('artists.albumCount', {count: artistAlbums.length})}
        </Text>
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, {borderBottomColor: colors.border}]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'songs' && {borderBottomColor: colors.accent, borderBottomWidth: 2},
          ]}
          onPress={() => setActiveTab('songs')}>
          <Text
            style={[
              styles.tabText,
              {color: activeTab === 'songs' ? colors.accent : colors.textSecondary},
            ]}>
            {t('artists.allSongs')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'albums' && {borderBottomColor: colors.accent, borderBottomWidth: 2},
          ]}
          onPress={() => setActiveTab('albums')}>
          <Text
            style={[
              styles.tabText,
              {color: activeTab === 'albums' ? colors.accent : colors.textSecondary},
            ]}>
            {t('artists.albumsTab')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, {backgroundColor: colors.bg}]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
          <Icon name="chevron-back" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text
          style={[styles.headerTitle, {color: colors.textPrimary}]}
          numberOfLines={1}>
          {artistName}
        </Text>
        <View style={{width: 28}} />
      </View>

      {activeTab === 'songs' ? (
        <FlatList
          data={artistTracks}
          keyExtractor={item => item.id}
          ListHeaderComponent={renderHeader}
          renderItem={renderSongItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={artistAlbums}
          keyExtractor={item => item.name}
          ListHeaderComponent={renderHeader}
          renderItem={renderAlbumItem}
          numColumns={COLUMN_COUNT}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TrackMenu
        track={menuTrack}
        visible={showMenu}
        onClose={handleCloseMenu}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  infoSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  artistTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  stats: {
    fontSize: 14,
    marginTop: 4,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 120,
  },
  gridContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 120,
  },
  row: {
    gap: GAP,
    marginBottom: GAP,
  },
  card: {
    width: cardWidth,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardText: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  albumName: {
    fontWeight: '600',
  },
  trackCount: {
    marginTop: 2,
  },
});

export default ArtistDetailScreen;
