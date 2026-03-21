package com.musicplayer

import android.media.AudioManager
import android.media.audiofx.Visualizer
import android.content.Context
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.Timer
import java.util.TimerTask
import kotlin.math.sqrt
import kotlin.math.min
import kotlin.math.abs

class AudioLevelModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "AudioLevelModule"

    private var visualizer: Visualizer? = null
    private var emitTimer: Timer? = null
    private var isMonitoring = false

    private val numBands = 16
    @Volatile private var bandLevels = FloatArray(numBands)
    @Volatile private var overallLevel = 0f
    @Volatile private var hasData = false

    @ReactMethod
    fun startMonitoring(promise: Promise) {
        try {
            stopInternal()

            // Use session 0 to capture global audio output
            val vis = Visualizer(0)
            vis.captureSize = Visualizer.getCaptureSizeRange()[1] // max capture size
            vis.setDataCaptureListener(object : Visualizer.OnDataCaptureListener {
                override fun onWaveFormDataCapture(v: Visualizer?, waveform: ByteArray?, samplingRate: Int) {
                    if (waveform == null) return
                    processWaveform(waveform)
                }

                override fun onFftDataCapture(v: Visualizer?, fft: ByteArray?, samplingRate: Int) {
                    if (fft == null) return
                    processFft(fft)
                }
            }, Visualizer.getMaxCaptureRate(), true, true)

            vis.enabled = true
            visualizer = vis

            // Emit timer at ~20Hz
            emitTimer = Timer().apply {
                scheduleAtFixedRate(object : TimerTask() {
                    override fun run() {
                        emitLevels()
                    }
                }, 0, 50)
            }

            isMonitoring = true
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("AUDIO_LEVEL_ERROR", "Failed to start monitoring: ${e.message}", e)
        }
    }

    @ReactMethod
    fun stopMonitoring(promise: Promise) {
        try {
            stopInternal()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("AUDIO_LEVEL_ERROR", "Failed to stop monitoring: ${e.message}", e)
        }
    }

    private fun stopInternal() {
        emitTimer?.cancel()
        emitTimer = null

        try {
            visualizer?.enabled = false
            visualizer?.release()
        } catch (_: Exception) {}
        visualizer = null

        isMonitoring = false
        hasData = false
        bandLevels = FloatArray(numBands)
        overallLevel = 0f
    }

    private fun processWaveform(waveform: ByteArray) {
        // Compute RMS from unsigned 8-bit waveform (128 = zero crossing)
        var sumSq = 0.0
        for (b in waveform) {
            val sample = (b.toInt() and 0xFF) - 128
            sumSq += sample.toDouble() * sample.toDouble()
        }
        val rms = sqrt(sumSq / waveform.size)
        overallLevel = min(1f, (rms / 80.0).toFloat()) // normalize: max ~128, typical loud ~80
    }

    private fun processFft(fft: ByteArray) {
        // FFT data: pairs of (real, imaginary) for each frequency bin
        val n = fft.size / 2
        if (n < 2) return

        val magnitudes = FloatArray(n)
        for (i in 0 until n) {
            val real = fft[2 * i].toFloat()
            val imag = fft[2 * i + 1].toFloat()
            magnitudes[i] = sqrt(real * real + imag * imag)
        }

        // Distribute frequency bins across our 16 bands (logarithmic scale)
        val newLevels = FloatArray(numBands)
        for (band in 0 until numBands) {
            // Logarithmic frequency mapping
            val lowBin = (n.toFloat() * Math.pow((band.toDouble() / numBands), 1.8)).toInt().coerceIn(0, n - 1)
            val highBin = (n.toFloat() * Math.pow(((band + 1).toDouble() / numBands), 1.8)).toInt().coerceIn(lowBin + 1, n)

            var sum = 0f
            var count = 0
            for (i in lowBin until highBin) {
                sum += magnitudes[i]
                count++
            }
            if (count > 0) {
                val avg = sum / count
                newLevels[band] = min(1f, avg / 60f) // normalize
            }
        }

        bandLevels = newLevels
        hasData = true
    }

    private fun emitLevels() {
        if (!hasData) return

        val params = Arguments.createMap()
        val levels = Arguments.createArray()
        for (l in bandLevels) {
            levels.pushDouble(l.toDouble())
        }
        params.putArray("levels", levels)
        params.putDouble("overall", overallLevel.toDouble())

        // System music volume (0..1)
        try {
            val am = reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val cur = am.getStreamVolume(AudioManager.STREAM_MUSIC)
            val max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
            params.putDouble("volume", if (max > 0) cur.toDouble() / max.toDouble() else 0.0)
        } catch (_: Exception) {
            params.putDouble("volume", 1.0)
        }

        try {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("onAudioLevels", params)
        } catch (_: Exception) {}
    }

    @ReactMethod
    fun addListener(eventName: String?) {
        // Required for NativeEventEmitter
    }

    @ReactMethod
    fun removeListeners(count: Int?) {
        // Required for NativeEventEmitter
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        stopInternal()
    }
}
