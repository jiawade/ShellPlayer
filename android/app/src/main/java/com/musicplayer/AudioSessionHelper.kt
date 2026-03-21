package com.musicplayer

import com.facebook.react.bridge.ReactApplicationContext

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
            val musicModuleClass = Class.forName(
                "com.doublesymmetry.trackplayer.module.MusicModule"
            )
            val method = reactContext.javaClass.getMethod(
                "getNativeModule", Class::class.java
            )
            val musicModule = method.invoke(reactContext, musicModuleClass)
                ?: return 0

            val serviceField = musicModuleClass.getDeclaredField("musicService")
            serviceField.isAccessible = true
            val musicService = serviceField.get(musicModule) ?: return 0

            val getSessionMethod = musicService.javaClass.getMethod("getAudioSessionId")
            val sid = getSessionMethod.invoke(musicService) as? Int ?: 0
            if (sid > 0) sid else 0
        } catch (_: Exception) {
            0
        }
    }
}
