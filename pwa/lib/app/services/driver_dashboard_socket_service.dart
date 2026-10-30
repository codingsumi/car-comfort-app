import 'dart:async';

import 'package:get/get.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../network/response/booking_list_response.dart' as bl;
import '../network/utils/log_util.dart';
import '../utils/env_service.dart';
import '../utils/pref.dart';

import 'booking_live_socket_service.dart';

/// Backend may emit any of these when a job is offered to nearby drivers.
const List<String> kSocketIoNewBookingEventNames = [
  'new_booking_available',
  'new_booking',
  'driver_new_booking',
  'booking_available',
];

/// Driver dashboard socket: booking lifecycle (e.g. customer cancelled).
const List<String> kSocketIoDriverBookingStatusEventNames = [
  kSocketIoEventBookingStatusUpdate,
  'booking_status',
  'booking_cancelled',
  'booking_canceled',
  'booking_cancelled_by_customer',
];

class DriverDashboardSocketService extends GetxService {
  io.Socket? _socket;

  final RxBool isConnected = false.obs;

  final _newBookingEvents = StreamController<bl.Bookings>.broadcast(sync: true);
  final _bookingStatusEvents =
      StreamController<BookingStatusSocketEvent>.broadcast(sync: true);
  final _bookingTimerEvents =
      StreamController<BookingTimerSocketEvent>.broadcast(sync: true);
  final _bookingUpdatedEvents =
      StreamController<Map<String, dynamic>>.broadcast(sync: true);
  final _bookingAssignedEvents =
      StreamController<Map<String, dynamic>>.broadcast(sync: true);
  final _bookingUnassignedEvents =
      StreamController<Map<String, dynamic>>.broadcast(sync: true);
  final _disputeOpenedEvents =
      StreamController<Map<String, dynamic>>.broadcast(sync: true);

  Stream<bl.Bookings> get onNewBooking => _newBookingEvents.stream;

  Stream<BookingStatusSocketEvent> get onBookingStatusUpdate =>
      _bookingStatusEvents.stream;

  Stream<BookingTimerSocketEvent> get onBookingTimerUpdate =>
      _bookingTimerEvents.stream;

  Stream<Map<String, dynamic>> get onDriverBookingUpdated =>
      _bookingUpdatedEvents.stream;

  Stream<Map<String, dynamic>> get onDriverBookingAssigned =>
      _bookingAssignedEvents.stream;

  Stream<Map<String, dynamic>> get onDriverBookingUnassigned =>
      _bookingUnassignedEvents.stream;

  Stream<Map<String, dynamic>> get onDriverDisputeOpened =>
      _disputeOpenedEvents.stream;

  bool get isConfigured {
    return EnvService.socketIoOrigin.isNotEmpty &&
        Prefs().token().trim().isNotEmpty;
  }

  Future<void> connect() async {
    final token = Prefs().token().trim();

    if (token.isEmpty) {
      Alert.log('DriverDashSocket', '❌ No JWT token');
      return;
    }

    final origin = EnvService.socketIoOrigin;
    if (origin.isEmpty) {
      Alert.log('DriverDashSocket', '❌ Invalid BASE URL / socket origin');
      return;
    }

    await disconnect();

    try {
      Alert.log('DriverDashSocket', '🔌 Initializing socket...');
      Alert.log('DriverDashSocket', 'origin: $origin PATH: $kSocketIoPath');

      final options = io.OptionBuilder()
          .setTransports(['websocket'])
          .setPath(kSocketIoPath)
          .setAuth({'token': token, 'authorization': 'Bearer $token'})
          .setExtraHeaders({'authorization': 'Bearer $token'})
          .enableForceNewConnection()
          .build();

      final socket = io.io(origin, options);
      _socket = socket;

      socket.onConnect((_) {
        Alert.log('DriverDashSocket', '✅ CONNECTED');
        isConnected.value = true;
      });

      socket.onConnectError((e) {
        Alert.log('DriverDashSocket', '❌ CONNECT ERROR: $e');
        isConnected.value = false;
      });

      socket.onError((e) {
        Alert.log('DriverDashSocket', '❌ SOCKET ERROR: $e');
      });

      socket.onDisconnect((_) {
        Alert.log('DriverDashSocket', '🔌 DISCONNECTED');
        isConnected.value = false;
      });

      socket.on('connect_timeout', (data) {
        Alert.log('DriverDashSocket', '⏰ TIMEOUT: $data');
      });

      for (final name in kSocketIoNewBookingEventNames) {
        socket.on(name, _onNewBookingIo);
      }

      for (final name in kSocketIoDriverBookingStatusEventNames) {
        socket.on(name, _onBookingStatusIo);
      }

      socket.on(kSocketIoEventBookingTimerUpdate, _onBookingTimerIo);
      socket.on('booking_updated', _onDriverBookingUpdatedIo);
      socket.on('booking_status_changed', _onBookingStatusIo);
      socket.on('booking_assigned', _onDriverBookingAssignedIo);
      socket.on('booking_unassigned', _onDriverBookingUnassignedIo);
      socket.on('dispute_opened', _onDriverDisputeOpenedIo);

      socket.connect();
    } catch (e, st) {
      Alert.log('DriverDashSocket', '❌ INIT FAILED: $e\n$st');
      _socket = null;
      isConnected.value = false;
    }
  }

  void _onNewBookingIo(dynamic data) {
    try {
      Alert.log('DriverDashSocket', '📦 New booking event: $data');

      final booking = bl.Bookings.fromNewBookingAvailableEvent(data);

      if (booking == null) {
        Alert.log('DriverDashSocket', '⚠️ Parsed booking is null');
        return;
      }

      _newBookingEvents.add(booking);
    } catch (e, st) {
      Alert.log('DriverDashSocket', '❌ PARSE ERROR: $e\n$st');
    }
  }

  void _onBookingStatusIo(dynamic data) {
    Alert.log('DriverDashSocket', 'booking status event raw: $data');
    final ev = parseBookingStatusSocketEvent(data);
    if (ev == null) {
      Alert.log('DriverDashSocket', 'booking status parse skipped');
      return;
    }
    Alert.log(
      'DriverDashSocket',
      'booking status: bookingId=${ev.bookingId} status=${ev.status}',
    );
    _bookingStatusEvents.add(ev);
  }

  void _onDriverBookingUpdatedIo(dynamic data) {
    final map = socketPayloadToMap(data);
    if (map == null) return;
    _bookingUpdatedEvents.add(map);
  }

  void _onDriverBookingAssignedIo(dynamic data) {
    Alert.log('DriverDashSocket', 'booking_assigned event: $data');
    final map = socketPayloadToMap(data);
    if (map == null) return;
    _bookingAssignedEvents.add(map);
  }

  void _onDriverBookingUnassignedIo(dynamic data) {
    Alert.log('DriverDashSocket', 'booking_unassigned event: $data');
    final map = socketPayloadToMap(data);
    if (map == null) return;
    _bookingUnassignedEvents.add(map);
  }

  void _onDriverDisputeOpenedIo(dynamic data) {
    final map = socketPayloadToMap(data);
    if (map == null) return;
    _disputeOpenedEvents.add(map);
  }

  void _onBookingTimerIo(dynamic data) {
    Alert.log('DriverDashSocket', 'booking timer event raw: $data');
    final map = socketPayloadToMap(data);
    if (map == null) {
      Alert.log('DriverDashSocket', 'booking timer parse skipped');
      return;
    }
    final ev = BookingTimerSocketEvent.fromJson(map);
    if (ev.timerPhase.isEmpty) {
      Alert.log('DriverDashSocket', 'booking timer missing timer_phase: $map');
      return;
    }
    _bookingTimerEvents.add(ev);
  }

  Future<void> disconnect() async {
    final socket = _socket;
    _socket = null;

    if (socket != null) {
      try {
        Alert.log('DriverDashSocket', '🛑 Disposing socket');
        socket.dispose();
      } catch (e) {
        Alert.log('DriverDashSocket', 'Dispose error: $e');
      }
    }

    isConnected.value = false;
  }

  @override
  void onClose() {
    unawaited(disconnect());
    unawaited(_newBookingEvents.close());
    unawaited(_bookingStatusEvents.close());
    unawaited(_bookingTimerEvents.close());
    unawaited(_bookingUpdatedEvents.close());
    unawaited(_bookingAssignedEvents.close());
    unawaited(_bookingUnassignedEvents.close());
    unawaited(_disputeOpenedEvents.close());
    super.onClose();
  }
}
