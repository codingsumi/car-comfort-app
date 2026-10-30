/// User-facing copy for people who perform pickups and services (role: `driver` in API).
abstract final class ServiceProviderLabels {
  static const fallbackName = 'Service Provider';
  static const fallbackNameYour = 'Your service provider';
  static const notAssigned = 'Service Provider Not Assigned';
  static const assigned = 'Service Provider Assigned';

  /// Cancellation subtitles for the bookings list. [cancelledByYou] is shown to
  /// whoever initiated the cancellation; the others clarify the counterpart.
  static const cancelledByYou = 'Cancelled by you';
  static const cancelledByProvider = 'Cancelled by service provider';
  static const cancelledByCustomer = 'Cancelled by customer';
  static const cancelledBySupport = 'Cancelled by support team';
  static const cancelledGeneric = 'Cancelled';
  static const profileTitle = 'Service Provider Profile';
  static const idLabel = 'Service Provider ID';
  static const signUpRole = 'Service Provider';
  static const supportTicketRole = 'Service Provider';
}
