package io.carcomfort.app.navigation

import com.mapbox.geojson.Point
import java.io.Serializable

data class NavigationWaypoint(
    val name: String,
    val point: Point,
    val isSilent: Boolean,
) : Serializable {
    constructor(name: String, longitude: Double, latitude: Double, isSilent: Boolean) : this(
        name,
        Point.fromLngLat(longitude, latitude),
        isSilent,
    )
}
