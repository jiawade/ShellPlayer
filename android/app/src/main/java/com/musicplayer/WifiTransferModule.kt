package com.musicplayer

import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import fi.iki.elonen.NanoHTTPD
import java.io.File
import java.net.Inet4Address
import java.net.NetworkInterface

class WifiTransferModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var server: TransferServer? = null

    override fun getName(): String = "WifiTransferModule"

    @ReactMethod
    fun startServer(port: Int, musicDir: String, html: String, promise: Promise) {
        try {
            server?.stop()
            val mDir = File(musicDir).apply { mkdirs() }
            // Also ensure lrc dir exists (sibling to music dir)
            val lrcDir = File(mDir.parent, "lrc").apply { mkdirs() }
            server = TransferServer(port, mDir, lrcDir, html,
                onFileReceived = { filename, size -> emitFileReceived(filename, size) },
                onClientConnected = { emitClientConnected() }
            )
            server?.start(NanoHTTPD.SOCKET_READ_TIMEOUT, false)

            val ip = getLocalIpAddress()
            promise.resolve(Arguments.createMap().apply {
                putString("ip", ip)
                putInt("port", port)
                putString("url", "http://$ip:$port")
            })
        } catch (e: Exception) {
            promise.reject("START_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopServer(promise: Promise) {
        try {
            server?.stop()
            server = null
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("STOP_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun copyToClipboard(text: String) {
        val clipboard = reactContext.getSystemService(android.content.Context.CLIPBOARD_SERVICE)
            as android.content.ClipboardManager
        val clip = android.content.ClipData.newPlainText("url", text)
        clipboard.setPrimaryClip(clip)
    }

    @ReactMethod
    fun addListener(eventName: String?) {
        // Required for NativeEventEmitter
    }

    @ReactMethod
    fun removeListeners(count: Int?) {
        // Required for NativeEventEmitter
    }

    private fun emitFileReceived(filename: String, size: Long) {
        val params = Arguments.createMap().apply {
            putString("filename", filename)
            putDouble("size", size.toDouble())
        }
        try {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("onWifiFileReceived", params)
        } catch (_: Exception) {}
    }

    private fun emitClientConnected() {
        try {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("onWifiClientConnected", null)
        } catch (_: Exception) {}
    }

    private fun getLocalIpAddress(): String {
        try {
            val interfaces = NetworkInterface.getNetworkInterfaces()
            while (interfaces.hasMoreElements()) {
                val iface = interfaces.nextElement()
                if (iface.isLoopback || !iface.isUp) continue
                val addresses = iface.inetAddresses
                while (addresses.hasMoreElements()) {
                    val addr = addresses.nextElement()
                    if (addr is Inet4Address && !addr.isLoopbackAddress) {
                        return addr.hostAddress ?: continue
                    }
                }
            }
        } catch (_: Exception) {}
        return "0.0.0.0"
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        server?.stop()
        server = null
    }
}

class TransferServer(
    port: Int,
    private val musicDir: File,
    private val lrcDir: File,
    private val htmlContent: String,
    private val onFileReceived: (String, Long) -> Unit,
    private val onClientConnected: () -> Unit
) : NanoHTTPD(port) {

    companion object {
        private val ALLOWED_EXT = setOf(
            "mp3", "flac", "wav", "aac", "m4a", "ogg", "wma",
            "aiff", "alac", "lrc", "opus", "ape", "dsf", "dff"
        )
    }

    override fun serve(session: IHTTPSession): Response {
        return when {
            session.method == Method.GET && session.uri == "/" -> {
                onClientConnected()
                newFixedLengthResponse(Response.Status.OK, "text/html; charset=utf-8", htmlContent)
            }
            session.method == Method.POST && session.uri == "/upload" -> {
                handleUpload(session)
            }
            else -> {
                newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "Not Found")
            }
        }
    }

    private fun handleUpload(session: IHTTPSession): Response {
        val files = HashMap<String, String>()
        try {
            session.parseBody(files)
        } catch (e: Exception) {
            return jsonResponse(Response.Status.INTERNAL_ERROR, """{"error":"Parse error"}""")
        }

        val tmpPath = files["file"]
            ?: return jsonResponse(Response.Status.BAD_REQUEST, """{"error":"No file received"}""")

        // Get original filename: prefer the explicit 'filename' form field (UTF-8 safe)
        var rawName = session.parameters["filename"]?.firstOrNull()
        if (rawName.isNullOrBlank()) {
            rawName = session.parameters["file"]?.firstOrNull()
        }
        // Try to decode if it looks URL-encoded
        if (rawName != null) {
            try {
                rawName = java.net.URLDecoder.decode(rawName, "UTF-8")
            } catch (_: Exception) {}
        }
        if (rawName.isNullOrBlank()) {
            rawName = "unknown_${System.currentTimeMillis()}"
        }

        val safeName = rawName
            .replace(Regex("[/\\\\]"), "_")
            .replace("..", "_")
            .trim()
            .ifEmpty { "unknown_${System.currentTimeMillis()}" }

        // Validate file extension
        val ext = safeName.substringAfterLast('.', "").lowercase()
        if (ext !in ALLOWED_EXT) {
            File(tmpPath).delete()
            return jsonResponse(Response.Status.BAD_REQUEST, """{"error":"Unsupported file type: $ext"}""")
        }

        // Choose destination: LRC files go to lrc dir, audio files go to music dir
        val destDir = if (ext == "lrc") lrcDir else musicDir

        return try {
            val tmpFile = File(tmpPath)
            val destFile = File(destDir, safeName)
            tmpFile.copyTo(destFile, overwrite = true)
            tmpFile.delete()
            onFileReceived(safeName, destFile.length())
            // Return filename as UTF-8 JSON
            val jsonName = safeName
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
            jsonResponse(
                Response.Status.OK,
                """{"success":true,"filename":"$jsonName","size":${destFile.length()}}"""
            )
        } catch (e: Exception) {
            jsonResponse(Response.Status.INTERNAL_ERROR, """{"error":"Save failed: ${e.message}"}""")
        }
    }

    private fun jsonResponse(status: Response.Status, json: String): Response {
        return newFixedLengthResponse(status, "application/json", json)
    }
}
