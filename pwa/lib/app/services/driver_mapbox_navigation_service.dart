import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:get/get.dart';
import 'package:url_launcher/url_launcher.dart';

import '../network/utils/log_util.dart';
import '../platform/driver_native_navigation_platform.dart';
import '../utils/app_snackbar.dart';
import '../utils/env_service.dart';
import '../utils/permission_utils.dart';
import '../widgets/driver_navigation_chooser_sheet.dart';

/// Driver turn-by-turn navigation: platform maps (Apple / Google) or in-app Mapbox.
class DriverMapboxNavigationService extends GetxService {
  bool _launchInFlight = false;
  DateTime? _lastLaunchAt;

  bool get isSupported =>
      !kIsWeb && (Platform.isAndroid || Platform.isIOS);

  bool get isNavigationActive => false;

  String get platformMapsAppName => Platform.isIOS ? 'Apple Maps' : 'Google Maps';

  Future<void> ensureConfigured() async {}

  Future<bool> navigateToDestinations({
    required List<({String name, double lat, double lng})> destinations,
    DriverNavigationChoice? preference,
  }) async {
    if (_launchInFlight) {
      showAppSnackBar(
        title: 'Navigation',
        message: 'Navigation is already opening. Please wait a moment.',
        isError: true,
      );
      return false;
    }
    final lastLaunch = _lastLaunchAt;
    if (lastLaunch != null &&
        DateTime.now().difference(lastLaunch) < const Duration(milliseconds: 800)) {
      return false;
    }
    _launchInFlight = true;
    _lastLaunchAt = DateTime.now();
    try {
      return await _navigateToDestinations(
        destinations: destinations,
        preference: preference,
      );
    } finally {
      _launchInFlight = false;
    }
  }

  Future<bool> _navigateToDestinations({
    required List<({String name, double lat, double lng})> destinations,
    DriverNavigationChoice? preference,
  }) async {
    if (!isSupported) {
      showAppSnackBar(
        title: 'Navigation',
        message: 'Turn-by-turn navigation is only available on mobile devices.',
        isError: true,
      );
      return false;
    }

    final stops = destinations
        .where((d) => d.lat.isFinite && d.lng.isFinite)
        .toList();
    if (stops.isEmpty) {
      showAppSnackBar(
        title: 'Navigation',
        message: 'Destination coordinates are not available yet.',
        isError: true,
      );
      return false;
    }

    final choice = preference ?? await _promptNavigationChoice();
    if (choice == null) return false;

    if (choice == DriverNavigationChoice.externalMaps) {
      return launchExternalMapsNavigation(destinations: stops);
    }

    return _launchInAppNavigation(stops: stops);
  }

  Future<DriverNavigationChoice?> _promptNavigationChoice() async {
    final context = Get.context;
    if (context == null) return DriverNavigationChoice.externalMaps;
    return showDriverNavigationChooser(context);
  }

  /// Opens Apple Maps (iOS) or Google Maps (Android) with driving directions.
  Future<bool> launchExternalMapsNavigation({
    required List<({String name, double lat, double lng})> destinations,
  }) async {
    if (!isSupported) return false;

    final stops = destinations
        .where((d) => d.lat.isFinite && d.lng.isFinite)
        .toList();
    if (stops.isEmpty) {
      showAppSnackBar(
        title: 'Navigation',
        message: 'Destination coordinates are not available yet.',
        isError: true,
      );
      return false;
    }

    final dest = stops.last;

    final uris = Platform.isIOS
        ? _buildAppleMapsUris(dest: dest, stops: stops)
        : _buildGoogleMapsUris(dest: dest, stops: stops);

    return _tryLaunchUris(uris);
  }

  Future<bool> _launchInAppNavigation({
    required List<({String name, double lat, double lng})> stops,
  }) async {
    if (!DriverNativeNavigationPlatform.isSupported) {
      showAppSnackBar(
        title: 'Navigation',
        message:
            'In-app navigation is not available on this device. Try $platformMapsAppName instead.',
        isError: true,
      );
      return false;
    }

    final origin = await _currentCoords();
    if (origin == null) {
      showAppSnackBar(
        title: 'Location',
        message: 'Unable to fetch your current location for navigation.',
        isError: true,
      );
      return false;
    }

    final waypoints = <DriverNavigationWaypoint>[
      DriverNavigationWaypoint(
        name: 'Current location',
        lat: origin.lat,
        lng: origin.lng,
        isSilent: true,
      ),
      ...stops.map(
        (d) => DriverNavigationWaypoint(
          name: d.name.trim().isNotEmpty ? d.name.trim() : 'Stop',
          lat: d.lat,
          lng: d.lng,
        ),
      ),
    ];

    final nativeOk = await DriverNativeNavigationPlatform.startNavigation(
      waypoints: waypoints,
      accessToken: EnvService.mapboxAccessToken.trim(),
    );
    if (nativeOk) return true;

    Alert.log(
      'DriverTurnByTurnNav',
      'In-app navigation unavailable on this device.',
    );
    showAppSnackBar(
      title: 'Navigation',
      message:
          'In-app navigation could not start. Try $platformMapsAppName from the navigation menu.',
      isError: true,
    );
    return false;
  }

  Future<void> stopNavigationIfActive() async {
    await DriverNativeNavigationPlatform.stopNavigation();
  }

  /// Apple Maps only enables the **Go** button when the route starts from the
  /// user's live location. Passing a fixed [saddr] coordinate disables Go.
  List<Uri> _buildAppleMapsUris({
    required ({String name, double lat, double lng}) dest,
    required List<({String name, double lat, double lng})> stops,
  }) {
    final destCoord = '${dest.lat},${dest.lng}';
    final destLabel = dest.name.trim();
    final uris = <Uri>[
      Uri.parse('maps://?daddr=$destCoord&dirflg=d'),
    ];

    final unifiedQuery = _appleDirectionsQuery(
      destination: destLabel.isNotEmpty ? destLabel : destCoord,
      waypoints: stops.length > 1
          ? stops
              .sublist(0, stops.length - 1)
              .map(
                (stop) => stop.name.trim().isNotEmpty
                    ? stop.name.trim()
                    : '${stop.lat},${stop.lng}',
              )
              .toList()
          : const [],
    );
    if (unifiedQuery.isNotEmpty) {
      uris.add(Uri.parse('https://maps.apple.com/directions?$unifiedQuery'));
    }

    if (destLabel.isNotEmpty) {
      final coordQuery = _appleDirectionsQuery(destination: destCoord);
      if (coordQuery.isNotEmpty) {
        uris.add(Uri.parse('https://maps.apple.com/directions?$coordQuery'));
      }
    }

    uris.add(
      Uri.https('maps.apple.com', '/', {
        'daddr': destCoord,
        'dirflg': 'd',
      }),
    );
    return uris;
  }

  /// Unified Apple Maps directions URL (iOS 18.4+). Omits [source] so Maps uses
  /// the user's current location and enables the Go button.
  String _appleDirectionsQuery({
    required String destination,
    List<String> waypoints = const [],
  }) {
    final parts = <String>[
      'destination=${Uri.encodeComponent(destination)}',
      'mode=driving',
    ];
    for (final waypoint in waypoints) {
      if (waypoint.trim().isEmpty) continue;
      parts.add('waypoint=${Uri.encodeComponent(waypoint.trim())}');
    }
    return parts.join('&');
  }

  List<Uri> _buildGoogleMapsUris({
    required ({String name, double lat, double lng}) dest,
    required List<({String name, double lat, double lng})> stops,
  }) {
    final uris = <Uri>[];

    // Always try the native google.navigation intent first — works for any
    // number of stops and reliably launches in-app navigation on Android.
    uris.add(Uri.parse('google.navigation:q=${dest.lat},${dest.lng}&mode=d'));

    // comgooglemaps:// scheme as secondary fallback (single stop only).
    if (stops.length == 1) {
      uris.add(
        Uri.parse(
          'comgooglemaps://?daddr=${dest.lat},${dest.lng}&directionsmode=driving',
        ),
      );
    }

    // HTTPS fallback — opens Google Maps app on Android via intent chooser
    // or browser if Maps is not installed.
    final params = <String, String>{
      'api': '1',
      'destination': '${dest.lat},${dest.lng}',
      'travelmode': 'driving',
    };
    if (stops.length > 1) {
      params['waypoints'] = stops
          .sublist(0, stops.length - 1)
          .map((s) => '${s.lat},${s.lng}')
          .join('|');
    }
    uris.add(Uri.https('www.google.com', '/maps/dir/', params));

    return uris;
  }

  Future<bool> _tryLaunchUris(List<Uri> uris) async {
    try {
      for (final candidate in uris) {
        try {
          final launched = await launchUrl(
            candidate,
            mode: LaunchMode.externalApplication,
          );
          if (launched) return true;
        } catch (_) {
          continue;
        }
      }

      for (final candidate in uris) {
        try {
          if (!await canLaunchUrl(candidate)) continue;
          final launched = await launchUrl(
            candidate,
            mode: LaunchMode.externalApplication,
          );
          if (launched) return true;
        } catch (_) {
          continue;
        }
      }

      showAppSnackBar(
        title: 'Navigation',
        message: 'Could not open $platformMapsAppName. Install or enable the maps app and try again.',
        isError: true,
      );
      return false;
    } catch (e, st) {
      Alert.log('DriverTurnByTurnNav', 'external launch failed: $e\n$st');
      showAppSnackBar(
        title: 'Navigation',
        message: 'Could not open $platformMapsAppName.',
        isError: true,
      );
      return false;
    }
  }

  Future<({double lat, double lng})?> _currentCoords() async {
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.deniedForever) {
        showLocationPermissionSettingsDialog();
        return null;
      }
      if (permission == LocationPermission.denied) {
        return null;
      }
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );
      return (lat: pos.latitude, lng: pos.longitude);
    } catch (e) {
      Alert.log('DriverTurnByTurnNav', 'GPS failed: $e');
      return null;
    }
  }
}
