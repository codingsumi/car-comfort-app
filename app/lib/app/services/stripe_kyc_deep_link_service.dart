import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:get/get.dart';

import '../modules/driver_dashboard/driver_dashboard_controller.dart';
import '../routes/app_pages.dart';
import '../utils/app_snackbar.dart';
import '../utils/pref.dart';

class StripeKycDeepLinkService extends GetxService {
  static const int _walletTabIndex = 2;

  final AppLinks _appLinks = AppLinks();
  StreamSubscription<Uri>? _linkSub;
  String? _lastHandled;

  Future<StripeKycDeepLinkService> init() async {
    try {
      final initial = await _appLinks.getInitialLink();
      if (initial != null) {
        unawaited(_handleLink(initial));
      }
      _linkSub = _appLinks.uriLinkStream.listen(
        (uri) => unawaited(_handleLink(uri)),
      );
    } catch (_) {}
    return this;
  }

  Future<void> _handleLink(Uri uri) async {
    if (!_isKycLink(uri)) return;

    final marker = uri.toString();
    if (_lastHandled == marker) return;
    _lastHandled = marker;

    final result = _kycResult(uri);
    if (Prefs().token().trim().isEmpty || !Prefs().isDriverRole) {
      return;
    }
    if (!Prefs().isDriverApproved) {
      Get.offAllNamed(Routes.APPROVAL_PROCESS_REVIEW);
      return;
    }

    await _openWalletTab();
    final controller = await _driverControllerWhenReady();
    if (controller != null) {
      await controller.refreshWalletTab(showKycErrorSnack: false);
    }

    switch (result) {
      case 'success':
        showAppSnackBar(
          title: 'Stripe verification',
          message: controller?.isStripeKycComplete == true
              ? 'Verification completed successfully.'
              : 'Verification submitted. We will update your wallet once Stripe finishes reviewing it.',
        );
        break;
      case 'refresh':
        showAppSnackBar(
          title: 'Stripe verification',
          message:
              'Verification session expired. Please start verification again.',
          isError: true,
        );
        break;
      default:
        showAppSnackBar(
          title: 'Stripe verification',
          message: 'Verification was not completed. Please try again.',
          isError: true,
        );
        break;
    }
  }

  bool _isKycLink(Uri uri) {
    if (uri.scheme != 'carcomfort') return false;
    if (uri.host == 'kyc') return true;
    return uri.pathSegments.isNotEmpty && uri.pathSegments.first == 'kyc';
  }

  String _kycResult(Uri uri) {
    final candidates = <String>[
      if (uri.pathSegments.isNotEmpty) uri.pathSegments.last,
      uri.queryParameters['status'] ?? '',
      uri.queryParameters['result'] ?? '',
      uri.host,
    ];
    for (final candidate in candidates) {
      final value = candidate.trim().toLowerCase();
      if (value == 'success' || value == 'error' || value == 'refresh') {
        return value;
      }
    }
    return 'error';
  }

  Future<void> _openWalletTab() async {
    if (Get.currentRoute != Routes.DRIVER_DASHBOARD) {
      await (Get.offAllNamed(Routes.DRIVER_DASHBOARD) ?? Future.value());
    }
    final controller = await _driverControllerWhenReady();
    controller?.homeNavIndex.value = _walletTabIndex;
  }

  Future<DriverDashboardController?> _driverControllerWhenReady() async {
    for (var attempt = 0; attempt < 12; attempt++) {
      if (Get.isRegistered<DriverDashboardController>()) {
        return Get.find<DriverDashboardController>();
      }
      await Future<void>.delayed(const Duration(milliseconds: 250));
    }
    return null;
  }

  @override
  void onClose() {
    _linkSub?.cancel();
    super.onClose();
  }
}
