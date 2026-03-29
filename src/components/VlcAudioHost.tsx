// src/components/VlcAudioHost.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { VLCPlayer } from 'react-native-vlc-media-player';
import {
  setVlcBridge,
  reportVlcPlaying,
  reportVlcProgress,
  reportVlcEnded,
  reportVlcError,
  reportVlcStopped,
} from '../utils/vlcPlayback';

const AnyVLCPlayer = VLCPlayer as any;

function toVlcUri(uri: string): string {
  if (Platform.OS === 'android' && uri.startsWith('file://')) {
    return uri.replace('file://', '');
  }
  if (uri.startsWith('file://')) return uri;
  if (uri.startsWith('/')) return `file://${uri}`;
  return uri;
}

export default function VlcAudioHost() {
  const [sourceUri, setSourceUri] = useState<string | null>(null);
  const [paused, setPaused] = useState(true);
  const [seek, setSeek] = useState(-1);
  const [rate, setRate] = useState(1);
  const playerRef = useRef<any>(null);
  const clearSeekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationSecRef = useRef(0);
  // Guard: suppress spurious EndReached events right after a seek (iOS VLC bug with WMA/APE)
  const seekGuardUntil = useRef(0);
  // Suppress erratic onProgress reports during seek
  const progressGuardUntil = useRef(0);
  // Last known good position before seek
  const seekTargetSec = useRef(-1);

  useEffect(() => {
    setVlcBridge({
      play: (uri: string, playbackRate: number, durationHintSec?: number) => {
        setRate(playbackRate || 1);
        durationSecRef.current = Math.max(0, Number(durationHintSec || 0));
        setSourceUri(toVlcUri(uri));
        setPaused(false);
      },
      pause: () => {
        setPaused(true);
      },
      resume: () => {
        if (sourceUri) setPaused(false);
      },
      seekTo: (positionSec: number) => {
        const targetSec = Math.max(0, positionSec);
        const ms = targetSec * 1000;
        // Guard windows: suppress spurious EndReached and erratic progress for 2s after seek
        seekGuardUntil.current = Date.now() + 2000;
        progressGuardUntil.current = Date.now() + 800;
        seekTargetSec.current = targetSec;

        // Use only the React prop to trigger native seek (don't also call playerRef.seek)
        setSeek(-1);
        requestAnimationFrame(() => setSeek(ms));

        if (clearSeekTimer.current) clearTimeout(clearSeekTimer.current);
        clearSeekTimer.current = setTimeout(() => setSeek(-1), 200);
      },
      stop: () => {
        setPaused(true);
        setSourceUri(null);
      },
      setRate: (playbackRate: number) => {
        setRate(playbackRate || 1);
      },
    });

    return () => {
      if (clearSeekTimer.current) clearTimeout(clearSeekTimer.current);
      setVlcBridge(null);
    };
  }, [sourceUri]);

  const source = useMemo(() => {
    if (!sourceUri) return undefined;
    return {
      uri: sourceUri,
      autoplay: true,
      initType: 2,
      initOptions:
        Platform.OS === 'android'
          ? [
              '--aout=opensles',
              '--no-video',
              '--file-caching=1200',
              '--network-caching=1200',
              '--dummy',
            ]
          : ['--no-video', '--file-caching=1200', '--network-caching=1200'],
    };
  }, [sourceUri]);

  return (
    <View pointerEvents="none" style={styles.hidden}>
      <AnyVLCPlayer
        ref={playerRef}
        style={styles.hidden}
        source={source as any}
        paused={paused}
        muted={false}
        volume={100}
        rate={rate}
        seek={seek}
        onPlaying={() => reportVlcPlaying(true)}
        onPaused={() => {
          // During seek guard, VLC may fire spurious Paused — ignore it
          if (Date.now() < seekGuardUntil.current) return;
          reportVlcPlaying(false);
        }}
        onStopped={() => {
          // During seek guard, VLC may fire spurious Stopped — ignore it
          if (Date.now() < seekGuardUntil.current) {
            console.warn('[VLC] Suppressed spurious Stopped after seek');
            return;
          }
          reportVlcStopped();
        }}
        onEnd={() => {
          // Guard: iOS MobileVLCKit fires spurious EndReached after seeking
          // certain formats (WMA/APE). If we recently seeked, ignore it and
          // force VLC to resume playing from the seek position.
          if (Date.now() < seekGuardUntil.current) {
            console.warn('[VLC] Suppressed spurious EndReached after seek, resuming...');
            // VLC may have stopped — force resume
            setPaused(true);
            setTimeout(() => setPaused(false), 50);
            return;
          }
          reportVlcEnded();
        }}
        onError={(e: any) => {
          const msg = JSON.stringify(e || {});
          console.warn('[VLC onError]', msg);
          reportVlcError(msg || 'VLC playback failed');
        }}
        onProgress={(e: any) => {
          // Native Android/iOS always reports ms from getTime()/getLength()
          const pos = Number(e?.currentTime || 0) / 1000;
          const dur = Number(e?.duration || 0) / 1000;
          if (dur > 0) durationSecRef.current = dur;

          // During the progress guard window after a seek, suppress erratic
          // position reports (VLC may briefly report 0 or end-of-file)
          if (Date.now() < progressGuardUntil.current) {
            // Report the seek target position instead of VLC's transient value
            if (seekTargetSec.current >= 0) {
              reportVlcProgress(seekTargetSec.current, dur > 0 ? dur : durationSecRef.current);
            }
            return;
          }
          seekTargetSec.current = -1;
          reportVlcProgress(pos, dur > 0 ? dur : durationSecRef.current);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: {
    width: 1,
    height: 1,
    opacity: 0,
    position: 'absolute',
    left: -1000,
    top: -1000,
  },
});
