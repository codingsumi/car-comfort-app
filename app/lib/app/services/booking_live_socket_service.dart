import 'dart:async';
import 'dart:convert';

import 'package:get/get.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../network/utils/log_util.dart';
import '../utils/env_service.dart';
import '../utils/pref.dart';

/// Server → client (customer): live driver position after [join_booking].
const String kSocketIoEventLocationUpdate = 'location_update';

/// Server → client (customer): booking workflow status (e.g. assigned / in_progress).
const String kSocketIoEventBookingStatusUpdate = 'booking_status_update';

/// Server → client (customer): `tracking_status` enum (e.g. DRIVER_REACHED_CUSTOMER).
const String kSocketIoEventBookingTrackingUpdate = 'booking_tracking_update';

/// Server → client: on-demand accept / arrival-wait countdown (`timer_phase`, `expires_at`).
const String kSocketIoEventBookingTimerUpdate = 'booking_timer_update';

/// Client → server: join booking room (required to receive [kSocketIoEventLocationUpdate]).
const String kSocketIoEventJoinBooking = 'join_booking';

/// Engine path (matches `io(BASE_URL, { path: '/socket.io', ... })`).
const String kSocketIoPath = '/socket.io';

/// Driver → server: GPS ping (event name must match your Node handler; change if needed).
const String kSocketIoEmitDriverLocation = 'driver_location';

/// Driver → server: human-readable status line for the customer app.
const String kSocketIoEmitDriverStatus = 'driver_status';

class DriverLocationUpdate {
  const DriverLocationUpdate({
    required this.bookingId,
    this.latitude,
    this.longitude,
    this.timestampUtc,
    required this.raw,
  });

  final int? bookingId;
  final double? latitude;
  final double? longitude;
  final DateTime? timestampUtc;
  final Map<String, dynamic> raw;

  bool get hasCoordinates =>
      latitude != null &&
      longitude != null &&
      latitude!.isFinite &&
      longitude!.isFinite;

  factory DriverLocationUpdate.fromJson(Map<String, dynamic> json) {
    double? toDouble(dynamic v) {
      if (v == null) return null;
      if (v is num) return v.toDouble();
      return double.tryParse('$v');
    }

    int? toInt(dynamic v) {
      if (v == null) return null;
      if (v is int) return v;
      return int.tryParse('$v');
    }

    DateTime? ts;
    final tsRaw = json['timestamp'] ?? json['ts'];
    if (tsRaw is String) {
      ts = DateTime.tryParse(tsRaw)?.toUtc();
    } else if (tsRaw is num) {
      ts = DateTime.fromMillisecondsSinceEpoch(tsRaw.toInt(), isUtc: true);
    }

    final coords = json['coordinates'];
    double? lat = toDouble(json['latitude'] ?? json['lat']);
    double? lng = toDouble(json['longitude'] ?? json['lng'] ?? json['lon']);
    if ((lat == null || lng == null) && coords is List && coords.length >= 2) {
      // GeoJSON-style [lng, lat]
      lng = toDouble(coords[0]);
      lat = toDouble(coords[1]);
    }

    return DriverLocationUpdate(
      bookingId: toInt(json['booking_id'] ?? json['bookingId']),
      latitude: lat,
      longitude: lng,
      timestampUtc: ts,
      raw: json,
    );
  }
}

/// Server → customer: [kSocketIoEventBookingTrackingUpdate] payload.
class BookingTrackingSocketEvent {
  const BookingTrackingSocketEvent({
    required this.bookingId,
    required this.trackingStatus,
    this.serverMessage,
    this.pickupOtp,
    this.driverName,
    this.driverProfilePictureUrl,
    this.driverPhone,
    this.driverAvgRating,
    required this.raw,
  });

  final int? bookingId;
  final String trackingStatus;

  /// Human-readable line from server (preferred over mapping [trackingStatus]).
  final String? serverMessage;

  /// Vehicle pickup OTP for the customer to share with the driver.
  final String? pickupOtp;
  final String? driverName;
  final String? driverProfilePictureUrl;
  final String? driverPhone;
  final double? driverAvgRating;
  final Map<String, dynamic> raw;

  factory BookingTrackingSocketEvent.fromJson(Map<String, dynamic> json) {
    int? toInt(dynamic v) {
      if (v == null) return null;
      if (v is int) return v;
      return int.tryParse('$v');
    }

    final code = '${json['tracking_status'] ?? json['trackingStatus'] ?? ''}'
        .trim();

    final msgRaw = json['message'];
    final serverMessage = msgRaw == null
        ? null
        : '${msgRaw}'.trim().isEmpty
        ? null
        : '${msgRaw}'.trim();

    String? pickupOtp;
    final otpRaw =
        json['pickup_otp'] ??
        json['pickupOtp'] ??
        json['vehicle_pickup_otp'] ??
        json['vehiclePickupOtp'] ??
        json['otp'];
    if (otpRaw != null) {
      final t = '${otpRaw}'.trim();
      if (t.isNotEmpty) pickupOtp = t;
    }

    String? driverName;
    String? driverProfilePictureUrl;
    String? driverPhone;
    double? driverAvgRating;
    final d = json['driver'];
    if (d is Map) {
      final dm = Map<String, dynamic>.fromEntries(
        d.entries.map((e) => MapEntry('${e.key}', e.value)),
      );
      final n = '${dm['name'] ?? dm['full_name'] ?? ''}'.trim();
      if (n.isNotEmpty) driverName = n;
      final pic =
          '${dm['profile_picture'] ?? dm['profilePicture'] ?? dm['profile'] ?? dm['avatar'] ?? ''}'
              .trim();
      if (pic.isNotEmpty) driverProfilePictureUrl = pic;
      final ph = '${dm['phone'] ?? dm['mobile'] ?? ''}'.trim();
      if (ph.isNotEmpty) driverPhone = ph;
      final r = dm['avg_rating'] ?? dm['avgRating'];
      if (r is num) {
        driverAvgRating = r.toDouble();
      } else {
        driverAvgRating = double.tryParse('${r ?? ''}');
      }
    }

    return BookingTrackingSocketEvent(
      bookingId: toInt(json['booking_id'] ?? json['bookingId']),
      trackingStatus: code,
      serverMessage: serverMessage,
      pickupOtp: pickupOtp,
      driverName: driverName,
      driverProfilePictureUrl: driverProfilePictureUrl,
      driverPhone: driverPhone,
      driverAvgRating: driverAvgRating,
      raw: json,
    );
  }
}

/// Server → client: [kSocketIoEventBookingTimerUpdate] payload.
class BookingTimerSocketEvent {
  const BookingTimerSocketEvent({
    required this.bookingId,
    required this.timerPhase,
    this.remainingMinutes,
    this.remainingSeconds,
    this.expiresAt,
    this.scheduleType,
    required this.raw,
  });

  final int? bookingId;
  final String timerPhase;
  final int? remainingMinutes;
  final int? remainingSeconds;
  final DateTime? expiresAt;
  final String? scheduleType;
  final Map<String, dynamic> raw;

  factory BookingTimerSocketEvent.fromJson(Map<String, dynamic> json) {
    int? toInt(dynamic v) {
      if (v == null) return null;
      if (v is int) return v;
      return int.tryParse('$v');
    }

    DateTime? expires;
    final expRaw = json['expires_at'] ?? json['expiresAt'];
    if (expRaw is String && expRaw.trim().isNotEmpty) {
      expires = DateTime.tryParse(expRaw.trim())?.toLocal();
    }

    return BookingTimerSocketEvent(
      bookingId: toInt(json['booking_id'] ?? json['bookingId']),
      timerPhase: '${json['timer_phase'] ?? json['timerPhase'] ?? ''}'.trim(),
      remainingMinutes: toInt(
        json['remaining_minutes'] ?? json['remainingMinutes'],
      ),
      remainingSeconds: toInt(
        json['remaining_seconds'] ?? json['remainingSeconds'],
      ),
      expiresAt: expires,
      scheduleType: '${json['schedule_type'] ?? json['scheduleType'] ?? ''}'
          .trim(),
      raw: json,
    );
  }
}

/// Server → customer: [kSocketIoEventBookingStatusUpdate] payload.
class BookingStatusSocketEvent {
  const BookingStatusSocketEvent({
    required this.bookingId,
    required this.status,
    this.message,
    this.otp,
    this.driverName,
    this.driverProfilePictureUrl,
    this.driverPhone,
    this.driverAvgRating,
    required this.raw,
  });

  final int? bookingId;
  final String status;

  /// Server copy e.g. pickup OTP instructions.
  final String? message;

  /// Vehicle pickup OTP for the customer to share with the driver.
  final String? otp;
  final String? driverName;
  final String? driverProfilePictureUrl;
  final String? driverPhone;
  final double? driverAvgRating;
  final Map<String, dynamic> raw;

  factory BookingStatusSocketEvent.fromJson(Map<String, dynamic> json) {
    int? toInt(dynamic v) {
      if (v == null) return null;
      if (v is int) return v;
      return int.tryParse('$v');
    }

    final s =
        '${json['booking_status'] ?? json['bookingStatus'] ?? json['status'] ?? json['state'] ?? ''}'
            .trim();

    final msgRaw = json['message'];
    final message = msgRaw == null
        ? null
        : '${msgRaw}'.trim().isEmpty
        ? null
        : '${msgRaw}'.trim();

    String? otp;
    final otpRaw = json['otp'] ?? json['pickup_otp'] ?? json['pickupOtp'];
    if (otpRaw != null) {
      final t = '${otpRaw}'.trim();
      if (t.isNotEmpty) otp = t;
    }

    String? driverName;
    String? driverProfilePictureUrl;
    String? driverPhone;
    double? driverAvgRating;
    final d = json['driver'];
    if (d is Map) {
      final dm = Map<String, dynamic>.fromEntries(
        d.entries.map((e) => MapEntry('${e.key}', e.value)),
      );
      final n = '${dm['name'] ?? dm['full_name'] ?? ''}'.trim();
      if (n.isNotEmpty) driverName = n;
      final pic =
          '${dm['profile_picture'] ?? dm['profilePicture'] ?? dm['profile'] ?? dm['avatar'] ?? ''}'
              .trim();
      if (pic.isNotEmpty) driverProfilePictureUrl = pic;
      final ph = '${dm['phone'] ?? dm['mobile'] ?? ''}'.trim();
      if (ph.isNotEmpty) driverPhone = ph;
      final r = dm['avg_rating'] ?? dm['avgRating'];
      if (r is num) {
        driverAvgRating = r.toDouble();
      } else {
        driverAvgRating = double.tryParse('${r ?? ''}');
      }
    }

    return BookingStatusSocketEvent(
      bookingId: toInt(json['booking_id'] ?? json['bookingId']),
      status: s,
      message: message,
      otp: otp,
      driverName: driverName,
      driverProfilePictureUrl: driverProfilePictureUrl,
      driverPhone: driverPhone,
      driverAvgRating: driverAvgRating,
      raw: json,
    );
  }
}

/// Socket.IO service: same origin as [EnvService.baseUrl] (or optional [EnvService.bookingLiveWsUrl]
/// override). Auth: `{ token: JWT }`. After connect, emits [kSocketIoEventJoinBooking];
/// listens for [kSocketIoEventLocationUpdate], [kSocketIoEventBookingStatusUpdate],
/// [kSocketIoEventBookingTrackingUpdate]. Re-joins the booking room on each reconnect.
class BookingLiveSocketService extends GetxService {
  io.Socket? _socket;

  final RxBool isConnected = false.obs;
  int? _activeBookingId;

  Timer? _locationHeartbeat;
  bool _locationTickInFlight = false;
  int? _heartbeatBookingId;
  Future<({double lat, double lng})?> Function()? _fetchLocation;

  final _locationEvents = StreamController<DriverLocationUpdate>.broadcast(
    sync: true,
  );
  final _bookingStatusEvents =
      StreamController<BookingStatusSocketEvent>.broadcast(sync: true);
  final _bookingTrackingEvents =
      StreamController<BookingTrackingSocketEvent>.broadcast(sync: true);
  final _bookingTimerEvents =
      StreamController<BookingTimerSocketEvent>.broadcast(sync: true);

  Stream<DriverLocationUpdate> get onDriverLocation => _locationEvents.stream;

  Stream<BookingTrackingSocketEvent> get onBookingTrackingUpdate =>
      _bookingTrackingEvents.stream;

  Stream<BookingStatusSocketEvent> get onBookingStatusUpdate =>
      _bookingStatusEvents.stream;

  Stream<BookingTimerSocketEvent> get onBookingTimerUpdate =>
      _bookingTimerEvents.stream;

  int? get activeBookingId => _activeBookingId;

  /// Non-empty base URL and JWT (Socket.IO uses [EnvService.baseUrl] origin by default).
  bool get isConfigured {
    final origin = _socketOriginString;
    return origin.isNotEmpty && Prefs().token().trim().isNotEmpty;
  }

  String get _socketOriginString => EnvService.socketIoOrigin;

  Future<void> connectForBooking(
    int bookingId, {
    bool forceReconnect = false,
  }) async {
    if (bookingId <= 0) return;

    final token = Prefs().token().trim();
    if (token.isEmpty) {
      Alert.log('BookingLiveSocket', 'No JWT; Socket.IO not started.');
      return;
    }

    final origin = _socketOriginString;
    if (origin.isEmpty) {
      Alert.log('BookingLiveSocket', 'BASE_URL / socket origin is empty.');
      return;
    }

    final currentSocket = _socket;
    if (!forceReconnect &&
        _activeBookingId == bookingId &&
        currentSocket != null) {
      if (!currentSocket.connected) currentSocket.connect();
      return;
    }

    await disconnect();
    _activeBookingId = bookingId;

    try {
      final opts = io.OptionBuilder()
          .setTransports(['websocket'])
          .setPath(kSocketIoPath)
          .setAuth({'token': token, 'authorization': 'Bearer $token'})
          .setExtraHeaders({'authorization': 'Bearer $token'})
          .enableReconnection()
          .setReconnectionDelay(1000)
          .setReconnectionDelayMax(10000)
          .enableForceNewConnection()
          .build();

      final socket = io.io(origin, opts);
      _socket = socket;

      socket.onConnect((_) {
        if (!identical(_socket, socket)) return;
        isConnected.value = true;
        _emitJoinBooking(socket);
      });

      socket.onConnectError((dynamic e) {
        Alert.log('BookingLiveSocket', 'connect_error: $e');
        if (!identical(_socket, socket)) return;
        isConnected.value = socket.connected;
      });

      socket.onDisconnect((dynamic _) {
        if (!identical(_socket, socket)) return;
        isConnected.value = false;
      });

      socket.onReconnect((dynamic _) {
        // `connect` is emitted again after a successful reconnect and is the
        // single place where we rejoin the room. Emitting here as well sends
        // two join requests and some servers reject the duplicate.
        Alert.log('BookingLiveSocket', 'transport reconnected');
      });

      socket.on(kSocketIoEventLocationUpdate, _onLocationIo);
      socket.on(kSocketIoEventBookingStatusUpdate, _onBookingStatusIo);
      socket.on(kSocketIoEventBookingTrackingUpdate, _onBookingTrackingIo);
      socket.on(kSocketIoEventBookingTimerUpdate, _onBookingTimerIo);
      socket.connect();
    } catch (e, st) {
      Alert.log('BookingLiveSocket', 'socket init failed: $e\n$st');
      _socket = null;
      isConnected.value = false;
    }
  }

  void _emitJoinBooking(io.Socket socket) {
    final id = _activeBookingId;
    if (id == null) return;
    final payload = {'booking_id': id, 'bookingId': id};
    Alert.log('BookingLiveSocket', 'emit join_booking: $payload');
    socket.emitWithAck(
      kSocketIoEventJoinBooking,
      payload,
      ack: (dynamic res, [dynamic extra]) {
        Alert.log(
          'BookingLiveSocket',
          'join_booking ack: res=$res extra=$extra',
        );
        final ack = socketPayloadToMap(res) ?? socketPayloadToMap(extra);
        final explicitlyRejected =
            res == false ||
            extra == false ||
            (ack != null &&
                (ack['ok'] == false ||
                    ack['ok'] == 'false' ||
                    ack['success'] == false ||
                    ack['success'] == 'false'));
        if (explicitlyRejected &&
            identical(_socket, socket) &&
            _activeBookingId == id) {
          Alert.log(
            'BookingLiveSocket',
            'join_booking rejected for booking $id — disconnecting',
          );
          unawaited(disconnect());
        } else if (ack == null) {
          // Backends do not all use `{ok: true}` for this acknowledgement.
          // An empty/boolean/string ACK is not evidence of rejection, and
          // disconnecting here permanently freezes an otherwise valid feed.
          Alert.log(
            'BookingLiveSocket',
            'join_booking ack has no structured status; keeping connection',
          );
        }
      },
    );
  }

  void _onLocationIo(dynamic data) {
    Alert.log('BookingLiveSocket', 'on location_update raw: $data');
    final map = _asStringKeyMap(data);
    if (map == null) {
      Alert.log(
        'BookingLiveSocket',
        'location_update parse skipped: unsupported payload',
      );
      return;
    }
    final u = DriverLocationUpdate.fromJson(map);
    if (!u.hasCoordinates) {
      Alert.log(
        'BookingLiveSocket',
        'location_update missing coordinates: $map',
      );
      return;
    }
    Alert.log(
      'BookingLiveSocket',
      'location_update parsed: bookingId=${u.bookingId}, lat=${u.latitude}, lng=${u.longitude}',
    );
    _locationEvents.add(u);
  }

  void _onBookingTrackingIo(dynamic data) {
    Alert.log('BookingLiveSocket', 'on booking_tracking_update raw: $data');
    final map = _asStringKeyMap(data);
    if (map == null) {
      Alert.log(
        'BookingLiveSocket',
        'booking_tracking_update parse skipped: unsupported payload',
      );
      return;
    }
    final ev = BookingTrackingSocketEvent.fromJson(map);
    if (ev.trackingStatus.isEmpty) {
      Alert.log(
        'BookingLiveSocket',
        'booking_tracking_update missing tracking_status: $map',
      );
      return;
    }
    Alert.log(
      'BookingLiveSocket',
      'booking_tracking_update: bookingId=${ev.bookingId} status=${ev.trackingStatus}',
    );
    _bookingTrackingEvents.add(ev);
  }

  void _onBookingTimerIo(dynamic data) {
    Alert.log('BookingLiveSocket', 'on booking_timer_update raw: $data');
    final map = _asStringKeyMap(data);
    if (map == null) {
      Alert.log(
        'BookingLiveSocket',
        'booking_timer_update parse skipped: unsupported payload',
      );
      return;
    }
    final ev = BookingTimerSocketEvent.fromJson(map);
    if (ev.timerPhase.isEmpty) {
      Alert.log(
        'BookingLiveSocket',
        'booking_timer_update missing timer_phase: $map',
      );
      return;
    }
    _bookingTimerEvents.add(ev);
  }

  void _onBookingStatusIo(dynamic data) {
    Alert.log('BookingLiveSocket', 'on booking_status_update raw: $data');
    final ev = parseBookingStatusSocketEvent(data);
    if (ev == null) {
      Alert.log(
        'BookingLiveSocket',
        'booking_status_update parse skipped: unsupported payload',
      );
      return;
    }
    Alert.log(
      'BookingLiveSocket',
      'booking_status_update: bookingId=${ev.bookingId} status=${ev.status}',
    );
    _bookingStatusEvents.add(ev);
  }

  Map<String, dynamic>? _asStringKeyMap(dynamic data) =>
      socketPayloadToMap(data);

  void sendDriverLocation({
    required int bookingId,
    required double latitude,
    required double longitude,
  }) {
    final socket = _socket;
    if (socket == null || !socket.connected) return;

    final payload = {
      'booking_id': bookingId,
      'latitude': latitude,
      'longitude': longitude,
      'lat': latitude,
      'lng': longitude,
      'timestamp': DateTime.now().toUtc().toIso8601String(),
    };
    Alert.log('BookingLiveSocket', 'emit driver_location: $payload');
    socket.emit(kSocketIoEmitDriverLocation, payload);
  }

  /// Driver → server: status line for the customer (e.g. after tracking milestone).
  void sendDriverStatusUpdate(String statusLine) {
    final id = _activeBookingId;
    final socket = _socket;
    if (id == null || socket == null || !socket.connected) return;
    final trimmed = statusLine.trim();
    if (trimmed.isEmpty) return;
    final payload = {'booking_id': id, 'bookingId': id, 'status': trimmed};
    Alert.log('BookingLiveSocket', 'emit driver_status: $payload');
    socket.emit(kSocketIoEmitDriverStatus, payload);
  }

  void startDriverLocationHeartbeat({
    required int bookingId,
    required Future<({double lat, double lng})?> Function() fetchLocation,
  }) {
    stopDriverLocationHeartbeat();
    _heartbeatBookingId = bookingId;
    _fetchLocation = fetchLocation;
    _locationHeartbeat = Timer.periodic(
      const Duration(seconds: 3),
      (_) => unawaited(_emitLocationTick()),
    );
    unawaited(_emitLocationTick());
  }

  void stopDriverLocationHeartbeat() {
    _locationHeartbeat?.cancel();
    _locationHeartbeat = null;
    _heartbeatBookingId = null;
    _fetchLocation = null;
  }

  Future<void> _emitLocationTick() async {
    if (_locationTickInFlight) return;
    final bookingId = _heartbeatBookingId;
    final fetch = _fetchLocation;
    if (bookingId == null || fetch == null) return;
    final socket = _socket;
    if (socket == null || !socket.connected) return;
    _locationTickInFlight = true;
    try {
      final pos = await fetch();
      if (pos == null) return;
      if (_heartbeatBookingId != bookingId || !identical(_socket, socket)) {
        return;
      }
      sendDriverLocation(
        bookingId: bookingId,
        latitude: pos.lat,
        longitude: pos.lng,
      );
    } catch (e) {
      Alert.log('BookingLiveSocket', 'location tick failed: $e');
    } finally {
      _locationTickInFlight = false;
    }
  }

  Future<void> disconnect() async {
    stopDriverLocationHeartbeat();
    _activeBookingId = null;
    final s = _socket;
    _socket = null;
    if (s != null) {
      try {
        s.dispose();
      } catch (_) {}
    }
    isConnected.value = false;
  }

  @override
  void onClose() {
    unawaited(disconnect());
    unawaited(_locationEvents.close());
    unawaited(_bookingStatusEvents.close());
    unawaited(_bookingTrackingEvents.close());
    unawaited(_bookingTimerEvents.close());
    super.onClose();
  }
}

/// Normalizes Socket.IO payloads (JSON string, `{data:...}`, arrays).
Map<String, dynamic>? socketPayloadToMap(dynamic data) {
  if (data == null) return null;
  if (data is String) {
    try {
      final decoded = jsonDecode(data);
      return socketPayloadToMap(decoded);
    } catch (_) {
      return null;
    }
  }
  if (data is Map) {
    final map = Map<String, dynamic>.fromEntries(
      data.entries.map((e) => MapEntry('${e.key}', e.value)),
    );
    final nested =
        socketPayloadToMap(map['data']) ?? socketPayloadToMap(map['payload']);
    return nested ?? map;
  }
  if (data is List && data.isNotEmpty) {
    return socketPayloadToMap(data.first);
  }
  return null;
}

/// Parses [kSocketIoEventBookingStatusUpdate] (and aliases) from raw socket data.
BookingStatusSocketEvent? parseBookingStatusSocketEvent(dynamic data) {
  final map = socketPayloadToMap(data);
  if (map == null) return null;
  final ev = BookingStatusSocketEvent.fromJson(map);
  if (ev.status.trim().isEmpty) return null;
  return ev;
}
