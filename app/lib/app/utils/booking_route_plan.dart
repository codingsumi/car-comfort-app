import '../network/response/booking_detail_response.dart';
import 'service_type_label.dart';

/// One row in the Route Plan timeline (pickup, service stop(s), dropoff).
class BookingRoutePlanStop {
  const BookingRoutePlanStop({
    required this.label,
    required this.address,
    this.placeName,
    this.specification,
  });

  final String label;
  final String address;
  final String? placeName;
  final String? specification;
}

String coalesceBookingAddress(List<String?> candidates, {String fallback = '—'}) {
  for (final c in candidates) {
    final s = (c ?? '').trim();
    if (s.isNotEmpty) return s;
  }
  return fallback;
}

bool bookingAddressesDiffer(String a, String b) {
  final x = a.trim().toLowerCase();
  final y = b.trim().toLowerCase();
  if (x.isEmpty || y.isEmpty) return false;
  return x != y;
}

(String title, String? subtitle) splitRouteAddressLines(String raw) {
  final t = raw.trim();
  if (t.isEmpty) return ('—', null);
  final nl = t.split(RegExp(r'\r?\n'));
  if (nl.length >= 2) {
    return (nl.first.trim(), nl.sublist(1).join('\n').trim());
  }
  final idx = t.indexOf(',');
  if (idx > 0 && idx < t.length - 2) {
    return (t.substring(0, idx).trim(), t.substring(idx + 1).trim());
  }
  return (t, null);
}

String? _washPackageSpecification(BookingDetailData? detail) {
  final name = (detail?.package?.name ?? detail?.customPackageName ?? '')
      .trim();
  if (name.isEmpty) return null;
  final price = detail?.customPrice;
  if (price != null && price.trim().isNotEmpty) {
    final parsed = double.tryParse(price.trim());
    if (parsed != null) {
      return 'Package: $name · \$${parsed.toStringAsFixed(2)}';
    }
  }
  return 'Package: $name';
}

String? _evChargingSpecification(BookingDetailData? detail) {
  final limit = detail?.vehicleChargeLimit;
  if (limit == null) return 'EV charging stop';
  return 'Charge limit: $limit%';
}

/// Ordered stops for the Route Plan card: pickup → service stop(s) → dropoff.
List<BookingRoutePlanStop> buildBookingRoutePlanStops({
  required BookingDetailData? detail,
  required String pickupAddress,
  required String dropoffAddress,
}) {
  final composition = bookingServiceComposition(detail?.serviceType);
  final stops = <BookingRoutePlanStop>[];

  stops.add(
    BookingRoutePlanStop(label: 'PICKUP', address: pickupAddress),
  );

  final washAddress = coalesceBookingAddress([
    detail?.serviceLocation?.address,
    detail?.serviceAddress,
  ]);
  final washName = coalesceBookingAddress([
    detail?.serviceLocation?.name,
    detail?.serviceLocationName,
  ], fallback: '');
  final evAddress = coalesceBookingAddress([
    detail?.evChargingLocation?.address,
    detail?.evChargingAddress?.toString(),
  ]);
  final evName = coalesceBookingAddress([
    detail?.evChargingLocation?.name,
    detail?.evChargingLocationName,
  ], fallback: '');

  if (composition.isCombined) {
    if (evAddress != '—' || evName.isNotEmpty) {
      stops.add(
        BookingRoutePlanStop(
          label: 'STOP 1 · EV CHARGING',
          address: evAddress != '—' ? evAddress : evName,
          placeName: evName.isNotEmpty ? evName : null,
          specification: _evChargingSpecification(detail),
        ),
      );
    }
    if (washAddress != '—' || washName.isNotEmpty) {
      stops.add(
        BookingRoutePlanStop(
          label: 'STOP 2 · CAR WASH',
          address: washAddress != '—' ? washAddress : washName,
          placeName: washName.isNotEmpty ? washName : null,
          specification: _washPackageSpecification(detail),
        ),
      );
    }
  } else if (composition.hasCarWash) {
    if (washAddress != '—' &&
        bookingAddressesDiffer(washAddress, pickupAddress) &&
        bookingAddressesDiffer(washAddress, dropoffAddress)) {
      stops.add(
        BookingRoutePlanStop(
          label: 'SERVICE LOCATION',
          address: washAddress,
          placeName: washName.isNotEmpty ? washName : null,
          specification: _washPackageSpecification(detail),
        ),
      );
    }
  } else if (composition.hasEvCharging) {
    final evOnly = evAddress != '—' ? evAddress : washAddress;
    final evOnlyName = evName.isNotEmpty ? evName : washName;
    if (evOnly != '—' &&
        bookingAddressesDiffer(evOnly, pickupAddress) &&
        bookingAddressesDiffer(evOnly, dropoffAddress)) {
      stops.add(
        BookingRoutePlanStop(
          label: 'SERVICE LOCATION',
          address: evOnly,
          placeName: evOnlyName.isNotEmpty ? evOnlyName : null,
          specification: _evChargingSpecification(detail),
        ),
      );
    }
  } else {
    final generic = washAddress != '—' ? washAddress : evAddress;
    if (generic != '—' &&
        bookingAddressesDiffer(generic, pickupAddress) &&
        bookingAddressesDiffer(generic, dropoffAddress)) {
      stops.add(
        BookingRoutePlanStop(label: 'SERVICE LOCATION', address: generic),
      );
    }
  }

  stops.add(
    BookingRoutePlanStop(label: 'DROPOFF', address: dropoffAddress),
  );

  return stops;
}
