import 'package:flutter/foundation.dart';
import 'package:get/get.dart';

import 'pref.dart';

/// Navigates back on native platforms and returns to the appropriate home
/// route in a reloaded PWA, where no in-memory route stack exists to pop.
void goBackToHome() {
  if (kIsWeb) {
    offAllNamed(Prefs().isDriverRole ? '/driver-dashboard' : '/dashboard');
  } else {
    Get.back();
  }
}

/// Unified navigation helper that works for both mobile and web (router‑delegate mode).
/// On web, `Get.rootDelegate.offNamed` must be used because `onGenerateRoute` is null.
void offAllNamed(String route, {Object? arguments}) {
  if (kIsWeb) {
    Get.rootDelegate.offNamed(route, arguments: arguments);
  } else {
    Get.offAllNamed(route, arguments: arguments);
  }
}

/// Unified navigation helper that works for both mobile and web (router‑delegate mode).
/// On web, `Get.rootDelegate.toNamed` must be used because `onGenerateRoute` is null.
Future<void> toNamed(String route, {Object? arguments}) async {
  if (kIsWeb) {
    Get.rootDelegate.toNamed(route, arguments: arguments);
  } else {
    await Get.toNamed(route, arguments: arguments);
  }
}
