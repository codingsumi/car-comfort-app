import 'dart:async';
import 'dart:io';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:get/get.dart';
import 'package:onesignal_flutter/onesignal_flutter.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../network/repository/notification_repository.dart';
import '../network/utils/log_util.dart';
import '../utils/env_service.dart';
import '../utils/network_monitor_service.dart';
import '../utils/pref.dart';
import 'push_booking_notification_handler.dart';

/// OneSignal push setup: call [initialize] from [main], then [syncLoggedInUser]
/// after login / on cold start when a session exists, and [logout] on sign-out.
///
/// **iOS noise:** `NSURLErrorNetworkConnectionLost` (-1005) to `api.onesignal.com/.../subscriptions/...`
/// is often transient (Wi‑Fi/cellular handoff, Simulator, VPN, or first request after launch).
/// Native SDK retries; we defer init slightly after [NetworkMonitorService] and resync when
/// connectivity returns from offline.
class OneSignalService {
  OneSignalService._();

  static bool _initialized = false;
  static Worker? _connectivityWorker;
  static String? _lastRegisteredSubscriptionId;
  static String? _cachedDeviceModel;
  static String? _cachedAppVersion;
  static Future<void>? _registerDeviceFuture;

  static bool get isReady => _initialized;

  static bool _hasUsableAppId(String value) {
    final v = value.trim();
    if (v.isEmpty) return false;
    final n = v.toLowerCase();
    return !n.startsWith('replace_with_') &&
        !n.startsWith('your_') &&
        n != 'changeme' &&
        n != 'todo';
  }

  /// Initializes the OneSignal SDK (iOS / Android only). Uses [EnvService.onesignalAppId]
  /// (`ONESIGNAL_APP_ID`, or legacy `ONESIGNAL_API_KEY` if the value is your App ID).
  static Future<void> initialize() async {
    if (kIsWeb) return;
    if (_initialized) return;

    final appId = EnvService.onesignalAppId;
    if (!_hasUsableAppId(appId)) {
      Alert.log(
        'OneSignalService',
        'OneSignal App ID not configured; push remains disabled.',
      );
      return;
    }

    try {
      if (kDebugMode) {
        await OneSignal.Debug.setLogLevel(OSLogLevel.verbose);
      }
      OneSignal.initialize(appId.trim());

      OneSignal.User.pushSubscription.addObserver((state) {
        _persistSubscription(state);
        unawaited(registerDeviceWithBackend());
      });
      OneSignal.Notifications.addClickListener((event) {
        PushBookingNotificationHandler.handleNotificationOpened(
          event.notification,
        );
      });
      OneSignal.Notifications.addForegroundWillDisplayListener((event) {
        PushBookingNotificationHandler.handleNotificationWillDisplay(event);
      });
      _persistCurrentSubscription();

      _initialized = true;
      _listenForConnectivityResync();
      Alert.log('OneSignalService', 'OneSignal initialized');
      unawaited(requestNotificationPermission());
    } catch (e, st) {
      Alert.log('OneSignalService', 'OneSignal initialize failed: $e\n$st');
    }
  }

  /// When the device was offline at launch, refresh OneSignal user/subscription after going online.
  static void _listenForConnectivityResync() {
    _connectivityWorker?.dispose();
    if (!Get.isRegistered<NetworkMonitorService>()) return;
    _connectivityWorker = ever<bool>(
      NetworkMonitorService.instance.isConnected,
      (online) {
        if (!online || !_initialized) return;
        unawaited(syncLoggedInUser());
        unawaited(registerDeviceWithBackend());
      },
    );
  }

  static void _persistCurrentSubscription() {
    final id = OneSignal.User.pushSubscription.id;
    final token = OneSignal.User.pushSubscription.token;
    if (token != null && token.isNotEmpty) {
      Prefs().putData(Prefs.oneSignToken, token);
    } else if (id != null && id.isNotEmpty) {
      Prefs().putData(Prefs.oneSignToken, id);
    }
  }

  static void _persistSubscription(OSPushSubscriptionChangedState state) {
    final token = state.current.token;
    final id = state.current.id;
    print(
      "_persistSubscription_persistSubscription ${id}\n${OneSignal.User.pushSubscription.id.toString()}",
    );
    if (token != null && token.isNotEmpty) {
      Prefs().putData(Prefs.oneSignToken, token);
    } else if (id != null && id.isNotEmpty) {
      Prefs().putData(Prefs.oneSignToken, id);
    }
  }

  /// Associates the device with the logged-in user (external id = your backend user id).
  static Future<void> syncLoggedInUser() async {
    if (kIsWeb || !_initialized) return;
    final id = Prefs().userId().trim();
    if (id.isEmpty) return;
    try {
      await OneSignal.login(id);
      OneSignal.User.addEmail(Prefs().userEmail());

      if (!(OneSignal.User.pushSubscription.optedIn ?? true)) {
        OneSignal.User.pushSubscription.optIn();
      }
      await registerDeviceWithBackend();
    } catch (e) {
      Alert.log('OneSignalService', 'OneSignal.login failed: $e');
    }
  }

  static Future<void> registerDeviceWithBackend() {
    if (_registerDeviceFuture != null) return _registerDeviceFuture!;
    _registerDeviceFuture = _registerDeviceWithBackend().whenComplete(() {
      _registerDeviceFuture = null;
    });
    return _registerDeviceFuture!;
  }

  /// Returns a human-readable device model string, e.g. "Samsung Galaxy S24" or "iPhone 15 Pro".
  static Future<String?> _getDeviceModel() async {
    if (_cachedDeviceModel != null) return _cachedDeviceModel;
    try {
      final info = DeviceInfoPlugin();
      if (Platform.isAndroid) {
        final d = await info.androidInfo;
        _cachedDeviceModel =
            '${d.manufacturer} ${d.model}'.trim();
      } else if (Platform.isIOS) {
        final d = await info.iosInfo;
        _cachedDeviceModel = d.utsname.machine.trim();
        if (_cachedDeviceModel!.isEmpty) {
          _cachedDeviceModel = d.model.trim();
        }
      }
    } catch (_) {}
    return _cachedDeviceModel;
  }

  static Future<String?> _getAppVersion() async {
    if (_cachedAppVersion != null) return _cachedAppVersion;
    try {
      final info = await PackageInfo.fromPlatform();
      _cachedAppVersion = '${info.version}+${info.buildNumber}';
    } catch (_) {}
    return _cachedAppVersion;
  }

  static Future<void> _registerDeviceWithBackend() async {
    if (kIsWeb || !_initialized) return;
    if (Prefs().token().trim().isEmpty) return;

    final oneSignalId = OneSignal.User.pushSubscription.id?.trim();
    if (oneSignalId == null || oneSignalId.isEmpty) return;
    if (_lastRegisteredSubscriptionId == oneSignalId) return;

    final platform = defaultTargetPlatform == TargetPlatform.android
        ? 'android'
        : defaultTargetPlatform == TargetPlatform.iOS
        ? 'ios'
        : '';
    if (platform.isEmpty) return;

    final deviceModel = await _getDeviceModel();
    final appVersion = await _getAppVersion();

    try {
      final result = await NotificationRepository().registerDevice(
        oneSignalId: oneSignalId,
        platform: platform,
        deviceModel: deviceModel,
        appVersion: appVersion,
      );
      result.when(
        success: (_) {
          _lastRegisteredSubscriptionId = oneSignalId;
          Alert.log(
            'OneSignalService',
            'Registered OneSignal subscription with backend.',
          );
        },
        error: (error) {
          Alert.log('OneSignalService', 'Register device failed: $error');
        },
      );
    } catch (e, st) {
      Alert.log('OneSignalService', 'Register device failed: $e\n$st');
    }
  }

  /// Clears the OneSignal user session (call before clearing local prefs on logout).
  static Future<void> logout() async {
    if (kIsWeb || !_initialized) return;
    try {
      await OneSignal.logout();
      await Prefs().removeData(Prefs.oneSignToken);
      _lastRegisteredSubscriptionId = null;
    } catch (e) {
      Alert.log('OneSignalService', 'OneSignal.logout failed: $e');
    }
  }

  /// Optional: show the system notification permission prompt.
  static Future<bool> requestNotificationPermission({
    bool fallbackToSettings = true,
  }) async {
    if (kIsWeb || !_initialized) return false;
    try {
      return await OneSignal.Notifications.requestPermission(
        fallbackToSettings,
      );
    } catch (e) {
      Alert.log('OneSignalService', 'requestPermission failed: $e');
      return false;
    }
  }
}
