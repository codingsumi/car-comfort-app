import '../network/response/profile_response.dart';
import '../routes/app_pages.dart';
import 'driver_tutorial_navigation.dart';
import 'pref.dart';

/// Driver onboarding has 5 UI steps; backend `current_step` becomes 6 after step 5 is saved.
const int kDriverOnboardingTotalSteps = 5;

/// UI model for driver onboarding progress (profile screen).
class DriverOnboardingProgress {
  const DriverOnboardingProgress({
    required this.totalSteps,
    required this.displayStep,
    required this.completedSteps,
    required this.progress,
    required this.isOnboardingComplete,
  });

  final int totalSteps;

  /// Step index shown in "Step X of Y" (never greater than [totalSteps]).
  final int displayStep;

  /// Number of onboarding steps with required data saved.
  final int completedSteps;

  final double progress;
  final bool isOnboardingComplete;

  factory DriverOnboardingProgress.fromProfile({
    DriverProfile? profile,
    int? apiTotalSteps,
  }) {
    final total = (apiTotalSteps != null && apiTotalSteps > 0)
        ? apiTotalSteps
        : kDriverOnboardingTotalSteps;
    final isComplete = profile?.isCompleted == true;
    final completedFromData = _countCompletedSteps(profile, total);

    if (isComplete) {
      return DriverOnboardingProgress(
        totalSteps: total,
        displayStep: total,
        completedSteps: total,
        progress: 1,
        isOnboardingComplete: true,
      );
    }

    final raw = profile?.currentStep ?? 0;
    // Backend stores the *next* step index after each save (can be total + 1).
    final pointerCompleted = raw > 0 ? (raw - 1).clamp(0, total) : 0;
    final completedSteps = completedFromData > pointerCompleted
        ? completedFromData
        : pointerCompleted;

    final displayStep = completedSteps >= total
        ? total
        : (completedSteps + 1).clamp(1, total);

    final progress = total > 0 ? completedSteps / total : 0.0;

    return DriverOnboardingProgress(
      totalSteps: total,
      displayStep: displayStep,
      completedSteps: completedSteps,
      progress: progress.clamp(0.0, 1.0),
      isOnboardingComplete: false,
    );
  }
}

int _countCompletedSteps(DriverProfile? profile, int total) {
  var count = 0;
  for (var step = 1; step <= total; step++) {
    if (_isStepComplete(profile, step)) count++;
  }
  return count;
}

bool _isBackgroundCheckComplete(DriverProfile? profile) {
  return _isBackgroundCheckStepDataComplete(profile?.step(5)) ||
      _isBackgroundCheckStepDataComplete(profile?.step(8));
}

bool _isBackgroundCheckStepDataComplete(Map<String, dynamic>? step) {
  if (step == null || step.isEmpty) return false;
  final signed =
      step['background_check_signed_form'] ?? step['signed_form_url'];
  return _hasText(signed);
}

bool _isStepComplete(DriverProfile? profile, int stepNumber) {
  final step = profile?.step(stepNumber);
  if (stepNumber == 5) {
    return _isBackgroundCheckComplete(profile);
  }
  if (step == null || step.isEmpty) return false;

  switch (stepNumber) {
    case 1:
      return step['agreed_to_terms'] == true;
    case 2:
      return _hasText(step['tshirt_size']) &&
          _hasText(step['address']) &&
          _hasText(step['date_of_birth']) &&
          _hasText(step['social_security_number']);
    case 3:
      return _hasText(step['drivers_license_front']) &&
          _hasText(step['drivers_license_back']) &&
          _hasText(step['drivers_license_number']) &&
          _hasText(step['drivers_license_issued_date']) &&
          _hasText(step['drivers_license_expiration_date']);
    case 4:
      final plate =
          step['vehicle_license_plate'] ?? step['license_plate'];
      return _hasText(step['vehicle_make']) &&
          _hasText(step['vehicle_model']) &&
          _hasText(step['vehicle_year']) &&
          _hasText(step['vehicle_color']) &&
          _hasText(step['vehicle_type']) &&
          _hasText(plate);
    default:
      return step.isNotEmpty;
  }
}

bool _hasText(dynamic value) {
  return value != null && value.toString().trim().isNotEmpty;
}

/// Resolves backend `current_step` for routing (never clamp post-step-5 pointer to 5).
int resolveDriverRoutingStep({
  required int? apiCurrentStep,
  required bool isCompleted,
}) {
  if (isCompleted) return kDriverOnboardingTotalSteps + 1;
  if (apiCurrentStep == null || apiCurrentStep <= 0) return 1;
  return apiCurrentStep;
}

bool isDriverBackgroundCheckComplete(DriverProfile? profile) {
  return _isBackgroundCheckComplete(profile);
}

/// Next route after login / profile refresh for a driver.
String driverOnboardingRouteForProfile({
  required ProfileResponse profile,
  required bool isApproved,
}) {
  final driverProfile = profile.data?.driverProfile;
  final isCompleted = driverProfile?.isCompleted == true;
  final apiStep = driverProfile?.currentStep;
  final routingStep = resolveDriverRoutingStep(
    apiCurrentStep: apiStep,
    isCompleted: isCompleted,
  );

  if (isCompleted) {
    return isApproved ? Routes.DRIVER_DASHBOARD : Routes.APPROVAL_PROCESS_REVIEW;
  }

  if (routingStep > kDriverOnboardingTotalSteps) {
    return Routes.DRIVER_OTP;
  }

  if (routingStep >= kDriverOnboardingTotalSteps &&
      isDriverBackgroundCheckComplete(driverProfile)) {
    return Routes.DRIVER_OTP;
  }

  return driverOnboardingRouteForStep(routingStep, isApproved: isApproved);
}

bool isDriverVerificationPendingFromPrefs({
  required int savedStep,
  required bool onboardingComplete,
  required int completedSteps,
}) {
  if (onboardingComplete) return false;
  if (savedStep > kDriverOnboardingTotalSteps) return true;
  return savedStep >= kDriverOnboardingTotalSteps &&
      completedSteps >= kDriverOnboardingTotalSteps;
}

/// Route used when a driver must finish onboarding or verification before app access.
String driverRouteWhenOnboardingIncomplete({
  required int savedStep,
  required bool onboardingComplete,
  required bool isApproved,
  required int completedSteps,
}) {
  if (isDriverVerificationPendingFromPrefs(
    savedStep: savedStep,
    onboardingComplete: onboardingComplete,
    completedSteps: completedSteps,
  )) {
    return Routes.DRIVER_OTP;
  }
  return driverOnboardingRouteFromPrefs(
    savedStep: savedStep,
    onboardingComplete: onboardingComplete,
    isApproved: isApproved,
  );
}

/// Cold-start route from persisted step pointer (splash).
String driverOnboardingRouteFromPrefs({
  required int savedStep,
  required bool onboardingComplete,
  required bool isApproved,
}) {
  if (savedStep <= 0) {
    if (!onboardingComplete) return Routes.DRIVER_TSHIRT_SIZE;
    return isApproved ? Routes.DRIVER_DASHBOARD : Routes.APPROVAL_PROCESS_REVIEW;
  }
  if (onboardingComplete || savedStep > kDriverOnboardingTotalSteps) {
    if (onboardingComplete) {
      return isApproved ? Routes.DRIVER_DASHBOARD : Routes.APPROVAL_PROCESS_REVIEW;
    }
    return Routes.DRIVER_OTP;
  }
  return driverOnboardingRouteForStep(savedStep, isApproved: isApproved);
}

void persistDriverOnboardingPrefs(ProfileResponse profile) {
  final driverProfile = profile.data?.driverProfile;
  final routingStep = resolveDriverRoutingStep(
    apiCurrentStep: driverProfile?.currentStep,
    isCompleted: driverProfile?.isCompleted == true,
  );
  final approval =
      driverProfile?.approvalStatus?.trim().toLowerCase() ?? '';

  if (routingStep > 0) {
    Prefs().putData(Prefs.driverCurrentStep, '$routingStep');
    Prefs().putData(
      Prefs.driverCompletedSteps,
      '${(routingStep - 1).clamp(0, kDriverOnboardingTotalSteps)}',
    );
  }
  Prefs().putBool(
    Prefs.driverOnboardingComplete,
    driverProfile?.isCompleted == true,
  );
  if (approval.isNotEmpty) {
    Prefs().putData(Prefs.driverApprovalStatus, approval);
  }
  syncDriverTutorialCompletionFromProfile(driverProfile);
}

void syncDriverTutorialCompletionFromProfile(DriverProfile? driverProfile) {
  if (driverProfile?.hasCompletedTutorial == true) {
    DriverTutorialNavigation.markCompleted();
  }
}

String driverOnboardingRouteForStep(int step, {required bool isApproved}) {
  switch (step) {
    case 1:
    case 2:
      return Routes.DRIVER_TSHIRT_SIZE;
    case 3:
      return Routes.UPLOAD_DRIVER_LICENSE;
    case 4:
      return Routes.ADD_VEHICLE_INFORMATION;
    case 5:
    case 6:
    case 7:
    case 8:
      // Steps 6–8 are legacy pointers from the old 8-step flow.
      return Routes.BACKGROUND_CHECK;
    default:
      return isApproved ? Routes.DRIVER_DASHBOARD : Routes.APPROVAL_PROCESS_REVIEW;
  }
}
