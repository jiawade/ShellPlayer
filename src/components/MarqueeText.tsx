import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleProp, Text, TextStyle, View } from 'react-native';

interface Props {
  text: string;
  style?: StyleProp<TextStyle>;
  gap?: number;
  speed?: number; // px/s
}

/**
 * Count "visual width" of a string: CJK chars count 2, others count 1.
 * Used to decide whether the text is long enough to scroll.
 */
function visualLength(s: string): number {
  let len = 0;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    // CJK Unified Ideographs, CJK Extension A/B, Katakana, Hiragana, Hangul, fullwidth
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x3040 && code <= 0x30ff) ||
      (code >= 0xac00 && code <= 0xd7af) ||
      (code >= 0xff00 && code <= 0xffef) ||
      (code >= 0x20000 && code <= 0x2a6df)
    ) {
      len += 2;
    } else {
      len += 1;
    }
  }
  return len;
}

/** Threshold: only scroll if visual length exceeds 40 (≈20 CJK or 40 ASCII). */
const SCROLL_THRESHOLD = 40;

const MarqueeText: React.FC<Props> = ({ text, style, gap = 48, speed = 40 }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);
  const textW = useRef(0);
  const containerW = useRef(0);
  const [needsScroll, setNeedsScroll] = useState(false);

  const evaluate = () => {
    loopRef.current?.stop();
    loopRef.current = null;
    translateX.setValue(0);

    // Only scroll if text exceeds the character-count threshold
    const tooLong = visualLength(text) > SCROLL_THRESHOLD;
    const overflows = textW.current > containerW.current && containerW.current > 0;
    const needs = tooLong && overflows;
    setNeedsScroll(needs);

    if (!needs) return;

    const distance = textW.current + gap;
    const duration = Math.max(1, Math.round((distance / speed) * 1000));

    loopRef.current = Animated.loop(
      Animated.sequence([
        Animated.delay(1500),
        Animated.timing(translateX, {
          toValue: -distance,
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
    );
    loopRef.current.start();
  };

  useEffect(() => {
    textW.current = 0;
    loopRef.current?.stop();
    loopRef.current = null;
    translateX.setValue(0);
    setNeedsScroll(false);
  }, [text]);

  useEffect(() => () => { loopRef.current?.stop(); }, []);

  return (
    <View
      style={{ width: '100%', overflow: 'hidden' }}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (Math.abs(w - containerW.current) > 1) {
          containerW.current = w;
          evaluate();
        }
      }}>
      <Text
        numberOfLines={1}
        style={[style, { position: 'absolute', opacity: 0, top: -9999, width: 99999 }]}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (Math.abs(w - textW.current) > 1) {
            textW.current = w;
            evaluate();
          }
        }}>
        {text}
      </Text>

      <Animated.View
        style={{
          flexDirection: 'row',
          alignSelf: needsScroll ? 'flex-start' : 'center',
          transform: [{ translateX }],
        }}>
        <Text numberOfLines={1} style={style}>{text}</Text>
        {needsScroll && (
          <>
            <View style={{ width: gap }} />
            <Text numberOfLines={1} style={style}>{text}</Text>
          </>
        )}
      </Animated.View>
    </View>
  );
};

export default MarqueeText;
