import { useMemo, useCallback, useRef, useState } from 'react';
import { FlatList } from 'react-native';
import { Track } from '../types';
import { getInitialLetter, getSortKey } from '../utils/pinyinHelper';

interface AlphabetData {
  sortedTracks: Track[];
  letters: string[];
  letterIndexMap: Map<string, number>;
}

export function useAlphabetIndex(tracks: Track[], flatListRef: React.RefObject<FlatList>) {
  const [indexVisible, setIndexVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const alphabetData: AlphabetData = useMemo(() => {
    // Sort tracks by pinyin
    const sorted = [...tracks].sort((a, b) => {
      const ka = getSortKey(a.title);
      const kb = getSortKey(b.title);
      return ka.localeCompare(kb);
    });

    // Build letter list and index map
    const letterIndexMap = new Map<string, number>();
    const letterSet: string[] = [];
    for (let i = 0; i < sorted.length; i++) {
      const l = getInitialLetter(sorted[i].title);
      if (!letterIndexMap.has(l)) {
        letterIndexMap.set(l, i);
        letterSet.push(l);
      }
    }

    // Ensure '#' is at the end
    const hashIdx = letterSet.indexOf('#');
    if (hashIdx >= 0 && hashIdx !== letterSet.length - 1) {
      letterSet.splice(hashIdx, 1);
      letterSet.push('#');
    }

    return { sortedTracks: sorted, letters: letterSet, letterIndexMap };
  }, [tracks]);

  const resetHideTimer = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setIndexVisible(false), 3000);
  }, []);

  const showIndex = useCallback(() => {
    setIndexVisible(true);
    resetHideTimer();
  }, [resetHideTimer]);

  const onSelectLetter = useCallback(
    (letter: string) => {
      const idx = alphabetData.letterIndexMap.get(letter);
      if (idx != null && flatListRef.current) {
        flatListRef.current.scrollToIndex({ index: idx, animated: false, viewPosition: 0 });
      }
      resetHideTimer();
    },
    [alphabetData.letterIndexMap, flatListRef, resetHideTimer],
  );

  const onIndexTouchStart = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setIndexVisible(true);
  }, []);

  const onIndexTouchEnd = useCallback(() => {
    resetHideTimer();
  }, [resetHideTimer]);

  const onScroll = useCallback(() => {
    showIndex();
  }, [showIndex]);

  return {
    sortedTracks: alphabetData.sortedTracks,
    letters: alphabetData.letters,
    indexVisible,
    onSelectLetter,
    onIndexTouchStart,
    onIndexTouchEnd,
    onScroll,
  };
}
