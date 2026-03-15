// index.js
global.Buffer = global.Buffer || require('buffer').Buffer;

import { AppRegistry } from 'react-native';
import TrackPlayer from 'react-native-track-player';
import App from './App';
import { PlaybackService } from './src/service';
import { name as appName } from './app.json';
import { installGlobalErrorHandler } from './src/utils/crashLogger';

// 安装全局崩溃日志记录
installGlobalErrorHandler();

AppRegistry.registerComponent(appName, () => App);
TrackPlayer.registerPlaybackService(() => PlaybackService);
