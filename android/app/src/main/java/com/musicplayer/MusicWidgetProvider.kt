package com.musicplayer

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.widget.RemoteViews
import java.io.File

class MusicWidgetProvider : AppWidgetProvider() {

    companion object {
        const val ACTION_PLAY_PAUSE = "com.musicplayer.WIDGET_PLAY_PAUSE"
        const val ACTION_NEXT = "com.musicplayer.WIDGET_NEXT"
        const val ACTION_PREV = "com.musicplayer.WIDGET_PREV"

        fun updateAllWidgets(context: Context) {
            val mgr = AppWidgetManager.getInstance(context)
            val comp = ComponentName(context, MusicWidgetProvider::class.java)
            val ids = mgr.getAppWidgetIds(comp)
            val provider = MusicWidgetProvider()
            for (id in ids) {
                provider.updateWidget(context, mgr, id)
            }
        }
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (id in appWidgetIds) {
            updateWidget(context, appWidgetManager, id)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        when (intent.action) {
            ACTION_PLAY_PAUSE -> dispatchMediaAction(context, "play_pause")
            ACTION_NEXT -> dispatchMediaAction(context, "next")
            ACTION_PREV -> dispatchMediaAction(context, "prev")
        }
    }

    private fun updateWidget(context: Context, appWidgetManager: AppWidgetManager, widgetId: Int) {
        val views = RemoteViews(context.packageName, R.layout.widget_music_player)

        val prefs = context.getSharedPreferences("MusicWidgetPrefs", Context.MODE_PRIVATE)
        val title = prefs.getString("title", "Music X") ?: "Music X"
        val artist = prefs.getString("artist", "") ?: ""
        val isPlaying = prefs.getBoolean("isPlaying", false)
        val progress = prefs.getInt("progress", 0)  // 0-1000

        views.setTextViewText(R.id.widget_title, title)
        views.setTextViewText(R.id.widget_artist, artist.ifEmpty { "Music X" })

        views.setImageViewResource(
            R.id.widget_play_pause,
            if (isPlaying) R.drawable.ic_widget_pause else R.drawable.ic_widget_play
        )

        views.setProgressBar(R.id.widget_progress, 1000, progress, false)

        // Load artwork from internal storage file (written by MusicWidgetModule)
        var artworkSet = false
        try {
            val artworkFile = File(context.filesDir, "widget_artwork.jpg")
            if (artworkFile.exists()) {
                val bmp = BitmapFactory.decodeFile(artworkFile.absolutePath)
                if (bmp != null) {
                    views.setImageViewBitmap(R.id.widget_artwork, bmp)
                    artworkSet = true
                }
            }
        } catch (_: Exception) {}
        if (!artworkSet) {
            views.setImageViewResource(R.id.widget_artwork, R.mipmap.ic_launcher_round)
        }

        views.setOnClickPendingIntent(R.id.widget_play_pause, getPendingIntent(context, ACTION_PLAY_PAUSE))
        views.setOnClickPendingIntent(R.id.widget_next, getPendingIntent(context, ACTION_NEXT))
        views.setOnClickPendingIntent(R.id.widget_prev, getPendingIntent(context, ACTION_PREV))

        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        if (launchIntent != null) {
            val launchPI = PendingIntent.getActivity(
                context, 0, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_artwork, launchPI)
        }

        appWidgetManager.updateAppWidget(widgetId, views)
    }

    private fun getPendingIntent(context: Context, action: String): PendingIntent {
        val intent = Intent(context, MusicWidgetProvider::class.java).apply {
            this.action = action
        }
        return PendingIntent.getBroadcast(
            context, action.hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun dispatchMediaAction(context: Context, action: String) {
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as? android.media.AudioManager
        if (audioManager != null) {
            val keyCode = when (action) {
                "play_pause" -> android.view.KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE
                "next" -> android.view.KeyEvent.KEYCODE_MEDIA_NEXT
                "prev" -> android.view.KeyEvent.KEYCODE_MEDIA_PREVIOUS
                else -> return
            }
            val downEvent = android.view.KeyEvent(android.view.KeyEvent.ACTION_DOWN, keyCode)
            val upEvent = android.view.KeyEvent(android.view.KeyEvent.ACTION_UP, keyCode)
            audioManager.dispatchMediaKeyEvent(downEvent)
            audioManager.dispatchMediaKeyEvent(upEvent)
        }

        // Immediately toggle play/pause icon for instant visual feedback
        if (action == "play_pause") {
            val prefs = context.getSharedPreferences("MusicWidgetPrefs", Context.MODE_PRIVATE)
            val wasPlaying = prefs.getBoolean("isPlaying", false)
            prefs.edit().putBoolean("isPlaying", !wasPlaying).commit()
            updateAllWidgets(context)
        }
    }

    private fun launchAppWithAction(context: Context, action: String) {
        val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
            putExtra("widget_action", action)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        if (intent != null) {
            context.startActivity(intent)
        }
    }
}
