import 'dart:async';

import 'package:get/get.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../network/utils/log_util.dart';
import '../utils/env_service.dart';
import '../utils/pref.dart';

import 'booking_live_socket_service.dart';

/// Customer dashboard socket: listens on the per-user room for trip events
/// before [join_booking] (driver assigned, tracking updates, cancel).
class CustomerDashboardSocketService extends GetxService {
  io.Socket? _socket;

  final RxBool isConnected = false.obs;

  final _bookingStatusEvents =
      StreamController<BookingStatusSocketEvent>.broadcast(sync: true);
  final _bookingTrackingEvents =
      StreamController<BookingTrackingSocketEvent>.broadcast(sync: true);
  final _bookingUpdatedEvents =
      StreamController<Map<String, dynamic>>.broadcast(sync: true);
  final _refundProcessedEvents =
      StreamController<Map<String, dynamic>>.broadcast(sync: true);
  final _disputeOpenedEvents =
      StreamController<Map<String, dynamic>>.broadcast(sync: true);
  final _disputeUpdatedEvents =
      StreamController<Map<String, dynamic>>.broadcast(sync: true);

  Stream<BookingStatusSocketEvent> get onBookingStatusUpdate =>
      _bookingStatusEvents.stream;

  Stream<BookingTrackingSocketEvent> get onBookingTrackingUpdate =>
      _bookingTrackingEvents.stream;

  Stream<Map<String, dynamic>> get onBookingUpdated =>
      _bookingUpdatedEvents.stream;

  Stream<Map<String, dynamic>> get onRefundProcessed =>
      _refundProcessedEvents.stream;

  Stream<Map<String, dynamic>> get onDisputeOpened =>
      _disputeOpenedEvents.stream;

  Stream<Map<String, dynamic>> get onDisputeUpdated =>
      _disputeUpdatedEvents.stream;

  bool get isConfigured {
    return EnvService.socketIoOrigin.isNotEmpty &&
        Prefs().token().trim().isNotEmpty &&
        Prefs().isCustomerRole;
  }

  Future<void> connect() async {
    if (!Prefs().isCustomerRole) {
      await disconnect();
      return;
    }

    final token = Prefs().token().trim();
    if (token.isEmpty) {
      Alert.log('CustomerDashSocket', 'No JWT token');
      return;
    }

    final origin = EnvService.socketIoOrigin;
    if (origin.isEmpty) {
      Alert.log('CustomerDashSocket', 'Socket origin empty');
      return;
    }

    await disconnect();

    try {
      final socket = io.io(
        origin,
        io.OptionBuilder()
            .setTransports(['websocket'])
            .setPath(kSocketIoPath)
            .setAuth({'token': token, 'authorization': 'Bearer $token'})
            .setExtraHeaders({'authorization': 'Bearer $token'})
            .enableForceNewConnection()
            .build(),
      );
      _socket = socket;

      socket.onConnect((_) {
        isConnected.value = true;
        Alert.log('CustomerDashSocket', 'connected');
      });

      socket.onConnectError((e) {
        Alert.log('CustomerDashSocket', 'connect_error: $e');
        isConnected.value = false;
      });

      socket.onDisconnect((_) {
        isConnected.value = false;
      });

      socket.on(kSocketIoEventBookingStatusUpdate, _onBookingStatusIo);
      socket.on(kSocketIoEventBookingTrackingUpdate, _onBookingTrackingIo);
      socket.on('booking_updated', _onBookingUpdatedIo);
      socket.on('booking_status_changed', _onBookingStatusIo);
      socket.on('refund_processed', _onRefundProcessedIo);
      socket.on('dispute_opened', _onDisputeOpenedIo);
      socket.on('dispute_updated', _onDisputeUpdatedIo);

      socket.connect();
    } catch (e, st) {
      Alert.log('CustomerDashSocket', 'init failed: $e\n$st');
      _socket = null;
      isConnected.value = false;
    }
  }

  void _onBookingStatusIo(dynamic data) {
    final ev = parseBookingStatusSocketEvent(data);
    if (ev == null) return;
    _bookingStatusEvents.add(ev);
  }

  void _onBookingTrackingIo(dynamic data) {
    final map = socketPayloadToMap(data);
    if (map == null) return;
    final ev = BookingTrackingSocketEvent.fromJson(map);
    if (ev.trackingStatus.isEmpty) return;
    _bookingTrackingEvents.add(ev);
  }

  void _onBookingUpdatedIo(dynamic data) {
    final map = socketPayloadToMap(data);
    if (map == null) return;
    _bookingUpdatedEvents.add(map);
  }

  void _onRefundProcessedIo(dynamic data) {
    final map = socketPayloadToMap(data);
    if (map == null) return;
    _refundProcessedEvents.add(map);
  }

  void _onDisputeOpenedIo(dynamic data) {
    final map = socketPayloadToMap(data);
    if (map == null) return;
    _disputeOpenedEvents.add(map);
  }

  void _onDisputeUpdatedIo(dynamic data) {
    final map = socketPayloadToMap(data);
    if (map == null) return;
    _disputeUpdatedEvents.add(map);
  }

  Future<void> disconnect() async {
    final socket = _socket;
    _socket = null;
    if (socket != null) {
      try {
        socket.dispose();
      } catch (_) {}
    }
    isConnected.value = false;
  }

  @override
  void onClose() {
    unawaited(disconnect());
    unawaited(_bookingStatusEvents.close());
    unawaited(_bookingTrackingEvents.close());
    unawaited(_bookingUpdatedEvents.close());
    unawaited(_refundProcessedEvents.close());
    unawaited(_disputeOpenedEvents.close());
    unawaited(_disputeUpdatedEvents.close());
    super.onClose();
  }
}
