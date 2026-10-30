import 'dart:async';

import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../network/repository/vehicle_repository.dart';
import '../../utils/app_snackbar.dart';
import '../../utils/custom_loader.dart';
import '../../utils/pref.dart';
import '../driver_dashboard/driver_dashboard_controller.dart';
import 'dashboard_controller.dart';

/// Holds cancel-booking reason text and submit logic for the en-route bottom sheet.
class CancelReasonController extends GetxController {
  final _vehicleRepo = VehicleRepository();
  final reasonController = TextEditingController();

  final isSubmitting = false.obs;

  /// Service Details flow: cancel this API booking instead of [DashboardController.postBookingApiId].
  int? _explicitCancelBookingId;

  String get reasonText => reasonController.text.trim();

  void reset() {
    reasonController.clear();
  }

  void beginCancelForBooking(int bookingId) {
    _explicitCancelBookingId = bookingId;
    reasonController.clear();
  }

  /// Sets the API booking id for cancel without clearing an entered reason.
  void assignCancelBookingId(int bookingId) {
    if (bookingId > 0) {
      _explicitCancelBookingId = bookingId;
    }
  }

  void clearExplicitCancelTarget() {
    _explicitCancelBookingId = null;
  }

  DashboardController? _resolveActiveDashboard() {
    if (Prefs().isDriverRole &&
        Get.isRegistered<DriverDashboardController>()) {
      return Get.find<DriverDashboardController>();
    }
    if (Get.isRegistered<DashboardController>()) {
      return Get.find<DashboardController>();
    }
    return null;
  }

  int? _resolveCancelBookingId(DashboardController? activeDash) {
    final explicit = _explicitCancelBookingId;
    if (explicit != null && explicit > 0) return explicit;
    if (activeDash == null) return null;
    return activeDash.postBookingApiId.value ??
        activeDash.activeDriverBookingId.value ??
        activeDash.serviceDetailBookingId.value;
  }

  void _closeCancelSheetIfOpen() {
    if (Get.isBottomSheetOpen ?? false) {
      Get.back<void>();
    }
  }

  /// Calls `POST /api/bookings/{id}/cancel` when an id is available
  /// ([_explicitCancelBookingId] or [DashboardController.postBookingApiId]);
  /// otherwise clears the local journey only (demo / no server booking).
  Future<void> submit() async {
    if (isSubmitting.value) return;
    if (reasonText.isEmpty) {
      showAppSnackBar(
        title: 'Cancel booking',
        message: 'Please enter a reason.',
        isError: true,
      );
      return;
    }

    final activeDash = _resolveActiveDashboard();
    final bookingId = _resolveCancelBookingId(activeDash);

    if (activeDash?.isActiveTripCancellationBlocked == true) {
      showAppSnackBar(
        title: 'Cannot cancel booking',
        message:
            'This booking cannot be cancelled after vehicle handover OTP verification.',
        isError: true,
      );
      return;
    }

    isSubmitting.value = true;
    try {
      if (bookingId != null) {
        Loader.showLoading();
        final res = await _vehicleRepo.cancelBooking(
          bookingId: bookingId,
          reason: reasonText,
        );
        res.when(
          success: (cancelRes) {
            Loader.hideLoading();
            final resolvedId = bookingId;
            final wasExplicitTarget = _explicitCancelBookingId != null;
            _explicitCancelBookingId = null;
            final msg = (cancelRes.message ?? '').trim();
            unawaited(
              _onCancelBookingSuccess(
                activeDash: activeDash,
                bookingId: resolvedId,
                wasExplicitTarget: wasExplicitTarget,
                successMessage:
                    msg.isNotEmpty ? msg : 'Booking cancelled successfully',
              ),
            );
          },
          error: (err) {
            Loader.hideLoading();
            showAppSnackBar(
              title: 'Cancel failed',
              message: err.message,
              isError: true,
            );
          },
        );
      } else {
        showAppSnackBar(
          title: 'Cancel failed',
          message:
              'Booking could not be identified. Open service details and try again.',
          isError: true,
        );
      }
    } finally {
      isSubmitting.value = false;
      Loader.hideLoading();
    }
  }

  Future<void> _onCancelBookingSuccess({
    required DashboardController? activeDash,
    required int bookingId,
    required bool wasExplicitTarget,
    required String successMessage,
  }) async {
    if (Prefs().isDriverRole && bookingId > 0 && activeDash != null) {
      await activeDash.handleBookingCancelledFromApp(bookingId);
      activeDash.dismissCancelTripView();
      unawaited(activeDash.fetchBookings(refresh: true));
      if (wasExplicitTarget &&
          Get.currentRoute == '/driver-service-detail') {
        unawaited(
          activeDash.fetchServiceDetail(bookingId: bookingId, force: true),
        );
      }
    } else {
      if (wasExplicitTarget && activeDash != null) {
        unawaited(
          activeDash.fetchServiceDetail(bookingId: bookingId, force: true),
        );
        unawaited(activeDash.fetchBookings(refresh: true));
      } else {
        activeDash?.clearPostBookingJourney();
      }
    }

    reset();
    _closeCancelSheetIfOpen();
    showAppSnackBar(
      title: 'Booking',
      message: successMessage,
    );
  }

  @override
  void onClose() {
    reasonController.dispose();
    super.onClose();
  }
}
