import React, { useRef } from 'react';
import { Animated, PanResponder, Dimensions, Platform } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const EDGE_WIDTH = 25;
const DISMISS_THRESHOLD = SCREEN_WIDTH * 0.3;

interface Props {
  onSwipeBack: () => void;
  children: React.ReactNode;
}

const SwipeBackWrapper: React.FC<Props> = ({ onSwipeBack, children }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const onSwipeBackRef = useRef(onSwipeBack);
  onSwipeBackRef.current = onSwipeBack;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gs) =>
        Platform.OS === 'ios' &&
        gs.x0 < EDGE_WIDTH &&
        gs.dx > 10 &&
        Math.abs(gs.dy) < gs.dx,
      onPanResponderMove: (_, gs) => {
        if (gs.dx > 0) {
          translateX.setValue(gs.dx);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > DISMISS_THRESHOLD || gs.vx > 0.5) {
          Animated.timing(translateX, {
            toValue: SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            translateX.setValue(0);
            onSwipeBackRef.current();
          });
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            overshootClamping: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          overshootClamping: true,
        }).start();
      },
    }),
  ).current;

  return (
    <Animated.View
      style={{ flex: 1, transform: [{ translateX }] }}
      {...panResponder.panHandlers}>
      {children}
    </Animated.View>
  );
};

export default SwipeBackWrapper;
