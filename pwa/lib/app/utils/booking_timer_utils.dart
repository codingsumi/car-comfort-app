/// Helpers for server-driven booking timers (`booking_timer_update` socket / push).
library;

String normalizeBookingTimerPhase(String? raw) {
  return (raw ?? '').trim().toLowerCase();
}

bool isOnDemandScheduleType(String? scheduleType) {
  final t = (scheduleType ?? '').trim().toLowerCase().replaceAll('-', '_');
  return t == 'on_demand' || t == 'asap';
}

bool isScheduledScheduleType(String? scheduleType) {
  final t = (scheduleType ?? '').trim().toLowerCase().replaceAll('-', '_');
  return t == 'scheduled' ||
      t == 'schedule' ||
      t == 'scheduled_booking' ||
      t == 'pre_scheduled';
}

bool hasExplicitScheduledBookingTime({
  dynamic scheduledAt,
  dynamic serviceDatetime,
}) {
  return bookingScheduledAtIso(
        scheduledAt: scheduledAt,
        serviceDatetime: serviceDatetime,
      ) !=
      null;
}

bool isScheduledBooking({
  String? scheduleType,
  dynamic scheduledAt,
  dynamic serviceDatetime,
}) {
  if (isOnDemandScheduleType(scheduleType)) return false;
  return isScheduledScheduleType(scheduleType) ||
      hasExplicitScheduledBookingTime(
        scheduledAt: scheduledAt,
        serviceDatetime: serviceDatetime,
      );
}

/// Customer-selected service time from booking detail / list payloads.
String? bookingScheduledAtIso({dynamic scheduledAt, dynamic serviceDatetime}) {
  for (final raw in [scheduledAt, serviceDatetime]) {
    final s = '$raw'.trim();
    if (s.isNotEmpty && !_isNullishBookingFieldValue(s)) return s;
  }
  return null;
}

bool _isNullishBookingFieldValue(String raw) {
  final lower = raw.trim().toLowerCase();
  return lower == 'null' || lower == 'undefined' || lower == '—';
}

/// Provider service-details time line.
/// On-demand → `As soon as possible`; scheduled → `Service scheduled for 07/01/2026 at 2pm`.
///
/// When [createdAtIso] is supplied and the booking is on-demand the label
/// becomes `As soon as possible • July 8, 11:14 AM` so providers can see
/// how long the request has been waiting.
String formatProviderTimeOfServiceLabel({
  String? scheduleType,
  String? scheduledAtIso,
  String? createdAtIso,
}) {
  final type = (scheduleType ?? '').trim().toLowerCase().replaceAll('-', '_');
  final iso = scheduledAtIso?.trim();
  final hasScheduledTime =
      iso != null && iso.isNotEmpty && !_isNullishBookingFieldValue(iso);
  if (isOnDemandScheduleType(scheduleType) ||
      ((type.isEmpty || _isNullishBookingFieldValue(type)) &&
          !hasScheduledTime)) {
    return _asapWithCreatedAt(createdAtIso);
  }

  if (!hasScheduledTime && !isScheduledScheduleType(scheduleType)) {
    return _asapWithCreatedAt(createdAtIso);
  }
  if (!hasScheduledTime) {
    return 'Service scheduled for —';
  }
  final dt = DateTime.tryParse(iso)?.toLocal();
  if (dt == null) return _asapWithCreatedAt(createdAtIso);
  final month = dt.month.toString().padLeft(2, '0');
  final day = dt.day.toString().padLeft(2, '0');
  final year = dt.year;
  final hour = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
  final minute = dt.minute;
  final ap = dt.hour >= 12 ? 'pm' : 'am';
  final timePart = minute == 0
      ? '$hour$ap'
      : '$hour:${minute.toString().padLeft(2, '0')}$ap';
  return 'Service scheduled for $month/$day/$year at $timePart';
}

/// Formats the booking creation timestamp as `July 8, 11:14 AM`.
String? formatBookingCreatedAtLabel(String? iso) {
  if (iso == null || iso.trim().isEmpty) return null;
  final dt = DateTime.tryParse(iso.trim())?.toLocal();
  if (dt == null) return null;
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  final mon = months[dt.month - 1];
  final day = dt.day;
  final hour = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
  final minute = dt.minute.toString().padLeft(2, '0');
  final ap = dt.hour >= 12 ? 'PM' : 'AM';
  return '$mon $day, $hour:$minute $ap';
}

/// Returns `As soon as possible` optionally suffixed with the created-at
/// timestamp: `As soon as possible • July 8, 11:14 AM`.
String _asapWithCreatedAt(String? createdAtIso) {
  final label = formatBookingCreatedAtLabel(createdAtIso);
  if (label == null) return 'As soon as possible';
  return 'As soon as possible  •  $label';
}

/// e.g. `Scheduled for Jun 5, 2026 • 2:30 PM`
String formatBookingScheduleLine(String? iso) {
  if (iso == null || iso.trim().isEmpty) {
    return 'Scheduled for —';
  }
  final dt = DateTime.tryParse(iso);
  if (dt == null) return 'Scheduled for ${iso.trim()}';
  final local = dt.toLocal();
  const months = <String>[
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  final mon = months[local.month - 1];
  final day = local.day;
  final year = local.year;
  final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
  final minute = local.minute.toString().padLeft(2, '0');
  final ap = local.hour >= 12 ? 'PM' : 'AM';
  return 'Scheduled for $mon $day, $year • $hour:$minute $ap';
}

DateTime? parseBookingTimerDate(dynamic raw) {
  if (raw == null) return null;
  if (raw is DateTime) return raw.toLocal();
  final s = '$raw'.trim();
  if (s.isEmpty) return null;
  return DateTime.tryParse(s)?.toLocal();
}

int secondsUntil(DateTime? expiresAt) {
  if (expiresAt == null) return 0;
  return expiresAt.difference(DateTime.now()).inSeconds.clamp(0, 86400);
}

/// `MM:SS` for under 1 hour, otherwise `H:MM:SS`.
/// Whole minutes elapsed for en-route service-center chip (e.g. `5` → "5 Mins").
String formatElapsedMinutesChip(int elapsedSeconds) {
  final mins = (elapsedSeconds ~/ 60).clamp(0, 9999);
  return '$mins';
}

/// Stopwatch-style `MM:SS` (or `H:MM:SS` over 1 hour) for the en-route elapsed chip.
/// Shows every second so the driver feels the urgency of real-time counting.
String formatElapsedStopwatch(int elapsedSeconds) {
  final s = elapsedSeconds.clamp(0, 86400);
  final h = s ~/ 3600;
  final m = (s % 3600) ~/ 60;
  final sec = s % 60;
  final mm = m.toString().padLeft(2, '0');
  final ss = sec.toString().padLeft(2, '0');
  if (h > 0) return '$h:$mm:$ss';
  return '$mm:$ss';
}

String formatBookingTimerCountdown(int totalSeconds) {
  final s = totalSeconds.clamp(0, 86400);
  final h = s ~/ 3600;
  final m = (s % 3600) ~/ 60;
  final sec = s % 60;
  if (h > 0) {
    return '$h:${m.toString().padLeft(2, '0')}:${sec.toString().padLeft(2, '0')}';
  }
  return '${m.toString().padLeft(2, '0')}:${sec.toString().padLeft(2, '0')}';
}

String bookingTimerPhaseTitle(String phase) {
  switch (normalizeBookingTimerPhase(phase)) {
    case 'accept_countdown':
      return 'Start heading to pick-up';
    case 'accept_timeout':
      return 'Pick-up window ended';
    case 'arrival_countdown':
      return 'Waiting at pick-up';
    case 'arrival_expired':
      return 'Wait window ended';
    case 'service_countdown':
      return 'Service in progress';
    case 'service_max_reached':
      return 'Maximum service time reached';
    default:
      return 'Booking timer';
  }
}

String bookingTimerPhaseSubtitle(String phase, int remainingSeconds) {
  final countdown = formatBookingTimerCountdown(remainingSeconds);
  switch (normalizeBookingTimerPhase(phase)) {
    case 'accept_countdown':
      return 'Start driving to pick-up or this job returns to the board.';
    case 'arrival_countdown':
      return 'Contact the customer by call or text through the app.';
    case 'arrival_expired':
      return 'You may mark a customer no-show if the customer is not available.';
    case 'accept_timeout':
      return 'The provider did not start in time. The job is back on the board for other providers.';
    case 'service_countdown':
      return 'Service time remaining: $countdown';
    case 'service_max_reached':
      return 'The 3-hour service window has been reached.';
    default:
      return countdown;
  }
}
