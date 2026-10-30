import 'package:flutter/foundation.dart';
import 'package:get/get.dart';

import '../routes/app_pages.dart';
import 'pref.dart';

/// Routes service providers through the onboarding tutorial before approval
/// review or the driver dashboard.
class DriverTutorialNavigation {
  DriverTutorialNavigation._();

  static const String flowDriverOnboarding = 'driver_onboarding';
  static const String audienceProvider = 'provider';

  static bool get isCompleted => Prefs().getBool(Prefs.driverTutorialCompleted);

  static void markCompleted() {
    Prefs().putBool(Prefs.driverTutorialCompleted, true);
  }

  /// True when onboarding is finished but the provider has not completed the
  /// one-time signup tutorial (local pref or server `tutorial_completed_at`).
  static bool needsTutorialBefore(String route) {
    if (isCompleted) return false;
    if (!Prefs().getBool(Prefs.driverOnboardingComplete)) return false;
    return route == Routes.DRIVER_DASHBOARD ||
        route == Routes.APPROVAL_PROCESS_REVIEW;
  }

  /// Splash, login, and approval refresh — never force the signup tutorial.
  static void offAllTo(String nextRoute) {
    _offAllNamed(nextRoute);
  }

  /// Initial signup only (after OTP / background check). Skips tutorial when
  /// already completed or onboarding is not finished yet.
  static void routeOrProceed(String nextRoute) {
    if (!needsTutorialBefore(nextRoute)) {
      _offAllNamed(nextRoute);
      return;
    }
    _offAllNamed(
      Routes.TUTORIAL,
      arguments: <String, dynamic>{
        'audience': audienceProvider,
        'flow': flowDriverOnboarding,
        'nextRoute': nextRoute,
      },
    );
  }

  static void _offAllNamed(String route, {Object? arguments}) {
    if (kIsWeb) {
      Get.rootDelegate.offNamed(route, arguments: arguments);
    } else {
      Get.offAllNamed(route, arguments: arguments);
    }
  }

  static Map<String, dynamic>? _arguments() {
    final args = Get.arguments;
    if (args is! Map) return null;
    return Map<String, dynamic>.from(args);
  }

  static bool get isProviderOnboardingFlow {
    final args = _arguments();
    return args?['audience'] == audienceProvider &&
        args?['flow'] == flowDriverOnboarding;
  }

  static String providerNextRoute() {
    final next = _arguments()?['nextRoute']?.toString().trim() ?? '';
    if (next.isNotEmpty) return next;
    return Routes.APPROVAL_PROCESS_REVIEW;
  }
}
