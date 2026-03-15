package com.musicplayer

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

    /**
     * 初始化音效引擎，绑定到 audioSessionId
     * audioSessionId 来自 react-native-track-player 的 playback session
     */
    @ReactMethod
    fun init(audioSessionId: Int, promise: Promise) {
        try {
            releaseAll()
            currentSessionId = audioSessionId

            // 创建均衡器 (10 段)
            equalizer = Equalizer(0, audioSessionId).apply {
                enabled = false
            }

            // 低音增强
            bassBoost = BassBoost(0, audioSessionId).apply {
                enabled = false
            }

            // 虚拟环绕声
            virtualizer = Virtualizer(0, audioSessionId).apply {
                enabled = false
            }

            // 响度增强
            try {
                loudnessEnhancer = LoudnessEnhancer(audioSessionId).apply {
                    enabled = false
                }
            } catch (e: Exception) {
                // LoudnessEnhancer 在部分设备不可用
                loudnessEnhancer = null
            }

            // 混响
            try {
                presetReverb = PresetReverb(0, audioSessionId).apply {
                    enabled = false
                }
            } catch (e: Exception) {
                presetReverb = null
            }

            val result = Arguments.createMap().apply {
                putBoolean("success", true)
                putInt("bands", equalizer?.numberOfBands?.toInt() ?: 0)
                putBoolean("hasBassBoost", bassBoost != null)
                putBoolean("hasVirtualizer", virtualizer != null)
                putBoolean("hasLoudness", loudnessEnhancer != null)
                putBoolean("hasReverb", presetReverb != null)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("EQ_INIT_ERROR", "Failed to init equalizer: ${e.message}", e)
        }
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
            if (presetId == 0) {
                // 关闭所有音效
                disableAll()
                promise.resolve(true)
                return
            }

            val eq = equalizer
            if (eq == null) {
                promise.reject("EQ_NOT_INIT", "Equalizer not initialized")
                return
            }

            val numBands = eq.numberOfBands.toInt()
            val bandRange = eq.bandLevelRange
            val minLevel = bandRange[0].toInt()
            val maxLevel = bandRange[1].toInt()

            // 获取预设参数
            val preset = getPresetConfig(presetId)

            // 应用均衡器频段增益
            eq.enabled = true
            val gains = preset.eqGains
            for (i in 0 until minOf(numBands, gains.size)) {
                // 将 -12..+12 dB 映射到设备支持的 minLevel..maxLevel (单位 milliBel)
                val targetMb = gains[i] * 100 // dB -> milliBel
                val clamped = targetMb.coerceIn(minLevel, maxLevel)
                eq.setBandLevel(i.toShort(), clamped.toShort())
            }

            // 应用低音增强
            bassBoost?.let { bb ->
                if (preset.bassStrength > 0) {
                    bb.setStrength(preset.bassStrength.toShort())
                    bb.enabled = true
                } else {
                    bb.enabled = false
                }
            }

            // 应用虚拟环绕声
            virtualizer?.let { virt ->
                if (preset.virtualizerStrength > 0) {
                    virt.setStrength(preset.virtualizerStrength.toShort())
                    virt.enabled = true
                } else {
                    virt.enabled = false
                }
            }

            // 应用响度增强
            loudnessEnhancer?.let { le ->
                if (preset.loudnessGain > 0) {
                    le.setTargetGain(preset.loudnessGain)
                    le.enabled = true
                } else {
                    le.enabled = false
                }
            }

            // 应用混响
            presetReverb?.let { reverb ->
                if (preset.reverbPreset >= 0) {
                    reverb.preset = preset.reverbPreset.toShort()
                    reverb.enabled = true
                } else {
                    reverb.enabled = false
                }
            }

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("EQ_APPLY_ERROR", "Failed to apply preset: ${e.message}", e)
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
