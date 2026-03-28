// src/components/LocatePlayingButton.tsx
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  Animated,
  FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { Track } from '../types';

export interface LocatePlayingRef {
  show: () => void;
}

interface Props {
  flatListRef: React.RefObject<FlatList>;
  tracks: Track[];
  currentTrack: Track | null;
  itemHeight?: number;
}

const LocatePlayingButton = forwardRef<LocatePlayingRef, Props>(
  ({ flatListRef, tracks, currentTrack, itemHeight }, ref) => {
    const { colors } = useTheme();
    const [visible, setVisible] = useState(false);
    const opacity = useRef(new Animated.Value(0)).current;
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const hide = useCallback(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    }, [opacity]);

    const show = useCallback(() => {
      if (!currentTrack) return;
      if (!tracks.some(t => t.id === currentTrack.id)) return;
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setVisible(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      hideTimer.current = setTimeout(hide, 1500);
    }, [currentTrack, tracks, opacity, hide]);

    useImperativeHandle(ref, () => ({ show }), [show]);

    const handlePress = useCallback(() => {
      if (!currentTrack || !flatListRef.current) return;
      const index = tracks.findIndex(t => t.id === currentTrack.id);
      if (index < 0) return;

      try {
        if (itemHeight) {
          flatListRef.current.scrollToOffset({
            offset: Math.max(0, index * itemHeight - itemHeight * 2),
            animated: true,
          });
        } else {
          flatListRef.current.scrollToIndex({
            index,
            animated: true,
            viewPosition: 0.3,
          });
        }
      } catch {
        // fallback: scroll to approximate offset
        flatListRef.current.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0.3,
        });
      }

      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(hide, 1000);
    }, [currentTrack, flatListRef, tracks, itemHeight, hide]);

    // Cleanup on unmount
    React.useEffect(() => {
      return () => {
        if (hideTimer.current) clearTimeout(hideTimer.current);
      };
    }, []);

    if (!visible || !currentTrack) {
      return (
        <Animated.View style={[styles.container, { opacity: 0 }]} pointerEvents="none" />
      );
    }

    return (
      <Animated.View style={[styles.container, { opacity }]}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.accent }]}
          onPress={handlePress}
          activeOpacity={0.8}>
          <Icon name="locate" size={22} color={colors.bg} />
        </TouchableOpacity>
      </Animated.View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 150,
    right: 16,
    zIndex: 10,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
});

export default LocatePlayingButton;
