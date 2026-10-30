/// Customer-facing copy for [booking_tracking_update] payloads (`tracking_status`).
const Map<String, String> kBookingTrackingStatusMessages = {
  'DRIVER_STARTED_TO_CUSTOMER':
      'Your service provider is heading to the vehicle pick-up location.',
  'DRIVER_NEAR_CUSTOMER': 'Your service provider is arriving soon',
  'DRIVER_REACHED_CUSTOMER':
      'Your service provider has arrived at the vehicle pick-up location.',
  'OTP_PENDING': 'Please provide the OTP to your service provider',
  'OTP_VERIFIED': 'OTP has been verified successfully',
  'VEHICLE_PICKED': 'Your vehicle has been picked up',
  'DRIVER_STARTED_TO_SERVICE_CENTER':
      'Your service provider is on the way to the service center',
  'DRIVER_REACHED_SERVICE_CENTER':
      'Your service provider has arrived at the service center',
  'SERVICE_STARTED': 'Vehicle service has started',
  'SERVICE_IN_PROGRESS': 'Your vehicle is currently being serviced',
  'SERVICE_COMPLETED': 'Vehicle service has been completed',
  'FIRST_SERVICE_COMPLETED': 'EV charging has been completed',
  'DRIVER_HEADING_TO_NEXT_SERVICE_STOP':
      'Your service provider is heading to the car wash',
  'DRIVER_REACHED_NEXT_SERVICE_STOP':
      'Your service provider has arrived at the car wash',
  'SECOND_SERVICE_STARTED': 'Car wash service has started',
  'SECOND_SERVICE_IN_PROGRESS': 'Car wash is in progress',
  'SECOND_SERVICE_COMPLETED': 'Car wash has been completed',
  'BEFORE_IMAGES_UPLOADED': 'Before-service images are now available',
  'AFTER_IMAGES_UPLOADED': 'After-service images are now available',
  'DRIVER_LEFT_SERVICE_CENTER':
      'Your service provider has left the service center',
  'DRIVER_RETURNING_TO_CUSTOMER':
      'Your service provider is on the way to return your vehicle',
  'DRIVER_REACHED_CUSTOMER_RETURN':
      'Your service provider has arrived at the vehicle drop-off location.',
  'VEHICLE_DELIVERED': 'Your vehicle has been successfully delivered',
  'BOOKING_CANCELLED': 'Booking Cancelled',
};

/// Customer-facing copy for [booking_status_update] lifecycle values.
const Map<String, String> kBookingLifecycleStatusMessages = {
  'ASSIGNED':
      'Your service provider has been assigned and is preparing to head toward the pick-up location',
  'COMPLETED': 'Your booking has been completed successfully',
  'CANCELLED': 'Your booking has been cancelled',
};

String bookingTrackingCustomerMessage(String trackingStatus) {
  final key = trackingStatus.trim().toUpperCase();
  return kBookingTrackingStatusMessages[key] ?? trackingStatus;
}

String bookingLifecycleCustomerMessage(String bookingStatus) {
  final key = bookingStatus.trim().toUpperCase();
  return kBookingLifecycleStatusMessages[key] ?? bookingStatus;
}

/// Customer-facing pickup OTP prompt (dashboard + service details).
String bookingPickupOtpShareMessage(String otp) {
  final code = otp.trim();
  if (code.isEmpty) {
    return 'Please provide OTP to your service provider';
  }
  return 'Please provide OTP to your service provider: $code';
}
