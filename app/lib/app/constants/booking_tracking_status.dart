/// Visual state for a row in the booking route plan (pickup / service / dropoff).
enum BookingRouteLegStyle {
  /// Not yet reached for the current [tracking_status].
  upcoming,

  /// Current journey segment.
  active,

  /// Already completed for the current [tracking_status].
  completed,
}

/// Values for `POST .../bookings/:id/tracking-status` body field `tracking_status`
/// (event: `booking_tracking_update`).
abstract final class BookingTrackingStatus {
  static const driverStartedToCustomer = 'DRIVER_STARTED_TO_CUSTOMER';
  static const driverNearCustomer = 'DRIVER_NEAR_CUSTOMER';
  static const driverReachedCustomer = 'DRIVER_REACHED_CUSTOMER';
  static const otpPending = 'OTP_PENDING';
  static const otpVerified = 'OTP_VERIFIED';
  static const bookingCancelled = 'BOOKING_CANCELLED';
  static const vehiclePicked = 'VEHICLE_PICKED';
  static const driverStartedToServiceCenter = 'DRIVER_STARTED_TO_SERVICE_CENTER';
  static const driverReachedServiceCenter = 'DRIVER_REACHED_SERVICE_CENTER';
  static const vehicleWaitingInQueue = 'VEHICLE_WAITING_IN_QUEUE';
  static const serviceLocationIssue = 'SERVICE_LOCATION_ISSUE';
  static const serviceStarted = 'SERVICE_STARTED';
  static const serviceInProgress = 'SERVICE_IN_PROGRESS';
  static const serviceCompleted = 'SERVICE_COMPLETED';
  static const firstServiceCompleted = 'FIRST_SERVICE_COMPLETED';
  static const driverHeadingToNextServiceStop =
      'DRIVER_HEADING_TO_NEXT_SERVICE_STOP';
  static const driverReachedNextServiceStop =
      'DRIVER_REACHED_NEXT_SERVICE_STOP';
  static const secondServiceStarted = 'SECOND_SERVICE_STARTED';
  static const secondServiceInProgress = 'SECOND_SERVICE_IN_PROGRESS';
  static const secondServiceCompleted = 'SECOND_SERVICE_COMPLETED';
  static const beforeImagesUploaded = 'BEFORE_IMAGES_UPLOADED';
  static const afterImagesUploaded = 'AFTER_IMAGES_UPLOADED';
  static const driverLeftServiceCenter = 'DRIVER_LEFT_SERVICE_CENTER';
  static const driverReturningToCustomer = 'DRIVER_RETURNING_TO_CUSTOMER';
  static const driverReachedCustomerReturn = 'DRIVER_REACHED_CUSTOMER_RETURN';
  static const vehicleDelivered = 'VEHICLE_DELIVERED';

  static const Set<String> _knownCodes = {
    driverStartedToCustomer,
    driverNearCustomer,
    driverReachedCustomer,
    otpPending,
    otpVerified,
    vehiclePicked,
    driverStartedToServiceCenter,
    driverReachedServiceCenter,
    vehicleWaitingInQueue,
    serviceLocationIssue,
    serviceStarted,
    serviceInProgress,
    serviceCompleted,
    firstServiceCompleted,
    driverHeadingToNextServiceStop,
    driverReachedNextServiceStop,
    secondServiceStarted,
    secondServiceInProgress,
    secondServiceCompleted,
    beforeImagesUploaded,
    afterImagesUploaded,
    driverLeftServiceCenter,
    driverReturningToCustomer,
    driverReachedCustomerReturn,
    vehicleDelivered,
  };

  static bool isKnownCode(String? raw) {
    if (raw == null) return false;
    return _knownCodes.contains(raw.trim().toUpperCase());
  }

  /// Tracking codes that must not open a live booking socket (`join_booking`).
  static bool isTerminalForLiveSocketJoin(String? trackingCode) {
    final t = normalizeTrackingCode(trackingCode);
    if (t.isEmpty) return false;
    return t == bookingCancelled || t == vehicleDelivered;
  }

  /// Push / resume: only join when status is a known in-trip milestone (not terminal).
  static bool isEligibleForLiveSocketJoin(String? trackingCode) {
    final t = normalizeTrackingCode(trackingCode);
    if (t.isEmpty) return true;
    if (isTerminalForLiveSocketJoin(t)) return false;
    return isKnownCode(t);
  }

  /// Provider has tapped Start and the server recorded a trip milestone.
  static bool isProviderTripStarted(String? trackingStatus) {
    final t = normalizeTrackingCode(trackingStatus);
    return t.isNotEmpty && isKnownCode(t);
  }

  /// Accepted / assigned but provider has not started the trip yet.
  static bool isBookingAwaitingProviderTripStart({
    String? bookingStatus,
    String? trackingStatus,
  }) {
    if (isProviderTripStarted(trackingStatus)) return false;
    final life = '${bookingStatus ?? ''}'.trim().toLowerCase();
    return life == 'assigned' || life == 'confirmed';
  }

  /// Customer home bottom sheet — show as soon as booking is confirmed/assigned/scheduled,
  /// and throughout the entire trip until delivery is complete.
  static bool shouldShowCustomerTripPanel(
    String? trackingStatus, {
    String? bookingStatus,
  }) {
    final t = normalizeTrackingCode(trackingStatus);
    if (t == bookingCancelled) return false;
    // Show once provider has started the trip
    if (isProviderTripStarted(trackingStatus)) return true;
    // Also show for confirmed/assigned/scheduled bookings awaiting provider
    return isBookingAwaitingProviderTripStart(
      bookingStatus: bookingStatus,
      trackingStatus: trackingStatus,
    );
  }

  /// Customer should open live trip + `join_booking` (e.g. driver en route socket/push).
  static bool shouldBootstrapCustomerLiveTrip(
    String? trackingCode, {
    String? bookingStatus,
  }) {
    final t = normalizeTrackingCode(trackingCode);
    if (t.isEmpty) return false;
    return isEligibleForLiveSocketJoin(trackingCode);
  }

  /// Normalized `tracking_status` from API/socket (`''` if missing).
  static String normalizeTrackingCode(dynamic raw) {
    if (raw == null) return '';
    final s = '$raw'.trim();
    return s.isEmpty ? '' : s.toUpperCase();
  }

  static bool isVehicleDelivered(dynamic trackingStatus) =>
      normalizeTrackingCode(trackingStatus) == vehicleDelivered;

  /// Customer still needs to inspect the car / finish post-delivery steps.
  static bool isCustomerAwaitingDeliveryInspection({
    String? trackingStatus,
  }) =>
      isVehicleDelivered(trackingStatus);

  static const Map<String, int> _trackingStatusRank = {
    driverStartedToCustomer: 10,
    driverNearCustomer: 20,
    driverReachedCustomer: 30,
    otpPending: 35,
    otpVerified: 40,
    beforeImagesUploaded: 45,
    vehiclePicked: 50,
    driverStartedToServiceCenter: 60,
    driverReachedServiceCenter: 70,
    vehicleWaitingInQueue: 75,
    serviceLocationIssue: 82,
    serviceStarted: 80,
    serviceInProgress: 85,
    serviceCompleted: 90,
    firstServiceCompleted: 91,
    driverHeadingToNextServiceStop: 92,
    driverReachedNextServiceStop: 93,
    secondServiceStarted: 94,
    secondServiceInProgress: 95,
    secondServiceCompleted: 96,
    driverLeftServiceCenter: 100,
    driverReturningToCustomer: 110,
    driverReachedCustomerReturn: 120,
    afterImagesUploaded: 125,
    vehicleDelivered: 130,
  };

  static int _trackingRank(String? raw) {
    final t = normalizeTrackingCode(raw);
    if (t.isEmpty) return -1;
    return _trackingStatusRank[t] ?? -1;
  }

  /// True once the driver has arrived for return drop-off until delivery completes.
  static const int otpVerifiedRank = 40;

  /// True after the customer pickup PIN has been verified by the provider.
  static bool isPickupOtpVerified(String? trackingStatus) {
    final rank = _trackingRank(trackingStatus);
    return rank >= otpVerifiedRank;
  }

  /// After pickup OTP is verified the vehicle handover is in progress — no self-service cancel.
  static bool isCancellationBlockedAfterOtp({
    String? bookingStatus,
    String? trackingStatus,
  }) {
    if (isVehicleDelivered(trackingStatus)) return true;
    if (isBookingCancelled(
      bookingStatus: bookingStatus,
      trackingStatus: trackingStatus,
    )) {
      return true;
    }
    final rank = _trackingRank(trackingStatus);
    if (rank < 0) return false;
    return rank >= otpVerifiedRank;
  }

  /// Driver/service detail: hide Cancel Booking once handover has started.
  static bool canDriverCancelBooking({
    String? bookingStatus,
    String? trackingStatus,
  }) {
    if (isCancellationBlockedAfterOtp(
      bookingStatus: bookingStatus,
      trackingStatus: trackingStatus,
    )) {
      return false;
    }
    if (isVehicleDelivered(trackingStatus)) return false;
    if (isBookingCancelled(
      bookingStatus: bookingStatus,
      trackingStatus: trackingStatus,
    )) {
      return false;
    }
    final life = '${bookingStatus ?? ''}'.trim().toLowerCase();
    if (life == 'completed' ||
        life == 'cancelled' ||
        life == 'canceled' ||
        life == 'failed' ||
        life == 'refunded') {
      return false;
    }
    return true;
  }

  /// Provider still has a job in flight (assigned / in-progress, not delivered or cancelled).
  static bool isDriverLiveBooking({
    String? bookingStatus,
    String? trackingStatus,
  }) {
    if (isBookingCancelled(
      bookingStatus: bookingStatus,
      trackingStatus: trackingStatus,
    )) {
      return false;
    }
    if (isVehicleDelivered(trackingStatus)) return false;
    final life = '${bookingStatus ?? ''}'.trim().toLowerCase();
    if (life == 'completed' ||
        life == 'cancelled' ||
        life == 'canceled' ||
        life == 'failed' ||
        life == 'refunded') {
      return false;
    }
    return life == 'assigned' || life == 'in_progress';
  }

  static bool isDriverAfterServiceDeliveryLocked({
    String? bookingStatus,
    String? trackingStatus,
  }) {
    if (isVehicleDelivered(trackingStatus)) return false;
    if (isBookingCancelled(
      bookingStatus: bookingStatus,
      trackingStatus: trackingStatus,
    )) {
      return false;
    }
    final t = normalizeTrackingCode(trackingStatus);
    return t == driverReachedCustomerReturn || t == afterImagesUploaded;
  }

  /// Customer should see pickup OTP until the driver verifies it.
  static bool isCustomerPickupOtpSharePhase(String? trackingStatus) {
    final t = normalizeTrackingCode(trackingStatus);
    return t == driverReachedCustomer || t == otpPending;
  }

  /// Driver at pickup and still needs car details (OTP + before photos).
  static bool isDriverAtCustomerPickupHandover(String? trackingStatus) {
    final t = normalizeTrackingCode(trackingStatus);
    return t == driverReachedCustomer || t == otpPending || t == otpVerified;
  }

  /// Driver is still navigating to customer pickup (not yet at handover).
  static bool isDriverEnRouteToCustomerPickup(String? trackingStatus) {
    final rank = _trackingRank(trackingStatus);
    if (rank < 0) return false;
    return rank < _trackingStatusRank[driverReachedCustomer]!;
  }

  static bool isAtOrPastTracking(String? current, String target) {
    final curRank = _trackingRank(current);
    final targetRank = _trackingRank(target);
    if (curRank < 0 || targetRank < 0) return false;
    return curRank >= targetRank;
  }

  static bool wouldRollbackTracking({
    required String? current,
    required String next,
  }) {
    final cur = normalizeTrackingCode(current);
    final nxt = normalizeTrackingCode(next);
    if (nxt.isEmpty || cur.isEmpty || cur == nxt) return false;
    final curRank = _trackingRank(cur);
    final nextRank = _trackingRank(nxt);
    if (curRank < 0 || nextRank < 0) return false;
    return nextRank < curRank;
  }

  static bool isBookingCancelled({
    String? bookingStatus,
    String? trackingStatus,
  }) {
    final life = '${bookingStatus ?? ''}'.trim().toLowerCase();
    if (life == 'cancelled' || life == 'canceled') return true;
    return normalizeTrackingCode(trackingStatus) == bookingCancelled;
  }

  /// Driver service detail bottom bar: hide Start when trip cannot be resumed.
  static bool canDriverStartTripFromBooking({
    String? bookingStatus,
    String? trackingStatus,
  }) {
    if (isVehicleDelivered(trackingStatus)) return false;
    if (isBookingCancelled(
      bookingStatus: bookingStatus,
      trackingStatus: trackingStatus,
    )) {
      return false;
    }
    final life = '${bookingStatus ?? ''}'.trim().toLowerCase();
    if (life == 'completed' || life == 'failed' || life == 'refunded') {
      return false;
    }
    if (isDriverAfterServiceDeliveryLocked(
      bookingStatus: bookingStatus,
      trackingStatus: trackingStatus,
    )) {
      return false;
    }
    return true;
  }

  /// Combo bookings: driver is on the car wash (second) stop.
  static bool isComboSecondStopPhase(String? trackingStatus) {
    final t = normalizeTrackingCode(trackingStatus);
    return t == driverHeadingToNextServiceStop ||
        t == driverReachedNextServiceStop ||
        t == secondServiceStarted ||
        t == secondServiceInProgress ||
        t == secondServiceCompleted;
  }

  /// Booking list / cards: lifecycle finished (not mid-return leg).
  static bool isBookingServiceCompleted({
    String? bookingStatus,
    String? trackingStatus,
  }) {
    final life = '${bookingStatus ?? ''}'.trim().toUpperCase();
    if (life == 'COMPLETED') return true;
    return isVehicleDelivered(trackingStatus);
  }

  /// Customer live map polyline: driver ([location_update]) → destination for this leg.
  ///
  /// - `pickup`: en route to customer pickup ([driverStartedToCustomer], [driverNearCustomer])
  /// - `service`: en route to service center ([driverStartedToServiceCenter] … [afterImagesUploaded])
  /// - `return`: en route to drop-off / home ([driverLeftServiceCenter] … [driverReachedCustomerReturn])
  /// No polyline while the driver is at pickup, in handoff, or fully delivered.
  static const Set<String> _customerLiveNoRouteCodes = {
    driverReachedCustomer,
    otpPending,
    otpVerified,
    vehiclePicked,
    vehicleDelivered,
  };

  /// - `none`: no driving leg (arrived, in bay, delivered, unknown)
  static String customerLiveRouteLegKey(
    String? trackingCode, {
    bool defaultToPickupWhenEmpty = false,
  }) {
    final t = normalizeTrackingCode(trackingCode);
    if (t.isEmpty) {
      return defaultToPickupWhenEmpty ? 'pickup' : 'none';
    }
    if (_customerLiveNoRouteCodes.contains(t)) {
      return 'none';
    }
    switch (t) {
      case driverStartedToCustomer:
      case driverNearCustomer:
        return 'pickup';
      case driverStartedToServiceCenter:
      case driverReachedServiceCenter:
      case serviceStarted:
      case serviceInProgress:
      case serviceCompleted:
      case firstServiceCompleted:
      case driverHeadingToNextServiceStop:
      case driverReachedNextServiceStop:
      case secondServiceStarted:
      case secondServiceInProgress:
      case beforeImagesUploaded:
      case afterImagesUploaded:
        return 'service';
      case driverLeftServiceCenter:
      case driverReturningToCustomer:
      case driverReachedCustomerReturn:
        return 'return';
      default:
        // e.g. ASSIGNED before first milestone — still route driver → pickup when live.
        return defaultToPickupWhenEmpty ? 'pickup' : 'none';
    }
  }

  static const Set<String> _routePlanReturnPhase = {
    serviceCompleted,
    secondServiceCompleted,
    beforeImagesUploaded,
    afterImagesUploaded,
    driverLeftServiceCenter,
    driverReturningToCustomer,
    driverReachedCustomerReturn,
    vehicleDelivered,
  };

  /// Last leg label: after service, the driver returns the vehicle to the customer.
  static String routePlanDropoffLabel(String trackingNorm) {
    final t = normalizeTrackingCode(trackingNorm);
    if (_routePlanReturnPhase.contains(t)) return 'RETURN DROPOFF';
    return 'DROPOFF';
  }

  /// [legIndex] is 0-based in the rendered list: pickup, optional service, dropoff.
  static BookingRouteLegStyle routeLegStyle({
    required int legIndex,
    required int legCount,
    required String trackingNorm,
  }) {
    final t = normalizeTrackingCode(trackingNorm);
    if (t.isEmpty || legCount <= 0 || legIndex < 0 || legIndex >= legCount) {
      return BookingRouteLegStyle.upcoming;
    }
    if (!isKnownCode(t)) {
      return BookingRouteLegStyle.upcoming;
    }

    final last = legCount - 1;

    if (t == driverReachedCustomerReturn || t == vehicleDelivered) {
      return BookingRouteLegStyle.completed;
    }

    var active = 0;
    switch (t) {
      case driverStartedToCustomer:
      case driverNearCustomer:
      case driverReachedCustomer:
      case otpPending:
      case otpVerified:
        active = 0;
        break;
      case vehiclePicked:
      case driverStartedToServiceCenter:
        active = legCount >= 3 ? 1 : (legCount > 1 ? 1 : 0);
        break;
      case driverReachedServiceCenter:
      case serviceStarted:
      case serviceInProgress:
        active = legCount >= 4 ? 1 : (legCount >= 3 ? 1 : (legCount > 1 ? 1 : 0));
        break;
      case firstServiceCompleted:
      case driverHeadingToNextServiceStop:
        active = legCount >= 4 ? 2 : (legCount >= 3 ? 1 : (legCount > 1 ? 1 : 0));
        break;
      case driverReachedNextServiceStop:
      case secondServiceStarted:
      case secondServiceInProgress:
        active = legCount >= 4 ? 2 : (legCount >= 3 ? 1 : (legCount > 1 ? 1 : 0));
        break;
      case serviceCompleted:
      case secondServiceCompleted:
      case beforeImagesUploaded:
      case afterImagesUploaded:
      case driverLeftServiceCenter:
      case driverReturningToCustomer:
        active = last;
        break;
      default:
        return BookingRouteLegStyle.upcoming;
    }

    if (legIndex < active) return BookingRouteLegStyle.completed;
    if (legIndex == active) return BookingRouteLegStyle.active;
    return BookingRouteLegStyle.upcoming;
  }

  /// Customer-facing copy (matches product descriptions).
  static String customerMessageFor(String? raw) {
    if (raw == null) return '';
    final code = raw.trim().toUpperCase();
    switch (code) {
      case driverStartedToCustomer:
        return 'Your service provider is heading to the vehicle pick-up location.';
      case driverNearCustomer:
        return 'Your service provider is arriving soon';
      case driverReachedCustomer:
        return 'Your service provider has arrived at the vehicle pick-up location.';
      case otpPending:
        return 'Please provide the OTP to your service provider';
      case otpVerified:
        return 'OTP has been verified successfully';
      case vehiclePicked:
        return 'Your vehicle has been picked up';
      case driverStartedToServiceCenter:
        return 'Your vehicle is en route to be serviced';
      case driverReachedServiceCenter:
      case driverReachedNextServiceStop:
        return 'Your vehicle has arrived for service. Please help our service provider with necessary assistance regarding your vehicle if needed.';
      case vehicleWaitingInQueue:
        return 'Your vehicle is waiting to be serviced. We will notify you as soon as service begins.';
      case serviceLocationIssue:
        return 'There is an issue at the service location. Your provider is working to resolve it.';
      case serviceStarted:
      case serviceInProgress:
      case secondServiceStarted:
      case secondServiceInProgress:
        return "Your vehicle is currently being serviced. We'll notify you when it's on the way back to you.";
      case serviceCompleted:
      case secondServiceCompleted:
        return 'Service has been completed';
      case firstServiceCompleted:
        return 'EV charging has been completed';
      case driverHeadingToNextServiceStop:
        return 'Your vehicle is en route to the car wash';
      case beforeImagesUploaded:
        return "Here's your pre-service photos. Your vehicle is en-route to be serviced.";
      case afterImagesUploaded:
        return 'Your after-service photos are now available';
      case driverLeftServiceCenter:
        return 'Your vehicle is en route back to you/drop off location.';
      case driverReturningToCustomer:
        return 'Your service provider is on the way to return your vehicle';
      case driverReachedCustomerReturn:
        return 'Your service provider has arrived at the vehicle drop-off location.';
      case vehicleDelivered:
        return 'Thank you for choosing CarComfort. Your after-service photos and final billing are now available.';
      default:
        return raw.trim();
    }
  }
}
