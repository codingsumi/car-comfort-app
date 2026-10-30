import 'package:get/get.dart';
import 'package:onesignal_flutter/onesignal_flutter.dart';

import '../modules/auth/auth_entry_navigation.dart';
import 'pref.dart';

/// Clears push identity, local prefs, closes any open dialogs, and opens login.
Future<void> forceLocalLogoutToLogin() async {
  final role = readLastAuthRoleFromPrefs();
  OneSignal.logout();
  await Prefs().clear();
  while (Get.isDialogOpen == true) {
    Get.back();
  }
  navigateToLoginAfterLogout(role: role);
}
