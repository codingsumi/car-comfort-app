import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:car_comfort/app/network/response/login_response.dart';
import 'package:car_comfort/app/utils/extensions/extension.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_facebook_auth/flutter_facebook_auth.dart';
import 'package:geolocator/geolocator.dart';
import 'package:get/get.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

import '../../network/repository/auth_repository.dart';
import '../../network/repository/service_repository.dart';
import '../../network/response/register_response.dart';
import '../../network/response/profile_response.dart';
import '../../routes/app_pages.dart';
import '../../utils/alerts.dart';
import '../../utils/app_snackbar.dart';
import '../../utils/custom_loader.dart';
import '../../widgets/widgets.dart';
import '../../services/onesignal_service.dart';
import '../../utils/pref.dart';
import '../../utils/validator.dart';
import '../../utils/vehicle_types_cache.dart';
import '../../services/legal_pages_cache_service.dart';
import '../../network/response/legal_page_response.dart';
import '../../utils/legal_pages_navigation.dart';
import '../../utils/driver_onboarding_progress.dart';
import '../../utils/driver_tutorial_navigation.dart';
import '../../utils/role_switch_signup_flow.dart';
import '../../utils/role_switch_service.dart';
import 'auth_entry_navigation.dart';

class AuthController extends GetxController {
  AuthController(this._authRepository);

  final AuthRepository _authRepository;

  final GlobalKey<FormState> loginFormKey = GlobalKey<FormState>();
  final registerFormKey = GlobalKey<FormState>();
  final forgotPasswordFormKey = GlobalKey<FormState>();
  final resetPasswordFormKey = GlobalKey<FormState>();
  final driverTshirtFormKey = GlobalKey<FormState>();
  final vehicleFormKey = GlobalKey<FormState>();
  final insuranceFormKey = GlobalKey<FormState>();

  final firstNameController = TextEditingController();
  final lastNameController = TextEditingController();
  final emailController = TextEditingController();
  final roleController = TextEditingController();
  final forgotEmailController = TextEditingController();
  final forgotPhoneController = TextEditingController();
  final phoneController = TextEditingController();
  final passwordController = TextEditingController();
  final confirmPasswordController = TextEditingController();
  final referralCodeController = TextEditingController();
  final otpController = TextEditingController();

  final RxBool hidePassword = true.obs;
  final RxBool hideConfirmPassword = true.obs;
  final RxBool rememberMe = false.obs;
  final RxBool acceptedTerms = false.obs;

  /// Signup: CMS legal documents (customer or provider) required before register.
  final RxBool signupLegalLoading = false.obs;
  final RxList<LegalPageData> signupLegalPages = <LegalPageData>[].obs;
  final RxMap<String, bool> signupLegalViewed = <String, bool>{}.obs;
  final RxMap<String, bool> signupLegalAccepted = <String, bool>{}.obs;
  LegalAudience? _signupLegalAudience;
  bool _signupLegalLoadStarted = false;
  final RxnString selectedRole = RxnString();

  /// Role chosen on the welcome screen before login (customer | driver).
  final RxnString pendingLoginRole = RxnString();
  final RxnString selectedTShirtSize = RxnString();
  final RxnString driverProfilePhotoPath = RxnString();
  final RxnString driverLicenseFrontPath = RxnString();
  final RxnString driverLicenseBackPath = RxnString();

  final vehicleMakeController = TextEditingController();
  final vehicleModelController = TextEditingController();
  final vehicleLicensePlateController = TextEditingController();
  final RxnString selectedVehicleYear = RxnString();
  final RxnString selectedVehicleColor = RxnString();
  final RxnString selectedVehicleType = RxnString();

  final insuranceProviderController = TextEditingController();
  final insurancePolicyNumberController = TextEditingController();
  final insuranceExpirationController = TextEditingController();
  final RxnString selectedCoverageType = RxnString();

  final RxnString insuranceCardFrontPath = RxnString();
  final RxnString insuranceCardBackPath = RxnString();
  final RxnString vehicleRegistrationFrontPath = RxnString();
  final RxnString vehicleRegistrationBackPath = RxnString();
  final RxBool backgroundCheckAccepted = false.obs;

  final RxString forgotDialCode = '+1'.obs;
  final RxString signupDialCode = '+1'.obs;
  final RxInt otpResendSeconds = 90.obs;
  final RxBool isSocialLoading = false.obs;
  final RxString otpFlow = 'signup'.obs;
  final RxString verificationEmail = ''.obs;
  final RxString resetPasswordToken = ''.obs;

  final FocusNode otpFocusNode = FocusNode();

  Timer? _otpResendTimer;
  final isLoading = false.obs;

  void togglePassword() => hidePassword.value = !hidePassword.value;

  void toggleConfirmPassword() =>
      hideConfirmPassword.value = !hideConfirmPassword.value;

  void toggleRememberMe(bool? value) {
    rememberMe.value = value ?? false;
  }

  @override
  void onInit() {
    super.onInit();
    // Role must be resolved before credentials are loaded so the role-match
    // guard in _loadRememberedLogin can compare against the correct role.
    applyLoginRoleFromArguments();
    _loadRememberedLogin();
    applyLinkedAccountPrefill();
  }

  void applyLoginRoleFromArguments() {
    final args = Get.arguments;
    if (args is! Map) return;
    final role = (args['role'] as String?)?.trim().toLowerCase();
    if (role == 'customer' || role == 'driver') {
      pendingLoginRole.value = role;
      selectedRole.value = role;
    }
  }

  void clearPendingLoginRole() {
    pendingLoginRole.value = null;
    selectedRole.value = null;
  }

  String? get effectiveLoginRole {
    final role = pendingLoginRole.value?.trim().toLowerCase();
    if (role == 'customer' || role == 'driver') return role;
    return null;
  }

  String get loginRoleLabel {
    return effectiveLoginRole == 'driver' ? 'Service Provider' : 'Customer';
  }

  @override
  void onReady() {
    super.onReady();
    if (Get.currentRoute == Routes.LOGIN && effectiveLoginRole == null) {
      navigateToRoleSelection();
    }
  }

  void applyLinkedAccountPrefill() {
    // When coming from the role-switch flow, pre-fill identity fields from
    // the current session so the user doesn't have to re-enter them.
    if (RoleSwitchSignupFlow.isActive) {
      final prefs = Prefs();
      final fn = prefs.userFirstName().trim();
      final ln = prefs.userLastName().trim();
      final em = prefs.userEmail().trim();
      final ph = prefs.getData(Prefs.phone).trim();
      if (fn.isNotEmpty) firstNameController.text = fn;
      if (ln.isNotEmpty) lastNameController.text = ln;
      if (em.isNotEmpty) emailController.text = em;
      if (ph.isNotEmpty) phoneController.text = ph;
      return;
    }
    // Fallback: read from route arguments (legacy path)
    final args = Get.arguments;
    if (args is! Map) return;
    final email = (args['email'] as String?)?.trim();
    final phone = (args['phone'] as String?)?.trim();
    if (email != null && email.isNotEmpty) {
      emailController.text = email;
    }
    if (phone != null && phone.isNotEmpty) {
      phoneController.text = phone;
    }
  }

  void _loadRememberedLogin() {
    final enabled = Prefs().getRememberBool(Prefs.rememberMe);
    rememberMe.value = enabled;
    if (!enabled) return;

    // Only auto-fill when the saved role matches the role the user selected on
    // the role selection screen. This prevents a Customer's credentials from
    // being pre-filled when the user chooses "Service Provider" (or vice versa).
    final savedRole = Prefs()
        .getRememberData(Prefs.rememberedRole)
        .trim()
        .toLowerCase();
    final currentRole = pendingLoginRole.value?.trim().toLowerCase() ?? '';
    if (savedRole.isNotEmpty &&
        currentRole.isNotEmpty &&
        savedRole != currentRole) {
      rememberMe.value = false;
      return;
    }

    final email = Prefs().getRememberData(Prefs.rememberedEmail);
    if (email.isNotEmpty) emailController.text = email;
    // Password is in secure storage — load async and fill when ready.
    Prefs()
        .rememberedPasswordAsync()
        .then((password) {
          if (password.isNotEmpty && rememberMe.value) {
            passwordController.text = password;
          }
        })
        .catchError((Object _) {});
  }

  Future<void> _persistRememberMe() async {
    if (rememberMe.value) {
      Prefs().putRememberBool(Prefs.rememberMe, true);
      Prefs().putRememberData(
        Prefs.rememberedEmail,
        emailController.text.trim(),
      );
      Prefs().putRememberData(
        Prefs.rememberedPassword,
        passwordController.text,
      );
      // Store the role so credentials are only auto-filled for the same role.
      final role = effectiveLoginRole ?? '';
      Prefs().putRememberData(Prefs.rememberedRole, role);
      return;
    }
    await Prefs().clearRememberMe();
  }

  bool validateLoginForm() {
    final form = loginFormKey.currentState;
    if (form == null) return false;
    return form.validate();
  }

  bool validateRegisterForm() {
    final form = registerFormKey.currentState;
    if (form == null || !form.validate()) return false;
    if (!_validateRequiredSignupIdentity(requirePassword: true)) return false;
    return _validateSignupLegalConsent(LegalAudience.customer);
  }

  bool _validateRequiredSignupIdentity({required bool requirePassword}) {
    final checks = <String?>[
      validatePersonName(firstNameController.text, fieldName: 'First name'),
      validatePersonName(lastNameController.text, fieldName: 'Last name'),
      validateEmail(emailController.text, checkEmpty: true),
      validatePhoneNumber(phoneController.text),
      if (requirePassword)
        validatePassword(passwordController.text, checkRegex: true),
      if (requirePassword)
        validateConfirmPassword(
          confirmPasswordController.text,
          passwordController.text,
        ),
    ];
    String? error;
    for (final result in checks) {
      if (result != null) {
        error = result;
        break;
      }
    }
    if (error == null) return true;

    showAppSnackBar(
      title: 'Registration incomplete',
      message: error,
      isError: true,
    );
    return false;
  }

  Future<void> initSignupLegalConsent(LegalAudience audience) async {
    if (_signupLegalLoadStarted && _signupLegalAudience == audience) return;
    _signupLegalLoadStarted = true;
    _signupLegalAudience = audience;
    signupLegalLoading.value = true;
    signupLegalViewed.clear();
    signupLegalAccepted.clear();
    acceptedTerms.value = false;

    try {
      if (!Get.isRegistered<LegalPagesCacheService>()) {
        Get.put(LegalPagesCacheService(), permanent: true);
      }
      final cache = Get.find<LegalPagesCacheService>();
      await cache.ensurePrefetched(audience: audience);

      var pages = cache.signupRequiredFor(audience: audience);
      if (pages.isEmpty) {
        pages = audience == LegalAudience.provider
            ? ProviderSignupLegalFallback.placeholderPages()
            : CustomerSignupLegalFallback.placeholderPages();
      }

      pages = List<LegalPageData>.from(pages)
        ..sort((a, b) {
          final cmp = a.sortOrder.compareTo(b.sortOrder);
          if (cmp != 0) return cmp;
          return a.displayTitle.compareTo(b.displayTitle);
        });

      if (audience == LegalAudience.provider) {
        pages = pages
            .where(
              (p) =>
                  (p.slug ?? '').trim().toLowerCase() !=
                  LegalPageQuery.backgroundCheckAuthorization,
            )
            .toList();
      }

      signupLegalPages.assignAll(pages);
      for (final page in pages) {
        final slug = (page.slug ?? '').trim();
        if (slug.isEmpty) continue;
        signupLegalAccepted[slug] = false;
        signupLegalViewed[slug] = false;
      }
    } catch (_) {
      final fallback = audience == LegalAudience.provider
          ? ProviderSignupLegalFallback.placeholderPages()
          : CustomerSignupLegalFallback.placeholderPages();
      signupLegalPages.assignAll(fallback);
      for (final page in fallback) {
        final slug = (page.slug ?? '').trim();
        if (slug.isEmpty) continue;
        signupLegalAccepted[slug] = false;
        signupLegalViewed[slug] = false;
      }
    } finally {
      signupLegalLoading.value = false;
    }
  }

  Future<void> initProviderSignupLegalConsent() =>
      initSignupLegalConsent(LegalAudience.provider);

  Future<void> initCustomerSignupLegalConsent() =>
      initSignupLegalConsent(LegalAudience.customer);

  bool isSignupLegalViewed(String slug) =>
      signupLegalViewed[slug.trim()] == true;

  bool isSignupLegalAccepted(String slug) =>
      signupLegalAccepted[slug.trim()] == true;

  bool isProviderLegalViewed(String slug) => isSignupLegalViewed(slug);

  bool isProviderLegalAccepted(String slug) => isSignupLegalAccepted(slug);

  void setSignupLegalAccepted(String slug, bool value) {
    final key = slug.trim();
    if (key.isEmpty) return;
    if (value && !isSignupLegalViewed(key)) {
      showAppSnackBar(
        title: 'Review required',
        message: 'Please open and read the document before accepting.',
        isError: true,
      );
      signupLegalAccepted[key] = false;
      return;
    }
    signupLegalAccepted[key] = value;
    signupLegalAccepted.refresh();
    _syncSignupAcceptedTermsFlag();
  }

  void setProviderLegalAccepted(String slug, bool value) =>
      setSignupLegalAccepted(slug, value);

  void openSignupLegalPage(LegalPageData page) {
    final slug = (page.slug ?? '').trim();
    if (slug.isEmpty) return;
    final audience = _signupLegalAudience ?? LegalAudience.customer;
    signupLegalViewed[slug] = true;
    signupLegalViewed.refresh();
    LegalPagesNavigation.open(
      page,
      audience: audience,
      signupConsentSlug: slug,
    );
  }

  void openProviderSignupLegalPage(LegalPageData page) =>
      openSignupLegalPage(page);

  void resetSignupLegalConsentState() {
    _signupLegalLoadStarted = false;
    _signupLegalAudience = null;
    signupLegalPages.clear();
    signupLegalViewed.clear();
    signupLegalAccepted.clear();
    signupLegalLoading.value = false;
    acceptedTerms.value = false;
  }

  void resetProviderSignupLegalConsentState() => resetSignupLegalConsentState();

  void resetCustomerSignupLegalConsentState() => resetSignupLegalConsentState();

  void _syncSignupAcceptedTermsFlag() {
    acceptedTerms.value = _allSignupLegalAccepted;
  }

  bool get _allSignupLegalAccepted {
    if (signupLegalPages.isEmpty) return false;
    for (final page in signupLegalPages) {
      final slug = (page.slug ?? '').trim();
      if (slug.isEmpty) continue;
      if (!isSignupLegalViewed(slug) || !isSignupLegalAccepted(slug)) {
        return false;
      }
    }
    return true;
  }

  bool _validateSignupLegalConsent(LegalAudience audience) {
    if (_signupLegalAudience != audience) {
      showAppSnackBar(
        title: 'Legal documents',
        message:
            'Required legal documents could not be loaded. Please try again.',
        isError: true,
      );
      return false;
    }

    if (signupLegalPages.isEmpty && !signupLegalLoading.value) {
      showAppSnackBar(
        title: 'Legal documents',
        message:
            'Required legal documents could not be loaded. Please try again.',
        isError: true,
      );
      return false;
    }

    if (!_allSignupLegalAccepted) {
      final pending = signupLegalPages.where((page) {
        final slug = (page.slug ?? '').trim();
        return slug.isNotEmpty &&
            (!isSignupLegalViewed(slug) || !isSignupLegalAccepted(slug));
      }).toList();

      if (pending.any((p) => !isSignupLegalViewed((p.slug ?? '').trim()))) {
        showAppSnackBar(
          title: 'Review required',
          message:
              'Open each legal document and check the agreement box at the bottom.',
          isError: true,
        );
      } else {
        showAppSnackBar(
          title: 'Consent required',
          message:
              'Check the agreement box at the bottom of each document you opened.',
          isError: true,
        );
      }
      return false;
    }

    return true;
  }

  bool validateDriverRegisterForm() {
    // In role-switch mode the password / confirm-password fields are hidden;
    // clear them first so their validators don't produce spurious errors.
    if (RoleSwitchSignupFlow.isActive) {
      passwordController.clear();
      confirmPasswordController.clear();
    }

    final form = registerFormKey.currentState;
    if (form == null || !form.validate()) return false;
    if (!_validateRequiredSignupIdentity(
      requirePassword: !RoleSwitchSignupFlow.isActive,
    )) {
      return false;
    }

    final selectedPhoto = driverProfilePhotoPath.value?.trim() ?? '';
    var hasValidPhoto = false;
    if (selectedPhoto.isNotEmpty) {
      try {
        final file = File(selectedPhoto);
        hasValidPhoto = file.existsSync() && file.lengthSync() > 0;
      } catch (_) {
        hasValidPhoto = false;
      }
    }
    if (!hasValidPhoto) {
      showAppSnackBar(
        title: 'Registration incomplete',
        message:
            'Please add a clear, recent profile photo that matches your driver license.',
        isError: true,
      );
      return false;
    }

    if (!_validateSignupLegalConsent(LegalAudience.provider)) {
      return false;
    }

    acceptedTerms.value = true;
    return true;
  }

  Future<void> login() async {
    Get.context?.hideKeyboard();
    isLoading.value = true;
    Loader.showLoading();
    try {
      final pos = await _currentLocationForLogin();
      final result = await _authRepository.login(
        email: emailController.text,
        password: passwordController.text,
        role: effectiveLoginRole,
        latitude: pos?.latitude,
        longitude: pos?.longitude,
      );

      result.when(
        success: (res) async {
          Loader.hideLoading();
          await _persistRememberMe();
          await _handleLoginSuccess(
            res,
            fallbackEmail: emailController.text.trim(),
          );
          TextInput.finishAutofillContext();
        },
        error: (err) {
          Loader.hideLoading();
          isLoading.value = false;
          if (err.message == "Account not verified") {
            verificationEmail.value = (emailController.text).trim();
            _promptAccountVerification();
            return;
          }
          showAppSnackBar(
            title: "Login Failed",
            message: err.message,
            isError: true,
          );
        },
      );
    } finally {
      Loader.hideLoading();
      isLoading.value = false;
    }
  }

  Future<void> _handleDriverPostLoginRouting() async {
    final meResult = await _authRepository.getDriverMe();
    meResult.when(
      success: (profile) {
        _storeDriverProgressInPrefs(profile);
        final nextRoute = _nextDriverRouteFromProfile(profile);
        DriverTutorialNavigation.offAllTo(nextRoute);
      },
      error: (_) {
        Prefs().putData(Prefs.driverCompletedSteps, '0');
        DriverTutorialNavigation.offAllTo(Routes.APPROVAL_PROCESS_REVIEW);
      },
    );
  }

  void _storeDriverProgressInPrefs(ProfileResponse profile) {
    persistDriverOnboardingPrefs(profile);
    final approvalStatus = _driverApprovalStatus(profile);
    if (approvalStatus.isNotEmpty) {
      Prefs().putData(Prefs.driverApprovalStatus, approvalStatus);
    }
  }

  String _driverApprovalStatus(ProfileResponse profile) {
    return profile.data?.driverProfile?.approvalStatus?.trim().toLowerCase() ??
        '';
  }

  bool _isDriverApproved(ProfileResponse profile) {
    return profile.data?.driverProfile?.isApproved == true;
  }

  String _nextDriverRouteFromProfile(ProfileResponse profile) {
    return driverOnboardingRouteForProfile(
      profile: profile,
      isApproved: _isDriverApproved(profile),
    );
  }

  Future<void> refreshDriverApprovalStatusFromReview() async {
    if (isLoading.value) return;
    isLoading.value = true;
    final result = await _authRepository.getDriverMe();
    isLoading.value = false;

    result.when(
      success: (profile) {
        _storeDriverProgressInPrefs(profile);
        final nextRoute = _nextDriverRouteFromProfile(profile);
        if (nextRoute == Routes.DRIVER_DASHBOARD) {
          RoleSwitchService.clearPendingCustomerReturn();
          showAppSnackBar(
            title: 'Approved',
            message: 'Your service provider profile has been approved.',
          );
          DriverTutorialNavigation.offAllTo(Routes.DRIVER_DASHBOARD);
          return;
        }

        if (nextRoute != Routes.APPROVAL_PROCESS_REVIEW) {
          Get.offAllNamed(nextRoute);
          return;
        }

        final status = _driverApprovalStatus(profile);
        final reason = profile.data?.driverProfile?.approvalReason?.trim();
        showAppSnackBar(
          title: 'Approval status',
          message: status == 'rejected'
              ? (reason?.isNotEmpty == true
                    ? 'Your profile was rejected: $reason'
                    : 'Your profile was rejected. Please contact support.')
              : 'Your profile is still under review.',
          isError: status == 'rejected',
        );
      },
      error: (err) {
        showAppSnackBar(
          title: 'Approval status',
          message: err.message,
          isError: true,
        );
      },
    );
  }

  void showLogoutDialogFromApprovalReview() {
    if (RoleSwitchSignupFlow.isActive ||
        RoleSwitchService.canReturnToCustomerDashboard) {
      return;
    }
    showAlertDialog(
      'Logout',
      content: 'Are you sure you want to logout?',
      secondaryText: 'Cancel',
      primaryText: 'Logout',
      canDismiss: true,
      secondaryClick: () => Get.back(),
      primaryClick: () async {
        Get.back();
        await signOutFromApprovalReview();
      },
    );
  }

  Future<void> onApprovalReviewBack() async {
    if (RoleSwitchSignupFlow.isActive) {
      await RoleSwitchSignupFlow.returnToPreviousDashboard();
      return;
    }
    if (RoleSwitchService.canReturnToCustomerDashboard) {
      await RoleSwitchService.returnToCustomerDashboard();
      return;
    }
    await signOutFromApprovalReview();
  }

  bool get showApprovalReviewLogout =>
      !RoleSwitchSignupFlow.isActive &&
      !RoleSwitchService.canReturnToCustomerDashboard;

  Future<void> signOutFromApprovalReview() async {
    await OneSignalService.logout();
    await Prefs().clear();
    clearPendingLoginRole();
    navigateToLoginAfterLogout(role: 'driver');
  }

  void _promptAccountVerification() {
    showAlertDialog(
      'Account Verification',
      content:
          'Your account is not verified yet. We will send a new OTP to your email.',
      showSecondary: false,
      primaryText: 'OK',
      canDismiss: true,
      primaryClick: () async {
        Get.back();
        await resendVerificationOtpAndOpenScreen();
      },
    );
  }

  Future<void> resendVerificationOtpAndOpenScreen() async {
    final email = verificationEmail.value.trim();
    if (email.isEmpty) {
      showAppSnackBar(
        title: 'Verification',
        message: 'Email not found for verification.',
        isError: true,
      );
      return;
    }
    isLoading.value = true;
    final result = await _authRepository.resendOtpEmail(email: email);
    isLoading.value = false;
    result.when(
      success: (res) {
        otpController.clear();
        forgotEmailController.text = email;
        otpFlow.value = 'emailVerification';
        startOtpResendCountdown();
        showAppSnackBar(
          title: 'Verification OTP Sent',
          message: res.message ?? 'A new OTP has been sent to your email.',
        );
        Get.toNamed(Routes.OTP);
      },
      error: (err) {
        showAppSnackBar(
          title: 'Verification Failed',
          message: err.message,
          isError: true,
        );
      },
    );
  }

  // void login() {
  //   if (!validateLoginForm()) return;
  //   Prefs().putData(Prefs.userToken, '123');
  //   Get.offAllNamed(Routes.DASHBOARD);
  // }

  Future<void> signInWithGoogle() async {
    await _runSocialSignIn(
      provider: 'Google',
      action: () async {
        final GoogleSignInAccount? account = await GoogleSignIn(
          scopes: <String>['email'],
        ).signIn();
        if (account == null) return null;

        final GoogleSignInAuthentication googleAuth =
            await account.authentication;
        final email = account.email.trim();
        final socialId = account.id.trim();
        final socialToken = (googleAuth.idToken ?? '').trim();

        if (socialId.isEmpty || socialToken.isEmpty) return null;

        return _SocialAuthPayload(
          socialType: 'google',
          email: email,
          socialId: socialId,
          socialToken: socialToken,
        );
      },
    );
  }

  Future<void> signInWithApple() async {
    if (kIsWeb || (!Platform.isIOS && !Platform.isMacOS)) {
      _showSocialInfo('Apple sign in is available on iOS/macOS devices only.');
      return;
    }
    final available = await SignInWithApple.isAvailable();
    if (!available) {
      _showSocialInfo('Apple sign in is not available on this device.');
      return;
    }
    await _runSocialSignIn(
      provider: 'Apple',
      action: () async {
        final credential = await SignInWithApple.getAppleIDCredential(
          scopes: <AppleIDAuthorizationScopes>[
            AppleIDAuthorizationScopes.email,
            AppleIDAuthorizationScopes.fullName,
          ],
        );
        final socialId = (credential.userIdentifier ?? '').trim();
        final socialToken = (credential.identityToken ?? '').trim();
        if (socialId.isEmpty || socialToken.isEmpty) return null;

        debugPrint('CREDS APPLE ${credential.toString()}');

        return _SocialAuthPayload(
          socialType: 'apple',
          email: (credential.email ?? '').trim(),
          socialId: socialId,
          socialToken: socialToken,
        );
      },
    );
  }

  Future<void> signInWithFacebook() async {
    await _runSocialSignIn(
      provider: 'Facebook',
      action: () async {
        final LoginResult result = await FacebookAuth.instance.login(
          permissions: const <String>['email', 'public_profile'],
        );
        if (result.status != LoginStatus.success) return null;
        final data = await FacebookAuth.instance.getUserData(
          fields: 'id,email,name',
        );
        final socialId = ((data['id'] as String?) ?? '').trim();
        if (socialId.isEmpty) return null;
        return _SocialAuthPayload(
          socialType: 'facebook',
          email: ((data['email'] as String?) ?? '').trim(),
          socialId: socialId,
          socialToken: (result.accessToken?.tokenString ?? '').trim(),
        );
      },
    );
  }

  Future<void> _runSocialSignIn({
    required String provider,
    required Future<_SocialAuthPayload?> Function() action,
  }) async {
    if (isSocialLoading.value) return;
    isSocialLoading.value = true;
    try {
      final socialPayload = await action();
      if (socialPayload == null ||
          socialPayload.socialId.trim().isEmpty ||
          socialPayload.socialToken.trim().isEmpty) {
        _showSocialInfo('$provider sign in was cancelled.');
        return;
      }
      await _completeSocialLogin(provider: provider, payload: socialPayload);
    } on SignInWithAppleAuthorizationException catch (e, s) {
      isSocialLoading.value = false;
      debugPrint(
        '$provider sign in apple auth error: ${e.code} | ${e.message}',
      );
      debugPrintStack(stackTrace: s);
      // Log technical code for debugging; show a friendly message to the user.
      debugPrint('Apple auth error code: ${e.code.name}');
      final msg = e.code == AuthorizationErrorCode.canceled
          ? 'Apple sign in was cancelled.'
          : 'Apple sign in failed. Please try again or use a different sign in method.';
      _showSocialInfo(msg);
    } on PlatformException catch (e, s) {
      isSocialLoading.value = false;
      debugPrint('$provider sign in platform error: ${e.code} | ${e.message}');
      debugPrintStack(stackTrace: s);
      // Map known cancellation codes to a friendly message; log technical details only.
      final cancelled = [
        'sign_in_cancelled',
        'sign_in_failed',
        'network_error',
        'sign_in_required',
      ];
      if (cancelled.any((c) => e.code.toLowerCase().contains(c))) {
        _showSocialInfo('$provider sign in was cancelled.');
      } else {
        _showSocialInfo('$provider sign in failed. Please try again.');
      }
    } catch (e, s) {
      isSocialLoading.value = false;
      debugPrint('$provider sign in error: $e');
      debugPrintStack(stackTrace: s);
      _showSocialInfo('$provider sign in failed. Please try again.');
    } finally {
      isSocialLoading.value = false;
    }
  }

  Future<void> _completeSocialLogin({
    required String provider,
    required _SocialAuthPayload payload,
  }) async {
    Loader.showLoading();
    try {
      final pos = await _currentLocationForLogin();
      final result = await _authRepository.login(
        email: payload.email,
        authType: 'social',
        socialType: payload.socialType,
        socialId: payload.socialId,
        socialToken: payload.socialToken,
        role: effectiveLoginRole,
        latitude: pos?.latitude,
        longitude: pos?.longitude,
      );

      result.when(
        success: (res) async {
          Loader.hideLoading();
          await _handleLoginSuccess(res, fallbackEmail: payload.email);
        },
        error: (err) {
          Loader.hideLoading();
          showAppSnackBar(
            title: "$provider Sign In Failed",
            message: err.message,
            isError: true,
          );
        },
      );
    } finally {
      Loader.hideLoading();
    }
  }

  void _showSocialInfo(String message) {
    showAppSnackBar(title: 'Social Login', message: message, isError: true);
  }

  Future<void> _handleLoginSuccess(
    LoginResponse res, {
    required String fallbackEmail,
    bool routeThroughTutorialFlow = false,
    bool fromCustomerSignupOtp = false,
  }) async {
    final isVerified = res.data?.user?.isVerified ?? true;
    if (!isVerified) {
      verificationEmail.value = (res.data?.user?.email ?? fallbackEmail).trim();
      _promptAccountVerification();
      return;
    }
    _storeUserFromResponse(res);
    await _syncServicesAfterLogin();
    unawaited(VehicleTypesCache.syncFromApi(force: true));
    final role = (res.data?.user?.role ?? '').toLowerCase();
    if (role == 'driver') {
      final usedCustomer =
          await RoleSwitchService.preferCustomerOverUnapprovedDriver();
      if (usedCustomer) return;
      await _handleDriverPostLoginRouting();
      return;
    }
    if (routeThroughTutorialFlow) {
      Get.offAllNamed(Routes.TUTORIAL);
      return;
    }
    if (fromCustomerSignupOtp) {
      Get.offAllNamed(Routes.WELCOME_TO_CAR_COMFORT);
      return;
    }
    Get.offAllNamed(Routes.DASHBOARD);
  }

  Future<void> _syncServicesAfterLogin() async {
    try {
      final repo = ServiceRepository();
      final result = await repo.getServices();
      result.when(
        success: (data) {
          final encoded = jsonEncode(data.map((e) => e.toJson()).toList());
          Prefs().putServicesList(encoded);
          Prefs().putLastServicesSync(DateTime.now().millisecondsSinceEpoch);
        },
        error: (_) {
          // Keep login flow resilient even if services API fails.
        },
      );
    } catch (_) {
      // Keep login flow resilient even if services API throws unexpectedly.
    }
  }

  void completeSignUp() {
    if ((selectedRole.value ?? '').toLowerCase() == 'driver') {
      Get.offAllNamed(Routes.DRIVER_ROLE);
      return;
    }
    Get.offAllNamed(Routes.TUTORIAL);
  }

  Future<void> signUp() async {
    if (!validateRegisterForm()) return;
    Get.context?.hideKeyboard();
    isLoading.value = true;
    const role = 'customer';
    final phoneError = validatePhoneNumber(phoneController.text);
    if (phoneError != null) {
      isLoading.value = false;
      showAppSnackBar(
        title: "Sign Up Failed",
        message: phoneError,
        isError: true,
      );
      return;
    }
    final normalizedPhone = phoneDigitsOnly(phoneController.text);
    signupDialCode.value = '+1';
    final result = await _authRepository.customerRegister(
      firstName: firstNameController.text.trim(),
      lastName: lastNameController.text.trim(),
      email: emailController.text.trim(),
      phone: normalizedPhone,
      countryCode: '+1',
      password: passwordController.text,
      role: role,
      agreedToTerms: acceptedTerms.value,
      referralCode: _optionalReferralCode(),
    );

    isLoading.value = false;
    result.when(
      success: (res) {
        _storeUserFromSignupResponse(res);
        startOtpResendCountdown();
        otpFlow.value = 'signup';
        showAppSnackBar(
          title: "Registration successful",
          message:
              res.message ?? "Please verify OTP to complete your registration.",
        );
        Get.toNamed(Routes.OTP);
      },
      error: (err) {
        showAppSnackBar(
          title: "Sign Up Failed",
          message: err.message,
          isError: true,
        );
      },
    );
  }

  Future<void> driverSignUp() async {
    if (!validateDriverRegisterForm()) return;
    Get.context?.hideKeyboard();
    isLoading.value = true;

    // ── Single Identity Model ─────────────────────────────────────────────────
    // When the user is already logged in and is switching to the provider role,
    // we do NOT create a new account.  Instead we link a provider profile to
    // their existing identity via the /driver/add-profile endpoint.
    if (RoleSwitchSignupFlow.isActive) {
      await _addDriverProfileForCurrentUser();
      return;
    }
    // ── Normal (new) provider registration ───────────────────────────────────
    final phoneError = validatePhoneNumber(phoneController.text);
    if (phoneError != null) {
      isLoading.value = false;
      showAppSnackBar(
        title: "Sign Up Failed",
        message: phoneError,
        isError: true,
      );
      return;
    }
    final normalizedPhone = phoneDigitsOnly(phoneController.text);
    signupDialCode.value = '+1';
    const role = 'driver';
    final result = await _authRepository.customerRegister(
      firstName: firstNameController.text.trim(),
      lastName: lastNameController.text.trim(),
      email: emailController.text.trim(),
      phone: normalizedPhone,
      countryCode: '+1',
      password: passwordController.text,
      role: role,
      agreedToTerms: acceptedTerms.value,
      referralCode: _optionalReferralCode(),
      profilePicturePath: driverProfilePhotoPath.value,
    );
    isLoading.value = false;
    result.when(
      success: (res) async {
        _storeUserFromSignupResponse(res);
        await _syncDriverProgressInPrefs();
        showAppSnackBar(
          title: "Registration successful",
          message:
              res.message ?? "Let's continue your service provider onboarding.",
        );
        Get.toNamed(Routes.DRIVER_TSHIRT_SIZE);
      },
      error: (err) {
        showAppSnackBar(
          title: "Sign Up Failed",
          message: err.message,
          isError: true,
        );
      },
    );
  }

  /// Single Identity Model helper: called when an existing customer upgrades
  /// to the service-provider role without logging out or creating a new account.
  Future<void> _addDriverProfileForCurrentUser() async {
    final result = await _authRepository.addDriverProfile(
      agreedToTerms: acceptedTerms.value,
      profilePicturePath: driverProfilePhotoPath.value,
    );
    isLoading.value = false;
    result.when(
      success: (res) async {
        _storeUserFromSignupResponse(res);
        await _syncDriverProgressInPrefs();
        RoleSwitchSignupFlow.complete();
        showAppSnackBar(
          title: "Provider profile linked!",
          message:
              res.message ?? "Let's continue your service provider onboarding.",
        );
        Get.toNamed(Routes.DRIVER_TSHIRT_SIZE);
      },
      error: (err) {
        showAppSnackBar(
          title: "Setup Failed",
          message: err.message,
          isError: true,
        );
      },
    );
  }

  String? _optionalReferralCode() {
    final code = referralCodeController.text.trim();
    return code.isEmpty ? null : code;
  }

  String? _normalizedUsPhone(String raw) {
    if (validatePhoneNumber(raw) != null) return null;
    return phoneDigitsOnly(raw);
  }

  Future<void> _syncDriverProgressInPrefs() async {
    final meResult = await _authRepository.getDriverMe();
    meResult.when(
      success: (profile) {
        _storeDriverProgressInPrefs(profile);
      },
      error: (_) {},
    );
  }

  void completeDriverSignUp() {
    Get.toNamed(Routes.DRIVER_TSHIRT_SIZE);
  }

  Future<void> pickDriverProfilePhoto(BuildContext context) async {
    await attachmentDialog(
      context,
      cameraClick: () async {
        // Get.back();
        final path = await pickPicture(isCamera: true, preserveQuality: true);
        if (path != null && path.isNotEmpty) {
          driverProfilePhotoPath.value = path;
        }
      },
      galleryClick: () async {
        // Get.back();
        final path = await pickPicture(isCamera: false, preserveQuality: true);
        if (path != null && path.isNotEmpty) {
          driverProfilePhotoPath.value = path;
        }
      },
    );
  }

  void submitDriverTShirtSize() {
    final form = driverTshirtFormKey.currentState;
    if (form == null || !form.validate()) return;
    Get.toNamed(Routes.UPLOAD_DRIVER_LICENSE);
  }

  Future<void> pickDriverLicenseSide(
    BuildContext context, {
    required bool isFront,
  }) async {
    await attachmentDialog(
      context,
      cameraClick: () async {
        final path = await pickPicture(isCamera: true, crop: true);
        _applyLicensePath(path, isFront: isFront);
      },
      galleryClick: () async {
        final path = await pickPicture(crop: true);
        _applyLicensePath(path, isFront: isFront);
      },
    );
  }

  void _applyLicensePath(String? path, {required bool isFront}) {
    if (path == null || path.isEmpty) return;
    if (isFront) {
      driverLicenseFrontPath.value = path;
    } else {
      driverLicenseBackPath.value = path;
    }
  }

  void completeDriverLicense() {
    if ((driverLicenseFrontPath.value ?? '').isEmpty ||
        (driverLicenseBackPath.value ?? '').isEmpty) {
      showAppSnackBar(
        title: 'License',
        message: 'Please upload the front and back of your driver license',
        isError: true,
      );
      return;
    }
    Get.toNamed(Routes.ADD_VEHICLE_INFORMATION);
  }

  void saveVehicleInformation() {
    final form = vehicleFormKey.currentState;
    if (form == null || !form.validate()) return;
    Get.toNamed(Routes.BACKGROUND_CHECK);
  }

  Future<void> selectInsuranceExpirationDate(BuildContext context) async {
    FocusManager.instance.primaryFocus?.unfocus();
    final now = DateTime.now();
    final picked = await showCalendarOnlyDatePicker(
      context,
      initialDate: now,
      firstDate: DateTime(1990),
      lastDate: DateTime(now.year + 15, 12, 31),
    );
    if (picked != null) {
      insuranceExpirationController.text =
          '${picked.month.toString().padLeft(2, '0')}/'
          '${picked.day.toString().padLeft(2, '0')}/'
          '${picked.year}';
    }
  }

  void saveInsuranceInformation() {
    Get.offNamed(Routes.BACKGROUND_CHECK);
  }

  Future<void> pickInsuranceCardSide(
    BuildContext context, {
    required bool isFront,
  }) async {
    await attachmentDialog(
      context,
      cameraClick: () async {
        Get.back();
        final path = await pickPicture(isCamera: true, crop: true);
        _applyInsuranceCardPath(path, isFront: isFront);
      },
      galleryClick: () async {
        Get.back();
        final path = await pickPicture(crop: true);
        _applyInsuranceCardPath(path, isFront: isFront);
      },
    );
  }

  void _applyInsuranceCardPath(String? path, {required bool isFront}) {
    if (path == null || path.isEmpty) return;
    if (isFront) {
      insuranceCardFrontPath.value = path;
    } else {
      insuranceCardBackPath.value = path;
    }
  }

  void completeInsuranceCardUpload() {
    Get.offNamed(Routes.BACKGROUND_CHECK);
  }

  Future<void> pickVehicleRegistrationSide(
    BuildContext context, {
    required bool isFront,
  }) async {
    await attachmentDialog(
      context,
      cameraClick: () async {
        Get.back();
        final path = await pickPicture(isCamera: true, crop: true);
        _applyVehicleRegistrationPath(path, isFront: isFront);
      },
      galleryClick: () async {
        Get.back();
        final path = await pickPicture(crop: true);
        _applyVehicleRegistrationPath(path, isFront: isFront);
      },
    );
  }

  void _applyVehicleRegistrationPath(String? path, {required bool isFront}) {
    if (path == null || path.isEmpty) return;
    if (isFront) {
      vehicleRegistrationFrontPath.value = path;
    } else {
      vehicleRegistrationBackPath.value = path;
    }
  }

  void completeVehicleRegistrationUpload() {
    if ((vehicleRegistrationFrontPath.value ?? '').isEmpty ||
        (vehicleRegistrationBackPath.value ?? '').isEmpty) {
      showAppSnackBar(
        title: 'Registration',
        message:
            'Please upload the front and back of your vehicle registration',
        isError: true,
      );
      return;
    }
    Get.toNamed(Routes.BACKGROUND_CHECK);
  }

  void continueBackgroundCheck() {
    if (!backgroundCheckAccepted.value) {
      showAppSnackBar(
        title: 'Background check',
        message: 'Please accept the background check to continue',
        isError: true,
      );
      return;
    }
    otpController.clear();
    startOtpResendCountdown();
    Get.toNamed(Routes.DRIVER_OTP);
  }

  void onRoleChanged(String? role) {
    selectedRole.value = role;
    roleController.text = role ?? '';
  }

  void forgotPassword() {
    Get.toNamed(Routes.FORGOT_PASSWORD);
  }

  void openSignupRoleDialog() => openSignupFromLogin();

  /// Clears signup form fields so login credentials are not carried over when
  /// the user taps "Sign up" from the login screen. Linked-account prefill is
  /// re-applied on the register screen via [applyLinkedAccountPrefill].
  void resetSignupFormFields() {
    firstNameController.clear();
    lastNameController.clear();
    emailController.clear();
    phoneController.clear();
    passwordController.clear();
    confirmPasswordController.clear();
    referralCodeController.clear();
    acceptedTerms.value = false;
    hidePassword.value = true;
    hideConfirmPassword.value = true;
  }

  void openSignupFromLogin() {
    resetSignupFormFields();
    final role = effectiveLoginRole ?? selectedRole.value?.trim().toLowerCase();
    if (role == 'driver') {
      Get.toNamed(Routes.DRIVERREGISTER);
      return;
    }
    Get.toNamed(Routes.REGISTER);
  }

  bool validateForgotPasswordForm() {
    final form = forgotPasswordFormKey.currentState;
    if (form == null) return false;
    if (!form.validate()) return false;
    final email = forgotEmailController.text.trim();
    final phone = forgotPhoneController.text.trim();
    if (email.isEmpty && phone.isEmpty) {
      showAppSnackBar(
        title: 'Required',
        message: 'Please enter your email or phone number',
        isError: true,
      );
      return false;
    }
    return true;
  }

  Future<bool> submitForgotPassword({
    bool showToast = true,
    bool navigateToVerify = true,
  }) async {
    startOtpResendCountdown();
    if (!validateForgotPasswordForm()) return false;
    // otpController.clear();
    Get.context?.hideKeyboard();
    otpFlow.value = 'forgot';
    resetPasswordToken.value = '';

    isLoading.value = true;
    final result = await _authRepository.forgotPassword(
      email: forgotEmailController.text.trim(),
    );
    isLoading.value = false;

    var success = false;

    result.when(
      success: (res) {
        success = true;
        if (showToast) {
          showAppSnackBar(
            title: "Email Sent",
            message:
                res.message ??
                "Password reset instructions have been sent to your email.",
          );
        }
        if (res.data?.otp != null) {
          final otpString = res.data?.otp?.toString() ?? '';

          otpControllers.forEachIndexed((controller, i) {
            if (i < otpString.length) {
              controller.text = otpString[i];
            }
          });
        }
        if (navigateToVerify) {
          Get.toNamed(Routes.OTP);
        }
      },
      error: (err) {
        showAppSnackBar(
          title: "Request Failed",
          message: err.message,
          isError: true,
        );
      },
    );
    return success;
  }

  void startOtpResendCountdown() {
    _otpResendTimer?.cancel();
    otpResendSeconds.value = 90;
    _otpResendTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (otpResendSeconds.value <= 1) {
        otpResendSeconds.value = 0;
        t.cancel();
      } else {
        otpResendSeconds.value = otpResendSeconds.value - 1;
      }
    });
  }

  Future<void> onOtpResendTap() async {
    if (otpResendSeconds.value > 0) return;
    if (otpFlow.value == 'emailVerification') {
      await resendVerificationOtpAndOpenScreen();
      return;
    }
    if (otpFlow.value == 'forgot') {
      await submitForgotPassword(showToast: true, navigateToVerify: false);
      return;
    }
    isLoading.value = true;
    final result = await _authRepository.resendOtp();
    isLoading.value = false;
    result.when(
      success: (res) {
        startOtpResendCountdown();
        showAppSnackBar(
          title: 'OTP Sent',
          message: res.message ?? 'A new OTP has been sent.',
        );
      },
      error: (err) {
        showAppSnackBar(
          title: "Resend Failed",
          message: err.message,
          isError: true,
        );
      },
    );
  }

  final otpControllers = List.generate(6, (_) => TextEditingController());

  final otpFocusNodes = List.generate(6, (_) => FocusNode());

  Future<bool> verifyCode({bool navigateToReset = true}) async {
    final code = otpControllers.map((c) => c.text).join();

    if (code.length < 6) {
      showAppSnackBar(
        title: "Invalid Code",
        message: "Please enter the 6-digit verification code",
        isError: true,
      );
      return false;
    }
    Get.context?.hideKeyboard();
    isLoading.value = true;
    final result = await _authRepository.verifyResetOtp(
      email: forgotEmailController.text.trim(),
      otp: code,
    );
    isLoading.value = false;

    var success = false;

    result.when(
      success: (res) {
        final data = res.data;
        if (data is Map && data['reset_token'] != null) {
          resetPasswordToken.value = '${data['reset_token']}';
        }
        success = true;
        if (navigateToReset) {
          Get.toNamed(Routes.RESET_PASSWORD);
        }
      },
      error: (err) {
        showAppSnackBar(
          title: "Invalid Verification Code",
          message: err.message,
          isError: true,
        );
      },
    );
    return success;
  }

  Future<String> resetPassword() async {
    final form = resetPasswordFormKey.currentState;
    if (form == null || !form.validate()) return 'error';
    if (resetPasswordToken.value.trim().isEmpty) {
      showAppSnackBar(
        title: "Error",
        message: "Reset token missing. Please verify OTP again.",
        isError: true,
      );
      return 'error';
    }
    Get.context?.hideKeyboard();
    isLoading.value = true;
    final result = await _authRepository.resetPassword(
      resetToken: resetPasswordToken.value.trim(),
      newPassword: passwordController.text.trim(),
      confirmPassword: confirmPasswordController.text.trim(),
    );
    isLoading.value = false;

    var success = 'success';

    result.when(
      success: (res) {
        success = res.status ?? '';
        resetPasswordToken.value = '';
        showAppSnackBar(
          title: "Success",
          message:
              res.message ??
              "Your password has been changed, you may now login with your new info.",
        );
        navigateToLoginAfterLogout(role: effectiveLoginRole);
        // Get.offAllNamed(Routes.AUTH);
      },
      error: (err) {
        showAppSnackBar(title: "Error", message: err.message, isError: true);
      },
    );
    return success;
  }

  Future<void> verifyOtp() async {
    final enteredOtp = otpController.text.trim();
    if (enteredOtp.length != 6) {
      showAppSnackBar(
        title: 'OTP',
        message: 'Please enter the 6-digit code',
        isError: true,
      );
      return;
    }
    Get.context?.hideKeyboard();
    isLoading.value = true;
    final isEmailVerificationFlow = otpFlow.value == 'emailVerification';
    final isForgotFlow = otpFlow.value == 'forgot';
    final result = isEmailVerificationFlow
        ? await _authRepository.verifyOtpEmail(
            email: verificationEmail.value.trim().isNotEmpty
                ? verificationEmail.value
                : forgotEmailController.text.trim(),
            otp: enteredOtp,
          )
        : isForgotFlow
        ? await _authRepository.verifyResetOtp(
            email: forgotEmailController.text.trim(),
            otp: enteredOtp,
          )
        : await _authRepository.verifyOtp(otp: enteredOtp);
    isLoading.value = false;
    result.when(
      success: (res) {
        if (otpFlow.value == 'forgot') {
          final data = res.data;
          if (data is Map && data['reset_token'] != null) {
            resetPasswordToken.value = '${data['reset_token']}';
          }
          Get.toNamed(Routes.RESET_PASSWORD);
          return;
        }
        final message = isEmailVerificationFlow
            ? (res.message ??
                  'Email verified successfully. Please login again.')
            : (res.message ??
                  'Phone verified successfully. Please login to continue.');
        showAppSnackBar(title: 'Verified', message: message);
        if (otpFlow.value == 'signup') {
          _loginAfterSignupVerification();
          return;
        }
        unawaited(
          (() async {
            final role = effectiveLoginRole ?? readLastAuthRoleFromPrefs();
            await OneSignalService.logout();
            await Prefs().clear();
            navigateToLoginAfterLogout(role: role);
          })(),
        );
      },
      error: (err) {
        showAppSnackBar(
          title: "OTP Verification Failed",
          message: err.message,
          isError: true,
        );
      },
    );
  }

  Future<void> _loginAfterSignupVerification() async {
    final email = emailController.text.trim();
    final password = passwordController.text;

    if (email.isEmpty || password.isEmpty) {
      navigateToLoginAfterLogout(role: effectiveLoginRole);
      return;
    }

    isLoading.value = true;
    final pos = await _currentLocationForLogin();
    final loginResult = await _authRepository.login(
      email: email,
      password: password,
      role: effectiveLoginRole ?? 'customer',
      latitude: pos?.latitude,
      longitude: pos?.longitude,
    );
    isLoading.value = false;

    loginResult.when(
      success: (loginRes) async {
        await _handleLoginSuccess(
          loginRes,
          fallbackEmail: email,
          routeThroughTutorialFlow: false,
          fromCustomerSignupOtp: true,
        );
      },
      error: (err) {
        showAppSnackBar(
          title: "Login Failed",
          message: err.message,
          isError: true,
        );
        navigateToLoginAfterLogout(role: effectiveLoginRole);
      },
    );
  }

  // verifyDriverOtp was removed — the real OTP verification for driver signup
  // is in DriverSignupController.verifyDriverOtp() which calls the API.
  // AuthController does not handle this flow.

  void _storeUserFromResponse(LoginResponse rawData) {
    final data = rawData.data;
    final user = data?.user;

    if (data?.token.isNullOrEmpty == false) {
      Prefs().putData(Prefs.userToken, data?.token ?? "");
    }

    Prefs().putData(Prefs.id, user?.id?.toString() ?? "");
    Prefs().putData(Prefs.email, user?.email ?? "");
    Prefs().putData(Prefs.phone, user?.phone ?? "");
    Prefs().putData(Prefs.role, user?.role ?? "");
    Prefs().putRememberData(Prefs.lastActiveRole, user?.role ?? "");

    if (user?.name != null && user!.name!.isNotEmpty) {
      final parts = user.name!.split(' ');
      Prefs().putData(Prefs.firstName, parts.first);
      Prefs().putData(
        Prefs.lastName,
        parts.length > 1 ? parts.sublist(1).join(' ') : '',
      );
    }

    final roleId = (user?.role?.toLowerCase() == 'customer') ? '1' : '';
    Prefs().putData(Prefs.roleId, roleId);

    unawaited(OneSignalService.syncLoggedInUser());
  }

  Future<Position?> _currentLocationForLogin() async {
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) return null;
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        return null;
      }
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );
    } catch (_) {
      return await Geolocator.getLastKnownPosition();
    }
  }

  void _storeUserFromSignupResponse(RegisterResponse rawData) {
    final signupData = rawData.data;
    if (signupData?.token.isNullOrEmpty == false) {
      Prefs().putData(Prefs.userToken, signupData?.token ?? "");
    }
    final user = signupData?.user;

    Prefs().putData(Prefs.id, user?.id?.toString() ?? "");
    Prefs().putData(Prefs.firstName, user?.firstName ?? "");
    Prefs().putData(Prefs.lastName, user?.lastName ?? "");
    Prefs().putData(Prefs.email, user?.email ?? "");
    Prefs().putData(Prefs.phone, user?.phone ?? "");
    Prefs().putData(Prefs.role, user?.role ?? "");

    final roleId = (user?.role?.toLowerCase() == 'customer') ? '1' : '';
    Prefs().putData(Prefs.roleId, roleId);

    unawaited(OneSignalService.syncLoggedInUser());
  }

  @override
  void onClose() {
    _otpResendTimer?.cancel();
    super.onClose();
  }
}

class _SocialAuthPayload {
  const _SocialAuthPayload({
    required this.socialType,
    required this.email,
    required this.socialId,
    required this.socialToken,
  });

  final String socialType;
  final String email;
  final String socialId;
  final String socialToken;
}
