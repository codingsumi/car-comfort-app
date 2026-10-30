import 'dart:async';

import 'package:get/get.dart';

import '../../constants/booking_tracking_status.dart';
import '../../network/response/booking_detail_response.dart' as bd;
import '../../services/booking_live_socket_service.dart';
import '../../utils/app_snackbar.dart';
import '../../utils/booking_timer_utils.dart';
import '../../utils/pref.dart';
import 'dashboard_controller.dart';

/// Timer socket + API wiring for [DashboardController].
extension DashboardBookingTimerX on DashboardController {
  void bindBookingTimerListener() {
    if (bookingTimerSub != null) return;
    if (!Get.isRegistered<BookingLiveSocketService>()) return;
    final socket = Get.find<BookingLiveSocketService>();
    bookingTimerSub = socket.onBookingTimerUpdate.listen(
      applyBookingTimerSocketEvent,
    );
    ensureBookingTimerUiTicker();
  }

  Future<void> unbindBookingTimerListener() async {
    await bookingTimerSub?.cancel();
    bookingTimerSub = null;
    stopBookingTimerUiTicker();
    clearBookingTimerState();
  }

  void ensureBookingTimerUiTicker() {
    ensureServiceTimerTick();
    if (bookingTimerUiTick != null) return;
    bookingTimerUiTick = Timer.periodic(const Duration(seconds: 1), (_) {
      serviceTimerTick.value++;
      final exp = bookingTimerExpiresAt.value;
      final enRoute = driverServiceEnRouteStartedAt.value;
      if (exp == null && enRoute == null) return;
      if (exp != null && secondsUntil(exp) <= 0) {
        final phase = normalizeBookingTimerPhase(bookingTimerPhase.value);
        if (phase == 'arrival_countdown') {
          bookingTimerPhase.value = 'arrival_expired';
        } else if (phase == 'accept_countdown' &&
            Prefs().isDriverRole &&
            !hasStartedService.value &&
            !isDriverStatusUpdating.value) {
          handleDriverOnDemandAcceptTimeout(
            bookingId:
                activeDriverBookingId.value ?? serviceDetailBookingId.value,
          );
        }
      } else if (Prefs().isDriverRole &&
          !hasStartedService.value &&
          !isDriverStatusUpdating.value) {
        final acceptDeadline = _resolveDriverAcceptCountdownDeadline();
        if (acceptDeadline != null &&
            !DateTime.now().isBefore(acceptDeadline)) {
          handleDriverOnDemandAcceptTimeout(
            bookingId:
                activeDriverBookingId.value ?? serviceDetailBookingId.value,
          );
        }
      }
      bookingTimerTick.value++;
    });
  }

  void stopBookingTimerUiTicker() {
    bookingTimerUiTick?.cancel();
    bookingTimerUiTick = null;
  }

  void clearBookingTimerState() {
    bookingTimerPhase.value = null;
    bookingTimerExpiresAt.value = null;
    bookingTimerTick.value = 0;
    acceptDeadlineIsOptimistic = false;
    arrivalDeadlineIsAuthoritative = false;
  }

  int bookingTimerRemainingSeconds() {
    return secondsUntil(bookingTimerExpiresAt.value);
  }

  int driverServiceEnRouteElapsedSeconds() {
    var start = driverServiceEnRouteStartedAt.value;
    if (start == null) {
      final prefStr = Prefs().getData(Prefs.driverServiceEnRouteStartedAt);
      if (prefStr.isNotEmpty) {
        start = DateTime.tryParse(prefStr);
        if (start != null) {
          driverServiceEnRouteStartedAt.value = start;
        }
      }
    }
    if (start == null && (hasHaveYouArriveLocation.value || hasStartedService.value)) {
      start = DateTime.now();
      saveDriverServiceEnRouteStartedAt(start);
    }
    if (start != null && start.isAfter(DateTime.now())) {
      start = DateTime.now();
      saveDriverServiceEnRouteStartedAt(start);
    }
    if (start != null) {
      ensureServiceTimerTick();
    }
    if (start == null) return 0;
    return DateTime.now().difference(start).inSeconds.clamp(0, 86400);
  }

  String driverServiceEnRouteMinutesLabel() {
    return formatElapsedMinutesChip(driverServiceEnRouteElapsedSeconds());
  }

  /// Elapsed seconds since driver tapped "Vehicle Being Serviced".
  int driverServiceInProgressElapsedSeconds() {
    var start = driverVehicleBeingServicedStartedAt.value;
    if (start == null) {
      final prefStr = Prefs().getData(Prefs.driverVehicleBeingServicedStartedAt);
      if (prefStr.isNotEmpty) {
        start = DateTime.tryParse(prefStr);
        if (start != null) {
          driverVehicleBeingServicedStartedAt.value = start;
        }
      }
    }
    if (start != null && start.isAfter(DateTime.now())) {
      start = DateTime.now();
      saveDriverVehicleBeingServicedStartedAt(start);
    }
    if (start != null) {
      ensureServiceTimerTick();
    }
    if (start == null) return 0;
    return DateTime.now().difference(start).inSeconds.clamp(0, 86400);
  }

  /// Stopwatch-style MM:SS label for the service timer.
  String driverServiceInProgressElapsedLabel() {
    return formatElapsedStopwatch(driverServiceInProgressElapsedSeconds());
  }

  void syncDriverServiceEnRouteTimerFromDetail(bd.Data? detail) {
    if (!Prefs().isDriverRole || detail == null) return;
    final tracking = BookingTrackingStatus.normalizeTrackingCode(
      detail.trackingStatus,
    );
    final isEnRoute =
        hasHaveYouArriveLocation.value ||
        tracking == BookingTrackingStatus.driverStartedToServiceCenter ||
        tracking == BookingTrackingStatus.driverHeadingToNextServiceStop;

    if (isEnRoute) {
      final serverStarted = parseBookingTimerDate(
        detail.driverStartedToServiceCenterAt,
      );
      final prefStr = Prefs().getData(Prefs.driverServiceEnRouteStartedAt);
      final prefStarted = prefStr.isNotEmpty ? DateTime.tryParse(prefStr) : null;
      final resolvedStarted = driverServiceEnRouteStartedAt.value ??
          prefStarted ??
          serverStarted ??
          DateTime.now();

      saveDriverServiceEnRouteStartedAt(resolvedStarted);
      ensureBookingTimerUiTicker();
      ensureServiceTimerTick();
      return;
    }

    if (!isEnRoute &&
        tracking != BookingTrackingStatus.vehicleWaitingInQueue &&
        tracking != BookingTrackingStatus.serviceLocationIssue) {
      saveDriverServiceEnRouteStartedAt(null);
    }
  }

  bool get isOnDemandActiveBooking {
    final detail = serviceDetail.value;
    return isOnDemandScheduleType(detail?.scheduleType);
  }

  /// Clamps an on-demand accept countdown deadline to a maximum of 15 minutes from now,
  /// and ensures an already running accept timer is never inflated / extended into the future.
  DateTime _sanitizeAcceptDeadline(DateTime rawDeadline) {
    final maxAllowed = DateTime.now().add(const Duration(minutes: 15));
    var deadline = rawDeadline.isAfter(maxAllowed) ? maxAllowed : rawDeadline;

    final current = bookingTimerExpiresAt.value;
    final currentPhase = normalizeBookingTimerPhase(bookingTimerPhase.value);
    if (currentPhase == 'accept_countdown' &&
        current != null &&
        deadline.isAfter(current)) {
      deadline = current;
    }
    return deadline;
  }

  /// Clamps an arrival-wait countdown deadline to a maximum of 15 minutes from now,
  /// and ensures an already running arrival timer is never inflated / extended into the future.
  DateTime _sanitizeArrivalDeadline(DateTime rawDeadline) {
    final maxAllowed = DateTime.now().add(const Duration(minutes: 15));
    var deadline = rawDeadline.isAfter(maxAllowed) ? maxAllowed : rawDeadline;

    final current = bookingTimerExpiresAt.value;
    final currentPhase = normalizeBookingTimerPhase(bookingTimerPhase.value);
    if ((currentPhase == 'arrival_countdown' || currentPhase == 'arrival_expired') &&
        current != null &&
        deadline.isAfter(current)) {
      deadline = current;
    }
    return deadline;
  }

  DateTime? _resolveDriverAcceptCountdownDeadline() {
    if (!Prefs().isDriverRole || hasStartedService.value) return null;

    final bookingId = activeDriverBookingId.value ?? serviceDetailBookingId.value;
    if (bookingId == null || bookingId <= 0) return null;

    final detail = serviceDetail.value;
    if (detail != null && detail.id == bookingId) {
      if (BookingTrackingStatus.isBookingCancelled(
        bookingStatus: detail.status?.toString(),
        trackingStatus: detail.trackingStatus?.toString(),
      )) {
        return null;
      }
      if (!isOnDemandScheduleType(detail.scheduleType)) return null;
      final tracking = BookingTrackingStatus.normalizeTrackingCode(
        detail.trackingStatus,
      );
      if (BookingTrackingStatus.isKnownCode(tracking)) return null;
    }

    if (normalizeBookingTimerPhase(bookingTimerPhase.value) ==
        'accept_countdown' &&
        bookingTimerExpiresAt.value != null) {
      return bookingTimerExpiresAt.value;
    }

    if (detail != null && detail.id == bookingId) {
      final deadline = parseBookingTimerDate(detail.onDemandAcceptDeadlineAt);
      if (deadline != null) {
        return _sanitizeAcceptDeadline(deadline);
      }
    }

    return null;
  }

  bool get isDriverOnDemandAcceptCountdownVisible {
    final deadline = _resolveDriverAcceptCountdownDeadline();
    return deadline != null && DateTime.now().isBefore(deadline);
  }

  /// False once the on-demand accept window has expired (provider must not start).
  bool get canDriverStartOnDemandAcceptPhase {
    if (!Prefs().isDriverRole || hasStartedService.value) return true;
    final deadline = _resolveDriverAcceptCountdownDeadline();
    if (deadline == null) return true;
    return DateTime.now().isBefore(deadline);
  }

  int driverAcceptCountdownRemainingSeconds() {
    return secondsUntil(_resolveDriverAcceptCountdownDeadline());
  }

  bool get isBookingAcceptTimerActive => isDriverOnDemandAcceptCountdownVisible;

  void seedOnDemandAcceptCountdownAfterAccept({
    required int bookingId,
    String? scheduleType,
  }) {
    if (!Prefs().isDriverRole || bookingId <= 0) return;

    final resolvedSchedule = scheduleType?.trim().isNotEmpty == true
        ? scheduleType
        : serviceDetail.value?.id == bookingId
        ? serviceDetail.value?.scheduleType?.toString()
        : null;
    if (!isOnDemandScheduleType(resolvedSchedule)) return;

    final detailDeadline = serviceDetail.value?.id == bookingId
        ? parseBookingTimerDate(serviceDetail.value?.onDemandAcceptDeadlineAt)
        : null;

    bookingTimerPhase.value = 'accept_countdown';

    if (detailDeadline != null) {
      // Authoritative server deadline available — sanitize and use it
      bookingTimerExpiresAt.value = _sanitizeAcceptDeadline(detailDeadline);
      acceptDeadlineIsOptimistic = false;
    } else {
      // Detail not loaded yet — seed from local clock as a best-guess so the
      // UI shows a running timer immediately. Mark optimistic so the first
      // authoritative server expires_at will correct it if earlier.
      final current = bookingTimerExpiresAt.value;
      if (current == null || acceptDeadlineIsOptimistic) {
        bookingTimerExpiresAt.value =
            DateTime.now().add(const Duration(minutes: 15));
        acceptDeadlineIsOptimistic = true;
      }
    }

    bookingTimerTick.value++;
    ensureBookingTimerUiTicker();
    bindBookingTimerListener();
  }

  bool get isBookingArrivalWaitTimerActive {
    if (!Prefs().isDriverRole) return false;
    final ts = BookingTrackingStatus.normalizeTrackingCode(
      serviceDetail.value?.trackingStatus,
    );
    if (ts != BookingTrackingStatus.driverReachedCustomer &&
        ts != BookingTrackingStatus.otpPending) {
      return false;
    }
    final phase = normalizeBookingTimerPhase(bookingTimerPhase.value);
    return (phase == 'arrival_countdown' || phase == 'arrival_expired') &&
        bookingTimerExpiresAt.value != null;
  }

  bool get canMarkCustomerNoShow {
    if (!Prefs().isDriverRole) return false;
    final ts = BookingTrackingStatus.normalizeTrackingCode(
      serviceDetail.value?.trackingStatus,
    );
    if (ts != BookingTrackingStatus.driverReachedCustomer &&
        ts != 'OTP_PENDING') {
      return false;
    }
    final phase = normalizeBookingTimerPhase(bookingTimerPhase.value);
    if (phase == 'arrival_expired') return true;
    return bookingTimerRemainingSeconds() <= 0 &&
        parseBookingTimerDate(serviceDetail.value?.driverArrivedCustomerAt) !=
            null;
  }

  /// Applies the authoritative server deadline from a socket tick.
  ///
  /// Rule for accept_countdown:
  ///   - If the current deadline is an optimistic local-clock seed, the first
  ///     server-provided expires_at always replaces it if earlier or equal,
  ///     sanitized against inflation.
  ///   - Subsequent countdown ticks can never extend / inflate the running timer.
  ///
  /// Rule for arrival_countdown:
  ///   - The deadline is first set authoritatively from the booking-detail
  ///     arrivalWaitExpiresAt field (always exactly 15 min from arrival).
  ///   - Once authoritative, socket ticks must never inflate it.
  void _applyTimerExpiresFromSocket(BookingTimerSocketEvent e, String phase) {
    final phaseNorm = normalizeBookingTimerPhase(phase);

    // ── Priority 1: authoritative booking-detail deadline ────────────────────
    final detailDeadline = phaseNorm == 'arrival_countdown'
        ? parseBookingTimerDate(serviceDetail.value?.arrivalWaitExpiresAt)
        : phaseNorm == 'accept_countdown'
        ? parseBookingTimerDate(serviceDetail.value?.onDemandAcceptDeadlineAt)
        : null;

    if (detailDeadline != null &&
        (phaseNorm == 'accept_countdown' || phaseNorm == 'arrival_countdown')) {
      bookingTimerExpiresAt.value = phaseNorm == 'accept_countdown'
          ? _sanitizeAcceptDeadline(detailDeadline)
          : _sanitizeArrivalDeadline(detailDeadline);
      acceptDeadlineIsOptimistic = false;
      if (phaseNorm == 'arrival_countdown') arrivalDeadlineIsAuthoritative = true;
      return;
    }

    // ── Priority 2: socket expires_at ────────────────────────────────────────
    if (e.expiresAt != null) {
      final incoming = e.expiresAt!;
      final current = bookingTimerExpiresAt.value;
      if (phaseNorm == 'accept_countdown') {
        final sanitized = _sanitizeAcceptDeadline(incoming);
        if (acceptDeadlineIsOptimistic || current == null || sanitized.isBefore(current)) {
          bookingTimerExpiresAt.value = sanitized;
          acceptDeadlineIsOptimistic = false;
        }
      } else if (phaseNorm == 'arrival_countdown') {
        final sanitized = _sanitizeArrivalDeadline(incoming);
        if (!arrivalDeadlineIsAuthoritative || current == null || sanitized.isBefore(current)) {
          bookingTimerExpiresAt.value = sanitized;
          arrivalDeadlineIsAuthoritative = true;
        }
      } else if (current == null || incoming.isAfter(current)) {
        bookingTimerExpiresAt.value = incoming;
        if (phaseNorm == 'arrival_countdown') arrivalDeadlineIsAuthoritative = true;
      }
      return;
    }

    // ── Priority 3: remaining_seconds (last resort, never overwrite) ─────────
    if (e.remainingSeconds != null && e.remainingSeconds! > 0) {
      if (bookingTimerExpiresAt.value != null) return; // already have deadline
      final raw = DateTime.now().add(Duration(seconds: e.remainingSeconds!));
      bookingTimerExpiresAt.value = phaseNorm == 'accept_countdown'
          ? _sanitizeAcceptDeadline(raw)
          : phaseNorm == 'arrival_countdown'
          ? _sanitizeArrivalDeadline(raw)
          : raw;
    }
  }

  void applyBookingTimerSocketEvent(BookingTimerSocketEvent e) {
    final activeId = Prefs().isCustomerRole
        ? (postBookingApiId.value ?? serviceDetailBookingId.value)
        : (activeDriverBookingId.value ?? serviceDetailBookingId.value);
    if (e.bookingId != null &&
        activeId != null &&
        e.bookingId != activeId &&
        activeId > 0) {
      return;
    }

    final phase = normalizeBookingTimerPhase(e.timerPhase);
    if (phase.isEmpty) return;

    if (Prefs().isCustomerRole && phase == 'accept_countdown') {
      return;
    }

    // Driver hasn't started moving yet — ignore service/max timer events
    // (these can fire from stale queue jobs of previous bookings)
    if (Prefs().isDriverRole &&
        !hasStartedService.value &&
        (phase == 'service_countdown' || phase == 'service_max_reached')) {
      return;
    }

    if (phase == 'accept_timeout' || phase == 'scheduled_pickup_timeout') {
      handleDriverOnDemandAcceptTimeout(
        bookingId: e.bookingId ?? activeId,
        showMessage: true,
      );
      return;
    }

    bookingTimerPhase.value = phase;
    _applyTimerExpiresFromSocket(e, phase);
    bookingTimerTick.value++;
    ensureBookingTimerUiTicker();

    if (phase == 'accept_countdown' &&
        Prefs().isDriverRole &&
        hasAcceptedService.value &&
        !hasStartedService.value) {
      // Keep accept panel visible while countdown runs.
    }
  }

  void syncBookingTimersFromServiceDetail(bd.Data? detail) {
    if (detail == null) return;
    final bookingId = detail.id;
    if (bookingId == null || bookingId <= 0) return;

    if (hasHandledDriverCustomerNoShow(bookingId)) {
      clearBookingTimerState();
      return;
    }

    final tracking = BookingTrackingStatus.normalizeTrackingCode(
      detail.trackingStatus,
    );
    final moved = BookingTrackingStatus.isKnownCode(tracking);

    final acceptDeadline = parseBookingTimerDate(
      detail.onDemandAcceptDeadlineAt,
    );
    if (Prefs().isDriverRole &&
        isOnDemandScheduleType(detail.scheduleType) &&
        !moved &&
        !hasStartedService.value &&
        !isDriverStatusUpdating.value &&
        acceptDeadline != null &&
        !DateTime.now().isBefore(acceptDeadline)) {
      handleDriverOnDemandAcceptTimeout(bookingId: bookingId, showMessage: true);
      return;
    }

    if (Prefs().isDriverRole &&
        isOnDemandScheduleType(detail.scheduleType) &&
        !moved &&
        !hasStartedService.value) {
      final myId = int.tryParse(Prefs().userId());
      final assigned = detail.assignedDriverUserId ?? detail.driverId;
      if (myId != null && assigned != null && assigned != myId) {
        handleDriverOnDemandAcceptTimeout(bookingId: bookingId, showMessage: true);
        return;
      }
      if (myId != null && assigned == null && acceptDeadline == null) {
        handleDriverOnDemandAcceptTimeout(bookingId: bookingId, showMessage: true);
        return;
      }
    }

    if (Prefs().isDriverRole &&
        isOnDemandScheduleType(detail.scheduleType) &&
        !moved &&
        !hasStartedService.value &&
        acceptDeadline != null &&
        DateTime.now().isBefore(acceptDeadline)) {
      bookingTimerPhase.value = 'accept_countdown';
      bookingTimerExpiresAt.value = _sanitizeAcceptDeadline(acceptDeadline);
      acceptDeadlineIsOptimistic = false; // authoritative detail deadline
      ensureBookingTimerUiTicker();
      bindBookingTimerListener();
      return;
    }

    if (Prefs().isCustomerRole &&
        normalizeBookingTimerPhase(bookingTimerPhase.value) ==
            'accept_countdown') {
      clearBookingTimerState();
    }

    if (Prefs().isDriverRole &&
        hasStartedService.value &&
        tracking != BookingTrackingStatus.driverReachedCustomer &&
        tracking != BookingTrackingStatus.otpPending) {
      if (normalizeBookingTimerPhase(bookingTimerPhase.value) ==
              'accept_countdown' ||
          normalizeBookingTimerPhase(bookingTimerPhase.value) ==
              'arrival_countdown') {
        clearBookingTimerState();
      }
    }

    final arrivalDeadline = parseBookingTimerDate(detail.arrivalWaitExpiresAt);
    if (tracking == BookingTrackingStatus.driverReachedCustomer ||
        tracking == BookingTrackingStatus.otpPending) {
      final deadlineToUse = arrivalDeadline != null
          ? _sanitizeArrivalDeadline(arrivalDeadline)
          : ((bookingTimerPhase.value == 'arrival_countdown' ||
                      bookingTimerPhase.value == 'arrival_expired') &&
                  bookingTimerExpiresAt.value != null)
              ? bookingTimerExpiresAt.value
              : _sanitizeArrivalDeadline(
                  DateTime.now().add(const Duration(minutes: 15)),
                );

      if (deadlineToUse != null) {
        bookingTimerPhase.value = DateTime.now().isBefore(deadlineToUse)
            ? 'arrival_countdown'
            : 'arrival_expired';
        bookingTimerExpiresAt.value = deadlineToUse;
        arrivalDeadlineIsAuthoritative = true;
        ensureBookingTimerUiTicker();
        bindBookingTimerListener();
      }
    }

    syncDriverServiceEnRouteTimerFromDetail(detail);
  }

  Future<void> markCustomerNoShowAsDriver({int? bookingId}) async {
    if (!Prefs().isDriverRole || isMarkingCustomerNoShow.value) return;
    final id =
        bookingId ??
        activeDriverBookingId.value ??
        serviceDetailBookingId.value;
    if (id == null || id <= 0) return;
    if (!canMarkCustomerNoShow) {
      showAppSnackBar(
        title: 'Not yet',
        message:
            'You can mark customer no-show after the 15-minute wait at pick-up.',
        isError: true,
      );
      return;
    }
    isMarkingCustomerNoShow.value = true;
    try {
      final res = await dashRepository.markCustomerNoShow(bookingId: id);
      res.when(
        success: (r) {
          final alreadyHandled = hasHandledDriverCustomerNoShow(id);
          noteDriverCustomerNoShowHandled(id);
          clearBookingTimerState();
          returnDriverToHomeAfterCustomerNoShow();
          if (!alreadyHandled) {
            showAppSnackBar(
              title: 'No show · No call',
              message: (r.message ?? 'Recorded').trim(),
            );
          }
          unawaited(fetchBookings(refresh: true));
          unawaited(
            fetchDriverNearbyUnassignedBookings(
              refresh: true,
              showLoadingIndicator: false,
            ),
          );
        },
        error: (err) {
          showAppSnackBar(
            title: 'Customer no-show',
            message: err.message,
            isError: true,
          );
        },
      );
    } finally {
      isMarkingCustomerNoShow.value = false;
    }
  }
}
