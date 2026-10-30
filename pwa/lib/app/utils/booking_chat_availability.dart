/// When booking chat should be offered in customer/driver UIs.
enum BookingChatMode {
  hidden,
  active,
  readOnly,
}

BookingChatMode bookingChatModeForStatus(String? status) {
  final normalized = (status ?? '').trim().toLowerCase();
  if (normalized == 'cancelled' || normalized == 'canceled') {
    return BookingChatMode.hidden;
  }
  if (normalized == 'completed' || normalized == 'vehicle_delivered') {
    return BookingChatMode.readOnly;
  }
  return BookingChatMode.active;
}

bool bookingChatVisibleForCustomer({
  required String statusLower,
  required bool hasDriverAssigned,
}) {
  final mode = bookingChatModeForStatus(statusLower);
  if (mode == BookingChatMode.hidden) return false;
  if (mode == BookingChatMode.readOnly) return true;
  return hasDriverAssigned;
}

bool bookingChatVisibleForDriver(String? status) {
  return bookingChatModeForStatus(status) != BookingChatMode.hidden;
}

String bookingChatButtonLabel(
  String? status, {
  required bool isDriverView,
}) {
  if (bookingChatModeForStatus(status) == BookingChatMode.readOnly) {
    return 'View Chat';
  }
  return isDriverView ? 'Message Customer' : 'Message Service Provider';
}
