import 'dart:async';

import 'package:get/get.dart';

import '../modules/auth/auth_controller.dart';
import '../routes/app_pages.dart';
import '../services/onesignal_service.dart';
import 'pref.dart';
import 'web_navigation.dart';
import '../modules/auth/auth_entry_navigation.dart';

/// Tracks signup started from Settings → "Use as driver/customer" so the user
/// can return to their existing dashboard without logging out.
class RoleSwitchSignupFlow {
  RoleSwitchSignupFlow._();

  static const String activeKey = 'role_switch_signup_active';
  static const String returnRoleKey = 'role_switch_return_role';
  static const String _backupPrefix = 'role_switch_backup_';

  static const List<String> _sessionKeys = [
    Prefs.userToken,
    Prefs.id,
    Prefs.email,
    Prefs.phone,
    Prefs.role,
    Prefs.firstName,
    Prefs.lastName,
    Prefs.roleId,
  ];

  static bool get isActive => Prefs().getRememberBool(activeKey);

  static void begin({required String returnRole}) {
    final prefs = Prefs();
    for (final key in _sessionKeys) {
      prefs.putRememberData('$_backupPrefix$key', prefs.getData(key));
    }
    prefs.putRememberBool(activeKey, true);
    prefs.putRememberData(returnRoleKey, returnRole.trim().toLowerCase());
  }

  static Future<void> handleSignupBack() async {
    if (isActive) {
      await returnToPreviousDashboard();
      return;
    }
    final canPop = Get.key.currentState?.canPop() ?? false;
    if (canPop) {
      Get.back();
      return;
    }
    navigateToRoleSelection();
  }

  static Future<void> returnToPreviousDashboard() async {
    if (!isActive) {
      await handleSignupBack();
      return;
    }

    _restoreSession();
    await _clearFlow();

    final role = Prefs().userRole();
    if (role == 'driver') {
      offAllNamed(Routes.DRIVER_DASHBOARD);
    } else {
      offAllNamed(Routes.DASHBOARD);
    }
    unawaited(OneSignalService.syncLoggedInUser());
  }

  static void complete() {
    if (!isActive) return;
    unawaited(_clearFlow());
  }

  static void _restoreSession() {
    final prefs = Prefs();
    for (final key in _sessionKeys) {
      prefs.putData(key, prefs.getRememberData('$_backupPrefix$key'));
    }
    final role = prefs.userRole();
    prefs.putRememberData(Prefs.lastActiveRole, role);
  }

  static Future<void> _clearFlow() async {
    final prefs = Prefs();
    prefs.putRememberBool(activeKey, false);
    await prefs.removeRememberData(returnRoleKey);
    for (final key in _sessionKeys) {
      await prefs.removeRememberData('$_backupPrefix$key');
    }
  }

  /// Cancel a provider signup that was started without a prior logged-in
  /// session.  Backend onboarding data is intentionally left intact so the
  /// user can resume later; only local/session state is cleared here.
  static Future<void> cancelProviderSignup() async {
    final prefs = Prefs();
    // Clear driver-specific onboarding prefs (kept on backend; just cloned).
    await Future.wait([
      prefs.removeData(Prefs.driverCurrentStep),
      prefs.removeData(Prefs.driverCompletedSteps),
      prefs.removeData(Prefs.driverOnboardingComplete),
      prefs.removeData(Prefs.driverApprovalStatus),
      prefs.removeData(Prefs.driverBackgroundCheckFormDownloaded),
      prefs.removeData(Prefs.driverTutorialCompleted),
    ]);
    // Clear role-switch state if the signup was launched from an existing account.
    if (isActive) {
      await _clearFlow();
    }
    // Reset any cached signup form values held in AuthController.
    if (Get.isRegistered<AuthController>()) {
      Get.find<AuthController>().resetSignupFormFields();
    }
    navigateToRoleSelection();
  }
}
