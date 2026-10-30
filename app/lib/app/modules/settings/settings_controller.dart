import 'dart:async';

import 'package:country_code_picker_plus/src/constants.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../network/repository/auth_repository.dart';
import '../../network/repository/dash_repository.dart';
import '../../network/response/notification_list_response.dart';
import '../../network/repository/vehicle_repository.dart';
import '../../network/response/profile_response.dart';
import '../../network/response/legal_page_response.dart';
import '../../routes/app_pages.dart';
import '../auth/auth_controller.dart';
import '../auth/auth_entry_navigation.dart';
import '../../services/legal_pages_cache_service.dart';
import '../../utils/alerts.dart';
import '../../utils/app_snackbar.dart';
import '../../utils/custom_loader.dart';
import '../dashboard/dashboard_controller.dart';
import '../../services/booking_live_socket_service.dart';
import '../../services/driver_dashboard_socket_service.dart';
import '../../services/onesignal_service.dart';
import '../../utils/pref.dart';
import '../../utils/validator.dart';
import '../../widgets/widgets.dart';

class SettingsController extends GetxController {
  SettingsController(this._authRepository);

  final AuthRepository _authRepository;
  final VehicleRepository _vehicleRepository = VehicleRepository();
  final DashRepository _dashRepository = DashRepository();
  final RxBool pushNotifications = true.obs;
  final RxBool emailNotifications = false.obs;
  final RxBool isLoggingOut = false.obs;
  final RxBool isSavingProfile = false.obs;
  final RxInt vehiclesCount = 0.obs;
  final RxString referralCode = ''.obs;
  final RxInt referralCount = 0.obs;

  /// Active referrals from API `active_referrals_count` (shown on customer profile).
  final RxInt activeReferralsCount = 0.obs;
  final RxString profileDialCode = '+1'.obs;

  /// Used by the country picker `initialSelection`.
  /// `country_code_picker_plus` accepts ISO (e.g. "US") or dial code (e.g. "+91").
  final RxString profileCountrySelection = 'US'.obs;
  final notifications = <NotificationItem>[].obs;
  final RxBool isNotificationsLoading = false.obs;
  final RxBool isNotificationsLoadingMore = false.obs;
  final RxBool notificationsHasMore = true.obs;
  final RxString notificationsError = ''.obs;
  int _notificationsPage = 0;
  static const int _notificationsLimit = 20;

  final firstNameController = TextEditingController();
  final lastNameController = TextEditingController();
  final emailController = TextEditingController();
  final phoneController = TextEditingController();

  String? profileImagePath;
  bool isProfileLoading = false;
  Future<void>? _profileLoadTask;
  DateTime? _lastProfileFetchedAt;
  bool _isProfileDirty = true;
  bool isProfileHeaderEditing = false;
  static const Duration _profileCacheTtl = Duration(minutes: 10);

  @override
  void onInit() {
    super.onInit();
    if (!Prefs().isCustomerRole) {
      return;
    }
    unawaited(
      Get.find<LegalPagesCacheService>().ensurePrefetched(
        audience: LegalAudience.customer,
      ),
    );
    unawaited(ensureCustomerProfileLoaded());
    unawaited(loadVehiclesCount());
    unawaited(loadNotifications());
  }

  Future<void> loadNotifications({bool refresh = false}) async {
    if (refresh) {
      Loader.showLoading();
      notificationsError.value = '';
      Loader.hideLoading();
      notificationsHasMore.value = true;
      _notificationsPage = 0;
    }

    if (!refresh) {
      if (isNotificationsLoading.value || isNotificationsLoadingMore.value)
        return;
      if (!notificationsHasMore.value) return;
    }

    final nextPage = _notificationsPage == 0 ? 1 : _notificationsPage + 1;
    if (nextPage == 1) {
      isNotificationsLoading.value = true;
    } else {
      isNotificationsLoadingMore.value = true;
    }

    final res = await _dashRepository.getNotifications(
      page: nextPage,
      limit: _notificationsLimit,
    );
    Loader.hideLoading();
    res.when(
      success: (data) {
        if (nextPage == 1) {
          notifications.assignAll(data.items);
        } else {
          notifications.addAll(data.items);
        }
        _notificationsPage = nextPage;
        final totalPages = data.totalPages;
        if (totalPages != null && totalPages > 0) {
          notificationsHasMore.value = _notificationsPage < totalPages;
        } else {
          notificationsHasMore.value = data.items.length >= _notificationsLimit;
        }
      },
      error: (err) {
        Loader.hideLoading();
        if (nextPage == 1) {
          notifications.clear();
        }
        notificationsError.value = err.message;
      },
    );
    isNotificationsLoading.value = false;
    Loader.hideLoading();
    isNotificationsLoadingMore.value = false;
  }

  Future<bool> confirmDeleteNotification(NotificationItem item) async {
    final c = Completer<bool>();
    showAlertDialog(
      'Delete notification',
      content: 'Are you sure you want to delete this notification?',
      primaryText: 'Delete',
      secondaryText: 'Cancel',
      canDismiss: false,
      primaryClick: () {
        Get.back();
        if (!c.isCompleted) c.complete(true);
      },
      secondaryClick: () {
        Get.back();
        if (!c.isCompleted) c.complete(false);
      },
    );
    return c.future;
  }

  Future<void> deleteNotificationItem(NotificationItem item) async {
    final i = notifications.indexWhere((n) => n.id == item.id);
    if (i < 0) return;
    notifications.removeAt(i);
    final id = int.tryParse(item.id);
    if (id == null) {
      notifications.insert(i.clamp(0, notifications.length), item);
      showAppSnackBar(
        title: 'Error',
        message: 'Unable to delete this notification.',
        isError: true,
      );
      return;
    }
    final res = await _dashRepository.deleteNotification(notificationId: id);
    res.when(
      success: (_) {},
      error: (e) {
        notifications.insert(i.clamp(0, notifications.length), item);
        showAppSnackBar(title: 'Error', message: e.message, isError: true);
      },
    );
  }

  void onClearAllNotificationsPressed() {
    showAlertDialog(
      'Clear all notifications',
      content: 'Are you sure you want to delete all notifications?',
      primaryText: 'Delete',
      secondaryText: 'Cancel',
      canDismiss: false,
      primaryClick: () {
        Get.back();
        unawaited(_clearAllNotificationsAfterConfirm());
      },
      secondaryClick: () => Get.back(),
    );
  }

  Future<void> _clearAllNotificationsAfterConfirm() async {
    Loader.showLoading();
    try {
      final res = await _dashRepository.deleteAllNotifications();
      res.when(
        success: (_) {
          notifications.clear();
          notificationsError.value = '';
          notificationsHasMore.value = true;
          _notificationsPage = 0;
        },
        error: (e) {
          showAppSnackBar(title: 'Error', message: e.message, isError: true);
        },
      );
    } finally {
      Loader.hideLoading();
    }
  }

  Future<void> ensureCustomerProfileLoaded({bool force = false}) async {
    if (!Prefs().isCustomerRole) {
      return;
    }
    if (_profileLoadTask != null) {
      await _profileLoadTask;
      return;
    }

    final now = DateTime.now();
    final isFresh =
        _lastProfileFetchedAt != null &&
        now.difference(_lastProfileFetchedAt!) <= _profileCacheTtl;
    if (!force && !_isProfileDirty && isFresh) return;

    final task = loadCustomerProfile();
    _profileLoadTask = task;
    try {
      await task;
      await loadVehiclesCount();
    } finally {
      _profileLoadTask = null;
    }
  }

  Future<void> loadVehiclesCount() async {
    if (!Prefs().isCustomerRole) {
      return;
    }
    final result = await _vehicleRepository.getVehicles();
    result.when(
      success: (list) {
        vehiclesCount.value = list.length;
        update();
      },
      error: (_) {
        // Keep previous count on failure to avoid noisy UX.
      },
    );
  }

  void toggleProfileHeaderEditing() {
    isProfileHeaderEditing = !isProfileHeaderEditing;
    update();
  }

  void resetProfileHeaderEditing() {
    if (!isProfileHeaderEditing) return;
    isProfileHeaderEditing = false;
    update();
  }

  Future<void> logout() async {
    if (isLoggingOut.value) return;
    isLoggingOut.value = true;
    Loader.showLoading();
    try {
      await _authRepository.logout();
      // Even if API logout fails (token already expired/etc), clear local session.
      await _clearSessionAndGoToLogin();
    } finally {
      Loader.hideLoading();
      isLoggingOut.value = false;
    }
  }

  void openBookingHistory() {
    if (Get.isRegistered<DashboardController>()) {
      final dash = Get.find<DashboardController>();
      // Booking history must include cancelled bookings as well as completed
      // ones. Cancellation-fee transactions can exist for those bookings, so
      // forcing the Completed filter makes the two histories inconsistent.
      dash.setBookingsFilter('all');
      dash.homeNavIndex.value = 1;
      return;
    }
    Get.toNamed(Routes.MY_BOOKINGS, arguments: {'filter': 'all'});
  }

  void openBillingHistory() => Get.toNamed(Routes.CUSTOMER_BILLING_HISTORY);

  void openTutorial() => Get.toNamed(Routes.CUSTOMER_TUTORIAL_LIBRARY);

  void showLogoutDialog() {
    showAlertDialog(
      'Logout',
      content: 'Are You sure you want to logout',
      secondaryText: 'Cancel',
      primaryText: 'Okay',
      canDismiss: true,
      secondaryClick: () => Get.back(),
      primaryClick: () async {
        Get.back();
        await logout();
      },
    );
  }

  Future<void> _clearSessionAndGoToLogin() async {
    final role = readLastAuthRoleFromPrefs();
    if (Get.isRegistered<BookingLiveSocketService>()) {
      await Get.find<BookingLiveSocketService>().disconnect();
    }
    if (Get.isRegistered<DriverDashboardSocketService>()) {
      await Get.find<DriverDashboardSocketService>().disconnect();
    }
    await OneSignalService.logout();
    await Prefs().clear();
    if (Get.isRegistered<AuthController>()) {
      Get.find<AuthController>().clearPendingLoginRole();
    }
    navigateToLoginAfterLogout(role: role);
  }

  Future<void> openProfilePhotoPicker(BuildContext context) async {
    await attachmentDialog(
      context,
      cameraClick: () async {
        final path = await pickPicture(isCamera: true);
        if (path == null || path.isEmpty) return;
        profileImagePath = path;
        update();
      },
      galleryClick: () async {
        final path = await pickPicture(isCamera: false);
        if (path == null || path.isEmpty) return;
        profileImagePath = path;
        update();
      },
    );
  }

  Future<void> loadCustomerProfile() async {
    isProfileLoading = true;
    update();

    final result = await _authRepository.getCustomerMe();
    if (isClosed) return;

    isProfileLoading = false;

    result.when(
      success: (res) {
        if (isClosed) return;
        final ProfileUser? user = res.data?.user;
        final parsedNames = _splitName(user?.name ?? '');

        firstNameController.text = parsedNames.$1;
        lastNameController.text = parsedNames.$2;
        emailController.text = user?.email ?? '';
        _applyPhoneFromApi(user?.phone);
        referralCode.value = (user?.referralCode ?? '').trim();
        activeReferralsCount.value =
            res.data?.resolvedActiveReferralsCount ?? 0;
        referralCount.value = activeReferralsCount.value;

        if ((user?.profilePicture ?? '').isNotEmpty) {
          profileImagePath = user?.profilePicture;
          Prefs().putData(Prefs.image, user?.profilePicture ?? '');
        } else if ((res.data?.driverProfile?.profilePicture ?? '').isNotEmpty) {
          profileImagePath = res.data?.driverProfile?.profilePicture;
          Prefs().putData(
            Prefs.image,
            res.data?.driverProfile?.profilePicture ?? '',
          );
        }
        _lastProfileFetchedAt = DateTime.now();
        _isProfileDirty = false;
        update();
      },
      error: (err) {
        if (isClosed) return;
        update();
        showAppSnackBar(title: 'Profile', message: err.message, isError: true);
      },
    );
  }

  void _applyPhoneFromApi(String? raw) {
    final phone = (raw ?? '').trim();
    if (phone.isEmpty) {
      phoneController.text = '';
      return;
    }
    if (!phone.startsWith('+')) {
      phoneController.text = normalizePhoneLocalDigits(phone);
      return;
    }

    final dial = _extractDialCode(phone) ?? profileDialCode.value;
    profileDialCode.value = dial;
    profileCountrySelection.value = dial; // fallback to dial-based selection

    // +1 is shared by US/CA; prefer user's last explicit choice.
    final savedIso = Prefs().getData(Prefs.profileCountryIso).toUpperCase();
    if (dial == '+1' && (savedIso == 'US' || savedIso == 'CA')) {
      profileCountrySelection.value = savedIso;
    }

    var local = phone.substring(dial.length);
    phoneController.text = normalizePhoneLocalDigits(local);
  }

  String? _extractDialCode(String e164) {
    final digits = e164.replaceAll(RegExp(r'[^\d+]'), '');
    if (!digits.startsWith('+')) return null;
    final known =
        countryCodes
            .map((e) => e['dial_code'] ?? '')
            .where((e) => e.isNotEmpty)
            .toSet()
            .toList()
          ..sort((a, b) => b.length.compareTo(a.length));

    for (final d in known) {
      if (digits.startsWith(d)) {
        return d;
      }
    }
    return null;
  }

  Future<void> saveCustomerProfile() async {
    final firstName = firstNameController.text.trim();
    final lastName = lastNameController.text.trim();
    final rawPhone = phoneController.text.trim();
    final phone = _buildPhoneWithCountryCode(rawPhone);

    final firstNameError = validatePersonName(
      firstName,
      fieldName: 'First name',
    );
    if (firstNameError != null) {
      _showProfileMessage(firstNameError);
      return;
    }
    final lastNameError = validatePersonName(lastName, fieldName: 'Last name');
    if (lastNameError != null) {
      _showProfileMessage(lastNameError);
      return;
    }
    if (rawPhone.isEmpty) {
      _showProfileMessage('Please enter phone number');
      return;
    }
    final phoneError = validatePhoneNumber(rawPhone);
    if (phoneError != null) {
      _showProfileMessage(phoneError);
      return;
    }

    isSavingProfile.value = true;
    update();

    final result = await _authRepository.updateCustomerProfile(
      firstName: firstName,
      lastName: lastName,
      phone: phone,
      profilePicturePath: _newProfileImagePath(),
    );

    isSavingProfile.value = false;

    result.when(
      success: (res) {
        Prefs().putData(Prefs.firstName, firstName);
        Prefs().putData(Prefs.lastName, lastName);
        Prefs().putData(Prefs.phone, phone);
        final iso = profileCountrySelection.value.trim().toUpperCase();
        if (iso.isNotEmpty) {
          Prefs().putData(Prefs.profileCountryIso, iso);
        }
        final updatedImage = profileImagePath?.trim();
        if (updatedImage != null &&
            updatedImage.isNotEmpty &&
            updatedImage.startsWith('http')) {
          Prefs().putData(Prefs.image, updatedImage);
        }
        // Profile is updated; force one fresh API sync next time.
        _isProfileDirty = true;
        unawaited(
          ensureCustomerProfileLoaded(force: true).then((_) {
            if (Get.isRegistered<DashboardController>()) {
              Get.find<DashboardController>().refreshProfileHeader();
            }
          }),
        );
        update();
        Get.back();
        showAppSnackBar(
          title: 'Profile',
          message: res.message ?? 'Profile updated successfully',
        );
      },
      error: (err) {
        update();
        _showProfileMessage(err.message);
      },
    );
  }

  void _showProfileMessage(String message) {
    showAppSnackBar(title: 'Profile', message: message, isError: true);
  }

  String? _newProfileImagePath() {
    final path = profileImagePath?.trim();
    if (path == null || path.isEmpty) return null;
    if (path.startsWith('http')) return null;
    return path;
  }

  String _buildPhoneWithCountryCode(String rawPhone) {
    final normalized = rawPhone.trim();
    if (normalized.isEmpty) return '';
    if (normalized.startsWith('+')) return normalized;

    final digitsOnly = normalized.replaceAll(RegExp(r'\D'), '');
    return '${profileDialCode.value}$digitsOnly';
  }

  (String, String) _splitName(String fullName) {
    final clean = fullName.trim();
    if (clean.isEmpty) return ('', '');
    final parts = clean.split(RegExp(r'\s+'));
    final first = parts.first;
    final last = parts.length > 1 ? parts.sublist(1).join(' ') : '';
    return (first, last);
  }

  @override
  void onClose() {
    firstNameController.dispose();
    lastNameController.dispose();
    emailController.dispose();
    phoneController.dispose();
    super.onClose();
  }
}
