package com.musicplayer

import com.facebook.react.bridge.*
import org.jaudiotagger.audio.AudioFileIO
import org.jaudiotagger.tag.FieldKey
import org.jaudiotagger.tag.images.ArtworkFactory
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
            if (!file.exists()) {
                promise.reject("TAG_FILE_ERROR", "File not found: $filePath")
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

    @ReactMethod
    fun writeArtwork(filePath: String, imagePath: String, promise: Promise) {
        try {
            val file = File(filePath)
            if (!file.exists()) {
                promise.reject("TAG_FILE_ERROR", "File not found: $filePath")
                return
            }
            val imgFile = File(imagePath)
            if (!imgFile.exists()) {
                promise.reject("TAG_FILE_ERROR", "Image file not found: $imagePath")
                return
            }

            val audioFile = AudioFileIO.read(file)
            val tag = audioFile.tagOrCreateAndSetDefault
            val artwork = ArtworkFactory.createArtworkFromFile(imgFile)
            tag.deleteArtworkField()
            tag.setField(artwork)
            audioFile.commit()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("TAG_WRITE_ERROR", "Failed to write artwork: ${e.message}", e)
        }
    }
}
