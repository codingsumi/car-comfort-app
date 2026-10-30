import 'service_type_label.dart' show bookingCancellationNotice;

String formatCancelledByLabel(String? raw) {
  switch ('${raw ?? ''}'.trim().toLowerCase()) {
    case 'customer':
      return 'Customer';
    case 'driver':
      return 'Service provider';
    case 'admin':
      return 'Support team';
    default:
      return '';
  }
}

String formatCancellationReasonCode(String? raw) {
  final code = '${raw ?? ''}'.trim().toLowerCase().replaceAll('-', '_');
  if (code.isEmpty) return '';

  switch (code) {
    case 'customer_no_show':
      return 'Customer did not show at pick-up (no-show recorded by the provider).';
    case 'no_show':
    case 'no_call':
    case 'no_show_no_call':
      return 'Customer no-show — provider could not complete handover.';
    case 'customer_cancelled':
    case 'customer_request':
      return 'Cancelled at the customer\'s request.';
    case 'driver_cancelled':
    case 'driver_unavailable':
      return 'Cancelled by the service provider.';
    case 'admin_cancelled':
      return 'Cancelled by support.';
    default:
      break;
  }

  final humanized = code
      .split('_')
      .where((w) => w.isNotEmpty)
      .map((w) => '${w[0].toUpperCase()}${w.length > 1 ? w.substring(1) : ''}')
      .join(' ');
  return humanized.isEmpty ? '' : '$humanized.';
}

/// Headline + who cancelled + reason for service detail banners.
String bookingCancellationDetailMessage({
  String? serviceTypeRaw,
  String? cancelledBy,
  String? cancellationReason,
}) {
  final lines = <String>[
    bookingCancellationNotice(serviceTypeRaw),
  ];

  final by = formatCancelledByLabel(cancelledBy);
  if (by.isNotEmpty) {
    lines.add('Cancelled by: $by');
  }

  final reason = formatCancellationReasonCode(cancellationReason);
  if (reason.isNotEmpty) {
    lines.add('Reason: $reason');
  }

  return lines.join('\n');
}

bool isTerminalCancelledStatus(String? statusLower) {
  final s = '${statusLower ?? ''}'.trim().toLowerCase();
  return s == 'cancelled' || s == 'canceled';
}
