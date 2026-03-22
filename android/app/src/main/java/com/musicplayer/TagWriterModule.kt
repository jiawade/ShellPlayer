package com.musicplayer

import com.facebook.react.bridge.*
import org.jaudiotagger.audio.AudioFileIO
import org.jaudiotagger.tag.FieldKey
import java.io.File
import java.util.logging.Logger

class TagWriterModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "TagWriterModule"

    init {
        // Suppress jaudiotagger verbose logging
        Logger.getLogger("org.jaudiotagger").level = java.util.logging.Level.OFF
    }

    @ReactMethod
    fun writeMetadata(filePath: String, tags: ReadableMap, promise: Promise) {
        try {
            val file = File(filePath)
            if (!file.exists() || !file.canWrite()) {
                promise.reject("TAG_FILE_ERROR", "File not found or not writable: $filePath")
                return
            }

            val audioFile = AudioFileIO.read(file)
            val tag = audioFile.tagOrCreateAndSetDefault

            if (tags.hasKey("title")) {
                tag.setField(FieldKey.TITLE, tags.getString("title") ?: "")
            }
            if (tags.hasKey("artist")) {
                tag.setField(FieldKey.ARTIST, tags.getString("artist") ?: "")
            }
            if (tags.hasKey("album")) {
                tag.setField(FieldKey.ALBUM, tags.getString("album") ?: "")
            }

            audioFile.commit()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("TAG_WRITE_ERROR", "Failed to write tags: ${e.message}", e)
        }
    }
}
