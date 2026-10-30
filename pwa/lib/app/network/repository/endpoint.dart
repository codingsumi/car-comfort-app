class API {
  static const _baseEndpoint = "api/";

  /// Public app status (maintenance mode). Not blocked by maintenance guard.
  static const appStatus = "${_baseEndpoint}app/status";

  // Auth Endpoints
  static const login = "${_baseEndpoint}auth/login";
  static const customerRegister = "${_baseEndpoint}auth/register";
  static const forgotPassword = "${_baseEndpoint}auth/forgot-password";
  static const verifyOtp = "${_baseEndpoint}auth/verify-otp";
  static const verifyResetOtp = "${_baseEndpoint}auth/verify-reset-otp";
  static const resendOtp = "${_baseEndpoint}auth/resend-otp";
  static const resendOtpEmail = "${_baseEndpoint}auth/resend-otp-email";
  static const verifyOtpEmail = "${_baseEndpoint}auth/verify-otp-email";
  static const resetPassword = "${_baseEndpoint}auth/reset-password";
  static const logout = "${_baseEndpoint}auth/logout";
  static const switchRole = "${_baseEndpoint}auth/switch-role";
  static const availableRoles = "${_baseEndpoint}auth/available-roles";
  static const accountDeletionRequest =
      "${_baseEndpoint}account-deletion-requests/me";

  /// Customer tutorial (video + bullet instructions).
  static const tutorial = "${_baseEndpoint}tutorial";
  /// Service provider / driver tutorial (video + bullet instructions).
  static const driverTutorial = "${_baseEndpoint}tutorial/driver";
  static const driverTutorialComplete = "${_baseEndpoint}driver/tutorial/complete";
  /// Customer learning tutorial library (multiple videos).
  static const tutorialVideos = "${_baseEndpoint}tutorial/videos";

  /// Customer billing / payment history.
  static const customerBillingHistory = "${_baseEndpoint}customer/billing-history";

  /// Customer: latest active or next scheduled booking for the Bookings tab.
  static const customerActiveBooking = "${_baseEndpoint}app/customer/active-booking";

  /// Legal / CMS: single page `?page=` + `audience`. List: [API.legalPages].
  static const legalPage = "${_baseEndpoint}legal-page";
  static const legalPages = "${_baseEndpoint}legal-pages";

  //Profile Endpoints
  static const driverMe = "${_baseEndpoint}driver/me";
  /// Single Identity Model: link a provider profile to the current customer account.
  static const addDriverProfile = "${_baseEndpoint}driver/add-profile";
  static const driverMePresence = "${_baseEndpoint}driver/me/presence";
  static const driverLocation = "${_baseEndpoint}driver/location";
  static const customerMe = "${_baseEndpoint}customer/me";

  // Driver Signup Endpoints
  static const driverStep2 = "${_baseEndpoint}driver/step/2";
  static const driverStep3 = "${_baseEndpoint}driver/step/3";
  static const driverStep4 = "${_baseEndpoint}driver/step/4";
  static const driverStep5 = "${_baseEndpoint}driver/step/5";
  static const driverStep6 = "${_baseEndpoint}driver/step/6";
  static const driverDocuments = "${_baseEndpoint}driver/documents";
  static const driverRequestVerificationOtp =
      "${_baseEndpoint}driver/request-verification-otp";
  static const driverVerifyOtp = "${_baseEndpoint}driver/verify-otp";

  // Payment Methods (Stripe-backed via backend)
  static const stripeConfig = "${_baseEndpoint}payments/stripe-config";
  static const createSetupIntent = "${_baseEndpoint}payments/setup-intent";
  static const addCard = "${_baseEndpoint}payments/add-card";
  static const listCards = "${_baseEndpoint}payments/cards";
  static const setDefaultCard = "${_baseEndpoint}payments/set-default-card";
  static const removeCard = "${_baseEndpoint}payments/remove-card";

  // Vehicle Endpoints
  static const vehicles = "${_baseEndpoint}vehicles";
  static String vehicleSetDefault(int vehicleId) =>
      "${_baseEndpoint}vehicles/$vehicleId/default";
  static const vehicleTypes = "${_baseEndpoint}vehicle-types";
  static const vehicleCatalog = "${_baseEndpoint}vehicles/catalog";

  // Service Endpoints
  static const services = "${_baseEndpoint}services";

  //Notification
  static const notifications = "${_baseEndpoint}notifications";
  static const registerDevice = "${_baseEndpoint}notifications/register-device";

  static String deleteNotification(int notificationId) =>
      "${_baseEndpoint}notifications/$notificationId";
  static const deleteAllNotification = "${_baseEndpoint}notifications";

  //Packages
  static const package = "${_baseEndpoint}packages";

  //Bookings
  static const bookingStart = "${_baseEndpoint}bookings/start";
  static const evChargingBookingOptions =
      "${_baseEndpoint}bookings/ev-charging/options";

  static String bookingSteps2(int bookingId) =>
      "${_baseEndpoint}bookings/$bookingId/service";

  static String bookingLocation(int bookingId) =>
      "${_baseEndpoint}bookings/$bookingId/location";

  static String bookingSteps3(int bookingId) =>
      "${_baseEndpoint}bookings/$bookingId/vehicle";

  static String bookingSteps4(int bookingId) =>
      "${_baseEndpoint}bookings/$bookingId/review";

  static String bookingSteps5(int bookingId) =>
      "${_baseEndpoint}bookings/$bookingId/confirm";

  //Cancel Booking
  static String cancelBooking(int bookingId) =>
      "${_baseEndpoint}bookings/$bookingId/cancel";

  //Reviews
  static String reviews(int bookingId) =>
      "${_baseEndpoint}bookings/$bookingId/reviews";

  static String bookingTip(int bookingId) =>
      "${_baseEndpoint}bookings/$bookingId/tip";

  //My Booking
  static const bookingList = "${_baseEndpoint}bookings";

  /// Customer: current in-progress trip with assigned driver (if any).
  static const bookingActive = "${_baseEndpoint}bookings/active";

  //Booking Detail
  static String bookingDetail(int bookingId) =>
      "${_baseEndpoint}bookings/$bookingId";

  static String bookingInvoicePdf(int bookingId) =>
      "${_baseEndpoint}bookings/$bookingId/invoice.pdf";

  /// Driver accepts an available booking.
  static String bookingAccept(int bookingId) =>
      "${_baseEndpoint}bookings/$bookingId/accept";

  /// Driver rejects an available booking.
  static String bookingReject(int bookingId) =>
      "${_baseEndpoint}bookings/$bookingId/reject";

  /// Driver/customer booking tracking update (`tracking_status` in body).
  static String bookingTrackingStatus(int bookingId) =>
      "${_baseEndpoint}bookings/$bookingId/tracking-status";

  static String bookingChatNotify(int bookingId) =>
      "${_baseEndpoint}bookings/$bookingId/chat/notify";

  /// Pickup OTP verification (assigned driver; authenticated as driver).
  static String bookingVerifyPickupOtp(int bookingId) =>
      "${_baseEndpoint}bookings/$bookingId/verify-otp";

  /// Driver marks customer no-show after the 15-minute arrival wait at pick-up.
  static String bookingCustomerNoShow(int bookingId) =>
      "${_baseEndpoint}bookings/$bookingId/customer-no-show";

  /// Driver before-service photos (`images[]` multipart).
  static String bookingServiceImagesBefore(int bookingId) =>
      "${_baseEndpoint}bookings/$bookingId/service-images/before";

  /// Driver after-service photos (`images[]` multipart).
  static String bookingServiceImagesAfter(int bookingId) =>
      "${_baseEndpoint}bookings/$bookingId/service-images/after";

  /// Unassigned bookings near the driver (paginated).
  static const driverBookingsNearbyUnassigned =
      "${_baseEndpoint}driver/bookings/nearby-unassigned";

  /// Driver updates alternate service stop (address + lat/lng + reason).
  static String driverBookingServiceLocation(int bookingId) =>
      "${_baseEndpoint}driver/bookings/$bookingId/service-location";

  static const driverWallet = "${_baseEndpoint}driver/wallet";
  static const driverWalletPayout = "${_baseEndpoint}driver/wallet/payout";
  static const driverWalletTransactions =
      "${_baseEndpoint}driver/wallet/transactions";
  static const driverWalletEarningsStatement =
      "${_baseEndpoint}driver/wallet/earnings-statement";
  static const driverStripeConnectKyc =
      "${_baseEndpoint}driver/stripe/connect/kyc";

  // Support tickets (customer & driver)
  static const customerSupportTickets =
      "${_baseEndpoint}customer/support/tickets";
  static String customerSupportTicket(int ticketId) =>
      "${_baseEndpoint}customer/support/tickets/$ticketId";
  static String customerSupportTicketMessages(int ticketId) =>
      "${_baseEndpoint}customer/support/tickets/$ticketId/messages";
  static String customerSupportTicketChatNotify(int ticketId) =>
      "${_baseEndpoint}customer/support/tickets/$ticketId/chat/notify";

  static const driverSupportTickets = "${_baseEndpoint}driver/support/tickets";
  static String driverSupportTicket(int ticketId) =>
      "${_baseEndpoint}driver/support/tickets/$ticketId";
  static String driverSupportTicketMessages(int ticketId) =>
      "${_baseEndpoint}driver/support/tickets/$ticketId/messages";
  static String driverSupportTicketChatNotify(int ticketId) =>
      "${_baseEndpoint}driver/support/tickets/$ticketId/chat/notify";

  static const customerReports = "${_baseEndpoint}customer/reports";
  static const driverReports = "${_baseEndpoint}driver/reports";

  /// Customer raises a dispute on a booking.
  static String raiseDispute(int bookingId) =>
      "${_baseEndpoint}bookings/$bookingId/dispute";
}
