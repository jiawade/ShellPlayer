package com.musicplayer

import android.content.Context
import android.media.AudioManager
import android.media.audiofx.BassBoost
import android.media.audiofx.Equalizer
import android.media.audiofx.LoudnessEnhancer
import android.media.audiofx.PresetReverb
import android.media.audiofx.Virtualizer
import com.facebook.react.bridge.*

class EqualizerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "EqualizerModule"

    private var equalizer: Equalizer? = null
    private var bassBoost: BassBoost? = null
    private var virtualizer: Virtualizer? = null
    private var loudnessEnhancer: LoudnessEnhancer? = null
    private var presetReverb: PresetReverb? = null

    private var currentSessionId: Int = 0
    private var lastPresetId: Int = 0
    private var hasBassBoost = false
    private var hasVirtualizer = false

    @ReactMethod
    fun init(audioSessionId: Int, promise: Promise) {
        try {
            val sessionId = if (audioSessionId > 0) audioSessionId else detectAudioSession()

            if (sessionId == currentSessionId && equalizer != null) {
                val result = Arguments.createMap().apply {
                    putBoolean("success", true)
                    putInt("sessionId", sessionId)
                    putInt("bands", equalizer?.numberOfBands?.toInt() ?: 0)
                    putBoolean("hasBassBoost", hasBassBoost)
                    putBoolean("hasVirtualizer", hasVirtualizer)
                    putBoolean("hasLoudness", loudnessEnhancer != null)
                    putBoolean("hasReverb", presetReverb != null)
                }
                promise.resolve(result)
                return
            }

            releaseAll()
            currentSessionId = sessionId

            equalizer = try {
                Equalizer(0, sessionId).apply { enabled = false }
            } catch (_: Exception) { null }

            bassBoost = try {
                BassBoost(0, sessionId).apply { enabled = false }
            } catch (_: Exception) { null }
            hasBassBoost = bassBoost != null

            virtualizer = try {
                Virtualizer(0, sessionId).apply { enabled = false }
            } catch (_: Exception) { null }
            hasVirtualizer = virtualizer != null

            try { loudnessEnhancer = LoudnessEnhancer(sessionId).apply { enabled = false } }
            catch (_: Exception) { loudnessEnhancer = null }

            try { presetReverb = PresetReverb(0, sessionId).apply { enabled = false } }
            catch (_: Exception) { presetReverb = null }

            val result = Arguments.createMap().apply {
                putBoolean("success", true)
                putInt("sessionId", sessionId)
                putInt("bands", equalizer?.numberOfBands?.toInt() ?: 0)
                putBoolean("hasBassBoost", hasBassBoost)
                putBoolean("hasVirtualizer", hasVirtualizer)
                putBoolean("hasLoudness", loudnessEnhancer != null)
                putBoolean("hasReverb", presetReverb != null)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("EQ_INIT_ERROR", "Failed to init equalizer: ${e.message}", e)
        }
    }

    /**
     * 通过反射获取 ExoPlayer 的真实 audioSessionId。
     * 绑定到应用自身的 audio session 才能可靠地施加音效。
     * session 0（全局输出）在 Android 10+ 上被限制，大量设备上无效。
     */
    private fun detectAudioSession(): Int {
        val discovered = AudioSessionHelper.getTrackPlayerSessionId(reactApplicationContext)
        return if (discovered > 0) discovered else 0
    }

    /**
     * 应用预设音效方案
     * presetId: 0=关闭, 1-11=各种预设
     *
     * 每个预设都通过精心调参组合多种音效处理器：
     * - Equalizer: 5 段频率增益 (60Hz, 230Hz, 910Hz, 3600Hz, 14000Hz)
     * - BassBoost: 低音增强 (0-1000)
     * - Virtualizer: 虚拟环绕 (0-1000)
     * - LoudnessEnhancer: 响度增强 (mB, 毫贝)
     * - PresetReverb: 混响预设
     */
    @ReactMethod
    fun applyPreset(presetId: Int, promise: Promise) {
        try {
            lastPresetId = presetId
            applyPresetInternal(presetId)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("EQ_APPLY_ERROR", "Failed to apply preset: ${e.message}", e)
        }
    }

    private fun applyPresetInternal(presetId: Int) {
        if (presetId == 0) {
            disableAll()
            return
        }

        val eq = equalizer ?: return

        val numBands = eq.numberOfBands.toInt()
        val bandRange = eq.bandLevelRange
        val minLevel = bandRange[0].toInt()
        val maxLevel = bandRange[1].toInt()

        val preset = getPresetConfig(presetId)

        // 当 BassBoost 不可用时，通过加强 EQ 低频段补偿
        val bassCompensation = if (!hasBassBoost && preset.bassStrength > 0) {
            // bassStrength 0-1000 映射到 EQ 补偿 0-4 dB
            (preset.bassStrength * 4 / 1000)
        } else 0

        // 当 Virtualizer 不可用时，通过加强 EQ 高频段补偿空间感
        val spatialCompensation = if (!hasVirtualizer && preset.virtualizerStrength > 0) {
            (preset.virtualizerStrength * 3 / 1000)
        } else 0

        // 应用均衡器频段增益
        eq.enabled = true
        val gains = preset.eqGains
        for (i in 0 until minOf(numBands, gains.size)) {
            var gain = gains[i]
            // 补偿低频段 (60Hz, 230Hz)
            if (i <= 1) gain += bassCompensation
            // 补偿高频段 (3600Hz, 14000Hz)
            if (i >= numBands - 2) gain += spatialCompensation
            val targetMb = gain * 100
            val clamped = targetMb.coerceIn(minLevel, maxLevel)
            eq.setBandLevel(i.toShort(), clamped.toShort())
        }

        // 应用低音增强
        bassBoost?.let { bb ->
            if (preset.bassStrength > 0) {
                bb.setStrength(preset.bassStrength.toShort())
                bb.enabled = true
            } else bb.enabled = false
        }

        // 应用虚拟环绕声
        virtualizer?.let { virt ->
            if (preset.virtualizerStrength > 0) {
                virt.setStrength(preset.virtualizerStrength.toShort())
                virt.enabled = true
            } else virt.enabled = false
        }

        // 应用响度增强（当 BassBoost 不可用时额外加强）
        loudnessEnhancer?.let { le ->
            var gain = preset.loudnessGain
            if (!hasBassBoost && preset.bassStrength > 0) {
                gain += (preset.bassStrength * 300 / 1000) // 额外补偿最多 300mB
            }
            if (gain > 0) {
                le.setTargetGain(gain)
                le.enabled = true
            } else le.enabled = false
        }

        // 应用混响
        presetReverb?.let { reverb ->
            if (preset.reverbPreset >= 0) {
                reverb.preset = preset.reverbPreset.toShort()
                reverb.enabled = true
            } else reverb.enabled = false
        }
    }

    /**
     * 获取当前设备支持的均衡器信息
     */
    @ReactMethod
    fun getInfo(promise: Promise) {
        try {
            val eq = equalizer
            if (eq == null) {
                promise.reject("EQ_NOT_INIT", "Equalizer not initialized")
                return
            }

            val bands = Arguments.createArray()
            for (i in 0 until eq.numberOfBands) {
                val band = Arguments.createMap().apply {
                    putInt("index", i)
                    putInt("centerFreq", eq.getCenterFreq(i.toShort()) / 1000) // Hz
                    putInt("currentLevel", eq.getBandLevel(i.toShort()).toInt())
                }
                bands.pushMap(band)
            }

            val result = Arguments.createMap().apply {
                putInt("numberOfBands", eq.numberOfBands.toInt())
                putInt("minLevel", eq.bandLevelRange[0].toInt())
                putInt("maxLevel", eq.bandLevelRange[1].toInt())
                putArray("bands", bands)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("EQ_INFO_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun release(promise: Promise) {
        try {
            releaseAll()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("EQ_RELEASE_ERROR", e.message, e)
        }
    }

    private fun disableAll() {
        equalizer?.enabled = false
        bassBoost?.enabled = false
        virtualizer?.enabled = false
        loudnessEnhancer?.enabled = false
        presetReverb?.enabled = false
    }

    private fun releaseAll() {
        try { equalizer?.release() } catch (_: Exception) {}
        try { bassBoost?.release() } catch (_: Exception) {}
        try { virtualizer?.release() } catch (_: Exception) {}
        try { loudnessEnhancer?.release() } catch (_: Exception) {}
        try { presetReverb?.release() } catch (_: Exception) {}
        equalizer = null
        bassBoost = null
        virtualizer = null
        loudnessEnhancer = null
        presetReverb = null
        currentSessionId = 0
    }

    // ---- 预设定义 ----

    data class PresetConfig(
        val eqGains: List<Int>,        // 5 段 EQ 增益 (dB, -12 到 +12)
        val bassStrength: Int,          // 低音增强 (0-1000)
        val virtualizerStrength: Int,   // 虚拟环绕 (0-1000)
        val loudnessGain: Int,          // 响度增强 (milliBel)
        val reverbPreset: Int           // 混响预设 (-1=关闭)
    )

    private fun getPresetConfig(presetId: Int): PresetConfig {
        return when (presetId) {
            // 1: 3D丽音 - 立体环绕声场
            1 -> PresetConfig(
                eqGains = listOf(4, 2, 0, 2, 5),
                bassStrength = 400,
                virtualizerStrength = 900,
                loudnessGain = 600,
                reverbPreset = PresetReverb.PRESET_LARGEHALL.toInt()
            )
            // 2: 爵士 - 温暖中频增强
            2 -> PresetConfig(
                eqGains = listOf(4, 2, 5, 3, 2),
                bassStrength = 300,
                virtualizerStrength = 200,
                loudnessGain = 300,
                reverbPreset = PresetReverb.PRESET_MEDIUMHALL.toInt()
            )
            // 3: 流行 - 人声突出
            3 -> PresetConfig(
                eqGains = listOf(-2, 3, 6, 4, -1),
                bassStrength = 200,
                virtualizerStrength = 300,
                loudnessGain = 500,
                reverbPreset = -1
            )
            // 4: 摇滚 - 低高音增强
            4 -> PresetConfig(
                eqGains = listOf(6, 3, -2, 4, 7),
                bassStrength = 600,
                virtualizerStrength = 400,
                loudnessGain = 700,
                reverbPreset = -1
            )
            // 5: 古典 - 宽广动态
            5 -> PresetConfig(
                eqGains = listOf(5, 2, 0, 3, 6),
                bassStrength = 100,
                virtualizerStrength = 500,
                loudnessGain = 200,
                reverbPreset = PresetReverb.PRESET_LARGEHALL.toInt()
            )
            // 6: 嘻哈 - 重低音增强
            6 -> PresetConfig(
                eqGains = listOf(8, 5, 0, 2, 3),
                bassStrength = 850,
                virtualizerStrength = 500,
                loudnessGain = 800,
                reverbPreset = -1
            )
            // 7: 电子 - 低+高频提升
            7 -> PresetConfig(
                eqGains = listOf(7, 3, -2, 3, 8),
                bassStrength = 700,
                virtualizerStrength = 600,
                loudnessGain = 600,
                reverbPreset = PresetReverb.PRESET_PLATE.toInt()
            )
            // 8: R&B - 柔和中低频
            8 -> PresetConfig(
                eqGains = listOf(5, 7, 3, 1, -1),
                bassStrength = 500,
                virtualizerStrength = 300,
                loudnessGain = 400,
                reverbPreset = PresetReverb.PRESET_SMALLROOM.toInt()
            )
            // 9: 人声 - 人声频段增强
            9 -> PresetConfig(
                eqGains = listOf(-3, 1, 8, 6, 0),
                bassStrength = 0,
                virtualizerStrength = 200,
                loudnessGain = 500,
                reverbPreset = -1
            )
            // 10: 重低音 - 极致低频
            10 -> PresetConfig(
                eqGains = listOf(10, 8, 2, 0, -2),
                bassStrength = 1000,
                virtualizerStrength = 300,
                loudnessGain = 900,
                reverbPreset = -1
            )
            // 11: 现场 - 模拟现场效果
            11 -> PresetConfig(
                eqGains = listOf(5, 3, 1, 4, 6),
                bassStrength = 400,
                virtualizerStrength = 800,
                loudnessGain = 500,
                reverbPreset = PresetReverb.PRESET_LARGEROOM.toInt()
            )
            // 默认: 关闭
            else -> PresetConfig(
                eqGains = listOf(0, 0, 0, 0, 0),
                bassStrength = 0,
                virtualizerStrength = 0,
                loudnessGain = 0,
                reverbPreset = -1
            )
        }
    }
}
