import 'dart:async';

import 'package:geolocator/geolocator.dart';
import 'package:get/get.dart';
import 'package:flutter/widgets.dart';

import '../network/repository/auth_repository.dart';
import '../network/response/login_response.dart';
import '../network/utils/network_exception.dart';
import '../routes/app_pages.dart';
import '../services/booking_live_socket_service.dart';
import '../services/driver_dashboard_socket_service.dart';
import '../services/onesignal_service.dart';
import '../utils/alerts.dart';
import '../utils/app_snackbar.dart';
import '../utils/custom_loader.dart';
import '../utils/driver_onboarding_progress.dart';
import '../utils/pref.dart';
import '../utils/extensions/extension.dart';
import '../utils/role_switch_signup_flow.dart';
import '../utils/vehicle_types_cache.dart';

/// Switches between linked customer and driver accounts for the same identity.
class RoleSwitchService {
  RoleSwitchService._();

  static bool get canReturnToCustomerDashboard =>
      Prefs().getRememberBool(Prefs.roleSwitchPendingCustomerReturn);

  static void _setPendingCustomerReturn(bool value) {
    Prefs().putRememberBool(Prefs.roleSwitchPendingCustomerReturn, value);
  }

  static void clearPendingCustomerReturn() {
    _setPendingCustomerReturn(false);
  }

  /// Login / splash: use customer dashboard when driver exists but is not approved.
  static Future<bool> preferCustomerOverUnapprovedDriver() async {
    if (Prefs().userRole() != 'driver') return false;

    // Ensure the secure-storage token cache is warm before making authenticated
    // API calls. token() returns an in-memory cached value that may be empty if
    // this is called early in the startup flow or immediately after login.
    await Prefs().tokenAsync();
    if (Prefs().token().trim().isEmpty) return false;

    final repo = AuthRepository();
    if (!await _hasLinkedCustomerRole(repo)) return false;
    if (await _isCurrentDriverApproved(repo)) return false;

    return returnToCustomerDashboard(silent: true);
  }

  static Future<bool> returnToCustomerDashboard({bool silent = false}) async {
    if (!canReturnToCustomerDashboard && !silent) return false;

    Loader.showLoading();
    try {
      await _disconnectLiveSessions();
      final pos = await _currentLocation();
      final repo = AuthRepository();
      final result = await repo.switchRole(
        role: 'customer',
        latitude: pos?.latitude,
        longitude: pos?.longitude,
      );
      Loader.hideLoading();

      var switched = false;
      result.when(
        success: (response) {
          switched = true;
          RoleSwitchSignupFlow.complete();
          clearPendingCustomerReturn();
          _storeSession(response);
          Prefs().putRememberData(Prefs.lastActiveRole, 'customer');
          unawaited(OneSignalService.syncLoggedInUser());
          Get.offAllNamed(Routes.DASHBOARD);
        },
        error: (err) {
          if (!silent) {
            showAppSnackBar(
              title: 'Account',
              message: err.message,
              isError: true,
            );
          }
        },
      );
      return switched;
    } catch (_) {
      Loader.hideLoading();
      return false;
    }
  }

  static Future<bool> _hasLinkedCustomerRole(AuthRepository repo) async {
    final result = await repo.getAvailableRoles();
    var hasCustomer = false;
    result.when(
      success: (res) {
        final raw = res.data;
        if (raw is! Map) return;
        final roles = raw['available_roles'];
        if (roles is! List) return;
        hasCustomer = roles.any(
          (r) => r.toString().trim().toLowerCase() == 'customer',
        );
      },
      error: (_) {},
    );
    return hasCustomer;
  }

  static Future<bool> _isCurrentDriverApproved(AuthRepository repo) async {
    final meResult = await repo.getDriverMe();
    var approved = false;
    meResult.when(
      success: (profile) {
        approved = profile.data?.driverProfile?.isApproved == true;
        final status = profile.data?.driverProfile?.approvalStatus
            ?.trim()
            .toLowerCase();
        if (status != null && status.isNotEmpty) {
          Prefs().putData(Prefs.driverApprovalStatus, status);
        }
        persistDriverOnboardingPrefs(profile);
      },
      error: (_) {},
    );
    return approved;
  }

  static Future<void> useAsCustomer() => _switchTo('customer');

  static Future<void> useAsDriver() => _switchTo('driver');

  static Future<void> _switchTo(String targetRole) async {
    final current = Prefs().userRole();
    if (current == targetRole) {
      showAppSnackBar(
        title: 'Account',
        message: targetRole == 'customer'
            ? 'You are already using the customer app.'
            : 'You are already using the driver app.',
      );
      return;
    }

    final switchingFromCustomerToDriver =
        current == 'customer' && targetRole == 'driver';
    if (!switchingFromCustomerToDriver) {
      clearPendingCustomerReturn();
    }

    Loader.showLoading();
    try {
      await _disconnectLiveSessions();
      final pos = await _currentLocation();
      final repo = AuthRepository();
      final result = await repo.switchRole(
        role: targetRole,
        latitude: pos?.latitude,
        longitude: pos?.longitude,
      );

      Loader.hideLoading();

      result.when(
        success: (response) {
          unawaited(
            _completeSwitch(
              response,
              targetRole,
              repo,
              switchingFromCustomerToDriver: switchingFromCustomerToDriver,
            ).catchError((Object e) {
              debugPrint('RoleSwitchService: _completeSwitch failed: $e');
            }),
          );
        },
        error: (err) {
          if (_isMissingLinkedAccount(err)) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              _promptSignupForRole(targetRole);
            });
            return;
          }
          showAppSnackBar(
            title: 'Switch account',
            message: err.message,
            isError: true,
          );
        },
      );
    } catch (e) {
      Loader.hideLoading();
      showAppSnackBar(
        title: 'Switch account',
        message: 'Unable to switch account. Please try again.',
        isError: true,
      );
    }
  }

  static Future<void> _completeSwitch(
    LoginResponse response,
    String targetRole,
    AuthRepository repo, {
    bool switchingFromCustomerToDriver = false,
  }) async {
    RoleSwitchSignupFlow.complete();
    _storeSession(response);
    await OneSignalService.syncLoggedInUser();
    unawaited(VehicleTypesCache.syncFromApi(force: true));
    await _routeAfterSwitch(
      targetRole,
      repo,
      switchingFromCustomerToDriver: switchingFromCustomerToDriver,
    );
  }

  static bool _isMissingLinkedAccount(NetworkException err) {
    if (err is NotFoundException) return true;
    final msg = err.message.toLowerCase();
    return msg.contains('signup') || msg.contains('no customer account') ||
        msg.contains('no service provider account');
  }

  static void _promptSignupForRole(String targetRole) {
    final isDriver = targetRole == 'driver';
    showAlertDialog(
      isDriver ? 'Service provider account' : 'Customer account',
      content: isDriver
          ? 'You do not have a service provider account yet. Complete service provider signup to switch.'
          : 'You do not have a customer account yet. Complete customer signup to switch.',
      secondaryText: 'Cancel',
      primaryText: 'Continue',
      canDismiss: true,
      secondaryClick: () => Get.back(),
      primaryClick: () {
        Get.back();
        RoleSwitchSignupFlow.begin(returnRole: Prefs().userRole());
        final args = <String, String>{
          'email': Prefs().userEmail(),
          'phone': Prefs().getData(Prefs.phone),
          'fromRoleSwitch': 'true',
        };
        if (isDriver) {
          Get.toNamed(Routes.DRIVERREGISTER, arguments: args);
        } else {
          Get.toNamed(Routes.REGISTER, arguments: args);
        }
      },
    );
  }

  static Future<void> _routeAfterSwitch(
    String targetRole,
    AuthRepository repo, {
    bool switchingFromCustomerToDriver = false,
  }) async {
    if (targetRole == 'driver') {
      final meResult = await repo.getDriverMe();
      meResult.when(
        success: (profile) {
          persistDriverOnboardingPrefs(profile);
          final approvalStatus =
              profile.data?.driverProfile?.approvalStatus?.trim().toLowerCase() ??
              '';
          if (approvalStatus.isNotEmpty) {
            Prefs().putData(Prefs.driverApprovalStatus, approvalStatus);
          }
          final isApproved = profile.data?.driverProfile?.isApproved == true;
          final nextRoute = driverOnboardingRouteForProfile(
            profile: profile,
            isApproved: isApproved,
          );
          if (switchingFromCustomerToDriver &&
              nextRoute == Routes.APPROVAL_PROCESS_REVIEW) {
            _setPendingCustomerReturn(true);
          } else {
            clearPendingCustomerReturn();
          }
          Get.offAllNamed(nextRoute);
        },
        error: (_) {
          if (switchingFromCustomerToDriver) {
            _setPendingCustomerReturn(true);
          }
          Prefs().putData(Prefs.driverCompletedSteps, '0');
          Get.offAllNamed(Routes.APPROVAL_PROCESS_REVIEW);
        },
      );
      return;
    }

    clearPendingCustomerReturn();
    Get.offAllNamed(Routes.DASHBOARD);
  }

  static void _storeSession(LoginResponse rawData) {
    final data = rawData.data;
    final user = data?.user;

    if (data?.token.isNullOrEmpty == false) {
      Prefs().putData(Prefs.userToken, data?.token ?? '');
    }

    Prefs().putData(Prefs.id, user?.id?.toString() ?? '');
    Prefs().putData(Prefs.email, user?.email ?? '');
    Prefs().putData(Prefs.phone, user?.phone ?? '');
    Prefs().putData(Prefs.role, user?.role ?? '');
    Prefs().putRememberData(Prefs.lastActiveRole, user?.role ?? '');

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
  }

  static Future<void> _disconnectLiveSessions() async {
    if (Get.isRegistered<BookingLiveSocketService>()) {
      await Get.find<BookingLiveSocketService>().disconnect();
    }
    if (Get.isRegistered<DriverDashboardSocketService>()) {
      await Get.find<DriverDashboardSocketService>().disconnect();
    }
  }

  static Future<Position?> _currentLocation() async {
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
}
