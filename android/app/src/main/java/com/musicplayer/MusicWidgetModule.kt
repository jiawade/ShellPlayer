package com.musicplayer

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import com.facebook.react.bridge.*
import java.io.File
import java.io.FileOutputStream

class MusicWidgetModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "MusicWidgetModule"

    @ReactMethod
    fun updateWidget(title: String, artist: String, isPlaying: Boolean, artworkPath: String?, progress: Double, trackChanged: Boolean) {
        val prefs = reactContext.getSharedPreferences("MusicWidgetPrefs", Context.MODE_PRIVATE)
        prefs.edit().apply {
            putString("title", title)
            putString("artist", artist)
            putBoolean("isPlaying", isPlaying)
            putInt("progress", (progress * 1000).toInt().coerceIn(0, 1000))
            commit()
        }

        // Only copy artwork file when track actually changes
        if (trackChanged && artworkPath != null && artworkPath.isNotEmpty()) {
            try {
                val src = File(artworkPath)
                if (src.exists()) {
                    val opts = BitmapFactory.Options().apply { inSampleSize = 2 }
                    val bmp = BitmapFactory.decodeFile(artworkPath, opts)
                    if (bmp != null) {
                        val dest = File(reactContext.filesDir, "widget_artwork.jpg")
                        FileOutputStream(dest).use { out ->
                            bmp.compress(Bitmap.CompressFormat.JPEG, 80, out)
                        }
                        bmp.recycle()
                    }
                }
            } catch (_: Exception) {}
        } else if (trackChanged && artworkPath == null) {
            // Track changed but no artwork — remove cached file
            try { File(reactContext.filesDir, "widget_artwork.jpg").delete() } catch (_: Exception) {}
        }

        MusicWidgetProvider.updateAllWidgets(reactContext)
    }
}
