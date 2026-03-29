// src/screens/WifiTransferScreen.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  NativeModules,
  NativeEventEmitter,
  Platform,
  Animated,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { CommonActions } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../store';
import { store } from '../store';
import { scanMusic, importiOSMediaLibrary } from '../store/musicSlice';
import { useTheme } from '../contexts/ThemeContext';
import { getWifiUploadHtml } from '../utils/wifiUploadHtml';
import { getDefaultMusicDir } from '../utils/defaultDirs';
import { emitWifiImportComplete } from '../utils/wifiImportNotifier';
import { useTranslation } from 'react-i18next';

const DEFAULT_PORT = 8888;
const PORT_OPTIONS = [8888, 9999, 8080, 3000];

// ── Module-level persistent state ──
// Keeps WiFi server & received files alive across screen navigation
let _serverUrl: string | null = null;
let _serverPort: number = DEFAULT_PORT;
let _serverStarted = false;
let _clientConnected = false;
let _receivedFiles: { filename: string; size: number }[] = [];
let _fileSub: any = null;
let _connectSub: any = null;
let _onUpdate: (() => void) | null = null;
let _isScreenMounted = false;
let _bgImportTimer: ReturnType<typeof setTimeout> | null = null;
const BG_IMPORT_DELAY = 5000; // 5s after last file, auto-import in background

function cancelBgImportTimer() {
  if (_bgImportTimer) {
    clearTimeout(_bgImportTimer);
    _bgImportTimer = null;
  }
}

function scheduleBgImport() {
  cancelBgImportTimer();
  if (_isScreenMounted || _receivedFiles.length === 0) return;
  _bgImportTimer = setTimeout(async () => {
    if (_isScreenMounted) return; // user came back
    const fileCount = _receivedFiles.length;
    const musicDir = getDefaultMusicDir();
    // Cleanup server
    if (_serverStarted) {
      NativeModules.WifiTransferModule.stopServer().catch(() => {});
      _serverStarted = false;
    }
    if (_fileSub) { _fileSub.remove(); _fileSub = null; }
    if (_connectSub) { _connectSub.remove(); _connectSub = null; }
    _serverUrl = null;
    _clientConnected = false;
    _receivedFiles = [];
    _onUpdate = null;
    // Import
    try {
      if (Platform.OS === 'ios') {
        await store.dispatch(importiOSMediaLibrary({ includeIPod: false, localDirs: [musicDir], localFiles: [] }));
      } else {
        await store.dispatch(scanMusic([musicDir]));
      }
    } catch {}
    emitWifiImportComplete(fileCount);
  }, BG_IMPORT_DELAY);
}

function ensureEventListener() {
  if (_fileSub) return;
  const nativeModule = NativeModules.WifiTransferModule;
  if (Platform.OS === 'ios' && !nativeModule) return;
  const emitter = new NativeEventEmitter(
    Platform.OS === 'ios' ? nativeModule : undefined,
  );
  _fileSub = emitter.addListener('onWifiFileReceived', event => {
    const filename = event.filename || 'unknown';
    _receivedFiles = [..._receivedFiles, { filename, size: event.size }];
    _onUpdate?.();
    // If screen is not mounted, schedule auto-import after inactivity
    if (!_isScreenMounted) {
      scheduleBgImport();
    }
  });
  _connectSub = emitter.addListener('onWifiClientConnected', () => {
    _clientConnected = true;
    _onUpdate?.();
  });
}

export function cleanupWifiServer() {
  if (_serverStarted) {
    NativeModules.WifiTransferModule.stopServer().catch(() => {});
    _serverStarted = false;
  }
  if (_fileSub) {
    _fileSub.remove();
    _fileSub = null;
  }
  if (_connectSub) {
    _connectSub.remove();
    _connectSub = null;
  }
  _serverUrl = null;
  _clientConnected = false;
  _receivedFiles = [];
  _onUpdate = null;
}

const WifiTransferScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<any>();
  const { scanDirectories } = useAppSelector(s => s.music);
  const { colors, sizes } = useTheme();
  const { t, i18n } = useTranslation();

  const [serverUrl, setServerUrl] = useState<string | null>(_serverUrl);
  const [port, setPort] = useState(_serverPort);
  const [error, setError] = useState<string | null>(null);
  const [receivedFiles, setReceivedFiles] = useState<{ filename: string; size: number }[]>(_receivedFiles);
  const [clientConnected, setClientConnected] = useState(_clientConnected);
  const [isImporting, setIsImporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const pulseAnim = useRef(new Animated.Value(0)).current;

  const musicDir = getDefaultMusicDir();

  const goToAllSongs = useCallback(() => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Main', params: { screen: 'AllSongs' } }],
      }),
    );
  }, [navigation]);

  const syncFromGlobal = useCallback(() => {
    setReceivedFiles([..._receivedFiles]);
    setClientConnected(_clientConnected);
  }, []);

  const startServer = useCallback(
    async (p: number) => {
      try {
        setError(null);
        _clientConnected = false;
        setClientConnected(false);
        const result = await NativeModules.WifiTransferModule.startServer(
          p,
          musicDir,
          getWifiUploadHtml(i18n.language, Platform.OS),
        );
        _serverUrl = result.url;
        _serverPort = p;
        _serverStarted = true;
        setServerUrl(result.url);
        setPort(p);
      } catch (e: any) {
        setError(e.message || t('wifiTransfer.startError'));
        _serverUrl = null;
        setServerUrl(null);
      }
    },
    [musicDir, t],
  );

  useEffect(() => {
    _isScreenMounted = true;
    cancelBgImportTimer();

    // If server already running (returning to screen), just sync state
    if (_serverStarted && _serverUrl) {
      setServerUrl(_serverUrl);
      setPort(_serverPort);
      setReceivedFiles([..._receivedFiles]);
      setClientConnected(_clientConnected);
    } else {
      startServer(DEFAULT_PORT);
    }

    ensureEventListener();
    _onUpdate = syncFromGlobal;

    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ]),
    );
    anim.start();

    return () => {
      _isScreenMounted = false;
      _onUpdate = null;
      anim.stop();
      // Server intentionally NOT stopped — keeps running in background
      // Schedule auto-import if there are received files
      if (_receivedFiles.length > 0 && _serverStarted) {
        scheduleBgImport();
      }
    };
  }, []);

  const handleSwitchPort = () => {
    const idx = PORT_OPTIONS.indexOf(port);
    const newPort = PORT_OPTIONS[(idx + 1) % PORT_OPTIONS.length];
    startServer(newPort);
  };

  const handleCopyUrl = () => {
    if (!serverUrl) return;
    NativeModules.WifiTransferModule.copyToClipboard(serverUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleComplete = async () => {
    setIsImporting(true);
    try {
      const fileCount = receivedFiles.length;
      cleanupWifiServer();
      if (fileCount > 0) {
        // Only scan the WiFi upload directory — do NOT import iPod library
        if (Platform.OS === 'ios') {
          await dispatch(
            importiOSMediaLibrary({
              includeIPod: false,
              localDirs: [musicDir],
              localFiles: [],
            }),
          );
        } else {
          await dispatch(scanMusic([musicDir]));
        }
      }
      goToAllSongs();
    } catch {
      goToAllSongs();
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.4],
  });
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 0],
  });

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bg }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Icon name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('wifiTransfer.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        {/* Connection status */}
        <View style={styles.statusSection}>
          <View style={styles.pulseContainer}>
            <Animated.View
              style={[
                styles.pulseRing,
                {
                  borderColor: clientConnected ? '#4ade80' : serverUrl ? '#f87171' : colors.textMuted,
                  transform: [{ scale: pulseScale }],
                  opacity: pulseOpacity,
                },
              ]}
            />
            <View
              style={[
                styles.statusDot,
                { backgroundColor: clientConnected ? '#4ade80' : serverUrl ? '#f87171' : colors.textMuted },
              ]}
            />
          </View>
          <Text
            style={[styles.statusLabel, { color: clientConnected ? '#4ade80' : serverUrl ? '#f87171' : colors.textMuted }]}>
            {clientConnected
              ? t('wifiTransfer.status.connected')
              : serverUrl
              ? t('wifiTransfer.status.ready')
              : t('wifiTransfer.status.starting')}
          </Text>
        </View>

        {/* URL Card */}
        {serverUrl && (
          <View
            style={[styles.urlCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.urlLabel, { color: colors.textMuted }]}>
              {t('wifiTransfer.openInBrowser')}
            </Text>
            <Text style={[styles.urlText, { color: colors.accent }]}>{serverUrl}</Text>
            <TouchableOpacity
              style={[styles.copyBtn, { backgroundColor: colors.accentDim }]}
              onPress={handleCopyUrl}
              activeOpacity={0.7}>
              <Icon
                name={copied ? 'checkmark-circle' : 'copy-outline'}
                size={18}
                color={colors.accent}
              />
              <Text style={[styles.copyBtnText, { color: colors.accent }]}>
                {copied ? t('wifiTransfer.copied') : t('wifiTransfer.copyAddress')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Error */}
        {error && (
          <View style={styles.errorCard}>
            <Icon name="warning-outline" size={20} color="#f87171" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={handleSwitchPort}>
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>
                {t('wifiTransfer.switchPort')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tips */}
        <View style={styles.tipsSection}>
          {[
            ['wifi-outline', t('wifiTransfer.tips.sameNetwork')],
            ['phone-portrait-outline', t('wifiTransfer.tips.backgroundSafe')],
            ['musical-notes-outline', t('wifiTransfer.tips.supportedFormats')],
          ].map(([icon, text], i) => (
            <View key={i} style={styles.tipRow}>
              <Icon name={icon} size={15} color={colors.textMuted} />
              <Text style={[styles.tipText, { color: colors.textMuted }]}>{text}</Text>
            </View>
          ))}
        </View>

        {/* Receiving progress bar */}
        {receivedFiles.length > 0 && clientConnected && !isImporting && (
          <View style={[styles.progressCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>
                {t('wifiTransfer.receivingProgress', { count: receivedFiles.filter(f => !f.filename.toLowerCase().endsWith('.lrc')).length })}
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 6 }}>
              {t('wifiTransfer.totalSize', { size: formatSize(receivedFiles.reduce((s, f) => s + f.size, 0)) })}
            </Text>
          </View>
        )}

        {/* Received files */}
        {receivedFiles.length > 0 && (
          <View style={styles.filesSection}>
            <Text style={[styles.filesSectionTitle, { color: colors.textMuted }]}>
              {t('wifiTransfer.receivedFiles', { count: receivedFiles.length })}
            </Text>
            <ScrollView
              nestedScrollEnabled
              style={{ maxHeight: 5 * 60 }}
              showsVerticalScrollIndicator={receivedFiles.length > 5}>
              {receivedFiles.slice().reverse().map((f, i) => (
                <View
                  key={i}
                  style={[
                    styles.fileItem,
                    {
                      backgroundColor: colors.bgCard,
                      borderColor: colors.border,
                    },
                  ]}>
                  <Icon
                    name={
                      f.filename.toLowerCase().endsWith('.lrc')
                        ? 'document-text-outline'
                        : 'musical-note-outline'
                    }
                    size={20}
                    color={colors.accent}
                  />
                  <Text
                    style={[styles.fileName, { color: colors.textPrimary }]}
                    numberOfLines={1}>
                    {f.filename}
                  </Text>
                  <Text style={[styles.fileSize, { color: colors.textMuted }]}>
                    {formatSize(f.size)}
                  </Text>
                  <Icon name="checkmark-circle" size={18} color="#4ade80" />
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { backgroundColor: colors.bg, borderTopColor: colors.border }]}>
        {receivedFiles.length > 0 ? (
          <TouchableOpacity
            style={[styles.completeBtn, { backgroundColor: colors.accent }]}
            onPress={handleComplete}
            disabled={isImporting}
            activeOpacity={0.7}>
            {isImporting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Icon name="checkmark-done" size={20} color="#fff" />
            )}
            <Text style={styles.completeBtnText}>
              {isImporting
                ? t('wifiTransfer.importingToLibrary')
                : t('wifiTransfer.completeImport', { count: receivedFiles.length })}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.switchPortBtn, { borderColor: colors.border }]}
            onPress={handleSwitchPort}
            activeOpacity={0.7}>
            <Icon name="swap-horizontal-outline" size={18} color={colors.textMuted} />
            <Text style={[styles.switchPortText, { color: colors.textMuted }]}>
              {t('wifiTransfer.switchPortWithCurrent', { port })}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  title: { fontSize: 18, fontWeight: '700' },
  content: { paddingHorizontal: 20 },
  statusSection: { alignItems: 'center', marginTop: 20, marginBottom: 32 },
  pulseContainer: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  pulseRing: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
  },
  statusDot: { width: 16, height: 16, borderRadius: 8 },
  statusLabel: { fontSize: 14, fontWeight: '600', marginTop: 14 },
  urlCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  urlLabel: { fontSize: 13, marginBottom: 12 },
  urlText: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  copyBtnText: { fontSize: 14, fontWeight: '600' },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.2)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 24,
  },
  errorText: { flex: 1, fontSize: 13, color: '#f87171' },
  tipsSection: { marginBottom: 28, gap: 10 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tipText: { fontSize: 13 },
  progressCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  filesSection: { marginBottom: 20 },
  filesSectionTitle: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  fileName: { flex: 1, fontSize: 13, fontWeight: '600' },
  fileSize: { fontSize: 12 },
  bottomBar: {
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  completeBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  switchPortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  switchPortText: { fontSize: 14 },
});

export default WifiTransferScreen;
