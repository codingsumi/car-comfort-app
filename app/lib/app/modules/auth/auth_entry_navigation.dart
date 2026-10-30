import 'package:flutter/services.dart';
import 'package:get/get.dart';

import '../../routes/app_pages.dart';
import '../../utils/pref.dart';
import 'auth_controller.dart';

const String _authEntryRoleSelection = 'role_selection';
const String _authEntryLogout = 'logout';

/// Role selection — shown after splash (and onboarding) for signed-out users.
void navigateToRoleSelection() {
  if (Get.isRegistered<AuthController>()) {
    Get.find<AuthController>().clearPendingLoginRole();
  }
  Get.offAllNamed(Routes.WELCOME);
}

/// @deprecated Use [navigateToRoleSelection] for splash/onboarding entry.
void navigateToAuthEntry() => navigateToRoleSelection();

String? readLastAuthRoleFromPrefs() {
  final role = Prefs().getData(Prefs.role).trim().toLowerCase();
  if (role == 'customer' || role == 'driver') return role;
  final lastActive = Prefs().getData(Prefs.lastActiveRole).trim().toLowerCase();
  if (lastActive == 'customer' || lastActive == 'driver') return lastActive;
  return null;
}

String _resolveLoginRole(String? role) {
  final normalized = role?.trim().toLowerCase();
  if (normalized == 'customer' || normalized == 'driver') {
    return normalized!;
  }
  return readLastAuthRoleFromPrefs() ?? 'customer';
}

/// Opens login after logout or session expiry (not role selection).
void navigateToLoginAfterLogout({String? role}) {
  final resolved = _resolveLoginRole(role);
  if (Get.isRegistered<AuthController>()) {
    Get.find<AuthController>().clearPendingLoginRole();
  }
  Get.offAllNamed(
    Routes.LOGIN,
    arguments: <String, dynamic>{
      'role': resolved,
      'auth_entry': _authEntryLogout,
    },
  );
}

void openLoginForRole(String role) {
  final normalized = role.trim().toLowerCase();
  if (normalized != 'customer' && normalized != 'driver') {
    navigateToRoleSelection();
    return;
  }
  Get.offAllNamed(
    Routes.LOGIN,
    arguments: <String, dynamic>{
      'role': normalized,
      'auth_entry': _authEntryRoleSelection,
    },
  );
}

void goBackFromLogin() {
  // Always return to role selection on back press — regardless of whether the
  // user arrived from role selection or a post-logout redirect. This prevents
  // the app from closing when the user presses back on the login screen after
  // logging out, and lets them pick a different role if needed.
  navigateToRoleSelection();
}
