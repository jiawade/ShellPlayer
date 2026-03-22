import React, {useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useTheme} from '../contexts/ThemeContext';
import {useAppSelector} from '../store';
import {Track} from '../types';
import SearchBar from '../components/SearchBar';
import CoverArt from '../components/CoverArt';

interface Album {
  name: string;
  artist: string;
  trackCount: number;
  artworks: string[];
  totalDuration: number;
}

interface AlbumsScreenProps {
  onSelectAlbum: (albumName: string) => void;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

const COLUMN_COUNT = 2;
const HORIZONTAL_PADDING = 16;
const GAP = 12;
const screenWidth = Dimensions.get('window').width;
const cardWidth =
  (screenWidth - HORIZONTAL_PADDING * 2 - GAP * (COLUMN_COUNT - 1)) /
  COLUMN_COUNT;

const AlbumsScreen: React.FC<AlbumsScreenProps> = ({onSelectAlbum}) => {
  const {colors, sizes} = useTheme();
  const {t} = useTranslation();
  const tracks = useAppSelector(state => state.music.tracks) as Track[];
  const [search, setSearch] = useState('');

  const albums = useMemo(() => {
    const map = new Map<
      string,
      {artists: string[]; artworks: string[]; duration: number; count: number}
    >();

    for (const track of tracks) {
      const albumName = track.album || t('albums.unknownAlbum');
      let entry = map.get(albumName);
      if (!entry) {
        entry = {artists: [], artworks: [], duration: 0, count: 0};
        map.set(albumName, entry);
      }
      if (track.artist) entry.artists.push(track.artist);
      if (
        track.artwork &&
        entry.artworks.length < 1 &&
        !entry.artworks.includes(track.artwork)
      ) {
        entry.artworks.push(track.artwork);
      }
      entry.duration += track.duration || 0;
      entry.count += 1;
    }

    const result: Album[] = [];
    map.forEach((val, name) => {
      const freq = new Map<string, number>();
      for (const a of val.artists) {
        freq.set(a, (freq.get(a) || 0) + 1);
      }
      let artist: string;
      if (freq.size === 0) {
        artist = '';
      } else if (freq.size === 1) {
        artist = val.artists[0];
      } else {
        let maxCount = 0;
        let mostCommon = val.artists[0];
        freq.forEach((count, name) => {
          if (count > maxCount) {
            maxCount = count;
            mostCommon = name;
          }
        });
        artist =
          maxCount === val.count ? mostCommon : mostCommon;
      }

      result.push({
        name,
        artist,
        trackCount: val.count,
        artworks: val.artworks,
        totalDuration: val.duration,
      });
    });

    result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [tracks, t]);

  const filtered = useMemo(() => {
    if (!search.trim()) return albums;
    const q = search.trim().toLowerCase();
    return albums.filter(
      a =>
        a.name.toLowerCase().includes(q) ||
        a.artist.toLowerCase().includes(q),
    );
  }, [albums, search]);

  const renderItem = ({item}: {item: Album}) => (
    <TouchableOpacity
      style={[styles.card, {backgroundColor: colors.bgCard}]}
      activeOpacity={0.7}
      onPress={() => onSelectAlbum(item.name)}>
      <CoverArt
        artwork={item.artworks.length > 0 ? item.artworks[0] : undefined}
        size={cardWidth}
      />
      <View style={styles.cardText}>
        <Text
          style={[styles.albumName, {color: colors.textPrimary, fontSize: sizes.md}]}
          numberOfLines={1}>
          {item.name}
        </Text>
        <Text
          style={[styles.artistName, {color: colors.textSecondary, fontSize: sizes.sm}]}
          numberOfLines={1}>
          {item.artist}
        </Text>
        <Text style={[styles.trackCount, {color: colors.textMuted, fontSize: sizes.xs}]}>
          {t('albums.trackCount', {count: item.trackCount})} · {formatDuration(item.totalDuration)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.empty}>
      <Text style={[styles.emptyTitle, {color: colors.textSecondary, fontSize: sizes.xl}]}>
        {t('albums.empty.title')}
      </Text>
      <Text style={[styles.emptyMessage, {color: colors.textMuted, fontSize: sizes.md}]}>
        {t('albums.empty.message')}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, {backgroundColor: colors.bg}]}>
      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder={t('searchBar.placeholder')}
      />
      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={item => item.name}
        numColumns={COLUMN_COUNT}
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.row}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
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
  artistName: {
    marginTop: 2,
  },
  trackCount: {
    marginTop: 2,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyMessage: {
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});

export default AlbumsScreen;
