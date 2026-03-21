package com.musicplayer

import com.facebook.react.bridge.ReactApplicationContext

/**
 * 获取 react-native-track-player 内部 ExoPlayer 的 audioSessionId。
 *
 * 通过 patched MusicService.getAudioSessionId() 获取——
 * 不依赖多层反射，可靠性远高于旧方案。
 *
 * 路径: MusicModule → musicService → getAudioSessionId()
 */
object AudioSessionHelper {

    @Volatile
    private var cachedSessionId: Int = 0

    fun getTrackPlayerSessionId(reactContext: ReactApplicationContext): Int {
        if (cachedSessionId > 0) return cachedSessionId

        val sessionId = discoverSessionId(reactContext)
        if (sessionId > 0) cachedSessionId = sessionId
        return sessionId
    }

    fun invalidateCache() {
        cachedSessionId = 0
    }

    private fun discoverSessionId(reactContext: ReactApplicationContext): Int {
        return try {
            // 1. 获取 MusicModule 实例（通过反射绕过泛型类型约束）
            val musicModuleClass = Class.forName(
                "com.doublesymmetry.trackplayer.module.MusicModule"
            )
            val method = reactContext.javaClass.getMethod(
                "getNativeModule", Class::class.java
            )
            val musicModule = method.invoke(reactContext, musicModuleClass)
                ?: return 0

            // 2. 获取 musicService (private lateinit var)
            val serviceField = musicModuleClass.getDeclaredField("musicService")
            serviceField.isAccessible = true
            val musicService = serviceField.get(musicModule) ?: return 0

            // 3. 调用 patched 的 getAudioSessionId()（public 方法）
            val getSessionMethod = musicService.javaClass.getMethod("getAudioSessionId")
            val sid = getSessionMethod.invoke(musicService) as? Int ?: 0
            if (sid > 0) sid else 0
        } catch (_: Exception) {
            0
        }
    }
}
