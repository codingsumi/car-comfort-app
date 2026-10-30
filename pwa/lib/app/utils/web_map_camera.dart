/// No-op camera bridge on native platforms.
void webMapFlyTo(double longitude, double latitude, double zoom) {}

void webMapLocate() {}

void webMapPanBy(double dx, double dy) {}

void webMapZoomBy(double delta) {}

void webMapSetLiveDriver(
  double longitude,
  double latitude,
  double zoom,
  bool follow,
) {}

void webMapSetLiveDestination(double longitude, double latitude, String kind) {}

void webMapSetLiveRoute(List<double> coordinates) {}

void webMapClearLiveRoute() {}

void webMapFitLiveTrip(
  double driverLongitude,
  double driverLatitude,
  double destinationLongitude,
  double destinationLatitude,
  double zoomBoost,
  double maxZoom,
) {}

void webMapClearLiveTrip() {}
