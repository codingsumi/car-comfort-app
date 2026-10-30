import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:get/get.dart';

import '../../network/repository/auth_repository.dart';
import '../../network/utils/network_exception.dart';
import '../../network/repository/service_repository.dart';
import '../../network/response/profile_response.dart';
import '../../routes/app_pages.dart';
import '../../services/maintenance_service.dart';
import '../../services/onesignal_service.dart';
import '../../utils/pref.dart';
import '../../utils/driver_onboarding_progress.dart';
import '../../utils/driver_tutorial_navigation.dart';
import '../../utils/role_switch_service.dart';
import '../../utils/vehicle_types_cache.dart';
import '../../services/legal_pages_cache_service.dart';
import '../../network/response/legal_page_response.dart';
import '../auth/auth_entry_navigation.dart';

class SplashController extends GetxController {
  final _serviceRepo = ServiceRepository();
  final _authRepo = AuthRepository();

  @override
  void onInit() {
    super.onInit();
    unawaited(_bootstrap());
  }

  Future<void> _bootstrap() async {
    final started = DateTime.now();
    unawaited(OneSignalService.syncLoggedInUser());
    unawaited(VehicleTypesCache.syncFromApi());
    unawaited(_prefetchLegalPages());

    final maintenance = await MaintenanceService.to.fetchStatus();

    const minSplash = Duration(seconds: 2);
    final elapsed = DateTime.now().difference(started);
    if (elapsed < minSplash) {
      await Future<void>.delayed(minSplash - elapsed);
    }

    if (maintenance != null) {
      MaintenanceService.to.showMaintenanceScreen(maintenance);
      return;
    }

    unawaited(_syncServices());

    final token = Prefs().token().trim();
    final role = Prefs().getData(Prefs.role).trim().toLowerCase();

    if (token.isEmpty) {
      navigateToRoleSelection();
      return;
    }

    // The PWA is customer-only. A token from a prior mobile driver session
    // must not open or retain access to the web application.
    if (kIsWeb && role == 'driver') {
      await Prefs().clear();
      navigateToRoleSelection();
      return;
    }

    if (role == 'driver') {
      final driverRoute = await _driverStartupRoute();
      // null means the token was rejected — already cleared, go to login.
      if (driverRoute == null) {
        navigateToRoleSelection();
        return;
      }
      if (driverRoute == Routes.APPROVAL_PROCESS_REVIEW) {
        final switched =
            await RoleSwitchService.preferCustomerOverUnapprovedDriver();
        if (switched) return;
      }
      DriverTutorialNavigation.offAllTo(driverRoute);
      return;
    }

    // Validate the customer token before routing to dashboard.
    // On iOS, Keychain persists across reinstalls — a stale token from a
    // previous install can pass the isEmpty check while GetStorage (role,
    // profile fields) has been wiped, resulting in a broken dashboard state.
    final customerRoute = await _customerStartupRoute();
    if (customerRoute == null) {
      navigateToRoleSelection();
      return;
    }
    _offAllNamed(customerRoute);
  }

  /// Navigate to [route] clearing the back stack.
  /// On web (router-delegate mode) [Get.offAllNamed] throws because
  /// [onGenerateRoute] is null; use [Get.rootDelegate.offNamed] instead.
  void _offAllNamed(String route) {
    if (kIsWeb) {
      Get.rootDelegate.offNamed(route);
    } else {
      Get.offAllNamed(route);
    }
  }

  Future<String?> _customerStartupRoute() async {
    final meResult = await _authRepo.getCustomerMe();
    bool isAuthFailure = false;

    meResult.when(
      success: (res) {
        final user = res.data?.user;
        if (user == null) return;
        // Re-sync all profile fields into GetStorage so the dashboard
        // has a complete profile state even after a fresh install wipes GetStorage.
        Prefs().putData(Prefs.role, user.role ?? 'customer');
        Prefs().putData(Prefs.id, user.id?.toString() ?? '');
        Prefs().putData(Prefs.email, user.email ?? '');
        Prefs().putData(Prefs.phone, user.phone ?? '');
        if (user.profilePicture != null) {
          Prefs().putData(Prefs.image, user.profilePicture!);
        }
        if (user.name != null && user.name!.isNotEmpty) {
          final parts = user.name!.split(' ');
          Prefs().putData(Prefs.firstName, parts.first);
          Prefs().putData(
            Prefs.lastName,
            parts.length > 1 ? parts.sublist(1).join(' ') : '',
          );
        }
        final roleId = (user.role?.toLowerCase() == 'customer') ? '1' : '';
        Prefs().putData(Prefs.roleId, roleId);
      },
      error: (err) {
        if (err is UnauthorizedRequestException) {
          isAuthFailure = true;
        }
      },
    );

    if (isAuthFailure) {
      Prefs().putData(Prefs.userToken, '');
      Prefs().putData(Prefs.role, '');
      return null; // caller sends to WELCOME
    }

    // Network error (not auth) — token is likely valid; allow through to
    // dashboard so offline users are not locked out on poor connectivity.
    return Routes.DASHBOARD;
  }

  Future<void> _prefetchLegalPages() async {
    if (!Get.isRegistered<LegalPagesCacheService>()) return;
    final token = Prefs().token().trim();
    final audience = token.isEmpty
        ? LegalAudience.customer
        : LegalAudience.forCurrentUser();
    await Get.find<LegalPagesCacheService>().ensurePrefetched(
      audience: audience,
    );
  }

  Future<void> _syncServices() async {
    final now = DateTime.now().millisecondsSinceEpoch;
    final lastSync = Prefs().getLastServicesSync();
    final localList = Prefs().getServicesList().trim();

    // Sync if 2 hours have passed, or the local list is empty/unset
    if (now - lastSync > 7200000 || localList.isEmpty || localList == '[]') {
      final res = await _serviceRepo.getServices();
      res.when(
        success: (data) {
          Prefs().putServicesList(
            jsonEncode(data.map((e) => e.toJson()).toList()),
          );
          Prefs().putLastServicesSync(now);
        },
        error: (e) {
          // Ignore error silently to not block splash
        },
      );
    }
  }

  Future<String?> _driverStartupRoute() async {
    final meResult = await _authRepo.getDriverMe();
    ProfileResponse? profile;
    bool isAuthFailure = false;

    meResult.when(
      success: (res) {
        profile = res;
        persistDriverOnboardingPrefs(res);
      },
      error: (err) {
        // 401/403 means the token is invalid — treat as unauthenticated.
        if (err is UnauthorizedRequestException) {
          isAuthFailure = true;
        }
      },
    );

    // Token is invalid/expired — clear session and send to login.
    if (isAuthFailure) {
      Prefs().putData(Prefs.userToken, '');
      Prefs().putData(Prefs.role, '');
      return null; // caller sends to WELCOME
    }

    if (profile != null) {
      return driverOnboardingRouteForProfile(
        profile: profile!,
        isApproved: Prefs().isDriverApproved,
      );
    }

    // Network error (not auth) — fall back to cached state only.
    final saved =
        int.tryParse(Prefs().getData(Prefs.driverCurrentStep).trim()) ?? 0;
    return driverOnboardingRouteFromPrefs(
      savedStep: saved,
      onboardingComplete: Prefs().getBool(Prefs.driverOnboardingComplete),
      isApproved: Prefs().isDriverApproved,
    );
  }
}
