import 'package:flutter/scheduler.dart';
import 'package:get/get.dart';

import '../modules/driver_dashboard/driver_dashboard_controller.dart';
import '../routes/app_pages.dart';
import 'pref.dart';

/// Opens service detail when a notification references a [bookingId].
abstract final class NotificationNavigation {
  static const int _driverWalletTabIndex = 2;

  static bool isSupportTicketKind(String? kind) {
    final value = kind?.trim().toUpperCase();
    return value == 'SUPPORT_TICKET_REPLY' ||
        value == 'SUPPORT_TICKET_RESOLVED' ||
        value == 'SUPPORT_TICKET_MESSAGE' ||
        value == 'SUPPORT_TICKET_CREATED';
  }

  static void openSupportTicketDetail({int? ticketId}) {
    final id = ticketId;
    if (id == null || id <= 0) return;
    Get.toNamed(
      Routes.SUPPORT_TICKET_DETAIL,
      arguments: {'ticketId': id},
    );
  }

  static bool isDriverWalletKind(String? kind) {
    final value = kind?.trim().toUpperCase();
    return value == 'PAYOUT_INITIATED' ||
        value == 'PAYOUT_COMPLETED' ||
        value == 'PAYOUT_FAILED' ||
        value == 'EARNINGS_RELEASED';
  }
  static void openDriverProfileApprovalStatus(String? kind) {
    final value = kind?.trim().toUpperCase();
    if (value == 'DRIVER_PROFILE_APPROVED') {
      Prefs().putData(Prefs.driverApprovalStatus, 'approved');
      Get.offAllNamed(Routes.DRIVER_DASHBOARD);
      return;
    }

    if (value == 'DRIVER_PROFILE_REJECTED') {
      Prefs().putData(Prefs.driverApprovalStatus, 'rejected');
      Get.offAllNamed(Routes.APPROVAL_PROCESS_REVIEW);
    }
  }

  static void openChat({
    int? bookingId,
    String? peerId,
    String? peerName,
    String? peerImage,
  }) {
    final id = bookingId;
    if (id == null || id <= 0) return;

    Get.toNamed(
      Routes.DRIVER_CHAT,
      arguments: {
        'bookingId': id,
        if (peerId != null && peerId.trim().isNotEmpty) 'peerId': peerId.trim(),
        if (peerName != null && peerName.trim().isNotEmpty)
          'peerName': peerName.trim(),
        if (peerImage != null && peerImage.trim().isNotEmpty)
          'peerImage': peerImage.trim(),
      },
    );
  }

  static void openDriverWallet() {
    // If already on the dashboard, just switch the tab directly.
    if (Get.currentRoute == Routes.DRIVER_DASHBOARD &&
        Get.isRegistered<DriverDashboardController>()) {
      Get.find<DriverDashboardController>().homeNavIndex.value =
          _driverWalletTabIndex;
      return;
    }

    // Navigate to the dashboard and pass the desired tab as a route argument.
    // DashboardController.onReady() reads 'initialTab' from Get.arguments after
    // it finishes its own setup (including the homeNavIndex = 0 reset), so the
    // wallet tab is always the final value — no timing race.
    Get.offAllNamed(
      Routes.DRIVER_DASHBOARD,
      arguments: {'initialTab': _driverWalletTabIndex},
    );
  }

  static void openBookingServiceDetail({
    int? bookingId,
    String? bookingCode,
    String? serviceType,
  }) {
    final id = bookingId;
    if (id == null || id <= 0) return;

    final args = <String, dynamic>{
      'bookingId': id,
      if (bookingCode != null && bookingCode.trim().isNotEmpty)
        'bookingCode': bookingCode.trim(),
      if (serviceType != null && serviceType.trim().isNotEmpty)
        'service_type': serviceType.trim(),
    };

    if (Prefs().isDriverRole) {
      Get.toNamed(Routes.DRIVER_SERVICE_DETAIL, arguments: args);
    } else {
      Get.toNamed(Routes.SERVICE_DETAIL, arguments: args);
    }
  }

  static void openCustomerBillingHistory() {
    if (!Prefs().isCustomerRole) return;
    Get.toNamed(Routes.CUSTOMER_BILLING_HISTORY);
  }

  static void openNotificationCenter() {
    final route = Prefs().isDriverRole
        ? Routes.DRIVER_NOTIFICATIONS
        : Routes.NOTIFICATIONS;
    if (Get.currentRoute == route) return;
    Get.toNamed(route);
  }

  /// Opens the customer invoice detail page for a specific booking.
  /// Falls back to billing history when [bookingId] is unavailable.
  static void openCustomerInvoiceDetail({int? bookingId}) {
    if (!Prefs().isCustomerRole) return;
    final id = bookingId;
    if (id != null && id > 0) {
      Get.toNamed(
        Routes.CUSTOMER_INVOICE_DETAIL,
        arguments: {
          'bookingId': id,
          'paymentStatusLabel': 'Paid',
        },
      );
      return;
    }
    // Fallback: open billing history list when no booking id is available.
    Get.toNamed(Routes.CUSTOMER_BILLING_HISTORY);
  }
}
