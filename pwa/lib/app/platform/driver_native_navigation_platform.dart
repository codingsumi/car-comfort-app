import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import '../utils/env_service.dart';

/// Platform channel to native turn-by-turn navigation (Android: Mapbox Navigation v2).
class DriverNativeNavigationPlatform {
  DriverNativeNavigationPlatform._();

  static const MethodChannel _channel = MethodChannel(
    'io.carcomfort.app/driver_navigation',
  );

  static bool get isSupported =>
      !kIsWeb && (Platform.isAndroid || Platform.isIOS);

  /// Android: in-app Mapbox Navigation drop-in. iOS: in-app MapKit + Mapbox Directions.
  static Future<bool> startNavigation({
    required List<DriverNavigationWaypoint> waypoints,
    String? accessToken,
  }) async {
    if (!isSupported || waypoints.length < 2) return false;

    final token = (accessToken ?? EnvService.mapboxAccessToken).trim();
    if (token.isEmpty) return false;

    try {
      final result = await _channel.invokeMethod<bool>(
        'startNavigation',
        <String, dynamic>{
          'accessToken': token,
          'voiceInstructionsEnabled': true,
          'bannerInstructionsEnabled': true,
          'waypoints': waypoints
              .map(
                (w) => <String, dynamic>{
                  'name': w.name,
                  'latitude': w.lat,
                  'longitude': w.lng,
                  'isSilent': w.isSilent,
                },
              )
              .toList(),
        },
      );
      return result == true;
    } on PlatformException {
      return false;
    } on MissingPluginException {
      return false;
    }
  }

  static Future<void> stopNavigation() async {
    if (!isSupported) return;
    try {
      await _channel.invokeMethod<void>('stopNavigation');
    } on PlatformException {
      // ignore
    } on MissingPluginException {
      // ignore
    }
  }
}

class DriverNavigationWaypoint {
  const DriverNavigationWaypoint({
    required this.name,
    required this.lat,
    required this.lng,
    this.isSilent = false,
  });

  final String name;
  final double lat;
  final double lng;
  final bool isSilent;
}
