package io.carcomfort.app

import android.content.Intent
import io.carcomfort.app.navigation.DriverNavigationPlugin
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterFragmentActivity() {
    private val driverNavigationPlugin = DriverNavigationPlugin { this }

    // EventChannel sink — receives events on the Flutter side.
    private var mapResumeSink: EventChannel.EventSink? = null
    // Set to true when we come back from the navigation Activity.
    private var pendingMapResumeEvent = false

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        driverNavigationPlugin.attachTo(flutterEngine)

        // Event channel — fires whenever MainActivity resumes from a native screen
        // (e.g. returning from DriverNavigationActivity) so Flutter can redraw map routes.
        EventChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            MAP_RESUME_CHANNEL,
        ).setStreamHandler(object : EventChannel.StreamHandler {
            override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
                mapResumeSink = events
                // If onResume already fired before Flutter listened, send it now.
                if (pendingMapResumeEvent) {
                    pendingMapResumeEvent = false
                    events?.success("map_resume")
                }
            }
            override fun onCancel(arguments: Any?) {
                mapResumeSink = null
            }
        })
        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            SHARE_CHANNEL,
        ).setMethodCallHandler { call, result ->
            when (call.method) {
                "shareText" -> {
                    val text = call.argument<String>("text")?.trim().orEmpty()
                    if (text.isEmpty()) {
                        result.error("invalid", "Share text is empty", null)
                        return@setMethodCallHandler
                    }
                    val title = call.argument<String>("title") ?: "Share"
                    val sendIntent = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_TEXT, text)
                    }
                    startActivity(Intent.createChooser(sendIntent, title))
                    result.success(true)
                }
                else -> result.notImplemented()
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // Fire a map-resume event so Flutter can redraw stale route annotations
        // after returning from DriverNavigationActivity or any other native screen.
        val sink = mapResumeSink
        if (sink != null) {
            sink.success("map_resume")
        } else {
            pendingMapResumeEvent = true
        }
    }

    companion object {
        private const val SHARE_CHANNEL = "io.carcomfort.app/share"
        const val MAP_RESUME_CHANNEL = "io.carcomfort.app/map_resume"
    }
}
