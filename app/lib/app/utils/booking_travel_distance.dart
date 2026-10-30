import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../network/response/booking_detail_response.dart';
import '../widgets/text.dart';
import 'booking_route_plan.dart';
import 'env_service.dart';
import 'service_type_label.dart';

class _Coord {
  const _Coord(this.lat, this.lng);
  final double lat;
  final double lng;
}

double? _toDouble(dynamic value) {
  if (value == null) return null;
  if (value is num) return value.toDouble();
  return double.tryParse('$value');
}

_Coord? _coord(double? lat, double? lng) {
  if (lat == null || lng == null || !lat.isFinite || !lng.isFinite) return null;
  return _Coord(lat, lng);
}

bool _coordsNearlyEqual(_Coord? a, _Coord? b) {
  if (a == null || b == null) return false;
  return (a.lat - b.lat).abs() < 0.00005 && (a.lng - b.lng).abs() < 0.00005;
}

double? haversineMilesBetween({
  required double? startLat,
  required double? startLng,
  required double? endLat,
  required double? endLng,
}) {
  if (startLat == null ||
      startLng == null ||
      endLat == null ||
      endLng == null) {
    return null;
  }
  const earthRadiusKm = 6371.0;
  double degToRad(double deg) => deg * (math.pi / 180);
  final dLat = degToRad(endLat - startLat);
  final dLng = degToRad(endLng - startLng);
  final a =
      math.sin(dLat / 2) * math.sin(dLat / 2) +
      math.cos(degToRad(startLat)) *
          math.cos(degToRad(endLat)) *
          math.sin(dLng / 2) *
          math.sin(dLng / 2);
  final c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
  return (earthRadiusKm * c) * 0.621371;
}

_Coord? _resolveEvServiceStopCoords(BookingDetailData? detail, _Coord? pickup) {
  if (detail == null) return null;

  final evAddress = coalesceBookingAddress([
    detail.evChargingLocation?.address,
    detail.evChargingAddress?.toString(),
  ], fallback: '');
  final serviceAddress = coalesceBookingAddress([
    detail.serviceLocation?.address,
    detail.serviceAddress,
  ], fallback: '');
  final pickupAddress = coalesceBookingAddress([
    detail.pickupLocation?.address,
    detail.address,
  ], fallback: '');

  final charge = _coord(
    _toDouble(detail.chargingLatitude),
    _toDouble(detail.chargingLongitude),
  );
  final wash = _coord(
    _toDouble(detail.serviceLatitude ?? detail.serviceLat),
    _toDouble(detail.serviceLongitude ?? detail.serviceLng),
  );

  final displayAddress = evAddress.isNotEmpty ? evAddress : serviceAddress;
  final preferChargeCoords =
      evAddress.isNotEmpty || (serviceAddress.isEmpty && charge != null);

  _Coord? stop = preferChargeCoords ? (charge ?? wash) : (wash ?? charge);

  if (stop != null &&
      pickup != null &&
      _coordsNearlyEqual(stop, pickup) &&
      displayAddress.isNotEmpty &&
      bookingAddressesDiffer(displayAddress, pickupAddress)) {
    stop = preferChargeCoords ? wash : charge;
    if (stop != null &&
        _coordsNearlyEqual(stop, pickup) &&
        bookingAddressesDiffer(displayAddress, pickupAddress)) {
      stop = null;
    }
  }

  return stop;
}

_Coord? _resolveCarWashServiceStopCoords(BookingDetailData? detail, _Coord? pickup) {
  if (detail == null) return null;

  final wash = _coord(
    _toDouble(detail.serviceLatitude ?? detail.serviceLat),
    _toDouble(detail.serviceLongitude ?? detail.serviceLng),
  );
  if (wash == null || pickup == null) return wash;

  final serviceAddress = coalesceBookingAddress([
    detail.serviceLocation?.address,
    detail.serviceAddress,
  ], fallback: '');
  final pickupAddress = coalesceBookingAddress([
    detail.pickupLocation?.address,
    detail.address,
  ], fallback: '');

  if (_coordsNearlyEqual(wash, pickup) &&
      serviceAddress.isNotEmpty &&
      bookingAddressesDiffer(serviceAddress, pickupAddress)) {
    return null;
  }

  return wash;
}

/// Ordered outbound waypoints: pickup → service stop(s).
List<_Coord> buildBookingOutboundRouteCoords(BookingDetailData? detail) {
  if (detail == null) return const [];

  final pickup = _coord(
    _toDouble(detail.latitude ?? detail.pickupLocation?.latitude),
    _toDouble(detail.longitude ?? detail.pickupLocation?.longitude),
  );
  final composition = bookingServiceComposition(detail.serviceType);
  final charge = _coord(
    _toDouble(detail.chargingLatitude),
    _toDouble(detail.chargingLongitude),
  );
  final wash = _coord(
    _toDouble(detail.serviceLatitude ?? detail.serviceLat),
    _toDouble(detail.serviceLongitude ?? detail.serviceLng),
  );

  if (composition.isCombined) {
    final evStop = _resolveEvServiceStopCoords(detail, pickup) ?? charge;
    final washStop = _resolveCarWashServiceStopCoords(detail, pickup) ?? wash;
    return [pickup, evStop, washStop].whereType<_Coord>().toList();
  }
  if (composition.hasEvCharging) {
    final stop = _resolveEvServiceStopCoords(detail, pickup);
    return [pickup, stop].whereType<_Coord>().toList();
  }

  final serviceStop = _resolveCarWashServiceStopCoords(detail, pickup) ?? wash;
  if (serviceStop == null) {
    return pickup != null ? [pickup] : const [];
  }
  return [pickup, serviceStop].whereType<_Coord>().toList();
}

List<_Coord> _withReturnToPickup(List<_Coord> coords) {
  if (coords.length < 2) return coords;
  final pickup = coords.first;
  final last = coords.last;
  if (_coordsNearlyEqual(pickup, last)) return coords;
  return [...coords, pickup];
}

/// Full round-trip route: pickup → stop(s) → pickup.
List<_Coord> buildBookingRoundTripRouteCoords(BookingDetailData? detail) {
  return _withReturnToPickup(buildBookingOutboundRouteCoords(detail));
}

/// Straight-line round-trip miles (fallback when driving route is unavailable).
double? estimateBookingRoundTripTravelMiles(BookingDetailData? detail) {
  final route = buildBookingRoundTripRouteCoords(detail);
  if (route.length < 2) return null;

  var total = 0.0;
  for (var i = 0; i < route.length - 1; i++) {
    final leg = haversineMilesBetween(
      startLat: route[i].lat,
      startLng: route[i].lng,
      endLat: route[i + 1].lat,
      endLng: route[i + 1].lng,
    );
    if (leg != null && leg > 0) total += leg;
  }
  return total > 0 ? total : null;
}

Future<double?> fetchMapboxDrivingRouteMiles(List<_Coord> coords) async {
  if (coords.length < 2) return null;

  final token = EnvService.mapboxAccessToken.trim();
  if (token.isEmpty) return null;

  final path = coords.map((c) => '${c.lng},${c.lat}').join(';');
  final uri = Uri.https(
    'api.mapbox.com',
    '/directions/v5/mapbox/driving/$path',
    const {'overview': 'false'},
  ).replace(queryParameters: {
    'overview': 'false',
    'access_token': token,
  });

  HttpClient? client;
  try {
    client = HttpClient();
    final request = await client.getUrl(uri);
    final response = await request.close();
    final body = await utf8.decodeStream(response);
    if (response.statusCode != 200) return null;

    final decoded = jsonDecode(body);
    if (decoded is! Map) return null;
    final routes = decoded['routes'];
    if (routes is! List || routes.isEmpty) return null;
    final first = routes.first;
    if (first is! Map) return null;
    final distance = first['distance'];
    if (distance is num && distance > 0) {
      return distance / 1609.344;
    }
  } catch (_) {
    return null;
  } finally {
    client?.close(force: true);
  }
  return null;
}

double? _applySuspiciousShortLegFilter(BookingDetailData? detail, double? miles) {
  if (detail == null || miles == null || miles <= 0) return miles;
  if (miles >= 3) return miles;
  if (!bookingServiceComposition(detail.serviceType).hasEvCharging) return miles;

  final pickupAddress = coalesceBookingAddress([
    detail.pickupLocation?.address,
    detail.address,
  ], fallback: '');
  final serviceAddress = coalesceBookingAddress([
    detail.evChargingLocation?.address,
    detail.evChargingAddress?.toString(),
    detail.serviceLocation?.address,
    detail.serviceAddress,
  ], fallback: '');
  if (pickupAddress.isNotEmpty &&
      serviceAddress.isNotEmpty &&
      bookingAddressesDiffer(pickupAddress, serviceAddress)) {
    return null;
  }
  return miles;
}

String? _formatMilesLabel(double? miles) {
  if (miles == null || miles <= 0) return null;
  final whole = miles == miles.roundToDouble();
  final value = whole ? miles.round().toString() : miles.toStringAsFixed(1);
  return '$value miles';
}

/// Driving round-trip miles when possible; falls back to straight-line estimate.
Future<double?> resolveBookingRoundTripTravelMiles(BookingDetailData? detail) async {
  if (detail == null) return null;

  // The backend value is already geocoded/validated (including legitimate short
  // EV trips), so trust it directly rather than re-running the short-leg filter.
  final apiMiles = detail.distanceMiles;
  if (apiMiles != null && apiMiles > 0) {
    return apiMiles;
  }

  final route = buildBookingRoundTripRouteCoords(detail);
  final driving = await fetchMapboxDrivingRouteMiles(route);
  if (driving != null && driving > 0) {
    return _applySuspiciousShortLegFilter(detail, driving);
  }

  return _applySuspiciousShortLegFilter(
    detail,
    estimateBookingRoundTripTravelMiles(detail),
  );
}

String? formatBookingTravelRadiusLabel(BookingDetailData? detail) {
  if (detail == null) return null;

  // Prefer the authoritative backend distance (already validated) and only apply
  // the short-leg filter to the local straight-line fallback estimate.
  final apiMiles = detail.distanceMiles;
  if (apiMiles != null && apiMiles > 0) {
    return _formatMilesLabel(apiMiles);
  }

  final computed = estimateBookingRoundTripTravelMiles(detail);
  final miles = _applySuspiciousShortLegFilter(detail, computed);
  return _formatMilesLabel(miles);
}

Future<String?> resolveBookingTravelRadiusLabel(BookingDetailData? detail) async {
  final miles = await resolveBookingRoundTripTravelMiles(detail);
  return _formatMilesLabel(miles);
}

/// Estimated round-trip driving radius for service detail screens.
class BookingEstimatedRadiusText extends StatefulWidget {
  const BookingEstimatedRadiusText({
    super.key,
    required this.detail,
    this.fallback = '—',
    this.size = 22,
    this.color = Colors.white,
  });

  final BookingDetailData? detail;
  final String fallback;
  final double size;
  final Color color;

  @override
  State<BookingEstimatedRadiusText> createState() =>
      _BookingEstimatedRadiusTextState();
}

class _BookingEstimatedRadiusTextState extends State<BookingEstimatedRadiusText> {
  String? _label;
  Object? _detailKey;

  @override
  void initState() {
    super.initState();
    _resolve();
  }

  @override
  void didUpdateWidget(BookingEstimatedRadiusText oldWidget) {
    super.didUpdateWidget(oldWidget);
    final key = _detailIdentity(widget.detail);
    if (key != _detailKey) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _resolve();
      });
    }
  }

  /// Identity key used to decide whether to re-resolve the distance.
  ///
  /// We include all coordinate fields used by the calculation so that loading
  /// the full booking detail (which adds lat/lng) triggers a fresh resolve
  /// even when the booking id and distanceMiles haven't changed.
  Object? _detailIdentity(BookingDetailData? detail) {
    if (detail == null) return null;
    return Object.hash(
      detail.id,
      detail.distanceMiles,
      _toDouble(detail.latitude ?? detail.pickupLocation?.latitude),
      _toDouble(detail.longitude ?? detail.pickupLocation?.longitude),
      _toDouble(detail.serviceLatitude ?? detail.serviceLat),
      _toDouble(detail.serviceLongitude ?? detail.serviceLng),
      _toDouble(detail.chargingLatitude),
      _toDouble(detail.chargingLongitude),
    );
  }

  Future<void> _resolve() async {
    _detailKey = _detailIdentity(widget.detail);
    final sync = formatBookingTravelRadiusLabel(widget.detail);
    if (mounted) setState(() => _label = sync);
    final resolved = await resolveBookingTravelRadiusLabel(widget.detail);
    if (!mounted || _detailIdentity(widget.detail) != _detailKey) return;
    setState(() => _label = resolved ?? sync);
  }

  @override
  Widget build(BuildContext context) {
    return CommonText.bold(
      _label ?? widget.fallback,
      size: widget.size,
      color: widget.color,
    );
  }
}
