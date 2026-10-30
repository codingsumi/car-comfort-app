import 'dart:async';
import 'dart:convert';

import 'package:flutter/cupertino.dart';
import 'package:flutter/scheduler.dart';
import 'package:get/get.dart';
import 'package:onesignal_flutter/onesignal_flutter.dart';

import '../constants/booking_tracking_status.dart';
import '../modules/dashboard/dashboard_booking_timer.dart';
import '../modules/dashboard/dashboard_controller.dart';
import '../routes/app_pages.dart';
import '../services/booking_live_socket_service.dart';
import '../utils/notification_navigation.dart';
import '../utils/pref.dart';
import '../network/utils/log_util.dart';
import '../modules/driver_dashboard/driver_dashboard_controller.dart';

/// Handles OneSignal notification opens that carry booking deep-link data
/// (e.g. `custom.a.booking_id` for [kind] like `BOOKING_ACCEPTED`).
class PushBookingNotificationHandler {
  PushBookingNotificationHandler._();

  static const int _maxDeferredAttempts = 8;
  static const Duration _deferredStep = Duration(milliseconds: 350);

  // ── Cold-start / deferred notification queue ───────────────────────────────
  // When handleNotificationOpened fires before auth is restored (cold start),
  // we save the notification and replay it once replayPendingNotification() is
  // called (e.g. from the dashboard after the user token is confirmed).
  static OSNotification? _pendingNotification;

  /// Call this once the user session is restored (token available) to replay
  /// any notification that arrived before auth was ready.
  static void replayPendingNotification() {
    final pending = _pendingNotification;
    if (pending == null) return;
    _pendingNotification = null;
    Alert.log('PushBooking', 'Replaying cold-start notification');
    handleNotificationOpened(pending);
  }

  /// Foreground (and will-display): start customer live socket / `join_booking` when
  /// `kind` is `TRACKING_UPDATE` and `tracking_status` is a known [BookingTrackingStatus] code.
  static void handleNotificationWillDisplay(
    OSNotificationWillDisplayEvent event,
  ) {
    maybeStartCustomerLiveTrackingFromTrackingPush(event.notification);
    // OneSignal 5.x: registering a ForegroundWillDisplayListener suppresses
    // the notification by default. Explicitly call display() so the
    // notification (and its icon) always appears in the status bar /
    // notification shade while the app is in the foreground.
    event.notification.display();
  }

  static void handleNotificationOpened(OSNotification notification) {
    if (Prefs().token().trim().isEmpty) {
      // App opened cold from a tapped notification before the session token
      // is restored. Park it and replay once the session is ready.
      _pendingNotification = notification;
      Alert.log('PushBooking', 'Token not ready — queuing notification for replay');
      return;
    }

    final kind = extractKind(notification)?.trim().toUpperCase();
    final payloadUserId = extractUserId(notification)?.trim();
    final myId = Prefs().userId().trim();
    if (payloadUserId != null &&
        payloadUserId.isNotEmpty &&
        myId.isNotEmpty &&
        payloadUserId != myId) {
      Alert.log(
        'PushBooking',
        'Skip deep link: notification user_id=$payloadUserId, session=$myId',
      );
      return;
    }

    if (kind == 'DRIVER_PROFILE_APPROVED' ||
        kind == 'DRIVER_PROFILE_REJECTED') {
      _scheduleNavigate(() {
        if (kind == 'DRIVER_PROFILE_APPROVED') {
          Prefs().putData(Prefs.driverApprovalStatus, 'approved');
          Get.offAllNamed(Routes.DRIVER_DASHBOARD);
        } else {
          Prefs().putData(Prefs.driverApprovalStatus, 'rejected');
          Get.offAllNamed(Routes.APPROVAL_PROCESS_REVIEW);
        }
      });
      return;
    }

    if (kind == 'DRIVER_LICENSE_EXPIRING' ||
        kind == 'DRIVER_LICENSE_EXPIRED' ||
        kind == 'DRIVER_LICENSE_EXPIRING_SOON') {
      _scheduleNavigate(() {
        if (Get.isRegistered<DashboardController>()) {
          final dashboard = Get.find<DashboardController>();
          unawaited(dashboard.refreshDriverLicenseCompliance().catchError((Object e) {
            debugPrint('PushBooking: refreshDriverLicenseCompliance failed: $e');
          }));
          if (kind == 'DRIVER_LICENSE_EXPIRED') {
            dashboard.openDriverLicenseRenewal();
            return;
          }
        }
        Get.offAllNamed(Routes.DRIVER_DASHBOARD);
      });
      return;
    }

    if (NotificationNavigation.isDriverWalletKind(kind)) {
      _scheduleNavigate(NotificationNavigation.openDriverWallet);
      return;
    }

    // BOOKING_ASSIGNED_DRIVER: backend sends this to the driver after they accept
    // a booking. acceptDriverBooking() already navigates to DRIVER_SERVICE_DETAIL,
    // so tapping this push must NOT push a second copy of that screen.
    // Just refresh the service detail if the controller is available.
    if (kind == 'BOOKING_ASSIGNED_DRIVER') {
      _scheduleNavigate(() {
        if (!Get.isRegistered<DashboardController>()) return;
        final c = Get.find<DashboardController>();
        final bookingId = extractBookingId(notification);
        if (bookingId != null && bookingId > 0) {
          unawaited(c.fetchServiceDetail(bookingId: bookingId, force: true).catchError((Object e) {
            debugPrint('PushBooking: fetchServiceDetail (BOOKING_ASSIGNED_DRIVER) failed: $e');
          }));
        }
        // Only navigate if not already on the service detail screen
        if (Get.currentRoute != Routes.DRIVER_SERVICE_DETAIL && Prefs().isDriverRole) {
          final bookingCode = extractBookingCode(notification);
          Get.toNamed(
            Routes.DRIVER_SERVICE_DETAIL,
            arguments: {
              'bookingId': bookingId,
              if (bookingCode != null && bookingCode.isNotEmpty) 'bookingCode': bookingCode,
            },
          );
        }
      });
      return;
    }

    if (NotificationNavigation.isSupportTicketKind(kind)) {
      final ticketId = extractTicketId(notification);
      if (ticketId != null && ticketId > 0) {
        _scheduleNavigate(() {
          NotificationNavigation.openSupportTicketDetail(ticketId: ticketId);
        });
        return;
      }
    }

    // NEW_BOOKING_ALERT: provider tapped a "new job nearby" push.
    // Refresh the job board and navigate to the driver dashboard home tab
    // so they see the available booking immediately — even from closed/background.
    if (kind == 'NEW_BOOKING_ALERT' || kind == 'new_booking_available') {
      _scheduleNavigate(() {
        if (Get.currentRoute != Routes.DRIVER_DASHBOARD) {
          Get.offAllNamed(Routes.DRIVER_DASHBOARD);
        }
        if (!Get.isRegistered<DashboardController>()) return;
        final c = Get.find<DashboardController>();
        // Refresh job board so the new booking appears immediately
        unawaited(c.fetchDriverNearbyUnassignedBookings(refresh: true).catchError((Object e) {
          debugPrint('PushBooking: fetchDriverNearbyUnassignedBookings failed: $e');
        }));
        unawaited(c.reconcileDriverHomeBookingState().catchError((Object e) {
          debugPrint('PushBooking: reconcileDriverHomeBookingState failed: $e');
        }));
      });
      return;
    }

    final bookingId = extractBookingId(notification);
    if (bookingId == null || bookingId <= 0) {
      Alert.log(
        'PushBooking',
        'Open notification: no booking_id (additionalData / rawPayload).',
      );
      return;
    }

    maybeStartCustomerLiveTrackingFromTrackingPush(notification);

    if (kind == 'CUSTOMER_SERVICE_MILESTONE') {
      final openInvoice = _truthy(notification, 'open_invoice');
      final openBilling = _truthy(notification, 'open_billing_history') ||
          _truthy(notification, 'show_billing');
      final milestone = _milestoneFrom(notification);
      _scheduleNavigate(() {
        // Service complete: navigate directly to the booking invoice page so
        // the customer can view after-service photos and download the invoice.
        if (openInvoice && bookingId > 0) {
          NotificationNavigation.openCustomerInvoiceDetail(
            bookingId: bookingId,
          );
          return;
        }
        // Legacy fallback: billing history list.
        if (openBilling || milestone == 'service_complete') {
          NotificationNavigation.openCustomerBillingHistory();
          return;
        }
        // All other milestones (start service, arrived, returning): booking detail.
        if (bookingId > 0) {
          NotificationNavigation.openBookingServiceDetail(bookingId: bookingId);
        }
      });
      return;
    }

    if (kind == 'BOOKING_TIMER' || kind == 'ACCEPT_TIMEOUT') {
      _scheduleNavigate(() {
        if (!Get.isRegistered<DashboardController>()) return;
        final c = Get.find<DashboardController>();
        c.bindBookingTimerListener();
        if (bookingId > 0) {
          unawaited(c.fetchServiceDetail(bookingId: bookingId, force: true).catchError((Object e) {
            debugPrint('PushBooking: fetchServiceDetail (BOOKING_TIMER) failed: $e');
          }));
          if (Prefs().isCustomerRole) {
            unawaited(c.reconcileCustomerHomeTripState().catchError((Object e) {
              debugPrint('PushBooking: reconcileCustomerHomeTripState failed: $e');
            }));
          }
        }
      });
      return;
    }

    if (kind == 'CHAT_MESSAGE') {
      final peerId = extractChatSenderId(notification);
      final peerName = extractChatSenderName(notification);
      final peerImage = extractChatSenderImage(notification);
      _scheduleNavigate(() {
        try {
          Get.toNamed(
            Routes.DRIVER_CHAT,
            arguments: {
              'bookingId': bookingId,
              if (peerId != null && peerId.isNotEmpty) 'peerId': peerId,
              if (peerName != null && peerName.isNotEmpty) 'peerName': peerName,
              if (peerImage != null && peerImage.isNotEmpty)
                'peerImage': peerImage,
            },
          );
        } catch (e, st) {
          Alert.log('PushBooking', 'Navigate chat failed: $e\n$st');
        }
      });
      return;
    }

    // CUSTOMER_TIP_RECEIVED / CUSTOMER_REVIEW_RECEIVED: driver-side notifications.
    // Navigate to the driver booking detail screen. The screen's own initState
    // calls scheduleServiceDetailLoad(force: true) which fetches the latest data
    // (including the new tip amount and customer review/rating).
    // Do NOT pre-fetch here — that would race with initState and the loading
    // guard would suppress one of the two fetches, leaving the screen stale.
    if (kind == 'CUSTOMER_TIP_RECEIVED' || kind == 'CUSTOMER_REVIEW_RECEIVED') {
      final bookingCodeForTip = extractBookingCode(notification);
      _scheduleNavigate(() {
        try {
          Get.toNamed(
            Routes.DRIVER_SERVICE_DETAIL,
            arguments: <String, dynamic>{
              'bookingId': bookingId,
              if (bookingCodeForTip != null && bookingCodeForTip.isNotEmpty)
                'bookingCode': bookingCodeForTip,
            },
          );
        } catch (e, st) {
          Alert.log('PushBooking', 'Navigate $kind failed: $e\n$st');
        }
      });
      return;
    }

    final bookingCode = extractBookingCode(notification);
    final args = <String, dynamic>{
      'bookingId': bookingId,
      if (bookingCode != null && bookingCode.isNotEmpty)
        'bookingCode': bookingCode,
    };

    _scheduleNavigate(() {
      try {
        if (Prefs().isDriverRole) {
          Get.toNamed(Routes.DRIVER_SERVICE_DETAIL, arguments: args);
        } else {
          Get.toNamed(Routes.SERVICE_DETAIL, arguments: args);
        }
      } catch (e, st) {
        Alert.log('PushBooking', 'Navigate failed: $e\n$st');
      }
    });
  }

  static void _scheduleNavigate(void Function() navigate) {
    var attempts = 0;

    void tryNow() {
      if (!_canNavigate()) {
        attempts++;
        if (attempts < _maxDeferredAttempts) {
          Future<void>.delayed(_deferredStep, tryNow);
        }
        return;
      }
      navigate();
    }

    SchedulerBinding.instance.addPostFrameCallback((_) => tryNow());
  }

  /// When push matches `TRACKING_UPDATE` + a known tracking code, customer joins the
  /// booking room (`startCustomerLiveTracking` → socket `join_booking`).
  static void maybeStartCustomerLiveTrackingFromTrackingPush(
    OSNotification notification,
  ) {
    if (Prefs().token().trim().isEmpty) return;
    if (Prefs().isDriverRole) return;

    final kind = extractKind(notification)?.trim().toUpperCase();
    if (kind != 'TRACKING_UPDATE' && kind != 'CUSTOMER_SERVICE_MILESTONE') return;

    final tracking = extractTrackingStatus(notification)?.trim().toUpperCase();
    if (tracking == null || tracking.isEmpty) {
      Alert.log(
        'PushBooking',
        'TRACKING_UPDATE: skip join_booking — no tracking_status',
      );
      return;
    }
    if (!BookingTrackingStatus.isEligibleForLiveSocketJoin(tracking)) {
      Alert.log(
        'PushBooking',
        'TRACKING_UPDATE: skip join_booking — terminal or unknown tracking_status=$tracking',
      );
      if (BookingTrackingStatus.isBookingCancelled(trackingStatus: tracking) &&
          Get.isRegistered<DashboardController>()) {
        unawaited(
          Get.find<DashboardController>().reconcileCustomerHomeTripState(),
        );
      }
      return;
    }

    final bookingId = extractBookingId(notification);
    if (bookingId == null || bookingId <= 0) {
      Alert.log(
        'PushBooking',
        'TRACKING_UPDATE: skip join_booking — no booking_id',
      );
      return;
    }

    final payloadUserId = extractUserId(notification)?.trim();
    final myId = Prefs().userId().trim();
    if (payloadUserId != null &&
        payloadUserId.isNotEmpty &&
        myId.isNotEmpty &&
        payloadUserId != myId) {
      Alert.log(
        'PushBooking',
        'TRACKING_UPDATE: skip join_booking — user_id mismatch',
      );
      return;
    }

    void startWhenReady() {
      if (!Get.isRegistered<BookingLiveSocketService>()) {
        Alert.log(
          'PushBooking',
          'TRACKING_UPDATE: BookingLiveSocketService not ready',
        );
        return;
      }
      if (!Get.isRegistered<DashboardController>()) {
        Alert.log(
          'PushBooking',
          'TRACKING_UPDATE: DashboardController not ready — retry',
        );
        return;
      }
      Alert.log(
        'PushBooking',
        'TRACKING_UPDATE: startCustomerLiveTracking bookingId=$bookingId',
      );
      unawaited(
        Get.find<DashboardController>().startCustomerLiveTracking(
          bookingId,
          pushTrackingCode: tracking,
          pushTrackingMessage: extractPushTrackingMessage(notification),
          pushDriverName: extractPushDriverName(notification),
          pushDriverAvatarUrl: extractPushDriverAvatarUrl(notification),
        ).catchError((Object e) {
          debugPrint('PushBooking: startCustomerLiveTracking failed: $e');
        }),
      );
    }

    if (Get.isRegistered<DashboardController>() &&
        Get.isRegistered<BookingLiveSocketService>()) {
      startWhenReady();
      return;
    }

    var attempts = 0;
    void tryLater() {
      attempts++;
      if (Get.isRegistered<DashboardController>() &&
          Get.isRegistered<BookingLiveSocketService>()) {
        startWhenReady();
        return;
      }
      if (attempts < _maxDeferredAttempts) {
        Future<void>.delayed(_deferredStep, tryLater);
      } else {
        Alert.log(
          'PushBooking',
          'TRACKING_UPDATE: gave up waiting for controllers (bookingId=$bookingId)',
        );
      }
    }

    SchedulerBinding.instance.addPostFrameCallback((_) => tryLater());
  }

  static bool _canNavigate() {
    if (Prefs().token().trim().isEmpty) return false;
    final key = Get.key;
    return key.currentContext != null || key.currentState != null;
  }

  static int? extractTicketId(OSNotification n) {
    final fromAd = _ticketIdFromMap(n.additionalData);
    if (fromAd != null) return fromAd;

    final raw = n.rawPayload;
    if (raw == null) return null;

    final direct = _ticketIdFromMap(raw);
    if (direct != null) return direct;

    final fromCustom = _ticketIdFromCustom(raw['custom']);
    if (fromCustom != null) return fromCustom;

    for (final value in raw.values) {
      if (value is! String) continue;
      if (!value.contains('ticket_id')) continue;
      try {
        final decoded = jsonDecode(value) as Map<String, dynamic>?;
        final id =
            _ticketIdFromMap(decoded) ?? _ticketIdFromCustomInner(decoded);
        if (id != null) return id;
      } catch (_) {}
    }
    return null;
  }

  static int? extractBookingId(OSNotification n) {
    final fromAd = _idFromMap(n.additionalData);
    if (fromAd != null) return fromAd;

    final raw = n.rawPayload;
    if (raw == null) return null;

    final direct = _idFromMap(raw);
    if (direct != null) return direct;

    final fromCustom = _parseCustomBlock(raw['custom']);
    if (fromCustom != null) return fromCustom;

    for (final value in raw.values) {
      if (value is! String) continue;
      if (!value.contains('booking_id')) continue;
      try {
        final decoded = jsonDecode(value) as Map<String, dynamic>?;
        final id = _idFromMap(decoded) ?? _idFromCustomInner(decoded);
        if (id != null) return id;
      } catch (_) {}
    }
    return null;
  }

  static String? extractBookingCode(OSNotification n) {
    final code = _codeFromMap(n.additionalData);
    if (code != null) return code;

    final raw = n.rawPayload;
    if (raw == null) return null;

    final c1 = _codeFromMap(raw);
    if (c1 != null) return c1;

    final c2 = _codeFromCustom(raw['custom']);
    if (c2 != null) return c2;

    for (final value in raw.values) {
      if (value is! String) continue;
      if (!value.contains('booking_code')) continue;
      try {
        final decoded = jsonDecode(value) as Map<String, dynamic>?;
        final c = _codeFromMap(decoded) ?? _codeFromCustom(decoded);
        if (c != null) return c;
      } catch (_) {}
    }
    return null;
  }

  static String? extractKind(OSNotification n) {
    final fromAd = _kindFromMap(n.additionalData);
    if (fromAd != null) return fromAd;

    final raw = n.rawPayload;
    if (raw == null) return null;

    final direct = _kindFromMap(raw);
    if (direct != null) return direct;

    final fromCustom = _kindFromCustom(raw['custom']);
    if (fromCustom != null) return fromCustom;

    for (final value in raw.values) {
      if (value is! String) continue;
      if (!value.contains('kind')) continue;
      try {
        final decoded = jsonDecode(value) as Map<String, dynamic>?;
        final k = _kindFromMap(decoded) ?? _kindFromCustomInner(decoded);
        if (k != null) return k;
      } catch (_) {}
    }
    return null;
  }

  static String? extractTrackingStatus(OSNotification n) {
    final fromAd = _trackingStatusFromMap(n.additionalData);
    if (fromAd != null) return fromAd;

    final raw = n.rawPayload;
    if (raw == null) return null;

    final direct = _trackingStatusFromMap(raw);
    if (direct != null) return direct;

    final fromCustom = _trackingStatusFromCustom(raw['custom']);
    if (fromCustom != null) return fromCustom;

    for (final value in raw.values) {
      if (value is! String) continue;
      if (!value.contains('tracking_status')) continue;
      try {
        final decoded = jsonDecode(value) as Map<String, dynamic>?;
        final t =
            _trackingStatusFromMap(decoded) ??
            _trackingStatusFromCustomInner(decoded);
        if (t != null) return t;
      } catch (_) {}
    }
    return null;
  }

  static String? _kindFromMap(Map<String, dynamic>? m) {
    if (m == null) return null;
    final k = m['kind']?.toString().trim();
    if (k != null && k.isNotEmpty) return k;
    final t = m['type']?.toString().trim();
    if (t == null || t.isEmpty) return null;
    switch (t.toLowerCase()) {
      case 'driver_license_expiring':
        return 'DRIVER_LICENSE_EXPIRING';
      case 'driver_license_expired':
        return 'DRIVER_LICENSE_EXPIRED';
      default:
        return t.toUpperCase();
    }
  }

  static String? _kindFromCustomInner(Map<String, dynamic>? decoded) {
    if (decoded == null) return null;
    final a = decoded['a'];
    if (a is Map) {
      final k = a['kind']?.toString().trim();
      if (k != null && k.isNotEmpty) return k;
    }
    return _kindFromMap(decoded);
  }

  static String? _kindFromCustom(dynamic custom) {
    if (custom is String) {
      try {
        final map = jsonDecode(custom) as Map<String, dynamic>?;
        return _kindFromCustomInner(map);
      } catch (_) {}
    }
    if (custom is Map) {
      return _kindFromCustomInner(custom.cast<String, dynamic>());
    }
    return null;
  }

  static String? _trackingStatusFromMap(Map<String, dynamic>? m) {
    if (m == null) return null;
    final t = (m['tracking_status'] ?? m['trackingStatus'])?.toString().trim();
    return (t == null || t.isEmpty) ? null : t;
  }

  static String? _trackingStatusFromCustomInner(Map<String, dynamic>? decoded) {
    if (decoded == null) return null;
    final a = decoded['a'];
    if (a is Map) {
      final t = (a['tracking_status'] ?? a['trackingStatus'])
          ?.toString()
          .trim();
      if (t != null && t.isNotEmpty) return t;
    }
    return _trackingStatusFromMap(decoded);
  }

  static String? _trackingStatusFromCustom(dynamic custom) {
    if (custom is String) {
      try {
        final map = jsonDecode(custom) as Map<String, dynamic>?;
        return _trackingStatusFromCustomInner(map);
      } catch (_) {}
    }
    if (custom is Map) {
      return _trackingStatusFromCustomInner(custom.cast<String, dynamic>());
    }
    return null;
  }

  static String? extractUserId(OSNotification n) {
    final fromAd = _userIdFromMap(n.additionalData);
    if (fromAd != null) return fromAd;

    final raw = n.rawPayload;
    if (raw == null) return null;

    final u1 = _userIdFromMap(raw);
    if (u1 != null) return u1;

    final u2 = _userIdFromCustom(raw['custom']);
    if (u2 != null) return u2;

    for (final value in raw.values) {
      if (value is! String) continue;
      if (!value.contains('user_id')) continue;
      try {
        final decoded = jsonDecode(value) as Map<String, dynamic>?;
        final u = _userIdFromMap(decoded) ?? _userIdFromCustom(decoded);
        if (u != null) return u;
      } catch (_) {}
    }
    return null;
  }

  static int? _parseId(dynamic value) {
    if (value == null) return null;
    if (value is int) return value > 0 ? value : null;
    final s = value.toString().trim();
    if (s.isEmpty) return null;
    return int.tryParse(s);
  }

  static int? _ticketIdFromMap(Map<String, dynamic>? m) {
    if (m == null) return null;
    return _parseId(m['ticket_id']) ?? _parseId(m['ticketId']);
  }

  static int? _ticketIdFromCustomInner(Map<String, dynamic>? decoded) {
    if (decoded == null) return null;
    final a = decoded['a'];
    if (a is Map) {
      return _parseId(a['ticket_id']) ?? _parseId(a['ticketId']);
    }
    return _ticketIdFromMap(decoded);
  }

  static int? _ticketIdFromCustom(dynamic custom) {
    if (custom is String) {
      try {
        final map = jsonDecode(custom) as Map<String, dynamic>?;
        return _ticketIdFromCustomInner(map);
      } catch (_) {}
    }
    if (custom is Map) {
      return _ticketIdFromCustomInner(custom.cast<String, dynamic>());
    }
    return null;
  }

  static int? _idFromMap(Map<String, dynamic>? m) {
    if (m == null) return null;
    return _parseId(m['booking_id']) ?? _parseId(m['bookingId']);
  }

  static int? _idFromCustomInner(Map<String, dynamic>? decoded) {
    if (decoded == null) return null;
    final a = decoded['a'];
    if (a is Map) {
      return _parseId(a['booking_id']) ?? _parseId(a['bookingId']);
    }
    return _idFromMap(decoded);
  }

  static int? _parseCustomBlock(dynamic custom) {
    if (custom is String) {
      try {
        final map = jsonDecode(custom) as Map<String, dynamic>?;
        return _idFromCustomInner(map);
      } catch (_) {}
    }
    if (custom is Map) {
      return _idFromCustomInner(custom.cast<String, dynamic>());
    }
    return null;
  }

  static String? _codeFromMap(Map<String, dynamic>? m) {
    if (m == null) return null;
    final c = m['booking_code'] ?? m['bookingCode'];
    final s = c?.toString().trim() ?? '';
    return s.isEmpty ? null : s;
  }

  static String? _codeFromCustom(dynamic custom) {
    if (custom is String) {
      try {
        final map = jsonDecode(custom) as Map<String, dynamic>?;
        return _codeFromInner(map);
      } catch (_) {}
    }
    if (custom is Map) {
      return _codeFromInner(custom.cast<String, dynamic>());
    }
    return null;
  }

  static String? _codeFromInner(Map<String, dynamic>? decoded) {
    if (decoded == null) return null;
    final a = decoded['a'];
    if (a is Map) {
      final c = a['booking_code'] ?? a['bookingCode'];
      final s = c?.toString().trim() ?? '';
      if (s.isNotEmpty) return s;
    }
    return _codeFromMap(decoded);
  }

  static String? _userIdFromMap(Map<String, dynamic>? m) {
    if (m == null) return null;
    final u = m['user_id'] ?? m['userId'];
    final s = u?.toString().trim() ?? '';
    return s.isEmpty ? null : s;
  }

  static String? _userIdFromCustom(dynamic custom) {
    if (custom is String) {
      try {
        final map = jsonDecode(custom) as Map<String, dynamic>?;
        return _userIdFromInner(map);
      } catch (_) {}
    }
    if (custom is Map) {
      return _userIdFromInner(custom.cast<String, dynamic>());
    }
    return null;
  }

  static String? _userIdFromInner(Map<String, dynamic>? decoded) {
    if (decoded == null) return null;
    final a = decoded['a'];
    if (a is Map) {
      final u = a['user_id'] ?? a['userId'];
      final s = u?.toString().trim() ?? '';
      if (s.isNotEmpty) return s;
    }
    return _userIdFromMap(decoded);
  }

  static List<Map<String, dynamic>> _notificationDataMaps(OSNotification n) {
    final out = <Map<String, dynamic>>[];

    void add(dynamic m) {
      if (m == null) return;
      if (m is Map<String, dynamic>) {
        out.add(m);
      } else if (m is Map) {
        out.add(
          Map<String, dynamic>.fromEntries(
            m.entries.map((e) => MapEntry('${e.key}', e.value)),
          ),
        );
      }
    }

    add(n.additionalData);
    add(n.rawPayload);

    final raw = n.rawPayload;
    if (raw != null) {
      final custom = raw['custom'];
      if (custom is String) {
        try {
          final decoded = jsonDecode(custom);
          add(decoded);
          if (decoded is Map) {
            final inner = Map<String, dynamic>.fromEntries(
              decoded.entries.map((e) => MapEntry('${e.key}', e.value)),
            );
            add(inner['a']);
          }
        } catch (_) {}
      } else if (custom is Map) {
        add(custom);
        final customMap = Map<String, dynamic>.fromEntries(
          custom.entries.map((e) => MapEntry('${e.key}', e.value)),
        );
        add(customMap['a']);
      }
    }
    return out;
  }

  static Map<String, dynamic>? _driverMapFrom(Map<String, dynamic> m) {
    final d = m['driver'];
    if (d is Map<String, dynamic>) return d;
    if (d is Map) {
      return Map<String, dynamic>.fromEntries(
        d.entries.map((e) => MapEntry('${e.key}', e.value)),
      );
    }
    return null;
  }

  static String? extractPushTrackingMessage(OSNotification n) {
    for (final m in _notificationDataMaps(n)) {
      final msg = m['message']?.toString().trim();
      if (msg != null && msg.isNotEmpty) return msg;
    }
    return null;
  }

  static String? extractPushDriverName(OSNotification n) {
    for (final m in _notificationDataMaps(n)) {
      final dm = _driverMapFrom(m);
      if (dm == null) continue;
      final name = '${dm['name'] ?? dm['full_name'] ?? ''}'.trim();
      if (name.isNotEmpty) return name;
    }
    return null;
  }

  static String? extractPushDriverAvatarUrl(OSNotification n) {
    for (final m in _notificationDataMaps(n)) {
      final dm = _driverMapFrom(m);
      if (dm == null) continue;
      final pic =
          '${dm['profile_picture'] ?? dm['profilePicture'] ?? dm['avatar'] ?? ''}'
              .trim();
      if (pic.isNotEmpty) return pic;
    }
    return null;
  }

  static String? extractChatSenderId(OSNotification n) {
    for (final m in _notificationDataMaps(n)) {
      final id = (m['sender_id'] ?? m['senderId'])?.toString().trim() ?? '';
      if (id.isNotEmpty) return id;
    }
    return null;
  }

  static String? extractChatSenderName(OSNotification n) {
    for (final m in _notificationDataMaps(n)) {
      final name =
          (m['sender_name'] ?? m['senderName'])?.toString().trim() ?? '';
      if (name.isNotEmpty) return name;
    }
    return null;
  }

  static String? extractChatSenderImage(OSNotification n) {
    for (final m in _notificationDataMaps(n)) {
      final image =
          (m['sender_image'] ?? m['senderImage'])?.toString().trim() ?? '';
      if (image.isNotEmpty) return image;
    }
    return null;
  }

  static bool _truthy(OSNotification n, String key) {
    for (final m in _notificationDataMaps(n)) {
      final value = m[key];
      if (value == true || value == 1) return true;
      final text = '${value ?? ''}'.trim().toLowerCase();
      if (text == 'true' || text == '1' || text == 'yes') return true;
    }
    return false;
  }

  static String? _milestoneFrom(OSNotification n) {
    for (final m in _notificationDataMaps(n)) {
      final milestone = m['milestone']?.toString().trim();
      if (milestone != null && milestone.isNotEmpty) return milestone;
    }
    return null;
  }
}
