// src/utils/vlcPlayback.ts
import { useSyncExternalStore } from 'react';

export interface VlcSnapshot {
  trackId: string | null;
  position: number;
  duration: number;
  isPlaying: boolean;
  lastError: string | null;
}

interface VlcBridge {
  play: (uri: string, rate: number, durationHintSec?: number) => void;
  pause: () => void;
  resume: () => void;
  seekTo: (positionSec: number) => void;
  stop: () => void;
  setRate: (rate: number) => void;
}

interface VlcHandlers {
  onEnded?: () => void;
  onError?: (message: string) => void;
}

let bridge: VlcBridge | null = null;
let handlers: VlcHandlers = {};

let snapshot: VlcSnapshot = {
  trackId: null,
  position: 0,
  duration: 0,
  isPlaying: false,
  lastError: null,
};

const listeners = new Set<() => void>();

function emit(next: Partial<VlcSnapshot>) {
  snapshot = { ...snapshot, ...next };
  listeners.forEach(l => l());
}

export function setVlcBridge(next: VlcBridge | null) {
  bridge = next;
}

export function setVlcHandlers(next: VlcHandlers) {
  handlers = next;
}

export function getVlcSnapshot(): VlcSnapshot {
  return snapshot;
}

export function useVlcSnapshot(): VlcSnapshot {
  return useSyncExternalStore(
    callback => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => snapshot,
    () => snapshot,
  );
}

export function isVlcReady(): boolean {
  return !!bridge;
}

export function reportVlcPlaying(isPlaying: boolean) {
  emit({ isPlaying });
}

export function reportVlcProgress(position: number, duration: number) {
  const safeDuration = duration > 0 ? duration : snapshot.duration;
  emit({ position, duration: safeDuration });
}

export function reportVlcEnded() {
  emit({ isPlaying: false, position: 0 });
  handlers.onEnded?.();
}

export function reportVlcStopped() {
  emit({ isPlaying: false, position: 0 });
}

export function reportVlcError(message: string) {
  emit({ isPlaying: false, lastError: message });
  handlers.onError?.(message);
}

export async function playVlc(uri: string, trackId: string, rate = 1, durationHintSec = 0) {
  if (!bridge) throw new Error('VLC bridge is not ready');
  emit({
    trackId,
    position: 0,
    duration: durationHintSec > 0 ? durationHintSec : 0,
    isPlaying: true,
    lastError: null,
  });
  bridge.play(uri, rate, durationHintSec);
}

export async function pauseVlc() {
  bridge?.pause();
  emit({ isPlaying: false });
}

export async function resumeVlc() {
  bridge?.resume();
  emit({ isPlaying: true });
}

export async function stopVlc() {
  bridge?.stop();
  emit({ isPlaying: false, position: 0, duration: 0, trackId: null });
}

export async function seekVlc(positionSec: number) {
  bridge?.seekTo(positionSec);
  emit({ position: Math.max(0, positionSec) });
}

export async function setVlcRate(rate: number) {
  bridge?.setRate(rate);
}
