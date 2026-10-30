import 'dart:async';

import 'package:car_comfort/app/utils/extensions/extension.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../utils/pdf_download_helper.dart';
import '../../network/repository/auth_repository.dart';
import '../../network/repository/dash_repository.dart';
import '../../network/utils/network_result.dart';
import '../../network/response/notification_list_response.dart';
import '../../network/response/profile_response.dart';
import '../../routes/app_pages.dart';
import '../../utils/alerts.dart';
import '../../utils/app_snackbar.dart';
import '../../utils/custom_loader.dart';
import '../../services/booking_live_socket_service.dart';
import '../../services/driver_dashboard_socket_service.dart';
import '../../services/onesignal_service.dart';
import '../../utils/pref.dart';
import '../auth/auth_controller.dart';
import '../auth/auth_entry_navigation.dart';
import '../../utils/validator.dart';
import '../../services/legal_pages_cache_service.dart';
import '../../network/response/legal_page_response.dart';
import '../../utils/legal_pages_navigation.dart';
import '../../widgets/text.dart';
import '../../widgets/widgets.dart';
import '../driver_dashboard/driver_dashboard_controller.dart';

class DriverSettingsController extends GetxController {
  late final AuthRepository _authRepository;
  final DashRepository _dashRepository = DashRepository();

  final firstNameController = TextEditingController();
  final lastNameController = TextEditingController();
  final emailController = TextEditingController();
  final phoneController = TextEditingController();

  String? profileImagePath;
  bool isProfileLoading = false;
  final RxBool isLoggingOut = false.obs;
  final notifications = <NotificationItem>[].obs;
  final RxBool isNotificationsLoading = false.obs;
  final RxBool isNotificationsLoadingMore = false.obs;
  final RxBool notificationsHasMore = true.obs;
  final RxString notificationsError = ''.obs;
  int _notificationsPage = 0;
  static const int _notificationsLimit = 20;
  final RxBool isSavingProfile = false.obs;
  final RxBool isDownloadingEarningsStatement = false.obs;

  @override
  void onInit() {
    super.onInit();
    if (!Get.isRegistered<AuthRepository>()) {
      Get.lazyPut<AuthRepository>(() => AuthRepository(), fenix: true);
    }
    _authRepository = Get.find<AuthRepository>();
    unawaited(
      Get.find<LegalPagesCacheService>().ensurePrefetched(
        audience: LegalAudience.provider,
      ),
    );
    loadDriverProfile();
    unawaited(loadNotifications());
  }

  void openNotifications() => Get.toNamed(Routes.DRIVER_NOTIFICATIONS);

  Future<void> loadNotifications({bool refresh = false}) async {
    if (refresh) {
      notificationsError.value = '';
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
        if (nextPage == 1) {
          notifications.clear();
        }
        notificationsError.value = err.message;
      },
    );
    isNotificationsLoading.value = false;
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

  void openProfileSettings() => Get.toNamed(Routes.DRIVER_PROFILE_SETTINGS);

  void openPaymentMethods() => Get.toNamed(Routes.DRIVER_PAYMENT_METHOD);

  void openWallet() {
    Get.find<DriverDashboardController>().homeNavIndex.value = 2;
  }

  void openBookingHistory() {
    final dash = Get.find<DriverDashboardController>();
    dash.setBookingsFilter('completed');
    dash.homeNavIndex.value = 1;
  }

  void openTutorial() {
    Get.toNamed(
      Routes.TUTORIAL,
      arguments: {
        'from': Routes.DRIVER_PROFILE_SETTINGS,
        'audience': 'provider',
      },
    );
  }

  void openLearning() {
    Get.toNamed(Routes.DRIVER_LEARNING_LIBRARY);
  }

  void showEarningsPrintDialog() {
    final context = Get.context;
    if (context == null) return;
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (sheetContext) {
        return SafeArea(
          top: false,
          child: Container(
            margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
            ),
            padding: const EdgeInsets.fromLTRB(18, 12, 18, 8),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 44,
                    height: 5,
                    decoration: BoxDecoration(
                      color: const Color(0xffD0D0D0),
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                const CommonText.medium(
                  'Earnings Statement',
                  size: 18,
                  color: Color(0xff1B1B1F),
                ),
                const SizedBox(height: 6),
                const CommonText.regular(
                  'Choose the period to include in your PDF.',
                  size: 13,
                  color: Color(0xff6B7280),
                ),
                const SizedBox(height: 12),
                _earningsPeriodTile(
                  sheetContext,
                  label: 'Last 1 week',
                  onTap: () => _downloadEarningsForPreset(sheetContext, 'week'),
                ),
                _earningsPeriodTile(
                  sheetContext,
                  label: 'Last 1 month',
                  onTap: () =>
                      _downloadEarningsForPreset(sheetContext, 'month'),
                ),
                _earningsPeriodTile(
                  sheetContext,
                  label: 'Last 1 year',
                  onTap: () => _downloadEarningsForPreset(sheetContext, 'year'),
                ),
                _earningsPeriodTile(
                  sheetContext,
                  label: 'Select dates',
                  onTap: () => _pickCustomEarningsRange(sheetContext),
                ),
                TextButton(
                  onPressed: () => Navigator.of(sheetContext).pop(),
                  child: CommonText.medium(
                    'Cancel',
                    size: 15,
                    color: context.colorScheme.primary,
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _earningsPeriodTile(
    BuildContext context, {
    required String label,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: AppCard(
        borderColor: Colors.grey,
        borderWidth: 1,
        child: Row(
          children: [
            Expanded(
              child: CommonText.medium(
                label,
                size: 15,
                color: const Color(0xff1B1B1F),
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: Color(0xff9CA3AF)),
          ],
        ).paddingAll(8),
      ).marginSymmetric(vertical: 4),
    );
  }

  Future<void> _downloadEarningsForPreset(
    BuildContext sheetContext,
    String period,
  ) async {
    Navigator.of(sheetContext).pop();
    await downloadEarningsStatement(period: period);
  }

  Future<void> _pickCustomEarningsRange(BuildContext sheetContext) async {
    Navigator.of(sheetContext).pop();
    final context = Get.context;
    if (context == null) return;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: today,
      initialDateRange: DateTimeRange(
        start: today.subtract(const Duration(days: 30)),
        end: today,
      ),
      helpText: 'Select statement period',
    );
    if (picked == null) return;
    await downloadEarningsStatement(
      from: _formatEarningsDate(picked.start),
      to: _formatEarningsDate(picked.end),
    );
  }

  String _formatEarningsDate(DateTime date) {
    final y = date.year.toString().padLeft(4, '0');
    final m = date.month.toString().padLeft(2, '0');
    final d = date.day.toString().padLeft(2, '0');
    return '$y-$m-$d';
  }

  String _earningsStatementFileKey({String? period, String? from, String? to}) {
    if (from != null && to != null) return '$from-$to';
    if (period != null && period.isNotEmpty) return 'last-$period';
    return DateTime.now().year.toString();
  }

  Future<void> downloadEarningsStatement({
    String? period,
    String? from,
    String? to,
    int? year,
  }) async {
    if (isDownloadingEarningsStatement.value) return;
    isDownloadingEarningsStatement.value = true;
    try {
      final result = await _dashRepository.downloadDriverEarningsStatement(
        period: period,
        from: from,
        to: to,
        year: year,
      );
      switch (result) {
        case NetworkSuccess<List<int>>(:final data):
          final fileKey = _earningsStatementFileKey(
            period: period,
            from: from,
            to: to,
          );
          await saveAndOpenPdfFile(
            bytes: data,
            fileName: 'car-comfort-earnings-$fileKey.pdf',
            shareSubject: 'Car Comfort Earnings Statement',
            shareText:
                'Car Comfort service provider earnings statement ($fileKey).',
          );
        case NetworkError<List<int>>(:final error):
          showAppSnackBar(
            title: 'Download failed',
            message: error.message,
            isError: true,
          );
      }
    } finally {
      isDownloadingEarningsStatement.value = false;
    }
  }

  void openSupport() => Get.toNamed(Routes.DRIVER_SUPPORT);

  void openPrivacy() => Get.toNamed(Routes.PRIVACY_POLICY);
  void openTermsCondition() => Get.toNamed(Routes.TERMS_CONDITION);

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

  Future<void> loadDriverProfile() async {
    isProfileLoading = true;
    update();

    final result = await _authRepository.getDriverMe();
    if (isClosed) return;

    isProfileLoading = false;

    result.when(
      success: (res) {
        if (isClosed) return;
        final ProfileUser? user = res.data?.user;
        final DriverProfile? profile = res.data?.driverProfile;

        final parsedNames = _splitName(user?.name ?? '');
        firstNameController.text = parsedNames.$1;
        lastNameController.text = parsedNames.$2;
        emailController.text = user?.email ?? '';
        phoneController.text = normalizePhoneLocalDigits(user?.phone ?? '');
        if (parsedNames.$1.isNotEmpty) {
          Prefs().putData(Prefs.firstName, parsedNames.$1);
        }
        Prefs().putData(Prefs.lastName, parsedNames.$2);
        if ((profile?.profilePicture ?? '').isNotEmpty) {
          final image = profile?.profilePicture?.trim() ?? '';
          profileImagePath = image;
          Prefs().putData(Prefs.image, image);
        }
        if (Get.isRegistered<DriverDashboardController>()) {
          Get.find<DriverDashboardController>().refreshProfileHeader();
        }
        update();
      },
      error: (err) {
        if (isClosed) return;
        update();
        showAppSnackBar(title: 'Profile', message: err.message, isError: true);
      },
    );
  }

  (String, String) _splitName(String fullName) {
    final clean = fullName.trim();
    if (clean.isEmpty) return ('', '');
    final parts = clean.split(RegExp(r'\s+'));
    final first = parts.first;
    final last = parts.length > 1 ? parts.sublist(1).join(' ') : '';
    return (first, last);
  }

  Future<void> saveDriverProfile() async {
    final firstName = firstNameController.text.trim();
    final lastName = lastNameController.text.trim();
    final phone = phoneController.text.trim();

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
    if (phone.isEmpty) {
      _showProfileMessage('Please enter phone number');
      return;
    }
    final phoneError = validatePhoneNumber(phone);
    if (phoneError != null) {
      _showProfileMessage(phoneError);
      return;
    }

    isSavingProfile.value = true;
    update();

    final result = await _authRepository.updateDriverProfile(
      firstName: firstName,
      lastName: lastName,
      phone: phone,
      profilePicturePath: _newProfileImagePath(),
    );

    if (isClosed) return;

    isSavingProfile.value = false;

    result.when(
      success: (res) {
        if (isClosed) return;
        Prefs().putData(Prefs.firstName, firstName);
        Prefs().putData(Prefs.lastName, lastName);
        Prefs().putData(Prefs.phone, phone);
        final updatedImage = profileImagePath?.trim();
        if (updatedImage != null &&
            updatedImage.isNotEmpty &&
            updatedImage.startsWith('http')) {
          Prefs().putData(Prefs.image, updatedImage);
        }
        unawaited(loadDriverProfile());
        if (Get.isRegistered<DriverDashboardController>()) {
          Get.find<DriverDashboardController>().refreshProfileHeader();
        }
        update();
        showAppSnackBar(
          title: 'Profile',
          message: res.message ?? 'Profile updated successfully',
        );
      },
      error: (err) {
        if (isClosed) return;
        update();
        _showProfileMessage(err.message);
      },
    );
  }

  String? _newProfileImagePath() {
    final path = profileImagePath?.trim();
    if (path == null || path.isEmpty) return null;
    if (path.startsWith('http')) return null;
    return path;
  }

  void _showProfileMessage(String message) {
    showAppSnackBar(title: 'Profile', message: message, isError: true);
  }

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

  Future<void> logout() async {
    if (isLoggingOut.value) return;
    isLoggingOut.value = true;
    Loader.showLoading();
    try {
      await _authRepository.logout();
      if (Get.isRegistered<BookingLiveSocketService>()) {
        await Get.find<BookingLiveSocketService>().disconnect();
      }
      if (Get.isRegistered<DriverDashboardSocketService>()) {
        await Get.find<DriverDashboardSocketService>().disconnect();
      }
      final role = readLastAuthRoleFromPrefs();
      await OneSignalService.logout();
      await Prefs().clear();
      if (Get.isRegistered<AuthController>()) {
        Get.find<AuthController>().clearPendingLoginRole();
      }
      navigateToLoginAfterLogout(role: role);
    } finally {
      Loader.hideLoading();
      isLoggingOut.value = false;
    }
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
