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

interface AlbumDetailScreenProps {
  albumName: string;
  onBack: () => void;
}

const screenWidth = Dimensions.get('window').width;
const ARTWORK_SIZE = screenWidth * 0.6;

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

const AlbumDetailScreen: React.FC<AlbumDetailScreenProps> = ({
  albumName,
  onBack,
}) => {
  const {colors, sizes} = useTheme();
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const {tracks, currentTrack} = useAppSelector(s => s.music);

  const [menuTrack, setMenuTrack] = useState<Track | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  const albumTracks = useMemo(
    () => tracks.filter((tr: Track) => tr.album === albumName),
    [tracks, albumName],
  );

  const albumArtwork = useMemo(
    () => albumTracks.find(tr => tr.artwork)?.artwork,
    [albumTracks],
  );

  const albumArtist = useMemo(() => {
    const artists = albumTracks.map(tr => tr.artist).filter(Boolean);
    if (artists.length === 0) return t('common.unknownArtist');
    const freq = new Map<string, number>();
    for (const a of artists) {
      freq.set(a, (freq.get(a) || 0) + 1);
    }
    let best = artists[0];
    let bestCount = 0;
    freq.forEach((count, name) => {
      if (count > bestCount) {
        bestCount = count;
        best = name;
      }
    });
    return best;
  }, [albumTracks, t]);

  const totalDuration = useMemo(
    () => albumTracks.reduce((sum, tr) => sum + (tr.duration || 0), 0),
    [albumTracks],
  );

  const handlePlayAll = useCallback(() => {
    if (albumTracks.length === 0) return;
    dispatch(playTrack({track: albumTracks[0], queue: albumTracks, shuffle: false}));
  }, [dispatch, albumTracks]);

  const handleShuffle = useCallback(() => {
    if (albumTracks.length === 0) return;
    dispatch(playTrack({track: albumTracks[0], queue: albumTracks, shuffle: true}));
  }, [dispatch, albumTracks]);

  const handleTrackPress = useCallback(
    (track: Track) => {
      dispatch(playTrack({track, queue: albumTracks, shuffle: false}));
    },
    [dispatch, albumTracks],
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

  const displayName = albumName || t('albums.unknownAlbum');

  const renderHeader = () => (
    <View>
      {/* Hero */}
      <View style={styles.heroContainer}>
        <CoverArt
          artwork={albumArtwork}
          size={ARTWORK_SIZE}
          borderRadius={16}
        />
        <Text
          style={[styles.albumTitle, {color: colors.textPrimary, fontSize: sizes.lg}]}
          numberOfLines={2}>
          {displayName}
        </Text>
        <Text
          style={[styles.artistName, {color: colors.textSecondary}]}
          numberOfLines={1}>
          {albumArtist}
        </Text>
        <Text style={[styles.meta, {color: colors.textSecondary}]}>
          {t('albums.trackCount', {count: albumTracks.length})}
          {'  ·  '}
          {t('albums.totalDuration', {duration: formatDuration(totalDuration)})}
        </Text>
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, {backgroundColor: colors.accent}]}
          onPress={handlePlayAll}
          activeOpacity={0.7}>
          <Icon name="play" size={18} color="#fff" />
          <Text style={styles.actionText}>{t('albums.playAll')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, {backgroundColor: colors.accent}]}
          onPress={handleShuffle}
          activeOpacity={0.7}>
          <Icon name="shuffle" size={18} color="#fff" />
          <Text style={styles.actionText}>{t('albums.shuffleAll')}</Text>
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
          {displayName}
        </Text>
        <View style={{width: 28}} />
      </View>

      <FlatList
        data={albumTracks}
        keyExtractor={item => item.id}
        ListHeaderComponent={renderHeader}
        renderItem={({item}) => (
          <TrackItem
            track={item}
            isActive={currentTrack?.id === item.id}
            onPress={handleTrackPress}
            onToggleFavorite={handleToggleFavorite}
            onOpenMenu={handleOpenMenu}
          />
        )}
        contentContainerStyle={styles.listContent}
      />

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
  heroContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 16,
  },
  albumTitle: {
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  artistName: {
    fontSize: 15,
    marginTop: 4,
    textAlign: 'center',
  },
  meta: {
    fontSize: 13,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 24,
    gap: 6,
  },
  actionText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  listContent: {
    paddingBottom: 120,
  },
});

export default AlbumDetailScreen;
