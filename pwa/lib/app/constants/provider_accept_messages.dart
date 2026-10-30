import '../utils/booking_timer_utils.dart';

/// Provider copy after accepting a booking — mirrors backend
/// `bookingAfterBookingMessages.js`.
class ProviderAcceptMessages {
  ProviderAcceptMessages._();

  static const onDemandAfterAccept =
      'Hello, thank you for accepting this booking. This is an on-demand service, and you have up to 15 minutes to begin heading to the vehicle pick-up location. If you do not start within that time, the job may be reassigned or returned to the job board.';

  static const scheduledAfterAccept =
      'Hello, and thank you for accepting this booking. This is a scheduled service job. On the day of service, please begin heading to the vehicle pick-up location at least one hour in advance. If you do not start within that time, the job may be reassigned or returned to the job board.';

  static String footerNoteForScheduleType(String? scheduleType) {
    if (isOnDemandScheduleType(scheduleType)) {
      return onDemandAfterAccept;
    }
    return scheduledAfterAccept;
  }
}
