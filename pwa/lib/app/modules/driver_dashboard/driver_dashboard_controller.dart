import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:get/get.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../network/response/driver_stripe_connect_kyc_response.dart' as kyc;
import '../../network/response/driver_wallet_response.dart' as dw;
import '../../routes/app_pages.dart';
import '../../services/booking_live_socket_service.dart';
import '../../services/driver_dashboard_socket_service.dart';
import '../../utils/app_snackbar.dart';
import '../dashboard/dashboard_booking_timer.dart';
import '../dashboard/dashboard_controller.dart';

/// Driver shell controller — extends [DashboardController] (map, routes, bookings).
class DriverDashboardController extends DashboardController {
  static const int _walletTabIndex = 2;

  final Rxn<dw.Data> walletData = Rxn<dw.Data>();
  final Rxn<kyc.DriverStripeConnectKycData> stripeConnectKycData =
      Rxn<kyc.DriverStripeConnectKycData>();
  final RxBool isWalletLoading = false.obs;
  final RxBool isStripeKycLoading = false.obs;
  final RxBool stripeKycChecked = false.obs;
  final RxBool isPayoutLoading = false.obs;
  final RxString walletError = ''.obs;
  final TextEditingController payoutAmountController = TextEditingController();

  Worker? _walletNavWorker;

  StreamSubscription<Map<String, dynamic>>? _driverBookingUpdatedSub;
  StreamSubscription<Map<String, dynamic>>? _driverBookingAssignedSub;
  StreamSubscription<Map<String, dynamic>>? _driverBookingUnassignedSub;
  StreamSubscription<Map<String, dynamic>>? _driverDisputeOpenedSub;

  /// Same numeric balance shown on the wallet page card.
  num? get walletBalanceAmount {
    final data = walletData.value;
    if (data == null) return null;
    return data.totalBalance ?? data.walletAmount;
  }

  String get formattedWalletBalance {
    final data = walletData.value;
    if (data == null) return '—';
    return formatWalletAmount(walletBalanceAmount, data.currency);
  }

  String formatWalletAmount(num? amount, String? currency) {
    if (amount == null) return '—';
    final code = (currency ?? 'usd').trim().toLowerCase();
    final symbol = code == 'usd' ? '\$' : '';
    return '$symbol${amount.toStringAsFixed(2)}';
  }

  /// `available_for_payout` from the wallet API (used by payout bottom sheet only).
  num? get availableForPayoutAmount => walletData.value?.availableForPayout;

  String get formattedAvailableForPayout {
    final data = walletData.value;
    if (data == null) return '—';
    return formatWalletAmount(availableForPayoutAmount, data.currency);
  }

  bool get canOpenPayoutBottomSheet {
    final amount = availableForPayoutAmount;
    return amount != null && amount > 0;
  }

  num? get pendingStripeSettlementAmount =>
      walletData.value?.pendingStripeSettlement;

  /// Earnings credited on accept but not yet released for payout.
  num? get pendingBookingEarningsAmount {
    final data = walletData.value;
    if (data == null) return null;
    final walletAmt = data.walletAmount ?? 0;
    final stripePending = data.pendingStripeSettlement ?? 0;
    final bookingPending = walletAmt - stripePending;
    if (bookingPending <= 0) return 0;
    return bookingPending;
  }

  /// Funds shown in wallet that cannot be withdrawn right now.
  num? get pendingNonWithdrawableAmount {
    final data = walletData.value;
    if (data == null) return null;
    final walletAmt = data.walletAmount;
    if (walletAmt != null && walletAmt > 0) return walletAmt;
    final total = data.totalBalance ?? 0;
    final available = data.availableForPayout ?? 0;
    final pending = total - available;
    return pending > 0 ? pending : 0;
  }

  bool get hasPendingNonWithdrawableBalance {
    final pending = pendingNonWithdrawableAmount;
    return pending != null && pending > 0;
  }

  bool get showWalletPendingWithdrawNotice =>
      !canOpenPayoutBottomSheet && hasPendingNonWithdrawableBalance;

  String get formattedPendingNonWithdrawableAmount {
    return formatWalletAmount(
      pendingNonWithdrawableAmount,
      walletData.value?.currency,
    );
  }

  String get walletPendingWithdrawNoticeBody {
    final data = walletData.value;
    if (data == null) {
      return 'You have pending earnings that are not available to withdraw yet.';
    }

    final bookingPending = pendingBookingEarningsAmount ?? 0;
    final stripePending = pendingStripeSettlementAmount ?? 0;
    final details = <String>[];

    if (bookingPending > 0) {
      details.add(
        '${formatWalletAmount(bookingPending, data.currency)} is pending from active or in-progress bookings',
      );
    }
    if (stripePending > 0) {
      details.add(
        '${formatWalletAmount(stripePending, data.currency)} is still processing with Stripe',
      );
    }

    if (details.isEmpty) {
    return 'You have $formattedPendingNonWithdrawableAmount in pending earnings. '
        'This amount is not available to withdraw yet and will become withdrawable once processing is complete.';
    }

    return 'You have $formattedPendingNonWithdrawableAmount in pending earnings that cannot be withdrawn yet. '
        '${details.join('. ')}.';
  }

  void showPayoutUnavailableError() {
    showAppSnackBar(
      title: 'Withdraw',
      message: 'No amount available for payout.',
      isError: true,
    );
  }

  void resetPayoutForm({bool prefillAvailablePayout = false}) {
    payoutAmountController.clear();
    if (prefillAvailablePayout) {
      fillPayoutWithAvailableBalance();
    }
  }

  void fillPayoutWithAvailableBalance() {
    final amount = availableForPayoutAmount;
    if (amount == null || amount <= 0) return;
    payoutAmountController.text = amount.toStringAsFixed(2);
  }

  Future<bool> submitDriverWalletPayout() async {
    final raw = payoutAmountController.text.trim();
    final amount = double.tryParse(raw);
    if (amount == null || amount <= 0) {
      showAppSnackBar(
        title: 'Withdraw',
        message: 'Please enter a valid amount.',
        isError: true,
      );
      return false;
    }

    final maxAmount = availableForPayoutAmount;
    if (maxAmount == null || maxAmount <= 0) {
      showPayoutUnavailableError();
      return false;
    }
    if (amount > maxAmount) {
      showAppSnackBar(
        title: 'Withdraw',
        message: 'Amount cannot exceed available payout balance.',
        isError: true,
      );
      return false;
    }

    if (isPayoutLoading.value) return false;
    isPayoutLoading.value = true;

    final res = await dashRepository.driverWalletPayout(amount: amount);
    var didSucceed = false;
    res.when(
      success: (response) {
        didSucceed = true;
        showAppSnackBar(
          title: 'Withdraw',
          message: response.message ?? 'Payout requested successfully.',
        );
      },
      error: (err) {
        showAppSnackBar(title: 'Withdraw', message: err.message, isError: true);
      },
    );
    isPayoutLoading.value = false;

    if (didSucceed) {
      resetPayoutForm();
      await fetchDriverWallet();
    }
    return didSucceed;
  }

  Future<void> fetchDriverWallet() async {
    if (isWalletLoading.value) return;
    isWalletLoading.value = true;
    walletError.value = '';
    final res = await dashRepository.getDriverWallet();
    res.when(
      success: (response) {
        walletData.value = response.data;
        isWalletLoading.value = false;
      },
      error: (err) {
        isWalletLoading.value = false;
        walletError.value = err.message;
        // Suppress wallet error snackbars while the account is suspended for
        // an expired license — the banner already communicates the issue.
        if (!_isAccountSuspendedForLicense) {
          showAppSnackBar(title: 'Wallet', message: err.message, isError: true);
        }
      },
    );
  }

  bool get isStripeKycComplete =>
      stripeConnectKycData.value?.kycComplete == true;

  bool get needsStripeKycSetup =>
      stripeKycChecked.value && !isStripeKycComplete;

  bool get isWalletTabLoading =>
      isStripeKycLoading.value ||
      (isStripeKycComplete && isWalletLoading.value);

  String get stripeKycUiMessage {
    final kyc = stripeConnectKycData.value;
    if (kyc == null) {
      return 'Complete Stripe verification to access your wallet and withdraw earnings.';
    }
    return 'Complete your Stripe identity verification to unlock withdrawals and payouts.';
  }

  Future<void> fetchDriverStripeConnectKyc({bool showErrorSnack = true}) async {
    isStripeKycLoading.value = true;
    final res = await dashRepository.getDriverStripeConnectKyc();
    res.when(
      success: (response) {
        stripeConnectKycData.value = response.data;
      },
      error: (err) {
        stripeConnectKycData.value = null;
        if (showErrorSnack && !_isAccountSuspendedForLicense) {
          showAppSnackBar(
            title: 'Stripe verification',
            message: err.message,
            isError: true,
          );
        }
      },
    );
    stripeKycChecked.value = true;
    isStripeKycLoading.value = false;
  }

  Future<void> openStripeKycOnboarding() async {
    final url = stripeConnectKycData.value?.kycUrl?.trim();
    if (url == null || url.isEmpty) {
      showAppSnackBar(
        title: 'Stripe verification',
        message: 'Verification link is not available. Please try again.',
        isError: true,
      );
      unawaited(refreshWalletTab());
      return;
    }
    final uri = Uri.tryParse(url);
    if (uri == null) {
      showAppSnackBar(
        title: 'Stripe verification',
        message: 'Invalid verification link.',
        isError: true,
      );
      return;
    }
    try {
      final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!opened) {
        showAppSnackBar(
          title: 'Stripe verification',
          message: 'Could not open the verification page.',
          isError: true,
        );
      }
    } catch (_) {
      showAppSnackBar(
        title: 'Stripe verification',
        message: 'Could not open the verification page.',
        isError: true,
      );
    }
  }

  /// KYC first; wallet loads only when [kyc_complete] is true.
  Future<void> refreshWalletTab({bool showKycErrorSnack = false}) async {
    await fetchDriverStripeConnectKyc(showErrorSnack: showKycErrorSnack);
    if (isStripeKycComplete) {
      await fetchDriverWallet();
    } else {
      walletData.value = null;
      isWalletLoading.value = false;
      walletError.value = '';
    }
  }

  void _loadWalletTab() {
    unawaited(refreshWalletTab());
  }

  @override
  void onReady() {
    super.onReady();
    // Bind admin-initiated socket listeners for driver after socket is ready.
    Future.delayed(const Duration(milliseconds: 500), () {
      if (!isClosed) bindDriverAdminSocketListeners();
    });
    _walletNavWorker = ever(homeNavIndex, (idx) {
      if (idx == _walletTabIndex) {
        _loadWalletTab();
      }
    });
    if (homeNavIndex.value == _walletTabIndex) {
      _loadWalletTab();
    }
  }

  void onNeedHelpBack() {
    homeNavIndex.value = 3;
    if (Get.currentRoute == Routes.DRIVER_DASHBOARD) return;
    Get.offNamed(Routes.DRIVER_DASHBOARD);
  }

  /// Black route: driver profile pin → customer location pin at pickup.
  Future<void> drawRouteToPickupLocation() async {
    final bookingId =
        activeDriverBookingId.value ?? serviceDetailBookingId.value;
    if (bookingId != null && bookingId > 0) {
      await ensureDriverPickupCoordsForBooking(bookingId);
    }
    final lat = activeDriverPickupLat.value;
    final lng = activeDriverPickupLng.value;
    if (lat == null || lng == null) return;
    await drawDriverRouteToPickup(pickupLat: lat, pickupLng: lng);
  }

  /// Retries until the pickup polyline is on the driver home map.
  Future<void> drawRouteToPickupWithRetry({int maxAttempts = 8}) async {
    for (var attempt = 0; attempt < maxAttempts; attempt++) {
      if (!isDriverEnRouteToPickup) return;
      await drawRouteToPickupLocation();
      if (hasActiveRoute.value) return;
      await Future<void>.delayed(Duration(milliseconds: 400 + attempt * 150));
    }
  }

  /// Retries service-center route draw until the map has a route or max attempts reached.
  Future<void> drawRouteToServiceCenterWithRetry({int maxAttempts = 6}) async {
    for (var attempt = 0; attempt < maxAttempts; attempt++) {
      if (!hasHaveYouArriveLocation.value) return;
      await drawDriverRouteToServiceCenterWithCustomPins();
      if (hasActiveRoute.value) return;
      await Future<void>.delayed(Duration(milliseconds: 500 + attempt * 200));
    }
  }

  @override
  Future<void> onMapCreated(MapboxMap mapboxMap) async {
    await super.onMapCreated(mapboxMap);
    if (isDriverEnRouteToPickup) {
      unawaited(drawRouteToPickupWithRetry());
    } else if (hasVehicleIsEnroteToDropOffPannal.value) {
      unawaited(drawDriverRouteToCustomerDropOffWithCustomPins());
    } else if (hasHaveYouArriveLocation.value) {
      unawaited(drawRouteToServiceCenterWithRetry());
    }
  }

  /// Override so the pickup-route retry version is used when returning from
  /// native navigation (Android onResume → map-resume channel).
  @override
  Future<void> onMapResumed() async {
    // Super handles dispose of all private annotation managers + nav-triangle cache.
    await super.onMapResumed();
    // Use retry variants so GPS has time to warm up after Activity/route resume.
    if (isDriverEnRouteToPickup) {
      unawaited(drawRouteToPickupWithRetry());
    } else if (isDriverEnRouteToDropOff) {
      unawaited(drawDriverRouteToCustomerDropOffWithCustomPins());
    } else if (isDriverEnRouteToServiceCenter || hasHaveYouArriveLocation.value) {
      unawaited(drawRouteToServiceCenterWithRetry());
    }
  }

  @override
  Future<void> startActiveDriverService() async {
    await super.startActiveDriverService();
    if (isDriverEnRouteToPickup) {
      await drawRouteToPickupWithRetry();
    }
  }

  /// **Driver:** connect socket + GPS heartbeat for [bookingId]; redraw pickup route when en route.
  Future<void> beginLiveBookingSession(int bookingId) async {
    if (bookingId <= 0) return;
    activeDriverBookingId.value = bookingId;
    final socket = Get.find<BookingLiveSocketService>();
    await socket.connectForBooking(bookingId);
    bindDriverCancelledBookingListeners();
    socket.startDriverLocationHeartbeat(
      bookingId: bookingId,
      fetchLocation: _fetchDriverGpsForLiveRoute,
    );
    if (isDriverEnRouteToPickup) {
      unawaited(drawRouteToPickupWithRetry());
    }
  }

  /// Driver: report journey milestone (`POST .../tracking-status`).
  Future<void> emitDriverStatus(String trackingStatus) async {
    await submitDriverBookingTrackingStatus(trackingStatus);
  }

  /// **Driver:** stop heartbeats and close the socket for the current job.
  Future<void> endLiveBookingSession() async {
    await unbindDriverBookingStatusListener();
    final socket = Get.find<BookingLiveSocketService>();
    socket.stopDriverLocationHeartbeat();
    await socket.disconnect();
  }

  Future<({double lat, double lng})?> _fetchDriverGpsForLiveRoute() async {
    final coords = await _fetchDriverGps();
    if (coords != null &&
        (isDriverEnRouteToPickup ||
            isDriverEnRouteToServiceCenter ||
            isDriverEnRouteToDropOff)) {
      unawaited(
        refreshDriverEnRouteMapDisplay(
          vehicleLat: coords.lat,
          vehicleLng: coords.lng,
        ),
      );
    }
    return coords;
  }

  Future<({double lat, double lng})?> _fetchDriverGps() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return null;
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      return null;
    }
    final p = await Geolocator.getCurrentPosition();
    return (lat: p.latitude, lng: p.longitude);
  }

  /// Returns `true` when the driver's account is suspended due to an expired
  /// license. Use this to suppress non-critical background snackbars (wallet
  /// errors, socket booking notifications, etc.) that would otherwise spam
  /// the screen while the banner already communicates the suspended state.
  bool get _isAccountSuspendedForLicense => isDriverLicenseAcceptBlocked;

  void bindDriverAdminSocketListeners() {
    if (!Get.isRegistered<DriverDashboardSocketService>()) return;
    final svc = Get.find<DriverDashboardSocketService>();

    _driverBookingUpdatedSub ??= svc.onDriverBookingUpdated
        .listen(_onDriverBookingUpdated);
    _driverBookingAssignedSub ??= svc.onDriverBookingAssigned
        .listen(_onDriverBookingAssigned);
    _driverBookingUnassignedSub ??= svc.onDriverBookingUnassigned
        .listen(_onDriverBookingUnassigned);
    _driverDisputeOpenedSub ??= svc.onDriverDisputeOpened
        .listen(_onDriverDisputeOpened);
  }

  Future<void> unbindDriverAdminSocketListeners() async {
    await _driverBookingUpdatedSub?.cancel();
    _driverBookingUpdatedSub = null;
    await _driverBookingAssignedSub?.cancel();
    _driverBookingAssignedSub = null;
    await _driverBookingUnassignedSub?.cancel();
    _driverBookingUnassignedSub = null;
    await _driverDisputeOpenedSub?.cancel();
    _driverDisputeOpenedSub = null;
  }

  void _onDriverBookingUpdated(Map<String, dynamic> payload) {
    final bookingId = _extractDriverBookingId(payload);
    if (bookingId != null && bookingId > 0) {
      unawaited(fetchServiceDetail(bookingId: bookingId, force: true));
    }
  }

  void _onDriverBookingAssigned(Map<String, dynamic> payload) {
    final bookingId = _extractDriverBookingId(payload);
    final bookingCode = '${payload['booking_code'] ?? payload['bookingCode'] ?? (bookingId ?? '')}';
    if (!_isAccountSuspendedForLicense) {
      showAppSnackBar(
        title: 'New Booking Assigned',
        message: 'You have been assigned to booking #$bookingCode.',
      );
    }
    unawaited(fetchBookings(refresh: true));
    if (bookingId != null && bookingId > 0) {
      unawaited(fetchServiceDetail(bookingId: bookingId, force: true));
    }
  }

  void _onDriverBookingUnassigned(Map<String, dynamic> payload) {
    final bookingId = _extractDriverBookingId(payload);
    final bookingCode = '${payload['booking_code'] ?? payload['bookingCode'] ?? (bookingId ?? '')}';

    // Show notification only when the account is active.
    if (!_isAccountSuspendedForLicense) {
      showAppSnackBar(
        title: 'Booking Unassigned',
        message: 'You have been removed from booking #$bookingCode.',
        isError: true,
      );
    }

    // Full UI reset — mirrors _stopDriverTrackingForCancelledBooking so the
    // driver home page reverts to its idle state (no active trip panel, no
    // pickup route, no accepted-service flags) just like when a booking is
    // cancelled.
    if (bookingId != null && bookingId > 0) {
      removeBookingFromNearbyUnassignedLists(bookingId);
      bookings.removeWhere((x) => x.id == bookingId);
    }
    isDriverNearbyUnassignedLoading.value = false;

    clearBookingTimerState();
    resetAcceptedService();
    unawaited(clearRouteAndPin());
    hasActiveRoute.value = false;
    activeDriverBookingId.value = null;
    activeDriverCustomerName.value = 'Customer';
    activeDriverCustomerAvatarUrl.value = '';
    activeDriverPickupLat.value = null;
    activeDriverPickupLng.value = null;
    activeDriverPickupAddress.value = '';

    if (bookingId != null &&
        bookingId > 0 &&
        serviceDetailBookingId.value == bookingId) {
      serviceDetailBookingId.value = null;
      serviceDetail.value = null;
      serviceDetailError.value = '';
    }

    if (Get.isRegistered<BookingLiveSocketService>()) {
      final live = Get.find<BookingLiveSocketService>();
      live.stopDriverLocationHeartbeat();
      unawaited(live.disconnect());
    }

    unawaited(fetchBookings(refresh: true));
    unawaited(fetchDriverNearbyUnassignedBookings(refresh: true));
  }

  void _onDriverDisputeOpened(Map<String, dynamic> payload) {
    final bookingId = _extractDriverBookingId(payload);
    if (bookingId != null && bookingId > 0) {
      unawaited(fetchServiceDetail(bookingId: bookingId, force: true));
    }
    if (!_isAccountSuspendedForLicense) {
      showAppSnackBar(
        title: 'Dispute Opened',
        message: 'A dispute has been opened on one of your bookings.',
      );
    }
  }

  int? _extractDriverBookingId(Map<String, dynamic> payload) {
    final raw = payload['booking_id'] ?? payload['bookingId'] ?? payload['id'];
    if (raw == null) return null;
    return int.tryParse('$raw');
  }

  @override
  void onClose() {
    _walletNavWorker?.dispose();
    payoutAmountController.dispose();
    unawaited(unbindDriverAdminSocketListeners());
    super.onClose();
  }
}
