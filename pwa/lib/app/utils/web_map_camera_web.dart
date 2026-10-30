import 'dart:js_util' as js_util;

void webMapFlyTo(double longitude, double latitude, double zoom) {
  final mapbox = js_util.getProperty<Object?>(
    js_util.globalThis,
    'carComfortMapbox',
  );
  if (mapbox == null) return;
  js_util.callMethod<void>(mapbox, 'flyTo', <Object?>[
    longitude,
    latitude,
    zoom,
  ]);
}

/// Ask Mapbox GL JS to locate the user using the browser's geolocation API.
void webMapLocate() {
  final mapbox = js_util.getProperty<Object?>(
    js_util.globalThis,
    'carComfortMapbox',
  );
  if (mapbox == null) return;
  js_util.callMethod<void>(mapbox, 'locate', <Object?>[]);
}

/// Pan the Mapbox GL JS map by a Flutter drag delta in logical pixels.
void webMapPanBy(double dx, double dy) {
  final mapbox = js_util.getProperty<Object?>(
    js_util.globalThis,
    'carComfortMapbox',
  );
  if (mapbox == null) return;
  js_util.callMethod<void>(mapbox, 'panBy', <Object?>[dx, dy]);
}

void webMapZoomBy(double delta) {
  final mapbox = _webMapBridge();
  if (mapbox == null) return;
  js_util.callMethod<void>(mapbox, 'zoomBy', <Object?>[delta]);
}

Object? _webMapBridge() =>
    js_util.getProperty<Object?>(js_util.globalThis, 'carComfortMapbox');

void webMapSetLiveDriver(
  double longitude,
  double latitude,
  double zoom,
  bool follow,
) {
  final mapbox = _webMapBridge();
  if (mapbox == null) return;
  js_util.callMethod<void>(mapbox, 'setLiveDriver', <Object?>[
    longitude,
    latitude,
    zoom,
    follow,
  ]);
}

void webMapSetLiveDestination(double longitude, double latitude, String kind) {
  final mapbox = _webMapBridge();
  if (mapbox == null) return;
  js_util.callMethod<void>(mapbox, 'setLiveDestination', <Object?>[
    longitude,
    latitude,
    kind,
  ]);
}

void webMapSetLiveRoute(List<double> coordinates) {
  final mapbox = _webMapBridge();
  if (mapbox == null) return;
  js_util.callMethod<void>(mapbox, 'setLiveRoute', <Object?>[
    js_util.jsify(coordinates),
  ]);
}

void webMapClearLiveRoute() {
  final mapbox = _webMapBridge();
  if (mapbox == null) return;
  js_util.callMethod<void>(mapbox, 'clearLiveRoute', <Object?>[]);
}

void webMapFitLiveTrip(
  double driverLongitude,
  double driverLatitude,
  double destinationLongitude,
  double destinationLatitude,
  double zoomBoost,
  double maxZoom,
) {
  final mapbox = _webMapBridge();
  if (mapbox == null) return;
  js_util.callMethod<void>(mapbox, 'fitLiveTrip', <Object?>[
    driverLongitude,
    driverLatitude,
    destinationLongitude,
    destinationLatitude,
    zoomBoost,
    maxZoom,
  ]);
}

void webMapClearLiveTrip() {
  final mapbox = _webMapBridge();
  if (mapbox == null) return;
  js_util.callMethod<void>(mapbox, 'clearLiveTrip', <Object?>[]);
}
