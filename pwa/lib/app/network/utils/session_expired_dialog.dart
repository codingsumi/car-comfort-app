import 'dart:async';

import 'package:get/get.dart';

import '../../constants/app_strings.dart';
import '../../routes/app_pages.dart';
import '../../utils/alerts.dart';
import '../../utils/pref.dart';
import '../../utils/session_auth_helper.dart';

bool _sessionDialogShowing = false;

Future<void> _runLogoutAndEnd(void Function() onFlowEnded) async {
  try {
    await forceLocalLogoutToLogin();
  } finally {
    onFlowEnded();
  }
}

Future<bool> _waitUntilNoDialog({Duration timeout = const Duration(seconds: 8)}) async {
  final deadline = DateTime.now().add(timeout);
  while (Get.isDialogOpen == true) {
    if (DateTime.now().isAfter(deadline)) return false;
    await Future<void>.delayed(const Duration(milliseconds: 150));
  }
  return true;
}

bool _isDashboardRoute(String route) {
  return route == Routes.DASHBOARD || route == Routes.DRIVER_DASHBOARD;
}

bool _isPreDashboardRoute(String route) {
  if (Prefs().token().isEmpty) return true;
  if (route.isEmpty || route == Routes.SPLASH) return true;
  return route == Routes.ONBOARDING ||
      route == Routes.WELCOME ||
      route == Routes.WELCOME_TO_CAR_COMFORT ||
      route == Routes.TUTORIAL ||
      route == Routes.CAMERA_ACCESS ||
      route == Routes.LOCATION_ACCESS ||
      route == Routes.LOGIN ||
      route == Routes.REGISTER ||
      route == Routes.DRIVERREGISTER;
}

Future<bool> _waitUntilDashboardAvailable({
  Duration timeout = const Duration(seconds: 8),
}) async {
  final route = Get.currentRoute;
  if (!_isPreDashboardRoute(route)) return true;

  final deadline = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(deadline)) {
    final current = Get.currentRoute;
    if (_isDashboardRoute(current) || !_isPreDashboardRoute(current)) {
      return true;
    }
    await Future<void>.delayed(const Duration(milliseconds: 150));
  }
  return false;
}

/// Shows a logout dialog whose title and body are based on the 401 [reason].
///
/// [reason] values:
///  - `'session_invalidated'`: the account signed in on another device
///  - anything else / null: generic session expiry
Future<void> showSessionExpiredLogoutDialog({
  required void Function() onFlowEnded,
  String? reason,
}) async {
  if (_sessionDialogShowing) {
    onFlowEnded();
    return;
  }

  final dashboardAvailable = await _waitUntilDashboardAvailable();
  if (!dashboardAvailable) {
    onFlowEnded();
    return;
  }

  final canShow = await _waitUntilNoDialog();
  final context = Get.context ?? Get.overlayContext ?? Get.rootDelegate.navigatorKey.currentContext;
  if (!canShow || _sessionDialogShowing || context == null) {
    onFlowEnded();
    return;
  }

  final isOtherDevice = reason == 'session_invalidated';

  final title = isOtherDevice ? 'Signed in on another device' : 'Session expired';
  final message = isOtherDevice
      ? AppStrings.sessionInvalidatedOtherDevice
      : AppStrings.sessionExpired;

  _sessionDialogShowing = true;
  var flowEnded = false;
  void endFlowOnce() {
    if (flowEnded) return;
    flowEnded = true;
    onFlowEnded();
  }

  try {
    showAlertDialog(
      title,
      content: message,
      primaryText: 'Log in',
      showSecondary: false,
      canDismiss: false,
      alertType: AlertType.error,
      primaryClick: () => unawaited(_runLogoutAndEnd(endFlowOnce)),
    );
    await _waitUntilNoDialog(timeout: const Duration(minutes: 10));
  } finally {
    _sessionDialogShowing = false;
    endFlowOnce();
  }
}
