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

  static void markIncomplete() {
    Prefs().putBool(Prefs.driverTutorialCompleted, false);
  }

  /// True when onboarding is finished but the provider has not completed the
  /// one-time signup tutorial (local pref or server `tutorial_completed_at`).
  static bool needsTutorialBefore(String route) {
    if (isCompleted) return false;
    if (!Prefs().getBool(Prefs.driverOnboardingComplete)) return false;
    return route == Routes.DRIVER_DASHBOARD ||
        route == Routes.APPROVAL_PROCESS_REVIEW;
  }

  /// Splash, login, and approval refresh must enforce the required provider
  /// tutorial whenever onboarding is complete and the server has not recorded
  /// tutorial completion.
  static void offAllTo(String nextRoute) {
    routeOrProceed(nextRoute);
  }

  /// Initial signup only (after OTP / background check). Skips tutorial when
  /// already completed or onboarding is not finished yet.
  static void routeOrProceed(String nextRoute) {
    if (!needsTutorialBefore(nextRoute)) {
      Get.offAllNamed(nextRoute);
      return;
    }
    Get.offAllNamed(
      Routes.TUTORIAL,
      arguments: <String, dynamic>{
        'audience': audienceProvider,
        'flow': flowDriverOnboarding,
        'nextRoute': nextRoute,
      },
    );
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
