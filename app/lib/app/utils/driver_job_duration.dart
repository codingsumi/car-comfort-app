import 'service_type_label.dart';

/// Fallback service durations when API omits package metadata (admin catalog).
int fallbackServiceDurationMinutes({
  String? serviceType,
  String? packageName,
}) {
  final pkg = (packageName ?? '').trim().toLowerCase();
  if (pkg.contains('basic') && pkg.contains('wash')) return 30;
  if (pkg.contains('deluxe')) return 35;
  if (pkg.contains('ultimate')) return 40;
  if (pkg.contains('premium') && pkg.contains('wash')) return 45;
  if (pkg.contains('premium combo') || pkg.contains('premium wash')) return 45;
  if (pkg.contains('quick combo')) return 60;
  if (pkg.contains('combo') || (pkg.contains('ev') && pkg.contains('wash'))) {
    return 70; // default combo duration — matches admin default
  }

  final comp = bookingServiceComposition(serviceType);
  if (comp.isCombined) return 60;
  if (comp.hasEvCharging) return 40;
  if (comp.hasCarWash) return 30;
  return 30;
}

/// Estimated time to perform the service (package duration), excluding travel.
int resolveEstimatedServiceMinutes({
  int? estimatedCompletionMinutes,
  int? serviceDurationMinutes,
  String? serviceType,
  String? packageName,
}) {
  if (serviceDurationMinutes != null && serviceDurationMinutes > 0) {
    return serviceDurationMinutes;
  }
  if (estimatedCompletionMinutes != null && estimatedCompletionMinutes > 0) {
    return estimatedCompletionMinutes;
  }
  return fallbackServiceDurationMinutes(
    serviceType: serviceType,
    packageName: packageName,
  );
}

/// Total job window including drive time (map / planning only).
int resolveEstimatedTotalJobMinutes({
  int? estimatedCompletionMinutes,
  int? serviceDurationMinutes,
  int? estimatedTravelMinutes,
  String? serviceType,
  String? packageName,
}) {
  final service = resolveEstimatedServiceMinutes(
    estimatedCompletionMinutes: estimatedCompletionMinutes,
    serviceDurationMinutes: serviceDurationMinutes,
    serviceType: serviceType,
    packageName: packageName,
  );
  final travel = estimatedTravelMinutes ?? 0;
  return service + (travel > 0 ? travel : 0);
}

/// @deprecated Prefer [resolveEstimatedServiceMinutes] for "time to complete".
int resolveEstimatedCompletionMinutes({
  int? estimatedCompletionMinutes,
  int? serviceDurationMinutes,
  int? estimatedTravelMinutes,
  String? serviceType,
  String? packageName,
}) {
  return resolveEstimatedServiceMinutes(
    estimatedCompletionMinutes: estimatedCompletionMinutes,
    serviceDurationMinutes: serviceDurationMinutes,
    serviceType: serviceType,
    packageName: packageName,
  );
}

String formatJobDurationLabel(int minutes) {
  if (minutes <= 0) return '—';
  return '$minutes min';
}

/// Human-readable service duration for assigned / active booking detail screens.
String estimatedServiceDurationLabelForBooking({
  int? packageDurationMinutes,
  int? serviceDurationMinutes,
  int? estimatedCompletionMinutes,
  String? serviceType,
  String? packageName,
  String? customPackageName,
}) {
  final minutes = resolveEstimatedServiceMinutes(
    serviceDurationMinutes: serviceDurationMinutes ?? packageDurationMinutes,
    estimatedCompletionMinutes: estimatedCompletionMinutes,
    serviceType: serviceType,
    packageName: packageName ?? customPackageName,
  );
  if (minutes <= 0) return '—';
  return '$minutes minutes';
}

String formatProviderEarningLabel({
  double? providerEarning,
  String? providerEarningDisplay,
}) {
  final display = providerEarningDisplay?.trim();
  if (display != null && display.isNotEmpty) return display;
  if (providerEarning != null && providerEarning > 0) {
    final whole = providerEarning == providerEarning.roundToDouble();
    return whole
        ? '\$${providerEarning.round()}'
        : '\$${providerEarning.toStringAsFixed(2)}';
  }
  return '—';
}

String driverJobScheduleTypeLabel(String? scheduleType) {
  final t = (scheduleType ?? '').trim().toLowerCase().replaceAll('-', '_');
  if (t == 'scheduled') return 'Scheduled service';
  return 'On-demand service';
}
