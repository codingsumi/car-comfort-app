import '../network/response/booking_detail_response.dart';
import 'booking_timer_utils.dart';
import 'driver_service_details_display.dart';

typedef CustomerServiceDetailLine = DriverServiceDetailLine;

String formatCustomerVehicleLabel(BookingDetailData? detail) {
  final v = detail?.vehicle;
  if (v == null) return '—';

  final parts = <String>[
    if (v.year != null && '$v.year'.trim().isNotEmpty) '${v.year}',
    if ((v.make ?? '').trim().isNotEmpty) v.make!.trim(),
    if ((v.model ?? '').trim().isNotEmpty) v.model!.trim(),
  ];
  final main = parts.join(' ').trim();
  final type = (v.vehicleType ?? '').trim();
  final color = (v.color ?? '').trim();

  final extras = <String>[
    if (type.isNotEmpty) type,
    if (color.isNotEmpty) color,
  ];

  if (main.isEmpty && extras.isEmpty) return '—';
  if (extras.isEmpty) return main;
  if (main.isEmpty) return extras.join(' · ');
  return '$main · ${extras.join(' · ')}';
}

String formatCustomerServiceDurationLabel(BookingDetailData? detail) {
  final minutes = detail?.serviceDurationMinutes;
  if (minutes == null || minutes <= 0) return '—';
  if (minutes < 60) return '$minutes min';
  final h = minutes ~/ 60;
  final m = minutes % 60;
  if (m == 0) return '$h hr';
  return '$h hr $m min';
}

String formatCustomerTimeOfServiceLabel(BookingDetailData? detail) {
  if (detail == null) return '—';
  if (isOnDemandScheduleType(detail.scheduleType)) {
    return 'As soon as possible';
  }
  final scheduled = formatBookingScheduleLine(
    bookingScheduledAtIso(
      scheduledAt: detail.scheduledAt,
      serviceDatetime: detail.serviceDatetime,
    ),
  );
  if (scheduled.trim().isNotEmpty && scheduled != '—') return scheduled;
  return '—';
}

String formatCustomerTotalChargedLabel(BookingDetailData? detail) {
  final display = detail?.totalPriceDisplay?.trim();
  if (display != null && display.isNotEmpty) return display;
  final total = detail?.totalPrice;
  if (total != null) return '\$${total.toStringAsFixed(2)}';
  final summaryTotal = detail?.priceSummary?.total;
  if (summaryTotal != null && summaryTotal > 0) {
    return '\$${summaryTotal.toStringAsFixed(2)}';
  }
  return '—';
}

List<CustomerServiceDetailLine> buildCustomerServiceDetailLines({
  required BookingDetailData? detail,
}) {
  final comp = resolveDriverBookingServiceComposition(detail);
  final lines = <CustomerServiceDetailLine>[
    CustomerServiceDetailLine.labeled(
      'Service type',
      resolveDriverServiceTypeLabel(detail),
    ),
  ];

  if (comp.hasCarWash) {
    lines.add(
      CustomerServiceDetailLine.standalone(
        driverCarWashPackageCategoryLabel(detail),
      ),
    );
    if (driverBookingIsPremiumCustomPackage(detail)) {
      final customName = detail!.customPackageName!.toString().trim();
      lines.add(CustomerServiceDetailLine.standalone(customName));
    } else {
      final packageName = driverCarWashPackageName(detail);
      if (packageName != null) {
        lines.add(CustomerServiceDetailLine.standalone(packageName));
      }
    }
  }

  if (comp.hasEvCharging) {
    final battery = formatDriverCurrentBatteryLabel(detail);
    lines.add(
      CustomerServiceDetailLine.labeled(
        'Current battery',
        battery ?? '—',
      ),
    );
    final chargeLimit = formatDriverVehicleChargeLimit(detail);
    if (chargeLimit != null) {
      lines.add(
        CustomerServiceDetailLine.labeled('Vehicle charge limit', chargeLimit),
      );
    }
  }

  lines
    ..add(
      CustomerServiceDetailLine.labeled(
        'Vehicle',
        formatCustomerVehicleLabel(detail),
      ),
    )
    ..add(
      CustomerServiceDetailLine.labeled(
        'Time of service',
        formatCustomerTimeOfServiceLabel(detail),
      ),
    )
    ..add(
      CustomerServiceDetailLine.labeled(
        'Service duration',
        formatCustomerServiceDurationLabel(detail),
      ),
    )
    ..add(
      CustomerServiceDetailLine.labeled(
        'Total charged',
        formatCustomerTotalChargedLabel(detail),
      ),
    );

  return lines;
}
