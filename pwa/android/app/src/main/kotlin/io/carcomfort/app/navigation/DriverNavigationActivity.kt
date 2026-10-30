package io.carcomfort.app.navigation

import android.Manifest
import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.util.Log
import android.view.View
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.android.material.button.MaterialButton
import com.mapbox.api.directions.v5.DirectionsCriteria
import com.mapbox.api.directions.v5.models.RouteOptions
import com.mapbox.bindgen.Expected
import com.mapbox.common.MapboxOptions
import com.mapbox.common.location.Location
import com.mapbox.maps.ImageHolder
import com.mapbox.maps.MapView
import com.mapbox.maps.plugin.LocationPuck2D
import com.mapbox.maps.plugin.PuckBearing
import com.mapbox.maps.plugin.animation.camera
import com.mapbox.maps.plugin.gestures.gestures
import com.mapbox.maps.plugin.locationcomponent.location
import com.mapbox.navigation.ui.maps.R as NavigationMapsR
import com.mapbox.navigation.base.ExperimentalPreviewMapboxNavigationAPI
import com.mapbox.navigation.base.extensions.applyDefaultNavigationOptions
import com.mapbox.navigation.base.extensions.applyLanguageAndVoiceUnitOptions
import com.mapbox.navigation.base.formatter.DistanceFormatterOptions
import com.mapbox.navigation.base.options.NavigationOptions
import com.mapbox.navigation.base.route.NavigationRoute
import com.mapbox.navigation.base.route.NavigationRouterCallback
import com.mapbox.navigation.base.route.RouterFailure
import com.mapbox.navigation.base.route.RouterOrigin
import com.mapbox.navigation.core.MapboxNavigation
import com.mapbox.navigation.core.directions.session.RoutesObserver
import com.mapbox.navigation.core.lifecycle.MapboxNavigationApp
import com.mapbox.navigation.core.lifecycle.MapboxNavigationObserver
import com.mapbox.navigation.core.lifecycle.requireMapboxNavigation
import com.mapbox.navigation.core.trip.session.LocationMatcherResult
import com.mapbox.navigation.core.trip.session.LocationObserver
import com.mapbox.navigation.core.trip.session.RouteProgressObserver
import com.mapbox.navigation.core.trip.session.VoiceInstructionsObserver
import com.mapbox.navigation.tripdata.progress.api.MapboxTripProgressApi
import com.mapbox.navigation.tripdata.progress.model.DistanceRemainingFormatter
import com.mapbox.navigation.tripdata.progress.model.EstimatedTimeToArrivalFormatter
import com.mapbox.navigation.tripdata.progress.model.TimeRemainingFormatter
import com.mapbox.navigation.tripdata.progress.model.TripProgressUpdateFormatter
import com.mapbox.navigation.ui.base.util.MapboxNavigationConsumer
import com.mapbox.navigation.ui.maps.NavigationStyles
import com.mapbox.navigation.ui.maps.camera.NavigationCamera
import com.mapbox.navigation.ui.maps.camera.data.MapboxNavigationViewportDataSource
import com.mapbox.navigation.ui.maps.location.NavigationLocationProvider
import com.mapbox.navigation.ui.maps.route.line.api.MapboxRouteLineApi
import com.mapbox.navigation.ui.maps.route.line.api.MapboxRouteLineView
import com.mapbox.navigation.ui.maps.route.line.model.MapboxRouteLineApiOptions
import com.mapbox.navigation.ui.maps.route.line.model.MapboxRouteLineViewOptions
import com.mapbox.navigation.voice.api.MapboxSpeechApi
import com.mapbox.navigation.voice.api.MapboxVoiceInstructionsPlayer
import com.mapbox.navigation.voice.model.SpeechAnnouncement
import com.mapbox.navigation.voice.model.SpeechError
import com.mapbox.navigation.voice.model.SpeechValue
import com.mapbox.navigation.voice.model.SpeechVolume
import io.carcomfort.app.R
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * In-app Mapbox Navigation SDK v3 turn-by-turn (Maps SDK v11 — compatible with mapbox_maps_flutter).
 */
@OptIn(ExperimentalPreviewMapboxNavigationAPI::class)
class DriverNavigationActivity : AppCompatActivity() {

    private lateinit var mapView: MapView
    private lateinit var topInstructionCard: LinearLayout
    private lateinit var maneuverIcon: ImageView
    private lateinit var primaryInstruction: TextView
    private lateinit var thenRow: LinearLayout
    private lateinit var thenInstruction: TextView
    private lateinit var voiceToggleButton: ImageButton
    private lateinit var bottomSheet: LinearLayout
    private lateinit var etaLabel: TextView
    private lateinit var tripDetailLabel: TextView
    private lateinit var recenterButton: MaterialButton
    private lateinit var closeButton: ImageButton
    private lateinit var viewportDataSource: MapboxNavigationViewportDataSource
    private lateinit var navigationCamera: NavigationCamera
    private lateinit var routeLineApi: MapboxRouteLineApi
    private lateinit var routeLineView: MapboxRouteLineView
    private lateinit var tripProgressApi: MapboxTripProgressApi
    private lateinit var speechApi: MapboxSpeechApi
    private lateinit var voiceInstructionsPlayer: MapboxVoiceInstructionsPlayer
    private lateinit var errorBanner: TextView

    private val navigationLocationProvider = NavigationLocationProvider()
    private var waypointSet: NavigationWaypointSet? = null
    private var routeRequested = false
    private var textToSpeech: TextToSpeech? = null
    private var pendingTtsText: String? = null
    private var isVoiceInstructionsMuted = false
        set(value) {
            field = value
            if (::voiceInstructionsPlayer.isInitialized) {
                voiceInstructionsPlayer.volume(if (value) SpeechVolume(0f) else SpeechVolume(1f))
            }
            if (::voiceToggleButton.isInitialized) {
                voiceToggleButton.setImageResource(
                    if (value) {
                        android.R.drawable.ic_lock_silent_mode
                    } else {
                        android.R.drawable.ic_lock_silent_mode_off
                    },
                )
            }
        }

    private val stopReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            finish()
        }
    }

    private val routesObserver = RoutesObserver { routeUpdateResult ->
        if (routeUpdateResult.navigationRoutes.isEmpty()) return@RoutesObserver
        routeLineApi.setNavigationRoutes(routeUpdateResult.navigationRoutes) { drawData ->
            mapView.mapboxMap.style?.apply {
                routeLineView.renderRouteDrawData(this, drawData)
            }
        }
        viewportDataSource.onRouteChanged(routeUpdateResult.navigationRoutes.first())
        viewportDataSource.evaluate()
        navigationCamera.requestNavigationCameraToOverview()
        showNavigationChrome()
    }

    private val locationObserver = object : LocationObserver {
        override fun onNewRawLocation(rawLocation: Location) {}

        override fun onNewLocationMatcherResult(locationMatcherResult: LocationMatcherResult) {
            val enhancedLocation = locationMatcherResult.enhancedLocation
            navigationLocationProvider.changePosition(
                enhancedLocation,
                locationMatcherResult.keyPoints,
            )
            viewportDataSource.onLocationChanged(enhancedLocation)
            viewportDataSource.evaluate()
            navigationCamera.requestNavigationCameraToFollowing()
            recenterButton.visibility = View.GONE
        }
    }

    private val routeProgressObserver = RouteProgressObserver { routeProgress ->
        updateDirectionBanner(routeProgress)
        updateTripSummary(routeProgress)
        viewportDataSource.onRouteProgressChanged(routeProgress)
        viewportDataSource.evaluate()
    }

    private val speechCallback =
        MapboxNavigationConsumer<Expected<SpeechError, SpeechValue>> { expected ->
            expected.fold(
                { error ->
                    voiceInstructionsPlayer.play(
                        error.fallback,
                        voiceInstructionsPlayerCallback,
                    )
                },
                { value ->
                    voiceInstructionsPlayer.play(
                        value.announcement,
                        voiceInstructionsPlayerCallback,
                    )
                },
            )
        }

    private val voiceInstructionsPlayerCallback =
        MapboxNavigationConsumer<SpeechAnnouncement> { announcement ->
            speechApi.clean(announcement)
        }

    private val voiceInstructionsObserver = VoiceInstructionsObserver { voiceInstructions ->
        speechApi.generate(voiceInstructions, speechCallback)
    }

    private val mapboxNavigation: MapboxNavigation by requireMapboxNavigation(
        onResumedObserver = object : MapboxNavigationObserver {
            @SuppressLint("MissingPermission")
            override fun onAttached(mapboxNavigation: MapboxNavigation) {
                mapboxNavigation.registerRoutesObserver(routesObserver)
                mapboxNavigation.registerLocationObserver(locationObserver)
                mapboxNavigation.registerRouteProgressObserver(routeProgressObserver)
                mapboxNavigation.registerVoiceInstructionsObserver(voiceInstructionsObserver)
                mapboxNavigation.startTripSession()
            }

            override fun onDetached(mapboxNavigation: MapboxNavigation) {
                mapboxNavigation.unregisterRoutesObserver(routesObserver)
                mapboxNavigation.unregisterLocationObserver(locationObserver)
                mapboxNavigation.unregisterRouteProgressObserver(routeProgressObserver)
                mapboxNavigation.unregisterVoiceInstructionsObserver(voiceInstructionsObserver)
            }
        },
        onInitialize = ::initNavigation,
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_driver_navigation)

        val token = intent.getStringExtra(EXTRA_ACCESS_TOKEN).orEmpty().ifBlank {
            getString(R.string.mapbox_access_token)
        }
        if (token.isNotBlank()) {
            MapboxOptions.accessToken = token
        }

        mapView = findViewById(R.id.mapView)
        topInstructionCard = findViewById(R.id.topInstructionCard)
        maneuverIcon = findViewById(R.id.maneuverIcon)
        primaryInstruction = findViewById(R.id.primaryInstruction)
        thenRow = findViewById(R.id.thenRow)
        thenInstruction = findViewById(R.id.thenInstruction)
        voiceToggleButton = findViewById(R.id.voiceToggleButton)
        bottomSheet = findViewById(R.id.bottomSheet)
        etaLabel = findViewById(R.id.etaLabel)
        tripDetailLabel = findViewById(R.id.tripDetailLabel)
        recenterButton = findViewById(R.id.recenterButton)
        closeButton = findViewById(R.id.closeButton)
        errorBanner = findViewById(R.id.errorBanner)

        val locale = Locale.US
        speechApi = MapboxSpeechApi(this, locale.toLanguageTag())
        voiceInstructionsPlayer = MapboxVoiceInstructionsPlayer(this, locale.toLanguageTag())
        textToSpeech = TextToSpeech(this) { status ->
            if (status == TextToSpeech.SUCCESS) {
                textToSpeech?.language = locale
                pendingTtsText?.let { pending ->
                    pendingTtsText = null
                    speakFallback(pending)
                }
            }
        }

        closeButton.setOnClickListener { finish() }
        recenterButton.setOnClickListener {
            navigationCamera.requestNavigationCameraToFollowing()
            recenterButton.visibility = View.GONE
        }
        voiceToggleButton.setOnClickListener {
            isVoiceInstructionsMuted = !isVoiceInstructionsMuted
        }
        isVoiceInstructionsMuted = false

        mapView.gestures.addOnMapClickListener {
            recenterButton.visibility = View.VISIBLE
            false
        }

        @Suppress("DEPRECATION")
        val raw = intent.getSerializableExtra(EXTRA_WAYPOINTS) as? ArrayList<NavigationWaypoint>
        val set = NavigationWaypointSet()
        raw?.forEach { set.add(it) }
        if (set.coordinatesList().size < 2) {
            finish()
            return
        }
        waypointSet = set

        routeLineApi = MapboxRouteLineApi(MapboxRouteLineApiOptions.Builder().build())
        routeLineView = MapboxRouteLineView(
            MapboxRouteLineViewOptions.Builder(this).build(),
        )
        val formatterOptions = DistanceFormatterOptions.Builder(applicationContext).build()
        tripProgressApi = MapboxTripProgressApi(
            TripProgressUpdateFormatter.Builder(this)
                .distanceRemainingFormatter(DistanceRemainingFormatter(formatterOptions))
                .timeRemainingFormatter(TimeRemainingFormatter(this))
                .estimatedTimeToArrivalFormatter(EstimatedTimeToArrivalFormatter(this))
                .build(),
        )
        viewportDataSource = MapboxNavigationViewportDataSource(mapView.mapboxMap)
        navigationCamera = NavigationCamera(mapView.mapboxMap, mapView.camera, viewportDataSource)

        mapView.mapboxMap.loadStyle(NavigationStyles.NAVIGATION_DAY_STYLE) {
            ensureLocationPermissionThenRequestRoutes(set)
        }

        val filter = IntentFilter(DriverNavigationLauncher.ACTION_STOP_NAVIGATION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(stopReceiver, filter, RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            registerReceiver(stopReceiver, filter)
        }
    }

    override fun onDestroy() {
        try {
            unregisterReceiver(stopReceiver)
        } catch (_: IllegalArgumentException) {
            // already unregistered
        }
        if (::speechApi.isInitialized) {
            speechApi.cancel()
        }
        if (::routeLineView.isInitialized) {
            routeLineView.cancel()
        }
        if (::routeLineApi.isInitialized) {
            routeLineApi.cancel()
        }
        if (::voiceInstructionsPlayer.isInitialized) {
            voiceInstructionsPlayer.shutdown()
        }
        textToSpeech?.stop()
        textToSpeech?.shutdown()
        textToSpeech = null
        super.onDestroy()
    }

    private fun showNavigationChrome() {
        topInstructionCard.visibility = View.VISIBLE
        bottomSheet.visibility = View.VISIBLE
        recenterButton.visibility = View.GONE
    }

    private fun updateDirectionBanner(routeProgress: com.mapbox.navigation.base.trip.model.RouteProgress) {
        val banner = routeProgress.bannerInstructions
        val primary = banner?.primary()
        val primaryText = primary?.text()?.trim().orEmpty()
        primaryInstruction.text = primaryText.ifBlank { "Continue on route" }
        applyManeuverIcon(primary?.type(), primary?.modifier())

        val subText = banner?.sub()?.text()?.trim().orEmpty()
        if (subText.isNotEmpty()) {
            thenRow.visibility = View.VISIBLE
            thenInstruction.text = subText
        } else {
            thenRow.visibility = View.GONE
        }
    }

    private fun applyManeuverIcon(type: String?, modifier: String?) {
        maneuverIcon.setImageResource(android.R.drawable.ic_menu_directions)
        maneuverIcon.rotation = when (modifier?.lowercase(Locale.US)) {
            "left", "slight left", "sharp left" -> -90f
            "right", "slight right", "sharp right" -> 90f
            "uturn" -> 180f
            else -> when (type?.lowercase(Locale.US)) {
                "arrive" -> 0f
                else -> 0f
            }
        }
    }

    private fun updateTripSummary(routeProgress: com.mapbox.navigation.base.trip.model.RouteProgress) {
        val durationSeconds = routeProgress.durationRemaining
        val minutes = max(1, (durationSeconds / 60.0).roundToInt())
        etaLabel.text = getString(R.string.eta_minutes, minutes)

        val distanceMeters = routeProgress.distanceRemaining.toDouble()
        val distanceText = if (distanceMeters >= 1000) {
            String.format(Locale.getDefault(), "%.1f km", distanceMeters / 1000.0)
        } else {
            "${distanceMeters.roundToInt()} m"
        }
        val arrivalMillis = System.currentTimeMillis() + (durationSeconds * 1000).toLong()
        val arrival = SimpleDateFormat("h:mm a", Locale.getDefault()).format(Date(arrivalMillis))
        tripDetailLabel.text = if (arrival.isNotEmpty()) {
            "$distanceText • $arrival"
        } else {
            distanceText
        }
    }

    private fun initNavigation() {
        MapboxNavigationApp.setup(NavigationOptions.Builder(this).build())
        mapView.location.apply {
            locationPuck = LocationPuck2D(
                bearingImage = ImageHolder.from(
                    NavigationMapsR.drawable.mapbox_navigation_puck_icon2,
                ),
                shadowImage = ImageHolder.from(
                    NavigationMapsR.drawable.mapbox_navigation_puck_icon2_shadow,
                ),
            )
            puckBearingEnabled = true
            puckBearing = PuckBearing.COURSE
            setLocationProvider(navigationLocationProvider)
            enabled = true
        }
    }

    private fun ensureLocationPermissionThenRequestRoutes(waypointSet: NavigationWaypointSet) {
        val permissions = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        val missing = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) {
            ActivityCompat.requestPermissions(
                this,
                missing.toTypedArray(),
                LOCATION_PERMISSION_REQUEST,
            )
            return
        }
        requestRoutes(waypointSet)
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != LOCATION_PERMISSION_REQUEST) return
        val set = waypointSet ?: return
        val locationGranted =
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) ==
                PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) ==
                PackageManager.PERMISSION_GRANTED
        if (locationGranted) {
            requestRoutes(set)
        } else {
            showRouteError("Location permission is required for turn-by-turn navigation.")
        }
    }

    private fun requestRoutes(waypointSet: NavigationWaypointSet) {
        if (routeRequested) return
        routeRequested = true
        mapboxNavigation.requestRoutes(
            RouteOptions.builder()
                .applyDefaultNavigationOptions()
                .applyLanguageAndVoiceUnitOptions(this)
                .coordinatesList(waypointSet.coordinatesList())
                .waypointIndicesList(waypointSet.waypointsIndices())
                .waypointNamesList(waypointSet.waypointsNames())
                .language(Locale.getDefault().toLanguageTag())
                .alternatives(false)
                .voiceUnits(DirectionsCriteria.IMPERIAL)
                .bannerInstructions(true)
                .voiceInstructions(true)
                .steps(true)
                .layersList(listOf(mapboxNavigation.getZLevel(), null))
                .build(),
            object : NavigationRouterCallback {
                override fun onCanceled(routeOptions: RouteOptions, @RouterOrigin routerOrigin: String) {
                    routeRequested = false
                    showRouteError("Route request was canceled. Tap Close and try again.")
                }

                override fun onFailure(
                    reasons: List<RouterFailure>,
                    routeOptions: RouteOptions,
                ) {
                    routeRequested = false
                    val detail = reasons.joinToString { it.message }
                    Log.e(TAG, "Route request failed: $detail")
                    showRouteError(
                        if (detail.isBlank()) {
                            "Could not calculate a route. Tap Close and try again."
                        } else {
                            detail
                        },
                    )
                }

                override fun onRoutesReady(
                    routes: List<NavigationRoute>,
                    @RouterOrigin routerOrigin: String,
                ) {
                    if (routes.isEmpty()) {
                        routeRequested = false
                        showRouteError("No route was returned. Tap Close and try again.")
                        return
                    }
                    errorBanner.visibility = View.GONE
                    mapboxNavigation.setNavigationRoutes(routes)
                    navigationCamera.requestNavigationCameraToFollowing()
                    announceNavigationStart(routes.first())
                }
            },
        )
    }

    private fun announceNavigationStart(route: NavigationRoute) {
        if (isVoiceInstructionsMuted) return
        val firstVoice = route.directionsRoute
            .legs()
            ?.firstOrNull()
            ?.steps()
            ?.firstOrNull()
            ?.voiceInstructions()
            ?.firstOrNull()
        if (firstVoice != null) {
            runOnUiThread {
                speechApi.generate(firstVoice, speechCallback)
            }
            return
        }
        val banner = route.directionsRoute
            .legs()
            ?.firstOrNull()
            ?.steps()
            ?.firstOrNull()
            ?.maneuver()
            ?.instruction()
        speakFallback(banner ?: "Navigation is starting.")
    }

    private fun speakFallback(text: String) {
        if (text.isBlank() || isVoiceInstructionsMuted) return
        val tts = textToSpeech
        if (tts == null) {
            pendingTtsText = text
            return
        }
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "driver_nav_start")
    }

    private fun showRouteError(message: String) {
        errorBanner.text = message
        errorBanner.visibility = View.VISIBLE
        bottomSheet.visibility = View.VISIBLE
    }

    companion object {
        private const val TAG = "DriverNavigation"
        private const val LOCATION_PERMISSION_REQUEST = 4101
        const val EXTRA_WAYPOINTS = "waypoints"
        const val EXTRA_ACCESS_TOKEN = "accessToken"
    }
}
