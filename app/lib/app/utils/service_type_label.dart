import 'package:flutter/material.dart';

import '../models/service_model.dart';

/// User-facing label for combined EV + car wash bookings (`service_type: combo`).
const kEvChargingAndCarWashServiceLabel = 'EV charging & Car wash';

/// Car wash / EV / combined — used for driver map pins and multi-stop routes.
class BookingServiceComposition {
  const BookingServiceComposition({
    required this.hasCarWash,
    required this.hasEvCharging,
  });

  final bool hasCarWash;
  final bool hasEvCharging;

  bool get isCombined => hasCarWash && hasEvCharging;
  bool get isCarWashOnly => hasCarWash && !hasEvCharging;
  bool get isEvOnly => hasEvCharging && !hasCarWash;
}

/// Parses booking `service_type` (and similar labels) for routing and map markers.
BookingServiceComposition bookingServiceComposition(String? raw) {
  final lower = (raw ?? '').trim().toLowerCase();
  if (lower.isEmpty) {
    return const BookingServiceComposition(
      hasCarWash: false,
      hasEvCharging: false,
    );
  }
  if (lower.contains('combo')) {
    return const BookingServiceComposition(
      hasCarWash: true,
      hasEvCharging: true,
    );
  }
  final hasCarWash =
      lower.contains('car_wash') ||
      lower.contains('car wash') ||
      lower == 'carwash';
  final hasEv =
      lower.contains('ev_charging') ||
      lower.contains('ev charging') ||
      lower == 'ev' ||
      (lower.contains('ev') && lower.contains('charg'));
  if (hasCarWash && hasEv) {
    return const BookingServiceComposition(
      hasCarWash: true,
      hasEvCharging: true,
    );
  }
  return BookingServiceComposition(
    hasCarWash: hasCarWash,
    hasEvCharging: hasEv,
  );
}

/// Maps API `service_type` slugs (e.g. `car_wash`) to user-facing labels.
String? _matchKnownServiceType(String raw) {
  final lower = raw.toLowerCase();
  if (lower.contains('combo')) return kEvChargingAndCarWashServiceLabel;
  if (lower.contains('ev_charging') || lower.contains('ev')) {
    return 'EV Charging';
  }
  if (lower.contains('car_wash')) return 'Car Wash';
  return null;
}

String _titleCaseSlug(String raw) {
  final normalized = raw
      .replaceAll('_', ' ')
      .replaceAll('-', ' ')
      .trim();
  if (normalized.isEmpty) return raw;
  return normalized
      .split(RegExp(r'\s+'))
      .where((w) => w.isNotEmpty)
      .map((w) => '${w[0].toUpperCase()}${w.substring(1).toLowerCase()}')
      .join(' ');
}

/// Dashboard service picker: pretty label for known types; otherwise unchanged.
String serviceTypePickerLabel(String raw) {
  return _matchKnownServiceType(raw) ?? raw;
}

/// Material icon for customer dashboard service cards.
IconData serviceTypePickerIcon(String raw) {
  final comp = bookingServiceComposition(raw);
  if (comp.isCombined) return Icons.bolt_rounded;
  if (comp.hasEvCharging) return Icons.ev_station_rounded;
  if (comp.hasCarWash) return Icons.local_car_wash_rounded;
  return Icons.miscellaneous_services_outlined;
}

bool serviceTypePickerIsCombined(String raw) =>
    bookingServiceComposition(raw).isCombined;

int _servicePickerSortRank(String? raw) {
  final lower = (raw ?? '').trim().toLowerCase();
  if (lower.contains('car_wash') || lower.contains('car wash')) return 0;
  if (lower.contains('ev_charging') ||
      lower.contains('ev charging') ||
      (lower.contains('ev') && lower.contains('charg'))) {
    return 1;
  }
  if (lower.contains('combo')) return 2;
  return 3;
}

/// Car wash + EV on the first row; combo always full-width on its own row below.
List<ServiceModel> servicesOrderedForPicker(List<ServiceModel> services) {
  final singles = <ServiceModel>[];
  final combined = <ServiceModel>[];
  for (final service in services) {
    if (serviceTypePickerIsCombined(service.name ?? '')) {
      combined.add(service);
    } else {
      singles.add(service);
    }
  }
  singles.sort(
    (a, b) => _servicePickerSortRank(a.name).compareTo(_servicePickerSortRank(b.name)),
  );
  return [...singles, ...combined];
}

/// Bookings list, detail, dialogs: known types + title-case for other slugs.
String bookingServiceTypeDisplay(String? raw) {
  final t = raw?.trim() ?? '';
  if (t.isEmpty) return '';
  return _matchKnownServiceType(t) ?? _titleCaseSlug(t);
}

/// Copy for the cancellation banner on **cancelled** bookings only (not active/completed).
String bookingCancellationNotice(String? serviceTypeRaw) {
  final lower = (serviceTypeRaw ?? '').trim().toLowerCase();
  if (lower.contains('combo') ||
      (lower.contains('car wash') && lower.contains('ev'))) {
    return 'EV charging + car wash booking cancelled.';
  }
  if (lower.contains('ev_charging') || lower.contains('ev')) {
    return 'EV charging booking cancelled.';
  }
  if (lower.contains('car_wash') || lower.contains('car wash')) {
    return 'Car wash booking cancelled.';
  }
  return 'Booking cancelled.';
}
