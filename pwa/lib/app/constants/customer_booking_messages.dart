/// Customer-facing copy on booking receipts — mirrors backend
/// `bookingAfterBookingMessages.js` (short form for in-app receipt).
class CustomerBookingMessages {
  CustomerBookingMessages._();

  static const welcomeAfterBooking =
      "Thank you for booking with CarComfort. We'll notify you as soon as a service provider becomes available in your area.";

  static const providerAssignedOnDemand =
      'Your service provider has been assigned and is preparing to head toward the pick-up location.';

  static const providerAssignedScheduled =
      "Your service provider has been assigned. We'll notify you if anything changes before your scheduled appointment.";

  static const serviceCompleted =
      'Your service has been completed. Thank you for choosing CarComfort!';

  static const serviceInProgress =
      'Your service is in progress. Track live updates below.';
}
