import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleProp, Text, TextStyle, View } from 'react-native';

interface Props {
  text: string;
  style?: StyleProp<TextStyle>;
  gap?: number;
  speed?: number; // px/s
}

const MarqueeText: React.FC<Props> = ({ text, style, gap = 48, speed = 44 }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);

  const shouldMarquee = useMemo(() => textWidth > containerWidth && containerWidth > 0, [textWidth, containerWidth]);

  useEffect(() => {
    loopRef.current?.stop();
    translateX.setValue(0);

    if (!shouldMarquee) {
      return;
    }

    const distance = textWidth + gap;
    const duration = Math.max(1, Math.round((distance / speed) * 1000));

    loopRef.current = Animated.loop(
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(translateX, {
          toValue: -distance,
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
    );
    loopRef.current.start();

    return () => {
      loopRef.current?.stop();
    };
  }, [gap, shouldMarquee, speed, textWidth, containerWidth, translateX]);

  if (!shouldMarquee) {
    return (
      <View
        style={{ width: '100%', overflow: 'hidden' }}
        onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}>
        <Text
          numberOfLines={1}
          style={style}
          onLayout={e => setTextWidth(e.nativeEvent.layout.width)}>
          {text}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{ width: '100%', overflow: 'hidden' }}
      onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}>
      <Animated.View style={{ flexDirection: 'row', transform: [{ translateX }] }}>
        <Text
          numberOfLines={1}
          style={style}
          onLayout={e => setTextWidth(e.nativeEvent.layout.width)}>
          {text}
        </Text>
        <View style={{ width: gap }} />
        <Text numberOfLines={1} style={style}>
          {text}
        </Text>
      </Animated.View>
    </View>
  );
};

export default MarqueeText;
