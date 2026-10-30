package io.carcomfort.app.navigation

import android.content.Intent
import android.os.Build
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

class DriverNavigationPlugin(
    private val activityProvider: () -> android.app.Activity?,
) {
    fun attachTo(engine: FlutterEngine) {
        MethodChannel(
            engine.dartExecutor.binaryMessenger,
            CHANNEL,
        ).setMethodCallHandler(::onMethodCall)
    }

    private fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "startNavigation" -> startNavigation(call, result)
            "stopNavigation" -> {
                activityProvider()?.let { activity ->
                    activity.sendBroadcast(
                        Intent(DriverNavigationLauncher.ACTION_STOP_NAVIGATION),
                    )
                }
                result.success(true)
            }
            else -> result.notImplemented()
        }
    }

    @Suppress("UNCHECKED_CAST")
    private fun startNavigation(call: MethodCall, result: MethodChannel.Result) {
        val activity = activityProvider()
        if (activity == null) {
            result.success(false)
            return
        }

        val args = call.arguments as? Map<String, Any?>
        val token = args?.get("accessToken") as? String
        val rawList = args?.get("waypoints") as? List<Map<String, Any?>>
        if (rawList.isNullOrEmpty() || rawList.size < 2) {
            result.success(false)
            return
        }

        val waypoints = ArrayList<NavigationWaypoint>()
        for (item in rawList) {
            val name = (item["name"] as? String).orEmpty()
            val lat = (item["latitude"] as? Number)?.toDouble()
            val lng = (item["longitude"] as? Number)?.toDouble()
            val isSilent = item["isSilent"] as? Boolean ?: false
            if (lat == null || lng == null) continue
            waypoints.add(NavigationWaypoint(name, lng, lat, isSilent))
        }

        if (waypoints.size < 2) {
            result.success(false)
            return
        }

        DriverNavigationLauncher.startNavigation(activity, waypoints, token)
        result.success(true)
    }

    companion object {
        const val CHANNEL = "io.carcomfort.app/driver_navigation"
    }
}

object DriverNavigationLauncher {
    const val ACTION_STOP_NAVIGATION = "io.carcomfort.app.STOP_DRIVER_NAVIGATION"

    fun startNavigation(
        activity: android.app.Activity,
        waypoints: ArrayList<NavigationWaypoint>,
        accessToken: String?,
    ) {
        val intent = Intent(activity, DriverNavigationActivity::class.java).apply {
            putExtra(DriverNavigationActivity.EXTRA_WAYPOINTS, waypoints)
            if (!accessToken.isNullOrBlank()) {
                putExtra(DriverNavigationActivity.EXTRA_ACCESS_TOKEN, accessToken)
            }
        }
        activity.startActivity(intent)
    }
}
