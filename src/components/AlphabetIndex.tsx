import React, { memo, useCallback, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Animated,
  LayoutChangeEvent,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

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
  const opacity = useRef(new Animated.Value(0)).current;
  const hintOpacity = useRef(new Animated.Value(0)).current;

  // Store mutable values in refs so PanResponder closures always read latest
  const lettersRef = useRef(letters);
  lettersRef.current = letters;
  const onSelectRef = useRef(onSelectLetter);
  onSelectRef.current = onSelectLetter;
  const onTouchStartRef = useRef(onTouchStart);
  onTouchStartRef.current = onTouchStart;
  const onTouchEndRef = useRef(onTouchEnd);
  onTouchEndRef.current = onTouchEnd;
  const layoutRef = useRef({ y: 0, h: 0 });

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  const getLetterFromY = useCallback((pageY: number) => {
    const { y, h } = layoutRef.current;
    const len = lettersRef.current.length;
    if (h <= 0 || len === 0) return null;
    const relY = pageY - y;
    const idx = Math.floor((relY / h) * len);
    return lettersRef.current[Math.max(0, Math.min(idx, len - 1))];
  }, []);

  const showHint = useCallback(() => {
    Animated.timing(hintOpacity, { toValue: 1, duration: 100, useNativeDriver: true }).start();
  }, [hintOpacity]);

  const hideHint = useCallback(() => {
    Animated.timing(hintOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  }, [hintOpacity]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        onTouchStartRef.current?.();
        showHint();
        const letter = getLetterFromY(evt.nativeEvent.pageY);
        if (letter) { setActiveLetter(letter); onSelectRef.current(letter); }
      },
      onPanResponderMove: (evt) => {
        const letter = getLetterFromY(evt.nativeEvent.pageY);
        if (letter) { setActiveLetter(letter); onSelectRef.current(letter); }
      },
      onPanResponderRelease: () => {
        hideHint();
        setActiveLetter(null);
        onTouchEndRef.current?.();
      },
      onPanResponderTerminate: () => {
        hideHint();
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

  if (letters.length === 0) return null;

  return (
    <>
      {/* Center hint bubble */}
      <Animated.View
        style={[styles.hintBubble, { backgroundColor: colors.accent, opacity: hintOpacity }]}
        pointerEvents="none"
      >
        <Text style={styles.hintText}>{activeLetter || ''}</Text>
      </Animated.View>

      {/* Side index */}
      <Animated.View style={[styles.container, { opacity }]} pointerEvents={visible ? 'auto' : 'none'}>
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
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 2,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 100,
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
    left: '50%',
    top: '50%',
    marginLeft: -28,
    marginTop: -28,
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
