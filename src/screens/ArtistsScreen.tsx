import React, {useMemo, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {useTranslation} from 'react-i18next';
import {useTheme} from '../contexts/ThemeContext';
import {useAppSelector} from '../store';
import {Track} from '../types';
import SearchBar from '../components/SearchBar';
import CoverArt from '../components/CoverArt';

interface ArtistsScreenProps {
  onSelectArtist: (artistName: string) => void;
}

interface ArtistEntry {
  name: string;
  songCount: number;
  albumCount: number;
  artwork: string | undefined;
}

const ArtistsScreen: React.FC<ArtistsScreenProps> = ({onSelectArtist}) => {
  const {colors, sizes} = useTheme();
  const {t} = useTranslation();
  const tracks = useAppSelector(state => state.music.tracks) as Track[];
  const [search, setSearch] = useState('');

  const artists = useMemo(() => {
    const map = new Map<
      string,
      {albums: Set<string>; count: number; artwork: string | undefined}
    >();

    for (const track of tracks) {
      const name = track.artist || t('artists.unknownArtist');
      let entry = map.get(name);
      if (!entry) {
        entry = {albums: new Set(), count: 0, artwork: undefined};
        map.set(name, entry);
      }
      if (track.album) entry.albums.add(track.album);
      if (!entry.artwork && track.artwork) entry.artwork = track.artwork;
      entry.count += 1;
    }

    const result: ArtistEntry[] = [];
    map.forEach((val, name) => {
      result.push({
        name,
        songCount: val.count,
        albumCount: val.albums.size,
        artwork: val.artwork,
      });
    });

    result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [tracks, t]);

  const filtered = useMemo(() => {
    if (!search.trim()) return artists;
    const q = search.trim().toLowerCase();
    return artists.filter(a => a.name.toLowerCase().includes(q));
  }, [artists, search]);

  const renderItem = useCallback(
    ({item}: {item: ArtistEntry}) => (
      <TouchableOpacity
        style={[styles.row, {borderBottomColor: colors.border}]}
        activeOpacity={0.7}
        onPress={() => onSelectArtist(item.name)}>
        {item.artwork ? (
          <CoverArt artwork={item.artwork} size={48} borderRadius={24} />
        ) : (
          <View
            style={[styles.avatarFallback, {backgroundColor: colors.bgCard}]}>
            <Icon name="person" size={24} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.textContainer}>
          <Text
            style={[
              styles.artistName,
              {color: colors.textPrimary, fontSize: sizes.md},
            ]}
            numberOfLines={1}>
            {item.name}
          </Text>
          <Text
            style={[
              styles.subtitle,
              {color: colors.textMuted, fontSize: sizes.sm},
            ]}
            numberOfLines={1}>
            {t('artists.songCount', {count: item.songCount})}
            {' · '}
            {t('artists.albumCount', {count: item.albumCount})}
          </Text>
        </View>
      </TouchableOpacity>
    ),
    [colors, sizes, t, onSelectArtist],
  );

  const renderEmpty = useCallback(
    () => (
      <View style={styles.empty}>
        <Text
          style={[
            styles.emptyTitle,
            {color: colors.textSecondary, fontSize: sizes.xl},
          ]}>
          {t('artists.empty.title')}
        </Text>
        <Text
          style={[
            styles.emptyMessage,
            {color: colors.textMuted, fontSize: sizes.md},
          ]}>
          {t('artists.empty.message')}
        </Text>
      </View>
    ),
    [colors, sizes, t],
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
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={filtered.length === 0 && styles.emptyContainer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  row: {
    height: 64,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  artistName: {
    fontWeight: 'bold',
  },
  subtitle: {
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyMessage: {
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  emptyContainer: {
    flexGrow: 1,
  },
});

export default ArtistsScreen;
