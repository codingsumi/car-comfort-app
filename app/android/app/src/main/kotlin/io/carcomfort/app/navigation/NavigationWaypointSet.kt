package io.carcomfort.app.navigation

import com.mapbox.geojson.Point

class NavigationWaypointSet {
    private val waypoints = mutableListOf<NavigationWaypoint>()

    fun add(waypoint: NavigationWaypoint) {
        waypoints.add(waypoint)
    }

    fun waypointsIndices(): List<Int> =
        waypoints.mapIndexedNotNull { index, _ ->
            if (isSilentWaypoint(index)) null else index
        }

    fun waypointsNames(): List<String> =
        waypoints
            .filterIndexed { index, _ -> !isSilentWaypoint(index) }
            .map { it.name }

    fun coordinatesList(): List<Point> = waypoints.map { it.point }

    private fun isSilentWaypoint(index: Int): Boolean {
        val wp = waypoints[index]
        if (!wp.isSilent) return false
        return index != 0 && index != waypoints.lastIndex
    }
}
