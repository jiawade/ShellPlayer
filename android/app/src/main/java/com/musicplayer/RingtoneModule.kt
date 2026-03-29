package com.musicplayer

import android.content.ContentValues
import android.content.Intent
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.provider.Settings
import com.facebook.react.bridge.*
import java.io.File
import java.io.FileInputStream

class RingtoneModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "RingtoneModule"

    @ReactMethod
    fun setAsRingtone(filePath: String, title: String, promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
                !Settings.System.canWrite(reactContext)
            ) {
                val intent = Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS).apply {
                    data = Uri.parse("package:" + reactContext.packageName)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactContext.startActivity(intent)
                promise.reject("PERMISSION_NEEDED", "Need WRITE_SETTINGS permission")
                return
            }

            val file = File(filePath)
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "File not found: $filePath")
                return
            }

            val mimeType = when {
                filePath.endsWith(".mp3", true) -> "audio/mpeg"
                filePath.endsWith(".m4a", true) || filePath.endsWith(".aac", true) -> "audio/mp4"
                filePath.endsWith(".ogg", true) || filePath.endsWith(".opus", true) -> "audio/ogg"
                filePath.endsWith(".flac", true) -> "audio/flac"
                filePath.endsWith(".wav", true) -> "audio/wav"
                filePath.endsWith(".webm", true) -> "audio/webm"
                else -> "audio/*"
            }

            val resolver = reactContext.contentResolver

            // Remove existing entry with same title to avoid duplicates
            resolver.delete(
                MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
                "${MediaStore.MediaColumns.DISPLAY_NAME} = ?",
                arrayOf(file.name)
            )

            val values = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, file.name)
                put(MediaStore.MediaColumns.TITLE, title)
                put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
                put(MediaStore.Audio.Media.IS_RINGTONE, true)
                put(MediaStore.Audio.Media.IS_ALARM, false)
                put(MediaStore.Audio.Media.IS_NOTIFICATION, false)
                put(MediaStore.Audio.Media.IS_MUSIC, false)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    put(MediaStore.MediaColumns.RELATIVE_PATH, "Ringtones/")
                }
            }

            val uri = resolver.insert(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, values)
            if (uri == null) {
                promise.reject("INSERT_FAILED", "Failed to insert into MediaStore")
                return
            }

            // Copy file content
            resolver.openOutputStream(uri)?.use { out ->
                FileInputStream(file).use { input ->
                    input.copyTo(out)
                }
            }

            RingtoneManager.setActualDefaultRingtoneUri(
                reactContext,
                RingtoneManager.TYPE_RINGTONE,
                uri
            )

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SET_RINGTONE_ERROR", e.message, e)
        }
    }
}
