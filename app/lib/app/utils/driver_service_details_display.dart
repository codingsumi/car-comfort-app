import '../constants/ev_charging_booking_options.dart';
import '../network/response/booking_detail_response.dart';
import 'driver_job_duration.dart';
import 'ev_account_card_on_file.dart';
import 'service_type_label.dart';

/// One line in the provider "Service details" card.
class DriverServiceDetailLine {
  const DriverServiceDetailLine.labeled(this.label, this.value)
    : standaloneText = null;

  const DriverServiceDetailLine.standalone(this.standaloneText)
    : label = null,
      value = null;

  final String? label;
  final String? value;
  final String? standaloneText;

  bool get isStandalone => standaloneText != null;
}

String? _nonEmptyField(String? raw) {
  final value = raw?.trim() ?? '';
  if (value.isEmpty) return null;
  final lower = value.toLowerCase();
  if (lower == 'null' || lower == 'undefined') return null;
  return value;
}

String? resolveDriverBookingServiceTypeRaw(BookingDetailData? detail) {
  final direct = _nonEmptyField(detail?.serviceType?.toString());
  if (direct != null) return direct;

  final pkgService = _nonEmptyField(detail?.package?.service?.name?.toString());
  if (pkgService != null) return pkgService;

  if (driverBookingIsPremiumCustomPackage(detail)) return 'car_wash';

  final packageName = driverCarWashPackageName(detail);
  if (packageName != null) return 'car_wash';

  final hasEvLimit =
      detail?.vehicleChargeLimit != null &&
      '${detail!.vehicleChargeLimit}'.trim().isNotEmpty;
  if (hasEvLimit) {
    if (detail.packageId != null || packageName != null) return 'combo';
    return 'ev_charging';
  }

  if (detail?.packageId != null) return 'car_wash';

  return null;
}

BookingServiceComposition resolveDriverBookingServiceComposition(
  BookingDetailData? detail,
) {
  final fromType = bookingServiceComposition(
    resolveDriverBookingServiceTypeRaw(detail),
  );
  if (fromType.hasCarWash || fromType.hasEvCharging) return fromType;

  if (driverBookingIsPremiumCustomPackage(detail) ||
      driverCarWashPackageName(detail) != null) {
    final hasEv =
        detail?.vehicleChargeLimit != null &&
        '${detail!.vehicleChargeLimit}'.trim().isNotEmpty;
    return BookingServiceComposition(hasCarWash: true, hasEvCharging: hasEv);
  }

  return fromType;
}

String resolveDriverServiceTypeLabel(BookingDetailData? detail) {
  final label = driverActiveServiceTypeLabel(
    resolveDriverBookingServiceTypeRaw(detail),
  );
  if (label.trim().isNotEmpty) return label;

  if (driverCarWashPackageName(detail) != null ||
      driverBookingIsPremiumCustomPackage(detail)) {
    return 'Car wash';
  }

  final hasEv =
      detail?.vehicleChargeLimit != null &&
      '${detail!.vehicleChargeLimit}'.trim().isNotEmpty;
  if (hasEv) return 'EV charging';

  return '—';
}

String driverActiveServiceTypeLabel(String? raw) {
  final comp = bookingServiceComposition(raw);
  if (comp.isCombined) return 'EV charging and Car wash';
  if (comp.isEvOnly) return 'EV charging';
  if (comp.isCarWashOnly) return 'Car wash';
  return bookingServiceTypeDisplay(raw);
}

String driverActiveServiceDurationCompact(BookingDetailData? detail) {
  final label = estimatedServiceDurationLabelForBooking(
    packageDurationMinutes: detail?.package?.durationMinutes,
    serviceDurationMinutes: detail?.serviceDurationMinutes,
    serviceType: resolveDriverBookingServiceTypeRaw(detail),
    packageName: driverCarWashPackageName(detail),
    customPackageName: detail?.customPackageName?.toString(),
  );
  if (label == '—') return label;
  return label.replaceAll(' minutes', 'min').replaceAll(' min', 'min');
}

bool driverBookingIsPremiumCustomPackage(BookingDetailData? detail) {
  final custom = detail?.customPackageName?.toString().trim() ?? '';
  return custom.isNotEmpty && custom.toLowerCase() != 'null';
}

/// Membership bookings are submitted with the fixed custom-package sentinel
/// `Custom Package`. A regular CarComfort package instead has a package id/name.
bool driverBookingIsMembershipPackage(BookingDetailData? detail) {
  final custom = _nonEmptyField(detail?.customPackageName?.toString());
  return custom?.toLowerCase() == 'custom package';
}

String driverCarWashPackageCategoryLabel(BookingDetailData? detail) {
  if (driverBookingIsMembershipPackage(detail)) return 'Membership Package';
  if (driverBookingIsPremiumCustomPackage(detail)) return 'Custom Package';
  return 'CarComfort Package';
}

String? driverCarWashPackageName(BookingDetailData? detail) {
  if (driverBookingIsPremiumCustomPackage(detail)) return null;

  final fromPackage = _nonEmptyField(detail?.package?.name?.toString());
  if (fromPackage != null) return fromPackage;

  final fromSummary = _nonEmptyField(detail?.packageName);
  if (fromSummary != null) return fromSummary;

  return null;
}

int? carWashMenuOptionNumber(String packageName) {
  final normalized = packageName.trim().toLowerCase();
  if (normalized.contains('basic')) return 1;
  if (normalized.contains('deluxe')) return 2;
  if (normalized.contains('ultimate')) return 3;
  if (normalized.contains('premium')) return 4;
  return null;
}

String? formatDriverCurrentBatteryLabel(BookingDetailData? detail) {
  final fromLabel = detail?.currentBatteryStatusLabel?.trim();
  if (fromLabel != null && fromLabel.isNotEmpty) return fromLabel;

  final fromStatus = detail?.currentBatteryStatus?.trim();
  if (fromStatus != null && fromStatus.isNotEmpty) {
    final option = EvChargingBookingOptions.optionForValue(fromStatus);
    if (option != null) return option.label;
    final byLabel = EvChargingBookingOptions.optionForLabel(fromStatus);
    if (byLabel != null) return byLabel.label;
    if (fromStatus.contains('%')) return fromStatus;
    final parsed = int.tryParse(fromStatus);
    if (parsed != null) return '$parsed%';
    return fromStatus;
  }

  final raw = detail?.currentBatteryCharge?.toString().trim();
  if (raw == null || raw.isEmpty) return null;
  if (raw.endsWith('%')) return raw;
  final option = EvChargingBookingOptions.optionForValue(raw);
  if (option != null) return option.label;
  final byLabel = EvChargingBookingOptions.optionForLabel(raw);
  if (byLabel != null) return byLabel.label;
  final parsed = int.tryParse(raw);
  if (parsed != null) return '$parsed%';
  return raw;
}

String? formatDriverVehicleChargeLimit(BookingDetailData? detail) {
  final raw = detail?.vehicleChargeLimit;
  if (raw == null) return null;
  final text = raw.toString().trim();
  if (text.isEmpty) return null;
  if (text.endsWith('%')) return text;
  final parsed = int.tryParse(text);
  if (parsed != null) return '$parsed%';
  return text;
}

List<DriverServiceDetailLine> buildDriverActiveServiceDetailLines({
  required BookingDetailData? detail,
  required String timeOfService,
  required String providerEarnings,
  required String estimatedDuration,
}) {
  final comp = resolveDriverBookingServiceComposition(detail);
  final lines = <DriverServiceDetailLine>[
    DriverServiceDetailLine.labeled(
      'Service type',
      resolveDriverServiceTypeLabel(detail),
    ),
  ];

  if (comp.hasCarWash) {
    lines.add(
      DriverServiceDetailLine.standalone(
        driverCarWashPackageCategoryLabel(detail),
      ),
    );
    if (driverBookingIsPremiumCustomPackage(detail)) {
      final customName = detail!.customPackageName!.toString().trim();
      lines.add(DriverServiceDetailLine.standalone(customName));
    } else {
      final packageName = driverCarWashPackageName(detail);
      if (packageName != null) {
        lines.add(DriverServiceDetailLine.standalone(packageName));
        final menuOption = carWashMenuOptionNumber(packageName);
        if (menuOption != null) {
          lines.add(
            DriverServiceDetailLine.standalone(
              'Select option #$menuOption on car wash menu',
            ),
          );
        }
      }
    }
  }

  if (comp.hasEvCharging) {
    final evAccountCardOnFile = resolveEvAccountCardOnFileValue(
      rawValue: detail?.evAccountCardOnFile,
      notes: detail?.notes,
    );
    if (evAccountCardOnFile != null) {
      lines.add(
        DriverServiceDetailLine.labeled(
          'EV account with card on file',
          evAccountCardOnFileAnswerLabel(evAccountCardOnFile),
        ),
      );
    }
    final battery = formatDriverCurrentBatteryLabel(detail);
    lines.add(
      DriverServiceDetailLine.labeled('Current battery', battery ?? '—'),
    );
    final chargeLimit = formatDriverVehicleChargeLimit(detail);
    if (chargeLimit != null) {
      lines.add(
        DriverServiceDetailLine.labeled('Vehicle charge limit', chargeLimit),
      );
    }
  }

  final timeLabel = timeOfService.trim().isEmpty ? '—' : timeOfService;
  final earningsLabel = providerEarnings.trim().isEmpty
      ? '—'
      : providerEarnings;
  final durationLabel = estimatedDuration.trim().isEmpty
      ? '—'
      : estimatedDuration;

  lines
    ..add(DriverServiceDetailLine.labeled('Time of service', timeLabel))
    ..add(
      DriverServiceDetailLine.labeled(
        'Service provider earnings for this job',
        earningsLabel,
      ),
    )
    ..add(
      DriverServiceDetailLine.labeled(
        'Estimated service duration',
        durationLabel,
      ),
    );

  return lines;
}

String? inferServiceTypeSlugFromLabel(String? label) {
  final lower = (label ?? '').trim().toLowerCase();
  if (lower.contains('combo') ||
      (lower.contains('ev') && lower.contains('wash'))) {
    return 'combo';
  }
  if (lower.contains('ev')) return 'ev_charging';
  if (lower.contains('wash')) return 'car_wash';
  return null;
}

/// Merges booking-detail API data with route args so service details render
/// before fetch completes and when list payloads omit nested package objects.
BookingDetailData mergeDriverServiceDetailForDisplay({
  BookingDetailData? apiDetail,
  int? bookingId,
  int? loadedBookingId,
  Map<String, dynamic>? routeArgs,
}) {
  final args = routeArgs ?? const <String, dynamic>{};
  final matches =
      apiDetail != null &&
      bookingId != null &&
      bookingId > 0 &&
      (apiDetail.id == bookingId || loadedBookingId == bookingId);

  final detail = matches ? apiDetail : Data();
  if ((detail.id == null || detail.id == 0) &&
      bookingId != null &&
      bookingId > 0) {
    detail.id = bookingId;
  }

  final serviceType =
      _nonEmptyField(detail.serviceType?.toString()) ??
      _nonEmptyField(args['serviceType']?.toString()) ??
      inferServiceTypeSlugFromLabel(args['service']?.toString());
  if (serviceType != null) {
    detail.serviceType = serviceType;
  }

  final packageName =
      _nonEmptyField(detail.packageName) ??
      _nonEmptyField(detail.package?.name?.toString()) ??
      _nonEmptyField(args['packageName']?.toString());
  if (packageName != null) {
    detail.packageName = packageName;
    detail.package ??= Package(name: packageName);
    detail.package?.name ??= packageName;
  }

  final packageId =
      detail.packageId ?? int.tryParse('${args['packageId'] ?? ''}');
  if (packageId != null && packageId > 0) {
    detail.packageId = packageId;
  }

  final customPackage =
      _nonEmptyField(detail.customPackageName?.toString()) ??
      _nonEmptyField(args['customPackageName']?.toString());
  if (customPackage != null) {
    detail.customPackageName = customPackage;
  }

  final scheduleType =
      _nonEmptyField(detail.scheduleType) ??
      _nonEmptyField(args['scheduleType']?.toString());
  if (scheduleType != null) {
    detail.scheduleType = scheduleType;
  }

  detail.scheduledAt ??= args['scheduledAt'];
  detail.serviceDatetime ??= args['serviceDatetime'];

  final chargeLimit = detail.vehicleChargeLimit ?? args['vehicleChargeLimit'];
  if (chargeLimit != null && '$chargeLimit'.trim().isNotEmpty) {
    detail.vehicleChargeLimit = chargeLimit;
  }

  final batteryCharge =
      _nonEmptyField(detail.currentBatteryCharge) ??
      _nonEmptyField(args['currentBatteryCharge']?.toString()) ??
      _nonEmptyField(args['current_battery_charge']?.toString());
  if (batteryCharge != null) {
    detail.currentBatteryCharge = batteryCharge;
  }

  final batteryStatus =
      _nonEmptyField(detail.currentBatteryStatus) ??
      _nonEmptyField(args['currentBatteryStatus']?.toString()) ??
      _nonEmptyField(args['current_battery_status']?.toString());
  if (batteryStatus != null) {
    detail.currentBatteryStatus = batteryStatus;
  }

  final batteryLabel =
      _nonEmptyField(detail.currentBatteryStatusLabel) ??
      _nonEmptyField(args['currentBatteryStatusLabel']?.toString()) ??
      _nonEmptyField(args['current_battery_status_label']?.toString());
  if (batteryLabel != null) {
    detail.currentBatteryStatusLabel = batteryLabel;
  }

  final duration =
      detail.serviceDurationMinutes ??
      int.tryParse('${args['serviceDurationMinutes'] ?? ''}');
  if (duration != null && duration > 0) {
    detail.serviceDurationMinutes = duration;
  }

  return detail;
}

String resolveDriverServiceProviderEarningsLabel({
  BookingDetailData? detail,
}) {
  final earning = detail?.driverEarning;
  if (earning != null) {
    if (earning.amount > 0) return earning.amountDisplay;
    final planned = earning.plannedServicePayout;
    if (planned != null && planned > 0) {
      final whole = planned == planned.roundToDouble();
      return whole ? '\$${planned.round()}' : '\$${planned.toStringAsFixed(2)}';
    }
  }
  return '—';
}
