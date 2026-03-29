// src/utils/wifiImportNotifier.ts
// Global event system for WiFi import completion notifications

type Listener = (count: number) => void;
const listeners: Set<Listener> = new Set();

export function onWifiImportComplete(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function emitWifiImportComplete(count: number) {
  listeners.forEach(fn => fn(count));
}
