import React, { memo, useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  LayoutChangeEvent,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { hapticSelection } from '../utils/haptics';

interface Props {
  letters: string[];
  visible: boolean;
  onSelectLetter: (letter: string) => void;
  onTouchStart?: () => void;
  onTouchEnd?: () => void;
}

const AlphabetIndex: React.FC<Props> = ({
  letters,
  visible,
  onSelectLetter,
  onTouchStart,
  onTouchEnd,
}) => {
  const { colors } = useTheme();
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);

  const lettersRef = useRef(letters);
  lettersRef.current = letters;
  const onSelectRef = useRef(onSelectLetter);
  onSelectRef.current = onSelectLetter;
  const onTouchStartRef = useRef(onTouchStart);
  onTouchStartRef.current = onTouchStart;
  const onTouchEndRef = useRef(onTouchEnd);
  onTouchEndRef.current = onTouchEnd;
  const layoutRef = useRef({ y: 0, h: 0 });

  const getLetterFromY = useCallback((pageY: number) => {
    const { y, h } = layoutRef.current;
    const len = lettersRef.current.length;
    if (h <= 0 || len === 0) return null;
    const relY = pageY - y;
    const idx = Math.floor((relY / h) * len);
    return lettersRef.current[Math.max(0, Math.min(idx, len - 1))];
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        onTouchStartRef.current?.();
        setShowHint(true);
        hapticSelection();
        const letter = getLetterFromY(evt.nativeEvent.pageY);
        if (letter) { setActiveLetter(letter); onSelectRef.current(letter); }
      },
      onPanResponderMove: (evt) => {
        const letter = getLetterFromY(evt.nativeEvent.pageY);
        if (letter) { setActiveLetter(letter); onSelectRef.current(letter); }
      },
      onPanResponderRelease: () => {
        setShowHint(false);
        setActiveLetter(null);
        onTouchEndRef.current?.();
      },
      onPanResponderTerminate: () => {
        setShowHint(false);
        setActiveLetter(null);
        onTouchEndRef.current?.();
      },
    }),
  ).current;

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    e.target.measureInWindow((_x: number, y: number, _w: number, h: number) => {
      layoutRef.current = { y, h };
    });
  }, []);

  if (!visible || letters.length === 0) {
    return (
      <View style={[styles.overlay, { opacity: 0 }]} pointerEvents="none" />
    );
  }

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {/* Center hint bubble */}
      {showHint && activeLetter && (
        <View
          style={[styles.hintBubble, { backgroundColor: colors.accent }]}
          pointerEvents="none"
        >
          <Text style={styles.hintText}>{activeLetter}</Text>
        </View>
      )}

      {/* Side index */}
      <View style={styles.container}>
        <View
          onLayout={handleLayout}
          {...panResponder.panHandlers}
          style={styles.lettersWrap}
        >
          {letters.map(l => (
            <View
              key={l}
              style={[
                styles.letterItem,
                activeLetter === l && { backgroundColor: colors.accent, borderRadius: 8 },
              ]}
            >
              <Text
                style={[
                  styles.letterText,
                  { color: colors.textSecondary },
                  activeLetter === l && { color: colors.bg, fontWeight: '700' },
                ]}
              >
                {l}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  container: {
    position: 'absolute',
    right: 2,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  lettersWrap: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  letterItem: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterText: {
    fontSize: 10,
    fontWeight: '600',
  },
  hintBubble: {
    position: 'absolute',
    alignSelf: 'center',
    top: '45%',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  hintText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
});

export default memo(AlphabetIndex);
