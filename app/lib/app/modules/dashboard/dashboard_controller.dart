import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:car_comfort/app/constants/booking_tracking_status.dart';
import 'package:car_comfort/app/constants/service_provider_labels.dart';
import 'package:car_comfort/app/network/repository/dash_repository.dart';
import 'package:flutter/scheduler.dart';
import '../../network/utils/network_result.dart';
import 'dashboard_booking_timer.dart';
import 'package:car_comfort/app/utils/booking_chat_availability.dart';
import 'package:car_comfort/app/utils/service_type_label.dart';
import 'package:car_comfort/app/routes/app_pages.dart';
import 'package:car_comfort/app/widgets/driver_active_booking_detail_sheet.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../models/customer_active_booking.dart';
import '../../models/service_model.dart';
import '../../network/response/booking_detail_response.dart' as bd;
import '../../network/response/booking_list_response.dart' as bl;
import '../../network/response/unassigned_booking_response.dart' as ub;
import '../../network/response/common_response.dart';
import '../../network/utils/log_util.dart';
import '../../network/repository/auth_repository.dart';
import '../../network/response/profile_response.dart';
import '../../network/utils/network_exception.dart';
import 'package:get/get.dart';
import 'package:onesignal_flutter/onesignal_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart'
    show
        CameraChangedEventData,
        CameraOptions,
        DefaultLocationPuck2D,
        IconAnchor,
        Layer,
        LineString,
        LocationComponentSettings,
        LocationIndicatorLayer,
        LocationPuck,
        MapAnimationOptions,
        MapContentGestureContext,
        MapboxMap,
        MbxEdgeInsets,
        Point,
        PointAnnotationManager,
        PointAnnotationOptions,
        Position,
        PolylineAnnotationManager,
        PolylineAnnotationOptions,
        PuckBearing,
        StyleLayer;
import 'package:geolocator/geolocator.dart' hide Position;
import 'package:geolocator/geolocator.dart' as geo show Position;
import '../../gen/assets.gen.dart';
import '../settings/settings_controller.dart';
import '../../utils/app_snackbar.dart';
import '../../utils/booking_tracking_messages.dart';
import '../../utils/env_service.dart';
import '../../utils/booking_timer_utils.dart';
import '../../utils/pref.dart';
import '../../utils/permission_utils.dart';
import '../../services/booking_live_socket_service.dart';
import '../service_booking/models/mapbox_place_model.dart';
import '../service_booking/services/mapbox_search_service.dart';
import '../../services/customer_dashboard_socket_service.dart';
import '../../services/driver_dashboard_socket_service.dart';
import '../../services/driver_mapbox_navigation_service.dart';
import '../../services/legal_pages_cache_service.dart';
import '../../services/onesignal_service.dart';
import '../../services/push_booking_notification_handler.dart';
import 'cancel_reason_controller.dart';

class BookingItem {
  final int id;
  final String service;
  final String title;
  final String subtitle;
  final String status;

  /// Raw API status (e.g. `cancelled`) for navigation and detail screens.
  final String lifecycleStatus;
  final String date;
  final String amount;
  final bool hasProviderPayout;
  final String rating;
  final String distanceLabel;
  final bool isDriverAssigned;
  final bool isServiceCompleted;
  final String scheduleLabel;
  final String locationAddress;
  final String? driverAvatarUrl;
  final String serviceTypeSlug;
  final String packageName;
  final String scheduleType;
  final int? packageId;
  final String customPackageName;
  final int? serviceDurationMinutes;
  final dynamic vehicleChargeLimit;
  final String currentBatteryCharge;
  final String currentBatteryStatus;
  final String currentBatteryStatusLabel;

  const BookingItem({
    required this.id,
    required this.service,
    required this.title,
    required this.subtitle,
    required this.status,
    this.lifecycleStatus = '',
    required this.date,
    required this.amount,
    this.hasProviderPayout = false,
    required this.rating,
    required this.distanceLabel,
    this.isDriverAssigned = true,
    this.isServiceCompleted = false,
    required this.scheduleLabel,
    required this.locationAddress,
    this.driverAvatarUrl,
    this.serviceTypeSlug = '',
    this.packageName = '',
    this.scheduleType = '',
    this.packageId,
    this.customPackageName = '',
    this.serviceDurationMinutes,
    this.vehicleChargeLimit,
    this.currentBatteryCharge = '',
    this.currentBatteryStatus = '',
    this.currentBatteryStatusLabel = '',
  });
}

enum PostBookingStage {
  bookingConfirmed, // newly added: booking placed, awaiting provider assignment/trip start
  providerEnRoutePickup,
  serviceStarted,
  providerArrived,
  carOnWayBack,
  carBackHome,
}

enum EnRoutePanelMode { summary, contactOptions, cancelReason }

enum _DriverServiceStopKind { carWash, evCharging }

/// Ordered driver stops: EV charging first, then car wash when both are booked.
class _DriverServiceMapStop {
  const _DriverServiceMapStop({
    required this.lat,
    required this.lng,
    required this.kind,
  });

  final double lat;
  final double lng;
  final _DriverServiceStopKind kind;
}

class DashboardController extends GetxController with WidgetsBindingObserver {
  final DashRepository _dashRepository = DashRepository();

  /// Shared repo for driver/customer dashboard API calls (subclass access).
  DashRepository get dashRepository => _dashRepository;
  static const int _temporaryUserJoinBookingId = 210;
  static const String _activeDriverServiceBookingIdKey =
      Prefs.activeDriverServiceBookingId;
  static const String _activeDriverServiceStartedKey =
      Prefs.activeDriverServiceStarted;
  static const String _activeDriverAssignedBookingIdKey =
      Prefs.activeDriverAssignedBookingId;
  static const String _activeCustomerLiveBookingIdKey =
      Prefs.activeCustomerLiveBookingId;
  static const String _activeCustomerLiveTrackingStartedKey =
      Prefs.activeCustomerLiveTrackingStarted;
  static const String _activeCustomerPostBookingStageKey =
      Prefs.activeCustomerPostBookingStage;
  static const String _activeCustomerTrackingCodeKey =
      Prefs.activeCustomerTrackingCode;
  static const String _activeCustomerPostBookingStartedAtMsKey =
      Prefs.activeCustomerPostBookingStartedAtMs;
  static const String _activeCustomerSocketDriverNameKey =
      Prefs.activeCustomerSocketDriverName;
  static const String _activeCustomerSocketDriverAvatarKey =
      Prefs.activeCustomerSocketDriverAvatar;
  static const String _activeCustomerPickupOtpKey =
      Prefs.activeCustomerPickupOtp;
  static const String _activeCustomerPickupOtpBookingIdKey =
      Prefs.activeCustomerPickupOtpBookingId;
  static const String _customerTripEndedBookingIdKey =
      'customer_trip_ended_booking_id';
  final RxString selectedService = 'combo'.obs;
  final RxBool isServiceDetailsExpanded = false.obs;
  final RxBool hasAcceptedService = false.obs;
  final RxBool hasReadyToHeadService = false.obs;
  final RxBool hasHaveYouArriveLocation = false.obs;
  final RxBool hasArriveForService = false.obs;
  final RxBool hasWaitingOnVehicleService = false.obs;
  final RxBool hasSelectNewServiceLocation = false.obs;
  final RxBool hasCancelTripView = false.obs;
  final RxBool hasVehicleIsEnroteToDropOffPannal = false.obs;
  final RxBool hasStartedService = false.obs;

  /// Pickup reached — show car details / OTP handover instead of "Mark arrived".
  final RxBool hasDriverArrivedAtCustomerPickup = false.obs;
  final RxBool hasOpenedContactOptions = false.obs;

  /// Driver license compliance — refreshed from `GET /driver/me`.
  final RxString driverLicenseExpirationDate = ''.obs;
  final RxBool driverLicenseHoldActive = false.obs;
  final RxBool driverLicenseExpired = false.obs;
  final RxnInt driverLicenseDaysUntilExpiration = RxnInt();
  final RxBool driverLicenseExpiringSoon = false.obs;
  final RxBool driverCanAcceptNewBookings = true.obs;
  final RxString driverAccountStatus = 'active'.obs;
  final RxString driverSuspendedReason = ''.obs;
  final RxBool isDriverLicenseComplianceLoading = false.obs;

  /// Set when driver saved an alternate service location — blocks issue panel loop.
  int? _driverAlternateLocationSavedBookingId;

  /// Which bottom trip sheet is visible on driver home (single source for UI).
  static const String driverHomePanelNone = '';
  static const String driverHomePanelStartPickup = 'start_pickup';
  static const String driverHomePanelPickupEnRoute = 'pickup_enroute';
  static const String driverHomePanelPickupHandover = 'pickup_handover';
  static const String driverHomePanelReadyToHead = 'ready_to_head';
  static const String driverHomePanelEnrouteService = 'enroute_service';
  static const String driverHomePanelArriveService = 'arrive_service';
  static const String driverHomePanelWaitingService = 'waiting_service';
  static const String driverHomePanelSelectLocation = 'select_location';
  static const String driverHomePanelCancelTrip = 'cancel_trip';
  static const String driverHomePanelDropoff = 'dropoff';
  static const String driverHomePanelSafety = 'safety';
  final RxString driverHomeTripPanel = driverHomePanelNone.obs;

  /// Updates [driverHomeTripPanel] on the next frame to avoid semantics/layout crashes.
  void _setDriverHomeTripPanel(String panel) {
    if (driverHomeTripPanel.value == panel) return;
    void apply() {
      if (!isClosed) driverHomeTripPanel.value = panel;
    }

    final phase = SchedulerBinding.instance.schedulerPhase;
    if (phase == SchedulerPhase.idle ||
        phase == SchedulerPhase.postFrameCallbacks) {
      apply();
      return;
    }
    WidgetsBinding.instance.addPostFrameCallback((_) => apply());
  }

  /// While true, nearby unassigned booking cards are hidden on the driver home map
  /// (e.g. after return drop-off, until [Routes.DRIVER_CAR_DETAILS] post-delivery flow is closed).
  final RxBool driverHideUnassignedMapOverlayCards = false.obs;
  final RxBool isDriverStatusUpdating = false.obs;
  final RxBool isDriverReturnDropoffArrivalInFlight = false.obs;
  int _driverReturnLegWorkGeneration = 0;
  bool _openingDriverAfterServiceCarDetails = false;
  final Rxn<int> activeDriverBookingId = Rxn<int>();
  final RxString activeDriverCustomerName = 'Customer'.obs;
  final RxString activeDriverCustomerAvatarUrl = ''.obs;
  final _driverAlternateLocationSearch = MapboxSearchService();
  final driverAlternateServiceOptions = <String>[].obs;
  final driverAlternateServicePlaces = <MapboxPlaceModel>[].obs;
  final driverSelectedAlternateService = RxnString();
  final RxnString driverSelectedAlternateAddress = RxnString();
  final RxnDouble driverSelectedAlternateLat = RxnDouble();
  final RxnDouble driverSelectedAlternateLng = RxnDouble();
  final driverAlternateServiceLocationReasonController =
      TextEditingController();
  final driverManualServiceLocationController = TextEditingController();
  final driverManualServiceLocationSuggestions = <MapboxPlaceModel>[].obs;
  final RxnString driverManualServiceLocationError = RxnString();
  final isSearchingDriverAlternateLocations = false.obs;
  final isSearchingDriverManualServiceLocation = false.obs;
  final isSubmittingDriverAlternateServiceLocation = false.obs;
  final RxnString driverAlternateLocationSearchError = RxnString();
  final driverAlternateLocationDropdownVersion = 0.obs;
  final driverUsesManualAlternateLocation = false.obs;
  Timer? _driverManualServiceLocationDebounce;
  final RxnDouble activeDriverPickupLat = RxnDouble();
  final RxnDouble activeDriverPickupLng = RxnDouble();
  final RxString activeDriverPickupAddress = ''.obs;
  Timer? _driverPickupArrivalTimer;
  static const Duration _driverPickupTrimAndArrivalInterval = Duration(
    seconds: 2,
  );
  Timer? _driverLocationApiHeartbeat;
  StreamSubscription<geo.Position>? _driverLivePositionSub;
  ({double lat, double lng})? _latestDriverLiveCoords;
  DateTime? _latestDriverLiveCoordsAt;
  bool _driverLivePositionStartInFlight = false;
  bool _driverLivePositionShouldRun = false;
  bool _driverLiveSocketStartInFlight = false;
  bool _driverPickupArrivedPopupShown = false;
  bool _driverNearCustomerSent = false;
  Timer? _customerTrackingPollTimer;
  Timer? _customerLiveSocketWatchdog;
  bool _customerLiveReconnectInFlight = false;
  DateTime? _customerLiveTrackingStartedAt;
  DateTime? _customerLiveLastReconnectAt;
  final RxInt _greetingTick = 0.obs;
  final RxInt profileHeaderRevision = 0.obs;
  Timer? _greetingTimer;

  /// Live driver position from [BookingLiveSocketService] (customer / post-booking map).
  final driverLiveLat = RxnDouble();
  final driverLiveLng = RxnDouble();
  final driverLiveStatus = RxnString();

  /// Latest `tracking_status` from [BookingLiveSocketService.onBookingTrackingUpdate].
  final customerSocketTrackingCode = RxnString();

  /// Latest booking workflow status from [BookingLiveSocketService.onBookingStatusUpdate].
  final customerSocketBookingStatusRaw = RxnString();

  /// Pickup OTP from `booking_status_update` when status is `OTP_GENERATED`.
  final customerVehiclePickupOtp = RxnString();

  /// Server `message` for the same event (instructions to share with driver).
  final customerVehiclePickupOtpHint = RxnString();

  /// `message` from last [BookingLiveSocketService.onBookingTrackingUpdate] (customer).
  final customerTrackingUpdateMessage = RxnString();

  /// Driver name from `booking_tracking_update.driver` (customer dashboard / sheet).
  final customerSocketDriverName = RxnString();
  final customerSocketDriverAvatarUrl = RxnString();
  final customerSocketDriverPhone = RxnString();
  final RxnDouble customerSocketDriverRating = RxnDouble();

  /// Dedupes repeated accept-timeout handling (socket + local ticker + refresh).
  int? _driverAcceptTimeoutHandledId;

  /// Dedupes customer no-show board-return handling (API + socket + detail refresh).
  int? _driverCustomerNoShowHandledId;

  bool hasHandledDriverCustomerNoShow(int? bookingId) {
    return bookingId != null &&
        bookingId > 0 &&
        bookingId == _driverCustomerNoShowHandledId;
  }

  void noteDriverCustomerNoShowHandled(int bookingId) {
    if (bookingId <= 0) return;
    _driverCustomerNoShowHandledId = bookingId;
  }

  /// On-demand accept / arrival-wait countdown (socket `booking_timer_update`).
  final bookingTimerPhase = RxnString();
  final bookingTimerExpiresAt = Rxn<DateTime>();
  final bookingTimerTick = 0.obs;
  final driverServiceEnRouteStartedAt = Rxn<DateTime>();
  final driverVehicleBeingServicedStartedAt = Rxn<DateTime>();

  /// Forces a redraw of elapsed-service-time chips every second.
  final serviceTimerTick = 0.obs;

  Timer? _serviceTimerTicker;

  void ensureServiceTimerTick() {
    if (_serviceTimerTicker != null) return;
    _serviceTimerTicker = Timer.periodic(const Duration(seconds: 1), (_) {
      serviceTimerTick.value++;
    });
  }

  void stopServiceTimerTick() {
    _serviceTimerTicker?.cancel();
    _serviceTimerTicker = null;
  }

  void saveDriverServiceEnRouteStartedAt(DateTime? dt) {
    driverServiceEnRouteStartedAt.value = dt;
    if (dt == null) {
      Prefs().removeData(Prefs.driverServiceEnRouteStartedAt);
    } else {
      Prefs().putData(
        Prefs.driverServiceEnRouteStartedAt,
        dt.toIso8601String(),
      );
    }
  }

  void saveDriverVehicleBeingServicedStartedAt(DateTime? dt) {
    driverVehicleBeingServicedStartedAt.value = dt;
    if (dt == null) {
      Prefs().removeData(Prefs.driverVehicleBeingServicedStartedAt);
    } else {
      Prefs().putData(
        Prefs.driverVehicleBeingServicedStartedAt,
        dt.toIso8601String(),
      );
    }
  }

  StreamSubscription<BookingTimerSocketEvent>? bookingTimerSub;
  Timer? bookingTimerUiTick;
  final isMarkingCustomerNoShow = false.obs;

  /// True when bookingTimerExpiresAt was seeded from the local clock rather
  /// than an authoritative server timestamp.  The first server-provided
  /// expires_at must always replace it, even if it is earlier.
  bool acceptDeadlineIsOptimistic = false;

  /// True once the arrival-wait deadline has been locked from an authoritative
  /// source (booking detail or first socket expires_at).  Subsequent socket
  /// ticks must never inflate it past this anchor.
  bool arrivalDeadlineIsAuthoritative = false;

  StreamSubscription<DriverLocationUpdate>? _customerLocationSub;
  StreamSubscription<BookingStatusSocketEvent>? _customerBookingStatusSub;
  StreamSubscription<BookingTrackingSocketEvent>? _customerBookingTrackingSub;
  StreamSubscription<BookingStatusSocketEvent>? _driverBookingStatusSub;
  StreamSubscription<BookingTrackingSocketEvent>? _driverBookingTrackingSub;
  StreamSubscription<BookingStatusSocketEvent>? _driverDashBookingStatusSub;
  StreamSubscription<BookingTimerSocketEvent>? _driverDashBookingTimerSub;
  StreamSubscription<BookingStatusSocketEvent>? _customerDashBookingStatusSub;
  StreamSubscription<BookingTrackingSocketEvent>?
  _customerDashBookingTrackingSub;
  StreamSubscription<Map<String, dynamic>>? _customerDashBookingUpdatedSub;
  StreamSubscription<Map<String, dynamic>>? _customerDashRefundProcessedSub;
  StreamSubscription<Map<String, dynamic>>? _customerDashDisputeOpenedSub;
  StreamSubscription<Map<String, dynamic>>? _customerDashDisputeUpdatedSub;
  StreamSubscription<bl.Bookings>? _driverNewBookingSocketSub;

  /// Android EventChannel — fires when MainActivity.onResume runs (e.g. after
  /// returning from DriverNavigationActivity). We use it to redraw stale routes.
  StreamSubscription<dynamic>? _mapResumeEventSub;
  static const EventChannel _mapResumeChannel = EventChannel(
    'io.carcomfort.app/map_resume',
  );
  Worker? _customerHomeResumeWorker;
  bool _customerLiveTracking = false;
  bool _customerActiveBookingResumeInFlight = false;
  bool _customerTripReconcileInFlight = false;
  bool _driverBookingReconcileInFlight = false;
  int? _bookingCancelledHandledId;

  /// Customer live trip: driver = location pin; destination = customer profile or pin.
  PointAnnotationManager? _customerLiveDriverPinManager;
  PointAnnotationManager? _customerLiveCustomerProfilePinManager;
  PointAnnotationManager? _customerLiveDestinationPinManager;
  PointAnnotationManager? _customerPickupPinManager;
  PointAnnotationManager? _customerServicePinManager;
  PolylineAnnotationManager? _customerLiveRouteManager;
  int? _activeCustomerLiveTrackingBookingId;
  bool _customerLiveCameraFitted = false;
  DateTime? _customerLiveCameraPausedUntil;
  bool _customerLiveCameraUpdateInFlight = false;
  bool _customerLiveCameraUpdatePending = false;
  bool _customerLiveForceFollowPending = false;
  double? _lastCustomerLiveCameraLat;
  double? _lastCustomerLiveCameraLng;
  final Rxn<DateTime> customerLiveEtaArrivalAt = Rxn<DateTime>();
  final Rxn<DateTime> customerLiveLastGpsAt = Rxn<DateTime>();
  final Rxn<DateTime> customerLiveLastStatusAt = Rxn<DateTime>();
  final RxInt customerLiveEtaTick = 0.obs;
  Timer? _customerLiveEtaTicker;
  int _customerLiveEtaRouteRequestGeneration = 0;
  DateTime? _lastCustomerLiveRouteAt;
  double? _lastCustomerLiveRouteDriverLat;
  double? _lastCustomerLiveRouteDriverLng;
  Uint8List? _cachedCustomerLiveCustomerProfileMarkerBytes;
  String _cachedCustomerLiveCustomerProfileAvatarUrl = '';

  static const Duration _customerLiveRouteMinInterval = Duration(seconds: 8);
  static const double _customerLiveRouteMinMoveMeters = 40;
  static const Duration _customerLiveSocketHealthInterval = Duration(
    seconds: 10,
  );
  static const Duration _customerLiveGpsStaleAfter = Duration(seconds: 35);
  static const Duration _customerLiveReconnectThrottle = Duration(seconds: 15);
  static const Duration _customerLiveCameraManualPause = Duration(seconds: 8);
  static const double _customerLiveCameraZoomBoost = 0.65;
  static const double _customerLiveCameraMaxFitZoom = 16.5;
  static const double _customerLiveCameraFollowZoom = 15.75;
  static const double _customerLiveCameraMinMoveMeters = 2;

  void _ensureCustomerLiveEtaTicker() {
    if (_customerLiveEtaTicker != null) return;
    _customerLiveEtaTicker = Timer.periodic(const Duration(seconds: 1), (_) {
      customerLiveEtaTick.value++;
    });
  }

  void _stopCustomerLiveEtaTicker() {
    _customerLiveEtaTicker?.cancel();
    _customerLiveEtaTicker = null;
  }

  void _setCustomerLiveEtaFromRouteSeconds(double seconds) {
    if (!seconds.isFinite || seconds <= 0) return;
    final remaining = seconds.ceil().clamp(1, 86400).toInt();
    customerLiveEtaArrivalAt.value = DateTime.now().add(
      Duration(seconds: remaining),
    );
    _ensureCustomerLiveEtaTicker();
  }

  int get customerLiveEtaRemainingSeconds {
    final arrivalAt = customerLiveEtaArrivalAt.value;
    if (arrivalAt == null) return 0;
    return arrivalAt.difference(DateTime.now()).inSeconds.clamp(0, 86400);
  }

  String get customerLiveEtaCountdownLabel {
    final arrivalAt = customerLiveEtaArrivalAt.value;
    if (arrivalAt == null) return '';
    final remaining = customerLiveEtaRemainingSeconds;
    if (remaining <= 0) return 'Arriving now';
    return formatBookingTimerCountdown(remaining);
  }

  String get customerLiveEtaArrivalClockLabel {
    final arrivalAt = customerLiveEtaArrivalAt.value;
    if (arrivalAt == null) return '';
    final local = arrivalAt.toLocal();
    final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
    final minute = local.minute.toString().padLeft(2, '0');
    final period = local.hour >= 12 ? 'PM' : 'AM';
    return '$hour:$minute $period';
  }

  String _customerLiveFreshnessLabel(DateTime? updatedAt, String prefix) {
    if (updatedAt == null) return '';
    final seconds = DateTime.now()
        .difference(updatedAt)
        .inSeconds
        .clamp(0, 86400);
    if (seconds < 3) return '$prefix updated now';
    if (seconds < 60) return '$prefix updated ${seconds}s ago';
    final minutes = seconds ~/ 60;
    if (minutes < 60) return '$prefix updated ${minutes}m ago';
    return '$prefix update delayed';
  }

  String get customerLiveGpsFreshnessLabel =>
      _customerLiveFreshnessLabel(customerLiveLastGpsAt.value, 'GPS');

  String get customerLiveStatusFreshnessLabel =>
      _customerLiveFreshnessLabel(customerLiveLastStatusAt.value, 'Status');

  bool get customerLiveEtaExpected {
    final leg = _customerLiveRouteLegKeyNow(defaultToPickupWhenEmpty: true);
    return leg == 'pickup' || leg == 'service' || leg == 'return';
  }

  /// Driver navigating to pickup: full directions polyline — trimmed as driver progresses.
  List<Position>? _driverPickupCachedRouteCoords;
  int _driverPickupRouteTrimAnchorSeg = 0;
  PolylineAnnotationManager? _driverPickupRouteManager;
  PointAnnotationManager? _driverEnRouteSelfPinManager;
  PointAnnotationManager? _driverPickupCustomerPinManager;
  bool _driverPickupCameraFitted = false;
  Uint8List? _cachedDriverEnRouteSelfMarkerBytes;
  String _cachedDriverEnRouteSelfAvatarUrl = '';

  /// Driver → service center leg (after pickup): route + car pin + location pin.
  PolylineAnnotationManager? _driverServiceLegRouteManager;
  PointAnnotationManager? _driverServiceLegCarPinManager;
  PointAnnotationManager? _driverServiceLegServiceLocationPinManager;
  PointAnnotationManager? _driverServiceLegEvPinManager;
  List<Position>? _driverServiceLegCachedRouteCoords;
  int _driverServiceLegRouteTrimAnchorSeg = 0;
  List<_DriverServiceMapStop> _driverServiceLegStops = const [];
  Uint8List? _cachedDriverCarPinMarkerBytes;
  int? _cachedDriverCarPinMarkerLayoutKey;
  // Navigation triangle cache — keyed on bearing bucket (5-degree steps) so we
  // don't re-render identical triangles on every GPS tick.
  Uint8List? _cachedNavTriangleBytes;
  double _cachedNavTriangleBearing = -999;
  // Last known driver GPS coords — used to compute bearing between ticks.
  double? _lastDriverNavLat;
  double? _lastDriverNavLng;
  double _lastDriverNavBearing = 0;
  Uint8List? _cachedServicePinBytes;
  String? _cachedServicePinPath;
  Uint8List? _cachedEvPinBytes;
  String? _cachedEvPinPath;
  static const int _serviceMapPinWidthPx = 160;
  static const int _serviceMapPinHeightPx = 192;

  /// Driver → customer pickup (return / drop-off): route + car pin + home pin.
  PolylineAnnotationManager? _driverReturnLegRouteManager;
  PointAnnotationManager? _driverReturnLegCarPinManager;
  PointAnnotationManager? _driverReturnLegHomePinManager;
  List<Position>? _driverReturnLegCachedRouteCoords;
  int _driverReturnLegRouteTrimAnchorSeg = 0;
  bool _driverReturnLegCameraFitted = false;
  bool _driverReturnLegRoutePendingRedraw = false;
  Uint8List? _homePinImageBytes;
  String? _homePinImageLoadedPath;
  static const int _homePinWidthPx = 160;
  static const int _homePinHeightPx = 192;
  static const double _homePinMapIconSize = 1.35;

  /// Set when pickup route is requested before [mapbox] or GPS is ready.
  bool _driverPickupRoutePendingRedraw = false;

  /// Customer live map: cached full directions — trimmed as driver progresses.
  List<Position>? _customerLiveFullRouteCoords;
  int _customerLiveRouteTrimAnchorSeg = 0;

  /// Last route leg (`pickup` / `service` / `return` / `none`) used for [customerSocketTrackingCode].
  String? _customerLiveRouteLegKey;

  /// Set when [location_update] arrives before [mapbox] is ready; cleared after redraw.
  bool _customerLiveRoutePendingRedraw = false;

  void toggleServiceDetails() =>
      isServiceDetailsExpanded.value = !isServiceDetailsExpanded.value;

  void _resetDriverTripPhaseFlags({bool keepStartedService = false}) {
    hasReadyToHeadService.value = false;
    hasHaveYouArriveLocation.value = false;
    hasArriveForService.value = false;
    hasWaitingOnVehicleService.value = false;
    hasSelectNewServiceLocation.value = false;
    hasCancelTripView.value = false;
    hasVehicleIsEnroteToDropOffPannal.value = false;
    hasDriverArrivedAtCustomerPickup.value = false;
    if (!keepStartedService) {
      hasStartedService.value = false;
      hasOpenedContactOptions.value = false;
    }
  }

  /// Derives [driverHomeTripPanel] from trip phase flags (driver home UI only).
  void _recomputeDriverHomeTripPanel() {
    if (!Prefs().isDriverRole) {
      _setDriverHomeTripPanel(driverHomePanelNone);
      return;
    }
    final panelBookingId =
        activeDriverBookingId.value ?? serviceDetailBookingId.value;
    final panelDetail = serviceDetail.value;

    if (panelDetail != null &&
        (BookingTrackingStatus.isBookingServiceCompleted(
              bookingStatus: panelDetail.status?.toString(),
              trackingStatus: panelDetail.trackingStatus?.toString(),
            ) ||
            BookingTrackingStatus.isBookingCancelled(
              bookingStatus: panelDetail.status?.toString(),
              trackingStatus: panelDetail.trackingStatus?.toString(),
            ))) {
      _clearPersistedActiveDriverService();
      _clearPersistedDriverAssignedBooking();
      _resetDriverTripPhaseFlags();
      hasAcceptedService.value = false;
      hasStartedService.value = false;
      driverHideUnassignedMapOverlayCards.value = false;
      if (activeDriverBookingId.value == panelDetail.id) {
        activeDriverBookingId.value = null;
      }
      _setDriverHomeTripPanel(driverHomePanelNone);
      return;
    }

    if (panelDetail != null &&
        panelDetail.id == panelBookingId &&
        isScheduledBooking(
          scheduleType: panelDetail.scheduleType?.toString(),
          scheduledAt: panelDetail.scheduledAt,
          serviceDatetime: panelDetail.serviceDatetime,
        ) &&
        BookingTrackingStatus.isBookingAwaitingProviderTripStart(
          bookingStatus: panelDetail.status?.toString(),
          trackingStatus: panelDetail.trackingStatus?.toString(),
        )) {
      _clearPersistedActiveDriverService();
      _resetDriverTripPhaseFlags();
      hasAcceptedService.value = false;
      hasStartedService.value = false;
      driverHideUnassignedMapOverlayCards.value = false;
      _setDriverHomeTripPanel(driverHomePanelNone);
      return;
    }
    if (hasStartedService.value && hasOpenedContactOptions.value) {
      _setDriverHomeTripPanel(driverHomePanelSafety);
      return;
    }
    if (hasDriverArrivedAtCustomerPickup.value) {
      _setDriverHomeTripPanel(driverHomePanelPickupHandover);
      return;
    }
    if (hasReadyToHeadService.value) {
      _setDriverHomeTripPanel(driverHomePanelReadyToHead);
      return;
    }
    if (hasHaveYouArriveLocation.value) {
      _setDriverHomeTripPanel(driverHomePanelEnrouteService);
      return;
    }
    if (hasSelectNewServiceLocation.value) {
      _setDriverHomeTripPanel(driverHomePanelSelectLocation);
      return;
    }
    if (hasArriveForService.value) {
      _setDriverHomeTripPanel(driverHomePanelArriveService);
      return;
    }
    if (hasWaitingOnVehicleService.value) {
      _setDriverHomeTripPanel(driverHomePanelWaitingService);
      return;
    }
    if (hasCancelTripView.value) {
      _setDriverHomeTripPanel(driverHomePanelCancelTrip);
      return;
    }
    if (hasVehicleIsEnroteToDropOffPannal.value) {
      _setDriverHomeTripPanel(driverHomePanelDropoff);
      return;
    }
    if (hasStartedService.value ||
        shouldShowDriverEnRoutePickupHomePanel ||
        (_isPersistedActiveDriverServiceForBooking(panelBookingId) &&
            !hasDriverArrivedAtCustomerPickup.value)) {
      _setDriverHomeTripPanel(driverHomePanelPickupEnRoute);
      return;
    }
    if (showDriverStartPickupPanel) {
      _setDriverHomeTripPanel(driverHomePanelStartPickup);
      return;
    }
    _setDriverHomeTripPanel(driverHomePanelNone);
  }

  void _applyDriverPickupHandoverUiState() {
    hasAcceptedService.value = true;
    _resetDriverTripPhaseFlags();
    hasStartedService.value = true;
    hasDriverArrivedAtCustomerPickup.value = true;
    _driverPickupArrivedPopupShown = true;
    _driverPickupArrivalTimer?.cancel();
    _driverPickupArrivalTimer = null;
    final currentPhase = normalizeBookingTimerPhase(bookingTimerPhase.value);
    if (currentPhase != 'arrival_countdown' &&
        currentPhase != 'arrival_expired') {
      bookingTimerPhase.value = 'arrival_countdown';
      bookingTimerExpiresAt.value = DateTime.now().add(
        const Duration(minutes: 15),
      );
      ensureBookingTimerUiTicker();
      bindBookingTimerListener();
    }
    _recomputeDriverHomeTripPanel();
  }

  /// Aligns driver home bottom sheet with API [tracking_status] after resume / refresh.
  void _syncDriverTripUiFromServiceDetail([bd.BookingDetailData? detail]) {
    if (!Prefs().isDriverRole) return;
    final bookingId =
        activeDriverBookingId.value ?? serviceDetailBookingId.value;
    final d = detail ?? serviceDetail.value;
    if (bookingId == null || bookingId <= 0 || d == null || d.id != bookingId) {
      return;
    }

    if (BookingTrackingStatus.isDriverAfterServiceDeliveryLocked(
      bookingStatus: d.status?.toString(),
      trackingStatus: d.trackingStatus?.toString(),
    )) {
      hasVehicleIsEnroteToDropOffPannal.value = false;
      return;
    }

    final code = BookingTrackingStatus.normalizeTrackingCode(d.trackingStatus);
    if (BookingTrackingStatus.isBookingCancelled(
          bookingStatus: d.status?.toString(),
          trackingStatus: code,
        ) ||
        BookingTrackingStatus.isBookingServiceCompleted(
          bookingStatus: d.status?.toString(),
          trackingStatus: code,
        )) {
      _clearPersistedActiveDriverService();
      _clearPersistedDriverAssignedBooking();
      resetAcceptedService();
      driverHideUnassignedMapOverlayCards.value = false;
      if (activeDriverBookingId.value == bookingId) {
        activeDriverBookingId.value = null;
      }
      if (serviceDetailBookingId.value == bookingId) {
        serviceDetailBookingId.value = null;
        serviceDetail.value = null;
      }
      unawaited(clearRouteAndPin());
      unawaited(refreshBookings());
      unawaited(fetchDriverNearbyUnassignedBookings(refresh: true));
      return;
    }

    final life = d.status?.toString().trim().toLowerCase() ?? '';
    final startedPref = _isPersistedActiveDriverServiceForBooking(bookingId);
    final scheduledAwaitingStart =
        isScheduledBooking(
          scheduleType: d.scheduleType?.toString(),
          scheduledAt: d.scheduledAt,
          serviceDatetime: d.serviceDatetime,
        ) &&
        BookingTrackingStatus.isBookingAwaitingProviderTripStart(
          bookingStatus: life,
          trackingStatus: code,
        );
    if (scheduledAwaitingStart) {
      _clearPersistedActiveDriverService();
      _resetDriverTripPhaseFlags();
      hasAcceptedService.value = false;
      hasStartedService.value = false;
      driverHideUnassignedMapOverlayCards.value = false;
      _setDriverHomeTripPanel(driverHomePanelNone);
      return;
    }
    // 'assigned'  → on-demand booking accepted but not started.
    // 'confirmed' → scheduled booking accepted but not started.
    // Both cases must show the Start panel and must NOT set hasStartedService.
    final assignedOnly =
        code.isEmpty &&
        (life == 'assigned' || life == 'confirmed') &&
        !startedPref;
    if (assignedOnly) {
      // Stale assigned detail must not hide an active pickup leg the driver just started.
      if (hasStartedService.value && !hasDriverArrivedAtCustomerPickup.value) {
        hasAcceptedService.value = true;
        return;
      }
      _resetDriverTripPhaseFlags();
      hasAcceptedService.value = false;
      hasStartedService.value = false;
      // Re-evaluate the home panel so the correct state is applied when this
      // runs (e.g. after fetchServiceDetail completes or on detail refresh).
      // showDriverStartPickupPanel handles the distinction:
      //   • on-demand  → returns true  → Start panel shown
      //   • scheduled  → returns false (isScheduledScheduleType guard) → no panel
      _recomputeDriverHomeTripPanel();
      return;
    }

    hasAcceptedService.value = true;
    hasOpenedContactOptions.value = false;
    hasCancelTripView.value = false;
    final keepStartedService = hasStartedService.value || startedPref;

    // --- Idempotency guard: if the dropoff panel is already active and the
    // incoming tracking status maps to the same panel, skip the full reset.
    // This prevents stale socket events from overwriting an in-progress
    // dropoff flow that the driver just triggered via "Finish Service".
    final isDropoffPhase =
        (code == BookingTrackingStatus.serviceCompleted ||
        code == BookingTrackingStatus.secondServiceCompleted ||
        code == BookingTrackingStatus.driverLeftServiceCenter ||
        code == BookingTrackingStatus.driverReturningToCustomer);
    if (isDropoffPhase && hasVehicleIsEnroteToDropOffPannal.value) {
      // Already showing dropoff panel for this tracking status — skip reset.
      return;
    }

    _resetDriverTripPhaseFlags(keepStartedService: keepStartedService);

    if (BookingTrackingStatus.isDriverAtCustomerPickupHandover(code)) {
      _applyDriverPickupHandoverUiState();
      _recomputeDriverHomeTripPanel();
      return;
    }

    hasStartedService.value = true;

    switch (code) {
      case BookingTrackingStatus.driverStartedToCustomer:
      case BookingTrackingStatus.driverNearCustomer:
        hasStartedService.value = true;
        break;
      case BookingTrackingStatus.beforeImagesUploaded:
      case BookingTrackingStatus.vehiclePicked:
        hasReadyToHeadService.value = true;
        break;
      case BookingTrackingStatus.driverStartedToServiceCenter:
        hasHaveYouArriveLocation.value = true;
        syncDriverServiceEnRouteTimerFromDetail(d);
        break;
      case BookingTrackingStatus.driverReachedServiceCenter:
        hasArriveForService.value = true;
        break;
      // Provider arrived but service hasn't started — keep the three action buttons.
      case BookingTrackingStatus.vehicleWaitingInQueue:
        hasArriveForService.value = true;
        break;
      // Driver reported a location issue — show picker only while unresolved.
      case BookingTrackingStatus.serviceLocationIssue:
        if (_isDriverAlternateLocationResolvedForBooking(bookingId)) {
          hasReadyToHeadService.value = true;
          break;
        }
        hasSelectNewServiceLocation.value = true;
        unawaited(_loadDriverAlternateServiceLocations());
        break;
      case BookingTrackingStatus.serviceStarted:
      case BookingTrackingStatus.serviceInProgress:
        hasWaitingOnVehicleService.value = true;
        break;
      case BookingTrackingStatus.firstServiceCompleted:
        hasReadyToHeadService.value = true;
        break;
      case BookingTrackingStatus.driverHeadingToNextServiceStop:
        hasHaveYouArriveLocation.value = true;
        syncDriverServiceEnRouteTimerFromDetail(d);
        break;
      case BookingTrackingStatus.driverReachedNextServiceStop:
        hasArriveForService.value = true;
        break;
      case BookingTrackingStatus.secondServiceStarted:
      case BookingTrackingStatus.secondServiceInProgress:
        hasWaitingOnVehicleService.value = true;
        break;
      case BookingTrackingStatus.serviceCompleted:
      case BookingTrackingStatus.secondServiceCompleted:
      case BookingTrackingStatus.driverLeftServiceCenter:
      case BookingTrackingStatus.driverReturningToCustomer:
        _driverPickupArrivalTimer?.cancel();
        _driverPickupArrivalTimer = null;
        hasVehicleIsEnroteToDropOffPannal.value = true;
        break;
      case BookingTrackingStatus.driverReachedCustomerReturn:
      case BookingTrackingStatus.afterImagesUploaded:
        break;
      default:
        if (BookingTrackingStatus.isDriverEnRouteToCustomerPickup(code)) {
          hasStartedService.value = true;
        } else if (code.isEmpty &&
            (life == 'assigned' || life == 'confirmed') &&
            !startedPref) {
          // Accepted (on-demand=assigned / scheduled=confirmed) but not
          // started yet — do not mark service as started.
          hasStartedService.value = false;
          hasAcceptedService.value = false;
        } else {
          hasStartedService.value = true;
        }
        break;
    }
    if (shouldShowDriverEnRoutePickupHomePanel && !hasStartedService.value) {
      hasStartedService.value = true;
      hasAcceptedService.value = true;
    }
    _recomputeDriverHomeTripPanel();
  }

  Future<void> _syncDriverTripUiOnHomeResume() async {
    if (!Prefs().isDriverRole) return;
    if (needsDriverHomeTripPanelResync) {
      await ensureDriverHomeTripPanelSynced();
      return;
    }
    _syncDriverTripUiFromServiceDetail();
    await reconcileDriverHomeBookingState();
  }

  void acceptService() {
    hasAcceptedService.value = true;
    hasReadyToHeadService.value = false;
    hasHaveYouArriveLocation.value = false;
    hasArriveForService.value = false;
    hasWaitingOnVehicleService.value = false;
    hasSelectNewServiceLocation.value = false;
    hasCancelTripView.value = false;
    hasVehicleIsEnroteToDropOffPannal.value = false;
    hasStartedService.value = true;
    hasDriverArrivedAtCustomerPickup.value = false;
    hasOpenedContactOptions.value = false;
    _recomputeDriverHomeTripPanel();
  }

  void setReadyToHeadService() {
    hasAcceptedService.value = true;
    hasReadyToHeadService.value = true;
    hasHaveYouArriveLocation.value = false;
    hasArriveForService.value = false;
    hasWaitingOnVehicleService.value = false;
    hasSelectNewServiceLocation.value = false;
    hasCancelTripView.value = false;
    hasVehicleIsEnroteToDropOffPannal.value = false;
    hasStartedService.value = true;
    hasDriverArrivedAtCustomerPickup.value = false;
    hasOpenedContactOptions.value = false;
    final id = activeDriverBookingId.value ?? serviceDetailBookingId.value;
    if (id != null && id > 0) {
      unawaited(fetchServiceDetail(bookingId: id, force: true));
    }
    _recomputeDriverHomeTripPanel();
    unawaited(_postHandoffTrackingSequence());
  }

  Future<void> _postHandoffTrackingSequence() async {
    final id = activeDriverBookingId.value ?? serviceDetailBookingId.value;
    if (id == null || id <= 0) return;
    if (serviceDetail.value?.id != id) {
      await fetchServiceDetail(bookingId: id, force: true);
    }
    final current = serviceDetail.value?.trackingStatus?.toString();
    if (BookingTrackingStatus.isAtOrPastTracking(
      current,
      BookingTrackingStatus.vehiclePicked,
    )) {
      return;
    }
    await _postBookingTrackingStatus(
      BookingTrackingStatus.vehiclePicked,
      bookingId: id,
      silentErrors: true,
    );
  }

  Future<void> haveYouArriveLocation() async {
    _driverAlternateLocationSavedBookingId = null;
    _driverPickupArrivalTimer?.cancel();
    _driverPickupCachedRouteCoords = null;
    _driverPickupRouteTrimAnchorSeg = 0;
    _driverPickupRoutePendingRedraw = false;
    unawaited(_disposeDriverEnRouteMapAnnotations());
    hasAcceptedService.value = true;
    hasReadyToHeadService.value = false;
    hasHaveYouArriveLocation.value = true;
    hasArriveForService.value = false;
    hasWaitingOnVehicleService.value = false;
    hasSelectNewServiceLocation.value = false;
    hasCancelTripView.value = false;
    hasVehicleIsEnroteToDropOffPannal.value = false;
    hasStartedService.value = true;
    hasOpenedContactOptions.value = false;
    _recomputeDriverHomeTripPanel();

    final startedAt = DateTime.now();
    saveDriverServiceEnRouteStartedAt(startedAt);
    ensureBookingTimerUiTicker();
    ensureServiceTimerTick();

    final ok = await submitDriverBookingTrackingStatus(
      _driverHeadingToComboSecondStop
          ? BookingTrackingStatus.driverHeadingToNextServiceStop
          : BookingTrackingStatus.driverStartedToServiceCenter,
    );
    if (!ok) {
      saveDriverServiceEnRouteStartedAt(null);
      hasHaveYouArriveLocation.value = false;
      hasReadyToHeadService.value = true;
      _recomputeDriverHomeTripPanel();
      return;
    }

    _recomputeDriverHomeTripPanel();
    unawaited(drawDriverRouteToServiceCenterWithCustomPins());
    unawaited(startDriverTurnByTurnToServiceCenter());
    final id = activeDriverBookingId.value ?? serviceDetailBookingId.value;
    if (id != null && id > 0) {
      unawaited(fetchServiceDetail(bookingId: id, force: true));
    }
  }

  void arriveForService() {
    saveDriverServiceEnRouteStartedAt(null);
    // Seed vehicle-being-serviced timer so elapsed counter works even before
    // the driver taps "Vehicle Being Serviced".
    saveDriverVehicleBeingServicedStartedAt(DateTime.now());
    hasAcceptedService.value = true;
    hasReadyToHeadService.value = false;
    hasHaveYouArriveLocation.value = false;
    hasArriveForService.value = true;
    hasWaitingOnVehicleService.value = false;
    hasSelectNewServiceLocation.value = false;
    hasCancelTripView.value = false;
    hasVehicleIsEnroteToDropOffPannal.value = false;
    hasStartedService.value = true;
    hasOpenedContactOptions.value = false;
    _recomputeDriverHomeTripPanel();
    ensureServiceTimerTick();
    unawaited(
      submitDriverBookingTrackingStatus(
        _driverHeadingToComboSecondStop
            ? BookingTrackingStatus.driverReachedNextServiceStop
            : BookingTrackingStatus.driverReachedServiceCenter,
      ),
    );
    unawaited(drawDriverRouteToServiceCenterWithCustomPins());
  }

  /// Driver: vehicle is actively being serviced — sends SERVICE_STARTED to notify the customer.
  void vehicleBeingServiced() {
    hasAcceptedService.value = true;
    hasReadyToHeadService.value = false;
    hasHaveYouArriveLocation.value = false;
    hasArriveForService.value = false;
    hasWaitingOnVehicleService.value = true;
    hasSelectNewServiceLocation.value = false;
    hasCancelTripView.value = false;
    hasVehicleIsEnroteToDropOffPannal.value = false;
    hasStartedService.value = true;
    hasOpenedContactOptions.value = false;

    saveDriverVehicleBeingServicedStartedAt(DateTime.now());
    ensureBookingTimerUiTicker();
    ensureServiceTimerTick();

    _recomputeDriverHomeTripPanel();
    unawaited(
      submitDriverBookingTrackingStatus(
        _driverHeadingToComboSecondStop || _comboServiceStopIndex >= 1
            ? BookingTrackingStatus.secondServiceStarted
            : BookingTrackingStatus.serviceStarted,
      ),
    );
  }

  /// Driver: vehicle is queued / waiting to be serviced — sends VEHICLE_WAITING_IN_QUEUE
  /// so the customer receives a distinct "waiting in queue" notification instead of
  /// the "Your service has started" notification.
  void waitingOnVehicleService() {
    hasAcceptedService.value = true;
    hasReadyToHeadService.value = false;
    hasHaveYouArriveLocation.value = false;
    hasArriveForService.value = false;
    hasWaitingOnVehicleService.value = true;
    hasSelectNewServiceLocation.value = false;
    hasCancelTripView.value = false;
    hasVehicleIsEnroteToDropOffPannal.value = false;
    hasStartedService.value = true;
    hasOpenedContactOptions.value = false;
    _recomputeDriverHomeTripPanel();
    unawaited(
      submitDriverBookingTrackingStatus(
        BookingTrackingStatus.vehicleWaitingInQueue,
      ),
    );
  }

  void selectNewServiceLocation() {
    hasAcceptedService.value = true;
    hasReadyToHeadService.value = false;
    hasHaveYouArriveLocation.value = false;
    hasArriveForService.value = false;
    hasWaitingOnVehicleService.value = false;
    hasSelectNewServiceLocation.value = true;
    hasCancelTripView.value = false;
    hasVehicleIsEnroteToDropOffPannal.value = false;
    hasStartedService.value = true;
    hasOpenedContactOptions.value = false;
    _resetDriverAlternateServiceLocationForm();
    unawaited(_loadDriverAlternateServiceLocations());
    _recomputeDriverHomeTripPanel();
    unawaited(
      submitDriverBookingTrackingStatus(
        BookingTrackingStatus.serviceLocationIssue,
      ),
    );
  }

  void _resetDriverAlternateServiceLocationForm() {
    _driverManualServiceLocationDebounce?.cancel();
    driverManualServiceLocationController.clear();
    driverAlternateServiceLocationReasonController.clear();
    driverManualServiceLocationSuggestions.clear();
    driverManualServiceLocationError.value = null;
    driverAlternateLocationSearchError.value = null;
    driverUsesManualAlternateLocation.value = false;
    driverSelectedAlternateService.value = null;
    driverSelectedAlternateAddress.value = null;
    driverSelectedAlternateLat.value = null;
    driverSelectedAlternateLng.value = null;
    driverAlternateServiceOptions.clear();
    driverAlternateServicePlaces.clear();
  }

  MapboxSearchCondition _driverAlternateServiceSearchCondition() {
    final st = (serviceDetail.value?.serviceType ?? '').trim().toLowerCase();
    final hasEv = st.contains('ev') || st.contains('charging');
    final hasWash = st.contains('wash') || st.contains('car_wash');
    if (hasEv && hasWash) return MapboxSearchCondition.both;
    if (hasEv) return MapboxSearchCondition.evCharging;
    return MapboxSearchCondition.carWash;
  }

  Future<void> _loadDriverAlternateServiceLocations() async {
    if (!Prefs().isDriverRole) return;
    isSearchingDriverAlternateLocations.value = true;
    driverAlternateLocationSearchError.value = null;
    try {
      final pos = await _geolocationAsMapPosition();
      if (pos == null) {
        driverAlternateLocationSearchError.value =
            'Could not get your current location.';
        return;
      }
      final lat = pos.lat.toDouble();
      final lng = pos.lng.toDouble();
      final places = await _driverAlternateLocationSearch.searchNearbyPlaces(
        latitude: lat,
        longitude: lng,
        condition: _driverAlternateServiceSearchCondition(),
        limit: 30,
      );
      if (places.isEmpty) {
        driverAlternateLocationSearchError.value =
            'No nearby service locations found. Enter an address below.';
        return;
      }
      driverAlternateServicePlaces.assignAll(places);
      driverAlternateServiceOptions.assignAll(
        places.map((e) => '${e.name} • ${e.address}').toList(growable: false),
      );
      setDriverSelectedAlternateService(driverAlternateServiceOptions.first);
      driverAlternateLocationDropdownVersion.value++;
    } catch (e) {
      driverAlternateLocationSearchError.value = '$e';
    } finally {
      isSearchingDriverAlternateLocations.value = false;
    }
  }

  void setDriverSelectedAlternateService(String? value) {
    if (value == null || value.trim().isEmpty) return;
    driverSelectedAlternateService.value = value;
    driverUsesManualAlternateLocation.value = false;
    final idx = driverAlternateServiceOptions.indexOf(value);
    if (idx < 0 || idx >= driverAlternateServicePlaces.length) return;
    final place = driverAlternateServicePlaces[idx];
    driverSelectedAlternateAddress.value = place.address;
    driverSelectedAlternateLat.value = place.latitude;
    driverSelectedAlternateLng.value = place.longitude;
    driverManualServiceLocationController.text = place.address;
  }

  void onDriverManualServiceLocationChanged(String value) {
    _driverManualServiceLocationDebounce?.cancel();
    final query = value.trim();
    if (query.length < 3) {
      driverManualServiceLocationSuggestions.clear();
      driverManualServiceLocationError.value = null;
      return;
    }
    _driverManualServiceLocationDebounce = Timer(
      const Duration(milliseconds: 350),
      () async {
        isSearchingDriverManualServiceLocation.value = true;
        driverManualServiceLocationError.value = null;
        try {
          final lat =
              driverSelectedAlternateLat.value ?? activeDriverPickupLat.value;
          final lng =
              driverSelectedAlternateLng.value ?? activeDriverPickupLng.value;
          final suggestions = await _driverAlternateLocationSearch
              .searchAddressSuggestions(
                query: query,
                latitude: lat,
                longitude: lng,
                limit: 5,
              );
          driverManualServiceLocationSuggestions.assignAll(suggestions);
        } catch (e) {
          driverManualServiceLocationSuggestions.clear();
          driverManualServiceLocationError.value = '$e';
        } finally {
          isSearchingDriverManualServiceLocation.value = false;
        }
      },
    );
  }

  void selectDriverManualServiceLocationSuggestion(MapboxPlaceModel place) {
    driverUsesManualAlternateLocation.value = true;
    driverManualServiceLocationController.text = place.address;
    driverManualServiceLocationController
        .selection = TextSelection.fromPosition(
      TextPosition(offset: driverManualServiceLocationController.text.length),
    );
    driverSelectedAlternateAddress.value = place.address;
    driverSelectedAlternateLat.value = place.latitude;
    driverSelectedAlternateLng.value = place.longitude;
    final customOption = '${place.name} • ${place.address}';
    if (!driverAlternateServiceOptions.contains(customOption)) {
      driverAlternateServicePlaces.insert(0, place);
      driverAlternateServiceOptions.insert(0, customOption);
    }
    driverSelectedAlternateService.value = customOption;
    driverManualServiceLocationSuggestions.clear();
    driverManualServiceLocationError.value = null;
    driverAlternateLocationDropdownVersion.value++;
  }

  Future<void> submitDriverAlternateServiceLocation() async {
    if (!Prefs().isDriverRole) return;
    final bookingId =
        activeDriverBookingId.value ?? serviceDetailBookingId.value;
    if (bookingId == null || bookingId <= 0) {
      showAppSnackBar(
        title: 'Service location',
        message: 'No active booking found.',
        isError: true,
      );
      return;
    }

    final lat = driverSelectedAlternateLat.value;
    final lng = driverSelectedAlternateLng.value;
    final address = (driverSelectedAlternateAddress.value ?? '').trim();
    if (lat == null ||
        lng == null ||
        !lat.isFinite ||
        !lng.isFinite ||
        address.isEmpty) {
      showAppSnackBar(
        title: 'Service location',
        message: 'Please select or enter a service location.',
        isError: true,
      );
      return;
    }

    var reason = driverAlternateServiceLocationReasonController.text.trim();
    if (reason.isEmpty) {
      reason = driverUsesManualAlternateLocation.value
          ? 'Service provider entered alternate service location'
          : 'Service provider selected alternate service location from nearby list';
    }

    if (isSubmittingDriverAlternateServiceLocation.value) return;
    isSubmittingDriverAlternateServiceLocation.value = true;
    try {
      final res = await _dashRepository.patchDriverBookingServiceLocation(
        bookingId: bookingId,
        serviceAddress: address,
        serviceLatitude: lat,
        serviceLongitude: lng,
        reason: reason,
      );
      res.when(
        success: (r) {
          final resolvedTracking =
              _resolveTrackingAfterAlternateServiceLocation(
                responseData: r.data,
              );
          _applyPatchedDriverServiceLocationOnDetail(
            bookingId: bookingId,
            address: address,
            latitude: lat,
            longitude: lng,
            responseData: r.data,
          );
          _resetDriverAlternateServiceLocationForm();
          saveDriverServiceEnRouteStartedAt(null);
          _completeDriverAlternateServiceLocationUi(
            bookingId: bookingId,
            trackingStatus: resolvedTracking,
          );

          showAppSnackBar(
            title: 'Service location',
            message: (r.message ?? 'New service location saved').trim().isEmpty
                ? 'New service location saved'
                : r.message!.trim(),
          );
          unawaited(fetchServiceDetail(bookingId: bookingId, force: true));
          unawaited(drawDriverRouteToServiceCenterWithCustomPins());
        },
        error: (err) {
          showAppSnackBar(
            title: 'Service location',
            message: err.message,
            isError: true,
          );
        },
      );
    } finally {
      isSubmittingDriverAlternateServiceLocation.value = false;
    }
  }

  bool get isDriverTripCancellationBlocked {
    if (!Prefs().isDriverRole) return false;
    if (isDriverAfterServiceDeliveryLocked) return true;
    if (hasHaveYouArriveLocation.value) return false;
    if (hasReadyToHeadService.value ||
        hasArriveForService.value ||
        hasWaitingOnVehicleService.value ||
        hasSelectNewServiceLocation.value ||
        hasVehicleIsEnroteToDropOffPannal.value) {
      return true;
    }
    final detail = serviceDetail.value;
    final id = activeDriverBookingId.value ?? serviceDetailBookingId.value;
    if (detail?.id != id) return false;
    return BookingTrackingStatus.isCancellationBlockedAfterOtp(
      bookingStatus: detail?.status?.toString(),
      trackingStatus: detail?.trackingStatus?.toString(),
    );
  }

  bool get isActiveTripCancellationBlocked {
    if (Prefs().isCustomerRole) {
      final detail = serviceDetail.value;
      final tripId =
          postBookingApiId.value ?? _activeCustomerLiveTrackingBookingId;
      final tracking =
          (customerSocketTrackingCode.value ?? '').trim().isNotEmpty
          ? customerSocketTrackingCode.value
          : (detail?.id == tripId ? detail?.trackingStatus?.toString() : null);
      return BookingTrackingStatus.isCancellationBlockedAfterOtp(
        bookingStatus: detail?.id == tripId ? detail?.status?.toString() : null,
        trackingStatus: tracking,
      );
    }
    return isDriverTripCancellationBlocked;
  }

  Future<void> handleBookingCancelledFromApp(int bookingId) async {
    await _handleBookingCancelled(bookingId);
  }

  void openCancelTripView() {
    if (isDriverTripCancellationBlocked) {
      showAppSnackBar(
        title: 'Cannot cancel trip',
        message:
            'This booking cannot be cancelled after vehicle handover OTP verification.',
        isError: true,
      );
      return;
    }
    final bookingId =
        activeDriverBookingId.value ?? serviceDetailBookingId.value;
    if (bookingId != null &&
        bookingId > 0 &&
        Get.isRegistered<CancelReasonController>()) {
      Get.find<CancelReasonController>().beginCancelForBooking(bookingId);
    }
    hasAcceptedService.value = true;
    hasReadyToHeadService.value = false;
    hasHaveYouArriveLocation.value = false;
    hasArriveForService.value = false;
    hasWaitingOnVehicleService.value = false;
    hasSelectNewServiceLocation.value = false;
    hasCancelTripView.value = true;
    hasVehicleIsEnroteToDropOffPannal.value = false;
    hasStartedService.value = true;
    hasOpenedContactOptions.value = false;
    _recomputeDriverHomeTripPanel();
  }

  void vehicleIsEnroteToDropOffPannal() {
    if (isDriverAfterServiceDeliveryLocked) {
      unawaited(ensureDriverAfterServiceCarDetailsOpen());
      return;
    }
    if (_isActiveComboBooking &&
        _comboServiceStopIndex == 0 &&
        !BookingTrackingStatus.isComboSecondStopPhase(
          serviceDetail.value?.trackingStatus?.toString(),
        )) {
      unawaited(_completeComboFirstStopAndPrepareSecondLeg());
      return;
    }
    hasAcceptedService.value = true;
    hasReadyToHeadService.value = false;
    hasHaveYouArriveLocation.value = false;
    hasArriveForService.value = false;
    hasWaitingOnVehicleService.value = false;
    hasSelectNewServiceLocation.value = false;
    hasCancelTripView.value = false;
    hasVehicleIsEnroteToDropOffPannal.value = true;
    hasStartedService.value = true;
    hasOpenedContactOptions.value = false;
    // The pickup proximity watcher belongs only to the outbound leg. If it is
    // left running during vehicle return, it can clear the drop-off route when
    // the provider gets close to the same customer coordinates.
    _driverPickupArrivalTimer?.cancel();
    _driverPickupArrivalTimer = null;
    _recomputeDriverHomeTripPanel();
    final legGeneration = ++_driverReturnLegWorkGeneration;
    unawaited(() async {
      await _onServiceCompletedAndReturning();
      if (legGeneration != _driverReturnLegWorkGeneration) return;
      if (!hasVehicleIsEnroteToDropOffPannal.value) return;
      await drawDriverRouteToCustomerDropOffWithCustomPins();
      if (legGeneration != _driverReturnLegWorkGeneration) return;
      if (!hasVehicleIsEnroteToDropOffPannal.value) return;
      await startDriverTurnByTurnToDropOff();
    }());
  }

  Future<void> _onServiceCompletedAndReturning() async {
    final id = activeDriverBookingId.value ?? serviceDetailBookingId.value;
    if (id == null || id <= 0) return;
    final completeStatus =
        _isActiveComboBooking &&
            (_comboServiceStopIndex >= 1 ||
                BookingTrackingStatus.isComboSecondStopPhase(
                  serviceDetail.value?.trackingStatus?.toString(),
                ))
        ? BookingTrackingStatus.secondServiceCompleted
        : BookingTrackingStatus.serviceCompleted;
    if (!await submitDriverBookingTrackingStatus(
      completeStatus,
      bookingId: id,
    )) {
      return;
    }
    await submitDriverBookingTrackingStatus(
      BookingTrackingStatus.driverLeftServiceCenter,
      bookingId: id,
      silentErrors: true,
    );
    await submitDriverBookingTrackingStatus(
      BookingTrackingStatus.driverReturningToCustomer,
      bookingId: id,
      silentErrors: true,
    );
    // Stop the service timer ticker — job is done
    stopServiceTimerTick();
  }

  void startService() {
    hasReadyToHeadService.value = false;
    hasHaveYouArriveLocation.value = false;
    hasArriveForService.value = false;
    hasWaitingOnVehicleService.value = false;
    hasSelectNewServiceLocation.value = false;
    hasCancelTripView.value = false;
    hasVehicleIsEnroteToDropOffPannal.value = false;
    hasStartedService.value = true;
    hasOpenedContactOptions.value = false;
  }

  void openContactOptions() {
    hasOpenedContactOptions.value = true;
    _recomputeDriverHomeTripPanel();
  }

  void closeContactOptions() {
    hasOpenedContactOptions.value = false;
    _recomputeDriverHomeTripPanel();
  }

  void resetAcceptedService() {
    driverHideUnassignedMapOverlayCards.value = false;
    _driverPickupArrivalTimer?.cancel();
    _driverPickupArrivalTimer = null;
    _driverLocationApiHeartbeat?.cancel();
    _driverLocationApiHeartbeat = null;
    _stopDriverLivePositionStream();
    if (Get.isRegistered<BookingLiveSocketService>()) {
      Get.find<BookingLiveSocketService>().stopDriverLocationHeartbeat();
    }
    _driverPickupArrivedPopupShown = false;
    _driverNearCustomerSent = false;
    _clearPersistedActiveDriverService();
    _clearPersistedDriverAssignedBooking();
    hasAcceptedService.value = false;
    _resetDriverTripPhaseFlags();
    _setDriverHomeTripPanel(driverHomePanelNone);
  }

  void endCurrentDriverTrip() {
    if (!Prefs().isDriverRole) return;
    if (isDriverAfterServiceDeliveryLocked) {
      showAppSnackBar(
        title: 'Complete delivery',
        message: 'Use Complete delivery on Car Details to finish this booking.',
        isError: true,
      );
      unawaited(ensureDriverAfterServiceCarDetailsOpen());
      return;
    }
    final id = activeDriverBookingId.value ?? serviceDetailBookingId.value;
    if (id != null && id > 0) {
      unawaited(
        submitDriverBookingTrackingStatus(
          BookingTrackingStatus.vehicleDelivered,
          bookingId: id,
          silentErrors: true,
        ),
      );
    }
    resetAcceptedService();
    unawaited(clearRouteAndPin());
    activeDriverBookingId.value = null;
    activeDriverCustomerName.value = 'Customer';
    activeDriverCustomerAvatarUrl.value = '';
    activeDriverPickupLat.value = null;
    activeDriverPickupLng.value = null;
    activeDriverPickupAddress.value = '';
    serviceDetailBookingId.value = null;
    serviceDetail.value = null;
    serviceDetailError.value = '';
  }

  /// Pops every route above [Routes.DRIVER_DASHBOARD] (e.g. car details, service detail).
  void navigateDriverToHomeMap() {
    if (!Prefs().isDriverRole) return;
    homeNavIndex.value = 0;

    void popToDashboard() {
      const dash = Routes.DRIVER_DASHBOARD;
      if (Get.currentRoute == dash) return;

      final navigator = Get.key.currentState;
      if (navigator == null) {
        Get.offNamed(dash);
        return;
      }

      try {
        Get.until((route) => route.settings.name == dash);
      } catch (_) {}

      if (Get.currentRoute != dash) {
        var guard = 0;
        while (navigator.canPop() && Get.currentRoute != dash && guard < 25) {
          Get.back<void>();
          guard++;
        }
      }

      if (Get.currentRoute != dash) {
        Get.offNamed(dash);
      }
    }

    WidgetsBinding.instance.addPostFrameCallback((_) => popToDashboard());
  }

  /// After customer no-show is recorded: clear trip state and return to driver home map.
  void returnDriverToHomeAfterCustomerNoShow() {
    if (!Prefs().isDriverRole) return;
    resetAcceptedService();
    unawaited(clearRouteAndPin());
    activeDriverBookingId.value = null;
    activeDriverCustomerName.value = 'Customer';
    activeDriverCustomerAvatarUrl.value = '';
    activeDriverPickupLat.value = null;
    activeDriverPickupLng.value = null;
    activeDriverPickupAddress.value = '';
    serviceDetailBookingId.value = null;
    serviceDetail.value = null;
    serviceDetailError.value = '';
    if (Get.isRegistered<BookingLiveSocketService>()) {
      final live = Get.find<BookingLiveSocketService>();
      live.stopDriverLocationHeartbeat();
      unawaited(live.disconnect());
    }
    navigateDriverToHomeMap();
  }

  /// Uploads before/after service photos for a booking (`images[]` multipart).
  Future<bool> uploadDriverServiceImages({
    required int bookingId,
    required bool afterService,
    required List<String> imagePaths,
    bool silentErrors = false,
  }) async {
    if (!Prefs().isDriverRole || bookingId <= 0) return false;
    final paths = imagePaths
        .map((p) => p.trim())
        .where((p) => p.isNotEmpty)
        .toList();
    if (paths.isEmpty) return true;

    if (!afterService) {
      final detail = serviceDetail.value;
      if (detail?.id == bookingId &&
          !BookingTrackingStatus.isPickupOtpVerified(detail?.trackingStatus)) {
        showAppSnackBar(
          title: 'Security PIN required',
          message:
              'Verify the customer security PIN before uploading before-service photos.',
          isError: true,
        );
        return false;
      }
    }

    final res = afterService
        ? await _dashRepository.uploadBookingServiceImagesAfter(
            bookingId: bookingId,
            imagePaths: paths,
          )
        : await _dashRepository.uploadBookingServiceImagesBefore(
            bookingId: bookingId,
            imagePaths: paths,
          );

    var ok = false;
    res.when(
      success: (_) => ok = true,
      error: (err) {
        if (!silentErrors) {
          showAppSnackBar(
            title: 'Upload photos',
            message: err.message,
            isError: true,
          );
        }
      },
    );
    return ok;
  }

  /// Verifies the customer pickup PIN so before-service photos can be uploaded.
  Future<bool> verifyDriverPickupPin({
    required int bookingId,
    required String pickupOtp,
  }) async {
    if (!Prefs().isDriverRole || bookingId <= 0) return false;

    final otp = pickupOtp.trim();
    if (otp.length != 4 || int.tryParse(otp) == null) {
      showAppSnackBar(
        title: 'Security PIN',
        message: 'Please enter the 4 digit security PIN.',
        isError: true,
      );
      return false;
    }

    if (serviceDetail.value?.id == bookingId &&
        BookingTrackingStatus.isPickupOtpVerified(
          serviceDetail.value?.trackingStatus,
        )) {
      return true;
    }

    final verifyRes = await _dashRepository.verifyBookingPickupOtp(
      bookingId: bookingId,
      otp: otp,
    );
    var otpOk = false;
    verifyRes.when(
      success: (_) => otpOk = true,
      error: (err) {
        showAppSnackBar(
          title: 'Security PIN',
          message: err.message,
          isError: true,
        );
      },
    );
    if (!otpOk) return false;

    await fetchServiceDetail(bookingId: bookingId, force: true);
    _syncDriverTripUiFromServiceDetail();
    return true;
  }

  /// Driver car details: verify pickup OTP, upload before-service photos, then start the service flow.
  Future<bool> startDriverServiceFromCarDetails({
    required int bookingId,
    required List<String> beforeImagePaths,
    required String pickupOtp,
  }) async {
    if (!Prefs().isDriverRole || bookingId <= 0) return false;

    final paths = beforeImagePaths
        .map((p) => p.trim())
        .where((p) => p.isNotEmpty)
        .toList();
    if (paths.isEmpty) {
      showAppSnackBar(
        title: 'Before service photos',
        message:
            'Please upload at least 4 exterior photos and 10 interior photos before service.',
        isError: true,
      );
      return false;
    }

    final alreadyVerified =
        serviceDetail.value?.id == bookingId &&
        BookingTrackingStatus.isPickupOtpVerified(
          serviceDetail.value?.trackingStatus,
        );

    if (!alreadyVerified) {
      final verified = await verifyDriverPickupPin(
        bookingId: bookingId,
        pickupOtp: pickupOtp,
      );
      if (!verified) return false;
    }

    final uploaded = await uploadDriverServiceImages(
      bookingId: bookingId,
      afterService: false,
      imagePaths: paths,
    );
    if (!uploaded) return false;

    setReadyToHeadService();
    closeContactOptions();
    homeNavIndex.value = 0;
    await fetchServiceDetail(bookingId: bookingId, force: true);
    _syncDriverTripUiFromServiceDetail();
    return true;
  }

  /// Driver: upload after-service photos (if any), then tracking + [vehicleDelivered].
  Future<bool> finalizeDriverDeliveryFromCarDetails({
    required int bookingId,
    bool hasAfterServicePhotos = false,
    List<String> afterImagePaths = const [],
  }) async {
    if (!Prefs().isDriverRole || bookingId <= 0) return false;

    // ── Safety guard: never mark a cancelled booking as completed ──────────
    final currentDetail = serviceDetail.value;
    final bookingStatus = (currentDetail?.status ?? '').toString().trim();
    if (_isCancelledBookingStatus(bookingStatus)) {
      showAppSnackBar(
        title: 'Cannot complete delivery',
        message:
            'This booking has been cancelled and cannot be marked as completed.',
        isError: true,
      );
      return false;
    }

    // ── Safety guard: OTP must be verified before delivery can be finalised ─
    if (!BookingTrackingStatus.isPickupOtpVerified(
      currentDetail?.trackingStatus?.toString(),
    )) {
      showAppSnackBar(
        title: 'OTP required',
        message:
            'Customer security PIN must be verified before completing delivery.',
        isError: true,
      );
      return false;
    }

    final paths = afterImagePaths
        .map((p) => p.trim())
        .where((p) => p.isNotEmpty)
        .toList();
    final shouldUploadAfter = paths.isNotEmpty || hasAfterServicePhotos;

    if (paths.isNotEmpty) {
      final uploaded = await uploadDriverServiceImages(
        bookingId: bookingId,
        afterService: true,
        imagePaths: paths,
      );
      if (!uploaded) return false;
    }

    if (shouldUploadAfter) {
      await fetchServiceDetail(bookingId: bookingId, force: true);
    }
    final okDelivered = await submitDriverBookingTrackingStatus(
      BookingTrackingStatus.vehicleDelivered,
      bookingId: bookingId,
    );
    if (!okDelivered) return false;
    resetAcceptedService();
    unawaited(clearRouteAndPin());
    activeDriverBookingId.value = null;
    activeDriverCustomerName.value = 'Customer';
    activeDriverCustomerAvatarUrl.value = '';
    activeDriverPickupLat.value = null;
    activeDriverPickupLng.value = null;
    activeDriverPickupAddress.value = '';
    serviceDetailBookingId.value = null;
    serviceDetail.value = null;
    serviceDetailError.value = '';
    if (Get.isRegistered<BookingLiveSocketService>()) {
      final live = Get.find<BookingLiveSocketService>();
      live.stopDriverLocationHeartbeat();
      await live.disconnect();
    }
    unawaited(refreshBookings());
    unawaited(fetchDriverNearbyUnassignedBookings(refresh: true));
    return true;
  }

  String get displayName {
    final fullName = Prefs().userFullName().trim();
    if (fullName.isNotEmpty) return fullName;

    final firstName = Prefs().userFirstName().trim();
    if (firstName.isNotEmpty) return firstName;

    return 'Profile';
  }

  String get avatarUrl => Prefs().userImage().trim();

  void refreshProfileHeader() {
    // Force header rebuild after profile sync/write to Prefs.
    profileHeaderRevision.value++;
  }

  /// Greeting shown on dashboard headers — uses device local time (ticks every minute).
  String get greetingLabel {
    _greetingTick.value;
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  /// Bottom nav: 0 home, 1 bookings, 2 settings, 3 support
  final RxInt homeNavIndex = 0.obs;

  final services = <ServiceModel>[].obs;

  /// Opens the standalone service booking flow with a pre-selected service label.
  void openServiceBooking(String serviceLabel) {
    selectedService.value = serviceLabel;
    // Path matches [Routes.SERVICE_BOOKING] — avoid importing app_pages (circular with this file).
    Get.toNamed('/service-booking', arguments: {'service': serviceLabel});
  }

  void openServiceBookingWithId(String serviceLabel, int serviceId) {
    selectedService.value = serviceLabel;
    Get.toNamed(
      '/service-booking',
      arguments: {'service': serviceLabel, 'service_id': serviceId},
    );
  }

  void _loadServices() {
    final jsonStr = Prefs().getServicesList();
    if (jsonStr.isNotEmpty) {
      try {
        final list = jsonDecode(jsonStr) as List;
        services.value = list.map((e) => ServiceModel.fromJson(e)).toList();
      } catch (_) {}
    }
  }

  final bookings = <BookingItem>[].obs;

  /// Raw [bl.Bookings] parallel to [bookings]; driver-role only.
  /// Retained so map overlays can access lat/lng coordinates that [BookingItem] does not carry.
  final RxList<bl.Bookings> driverRawBookings = <bl.Bookings>[].obs;

  final isBookingsLoading = false.obs;
  final isBookingsLoadingMore = false.obs;
  final isBookingsRefreshing = false.obs;
  final bookingsHasMore = true.obs;
  final bookingsFilter = 'all'.obs;

  /// True after the first bookings list fetch finishes (success or error).
  final bookingsInitialLoadDone = false.obs;

  int _bookingsLastLoadedPage = 0;
  int? _bookingsTotalPages;
  int? _bookingsPageLimit;
  bool _bookingsRefreshQueued = false;
  final Set<int> _driverPayoutHydrationInFlight = <int>{};

  final Rxn<bd.BookingDetailData> serviceDetail = Rxn<bd.BookingDetailData>();
  final RxBool isServiceDetailLoading = false.obs;
  final RxString serviceDetailError = ''.obs;
  final Rxn<int> serviceDetailBookingId = Rxn<int>();
  // Driver refreshes may load several bookings at once. Keep their state
  // separate so a background refresh cannot strand a detail route in loading.
  final serviceDetailByBookingId = <int, bd.BookingDetailData>{}.obs;
  final serviceDetailErrorByBookingId = <int, String>{}.obs;
  final serviceDetailLoadingBookingIds = <int>{}.obs;
  final Map<int, int> _serviceDetailRequestVersions = <int, int>{};
  int _serviceDetailRequestVersion = 0;

  bool isServiceDetailLoadingFor(int bookingId) =>
      serviceDetailLoadingBookingIds.contains(bookingId);

  String serviceDetailErrorFor(int bookingId) =>
      serviceDetailErrorByBookingId[bookingId] ?? '';

  String get bookingsFilterLabel {
    switch (bookingsFilter.value) {
      case 'completed':
        return 'Completed';
      case 'pending':
        return 'Pending';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'All';
    }
  }

  void setBookingsFilter(String value) {
    final normalized =
        value == 'completed' || value == 'pending' || value == 'cancelled'
        ? value
        : 'all';
    if (bookingsFilter.value == normalized) return;
    bookingsFilter.value = normalized;
    bookings.clear();
    bookingsInitialLoadDone.value = false;
    _bookingsLastLoadedPage = 0;
    _bookingsTotalPages = null;
    _bookingsPageLimit = null;
    bookingsHasMore.value = true;
    if (isBookingsLoading.value || isBookingsLoadingMore.value) {
      _bookingsRefreshQueued = true;
      return;
    }
    unawaited(fetchBookings());
  }

  MapboxMap? mapbox;
  bool _isRecentering = false;
  bool _locationPermissionSyncInFlight = false;
  bool _locationPermissionRecenterPending = false;
  bool _locationPermissionRecenterInFlight = false;
  bool _suppressNearbyFitAfterLocationPermission = false;
  DateTime? _lastCurrentLocationCameraMoveAt;

  /// True once the driver has panned/zoomed the home map by hand. While set,
  /// automatic recenters (nearby-job refits, bootstrap retries) are suppressed
  /// so the map stays where the driver put it. Cleared on an explicit recenter
  /// request or when returning to the home tab.
  bool _driverMapManuallyMoved = false;
  DateTime? _driverExplicitRecenterFitLockUntil;
  Uint8List? _userPuckImage;
  String _userPuckImageForUrl = '';
  PolylineAnnotationManager? _routeAnnotationManager;
  PointAnnotationManager? _destinationPinManager;
  Uint8List? _pinImageBytes;
  String? _pinImageLoadedPath;

  /// True when a driving route (and destination pin) is shown on the map.
  final RxBool hasActiveRoute = false.obs;
  final Rxn<DateTime> postBookingStartedAt = Rxn<DateTime>();

  /// Set true only when [reconcileCustomerHomeTripState] or live tracking confirms an active trip.
  final RxBool customerTripPanelEnabled = false.obs;

  /// User tapped close on the trip bottom sheet; cleared when the journey stage advances.
  final RxBool customerTripPanelUserDismissed = false.obs;

  /// Customer-controlled collapsed state for the active booking panel. Unlike
  /// dismissal state, this keeps an always-visible control for reopening it.
  final RxBool customerTripPanelCollapsed = false.obs;

  /// Latest active/upcoming booking for the customer Bookings tab.
  final Rxn<CustomerActiveBooking> customerActiveBooking =
      Rxn<CustomerActiveBooking>();
  bool _customerActiveBookingFetchInFlight = false;

  /// Server booking id for the active en-route journey (set after confirm booking).
  final Rxn<int> postBookingApiId = Rxn<int>();
  final Rx<PostBookingStage> postBookingStage =
      PostBookingStage.providerEnRoutePickup.obs;
  final Rx<EnRoutePanelMode> enRoutePanelMode = EnRoutePanelMode.summary.obs;
  Timer? _postBookingTimer;
  Worker? _driverHomeNavNearbyWorker;
  Worker? _driverHomeRecenterWorker;
  bool _driverHomeTripPanelSyncInFlight = false;
  int _registerDeviceRetryCount = 0;

  /// After [PostBookingStage.providerArrived], user taps Confirm to move
  /// the journey forward while stage updates are event-driven.
  bool _providerArrivalConfirmed = false;

  bool get hasActivePostBookingJourney => postBookingStartedAt.value != null;

  /// True while the customer is joined to a live booking socket with map route updates.
  bool get isCustomerLiveTrackingActive =>
      _customerLiveTracking && (_activeCustomerLiveTrackingBookingId ?? 0) > 0;

  /// Customer home: show bottom trip sheet while post-booking is active **or** live
  /// tracking is on for a booking (e.g. after push + `join_booking`).
  bool get showCustomerTripPanel {
    if (!Prefs().isCustomerRole) return false;
    if (customerTripPanelUserDismissed.value) return false;
    if (!customerTripPanelEnabled.value && !isCustomerLiveTrackingActive) {
      return false;
    }
    if (postBookingApiId.value == null && !isCustomerLiveTrackingActive) {
      return false;
    }
    final tracking = BookingTrackingStatus.normalizeTrackingCode(
      customerSocketTrackingCode.value ??
          serviceDetail.value?.trackingStatus ??
          Prefs().getData(_activeCustomerTrackingCodeKey),
    );
    // Only show the home trip panel once the provider has actually started
    // driving (a known tracking milestone). For confirmed/assigned bookings
    // with no tracking code, the booking is accessible via the Bookings tab.
    if (!BookingTrackingStatus.isProviderTripStarted(tracking)) {
      // Still show for VEHICLE_DELIVERED (delivery inspection) and
      // when live tracking is active.
      if (!isCustomerLiveTrackingActive &&
          !BookingTrackingStatus.isVehicleDelivered(tracking) &&
          postBookingStage.value != PostBookingStage.carBackHome) {
        return false;
      }
    }
    if (!BookingTrackingStatus.shouldShowCustomerTripPanel(
      tracking,
      bookingStatus: serviceDetail.value?.status?.toString(),
    )) {
      return false;
    }
    if (_isExpiredCustomerPickupWaitFromDetail(serviceDetail.value)) {
      return false;
    }
    if (isCustomerLiveTrackingActive) return true;
    return !_customerDeliveryInspectionReviewComplete(
      bookingId: postBookingApiId.value,
    );
  }

  void _ensureCustomerTripPanelForActiveBooking(
    int bookingId, {
    String? trackingCode,
  }) {
    if (!Prefs().isCustomerRole || bookingId <= 0) return;
    final detail = serviceDetail.value;
    final detailApplies = detail != null && detail.id == bookingId;
    final code =
        '${trackingCode ?? customerSocketTrackingCode.value ?? (detailApplies ? detail.trackingStatus : null) ?? Prefs().getData(_activeCustomerTrackingCodeKey)}'
            .trim()
            .toUpperCase();
    final life = detailApplies ? detail.status?.toString() : null;
    if (!BookingTrackingStatus.shouldShowCustomerTripPanel(
      code,
      bookingStatus: life,
    )) {
      customerTripPanelEnabled.value = false;
      return;
    }
    customerTripPanelEnabled.value = true;
    customerTripPanelUserDismissed.value = false;
    postBookingApiId.value = bookingId;
    if (postBookingStartedAt.value == null) {
      postBookingStartedAt.value = DateTime.now();
    }
    homeNavIndex.value = 0;
    if (code.isNotEmpty) {
      _syncPostBookingStageFromTracking(code);
    } else {
      // No tracking code yet — booking confirmed, awaiting provider
      setBookingConfirmedStage();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) return;
    // Returning from Android Location Settings must immediately continue the
    // permission flow and move the map once Location Services are enabled.
    // Give Android a moment to publish the changed service/permission state.
    unawaited(() async {
      await Future<void>.delayed(const Duration(milliseconds: 350));
      if (!isClosed) await _requestLocationPermissionAndSync();
    }());
    if (Prefs().isDriverRole) {
      // Timers and GPS requests can be suspended while an external navigation
      // app is foregrounded. Reconcile the trip and restart both publishers.
      unawaited(() async {
        await _syncDriverPresence();
        await reconcileDriverHomeBookingState();
        final bookingId =
            activeDriverBookingId.value ?? serviceDetailBookingId.value;
        if (bookingId != null && bookingId > 0) {
          _startDriverLocationApiHeartbeat();
        }
      }());
      unawaited(fetchDriverNearbyUnassignedBookings(refresh: true));
      return;
    }
    if (Prefs().isCustomerRole) {
      unawaited(_recoverCustomerLiveSocketIfNeeded(force: true));
      unawaited(_syncCustomerDashboardSocket());
    }
  }

  void onReady() {
    super.onReady();
    WidgetsBinding.instance.addObserver(this);
    _subscribeMapResumeChannel();
    _loadServices();
    _startGreetingTicker();
    refreshProfileHeader();
    unawaited(OneSignalService.registerDeviceWithBackend());
    unawaited(_registerNotificationDeviceForDashboard());
    // Replay any push notification that arrived during cold-start before the
    // session token was available (e.g. wallet / booking tapped from killed app).
    SchedulerBinding.instance.addPostFrameCallback((_) {
      PushBookingNotificationHandler.replayPendingNotification();
    });
    if (Get.isRegistered<SettingsController>()) {
      unawaited(_syncProfileHeaderFromSettings());
    }
    unawaited(fetchBookings());
    unawaited(Get.find<LegalPagesCacheService>().ensurePrefetched());
    // Trigger prompt as soon as screen is ready (especially important on iOS).
    // After the user grants permission, immediately sync GPS + nearby board.
    unawaited(_requestLocationPermissionAndSync());
    _driverHomeNavNearbyWorker = ever(homeNavIndex, (idx) {
      if (Prefs().isDriverRole && idx == 0) {
        unawaited(_syncDriverPresence());
        unawaited(_syncDriverTripUiOnHomeResume());
        unawaited(_guardDriverAfterServiceDeliveryOnHome());
      }
      if (idx == 1) {
        unawaited(refreshBookings());
      }
      // Active Booking tab (index 2, customer only) — refresh on navigate
      if (idx == 2 && Prefs().isCustomerRole) {
        unawaited(fetchActiveBooking());
      }
      unawaited(_syncDriverDashboardSocket());
    });
    _driverHomeRecenterWorker = ever(homeNavIndex, (idx) {
      if (!Prefs().isDriverRole || idx != 0 || mapbox == null) return;
      unawaited(_ensureDriverHomeRecenters());
    });
    _customerHomeResumeWorker = ever(homeNavIndex, (idx) {
      if (!Prefs().isCustomerRole || idx != 0) return;
      unawaited(reconcileCustomerHomeTripState());
    });
    if (Get.isRegistered<DriverDashboardSocketService>()) {
      _driverNewBookingSocketSub = Get.find<DriverDashboardSocketService>()
          .onNewBooking
          .listen(_handleDriverNewBookingFromSocket);
    }
    unawaited(_syncDriverDashboardSocket());
    if (Prefs().isDriverRole) {
      bindDriverCancelledBookingListeners();
      homeNavIndex.value = 0;
      // Apply any initial-tab override passed via route arguments
      // (e.g. wallet notification → arguments: {'initialTab': 2}).
      // Must happen AFTER the homeNavIndex = 0 reset above so it wins.
      final routeArgs = Get.arguments;
      if (routeArgs is Map) {
        final requestedTab = routeArgs['initialTab'];
        if (requestedTab is int && requestedTab > 0) {
          homeNavIndex.value = requestedTab;
        }
      }
      unawaited(refreshDriverLicenseCompliance());
      unawaited(_bootstrapDriverNearbyBoard());
      unawaited(reconcileDriverHomeBookingState());
    } else if (Prefs().isCustomerRole) {
      if (!isCustomerLiveTrackingActive &&
          !_customerTripAwaitingDeliveryInspection()) {
        customerTripPanelEnabled.value = false;
      }
      unawaited(_syncCustomerDashboardSocket());
      unawaited(reconcileCustomerHomeTripState());
      unawaited(fetchActiveBooking());
    }
  }

  @override
  void onInit() {
    super.onInit();
    if (Prefs().isCustomerRole &&
        !isCustomerLiveTrackingActive &&
        !_customerTripAwaitingDeliveryInspection()) {
      customerTripPanelEnabled.value = false;
    }
    if (Prefs().isDriverRole) {
      final enRouteStr = Prefs().getData(Prefs.driverServiceEnRouteStartedAt);
      if (enRouteStr.isNotEmpty) {
        driverServiceEnRouteStartedAt.value = DateTime.tryParse(enRouteStr);
      }
      final svcStr = Prefs().getData(Prefs.driverVehicleBeingServicedStartedAt);
      if (svcStr.isNotEmpty) {
        driverVehicleBeingServicedStartedAt.value = DateTime.tryParse(svcStr);
      }
    }
  }

  Future<void> _syncCustomerDashboardSocket() async {
    if (!Get.isRegistered<CustomerDashboardSocketService>()) return;
    final socket = Get.find<CustomerDashboardSocketService>();
    if (!Prefs().isCustomerRole) {
      await socket.disconnect();
      await unbindCustomerDashboardBookingListeners();
      return;
    }
    await socket.connect();
    bindCustomerDashboardBookingListeners();
  }

  void bindCustomerDashboardBookingListeners() {
    if (!Prefs().isCustomerRole) return;
    if (!Get.isRegistered<CustomerDashboardSocketService>()) return;

    if (_customerDashBookingStatusSub == null) {
      _customerDashBookingStatusSub = Get.find<CustomerDashboardSocketService>()
          .onBookingStatusUpdate
          .listen(_onCustomerDashboardBookingStatusEvent);
    }
    if (_customerDashBookingTrackingSub == null) {
      _customerDashBookingTrackingSub =
          Get.find<CustomerDashboardSocketService>().onBookingTrackingUpdate
              .listen(_onCustomerDashboardBookingTrackingEvent);
    }
    if (_customerDashBookingUpdatedSub == null) {
      _customerDashBookingUpdatedSub =
          Get.find<CustomerDashboardSocketService>().onBookingUpdated.listen(
            _onCustomerDashboardBookingUpdated,
          );
    }
    if (_customerDashRefundProcessedSub == null) {
      _customerDashRefundProcessedSub =
          Get.find<CustomerDashboardSocketService>().onRefundProcessed.listen(
            _onCustomerDashboardRefundProcessed,
          );
    }
    if (_customerDashDisputeOpenedSub == null) {
      _customerDashDisputeOpenedSub = Get.find<CustomerDashboardSocketService>()
          .onDisputeOpened
          .listen(_onCustomerDashboardDisputeOpened);
    }
    if (_customerDashDisputeUpdatedSub == null) {
      _customerDashDisputeUpdatedSub =
          Get.find<CustomerDashboardSocketService>().onDisputeUpdated.listen(
            _onCustomerDashboardDisputeUpdated,
          );
    }
  }

  Future<void> unbindCustomerDashboardBookingListeners() async {
    await _customerDashBookingStatusSub?.cancel();
    _customerDashBookingStatusSub = null;
    await _customerDashBookingTrackingSub?.cancel();
    _customerDashBookingTrackingSub = null;
    await _customerDashBookingUpdatedSub?.cancel();
    _customerDashBookingUpdatedSub = null;
    await _customerDashRefundProcessedSub?.cancel();
    _customerDashRefundProcessedSub = null;
    await _customerDashDisputeOpenedSub?.cancel();
    _customerDashDisputeOpenedSub = null;
    await _customerDashDisputeUpdatedSub?.cancel();
    _customerDashDisputeUpdatedSub = null;
  }

  void _onCustomerDashboardBookingStatusEvent(BookingStatusSocketEvent e) {
    if (!Prefs().isCustomerRole) return;
    final id = e.bookingId;
    if (id == null || id <= 0) return;

    if (_isCancelledBookingStatus(e.status)) {
      unawaited(_handleBookingCancelled(id));
      return;
    }

    unawaited(_resumeCustomerLiveTripForBookingId(id, socketEvent: e));
  }

  void _onCustomerDashboardBookingTrackingEvent(BookingTrackingSocketEvent e) {
    if (!Prefs().isCustomerRole) return;
    final id = e.bookingId;
    if (id == null || id <= 0) return;

    final code = e.trackingStatus.trim().toUpperCase();
    if (code == BookingTrackingStatus.bookingCancelled ||
        _isCancelledBookingStatus(
          '${e.raw['booking_status'] ?? e.raw['bookingStatus'] ?? ''}',
        )) {
      unawaited(_handleBookingCancelled(id));
      return;
    }
    if (code == BookingTrackingStatus.vehicleDelivered) {
      unawaited(_handleCustomerVehicleDelivered(id));
      return;
    }

    final bootstrap = BookingTrackingStatus.shouldBootstrapCustomerLiveTrip(
      code,
      bookingStatus:
          '${e.raw['booking_status'] ?? e.raw['bookingStatus'] ?? ''}',
    );
    if (!customerTripPanelEnabled.value && !bootstrap) {
      return;
    }

    unawaited(
      _resumeCustomerLiveTripForBookingId(
        id,
        trackingCode: code,
        trackingMessage: e.serverMessage,
        pickupOtp: e.pickupOtp,
        driverName: e.driverName,
        driverAvatarUrl: e.driverProfilePictureUrl,
      ),
    );
  }

  void _onCustomerDashboardBookingUpdated(Map<String, dynamic> payload) {
    if (!Prefs().isCustomerRole) return;
    final bookingId = _extractBookingId(payload);
    if (bookingId != null && bookingId > 0) {
      unawaited(fetchServiceDetail(bookingId: bookingId, force: true));
      unawaited(fetchBookings(refresh: true));
    }
    showAppSnackBar(
      title: 'Booking Updated',
      message: 'Your booking has been updated by support.',
    );
  }

  void _onCustomerDashboardRefundProcessed(Map<String, dynamic> payload) {
    if (!Prefs().isCustomerRole) return;
    final bookingId = _extractBookingId(payload);
    if (bookingId != null && bookingId > 0) {
      unawaited(fetchServiceDetail(bookingId: bookingId, force: true));
    }
    final amountRaw = payload['refund_amount'] ?? payload['amount'];
    final amountStr = amountRaw != null
        ? '\$${double.tryParse('$amountRaw')?.toStringAsFixed(2) ?? amountRaw}'
        : '';
    final message = amountStr.isNotEmpty
        ? 'A refund of $amountStr has been issued to your account.'
        : 'A refund has been issued to your account.';
    Get.snackbar(
      '💰 Refund Processed',
      message,
      snackPosition: SnackPosition.TOP,
      backgroundColor: const Color(0xff1B5E20),
      colorText: const Color(0xffFFFFFF),
      duration: const Duration(seconds: 6),
      margin: const EdgeInsets.all(12),
      borderRadius: 12,
    );
  }

  void _onCustomerDashboardDisputeOpened(Map<String, dynamic> payload) {
    if (!Prefs().isCustomerRole) return;
    final bookingId = _extractBookingId(payload);
    if (bookingId != null && bookingId > 0) {
      unawaited(fetchServiceDetail(bookingId: bookingId, force: true));
    }
    showAppSnackBar(
      title: 'Dispute Opened',
      message: 'A dispute has been opened for your booking.',
    );
  }

  void _onCustomerDashboardDisputeUpdated(Map<String, dynamic> payload) {
    if (!Prefs().isCustomerRole) return;
    final bookingId = _extractBookingId(payload);
    if (bookingId != null && bookingId > 0) {
      unawaited(fetchServiceDetail(bookingId: bookingId, force: true));
    }
    final status = '${payload['dispute_status'] ?? payload['status'] ?? ''}'
        .trim()
        .toLowerCase();
    final message = (status == 'resolved' || status == 'closed')
        ? 'Your dispute has been resolved by our support team.'
        : 'Your dispute status has been updated.';
    showAppSnackBar(title: 'Dispute Updated', message: message);
  }

  int? _extractBookingId(Map<String, dynamic> payload) {
    final raw = payload['booking_id'] ?? payload['bookingId'] ?? payload['id'];
    if (raw == null) return null;
    return int.tryParse('$raw');
  }

  bool _customerHasActiveTripContext(int bookingId) {
    if (bookingId <= 0) return false;
    if (_customerLiveTracking &&
        (_activeCustomerLiveTrackingBookingId == bookingId ||
            postBookingApiId.value == bookingId)) {
      return true;
    }
    if (customerTripPanelEnabled.value && postBookingApiId.value == bookingId) {
      return true;
    }
    final persistedId = int.tryParse(
      Prefs().getData(_activeCustomerLiveBookingIdKey).trim(),
    );
    return persistedId == bookingId;
  }

  bd.BookingDetailData? _bookingDetailForCustomerTrip(int? bookingId) {
    final d = serviceDetail.value;
    if (d == null) return null;
    if (bookingId == null || bookingId <= 0 || d.id == bookingId) return d;
    return null;
  }

  /// Inspect/review step done; optional tip does not keep the dashboard trip sheet open.
  bool _customerDeliveryInspectionReviewComplete({
    bd.BookingDetailData? detail,
    int? bookingId,
  }) {
    final resolvedBookingId =
        bookingId ??
        postBookingApiId.value ??
        _activeCustomerLiveTrackingBookingId;
    if (resolvedBookingId != null && resolvedBookingId > 0) {
      final endedId = int.tryParse(
        Prefs().getData(_customerTripEndedBookingIdKey).trim(),
      );
      if (endedId != null && endedId == resolvedBookingId) return true;
    }

    final d = detail ?? _bookingDetailForCustomerTrip(resolvedBookingId);
    if (d == null) return false;
    if (d.hasCustomerReviewedDriver) return true;

    final tracking = BookingTrackingStatus.normalizeTrackingCode(
      customerSocketTrackingCode.value ??
          d.trackingStatus ??
          Prefs().getData(_activeCustomerTrackingCodeKey),
    );
    final life = '${d.status ?? ''}'.trim().toUpperCase();
    final delivered =
        BookingTrackingStatus.isVehicleDelivered(tracking) ||
        postBookingStage.value == PostBookingStage.carBackHome ||
        life == 'COMPLETED';
    if (!delivered) return false;

    return !d.canCustomerReviewDriver;
  }

  bool _customerTripAwaitingDeliveryInspection({
    String? trackingCode,
    bd.BookingDetailData? detail,
    int? bookingId,
  }) {
    if (!Prefs().isCustomerRole) return false;
    final resolvedBookingId =
        bookingId ??
        postBookingApiId.value ??
        _activeCustomerLiveTrackingBookingId;
    if (_customerDeliveryInspectionReviewComplete(
      detail: detail,
      bookingId: resolvedBookingId,
    )) {
      return false;
    }
    if (postBookingStage.value == PostBookingStage.carBackHome) return true;
    final persistedStage = Prefs()
        .getData(_activeCustomerPostBookingStageKey)
        .trim();
    if (persistedStage == PostBookingStage.carBackHome.name) return true;
    final code = BookingTrackingStatus.normalizeTrackingCode(
      trackingCode ??
          detail?.trackingStatus ??
          customerSocketTrackingCode.value ??
          Prefs().getData(_activeCustomerTrackingCodeKey),
    );
    return BookingTrackingStatus.isCustomerAwaitingDeliveryInspection(
      trackingStatus: code,
    );
  }

  /// Customer finished inspect/review from the post-delivery flow (tip optional later).
  void finishCustomerPostDeliveryInspection({int? bookingId}) {
    if (!Prefs().isCustomerRole) return;
    final id = bookingId ?? postBookingApiId.value;
    if (id != null && id > 0) {
      _markCustomerTripEndedInPrefs(id);
    }
    clearPostBookingJourney(immediate: true);
  }

  /// Driver marked delivery — keep bottom sheet for customer inspection.
  Future<void> _handleCustomerVehicleDelivered(int bookingId) async {
    if (!Prefs().isCustomerRole || bookingId <= 0) return;

    _clearCustomerTripEndedMarker();
    _ensureCustomerTripPanelForActiveBooking(
      bookingId,
      trackingCode: BookingTrackingStatus.vehicleDelivered,
    );
    postBookingStage.value = PostBookingStage.carBackHome;
    customerSocketTrackingCode.value = BookingTrackingStatus.vehicleDelivered;
    driverLiveStatus.value = bookingTrackingCustomerMessage(
      BookingTrackingStatus.vehicleDelivered,
    );
    _clearCustomerVehiclePickupOtp();
    _persistCustomerLiveSession(
      bookingId: bookingId,
      trackingCode: BookingTrackingStatus.vehicleDelivered,
    );
    Prefs().putData(
      _activeCustomerPostBookingStageKey,
      PostBookingStage.carBackHome.name,
    );

    if (_customerLiveTracking) {
      await stopCustomerLiveTracking();
    }

    customerTripPanelEnabled.value = true;
    postBookingApiId.value = bookingId;
    postBookingStage.value = PostBookingStage.carBackHome;
    customerSocketTrackingCode.value = BookingTrackingStatus.vehicleDelivered;
    driverLiveStatus.value = bookingTrackingCustomerMessage(
      BookingTrackingStatus.vehicleDelivered,
    );

    unawaited(fetchServiceDetail(bookingId: bookingId, force: true));
    unawaited(fetchActiveBooking());
  }

  static const Duration _arrivalWaitWindow = Duration(minutes: 15);

  bool _isExpiredCustomerPickupWait({
    required String trackingStatus,
    dynamic arrivalWaitExpiresAt,
    dynamic driverArrivedAt,
  }) {
    if (!BookingTrackingStatus.isCustomerPickupOtpSharePhase(trackingStatus)) {
      return false;
    }
    var waitEnds = parseBookingTimerDate(arrivalWaitExpiresAt);
    if (waitEnds == null) {
      final arrived = parseBookingTimerDate(driverArrivedAt);
      if (arrived != null) {
        waitEnds = arrived.add(_arrivalWaitWindow);
      }
    }
    if (waitEnds == null) return false;
    return DateTime.now().isAfter(waitEnds);
  }

  bool _isExpiredCustomerPickupWaitFromDetail(bd.BookingDetailData? detail) {
    if (detail == null) return false;
    return _isExpiredCustomerPickupWait(
      trackingStatus: BookingTrackingStatus.normalizeTrackingCode(
        detail.trackingStatus,
      ),
      arrivalWaitExpiresAt: detail.arrivalWaitExpiresAt,
      driverArrivedAt: detail.driverArrivedCustomerAt,
    );
  }

  bool _isExpiredCustomerPickupWaitFromMap(Map<String, dynamic> booking) {
    return _isExpiredCustomerPickupWait(
      trackingStatus: BookingTrackingStatus.normalizeTrackingCode(
        booking['tracking_status'] ?? booking['trackingStatus'],
      ),
      arrivalWaitExpiresAt:
          booking['arrival_wait_expires_at'] ?? booking['arrivalWaitExpiresAt'],
      driverArrivedAt:
          booking['driver_arrived_customer_at'] ??
          booking['driverArrivedCustomerAt'],
    );
  }

  /// Fetch the customer's latest active/upcoming booking for the Bookings tab.
  Future<void> fetchActiveBooking() async {
    if (!Prefs().isCustomerRole || Prefs().token().trim().isEmpty) return;
    if (_customerActiveBookingFetchInFlight) return;
    _customerActiveBookingFetchInFlight = true;
    try {
      final res = await _dashRepository.fetchCustomerActiveBooking();
      res.when(
        success: (data) {
          final payload = data.data;
          if (payload is Map) {
            final rawBooking = payload['booking'];
            if (rawBooking is Map) {
              customerActiveBooking.value = CustomerActiveBooking.fromJson(
                Map<String, dynamic>.from(rawBooking),
              );
            } else {
              customerActiveBooking.value = null;
            }
          } else {
            customerActiveBooking.value = null;
          }
        },
        error: (_) {},
      );
    } catch (_) {}
    _customerActiveBookingFetchInFlight = false;
  }

  /// Source of truth on dashboard open / home tab: active booking API, then detail validation.
  Future<void> reconcileCustomerHomeTripState() async {
    if (!Prefs().isCustomerRole || Prefs().token().trim().isEmpty) return;
    if (_customerTripReconcileInFlight) return;
    _customerTripReconcileInFlight = true;
    if (!isCustomerLiveTrackingActive &&
        !_customerTripAwaitingDeliveryInspection()) {
      customerTripPanelEnabled.value = false;
    }
    try {
      final res = await _dashRepository.getActiveBooking();
      switch (res) {
        case NetworkError<CommonResponse>():
          final restored = await _tryRestoreCustomerTripFromBookingsList();
          if (!restored) {
            await _validatePersistedCustomerTripOrClear();
          }
        case NetworkSuccess<CommonResponse>(:final data):
          await _reconcileFromActiveBookingResponse(data);
      }
    } finally {
      if (isCustomerLiveTrackingActive) {
        final liveId = _activeCustomerLiveTrackingBookingId;
        if (liveId != null && liveId > 0) {
          _ensureCustomerTripPanelForActiveBooking(liveId);
        }
      } else if (_customerTripAwaitingDeliveryInspection()) {
        final tripId =
            postBookingApiId.value ??
            int.tryParse(
              Prefs().getData(_activeCustomerLiveBookingIdKey).trim(),
            );
        if (tripId != null && tripId > 0) {
          customerTripPanelEnabled.value = true;
          postBookingApiId.value = tripId;
          postBookingStage.value = PostBookingStage.carBackHome;
        }
      } else {
        final tripId = postBookingApiId.value;
        if (tripId != null &&
            tripId > 0 &&
            !_isExpiredCustomerPickupWaitFromDetail(serviceDetail.value) &&
            BookingTrackingStatus.shouldShowCustomerTripPanel(
              serviceDetail.value?.trackingStatus ??
                  customerSocketTrackingCode.value,
              bookingStatus: serviceDetail.value?.status?.toString(),
            )) {
          customerTripPanelEnabled.value = true;
        }
      }
      _customerTripReconcileInFlight = false;
    }
  }

  /// Source of truth on driver dashboard open: active booking API + local cache.
  Future<void> reconcileDriverHomeBookingState() async {
    if (!Prefs().isDriverRole || Prefs().token().trim().isEmpty) return;
    if (_driverBookingReconcileInFlight) return;
    _driverBookingReconcileInFlight = true;
    try {
      final res = await _dashRepository.getActiveBooking();
      switch (res) {
        case NetworkError<CommonResponse>():
          await _restoreDriverAssignedBookingFromPrefs();
        case NetworkSuccess<CommonResponse>(:final data):
          await _reconcileFromActiveDriverBookingResponse(data);
      }
    } finally {
      _driverBookingReconcileInFlight = false;
    }
  }

  Future<void> _reconcileFromActiveDriverBookingResponse(
    CommonResponse response,
  ) async {
    final payload = response.data;
    if (payload is! Map) {
      await _restoreDriverAssignedBookingFromPrefs();
      return;
    }
    final rawBooking = payload['booking'];
    if (rawBooking == null) {
      await _clearStaleDriverActiveSessionIfNeeded();
      return;
    }
    if (rawBooking is! Map) {
      await _clearStaleDriverActiveSessionIfNeeded();
      return;
    }

    final m = Map<String, dynamic>.from(rawBooking);
    final id = int.tryParse('${m['id'] ?? ''}');
    if (id == null || id <= 0) {
      await _clearStaleDriverActiveSessionIfNeeded();
      return;
    }

    final life = '${m['status'] ?? ''}'.trim().toLowerCase();
    if (life == 'cancelled' ||
        life == 'canceled' ||
        BookingTrackingStatus.isBookingCancelled(
          bookingStatus: life,
          trackingStatus: m['tracking_status'] ?? m['trackingStatus'],
        )) {
      await _clearStaleDriverActiveSessionIfNeeded();
      return;
    }

    activeDriverBookingId.value = id;
    serviceDetailBookingId.value = id;
    _persistDriverAssignedBooking(id);
    _seedActiveDriverCustomerFromActiveBookingPayload(m);

    await fetchServiceDetail(bookingId: id, force: true);
    if (serviceDetailError.value.trim().isNotEmpty) {
      await _restoreDriverAssignedBookingFromPrefs();
      return;
    }

    if (BookingTrackingStatus.isDriverAfterServiceDeliveryLocked(
      bookingStatus: serviceDetail.value?.status?.toString(),
      trackingStatus: serviceDetail.value?.trackingStatus?.toString(),
    )) {
      await _clearDriverHomeOverlaysForAfterServiceFlow();
      await ensureDriverAfterServiceCarDetailsOpen();
      return;
    }

    if (_driverActiveBookingShouldClear(serviceDetail.value)) {
      _clearPersistedActiveDriverService();
      _clearPersistedDriverAssignedBooking();
      resetAcceptedService();
      activeDriverBookingId.value = null;
      return;
    }

    final started = _isPersistedActiveDriverServiceForBooking(id);
    final tracking = BookingTrackingStatus.normalizeTrackingCode(
      m['tracking_status'] ??
          m['trackingStatus'] ??
          serviceDetail.value?.trackingStatus,
    );
    // 'assigned'  → on-demand booking accepted but not started.
    // 'confirmed' → scheduled booking accepted but not started.
    // Both cases must NOT draw a navigation route.
    final rawSt =
        serviceDetail.value?.scheduleType?.toString() ??
        (m['schedule_type'] ?? m['scheduleType'])?.toString();
    final scheduledAwaitingStart =
        isScheduledBooking(
          scheduleType: rawSt,
          scheduledAt:
              serviceDetail.value?.scheduledAt ??
              m['scheduled_at'] ??
              m['scheduledAt'],
          serviceDatetime:
              serviceDetail.value?.serviceDatetime ??
              m['service_datetime'] ??
              m['serviceDatetime'],
        ) &&
        BookingTrackingStatus.isBookingAwaitingProviderTripStart(
          bookingStatus: life,
          trackingStatus: tracking,
        );
    if (scheduledAwaitingStart) {
      _clearPersistedActiveDriverService();
      _resetDriverTripPhaseFlags();
      hasAcceptedService.value = false;
      hasStartedService.value = false;
      driverHideUnassignedMapOverlayCards.value = false;
      homeNavIndex.value = 0;
      _syncDriverPickupCoordsFromBookingDetail(id);
      bindBookingTimerListener();
      _setDriverHomeTripPanel(driverHomePanelNone);
      return;
    }

    final assignedOnly =
        tracking.isEmpty &&
        (life == 'assigned' || life == 'confirmed') &&
        !started;

    if (assignedOnly) {
      _resetDriverTripPhaseFlags();
      hasAcceptedService.value = false;
      hasStartedService.value = false;
      driverHideUnassignedMapOverlayCards.value = false;
      homeNavIndex.value = 0;
      _syncDriverPickupCoordsFromBookingDetail(id);
      bindBookingTimerListener();
      // Scheduled bookings: no home-map panel until the provider taps Start
      // on the Service Detail screen. On-demand bookings show Start immediately.
      if (isScheduledBooking(
        scheduleType: rawSt,
        scheduledAt:
            serviceDetail.value?.scheduledAt ??
            m['scheduled_at'] ??
            m['scheduledAt'],
        serviceDatetime:
            serviceDetail.value?.serviceDatetime ??
            m['service_datetime'] ??
            m['serviceDatetime'],
      )) {
        _setDriverHomeTripPanel(driverHomePanelNone);
      } else {
        _setDriverHomeTripPanel(driverHomePanelStartPickup);
      }
      return;
    }

    _syncDriverTripUiFromServiceDetail();
    _recomputeDriverHomeTripPanel();
    _syncDriverPickupCoordsFromBookingDetail(id);
    if (hasStartedService.value ||
        hasDriverArrivedAtCustomerPickup.value ||
        tracking.isNotEmpty) {
      _persistActiveDriverService(id);
    }
    if (Get.isRegistered<BookingLiveSocketService>()) {
      await _ensureDriverJoinedBookingRoomForStatusUpdates(id);
    }
    _startDriverLocationApiHeartbeat();
    // Prefer the explicit API-backed trip phase over the persisted generic
    // "service started" flag. That flag remains true for the whole job and
    // must not restart the original pickup route during service/return legs.
    if (isDriverEnRouteToDropOff) {
      unawaited(drawDriverRouteToCustomerDropOffWithCustomPins());
    } else if (isDriverEnRouteToServiceCenter) {
      unawaited(drawDriverRouteToServiceCenterWithCustomPins());
    } else if (started || isDriverEnRouteToPickup) {
      if (!hasStartedService.value && !hasDriverArrivedAtCustomerPickup.value) {
        startService();
      }
      await _startDriverPickupNavigationAndArrivalWatch();
      await _ensureDriverPickupRouteDrawn();
    }
    bindBookingTimerListener();
    homeNavIndex.value = 0;
  }

  Future<void> _restoreDriverAssignedBookingFromPrefs() async {
    final started = Prefs().getBool(_activeDriverServiceStartedKey);
    final bookingIdRaw = Prefs()
        .getData(
          started
              ? _activeDriverServiceBookingIdKey
              : _activeDriverAssignedBookingIdKey,
        )
        .trim();
    final bookingId = int.tryParse(bookingIdRaw);
    if (bookingId == null || bookingId <= 0) return;

    activeDriverBookingId.value = bookingId;
    serviceDetailBookingId.value = bookingId;
    await fetchServiceDetail(bookingId: bookingId, force: true);
    if (serviceDetailError.value.trim().isNotEmpty ||
        _driverActiveBookingShouldClear(serviceDetail.value)) {
      _clearPersistedActiveDriverService();
      _clearPersistedDriverAssignedBooking();
      resetAcceptedService();
      activeDriverBookingId.value = null;
      return;
    }

    if (BookingTrackingStatus.isDriverAfterServiceDeliveryLocked(
      bookingStatus: serviceDetail.value?.status?.toString(),
      trackingStatus: serviceDetail.value?.trackingStatus?.toString(),
    )) {
      await _clearDriverHomeOverlaysForAfterServiceFlow();
      await ensureDriverAfterServiceCarDetailsOpen();
      return;
    }

    if (started && _isPersistedActiveDriverServiceForBooking(bookingId)) {
      await _restoreActiveDriverServiceSessionIfAny();
      return;
    }
    if (started) {
      _clearPersistedActiveDriverService();
    }

    final tracking = BookingTrackingStatus.normalizeTrackingCode(
      serviceDetail.value?.trackingStatus,
    );
    final life =
        serviceDetail.value?.status?.toString().trim().toLowerCase() ?? '';
    final assignedOnly =
        tracking.isEmpty && (life == 'assigned' || life == 'confirmed');

    if (assignedOnly) {
      _resetDriverTripPhaseFlags();
      hasAcceptedService.value = false;
      hasStartedService.value = false;
      driverHideUnassignedMapOverlayCards.value = false;
      _syncDriverPickupCoordsFromBookingDetail(bookingId);
      bindBookingTimerListener();
      homeNavIndex.value = 0;
      final rawSt = serviceDetail.value?.scheduleType?.toString();
      if (isScheduledBooking(
        scheduleType: rawSt,
        scheduledAt: serviceDetail.value?.scheduledAt,
        serviceDatetime: serviceDetail.value?.serviceDatetime,
      )) {
        _setDriverHomeTripPanel(driverHomePanelNone);
      } else {
        _setDriverHomeTripPanel(driverHomePanelStartPickup);
      }
      return;
    }

    _syncDriverTripUiFromServiceDetail();
    _syncDriverPickupCoordsFromBookingDetail(bookingId);
    if (hasStartedService.value ||
        hasDriverArrivedAtCustomerPickup.value ||
        tracking.isNotEmpty) {
      _persistActiveDriverService(bookingId);
    }
    if (Get.isRegistered<BookingLiveSocketService>()) {
      await _ensureDriverJoinedBookingRoomForStatusUpdates(bookingId);
    }
    _startDriverLocationApiHeartbeat();
    bindBookingTimerListener();
    homeNavIndex.value = 0;
  }

  Future<void> _clearStaleDriverActiveSessionIfNeeded() async {
    final localId =
        activeDriverBookingId.value ??
        int.tryParse(
          Prefs().getData(_activeDriverAssignedBookingIdKey).trim(),
        ) ??
        int.tryParse(Prefs().getData(_activeDriverServiceBookingIdKey).trim());
    if (localId != null && localId > 0) {
      _clearPersistedActiveDriverService();
      _clearPersistedDriverAssignedBooking();
      resetAcceptedService();
      activeDriverBookingId.value = null;
    }
  }

  void _seedActiveDriverCustomerFromActiveBookingPayload(
    Map<String, dynamic> booking,
  ) {
    final rawCustomer =
        booking['customer_detail'] ??
        booking['customerDetail'] ??
        booking['customer'];
    if (rawCustomer is! Map) return;
    final c = Map<String, dynamic>.from(rawCustomer);
    final name = '${c['name'] ?? ''}'.trim();
    if (name.isNotEmpty) activeDriverCustomerName.value = name;
    final avatar = '${c['profile_picture'] ?? c['profilePicture'] ?? ''}'
        .trim();
    if (avatar.isNotEmpty) activeDriverCustomerAvatarUrl.value = avatar;
  }

  /// True when [GET /bookings/active] says this booking is the customer's live trip.
  Future<bool> _customerActiveBookingOnServer(int bookingId) async {
    if (!Prefs().isCustomerRole || bookingId <= 0) return false;

    final endedId = int.tryParse(
      Prefs().getData(_customerTripEndedBookingIdKey).trim(),
    );
    if (endedId != null && endedId == bookingId) return false;

    final res = await _dashRepository.getActiveBooking();
    switch (res) {
      case NetworkSuccess<CommonResponse>(:final data):
        final payload = data.data;
        if (payload is! Map) return false;
        final rawBooking = payload['booking'];
        if (rawBooking is! Map) return false;
        final id = int.tryParse('${rawBooking['id'] ?? ''}');
        if (id != bookingId) return false;
        final life = '${rawBooking['status'] ?? ''}'.trim().toLowerCase();
        if (life == 'cancelled' || life == 'canceled') return false;
        if (BookingTrackingStatus.isBookingCancelled(
          bookingStatus: life,
          trackingStatus:
              rawBooking['tracking_status'] ?? rawBooking['trackingStatus'],
        )) {
          return false;
        }
        return true;
      case NetworkError<CommonResponse>():
        await fetchServiceDetail(bookingId: bookingId, force: true);
        if (serviceDetailError.value.trim().isNotEmpty) return false;
        return !_customerLiveSessionShouldEnd(serviceDetail.value);
    }
  }

  /// Whether the customer may [join_booking] (active API or fresh in-trip tracking).
  Future<bool> _customerMayJoinLiveBooking(
    int bookingId, {
    String? hintTrackingCode,
  }) async {
    if (!Prefs().isCustomerRole || bookingId <= 0) return false;

    final endedId = int.tryParse(
      Prefs().getData(_customerTripEndedBookingIdKey).trim(),
    );
    if (endedId != null && endedId == bookingId) return false;

    if (await _customerActiveBookingOnServer(bookingId)) {
      await fetchServiceDetail(bookingId: bookingId, force: true);
      if (serviceDetailError.value.trim().isNotEmpty) return false;
      if (_customerLiveSessionShouldEnd(serviceDetail.value)) return false;
      final detailCode = BookingTrackingStatus.normalizeTrackingCode(
        serviceDetail.value?.trackingStatus,
      );
      return BookingTrackingStatus.shouldShowCustomerTripPanel(
        detailCode,
        bookingStatus: serviceDetail.value?.status?.toString(),
      );
    }

    if (!BookingTrackingStatus.shouldBootstrapCustomerLiveTrip(
      hintTrackingCode,
      bookingStatus: serviceDetail.value?.status?.toString(),
    )) {
      return false;
    }

    await fetchServiceDetail(bookingId: bookingId, force: true);
    if (serviceDetailError.value.trim().isNotEmpty) return false;
    if (_customerLiveSessionShouldEnd(serviceDetail.value)) return false;

    final detailCode = BookingTrackingStatus.normalizeTrackingCode(
      serviceDetail.value?.trackingStatus,
    );
    return BookingTrackingStatus.shouldShowCustomerTripPanel(
      detailCode,
      bookingStatus: serviceDetail.value?.status?.toString(),
    );
  }

  Future<bool> _tryRestoreCustomerTripFromBookingsList() async {
    if (!Prefs().isCustomerRole) return false;

    if (bookings.isEmpty) {
      await fetchBookings(refresh: true);
    }

    final endedId = int.tryParse(
      Prefs().getData(_customerTripEndedBookingIdKey).trim(),
    );

    for (final item in bookings) {
      if (item.id <= 0) continue;
      if (endedId != null && endedId == item.id) continue;
      if (!item.isDriverAssigned || item.isServiceCompleted) continue;
      final status = item.lifecycleStatus.trim().toLowerCase();
      if (status != 'assigned' && status != 'in_progress') continue;

      await fetchServiceDetail(bookingId: item.id, force: true);
      if (serviceDetailError.value.trim().isNotEmpty) continue;
      if (_customerLiveSessionShouldEnd(serviceDetail.value)) continue;

      final tracking = serviceDetail.value?.trackingStatus?.toString();
      if (!BookingTrackingStatus.shouldShowCustomerTripPanel(
        tracking,
        bookingStatus: status,
      )) {
        continue;
      }

      await _resumeCustomerLiveTripForBookingId(
        item.id,
        trackingCode: tracking,
        driverName: serviceDetail.value?.driverDetail?.name,
        driverAvatarUrl: serviceDetail.value?.driverDetail?.profilePicture,
      );
      return true;
    }
    return false;
  }

  Future<void> _reconcileFromActiveBookingResponse(
    CommonResponse response,
  ) async {
    final payload = response.data;
    if (payload is! Map) {
      await _clearCustomerTripAfterBookingEnded();
      return;
    }
    final rawBooking = payload['booking'];
    if (rawBooking == null) {
      final restored = await _tryRestoreCustomerTripFromBookingsList();
      if (!restored) {
        await _validatePersistedCustomerTripOrClear();
      }
      return;
    }
    if (rawBooking is! Map) {
      await _clearCustomerTripAfterBookingEnded();
      return;
    }
    final m = Map<String, dynamic>.from(rawBooking);
    final id = int.tryParse('${m['id'] ?? ''}');
    if (id == null || id <= 0) {
      await _clearCustomerTripAfterBookingEnded();
      return;
    }
    final life = '${m['status'] ?? ''}'.trim().toLowerCase();
    if (life == 'cancelled' ||
        life == 'canceled' ||
        BookingTrackingStatus.isBookingCancelled(
          bookingStatus: life,
          trackingStatus: m['tracking_status'] ?? m['trackingStatus'],
        )) {
      await _clearCustomerTripAfterBookingEnded(endedBookingId: id);
      return;
    }
    if (_isExpiredCustomerPickupWaitFromMap(m)) {
      await _clearCustomerTripAfterBookingEnded(endedBookingId: id);
      return;
    }
    // Assigned/confirmed but provider has not started — no customer trip panel yet.
    final tracking = BookingTrackingStatus.normalizeTrackingCode(
      m['tracking_status'] ?? m['trackingStatus'],
    );
    if (BookingTrackingStatus.isBookingAwaitingProviderTripStart(
      bookingStatus: life,
      trackingStatus: tracking,
    )) {
      return;
    }
    _applyPersistedCustomerTripCacheForBooking(id);
    _hydrateCustomerVehiclePickupOtpFromBookingMap(m);
    final pickupOtp =
        '${m['vehicle_pickup_otp'] ?? m['vehiclePickupOtp'] ?? m['pickup_otp'] ?? m['pickupOtp'] ?? ''}'
            .trim();
    if (!BookingTrackingStatus.shouldShowCustomerTripPanel(
      tracking,
      bookingStatus: life,
    )) {
      return;
    }
    await _resumeCustomerLiveTripForBookingId(
      id,
      trackingCode: tracking.isEmpty ? null : tracking,
      pickupOtp: pickupOtp.isEmpty ? null : pickupOtp,
      driverName: _driverNameFromActiveBookingPayload(m),
      driverAvatarUrl: _driverAvatarFromActiveBookingPayload(m),
    );
  }

  Future<void> _validatePersistedCustomerTripOrClear() async {
    final hasTripUi =
        postBookingApiId.value != null ||
        _customerLiveTracking ||
        Prefs().getBool(_activeCustomerLiveTrackingStartedKey) ||
        customerTripPanelEnabled.value;
    if (!hasTripUi) {
      _clearPersistedCustomerLiveSession();
      return;
    }

    final bookingId =
        postBookingApiId.value ??
        int.tryParse(Prefs().getData(_activeCustomerLiveBookingIdKey).trim());
    if (bookingId == null || bookingId <= 0) {
      await _clearCustomerTripAfterBookingEnded();
      return;
    }

    final endedId = int.tryParse(
      Prefs().getData(_customerTripEndedBookingIdKey).trim(),
    );
    if (endedId != null && endedId == bookingId) {
      await _clearCustomerTripAfterBookingEnded();
      return;
    }

    await fetchServiceDetail(bookingId: bookingId, force: true);
    if (serviceDetailError.value.trim().isNotEmpty ||
        _customerLiveSessionShouldEnd(serviceDetail.value)) {
      await _clearCustomerTripAfterBookingEnded();
      return;
    }
    _restoreCustomerPickupOtpForBooking(bookingId);

    await _resumeValidatedCustomerLiveSession(bookingId);
  }

  void _applyPersistedCustomerTripCacheForBooking(int bookingId) {
    if (bookingId <= 0) return;
    if (!Prefs().getBool(_activeCustomerLiveTrackingStartedKey)) return;
    final persistedRaw = Prefs()
        .getData(_activeCustomerLiveBookingIdKey)
        .trim();
    if (persistedRaw != bookingId.toString()) return;

    final cachedCode = Prefs().getData(_activeCustomerTrackingCodeKey).trim();
    if (cachedCode.isNotEmpty) {
      customerSocketTrackingCode.value = cachedCode;
    }
    final cachedDriver = Prefs().getData(_activeCustomerSocketDriverNameKey);
    if (cachedDriver.trim().isNotEmpty) {
      customerSocketDriverName.value = cachedDriver.trim();
    }
    final cachedAvatar = Prefs().getData(_activeCustomerSocketDriverAvatarKey);
    if (cachedAvatar.trim().isNotEmpty) {
      customerSocketDriverAvatarUrl.value = cachedAvatar.trim();
    }
    _restoreCustomerPickupOtpForBooking(bookingId);
  }

  Future<void> _resumeValidatedCustomerLiveSession(int bookingId) async {
    if (bookingId <= 0) return;

    final stageRaw = Prefs().getData(_activeCustomerPostBookingStageKey);
    postBookingStage.value = _postBookingStageFromPersistedName(stageRaw);
    final startedMsRaw = Prefs()
        .getData(_activeCustomerPostBookingStartedAtMsKey)
        .trim();
    final startedMs = int.tryParse(startedMsRaw);
    postBookingStartedAt.value = startedMs != null && startedMs > 0
        ? DateTime.fromMillisecondsSinceEpoch(startedMs)
        : DateTime.now();
    postBookingApiId.value = bookingId;
    homeNavIndex.value = 0;
    enRoutePanelMode.value = EnRoutePanelMode.summary;

    _applyPersistedCustomerTripCacheForBooking(bookingId);
    final cachedCode = Prefs().getData(_activeCustomerTrackingCodeKey).trim();
    if (cachedCode.isNotEmpty) {
      _syncPostBookingStageFromTracking(cachedCode);
    }

    customerTripPanelEnabled.value = true;

    if (_customerTripAwaitingDeliveryInspection(trackingCode: cachedCode)) {
      if (cachedCode.isNotEmpty) {
        customerSocketTrackingCode.value = cachedCode;
        driverLiveStatus.value = bookingTrackingCustomerMessage(cachedCode);
      }
      return;
    }

    final cachedDriver = Prefs().getData(_activeCustomerSocketDriverNameKey);
    final cachedAvatar = Prefs().getData(_activeCustomerSocketDriverAvatarKey);

    await startCustomerLiveTracking(
      bookingId,
      pushTrackingCode: cachedCode.isEmpty ? null : cachedCode,
      pushDriverName: cachedDriver.trim().isEmpty ? null : cachedDriver.trim(),
      pushDriverAvatarUrl: cachedAvatar.trim().isEmpty
          ? null
          : cachedAvatar.trim(),
    );
  }

  String? _driverNameFromActiveBookingPayload(Map<String, dynamic> booking) {
    final driver = booking['driver_detail'] ?? booking['driverDetail'];
    if (driver is Map) {
      final name = '${driver['name'] ?? ''}'.trim();
      if (name.isNotEmpty) return name;
    }
    return null;
  }

  String? _driverAvatarFromActiveBookingPayload(Map<String, dynamic> booking) {
    final driver = booking['driver_detail'] ?? booking['driverDetail'];
    if (driver is Map) {
      final url =
          '${driver['profile_picture'] ?? driver['profilePicture'] ?? ''}'
              .trim();
      if (url.isNotEmpty) return url;
    }
    return null;
  }

  Future<void> _resumeCustomerLiveTripForBookingId(
    int bookingId, {
    String? trackingCode,
    String? trackingMessage,
    String? pickupOtp,
    String? driverName,
    String? driverAvatarUrl,
    BookingStatusSocketEvent? socketEvent,
  }) async {
    if (!Prefs().isCustomerRole || bookingId <= 0) return;

    final pushCode = (trackingCode ?? '').trim().toUpperCase();
    if (pushCode.isNotEmpty &&
        !BookingTrackingStatus.isEligibleForLiveSocketJoin(pushCode)) {
      if (BookingTrackingStatus.isBookingCancelled(trackingStatus: pushCode)) {
        await _clearCustomerTripAfterBookingEnded(endedBookingId: bookingId);
      } else if (BookingTrackingStatus.isVehicleDelivered(pushCode)) {
        await _handleCustomerVehicleDelivered(bookingId);
      }
      return;
    }

    if (!await _customerMayJoinLiveBooking(
      bookingId,
      hintTrackingCode: trackingCode,
    )) {
      await fetchServiceDetail(bookingId: bookingId, force: true);
      final detail = serviceDetail.value;
      final panelTracking = trackingCode ?? detail?.trackingStatus?.toString();
      if (BookingTrackingStatus.shouldShowCustomerTripPanel(
        panelTracking,
        bookingStatus: detail?.status?.toString(),
      )) {
        _ensureCustomerTripPanelForActiveBooking(
          bookingId,
          trackingCode: panelTracking,
        );
      }
      if (_customerTripAwaitingDeliveryInspection(
        trackingCode: trackingCode,
        detail: detail,
      )) {
        await _handleCustomerVehicleDelivered(bookingId);
      } else if (_customerHasActiveTripContext(bookingId) &&
          _customerLiveSessionShouldEnd(detail)) {
        await _clearCustomerTripAfterBookingEnded(endedBookingId: bookingId);
      }
      return;
    }

    if (trackingCode != null &&
        (trackingCode.trim().toUpperCase() ==
                BookingTrackingStatus.bookingCancelled ||
            _isCancelledBookingStatus(trackingCode))) {
      unawaited(_handleBookingCancelled(bookingId));
      return;
    }

    final liveId = _activeCustomerLiveTrackingBookingId;
    final alreadyOnTrip =
        _customerLiveTracking &&
        (liveId == bookingId ||
            postBookingApiId.value == bookingId ||
            (Get.isRegistered<BookingLiveSocketService>() &&
                Get.find<BookingLiveSocketService>().activeBookingId ==
                    bookingId));

    if (!alreadyOnTrip) {
      _restoreCustomerPickupOtpForBooking(
        bookingId,
        pickupOtp: pickupOtp ?? socketEvent?.otp,
      );
      await startCustomerLiveTracking(
        bookingId,
        pushTrackingCode: trackingCode,
        pushTrackingMessage: trackingMessage,
        pushPickupOtp: pickupOtp ?? socketEvent?.otp,
        pushDriverName: driverName ?? socketEvent?.driverName,
        pushDriverAvatarUrl:
            driverAvatarUrl ?? socketEvent?.driverProfilePictureUrl,
      );
      return;
    }

    _ensureCustomerTripPanelForActiveBooking(
      bookingId,
      trackingCode: trackingCode,
    );

    _restoreCustomerPickupOtpForBooking(
      bookingId,
      pickupOtp: pickupOtp ?? socketEvent?.otp,
    );

    if (trackingCode != null && trackingCode.trim().isNotEmpty) {
      _applyBookingTrackingSocketEvent(
        BookingTrackingSocketEvent(
          bookingId: bookingId,
          trackingStatus: trackingCode.trim(),
          serverMessage: trackingMessage,
          pickupOtp: pickupOtp ?? socketEvent?.otp,
          driverName: driverName,
          driverProfilePictureUrl: driverAvatarUrl,
          raw: const <String, dynamic>{},
        ),
        joinedBookingId: bookingId,
      );
    } else if (socketEvent != null) {
      _applyCustomerBookingStatusSocketEvent(socketEvent);
      _handleCustomerBookingSocketSideEffects(socketEvent, bookingId);
    }

    unawaited(_recoverCustomerLiveSocketIfNeeded());
    unawaited(fetchServiceDetail(bookingId: bookingId, force: true));
    syncBookingTimersFromServiceDetail(serviceDetail.value);
  }

  /// True once the driver has left the pickup-navigation leg (en route to / at service).
  bool get _driverPastPickupNavigationLeg =>
      hasHaveYouArriveLocation.value ||
      hasArriveForService.value ||
      hasWaitingOnVehicleService.value ||
      hasSelectNewServiceLocation.value ||
      hasVehicleIsEnroteToDropOffPannal.value;

  /// Drop-off arrived: driver must finish after-service photos / delivery on car details.
  bool get isDriverAfterServiceDeliveryLocked {
    if (!Prefs().isDriverRole) return false;
    final detail = serviceDetail.value;
    final id = activeDriverBookingId.value ?? serviceDetailBookingId.value;
    if (detail?.id != id) return false;
    return BookingTrackingStatus.isDriverAfterServiceDeliveryLocked(
      bookingStatus: detail?.status?.toString(),
      trackingStatus: detail?.trackingStatus?.toString(),
    );
  }

  void _patchDriverServiceDetailTracking(int bookingId, String trackingStatus) {
    final normalized = BookingTrackingStatus.normalizeTrackingCode(
      trackingStatus,
    );
    if (normalized == BookingTrackingStatus.serviceLocationIssue &&
        _isDriverAlternateLocationResolvedForBooking(bookingId)) {
      return;
    }
    final detail = serviceDetail.value;
    if (detail?.id != bookingId) return;
    detail!.trackingStatus = trackingStatus;
    if (trackingStatus ==
        BookingTrackingStatus.driverHeadingToNextServiceStop) {
      detail.comboServiceStopIndex = 1;
    }
    serviceDetail.refresh();
    if (Prefs().isDriverRole) {
      _syncDriverTripUiFromServiceDetail(detail);
      _recomputeDriverHomeTripPanel();
    }
  }

  String? _trackingStatusFromPatchServiceLocationResponse(dynamic data) {
    final map = _coerceResponseMap(data);
    if (map == null) return null;
    final raw = map['tracking_status'] ?? map['trackingStatus'];
    final code = BookingTrackingStatus.normalizeTrackingCode(raw?.toString());
    return code.isEmpty ? null : code;
  }

  Map<String, dynamic>? _coerceResponseMap(dynamic data) {
    if (data is Map<String, dynamic>) return data;
    if (data is Map) {
      return Map<String, dynamic>.from(
        data.map((dynamic k, dynamic v) => MapEntry(k.toString(), v)),
      );
    }
    return null;
  }

  bool _isDriverAlternateLocationResolvedForBooking(int bookingId) =>
      _driverAlternateLocationSavedBookingId == bookingId;

  String _defaultTrackingAfterAlternateServiceLocation() =>
      _driverHeadingToComboSecondStop || _comboServiceStopIndex >= 1
      ? BookingTrackingStatus.firstServiceCompleted
      : BookingTrackingStatus.vehiclePicked;

  String _resolveTrackingAfterAlternateServiceLocation({dynamic responseData}) {
    final fromApi = _trackingStatusFromPatchServiceLocationResponse(
      responseData,
    );
    if (fromApi != null &&
        fromApi.isNotEmpty &&
        fromApi != BookingTrackingStatus.serviceLocationIssue) {
      return fromApi;
    }
    return _defaultTrackingAfterAlternateServiceLocation();
  }

  void _completeDriverAlternateServiceLocationUi({
    required int bookingId,
    required String trackingStatus,
  }) {
    _driverAlternateLocationSavedBookingId = bookingId;
    hasSelectNewServiceLocation.value = false;
    hasArriveForService.value = false;
    hasHaveYouArriveLocation.value = false;
    hasWaitingOnVehicleService.value = false;
    hasReadyToHeadService.value = true;
    hasStartedService.value = true;
    hasAcceptedService.value = true;
    hasOpenedContactOptions.value = false;
    _patchDriverServiceDetailTracking(bookingId, trackingStatus);
  }

  void _applyPatchedDriverServiceLocationOnDetail({
    required int bookingId,
    required String address,
    required double latitude,
    required double longitude,
    dynamic responseData,
  }) {
    final detail = serviceDetail.value;
    if (detail?.id != bookingId) return;

    detail!.serviceAddress = address;
    detail.serviceLatitude = latitude;
    detail.serviceLongitude = longitude;

    if (bookingServiceComposition(detail.serviceType).hasEvCharging) {
      detail.evChargingAddress = address;
      detail.chargingLatitude = latitude;
      detail.chargingLongitude = longitude;
    }

    if (responseData is Map) {
      final tracking = _trackingStatusFromPatchServiceLocationResponse(
        responseData,
      );
      if (tracking != null && tracking.isNotEmpty) {
        detail.trackingStatus = tracking;
      }
      final locationMap = _coerceResponseMap(responseData)?['service_location'];
      if (locationMap is Map) {
        final patchedAddress = (locationMap['address'] ?? '').toString().trim();
        final patchedLat = double.tryParse('${locationMap['latitude']}');
        final patchedLng = double.tryParse('${locationMap['longitude']}');
        if (patchedAddress.isNotEmpty) {
          detail.serviceAddress = patchedAddress;
        }
        if (patchedLat != null && patchedLng != null) {
          detail.serviceLatitude = patchedLat;
          detail.serviceLongitude = patchedLng;
          if (bookingServiceComposition(detail.serviceType).hasEvCharging) {
            detail.evChargingAddress = patchedAddress.isNotEmpty
                ? patchedAddress
                : detail.evChargingAddress;
            detail.chargingLatitude = patchedLat;
            detail.chargingLongitude = patchedLng;
          }
        }
      }
    }

    serviceDetail.refresh();
  }

  Future<void> ensureDriverAfterServiceCarDetailsOpen() async {
    if (!Prefs().isDriverRole) return;
    final id = activeDriverBookingId.value ?? serviceDetailBookingId.value;
    if (id == null || id <= 0) return;
    if (serviceDetail.value?.id != id || isServiceDetailLoading.value) {
      await fetchServiceDetail(bookingId: id, force: true);
    }
    if (!isDriverAfterServiceDeliveryLocked) return;
    driverHideUnassignedMapOverlayCards.value = true;
    await _clearDriverHomeOverlaysForAfterServiceFlow();
    await _openDriverAfterServiceCarDetailsOnce(bookingId: id);
  }

  Future<void> _openDriverAfterServiceCarDetailsOnce({
    required int bookingId,
    void Function()? onClosed,
  }) async {
    if (!Prefs().isDriverRole || bookingId <= 0) return;
    if (Get.currentRoute == Routes.DRIVER_CAR_DETAILS) return;
    if (_openingDriverAfterServiceCarDetails) return;

    _openingDriverAfterServiceCarDetails = true;
    serviceDetailBookingId.value = bookingId;
    final nav = Get.toNamed(
      Routes.DRIVER_CAR_DETAILS,
      arguments: <String, dynamic>{
        'bookingId': bookingId,
        'showAfterServicePhotos': true,
      },
    );
    await Future<void>.delayed(Duration.zero);
    _openingDriverAfterServiceCarDetails = false;

    if (nav != null) {
      unawaited(
        nav.then((_) {
          onClosed?.call();
        }),
      );
    }
  }

  void _mergeFetchedServiceDetailTracking(bd.BookingDetailData? incoming) {
    if (incoming == null) return;
    final current = serviceDetail.value;
    if (current?.id != incoming.id) return;
    final local = BookingTrackingStatus.normalizeTrackingCode(
      current?.trackingStatus?.toString(),
    );
    final remote = BookingTrackingStatus.normalizeTrackingCode(
      incoming.trackingStatus?.toString(),
    );
    if (local.isEmpty) return;

    if (_isDriverAlternateLocationResolvedForBooking(incoming.id ?? 0)) {
      if (remote == BookingTrackingStatus.serviceLocationIssue) {
        incoming.trackingStatus = local;
        return;
      }
      if (local == BookingTrackingStatus.vehiclePicked ||
          local == BookingTrackingStatus.firstServiceCompleted) {
        incoming.trackingStatus = local;
        return;
      }
    }

    if (remote.isEmpty && BookingTrackingStatus.isKnownCode(local)) {
      incoming.trackingStatus = local;
      return;
    }
    if (remote == BookingTrackingStatus.serviceLocationIssue &&
        (local == BookingTrackingStatus.vehiclePicked ||
            local == BookingTrackingStatus.firstServiceCompleted)) {
      incoming.trackingStatus = local;
      return;
    }
    if (BookingTrackingStatus.isAtOrPastTracking(local, remote) &&
        !BookingTrackingStatus.isAtOrPastTracking(remote, local)) {
      incoming.trackingStatus = local;
    }
  }

  Future<void> _guardDriverAfterServiceDeliveryOnHome() async {
    if (!Prefs().isDriverRole || !isDriverAfterServiceDeliveryLocked) return;
    await ensureDriverAfterServiceCarDetailsOpen();
  }

  /// Whether driver is still navigating to pickup (route trim + arrival watch).
  bool get isDriverEnRouteToPickup =>
      hasStartedService.value &&
      !hasDriverArrivedAtCustomerPickup.value &&
      !_driverPickupArrivedPopupShown &&
      !_driverPastPickupNavigationLeg;

  /// Pickup TBT is allowed while the started-trip pickup sheet is active (even if
  /// proximity already triggered the arrival popup — driver may reopen navigation).
  bool get canDriverOpenPickupTurnByTurn =>
      hasStartedService.value &&
      !hasDriverArrivedAtCustomerPickup.value &&
      !_driverPastPickupNavigationLeg;

  /// “En Route To Service Location” — hide profile puck; [drawDriverRouteToServiceCenterWithCustomPins] uses car + location pins.
  bool get isDriverEnRouteToServiceCenter =>
      Prefs().isDriverRole && hasHaveYouArriveLocation.value;

  /// Vehicle returning to customer pickup — car pin on route + home pin at pickup.
  bool get isDriverEnRouteToDropOff =>
      Prefs().isDriverRole && hasVehicleIsEnroteToDropOffPannal.value;

  Future<bool> ensureDriverPickupCoordsForBooking(int bookingId) =>
      _ensureDriverPickupCoordsLoaded(bookingId);

  Future<void> refreshDriverRouteToPickup() async {
    if (!Prefs().isDriverRole || !isDriverEnRouteToPickup) return;
    final bookingId =
        activeDriverBookingId.value ?? serviceDetailBookingId.value;
    if (bookingId == null || bookingId <= 0) return;
    if (!await _ensureDriverPickupCoordsLoaded(bookingId)) return;
    final lat = activeDriverPickupLat.value!;
    final lng = activeDriverPickupLng.value!;
    await drawDriverRouteToPickup(pickupLat: lat, pickupLng: lng);
  }

  String _driverPickupWaypointName() {
    final addr = activeDriverPickupAddress.value.trim();
    return addr.isNotEmpty ? addr : 'Customer pickup';
  }

  /// Pickup / service location label for the driver home start panel.
  String get driverActivePickupLocationLabel {
    final addr = activeDriverPickupAddress.value.trim();
    if (addr.isNotEmpty) return addr;
    final detail = serviceDetail.value;
    final pickup = detail?.pickupLocation?.address?.trim();
    if (pickup != null && pickup.isNotEmpty) return pickup;
    final fallback = detail?.address?.trim();
    if (fallback != null && fallback.isNotEmpty) return fallback;
    return 'Pickup location';
  }

  bool get showDriverStartPickupPanel {
    if (!Prefs().isDriverRole) return false;
    if (hasStartedService.value) return false;
    if (shouldShowDriverEnRoutePickupHomePanel) return false;
    if (!canDriverStartOnDemandAcceptPhase) return false;

    final tracking = BookingTrackingStatus.normalizeTrackingCode(
      serviceDetail.value?.trackingStatus,
    );
    final life =
        serviceDetail.value?.status?.toString().trim().toLowerCase() ?? '';
    final scheduleType = serviceDetail.value?.scheduleType?.toString();
    final awaitingStart =
        BookingTrackingStatus.isBookingAwaitingProviderTripStart(
          bookingStatus: life,
          trackingStatus: tracking,
        );

    // Scheduled bookings: hide home start panel until provider taps Start on
    // Service Detail (which posts DRIVER_STARTED_TO_CUSTOMER).
    if (awaitingStart &&
        isScheduledBooking(
          scheduleType: scheduleType,
          scheduledAt: serviceDetail.value?.scheduledAt,
          serviceDatetime: serviceDetail.value?.serviceDatetime,
        )) {
      return false;
    }

    if (hasAcceptedService.value || isDriverOnDemandAcceptCountdownVisible) {
      return true;
    }

    // On-demand (or non-scheduled) assigned booking — show start panel once accepted.
    return activeDriverBookingId.value != null &&
        awaitingStart &&
        !isScheduledBooking(
          scheduleType: scheduleType,
          scheduledAt: serviceDetail.value?.scheduledAt,
          serviceDatetime: serviceDetail.value?.serviceDatetime,
        );
  }

  /// Persisted pickup en-route session — keeps the home sheet visible even if a
  /// stale detail refresh briefly cleared [hasStartedService].
  bool get shouldShowDriverEnRoutePickupHomePanel =>
      Prefs().isDriverRole &&
      _isPersistedActiveDriverServiceForBooking(
        activeDriverBookingId.value ?? serviceDetailBookingId.value,
      ) &&
      !hasDriverArrivedAtCustomerPickup.value &&
      !hasReadyToHeadService.value &&
      !hasHaveYouArriveLocation.value &&
      !hasArriveForService.value &&
      !hasWaitingOnVehicleService.value &&
      !hasSelectNewServiceLocation.value &&
      !hasCancelTripView.value &&
      !hasVehicleIsEnroteToDropOffPannal.value;

  /// Cancel / end-trip shortcut in the home header (below notifications).
  bool get showDriverHomeHeaderCancelAction {
    if (!Prefs().isDriverRole || isDriverTripCancellationBlocked) return false;
    final bookingId =
        activeDriverBookingId.value ?? serviceDetailBookingId.value;
    if (bookingId == null || bookingId <= 0) return false;
    return showDriverStartPickupPanel || isDriverEnRouteToPickup;
  }

  void openDriverHomeCancelAction() {
    if (isDriverTripCancellationBlocked) {
      showAppSnackBar(
        title: 'Cannot cancel trip',
        message:
            'This booking cannot be cancelled after vehicle handover OTP verification.',
        isError: true,
      );
      return;
    }
    final bookingId =
        activeDriverBookingId.value ?? serviceDetailBookingId.value;
    if (bookingId == null || bookingId <= 0) {
      showAppSnackBar(
        title: 'Cancel failed',
        message: 'Active booking could not be identified.',
        isError: true,
      );
      return;
    }
    if (Get.isRegistered<CancelReasonController>()) {
      Get.find<CancelReasonController>().beginCancelForBooking(bookingId);
    }
    hasCancelTripView.value = true;
    _recomputeDriverHomeTripPanel();
  }

  void dismissCancelTripView() {
    hasCancelTripView.value = false;
    if (Get.isRegistered<CancelReasonController>()) {
      Get.find<CancelReasonController>().reset();
    }
    _recomputeDriverHomeTripPanel();
  }

  String _driverServiceStopLabel(
    _DriverServiceMapStop stop, {
    int? stopNumber,
    int? totalStops,
  }) {
    final numbered =
        totalStops != null &&
        totalStops > 1 &&
        stopNumber != null &&
        stopNumber > 0;
    switch (stop.kind) {
      case _DriverServiceStopKind.carWash:
        return numbered ? 'Stop $stopNumber: Car wash' : 'Car wash';
      case _DriverServiceStopKind.evCharging:
        return numbered ? 'Stop $stopNumber: EV charging' : 'EV charging';
    }
  }

  Future<void> startDriverTurnByTurnToPickup({
    bool requireActiveLeg = true,
  }) async {
    if (!Prefs().isDriverRole) return;
    if (requireActiveLeg && !canDriverOpenPickupTurnByTurn) {
      showAppSnackBar(
        title: 'Navigation',
        message: 'Pickup navigation is not available for this trip stage.',
        isError: true,
      );
      return;
    }
    final bookingId =
        activeDriverBookingId.value ?? serviceDetailBookingId.value;
    if (bookingId == null || bookingId <= 0) return;
    if (!await _ensureDriverPickupCoordsLoaded(bookingId)) {
      showAppSnackBar(
        title: 'Navigation',
        message: 'Customer pickup location is not available yet.',
        isError: true,
      );
      return;
    }
    await Get.find<DriverMapboxNavigationService>().navigateToDestinations(
      destinations: [
        (
          name: _driverPickupWaypointName(),
          lat: activeDriverPickupLat.value!,
          lng: activeDriverPickupLng.value!,
        ),
      ],
    );
  }

  Future<void> startDriverTurnByTurnToServiceCenter({
    bool requireActiveLeg = true,
  }) async {
    if (!Prefs().isDriverRole) return;
    if (requireActiveLeg && !isDriverEnRouteToServiceCenter) return;
    final bookingId =
        activeDriverBookingId.value ?? serviceDetailBookingId.value;
    var detail = serviceDetail.value;
    var stops = _driverServiceStopsForCurrentLeg(detail);
    if (stops.isEmpty && bookingId != null && bookingId > 0) {
      await fetchServiceDetail(bookingId: bookingId, force: true);
      detail = serviceDetail.value;
      stops = _driverServiceStopsForCurrentLeg(detail);
    }
    if (stops.isEmpty) {
      showAppSnackBar(
        title: 'Navigation',
        message: 'Service location is not available for this booking yet.',
        isError: true,
      );
      return;
    }
    await Get.find<DriverMapboxNavigationService>().navigateToDestinations(
      destinations: [
        for (var i = 0; i < stops.length; i++)
          (
            name: _driverServiceStopLabel(
              stops[i],
              stopNumber: i + 1,
              totalStops: stops.length,
            ),
            lat: stops[i].lat,
            lng: stops[i].lng,
          ),
      ],
    );
  }

  Future<void> startDriverTurnByTurnToDropOff() async {
    if (!Prefs().isDriverRole || !isDriverEnRouteToDropOff) return;
    final bookingId =
        activeDriverBookingId.value ?? serviceDetailBookingId.value;
    if (bookingId != null && bookingId > 0) {
      await _ensureDriverPickupCoordsLoaded(bookingId);
    }
    final dest = _driverReturnDestinationCoords();
    if (dest == null) {
      showAppSnackBar(
        title: 'Navigation',
        message: 'Customer drop-off location is not available yet.',
        isError: true,
      );
      return;
    }
    await Get.find<DriverMapboxNavigationService>().navigateToDestinations(
      destinations: [
        (name: _driverPickupWaypointName(), lat: dest.lat, lng: dest.lng),
      ],
    );
  }

  Future<void> _autoStartDriverTurnByTurnForActiveLeg() async {
    if (!Prefs().isDriverRole) return;
    if (isDriverEnRouteToDropOff) {
      await startDriverTurnByTurnToDropOff();
    } else if (isDriverEnRouteToServiceCenter) {
      await startDriverTurnByTurnToServiceCenter();
    } else if (isDriverEnRouteToPickup) {
      await startDriverTurnByTurnToPickup();
    }
  }

  Future<void> startDriverPickupNavigationWatch() =>
      _startDriverPickupNavigationAndArrivalWatch();

  Future<void> _restoreActiveDriverServiceSessionIfAny() async {
    if (!Prefs().isDriverRole || Prefs().token().trim().isEmpty) return;
    final started = Prefs().getBool(_activeDriverServiceStartedKey);
    final bookingIdRaw = Prefs()
        .getData(_activeDriverServiceBookingIdKey)
        .trim();
    final bookingId = int.tryParse(bookingIdRaw);
    if (!started || bookingId == null || bookingId <= 0) return;
    activeDriverBookingId.value = bookingId;
    serviceDetailBookingId.value = bookingId;
    await fetchServiceDetail(bookingId: bookingId, force: true);
    if (BookingTrackingStatus.isDriverAfterServiceDeliveryLocked(
      bookingStatus: serviceDetail.value?.status?.toString(),
      trackingStatus: serviceDetail.value?.trackingStatus?.toString(),
    )) {
      await _clearDriverHomeOverlaysForAfterServiceFlow();
      await ensureDriverAfterServiceCarDetailsOpen();
      return;
    }
    if (_driverActiveBookingShouldClear(serviceDetail.value)) {
      _clearPersistedActiveDriverService();
      resetAcceptedService();
      activeDriverBookingId.value = null;
      if (Get.isRegistered<BookingLiveSocketService>()) {
        await Get.find<BookingLiveSocketService>().disconnect();
      }
      return;
    }
    _syncDriverTripUiFromServiceDetail();
    if (!hasStartedService.value && !hasDriverArrivedAtCustomerPickup.value) {
      startService();
    }
    _recomputeDriverHomeTripPanel();
    _syncDriverPickupCoordsFromBookingDetail(bookingId);
    if (Get.isRegistered<BookingLiveSocketService>()) {
      await _ensureDriverJoinedBookingRoomForStatusUpdates(bookingId);
    }
    _startDriverLocationApiHeartbeat();
    await _startDriverPickupNavigationAndArrivalWatch();
    await _ensureDriverPickupRouteDrawn();
  }

  void _rollbackDriverPickupStartAttempt(int bookingId) {
    _clearPersistedActiveDriverService();
    showAcceptedServicePanelOnDriverHome();
    if (bookingId > 0) {
      activeDriverBookingId.value = bookingId;
      serviceDetailBookingId.value = bookingId;
    }
    bindBookingTimerListener();
  }

  void _persistActiveDriverService(int bookingId) {
    if (bookingId <= 0) return;
    Prefs().putData(_activeDriverServiceBookingIdKey, bookingId.toString());
    Prefs().putBool(_activeDriverServiceStartedKey, true);
    _persistDriverAssignedBooking(bookingId);
  }

  void _persistDriverAssignedBooking(int bookingId) {
    if (bookingId <= 0) return;
    Prefs().putData(_activeDriverAssignedBookingIdKey, bookingId.toString());
  }

  void _clearPersistedActiveDriverService() {
    Prefs().putBool(_activeDriverServiceStartedKey, false);
    unawaited(Prefs().removeData(_activeDriverServiceBookingIdKey));
  }

  bool _isPersistedActiveDriverServiceForBooking(int? bookingId) {
    if (bookingId == null || bookingId <= 0) return false;
    if (!Prefs().getBool(_activeDriverServiceStartedKey)) return false;
    final persistedId = int.tryParse(
      Prefs().getData(_activeDriverServiceBookingIdKey).trim(),
    );
    return persistedId == bookingId;
  }

  void _clearPersistedDriverAssignedBooking() {
    unawaited(Prefs().removeData(_activeDriverAssignedBookingIdKey));
  }

  Future<void> _syncDriverDashboardSocket() async {
    if (!Get.isRegistered<DriverDashboardSocketService>()) return;
    final socket = Get.find<DriverDashboardSocketService>();
    if (!Prefs().isDriverRole) {
      await socket.disconnect();
      return;
    }
    // Keep listening continuously anywhere inside driver dashboard.
    await socket.connect();
    bindDriverDashboardBookingStatusListener();
    unawaited(_syncDriverPresence());
  }

  /// One-time load of the nearby job board; new jobs arrive via socket events.
  Future<void> _bootstrapDriverNearbyBoard({bool force = false}) async {
    if (!Prefs().isDriverRole || isClosed) return;
    // Do not call the nearby bookings API if the driver is not yet approved.
    // This prevents "Service provider not approved" error banners from
    // appearing on onboarding screens (license upload, background check, etc.).
    if (!Prefs().isDriverApproved) return;
    if (!force && _driverNearbyBoardBootstrapped) return;
    _driverNearbyBoardBootstrapped = true;
    await _syncDriverPresence();
    if (isClosed) return;
    await fetchDriverNearbyUnassignedBookings(refresh: true);
  }

  Future<void> _syncDriverPresence() async {
    if (!Prefs().isDriverRole || Prefs().token().trim().isEmpty || isClosed) {
      return;
    }
    if (_driverPresenceSyncQueued) return;
    _driverPresenceSyncQueued = true;
    try {
      final coords = await _driverCoordsQuick();
      if (coords == null || isClosed) return;
      final res = await _dashRepository.updateDriverPresence(
        lat: coords.lat,
        lng: coords.lng,
      );
      res.when(success: (_) {}, error: (_) {});
    } finally {
      _driverPresenceSyncQueued = false;
    }
  }

  void _handleDriverNewBookingFromSocket(bl.Bookings b) {
    if (!Prefs().isDriverRole) return;
    final id = b.id;
    if (id == null || id <= 0) return;
    driverNearbyUnassignedBookings.removeWhere((x) => x.id == id);
    driverNearbyUnassignedBookings.insert(0, b);
    driverPushNewBookings.removeWhere((x) => x.id == id);
    driverPushNewBookings.insert(0, b);
    notifyDriverNearbyOverlayLayout();

    // If the socket payload did not carry service coordinates the map pin
    // cannot be placed. Refresh from the API so the full booking data
    // (including service_location lat/lng) is loaded and the pin appears.
    if (b.mapCardLatitude == null || b.mapCardLongitude == null) {
      unawaited(fetchDriverNearbyUnassignedBookings(refresh: true));
    }
  }

  Future<void> _registerNotificationDeviceForDashboard() async {
    print("ONESIGNAL 11");
    if (Prefs().token().isEmpty) return;

    final onesignalId = (OneSignal.User.pushSubscription.id ?? '').trim();
    print("ONESIGNAL $onesignalId");
    if (onesignalId.isEmpty || onesignalId.toLowerCase().startsWith('local-')) {
      if (_registerDeviceRetryCount >= 8) return;
      _registerDeviceRetryCount++;
      await Future<void>.delayed(const Duration(seconds: 2));
      if (isClosed) return;
      unawaited(_registerNotificationDeviceForDashboard());
      return;
    }

    final platform = Platform.isAndroid ? 'android' : 'ios';
    final res = await _dashRepository.registerDevice(
      oneSignalId: onesignalId,
      platform: platform,
    );
    res.when(
      success: (_) {
        _registerDeviceRetryCount = 0;
      },
      error: (_) {
        if (_registerDeviceRetryCount >= 8) return;
        _registerDeviceRetryCount++;
        unawaited(
          Future<void>.delayed(const Duration(seconds: 2), () async {
            if (isClosed) return;
            await _registerNotificationDeviceForDashboard();
          }),
        );
      },
    );
  }

  /// Resolves coords for the driver bookings GET request (`latitude`, `longitude` query params).
  Future<({double lat, double lng})?>
  _currentDriverCoordsForBookingList() async {
    final cached = _latestDriverLiveCoords;
    final cachedAt = _latestDriverLiveCoordsAt;
    if (cached != null &&
        cachedAt != null &&
        DateTime.now().difference(cachedAt) <= const Duration(seconds: 15)) {
      return cached;
    }
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
    try {
      final p = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      ).timeout(const Duration(seconds: 8));
      final coords = (lat: p.latitude, lng: p.longitude);
      _latestDriverLiveCoords = coords;
      _latestDriverLiveCoordsAt = DateTime.now();
      return coords;
    } catch (_) {
      final last = await Geolocator.getLastKnownPosition();
      if (last == null) return null;
      return (lat: last.latitude, lng: last.longitude);
    }
  }

  /// First page or next page when [refresh] is false. Use [refreshBookings] for pull-to-refresh.
  Future<void> fetchBookings({bool refresh = false}) async {
    if (Prefs().token().trim().isEmpty) return;
    if (refresh) {
      if (isBookingsLoading.value || isBookingsLoadingMore.value) {
        _bookingsRefreshQueued = true;
        return;
      }
      isBookingsRefreshing.value = true;
      _bookingsLastLoadedPage = 0;
      _bookingsTotalPages = null;
      _bookingsPageLimit = null;
      bookingsHasMore.value = true;
      // Keep existing rows visible during pull-to-refresh; [assignAll] replaces on success.
    }

    if (!bookingsHasMore.value && !refresh) return;

    final nextPage = _bookingsLastLoadedPage == 0
        ? 1
        : _bookingsLastLoadedPage + 1;

    if (_bookingsTotalPages != null && nextPage > _bookingsTotalPages!) {
      bookingsHasMore.value = false;
      if (refresh) {
        isBookingsRefreshing.value = false;
      }
      return;
    }

    final isFirstChunk = nextPage == 1;

    if (isFirstChunk) {
      if (isBookingsLoading.value) {
        if (refresh) {
          _bookingsRefreshQueued = true;
          isBookingsRefreshing.value = false;
        }
        return;
      }
      isBookingsLoading.value = true;
    } else {
      if (isBookingsLoadingMore.value ||
          isBookingsLoading.value ||
          !bookingsHasMore.value) {
        return;
      }
      isBookingsLoadingMore.value = true;
    }

    try {
      final isDriver = Prefs().isDriverRole;
      final coords = isDriver
          ? await _currentDriverCoordsForBookingList()
          : null;
      final res = await _dashRepository.getBookings(
        page: nextPage,
        status: bookingsFilter.value == 'all' ? null : bookingsFilter.value,
        latitude: coords?.lat,
        longitude: coords?.lng,
      );
      res.when(
        success: (data) {
          final pagination = data.data?.pagination;
          final limit = pagination?.limit ?? _bookingsPageLimit ?? 10;
          _bookingsPageLimit = pagination?.limit ?? _bookingsPageLimit;

          if (pagination?.totalPages != null) {
            _bookingsTotalPages = pagination!.totalPages;
          }

          final raw = data.data?.bookings ?? const <bl.Bookings>[];
          final mapped = raw.map(_toBookingItem).toList();

          if (isFirstChunk) {
            bookings.assignAll(mapped);
            if (isDriver) driverRawBookings.assignAll(raw);
          } else {
            bookings.addAll(mapped);
            if (isDriver) driverRawBookings.addAll(raw);
          }
          if (isDriver) {
            _hydrateMissingDriverBookingPayouts(raw);
          }

          _bookingsLastLoadedPage = pagination?.page ?? nextPage;

          if (pagination?.totalPages != null) {
            bookingsHasMore.value =
                _bookingsLastLoadedPage < pagination!.totalPages!;
          } else {
            bookingsHasMore.value = raw.length >= limit;
          }
        },
        error: (err) {
          // Don't pile error toasts on a suspended driver — the banner covers it.
          if (!isDriverLicenseAcceptBlocked) {
            showAppSnackBar(
              title: 'Bookings',
              message: err.message,
              isError: true,
            );
          }
        },
      );
    } finally {
      isBookingsLoading.value = false;
      isBookingsLoadingMore.value = false;
      if (refresh) {
        isBookingsRefreshing.value = false;
      }
      if (isFirstChunk) {
        bookingsInitialLoadDone.value = true;
      }
      final runQueued = _bookingsRefreshQueued;
      _bookingsRefreshQueued = false;
      if (runQueued && !isClosed) {
        unawaited(fetchBookings(refresh: true));
      }
    }
  }

  Future<void> refreshBookings() => fetchBookings(refresh: true);

  /// The booking list is intentionally slim and older deployments may not
  /// include the provider payout. Hydrate only missing values from the same
  /// provider detail endpoint that powers the Service Details screen.
  void _hydrateMissingDriverBookingPayouts(Iterable<bl.Bookings> items) {
    for (final booking in items) {
      final bookingId = booking.id ?? 0;
      if (bookingId <= 0 ||
          booking.providerEarning != null ||
          (booking.providerEarningDisplay?.trim().isNotEmpty ?? false) ||
          !_driverPayoutHydrationInFlight.add(bookingId)) {
        continue;
      }
      unawaited(_hydrateDriverBookingPayout(booking));
    }
  }

  Future<void> _hydrateDriverBookingPayout(bl.Bookings booking) async {
    final bookingId = booking.id ?? 0;
    try {
      final result = await _dashRepository.getBookingDetail(
        bookingId: bookingId,
      );
      result.when(
        success: (response) {
          final earning = response.data?.driverEarning;
          if (earning == null || earning.totalPayout <= 0) return;
          booking.providerEarning = earning.totalPayout;
          booking.providerEarningDisplay = earning.totalPayoutDisplay;
          serviceDetailByBookingId[bookingId] = response.data!;
          final itemIndex = bookings.indexWhere((item) => item.id == bookingId);
          if (itemIndex >= 0) {
            bookings[itemIndex] = _toBookingItem(booking);
          }
        },
        error: (_) {},
      );
    } finally {
      _driverPayoutHydrationInFlight.remove(bookingId);
    }
  }

  /// Set while POST …/bookings/{id}/accept is in flight (driver bookings tab).
  final RxnInt acceptingDriverBookingId = RxnInt();
  final RxnInt rejectingDriverBookingId = RxnInt();

  final RxList<bl.Bookings> driverNearbyUnassignedBookings =
      <bl.Bookings>[].obs;
  final RxBool isDriverNearbyUnassignedLoading = false.obs;
  final RxBool isDriverNearbyUnassignedLoadingMore = false.obs;
  final RxBool driverNearbyUnassignedHasMore = true.obs;

  /// True after the first nearby-unassigned fetch finishes (success or error).
  final RxBool driverNearbyUnassignedInitialLoadDone = false.obs;
  Future<void>? _driverNearbyUnassignedFetchInFlight;
  int _driverNearbyLastLoadedPage = 0;
  int? _driverNearbyTotalPages;
  // Load up to 100 bookings per page (server max) so all nearby pins appear
  // on the map from the first fetch without requiring manual list scrolling.
  int _driverNearbyPageLimit = 100;
  double? _cachedDriverLat;
  double? _cachedDriverLng;
  bool _driverPresenceSyncQueued = false;
  bool _driverNearbyBoardBootstrapped = false;

  void _rememberDriverCoords(double lat, double lng) {
    if (!lat.isFinite || !lng.isFinite) return;
    _cachedDriverLat = lat;
    _cachedDriverLng = lng;
  }

  ({double lat, double lng})? get _cachedDriverCoords {
    final lat = _cachedDriverLat;
    final lng = _cachedDriverLng;
    if (lat == null || lng == null) return null;
    return (lat: lat, lng: lng);
  }

  /// Fast coords for presence / refresh — prefers last-known fix over a cold GPS wait.
  Future<({double lat, double lng})?> _driverCoordsQuick() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        return _cachedDriverCoords;
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        return _cachedDriverCoords;
      }

      final last = await Geolocator.getLastKnownPosition();
      if (last != null) {
        _rememberDriverCoords(last.latitude, last.longitude);
        return (lat: last.latitude, lng: last.longitude);
      }

      try {
        final p = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.medium,
            timeLimit: Duration(seconds: 2),
          ),
        );
        _rememberDriverCoords(p.latitude, p.longitude);
        return (lat: p.latitude, lng: p.longitude);
      } catch (_) {
        return _cachedDriverCoords;
      }
    } catch (_) {
      return _cachedDriverCoords;
    }
  }

  /// Real-time `new_booking_available` rows (merged with [driverNearbyUnassignedBookings] on the map).
  final RxList<bl.Bookings> driverPushNewBookings = <bl.Bookings>[].obs;

  /// API nearby list first; socket-only bookings fill in without duplicate ids.
  Iterable<bl.Bookings> get driverMapOverlayBookings sync* {
    final seen = <int>{};
    for (final b in driverNearbyUnassignedBookings) {
      final id = b.id;
      if (id != null && id > 0 && !seen.contains(id)) {
        seen.add(id);
        yield b;
      }
    }
    for (final b in driverPushNewBookings) {
      final id = b.id;
      if (id != null && id > 0 && !seen.contains(id)) {
        seen.add(id);
        yield b;
      }
    }
  }

  /// Bumped when the Mapbox camera moves so overlays can re-project lat/lng to pixels.
  final RxInt driverNearbyMapLayoutTick = 0.obs;

  void notifyDriverNearbyOverlayLayout() {
    driverNearbyMapLayoutTick.value++;
  }

  /// Removes a booking from nearby-unassigned UI immediately (list + map pins).
  void removeBookingFromNearbyUnassignedLists(int bookingId) {
    if (bookingId <= 0) return;
    driverPushNewBookings.removeWhere((x) => x.id == bookingId);
    driverNearbyUnassignedBookings.removeWhere((x) => x.id == bookingId);
    notifyDriverNearbyOverlayLayout();
  }

  void onDriverMapCameraChanged(CameraChangedEventData _) {
    notifyDriverNearbyOverlayLayout();
  }

  /// Fires only for user pan/scroll gestures (never programmatic camera moves),
  /// so we can lock out automatic recenters once the driver moves the map.
  void onDriverMapScroll(MapContentGestureContext _) {
    _driverMapManuallyMoved = true;
  }

  /// Temporarily pauses automatic provider following while the customer
  /// explores the live map. The next GPS update after the pause recenters it.
  void onCustomerLiveMapGesture(MapContentGestureContext _) {
    if (!Prefs().isCustomerRole || !isCustomerLiveTrackingActive) return;
    _customerLiveCameraPausedUntil = DateTime.now().add(
      _customerLiveCameraManualPause,
    );
    final currentMap = mapbox;
    if (currentMap != null) {
      unawaited(currentMap.cancelCameraAnimation());
    }
  }

  /// Zoom out to include the driver location and all visible unassigned job pins.
  Future<void> fitDriverMapToNearbyJobs() async {
    if (mapbox == null || !Prefs().isDriverRole) return;
    final recenterLockUntil = _driverExplicitRecenterFitLockUntil;
    if (recenterLockUntil != null) {
      if (DateTime.now().isBefore(recenterLockUntil)) return;
      _driverExplicitRecenterFitLockUntil = null;
    }
    // Do not let the nearby-job bounds fit undo the mandatory camera move
    // immediately after the user enables/grants location access.
    if (_locationPermissionRecenterPending ||
        _suppressNearbyFitAfterLocationPermission) {
      return;
    }
    // Respect a manual swipe: don't yank the camera back on data refreshes.
    if (_driverMapManuallyMoved) return;
    if (!driverHomeMapShowsNearbyUnassignedPins) return;

    final points = <Position>[];
    final driverPos = await _geolocationAsMapPosition();
    if (driverPos != null) points.add(driverPos);

    for (final b in driverMapOverlayBookings) {
      final lat = b.mapCardLatitude;
      final lng = b.mapCardLongitude;
      if (lat != null && lng != null && lat.isFinite && lng.isFinite) {
        points.add(Position(lng, lat));
      }
    }

    if (points.isEmpty) {
      if (driverPos != null) {
        await mapbox!.easeTo(
          CameraOptions(
            center: Point(coordinates: driverPos),
            zoom: driverJobBoardDefaultZoom,
          ),
          MapAnimationOptions(duration: 700),
        );
      }
      return;
    }

    if (points.length == 1) {
      await mapbox!.easeTo(
        CameraOptions(
          center: Point(coordinates: points.first),
          zoom: driverJobBoardDefaultZoom,
        ),
        MapAnimationOptions(duration: 700),
      );
      return;
    }

    try {
      final fitted = await mapbox!.cameraForCoordinatesPadding(
        points.map((p) => Point(coordinates: p)).toList(),
        CameraOptions(),
        MbxEdgeInsets(top: 160, left: 72, bottom: 240, right: 72),
        null,
        null,
      );
      final fittedZoom = fitted.zoom ?? driverJobBoardDefaultZoom;
      final cappedZoom = math.min(fittedZoom, driverJobBoardDefaultZoom);
      final targetZoom = math.max(cappedZoom - 0.35, driverJobBoardMinZoom);
      await mapbox!.easeTo(
        CameraOptions(
          center: fitted.center,
          bearing: fitted.bearing,
          pitch: fitted.pitch,
          zoom: targetZoom,
          padding: fitted.padding,
        ),
        MapAnimationOptions(duration: 900),
      );
    } catch (_) {
      if (driverPos != null) {
        await mapbox!.easeTo(
          CameraOptions(
            center: Point(coordinates: driverPos),
            zoom: driverJobBoardDefaultZoom,
          ),
          MapAnimationOptions(duration: 700),
        );
      }
    }
  }

  Future<void> fetchDriverNearbyUnassignedBookings({
    bool refresh = false,
    int? excludeBookingId,
    bool showLoadingIndicator = true,
  }) async {
    if (!Prefs().isDriverRole) return;

    if (_driverNearbyUnassignedFetchInFlight != null) {
      if (refresh) {
        await _driverNearbyUnassignedFetchInFlight;
      } else {
        return;
      }
    }

    final run = _fetchDriverNearbyUnassignedBookingsImpl(
      refresh: refresh,
      excludeBookingId: excludeBookingId,
      showLoadingIndicator: showLoadingIndicator,
    );
    _driverNearbyUnassignedFetchInFlight = run;
    try {
      await run;
    } finally {
      if (identical(_driverNearbyUnassignedFetchInFlight, run)) {
        _driverNearbyUnassignedFetchInFlight = null;
      }
    }
  }

  Future<void> _fetchDriverNearbyUnassignedBookingsImpl({
    required bool refresh,
    int? excludeBookingId,
    required bool showLoadingIndicator,
  }) async {
    if (!Prefs().isDriverRole || Prefs().token().trim().isEmpty) return;
    if (refresh) {
      _driverNearbyLastLoadedPage = 0;
      _driverNearbyTotalPages = null;
      driverNearbyUnassignedHasMore.value = true;
    }

    if (!driverNearbyUnassignedHasMore.value && !refresh) return;

    final nextPage = _driverNearbyLastLoadedPage == 0
        ? 1
        : _driverNearbyLastLoadedPage + 1;
    if (_driverNearbyTotalPages != null &&
        nextPage > _driverNearbyTotalPages!) {
      driverNearbyUnassignedHasMore.value = false;
      return;
    }

    final isFirstChunk = nextPage == 1;
    if (isFirstChunk) {
      if (showLoadingIndicator) {
        isDriverNearbyUnassignedLoading.value = true;
      }
    } else {
      if (!driverNearbyUnassignedHasMore.value) return;
      isDriverNearbyUnassignedLoadingMore.value = true;
    }

    try {
      // Send fresh device coordinates to the API so the backend can use them
      // for distance filtering even if the stored server-side location is stale
      // (e.g. first app open, background, or just relocated).
      final coords = await _driverCoordsQuick();
      final res = await _dashRepository.getDriverNearbyUnassignedBookings(
        page: nextPage,
        limit: _driverNearbyPageLimit,
        latitude: coords?.lat,
        longitude: coords?.lng,
      );
      res.when(
        success: (data) {
          final pagination = data.data?.pagination;
          if (pagination?.totalPages != null) {
            _driverNearbyTotalPages = pagination!.totalPages;
          }
          if (pagination?.limit != null && pagination!.limit! > 0) {
            _driverNearbyPageLimit = pagination.limit!;
          }
          final raw = (data.data?.bookings ?? const <ub.Bookings>[])
              .map(_mapUnassignedToBookingList)
              .toList();
          // Keep rows with a valid booking id. Coordinates may live only on
          // `customer.location` or alternate API keys — map pins skip nulls.
          final withIds = raw
              .where((b) => (b.id ?? 0) > 0)
              .where(
                (b) =>
                    excludeBookingId == null ||
                    excludeBookingId <= 0 ||
                    b.id != excludeBookingId,
              )
              .toList(growable: false);
          if (isFirstChunk) {
            driverNearbyUnassignedBookings.assignAll(withIds);
          } else {
            final existingIds = driverNearbyUnassignedBookings
                .map((e) => e.id ?? 0)
                .where((e) => e > 0)
                .toSet();
            for (final b in withIds) {
              final id = b.id ?? 0;
              if (id <= 0 || existingIds.contains(id)) continue;
              existingIds.add(id);
              driverNearbyUnassignedBookings.add(b);
            }
          }
          _driverNearbyLastLoadedPage = pagination?.page ?? nextPage;
          if (_driverNearbyTotalPages != null) {
            driverNearbyUnassignedHasMore.value =
                _driverNearbyLastLoadedPage < _driverNearbyTotalPages!;
          } else {
            driverNearbyUnassignedHasMore.value =
                raw.length >= _driverNearbyPageLimit;
          }
          notifyDriverNearbyOverlayLayout();
          if (isFirstChunk) {
            unawaited(fitDriverMapToNearbyJobs());
            // Auto-fetch remaining pages on first load so ALL nearby bookings
            // appear on the map without the driver having to scroll the list.
            if (driverNearbyUnassignedHasMore.value) {
              unawaited(fetchDriverNearbyUnassignedBookings(refresh: false));
            }
          }
        },
        error: (err) {
          if (_isLicenseExpiredApiError(err)) {
            _handleDriverLicenseExpiredApiError(err);
          }
          // Suppress the error snackbar when the license is already known to
          // be expired — the banner on the home screen already communicates
          // the suspension and showing a stack of error toasts is confusing.
          // Also suppress when the driver is not yet approved (onboarding)
          // to avoid showing "Service provider not approved" on license/doc screens.
          if (isFirstChunk &&
              !isDriverLicenseAcceptBlocked &&
              Prefs().isDriverApproved) {
            showAppSnackBar(
              title: 'Nearby bookings',
              message: err.message,
              isError: true,
            );
          }
        },
      );
    } catch (e) {
      if (isFirstChunk &&
          !isDriverLicenseAcceptBlocked &&
          Prefs().isDriverApproved) {
        showAppSnackBar(
          title: 'Nearby bookings',
          message: e.toString(),
          isError: true,
        );
      }
    } finally {
      isDriverNearbyUnassignedLoading.value = false;
      isDriverNearbyUnassignedLoadingMore.value = false;
      if (isFirstChunk) {
        driverNearbyUnassignedInitialLoadDone.value = true;
      }
    }
  }

  void _dismissDriverNearbyUnassignedSheetIfOpen() {
    if (Get.isBottomSheetOpen == true) {
      Get.back<void>();
    }
  }

  void handleDriverOnDemandAcceptTimeout({
    int? bookingId,
    bool showMessage = true,
  }) {
    if (!Prefs().isDriverRole) return;
    final id =
        bookingId ??
        activeDriverBookingId.value ??
        serviceDetailBookingId.value;
    if (hasHandledDriverCustomerNoShow(id)) return;
    if (id != null && id > 0 && _driverAcceptTimeoutHandledId == id) return;
    if (id != null && id > 0) _driverAcceptTimeoutHandledId = id;

    clearBookingTimerState();
    hasAcceptedService.value = false;
    hasStartedService.value = false;
    hasCancelTripView.value = false;
    resetAcceptedService();
    _setDriverHomeTripPanel(driverHomePanelNone);

    final hadActiveContext =
        id != null &&
        id > 0 &&
        (activeDriverBookingId.value == id ||
            serviceDetailBookingId.value == id);

    if (id != null && activeDriverBookingId.value == id) {
      activeDriverBookingId.value = null;
    }
    if (id != null && serviceDetailBookingId.value == id) {
      serviceDetailBookingId.value = null;
      serviceDetail.value = null;
      serviceDetailError.value = '';
    }
    activeDriverCustomerName.value = 'Customer';
    activeDriverCustomerAvatarUrl.value = '';
    activeDriverPickupLat.value = null;
    activeDriverPickupLng.value = null;
    activeDriverPickupAddress.value = '';

    unawaited(clearRouteAndPin());
    hasActiveRoute.value = false;
    _dismissDriverNearbyUnassignedSheetIfOpen();

    if (Get.isRegistered<BookingLiveSocketService>()) {
      final live = Get.find<BookingLiveSocketService>();
      if (id != null && live.activeBookingId == id) {
        live.stopDriverLocationHeartbeat();
        unawaited(live.disconnect());
      }
    }

    unawaited(fetchBookings(refresh: true));
    unawaited(
      fetchDriverNearbyUnassignedBookings(
        refresh: true,
        showLoadingIndicator: false,
      ),
    );

    if (showMessage && hadActiveContext) {
      showAppSnackBar(
        title: 'Job returned',
        message:
            'You did not start heading to pick-up in time. This job was returned to the board.',
        isError: true,
      );
    }

    if (Get.currentRoute == Routes.DRIVER_SERVICE_DETAIL) {
      Get.back<void>();
    }
  }

  bl.Bookings _mapUnassignedToBookingList(ub.Bookings b) {
    bl.ServiceLocation? svc = b.serviceLocation == null
        ? null
        : bl.ServiceLocation(
            address: b.serviceLocation!.address,
            latitude: b.serviceLocation!.latitude,
            longitude: b.serviceLocation!.longitude,
          );
    final custLoc = b.customer?.location;
    final missingCoords =
        svc == null ||
        svc.latitude == null ||
        svc.longitude == null ||
        !svc.latitude!.isFinite ||
        !svc.longitude!.isFinite;
    if (missingCoords &&
        custLoc != null &&
        custLoc.latitude != null &&
        custLoc.longitude != null &&
        custLoc.latitude!.isFinite &&
        custLoc.longitude!.isFinite) {
      svc = bl.ServiceLocation(
        address: (svc?.address ?? '').trim().isNotEmpty
            ? svc!.address
            : (b.customer?.name != null ? 'Customer pickup' : ''),
        latitude: custLoc.latitude,
        longitude: custLoc.longitude,
      );
    }
    return bl.Bookings(
      id: b.id,
      bookingCode: b.bookingCode,
      status: b.status,
      serviceType: b.serviceType,
      scheduleType: b.scheduleType,
      scheduledAt: b.scheduledAt,
      serviceDatetime: b.scheduledAt,
      createdAt: b.createdAt,
      totalPrice: b.totalPrice,
      currency: b.currency,
      totalPriceDisplay: b.totalPriceDisplay,
      distanceMiles: b.distanceMiles,
      requiresAdminAssignment: b.requiresAdminAssignment,
      serviceLocation: svc,
      packageId: b.packageId,
      packageName: b.packageName,
      serviceDurationMinutes: b.serviceDurationMinutes,
      estimatedTravelMinutes: b.estimatedTravelMinutes,
      estimatedCompletionMinutes: b.estimatedCompletionMinutes,
      providerEarning: b.providerEarning,
      providerEarningDisplay: b.providerEarningDisplay,
      // New unassigned API has `customer`; keep old card helpers working.
      customerDetail: b.customer == null
          ? null
          : bl.CustomerDetail(
              id: b.customer!.id,
              name: b.customer!.name,
              profilePicture: b.customer!.profile,
            ),
    );
  }

  void loadMoreDriverNearbyUnassignedBookings() {
    if (!driverNearbyUnassignedHasMore.value ||
        isDriverNearbyUnassignedLoading.value ||
        isDriverNearbyUnassignedLoadingMore.value) {
      return;
    }
    unawaited(fetchDriverNearbyUnassignedBookings(refresh: false));
  }

  /// Active (non-completed, non-cancelled) driver bookings with valid service coordinates.
  /// Used to render "assigned" map pins alongside the unassigned job board.
  Iterable<bl.Bookings> get driverAssignedActiveMapBookings sync* {
    final seen = <int>{};
    for (final b in driverRawBookings) {
      final id = b.id;
      if (id == null || id <= 0) continue;
      if (seen.contains(id)) continue;
      // Skip historical/completed/cancelled/refunded/failed bookings.
      final status = '${b.status ?? ''}'.trim().toLowerCase();
      if (status == 'cancelled' ||
          status == 'rejected' ||
          status == 'completed' ||
          status == 'refunded' ||
          status == 'failed')
        continue;
      if (BookingTrackingStatus.isBookingServiceCompleted(
        bookingStatus: b.status,
        trackingStatus: b.trackingStatus,
      ))
        continue;
      // Must have valid coordinates.
      final lat = b.mapCardLatitude;
      final lng = b.mapCardLongitude;
      if (lat == null || lng == null || !lat.isFinite || !lng.isFinite)
        continue;
      seen.add(id);
      yield b;
    }
  }

  /// Whether the provider's assigned bookings should be shown as map pins.
  /// Mirrors [driverHomeMapShowsNearbyUnassignedPins] — both hide during active trip panels.
  bool get driverHomeMapShowsAssignedPins =>
      driverHomeMapShowsNearbyUnassignedPins;

  /// Home-map floating cards should hide while the driver onboarding-style panels are visible.
  bool get driverHomeMapShowsNearbyUnassignedPins {
    if (!Prefs().isDriverRole) return false;
    hasAcceptedService.value;
    hasReadyToHeadService.value;
    hasHaveYouArriveLocation.value;
    hasArriveForService.value;
    hasWaitingOnVehicleService.value;
    hasSelectNewServiceLocation.value;
    hasCancelTripView.value;
    hasVehicleIsEnroteToDropOffPannal.value;
    hasDriverArrivedAtCustomerPickup.value;
    hasStartedService.value;
    if (driverHideUnassignedMapOverlayCards.value) return false;
    return !(hasAcceptedService.value ||
        hasReadyToHeadService.value ||
        hasHaveYouArriveLocation.value ||
        hasArriveForService.value ||
        hasWaitingOnVehicleService.value ||
        hasSelectNewServiceLocation.value ||
        hasCancelTripView.value ||
        hasVehicleIsEnroteToDropOffPannal.value ||
        hasDriverArrivedAtCustomerPickup.value);
  }

  /// Extra space above the bottom nav so map FABs clear full-width trip sheets
  /// (e.g. “Enroute to pick up customer vehicle”).
  static const double driverTripSheetMapFabClearancePx = 380;

  /// Overview zoom used when fitting the provider and nearby booking pins.
  static const double driverJobBoardDefaultZoom = 11.5;
  static const double driverJobBoardMinZoom = 9.5;

  /// Close zoom used for the provider's current-location pointer.
  static const double driverCurrentLocationZoom = 11.0;

  /// True while a bottom-aligned trip / booking panel is shown on the driver home map.
  bool get driverTripBottomSheetRaisesMapFabs =>
      Prefs().isDriverRole && driverHomeTripPanel.value.isNotEmpty;

  /// Whether any driver home trip bottom sheet is currently selected for display.
  bool get driverHasActiveTripPanelVisible =>
      Prefs().isDriverRole && driverHomeTripPanel.value.isNotEmpty;

  /// Active booking exists on the server but local trip phase flags were not synced.
  bool get needsDriverHomeTripPanelResync {
    if (!Prefs().isDriverRole || driverHasActiveTripPanelVisible) return false;
    final id = activeDriverBookingId.value ?? serviceDetailBookingId.value;
    if (id == null || id <= 0) return false;
    final detail = serviceDetail.value;
    if (detail?.id != id) return true;
    final tracking = BookingTrackingStatus.normalizeTrackingCode(
      detail?.trackingStatus,
    );
    if (tracking.isNotEmpty) {
      return !BookingTrackingStatus.isVehicleDelivered(tracking) &&
          !BookingTrackingStatus.isBookingCancelled(
            bookingStatus: detail?.status?.toString(),
            trackingStatus: tracking,
          );
    }
    final life = detail?.status?.toString().trim().toLowerCase() ?? '';
    if (life != 'assigned' && life != 'confirmed' && life != 'in_progress') {
      return false;
    }
    // Scheduled pre-start: panel must stay hidden until provider starts trip.
    if (isScheduledBooking(
          scheduleType: detail?.scheduleType?.toString(),
          scheduledAt: detail?.scheduledAt,
          serviceDatetime: detail?.serviceDatetime,
        ) &&
        BookingTrackingStatus.isBookingAwaitingProviderTripStart(
          bookingStatus: life,
          trackingStatus: tracking,
        )) {
      return false;
    }
    return life == 'assigned' || life == 'confirmed';
  }

  /// Re-align driver home panels with booking detail tracking (e.g. after car details).
  Future<void> ensureDriverHomeTripPanelSynced() async {
    if (!Prefs().isDriverRole || _driverHomeTripPanelSyncInFlight) return;
    _driverHomeTripPanelSyncInFlight = true;
    try {
      final id = activeDriverBookingId.value ?? serviceDetailBookingId.value;
      if (id == null || id <= 0) return;
      if (serviceDetail.value?.id != id) {
        await fetchServiceDetail(bookingId: id, force: true);
      }
      _syncDriverTripUiFromServiceDetail();
      _recomputeDriverHomeTripPanel();
      final tracking = BookingTrackingStatus.normalizeTrackingCode(
        serviceDetail.value?.trackingStatus,
      );
      if (hasStartedService.value ||
          hasDriverArrivedAtCustomerPickup.value ||
          tracking.isNotEmpty) {
        _persistActiveDriverService(id);
      }
    } finally {
      _driverHomeTripPanelSyncInFlight = false;
    }
  }

  void refreshDriverHomeTripPanelFromDetail() {
    if (!Prefs().isDriverRole) return;
    Future.microtask(() {
      _syncDriverTripUiFromServiceDetail();
      _recomputeDriverHomeTripPanel();
    });
  }

  /// True when the driver already has an in-progress booking and cannot accept another.
  bool driverHasBlockingActiveBooking({int? exceptBookingId}) {
    if (!Prefs().isDriverRole) return false;

    // Only use activeDriverBookingId for the session check.
    // serviceDetailBookingId is set whenever the provider views any booking
    // detail screen (including old/completed bookings) and must NOT be used
    // here — doing so would falsely block acceptance after simply viewing a
    // past booking whose detail is no longer in the cached list.
    final sessionId = activeDriverBookingId.value;
    if (sessionId != null &&
        sessionId > 0 &&
        sessionId != exceptBookingId &&
        _isDriverBookingActive(sessionId)) {
      return true;
    }

    for (final item in bookings) {
      if (item.id == exceptBookingId) continue;
      if (!item.isDriverAssigned || item.isServiceCompleted) continue;
      final life = item.lifecycleStatus.trim().toLowerCase();
      final status = life.isNotEmpty ? life : item.status.trim().toLowerCase();
      if (status == 'assigned' || status == 'in_progress') {
        // Scheduled bookings that haven't been started (accepted but trip not
        // begun) are future appointments — they must not block other accepts.
        if (!_bookingIsLiveForDriver(
          bookingStatus: status,
          trackingStatus: null,
          scheduleType: item.scheduleType,
        ))
          continue;

        if (activeDriverBookingId.value == null && item.id != null) {
          activeDriverBookingId.value = item.id;
          serviceDetailBookingId.value = item.id;
          _persistDriverAssignedBooking(item.id!);
        }
        return true;
      }
    }

    return false;
  }

  /// Returns true only when the booking represents a trip that is genuinely
  /// in progress and requires the provider's immediate attention — i.e. it was
  /// started (has a tracking status or the started pref is set) and is not yet
  /// delivered/completed.
  ///
  /// Critically, a **scheduled** booking that was only accepted (status
  /// 'assigned' / 'confirmed', no tracking code, trip not started) must return
  /// false so it never blocks the provider from accepting other bookings.
  bool _isDriverBookingActive(int bookingId) {
    final detail = serviceDetail.value;
    if (detail?.id == bookingId) {
      return _bookingIsLiveForDriver(
        bookingStatus: detail?.status?.toString(),
        trackingStatus: detail?.trackingStatus?.toString(),
        scheduleType: detail?.scheduleType?.toString(),
      );
    }

    for (final item in bookings) {
      if (item.id != bookingId) continue;
      if (!item.isDriverAssigned || item.isServiceCompleted) return false;
      final life = item.lifecycleStatus.trim().toLowerCase();
      final status = life.isNotEmpty ? life : item.status.trim().toLowerCase();
      if (status != 'assigned' && status != 'in_progress') return false;
      return _bookingIsLiveForDriver(
        bookingStatus: status,
        trackingStatus: null, // BookingItem carries no tracking status
        scheduleType: item.scheduleType,
      );
    }

    // The booking is not in the cached list or service-detail yet.
    // Only treat as blocking if the provider explicitly started a trip
    // (started pref = true); a merely-accepted booking must not block.
    return Prefs().getBool(_activeDriverServiceStartedKey);
  }

  /// Returns true when the booking represents an active trip that blocks the
  /// provider from accepting other bookings.
  ///
  /// A scheduled booking that was *accepted but not yet started* (no tracking
  /// code, [isBookingAwaitingProviderTripStart] = true) is explicitly excluded:
  /// it is a future-dated service and does not require the provider’s
  /// immediate attention.
  bool _bookingIsLiveForDriver({
    String? bookingStatus,
    String? trackingStatus,
    String? scheduleType,
  }) {
    // Accepted but not yet started (no tracking event fired).
    if (BookingTrackingStatus.isBookingAwaitingProviderTripStart(
      bookingStatus: bookingStatus,
      trackingStatus: trackingStatus,
    )) {
      // Scheduled bookings in this state are future appointments.
      // They should never block the provider from accepting other work.
      if (isScheduledScheduleType(scheduleType)) return false;
      // On-demand bookings that were accepted but not started are in the
      // 15-minute accept window. They block acceptance to prevent double-booking.
      return true;
    }
    return BookingTrackingStatus.isDriverLiveBooking(
      bookingStatus: bookingStatus,
      trackingStatus: trackingStatus,
    );
  }

  /// Human-readable reason why the provider cannot accept a booking right now.
  /// Returns an empty string when there is no block.
  String _driverAcceptBlockReason({int? exceptBookingId}) {
    if (isDriverLicenseAcceptBlocked) {
      if (driverLicenseExpired.value || driverLicenseHoldActive.value) {
        return 'Your driver license has expired. Upload a renewed license to accept new service requests.';
      }
      return 'Your account is currently not eligible to accept new service requests. Please contact support.';
    }
    if (driverHasBlockingActiveBooking(exceptBookingId: exceptBookingId)) {
      final activeId = activeDriverBookingId.value;
      if (activeId != null && activeId > 0) {
        return 'You have an active booking in progress (booking #${activeId.toString().padLeft(4, '0')}). Complete or cancel it before accepting another.';
      }
      return 'You already have an active booking in progress. Complete it before accepting another.';
    }
    return '';
  }

  bool get isDriverLicenseAcceptBlocked =>
      Prefs().isDriverRole &&
      (driverLicenseHoldActive.value ||
          driverLicenseExpired.value ||
          !driverCanAcceptNewBookings.value);

  bool isDriverJobAcceptBlocked({int? exceptBookingId}) =>
      driverHasBlockingActiveBooking(exceptBookingId: exceptBookingId) ||
      isDriverLicenseAcceptBlocked;

  bool get shouldShowDriverLicenseComplianceBanner =>
      Prefs().isDriverRole &&
      (isDriverLicenseAcceptBlocked || driverLicenseExpiringSoon.value);

  String get driverLicenseComplianceBannerMessage {
    if (isDriverLicenseAcceptBlocked) {
      return 'Your driver license has expired. Your account is suspended until you upload a renewed license. You cannot accept new service requests.';
    }
    final days = driverLicenseDaysUntilExpiration.value;
    final exp = driverLicenseExpirationDate.value.trim();
    if (days == null) {
      return 'Your driver license is expiring soon. Renew it to avoid account suspension.';
    }
    if (days <= 0) {
      return 'Your driver license expires today ($exp). Upload a renewed license now or your account will be suspended.';
    }
    if (days == 1) {
      return 'Your driver license expires tomorrow ($exp). Renew it now to avoid account suspension.';
    }
    return 'Your driver license expires on $exp ($days days left). Renew it before expiration to avoid account suspension.';
  }

  void applyDriverLicenseComplianceFromProfile(ProfileResponse profile) {
    final user = profile.data?.user;
    final driver = profile.data?.driverProfile;
    driverAccountStatus.value = user?.status?.trim().toLowerCase() ?? 'active';
    driverSuspendedReason.value = user?.suspendedReason?.trim() ?? '';
    driver?.applyLocalLicenseComplianceFallback();
    driverLicenseExpirationDate.value =
        driver?.resolvedLicenseExpirationDate ?? '';
    driverLicenseHoldActive.value = driver?.licenseHoldActive == true;
    driverLicenseExpired.value = driver?.isLicenseExpired == true;
    driverLicenseDaysUntilExpiration.value = driver?.licenseDaysUntilExpiration;
    driverLicenseExpiringSoon.value = driver?.isLicenseExpiringSoon == true;
    driverCanAcceptNewBookings.value = driver?.canAcceptNewBookings ?? true;

    final suspendedForLicense =
        driverAccountStatus.value == 'suspended' &&
        driverSuspendedReason.value.toLowerCase().contains('license');
    if (suspendedForLicense) {
      driverLicenseHoldActive.value = true;
      driverLicenseExpired.value = true;
      driverCanAcceptNewBookings.value = false;
    }
  }

  Future<void> refreshDriverLicenseCompliance() async {
    if (!Prefs().isDriverRole || Prefs().token().trim().isEmpty) return;
    if (isDriverLicenseComplianceLoading.value) return;
    isDriverLicenseComplianceLoading.value = true;
    try {
      if (!Get.isRegistered<AuthRepository>()) {
        Get.lazyPut<AuthRepository>(() => AuthRepository(), fenix: true);
      }
      final result = await Get.find<AuthRepository>().getDriverMe();
      result.when(
        success: applyDriverLicenseComplianceFromProfile,
        error: (_) {},
      );
    } finally {
      isDriverLicenseComplianceLoading.value = false;
    }
  }

  void openDriverLicenseRenewal() {
    if (!Prefs().isDriverRole) return;
    unawaited(Get.toNamed(Routes.UPLOAD_DRIVER_LICENSE));
  }

  bool _isLicenseExpiredApiError(NetworkException err) =>
      err.errBody?.type?.trim().toLowerCase() == 'license_expired';

  void _handleDriverLicenseExpiredApiError(NetworkException err) {
    driverLicenseHoldActive.value = true;
    driverLicenseExpired.value = true;
    driverCanAcceptNewBookings.value = false;
    showAppSnackBar(
      title: 'Driver license expired',
      message: err.message,
      isError: true,
    );
  }

  Future<void> acceptDriverBooking(int bookingId) async {
    if (!Prefs().isDriverRole || bookingId <= 0) return;
    if (isDriverLicenseAcceptBlocked) {
      showAppSnackBar(
        title: 'Driver license expired',
        message:
            'Upload a renewed driver license before accepting new service requests.',
        isError: true,
      );
      openDriverLicenseRenewal();
      return;
    }

    // When local state says the provider has an active booking, verify with
    // the server before surfacing an error. Local state can be stale (e.g.
    // an old activeDriverBookingId that was never cleared after completion,
    // a filtered bookings list that hid a confirmed/scheduled booking, or a
    // race-condition right after a previous accept). The reconcile call will
    // reset any stale flags. If the server also confirms an active session,
    // only then do we block and explain why.
    if (driverHasBlockingActiveBooking(exceptBookingId: bookingId)) {
      if (acceptingDriverBookingId.value != null) return;
      // Show 'Checking…' on the Accept button while we verify server state.
      acceptingDriverBookingId.value = bookingId;
      try {
        await reconcileDriverHomeBookingState();
      } finally {
        acceptingDriverBookingId.value = null;
      }
      // Re-evaluate with fresh data.
      if (driverHasBlockingActiveBooking(exceptBookingId: bookingId)) {
        showAcceptedServicePanelOnDriverHome();
        final reason = _driverAcceptBlockReason(exceptBookingId: bookingId);
        showAppSnackBar(
          title: 'Cannot accept booking',
          message: reason,
          isError: true,
        );
        if (isDriverAfterServiceDeliveryLocked) {
          unawaited(ensureDriverAfterServiceCarDetailsOpen());
        }
        return;
      }
      // Server confirmed no active booking — stale state was cleared.
      // Fall through and proceed with the accept.
    }

    if (acceptingDriverBookingId.value != null) {
      showAppSnackBar(
        title: 'Please wait',
        message: 'A booking acceptance is already in progress.',
        isError: false,
      );
      return;
    }
    acceptingDriverBookingId.value = bookingId;
    String? acceptedScheduleType;
    for (final b in driverMapOverlayBookings) {
      if (b.id == bookingId) {
        acceptedScheduleType = b.scheduleType;
        break;
      }
    }
    try {
      final res = await _dashRepository.acceptBooking(bookingId: bookingId);
      res.when(
        success: (r) {
          _driverAcceptTimeoutHandledId = null;
          _driverCustomerNoShowHandledId = null;
          _seedActiveDriverCustomerFromBookingLists(bookingId);
          _seedDriverPickupFromBookingLists(bookingId);
          seedOnDemandAcceptCountdownAfterAccept(
            bookingId: bookingId,
            scheduleType: acceptedScheduleType,
          );
          removeBookingFromNearbyUnassignedLists(bookingId);
          isDriverNearbyUnassignedLoading.value = false;
          activeDriverBookingId.value = bookingId;
          serviceDetailBookingId.value = bookingId;
          _persistDriverAssignedBooking(bookingId);
          // For on-demand bookings: show the Start panel on the home map
          // immediately after acceptance so the provider can tap Start
          // without first navigating into the service detail screen.
          // For scheduled bookings: keep the home map idle — no panel until
          // the provider explicitly starts from the service detail screen.
          if (!hasStartedService.value) {
            final _isOnDemandAccept = isOnDemandScheduleType(
              acceptedScheduleType,
            );
            if (_isOnDemandAccept) {
              hasAcceptedService.value = true;
              _recomputeDriverHomeTripPanel(); // shows driverHomePanelStartPickup
            } else {
              hasAcceptedService.value = false;
            }
          }
          _dismissDriverNearbyUnassignedSheetIfOpen();
          showAppSnackBar(
            title: 'Booking',
            message: (r.message ?? 'Booking accepted').trim().isEmpty
                ? 'Booking accepted'
                : r.message!.trim(),
          );
          unawaited(
            Get.toNamed(
              Routes.DRIVER_SERVICE_DETAIL,
              arguments: {'bookingId': bookingId},
            ),
          );
          unawaited(() async {
            await fetchServiceDetail(bookingId: bookingId, force: true);
            _syncDriverPickupCoordsFromBookingDetail(bookingId);
          }());
          unawaited(fetchBookings(refresh: true));
          unawaited(_ensureDriverJoinedBookingRoomForStatusUpdates(bookingId));
          bindBookingTimerListener();
        },
        error: (err) {
          final msg = err.message.trim().toLowerCase();
          if (_isLicenseExpiredApiError(err)) {
            _handleDriverLicenseExpiredApiError(err);
            openDriverLicenseRenewal();
            return;
          }
          if (msg.contains('not eligible') ||
              msg.contains('no longer available') ||
              msg.contains('awaiting customer payment') ||
              msg.contains('already accepted')) {
            removeBookingFromNearbyUnassignedLists(bookingId);
          }
          if (msg.contains('active booking')) {
            unawaited(() async {
              await reconcileDriverHomeBookingState();
              showAcceptedServicePanelOnDriverHome();
            }());
          }
          showAppSnackBar(
            title: 'Accept booking',
            message: err.message,
            isError: true,
          );
        },
      );
    } finally {
      acceptingDriverBookingId.value = null;
    }
  }

  Future<bool> rejectDriverBooking(int bookingId) async {
    if (!Prefs().isDriverRole || bookingId <= 0) return false;
    if (rejectingDriverBookingId.value != null) return false;
    rejectingDriverBookingId.value = bookingId;
    try {
      final res = await _dashRepository.rejectBooking(bookingId: bookingId);
      var ok = false;
      res.when(
        success: (r) {
          ok = true;
          removeBookingFromNearbyUnassignedLists(bookingId);
          isDriverNearbyUnassignedLoading.value = false;
          bookings.removeWhere((x) => x.id == bookingId);
          showAppSnackBar(
            title: 'Booking',
            message: (r.message ?? 'Booking rejected').trim().isEmpty
                ? 'Booking rejected'
                : r.message!.trim(),
          );
          unawaited(fetchBookings(refresh: true));
        },
        error: (err) {
          showAppSnackBar(
            title: 'Reject booking',
            message: err.message,
            isError: true,
          );
        },
      );
      return ok;
    } finally {
      rejectingDriverBookingId.value = null;
    }
  }

  void setActiveDriverBookingContext({
    required int bookingId,
    String? customerName,
    String? customerAvatarUrl,
    double? pickupLat,
    double? pickupLng,
    String? pickupAddress,
  }) {
    if (isDriverAfterServiceDeliveryLocked &&
        bookingId !=
            (activeDriverBookingId.value ?? serviceDetailBookingId.value)) {
      showAppSnackBar(
        title: 'Complete delivery',
        message:
            'Finish the current delivery before switching to another booking.',
        isError: true,
      );
      unawaited(ensureDriverAfterServiceCarDetailsOpen());
      return;
    }
    final activeId = activeDriverBookingId.value;
    if (hasStartedService.value &&
        activeId != null &&
        activeId > 0 &&
        activeId != bookingId) {
      showAppSnackBar(
        title: 'Active booking in progress',
        message: 'Complete your current booking before starting another one.',
        isError: true,
      );
      return;
    }
    if (bookingId > 0) {
      activeDriverBookingId.value = bookingId;
    }
    final name = (customerName ?? '').trim();
    if (name.isNotEmpty) {
      activeDriverCustomerName.value = name;
    }
    final avatar = (customerAvatarUrl ?? '').trim();
    if (avatar.isNotEmpty) {
      activeDriverCustomerAvatarUrl.value = avatar;
    }
    if (pickupLat != null && pickupLng != null) {
      activeDriverPickupLat.value = pickupLat;
      activeDriverPickupLng.value = pickupLng;
    }
    final address = (pickupAddress ?? '').trim();
    if (address.isNotEmpty) {
      activeDriverPickupAddress.value = address;
    }
    _driverPickupArrivedPopupShown = false;
    _driverNearCustomerSent = false;
  }

  /// True when the driver has an in-progress booking and quick info/call actions apply.
  bool get showDriverActiveBookingQuickActions {
    if (!Prefs().isDriverRole) return false;
    final bookingId =
        activeDriverBookingId.value ?? serviceDetailBookingId.value;
    if (bookingId == null || bookingId <= 0) return false;
    final status =
        serviceDetail.value?.status?.toString().toLowerCase().trim() ?? '';
    if (status == 'completed' || status == 'cancelled') return false;
    return hasStartedService.value ||
        activeDriverBookingId.value != null ||
        hasAcceptedService.value ||
        showDriverStartPickupPanel;
  }

  int? get activeDriverBookingIdForQuickActions {
    final id = activeDriverBookingId.value ?? serviceDetailBookingId.value;
    if (id == null || id <= 0) return null;
    return id;
  }

  Future<void> openActiveDriverBookingDetailsSheet() async {
    final bookingId = activeDriverBookingIdForQuickActions;
    if (bookingId == null) {
      showAppSnackBar(
        title: 'Booking details',
        message: 'No active booking found.',
        isError: true,
      );
      return;
    }
    if (serviceDetail.value?.id != bookingId) {
      await fetchServiceDetail(bookingId: bookingId, force: true);
    }
    final ctx = Get.context;
    if (ctx == null || !ctx.mounted) return;
    await showDriverActiveBookingDetailSheet(ctx, bookingId: bookingId);
  }

  void openActiveDriverBookingChat() {
    final bookingId =
        activeDriverBookingId.value ?? serviceDetailBookingId.value;
    if (bookingId == null || bookingId <= 0) {
      showAppSnackBar(
        title: 'Messages',
        message: 'Booking details are not ready yet.',
        isError: true,
      );
      return;
    }

    final detail = serviceDetail.value;
    final status = (detail?.status ?? '').toString().toLowerCase().trim();
    if (!bookingChatVisibleForDriver(status)) {
      showAppSnackBar(
        title: 'Messages',
        message: 'Chat is not available for cancelled bookings.',
        isError: true,
      );
      return;
    }

    final customer = detail?.customerDetail;
    final customerName = (customer?.name ?? activeDriverCustomerName.value)
        .trim();
    final customerImage =
        (customer?.profilePicture ?? activeDriverCustomerAvatarUrl.value)
            .trim();

    Get.toNamed(
      Routes.DRIVER_CHAT,
      arguments: {
        'bookingId': bookingId,
        'status': status,
        'peerId': customer?.id ?? detail?.customerId,
        'peerName': customerName.isNotEmpty ? customerName : 'Customer',
        'peerImage': customerImage,
      },
    );
  }

  /// Phase-aware: if the driver is already in the return/drop-off phase
  /// skip the reset so the drop-off panel is preserved.
  void showAcceptedServicePanelOnDriverHome() {
    driverHideUnassignedMapOverlayCards.value = false;

    // Phase guard: if the driver is already past the pickup leg, preserve
    // current state instead of resetting to start-pickup UI.
    final currentTracking = BookingTrackingStatus.normalizeTrackingCode(
      serviceDetail.value?.trackingStatus,
    );
    if (currentTracking == BookingTrackingStatus.driverReturningToCustomer ||
        currentTracking == BookingTrackingStatus.driverReachedCustomerReturn ||
        currentTracking == BookingTrackingStatus.afterImagesUploaded) {
      homeNavIndex.value = 0;
      _setDriverHomeTripPanel(driverHomePanelDropoff);
      return;
    }

    hasReadyToHeadService.value = false;
    hasHaveYouArriveLocation.value = false;
    hasArriveForService.value = false;
    hasWaitingOnVehicleService.value = false;
    hasSelectNewServiceLocation.value = false;
    hasCancelTripView.value = false;
    hasVehicleIsEnroteToDropOffPannal.value = false;
    hasStartedService.value = false;
    hasOpenedContactOptions.value = false;
    homeNavIndex.value = 0;

    final tracking = BookingTrackingStatus.normalizeTrackingCode(
      serviceDetail.value?.trackingStatus,
    );
    final life =
        serviceDetail.value?.status?.toString().trim().toLowerCase() ?? '';
    final scheduleType = serviceDetail.value?.scheduleType?.toString();
    final scheduledAwaitingStart =
        isScheduledBooking(
          scheduleType: scheduleType,
          scheduledAt: serviceDetail.value?.scheduledAt,
          serviceDatetime: serviceDetail.value?.serviceDatetime,
        ) &&
        BookingTrackingStatus.isBookingAwaitingProviderTripStart(
          bookingStatus: life,
          trackingStatus: tracking,
        );

    if (scheduledAwaitingStart) {
      _clearPersistedActiveDriverService();
      hasAcceptedService.value = false;
      _setDriverHomeTripPanel(driverHomePanelNone);
      return;
    }

    hasAcceptedService.value = true;
    _setDriverHomeTripPanel(driverHomePanelStartPickup);
  }

  void _emitTrackingStatusToCustomerSocket(String trackingStatus) {
    if (!Get.isRegistered<BookingLiveSocketService>()) return;
    final socket = Get.find<BookingLiveSocketService>();
    if (!socket.isConnected.value) return;
    socket.sendDriverStatusUpdate(
      BookingTrackingStatus.customerMessageFor(trackingStatus),
    );
  }

  Future<bool> _postBookingTrackingStatus(
    String trackingStatus, {
    required int bookingId,
    bool silentErrors = false,
  }) async {
    final res = await _dashRepository.updateBookingTrackingStatus(
      bookingId: bookingId,
      trackingStatus: trackingStatus,
    );
    var ok = false;
    res.when(
      success: (_) {
        ok = true;
        _patchDriverServiceDetailTracking(bookingId, trackingStatus);
        _emitTrackingStatusToCustomerSocket(trackingStatus);
      },
      error: (err) {
        if (!silentErrors) {
          showAppSnackBar(
            title: 'Update status',
            message: err.message,
            isError: true,
          );
        }
      },
    );
    return ok;
  }

  Future<bool> submitDriverBookingTrackingStatus(
    String trackingStatus, {
    int? bookingId,
    bool silentErrors = false,
  }) async {
    final id =
        bookingId ??
        activeDriverBookingId.value ??
        serviceDetailBookingId.value;
    if (!Prefs().isDriverRole || id == null || id <= 0) return false;
    final detail = serviceDetail.value;
    if (detail?.id == id &&
        BookingTrackingStatus.isAtOrPastTracking(
          detail?.trackingStatus?.toString(),
          trackingStatus,
        )) {
      _patchDriverServiceDetailTracking(id, trackingStatus);
      return true;
    }
    if (detail?.id == id &&
        BookingTrackingStatus.wouldRollbackTracking(
          current: detail?.trackingStatus?.toString(),
          next: trackingStatus,
        )) {
      if (trackingStatus == BookingTrackingStatus.driverReachedCustomer &&
          BookingTrackingStatus.isDriverAtCustomerPickupHandover(
            detail?.trackingStatus?.toString(),
          )) {
        _applyDriverPickupHandoverUiState();
        return true;
      }
      if (!silentErrors) {
        showAppSnackBar(
          title: 'Update status',
          message: 'This booking step cannot be reversed.',
          isError: true,
        );
      }
      return false;
    }
    if (!silentErrors) {
      if (isDriverStatusUpdating.value) return false;
      isDriverStatusUpdating.value = true;
    }
    try {
      return await _postBookingTrackingStatus(
        trackingStatus,
        bookingId: id,
        silentErrors: silentErrors,
      );
    } finally {
      if (!silentErrors) {
        isDriverStatusUpdating.value = false;
      }
    }
  }

  /// Driver: customer drop-off / return leg arrived.
  Future<bool> markDriverReturnDropoffComplete() async {
    for (var attempt = 0; attempt < 20; attempt++) {
      if (!isDriverStatusUpdating.value) break;
      await Future<void>.delayed(const Duration(milliseconds: 100));
    }
    return submitDriverBookingTrackingStatus(
      BookingTrackingStatus.driverReachedCustomerReturn,
    );
  }

  /// After successful return drop-off: clears trip overlays and opens [CarDetailsView] for after-service photos.
  Future<bool> markDriverReturnDropoffCompleteAndOpenAfterServiceView() async {
    if (isDriverReturnDropoffArrivalInFlight.value) return false;
    isDriverReturnDropoffArrivalInFlight.value = true;
    _driverReturnLegWorkGeneration++;
    driverHideUnassignedMapOverlayCards.value = true;
    hasVehicleIsEnroteToDropOffPannal.value = false;
    if (Get.isRegistered<DriverMapboxNavigationService>()) {
      await Get.find<DriverMapboxNavigationService>().stopNavigationIfActive();
    }
    try {
      final ok = await markDriverReturnDropoffComplete();
      if (!ok || !Prefs().isDriverRole) return ok;
      final id = activeDriverBookingId.value ?? serviceDetailBookingId.value;
      if (id == null || id <= 0) {
        driverHideUnassignedMapOverlayCards.value = false;
        return ok;
      }
      await _clearDriverHomeOverlaysForAfterServiceFlow();
      unawaited(
        _openDriverAfterServiceCarDetailsOnce(
          bookingId: id,
          onClosed: () {
            if (!Prefs().isDriverRole || isClosed) return;
            unawaited(() async {
              if (isDriverAfterServiceDeliveryLocked) {
                await ensureDriverAfterServiceCarDetailsOpen();
                return;
              }
              driverHideUnassignedMapOverlayCards.value = false;
            }());
          },
        ),
      );
      return ok;
    } finally {
      isDriverReturnDropoffArrivalInFlight.value = false;
    }
  }

  Future<void> _clearDriverHomeOverlaysForAfterServiceFlow() async {
    if (!Prefs().isDriverRole) return;
    driverHideUnassignedMapOverlayCards.value = true;
    _driverPickupArrivalTimer?.cancel();
    _driverPickupArrivalTimer = null;
    _driverLocationApiHeartbeat?.cancel();
    _stopDriverLivePositionStream();
    if (Get.isRegistered<BookingLiveSocketService>()) {
      Get.find<BookingLiveSocketService>().stopDriverLocationHeartbeat();
    }
    _driverLocationApiHeartbeat = null;
    hasAcceptedService.value = false;
    hasReadyToHeadService.value = false;
    hasHaveYouArriveLocation.value = false;
    hasArriveForService.value = false;
    hasWaitingOnVehicleService.value = false;
    hasSelectNewServiceLocation.value = false;
    hasCancelTripView.value = false;
    hasVehicleIsEnroteToDropOffPannal.value = false;
    hasStartedService.value = false;
    hasOpenedContactOptions.value = false;
    if (Get.isRegistered<DriverMapboxNavigationService>()) {
      unawaited(
        Get.find<DriverMapboxNavigationService>().stopNavigationIfActive(),
      );
    }
    await clearRouteAndPin();
    hasActiveRoute.value = false;
    if (Get.isRegistered<BookingLiveSocketService>()) {
      final live = Get.find<BookingLiveSocketService>();
      live.stopDriverLocationHeartbeat();
      await live.disconnect();
    }
  }

  Future<bool> markDriverBookingEnroute({int? bookingId}) async {
    final resolvedBookingId =
        bookingId ??
        activeDriverBookingId.value ??
        serviceDetailBookingId.value;
    if (!Prefs().isDriverRole || (resolvedBookingId ?? 0) <= 0) return false;
    return submitDriverBookingTrackingStatus(
      BookingTrackingStatus.driverStartedToCustomer,
      bookingId: resolvedBookingId,
    );
  }

  Future<void> startActiveDriverService() async {
    if (isDriverAfterServiceDeliveryLocked) {
      showAppSnackBar(
        title: 'Complete delivery',
        message:
            'Finish after-service photos and complete delivery before starting another trip.',
        isError: true,
      );
      unawaited(ensureDriverAfterServiceCarDetailsOpen());
      return;
    }
    if (!canDriverStartOnDemandAcceptPhase) {
      handleDriverOnDemandAcceptTimeout(
        bookingId: activeDriverBookingId.value ?? serviceDetailBookingId.value,
        showMessage: true,
      );
      return;
    }
    driverHideUnassignedMapOverlayCards.value = false;
    final resolvedBookingId =
        activeDriverBookingId.value ?? serviceDetailBookingId.value;
    final activeId = activeDriverBookingId.value;
    if (hasStartedService.value &&
        activeId != null &&
        activeId > 0 &&
        resolvedBookingId != null &&
        resolvedBookingId > 0 &&
        activeId != resolvedBookingId) {
      showAppSnackBar(
        title: 'Active booking in progress',
        message: 'Complete your current booking before starting another one.',
        isError: true,
      );
      return;
    }
    final bookingId =
        activeDriverBookingId.value ?? serviceDetailBookingId.value;
    if (bookingId == null || bookingId <= 0) {
      showAppSnackBar(
        title: 'Start failed',
        message: 'Active booking could not be identified.',
        isError: true,
      );
      return;
    }

    // Show en-route sheet immediately, then persist to server.
    _applyDriverPickupStartUi(bookingId);

    final ok = await markDriverBookingEnroute(bookingId: bookingId);
    if (!ok) {
      _rollbackDriverPickupStartAttempt(bookingId);
      return;
    }

    await fetchServiceDetail(bookingId: bookingId, force: true);
    _syncDriverPickupCoordsFromBookingDetail(bookingId);
    if (bookingId != null &&
        bookingId > 0 &&
        Get.isRegistered<BookingLiveSocketService>()) {
      // Emits `join_booking` with payload: { "booking_id": bookingId }
      // as soon as socket connects.
      await Get.find<BookingLiveSocketService>().connectForBooking(bookingId);
      bindDriverCancelledBookingListeners();
    }
    _startDriverLocationApiHeartbeat();
    // Draw the route BEFORE disabling the puck — _driverRouteOriginPosition
    // falls back to GPS when the puck is off, but last-known GPS is faster.
    await _startDriverPickupNavigationAndArrivalWatch();
    await _ensureDriverPickupRouteDrawn();
    // Disable puck after route is drawn (replaces it with custom car pin).
    await _refreshMapLocationPuck();
  }

  /// Retries driver → pickup polyline when map/GPS/detail load after [Start].
  Future<void> _ensureDriverPickupRouteDrawn({int maxAttempts = 8}) async {
    if (!Prefs().isDriverRole || !isDriverEnRouteToPickup) return;
    for (var attempt = 0; attempt < maxAttempts; attempt++) {
      if (!isDriverEnRouteToPickup) return;
      final bookingId =
          activeDriverBookingId.value ?? serviceDetailBookingId.value;
      if (bookingId == null || bookingId <= 0) return;
      if (!await _ensureDriverPickupCoordsLoaded(bookingId)) {
        await Future<void>.delayed(Duration(milliseconds: 400 + attempt * 120));
        continue;
      }
      if (mapbox == null) {
        _driverPickupRoutePendingRedraw = true;
        await Future<void>.delayed(Duration(milliseconds: 400 + attempt * 120));
        continue;
      }
      final lat = activeDriverPickupLat.value!;
      final lng = activeDriverPickupLng.value!;
      await drawDriverRouteToPickup(pickupLat: lat, pickupLng: lng);
      if (hasActiveRoute.value) return;
      await Future<void>.delayed(Duration(milliseconds: 450 + attempt * 150));
    }
  }

  void _startDriverLocationApiHeartbeat() {
    _driverLocationApiHeartbeat?.cancel();
    _driverLocationApiHeartbeat = Timer.periodic(
      const Duration(seconds: 10),
      (_) => unawaited(_sendDriverLocationApiTick()),
    );
    unawaited(_startDriverLivePositionStream());
    unawaited(_sendDriverLocationApiTick());
    unawaited(_ensureDriverLiveLocationSocket());
  }

  Future<void> _startDriverLivePositionStream() async {
    if (!Prefs().isDriverRole) return;
    _driverLivePositionShouldRun = true;
    if (_driverLivePositionSub != null || _driverLivePositionStartInFlight) {
      return;
    }
    _driverLivePositionStartInFlight = true;
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) return;
      final permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        return;
      }
      if (!_driverLivePositionShouldRun) return;

      final LocationSettings settings;
      if (Platform.isAndroid) {
        settings = AndroidSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 3,
          intervalDuration: const Duration(seconds: 3),
          foregroundNotificationConfig: const ForegroundNotificationConfig(
            notificationTitle: 'Car Comfort trip in progress',
            notificationText: 'Sharing your live location with the customer',
            notificationChannelName: 'Active trip location',
            enableWakeLock: true,
            setOngoing: true,
          ),
        );
      } else if (Platform.isIOS) {
        settings = AppleSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 3,
          activityType: ActivityType.automotiveNavigation,
          pauseLocationUpdatesAutomatically: false,
          showBackgroundLocationIndicator: true,
          allowBackgroundLocationUpdates: true,
        );
      } else {
        settings = const LocationSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 3,
        );
      }

      _driverLivePositionSub =
          Geolocator.getPositionStream(locationSettings: settings).listen(
            (position) {
              final bookingId =
                  activeDriverBookingId.value ?? serviceDetailBookingId.value;
              if (!Prefs().isDriverRole ||
                  bookingId == null ||
                  bookingId <= 0) {
                return;
              }
              _latestDriverLiveCoords = (
                lat: position.latitude,
                lng: position.longitude,
              );
              _latestDriverLiveCoordsAt = DateTime.now();
              if (Get.isRegistered<BookingLiveSocketService>()) {
                Get.find<BookingLiveSocketService>().sendDriverLocation(
                  bookingId: bookingId,
                  latitude: position.latitude,
                  longitude: position.longitude,
                );
              }
            },
            onError: (Object error) {
              Alert.log('DriverLiveLocation', 'position stream failed: $error');
              unawaited(_driverLivePositionSub?.cancel());
              _driverLivePositionSub = null;
            },
          );
    } finally {
      _driverLivePositionStartInFlight = false;
    }
  }

  void _stopDriverLivePositionStream() {
    _driverLivePositionShouldRun = false;
    unawaited(_driverLivePositionSub?.cancel());
    _driverLivePositionSub = null;
    _latestDriverLiveCoords = null;
    _latestDriverLiveCoordsAt = null;
  }

  Future<void> _ensureDriverLiveLocationSocket() async {
    if (_driverLiveSocketStartInFlight || !Prefs().isDriverRole) return;
    final bookingId =
        activeDriverBookingId.value ?? serviceDetailBookingId.value;
    if (bookingId == null || bookingId <= 0) return;
    if (!Get.isRegistered<BookingLiveSocketService>()) return;

    _driverLiveSocketStartInFlight = true;
    try {
      final live = Get.find<BookingLiveSocketService>();
      if (live.activeBookingId != bookingId || !live.isConnected.value) {
        await live.connectForBooking(bookingId);
      }
      if (live.activeBookingId != bookingId) return;
      // Socket updates provide the smooth three-second feed; the HTTP
      // heartbeat above remains a durable ten-second fallback.
      live.startDriverLocationHeartbeat(
        bookingId: bookingId,
        fetchLocation: _currentDriverCoordsForBookingList,
      );
    } finally {
      _driverLiveSocketStartInFlight = false;
    }
  }

  Future<void> _sendDriverLocationApiTick() async {
    if (!Prefs().isDriverRole || Prefs().token().trim().isEmpty) return;
    final bookingId =
        activeDriverBookingId.value ?? serviceDetailBookingId.value;
    if (bookingId == null || bookingId <= 0) return;
    if (_driverLivePositionSub == null) {
      unawaited(_startDriverLivePositionStream());
    }
    if (Get.isRegistered<BookingLiveSocketService>()) {
      final live = Get.find<BookingLiveSocketService>();
      if (live.activeBookingId != bookingId || !live.isConnected.value) {
        unawaited(_ensureDriverLiveLocationSocket());
      }
    }
    final providerId = int.tryParse(Prefs().userId().trim());
    if (providerId == null || providerId <= 0) return;
    final coords = await _currentDriverCoordsForBookingList();
    if (coords == null) return;
    // Reuse this GPS fix to trim active route (no extra Location request).
    if (isDriverEnRouteToDropOff) {
      unawaited(
        _refreshDriverReturnLegRouteTrimDisplay(
          vehicleLat: coords.lat,
          vehicleLng: coords.lng,
        ),
      );
    } else if (isDriverEnRouteToServiceCenter) {
      unawaited(
        _refreshDriverServiceLegRouteTrimDisplay(
          vehicleLat: coords.lat,
          vehicleLng: coords.lng,
        ),
      );
    } else if (isDriverEnRouteToPickup) {
      unawaited(
        _refreshDriverPickupRouteTrimDisplay(
          vehicleLat: coords.lat,
          vehicleLng: coords.lng,
        ),
      );
    }
    if (isDriverEnRouteToPickup &&
        (_driverPickupCachedRouteCoords == null ||
            _driverPickupRoutePendingRedraw)) {
      final pickupLat = activeDriverPickupLat.value;
      final pickupLng = activeDriverPickupLng.value;
      if (pickupLat != null && pickupLng != null) {
        unawaited(
          drawDriverRouteToPickup(pickupLat: pickupLat, pickupLng: pickupLng),
        );
      }
    }
    final res = await _dashRepository.sendDriverLocation(
      bookingId: bookingId,
      providerId: providerId,
      lat: coords.lat,
      lng: coords.lng,
    );
    res.when(success: (_) {}, error: (_) {});
  }

  Future<void> _startDriverPickupNavigationAndArrivalWatch() async {
    if (!Prefs().isDriverRole || !isDriverEnRouteToPickup) return;
    final bookingId =
        activeDriverBookingId.value ?? serviceDetailBookingId.value;
    if (bookingId == null || bookingId <= 0) return;
    if (!await _ensureDriverPickupCoordsLoaded(bookingId)) {
      _driverPickupRoutePendingRedraw = true;
      Alert.log(
        'DriverPickupRoute',
        'pickup coords unavailable for booking $bookingId',
      );
      return;
    }
    final lat = activeDriverPickupLat.value!;
    final lng = activeDriverPickupLng.value!;
    await drawDriverRouteToPickup(pickupLat: lat, pickupLng: lng);
    _driverPickupArrivalTimer?.cancel();
    _driverPickupArrivalTimer = Timer.periodic(
      _driverPickupTrimAndArrivalInterval,
      (_) => unawaited(_checkDriverArrivalToPickup()),
    );
    unawaited(_checkDriverArrivalToPickup());
  }

  Future<void> _checkDriverArrivalToPickup() async {
    if (!isDriverEnRouteToPickup) {
      _driverPickupArrivalTimer?.cancel();
      _driverPickupArrivalTimer = null;
      return;
    }
    if (_driverPickupArrivedPopupShown || isDriverEnRouteToServiceCenter) {
      return;
    }
    final pickupLat = activeDriverPickupLat.value;
    final pickupLng = activeDriverPickupLng.value;
    if (pickupLat == null || pickupLng == null) return;
    final current = await _geolocationAsMapPosition();
    if (current == null) return;
    final vehLat = _coordLat(current);
    final vehLng = _coordLng(current);
    unawaited(
      _refreshDriverPickupRouteTrimDisplay(
        vehicleLat: vehLat,
        vehicleLng: vehLng,
      ),
    );
    final distanceMeters = Geolocator.distanceBetween(
      vehLat,
      vehLng,
      pickupLat,
      pickupLng,
    );
    const arrivedThresholdMeters = 120.0;
    const nearThresholdMeters = 450.0;
    if (distanceMeters > arrivedThresholdMeters) {
      if (!_driverNearCustomerSent && distanceMeters <= nearThresholdMeters) {
        _driverNearCustomerSent = true;
        unawaited(
          submitDriverBookingTrackingStatus(
            BookingTrackingStatus.driverNearCustomer,
            silentErrors: true,
          ),
        );
      }
      return;
    }

    _driverPickupArrivedPopupShown = true;
    _driverPickupArrivalTimer?.cancel();
    await clearRouteAndPin();
    // Do not auto-send ARRIVED from proximity checks.
    // ARRIVED must be sent only when driver taps the explicit button.
  }

  Future<bool> markDriverBookingArrived({
    int? bookingId,
    bool enforceProximity = true,
  }) async {
    final resolvedBookingId =
        bookingId ??
        activeDriverBookingId.value ??
        serviceDetailBookingId.value;
    if (!Prefs().isDriverRole || (resolvedBookingId ?? 0) <= 0) return false;
    final activeBookingId = resolvedBookingId!;
    if (isDriverStatusUpdating.value) return false;

    // Refresh before enforcing arrival so the check uses the booking's
    // customer-selected pickup coordinates, not service-location coordinates
    // that may have been seeded from a compact booking-list payload.
    if (serviceDetail.value?.id != activeBookingId ||
        (enforceProximity && !kDebugMode)) {
      await fetchServiceDetail(bookingId: activeBookingId, force: true);
    }
    _syncDriverPickupCoordsFromBookingDetail(activeBookingId);

    final currentTracking = BookingTrackingStatus.normalizeTrackingCode(
      serviceDetail.value?.trackingStatus,
    );
    if (BookingTrackingStatus.isDriverAtCustomerPickupHandover(
          currentTracking,
        ) ||
        hasDriverArrivedAtCustomerPickup.value) {
      _applyDriverPickupHandoverUiState();
      return true;
    }
    if (BookingTrackingStatus.wouldRollbackTracking(
      current: currentTracking,
      next: BookingTrackingStatus.driverReachedCustomer,
    )) {
      _syncDriverTripUiFromServiceDetail();
      return true;
    }
    if (enforceProximity && !kDebugMode) {
      final pickup = serviceDetail.value?.id == activeBookingId
          ? _customerPickupCoordsFromDetail(serviceDetail.value)
          : null;
      if (pickup == null) {
        showAppSnackBar(
          title: 'Arrival check',
          message: 'Pickup location unavailable. Please try again.',
          isError: true,
        );
        return false;
      }
      final current = await _geolocationAsMapPosition();
      if (current == null) {
        showAppSnackBar(
          title: 'Location required',
          message:
              'Unable to get your current location. Please enable GPS and try again.',
          isError: true,
        );
        return false;
      }
      var distanceMeters = Geolocator.distanceBetween(
        current.lat.toDouble(),
        current.lng.toDouble(),
        pickup.lat,
        pickup.lng,
      );
      const arrivedThresholdMeters = 120.0;
      // Older bookings could retain the correct pickup address while their
      // coordinates were overwritten by the selected wash/service stop. If
      // that legacy point fails, resolve the saved address and retry so the
      // provider is checked against where the customer actually requested.
      if (distanceMeters > arrivedThresholdMeters) {
        final addressPickup = await _geocodeDriverPickupAddress(
          serviceDetail.value,
          proximityLat: current.lat.toDouble(),
          proximityLng: current.lng.toDouble(),
        );
        if (addressPickup != null) {
          final addressDistance = Geolocator.distanceBetween(
            current.lat.toDouble(),
            current.lng.toDouble(),
            addressPickup.lat,
            addressPickup.lng,
          );
          if (addressDistance < distanceMeters) {
            distanceMeters = addressDistance;
            activeDriverPickupLat.value = addressPickup.lat;
            activeDriverPickupLng.value = addressPickup.lng;
          }
        }
      }
      if (distanceMeters > arrivedThresholdMeters) {
        showAppSnackBar(
          title: 'Not at pickup location',
          message:
              'You are ${(distanceMeters).round()}m away. Move closer to mark ARRIVED.',
          isError: true,
        );
        return false;
      }
    }
    isDriverStatusUpdating.value = true;
    try {
      final okReached = await _postBookingTrackingStatus(
        BookingTrackingStatus.driverReachedCustomer,
        bookingId: activeBookingId,
      );
      if (!okReached) return false;
      await _postBookingTrackingStatus(
        BookingTrackingStatus.otpPending,
        bookingId: activeBookingId,
        silentErrors: true,
      );
      _applyDriverPickupHandoverUiState();
      return true;
    } finally {
      isDriverStatusUpdating.value = false;
    }
  }

  /// Driver: show Accept when the booking has no driver assigned yet.
  bool bookingShowsAcceptButton(BookingItem item) =>
      item.id > 0 && !item.isDriverAssigned;

  /// Opens review + optional tip flow for a completed booking (customer).
  Future<void> openPostServiceFeedback({required int bookingId}) async {
    if (!Prefs().isCustomerRole || bookingId <= 0) return;
    postBookingApiId.value = bookingId;
    serviceDetailBookingId.value = bookingId;
    await Get.toNamed(
      Routes.SERVICE_PROVIDER_PROFILE,
      arguments: {
        'inspectionMode': true,
        'feedbackOnly': true,
        'bookingId': bookingId,
      },
    );
    await fetchServiceDetail(bookingId: bookingId, force: true);
  }

  /// Loads booking detail for [ServiceDetailView] / [DriverServiceDetailView].
  void scheduleServiceDetailLoad(int bookingId, {bool force = true}) {
    if (bookingId <= 0 || isClosed) return;
    prepareServiceDetailScreen(bookingId);
    if (isServiceDetailLoading.value &&
        serviceDetailBookingId.value == bookingId) {
      return;
    }
    unawaited(fetchServiceDetail(bookingId: bookingId, force: force));
  }

  void clearServiceDetailRouteBookingId() {}

  /// Call when opening service detail so a stale in-memory booking does not blank the UI.
  void prepareServiceDetailScreen(int bookingId) {
    if (bookingId <= 0) return;
    _deferReactiveUpdate(() {
      serviceDetailBookingId.value = bookingId;
      serviceDetailError.value = '';
      final currentId = serviceDetail.value?.id;
      if (currentId != null && currentId != bookingId) {
        serviceDetail.value = null;
      }
    });
  }

  /// Avoid updating GetX observables while a widget tree is building.
  void _deferReactiveUpdate(void Function() fn) {
    final phase = SchedulerBinding.instance.schedulerPhase;
    if (phase == SchedulerPhase.idle ||
        phase == SchedulerPhase.postFrameCallbacks) {
      fn();
      return;
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!isClosed) fn();
    });
  }

  /// Runs [fn] on the next safe frame when the current call stack is mid-build.
  Future<void> _runDeferredDriverUiUpdate(void Function() fn) async {
    final phase = SchedulerBinding.instance.schedulerPhase;
    if (phase == SchedulerPhase.idle ||
        phase == SchedulerPhase.postFrameCallbacks) {
      fn();
      return;
    }
    final done = Completer<void>();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!isClosed) fn();
      if (!done.isCompleted) done.complete();
    });
    await done.future;
  }

  void _applyDriverPickupStartUi(int bookingId) {
    clearBookingTimerState();
    stopBookingTimerUiTicker();
    _driverNearCustomerSent = false;
    activeDriverBookingId.value = bookingId;
    serviceDetailBookingId.value = bookingId;
    _persistActiveDriverService(bookingId);
    startService();
    hasAcceptedService.value = true;
    _setDriverHomeTripPanel(driverHomePanelPickupEnRoute);
  }

  Future<void> fetchServiceDetail({
    required int bookingId,
    bool force = false,
  }) async {
    if (!force &&
        serviceDetailBookingId.value == bookingId &&
        serviceDetail.value != null) {
      return;
    }
    if (isServiceDetailLoading.value &&
        serviceDetailBookingId.value == bookingId &&
        !force) {
      return;
    }

    final requestVersion = ++_serviceDetailRequestVersion;
    _serviceDetailRequestVersions[bookingId] = requestVersion;
    final previousId = serviceDetail.value?.id;
    _deferReactiveUpdate(() {
      serviceDetailBookingId.value = bookingId;
      serviceDetailError.value = '';
      serviceDetailErrorByBookingId.remove(bookingId);
      serviceDetailLoadingBookingIds.add(bookingId);
      if (previousId != null && previousId != bookingId) {
        serviceDetail.value = null;
      }
      isServiceDetailLoading.value = true;
    });

    final res = await _dashRepository.getBookingDetail(bookingId: bookingId);
    _deferReactiveUpdate(() {
      final isLatestRequest =
          _serviceDetailRequestVersions[bookingId] == requestVersion;
      final isActiveDetail = serviceDetailBookingId.value == bookingId;
      res.when(
        success: (data) {
          _mergeFetchedServiceDetailTracking(data.data);
          final fetchedDetail = data.data;
          if (fetchedDetail != null) {
            serviceDetailByBookingId[bookingId] = fetchedDetail;
          }
          if (isLatestRequest && isActiveDetail) {
            serviceDetail.value = fetchedDetail;
            serviceDetailError.value = '';
          }
          final bid = data.data?.id;
          if (bid != null && bid > 0) {
            if (Prefs().isCustomerRole && bid > 0) {
              _hydrateCustomerVehiclePickupOtpFromDetail(data.data);
              syncBookingTimersFromServiceDetail(data.data);
              _syncCustomerAssignedDriverFromBookingDetail(bid);
              if (_customerLiveTracking &&
                  _activeCustomerLiveTrackingBookingId == bid) {
                _invalidateCustomerLiveDriverMarkerCache();
                unawaited(_customerLiveMapOnBookingDetailRefreshed(bid));
              }
            }
            if (Prefs().isDriverRole && bid > 0) {
              syncBookingTimersFromServiceDetail(data.data);
              _syncDriverPickupCoordsFromBookingDetail(bid);
              _syncActiveDriverCustomerFromBookingDetail(bid);
              final isActiveDriverSession =
                  activeDriverBookingId.value == bid ||
                  serviceDetailBookingId.value == bid;
              if (isActiveDriverSession) {
                final detail = data.data;
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (isClosed) return;
                  final tracking = BookingTrackingStatus.normalizeTrackingCode(
                    detail?.trackingStatus,
                  );
                  final scheduledAwaitingStart =
                      isScheduledBooking(
                        scheduleType: detail?.scheduleType?.toString(),
                        scheduledAt: detail?.scheduledAt,
                        serviceDatetime: detail?.serviceDatetime,
                      ) &&
                      BookingTrackingStatus.isBookingAwaitingProviderTripStart(
                        bookingStatus: detail?.status?.toString(),
                        trackingStatus: tracking,
                      );
                  if (scheduledAwaitingStart) {
                    _clearPersistedActiveDriverService();
                    _resetDriverTripPhaseFlags();
                    hasAcceptedService.value = false;
                    hasStartedService.value = false;
                    driverHideUnassignedMapOverlayCards.value = false;
                    _setDriverHomeTripPanel(driverHomePanelNone);
                    return;
                  }
                  final pickupLegLocked =
                      driverHomeTripPanel.value ==
                          driverHomePanelPickupEnRoute ||
                      _isPersistedActiveDriverServiceForBooking(bid);
                  if (!pickupLegLocked ||
                      BookingTrackingStatus.isAtOrPastTracking(
                        detail?.trackingStatus?.toString(),
                        BookingTrackingStatus.driverReachedCustomer,
                      )) {
                    _syncDriverTripUiFromServiceDetail(detail);
                  } else {
                    _recomputeDriverHomeTripPanel();
                  }
                  if (hasStartedService.value ||
                      driverHomeTripPanel.value ==
                          driverHomePanelPickupEnRoute ||
                      hasDriverArrivedAtCustomerPickup.value ||
                      tracking.isNotEmpty) {
                    _persistActiveDriverService(bid);
                  }
                });
              }
              if (isDriverEnRouteToPickup &&
                  (activeDriverBookingId.value == bid ||
                      serviceDetailBookingId.value == bid)) {
                unawaited(_driverRefreshRouteAfterBookingDetailUpdate());
              } else if (isDriverEnRouteToServiceCenter &&
                  (activeDriverBookingId.value == bid ||
                      serviceDetailBookingId.value == bid)) {
                unawaited(drawDriverRouteToServiceCenterWithCustomPins());
              }
            }
          }
        },
        error: (err) {
          if (isLatestRequest) {
            serviceDetailErrorByBookingId[bookingId] = err.message;
          }
          if (isLatestRequest && isActiveDetail) {
            serviceDetail.value = null;
            serviceDetailError.value = err.message;
          }
          if (Prefs().isDriverRole &&
              (activeDriverBookingId.value == bookingId ||
                  serviceDetailBookingId.value == bookingId) &&
              !hasStartedService.value) {
            handleDriverOnDemandAcceptTimeout(
              bookingId: bookingId,
              showMessage: true,
            );
          }
        },
      );

      if (isLatestRequest) {
        serviceDetailLoadingBookingIds.remove(bookingId);
        if (isActiveDetail) {
          isServiceDetailLoading.value = false;
        }
      }
    });
  }

  void loadMoreBookings() {
    if (!bookingsHasMore.value ||
        isBookingsLoadingMore.value ||
        isBookingsLoading.value) {
      return;
    }
    unawaited(fetchBookings(refresh: false));
  }

  /// Subtitle for a cancelled booking that names who initiated it, or null when
  /// the booking is not cancelled. Perspective-aware: the initiator sees
  /// "Cancelled by you"; the counterpart is named explicitly.
  String? _cancelledBookingSubtitle({
    required String lifecycleStatus,
    required String? cancelledBy,
    required bool isDriverView,
  }) {
    final status = lifecycleStatus.trim().toLowerCase();
    if (status != 'cancelled' && status != 'canceled') return null;

    final by = '${cancelledBy ?? ''}'.trim().toLowerCase();
    if (isDriverView) {
      switch (by) {
        case 'driver':
          return ServiceProviderLabels.cancelledByYou;
        case 'customer':
          return ServiceProviderLabels.cancelledByCustomer;
        case 'admin':
          return ServiceProviderLabels.cancelledBySupport;
        default:
          return ServiceProviderLabels.cancelledGeneric;
      }
    }

    switch (by) {
      case 'customer':
        return ServiceProviderLabels.cancelledByYou;
      case 'driver':
        return ServiceProviderLabels.cancelledByProvider;
      case 'admin':
        return ServiceProviderLabels.cancelledBySupport;
      default:
        return ServiceProviderLabels.cancelledGeneric;
    }
  }

  BookingItem _toBookingItem(bl.Bookings b) {
    final isDriverView = Prefs().isDriverRole;
    final hasDriver = b.driverId != null;
    final driverName = hasDriver ? personNameFromDetail(b.driverDetail) : '';
    final customerName = customerNameFromBooking(b);
    final lifecycleStatus = '${b.status ?? ''}'.trim().toLowerCase();
    final cachedEarning = isDriverView
        ? serviceDetailByBookingId[b.id]?.driverEarning
        : null;
    final providerPayout = b.displayProviderEarningLabel != '—'
        ? b.displayProviderEarningLabel
        : cachedEarning?.totalPayoutDisplay ?? '—';
    final hasProviderPayout = providerPayout != '—';
    final amountDisplay = isDriverView
        ? (!hasProviderPayout && lifecycleStatus == 'cancelled'
              ? 'No Payout'
              : providerPayout)
        : (b.totalPriceDisplay?.toString().trim().isNotEmpty ?? false)
        ? b.totalPriceDisplay.toString().trim()
        : _currencyAmountFallback(b.totalPrice, b.currency);
    final distance = _formatDistanceMilesLabel(b.distanceMiles);
    final scheduleIso = _bookingScheduleIso(b);
    final created = _formatBookingDate(scheduleIso);
    final serviceLabelRaw = bookingServiceTypeDisplay(b.serviceType);
    final serviceLabel = serviceLabelRaw.isEmpty ? 'Service' : serviceLabelRaw;
    final status = _titleize(b.status ?? '');
    final isServiceCompleted = BookingTrackingStatus.isBookingServiceCompleted(
      bookingStatus: b.status,
      trackingStatus: b.trackingStatus,
    );

    final rating = _bookingDriverRating(b, hasDriver: hasDriver);

    final title = isDriverView
        ? customerName
        : (hasDriver ? driverName : serviceLabel);
    // "Service Provider Not Assigned" must only describe active (non-cancelled)
    // bookings awaiting a provider. For cancelled bookings, clarify who
    // initiated the cancellation instead.
    final cancelledSubtitle = _cancelledBookingSubtitle(
      lifecycleStatus: lifecycleStatus,
      cancelledBy: b.cancelledBy,
      isDriverView: isDriverView,
    );
    final subtitle =
        cancelledSubtitle ??
        (isDriverView
            ? serviceLabel
            : (hasDriver ? serviceLabel : ServiceProviderLabels.notAssigned));

    final scheduleLabel = _formatBookingScheduleLine(scheduleIso);
    final serviceAddress = b.serviceLocation?.address?.trim();
    final locationAddress = (serviceAddress?.isNotEmpty ?? false)
        ? serviceAddress!
        : '—';

    return BookingItem(
      id: b.id ?? 0,
      service: serviceLabel,
      title: title,
      subtitle: subtitle,
      status: status.isEmpty ? '—' : status,
      lifecycleStatus: lifecycleStatus,
      date: created,
      amount: amountDisplay,
      hasProviderPayout: isDriverView && hasProviderPayout,
      rating: rating,
      distanceLabel: distance,
      isDriverAssigned: hasDriver,
      isServiceCompleted: isServiceCompleted,
      scheduleLabel: scheduleLabel,
      locationAddress: locationAddress,
      driverAvatarUrl: isDriverView
          ? avatarUrlFromDetail(b.customerDetail)
          : avatarUrlFromDetail(b.driverDetail),
      serviceTypeSlug: (b.serviceType ?? '').trim(),
      packageName: (b.packageName ?? '').trim(),
      scheduleType: (b.scheduleType ?? '').trim(),
      packageId: b.packageId,
      customPackageName: (b.customPackageName ?? '').trim(),
      serviceDurationMinutes: b.serviceDurationMinutes,
      vehicleChargeLimit: b.vehicleChargeLimit,
      currentBatteryCharge: (b.currentBatteryCharge ?? '').trim(),
      currentBatteryStatus: (b.currentBatteryStatus ?? '').trim(),
      currentBatteryStatusLabel: (b.currentBatteryStatusLabel ?? '').trim(),
    );
  }

  String _formatDistanceMilesLabel(double? miles) {
    if (miles == null) return '—';
    final whole = miles == miles.roundToDouble();
    final n = whole ? miles.round().toString() : miles.toStringAsFixed(1);
    return '$n miles';
  }

  String? _bookingScheduleIso(bl.Bookings b) {
    final scheduled = b.scheduledAt?.trim();
    if (scheduled != null && scheduled.isNotEmpty) return scheduled;
    return b.createdAt;
  }

  String _formatBookingScheduleLine(String? iso) {
    if (iso == null || iso.trim().isEmpty) {
      return 'Scheduled for —';
    }
    final dt = DateTime.tryParse(iso);
    if (dt == null) return 'Scheduled for ${iso.trim()}';
    final local = dt.toLocal();
    const months = <String>[
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    final mon = months[local.month - 1];
    final day = local.day;
    final year = local.year;
    final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
    final minute = local.minute.toString().padLeft(2, '0');
    final ap = local.hour >= 12 ? 'PM' : 'AM';
    return 'Scheduled for $mon $day, $year • $hour:$minute $ap';
  }

  String? avatarUrlFromDetail(dynamic detail) {
    if (detail == null) return null;
    // New typed models.
    if (detail is bl.DriverDetail || detail is bd.DriverDetail) {
      final u = (detail.profilePicture ?? '').trim();
      return u.isEmpty ? null : u;
    }
    if (detail is bl.CustomerDetail) {
      final u = (detail.profilePicture ?? '').trim();
      return u.isEmpty ? null : u;
    }
    if (detail is bd.AssignedDriver) {
      final u = (detail.profile ?? '').trim();
      return u.isEmpty ? null : u;
    }
    // Backward-compatible: some endpoints may still return raw maps.
    if (detail is! Map) return null;
    const keys = [
      'profile_picture',
      'profile_image',
      'avatar',
      'avatar_url',
      'photo',
      'picture',
    ];
    for (final k in keys) {
      final p = detail[k];
      if (p is! String) continue;
      final u = p.trim();
      if (u.isEmpty) continue;
      if (u.startsWith('http://') || u.startsWith('https://')) return u;
    }
    return null;
  }

  int? _reviewCountFromDetail(dynamic detail) {
    if (detail == null) return null;
    if (detail is bl.DriverDetail) return detail.reviewCount;
    if (detail is Map) {
      final raw = detail['review_count'] ?? detail['reviewCount'];
      if (raw is int) return raw;
      return int.tryParse('${raw ?? ''}');
    }
    return null;
  }

  String _bookingDriverRating(bl.Bookings b, {required bool hasDriver}) {
    if (!hasDriver) return '—';
    final detail = b.driverDetail;
    final reviewCount = _reviewCountFromDetail(detail);
    if (reviewCount != null && reviewCount <= 0) return '—';
    final value = ratingFromDetail(detail);
    if (value == null || !value.isFinite || value <= 0) return '—';
    return value.toStringAsFixed(1);
  }

  String personNameFromDetail(
    dynamic detail, {
    String fallback = ServiceProviderLabels.fallbackName,
  }) {
    if (detail == null) return fallback;
    if (detail is bl.DriverDetail || detail is bd.DriverDetail) {
      final name = (detail.name ?? '').trim();
      return name.isNotEmpty ? name : fallback;
    }
    if (detail is bl.CustomerDetail) {
      final name = (detail.name ?? '').trim();
      return name.isNotEmpty ? name : fallback;
    }
    if (detail is Map) {
      final name = '${detail['name'] ?? ''}'.trim();
      if (name.isNotEmpty) return name;
      final first = '${detail['first_name'] ?? ''}'.trim();
      final last = '${detail['last_name'] ?? ''}'.trim();
      final full = '$first $last'.trim();
      if (full.isNotEmpty) return full;
    }
    return fallback;
  }

  /// Driver snapshot from booking detail (`driver_detail` or `assigned_driver`).
  dynamic driverPersonFromBookingDetail(bd.Data? detail) {
    if (detail == null) return null;
    return detail.driverDetail ?? detail.assignedDriver;
  }

  /// Name from booking API `driver_detail` (same rules as booking cards). Returns `Driver` when unknown.
  String bookingDriverNameFromDetail(dynamic detail) {
    if (detail is bd.AssignedDriver) {
      final name = (detail.name ?? '').trim();
      return name.isNotEmpty ? name : ServiceProviderLabels.fallbackName;
    }
    return personNameFromDetail(
      detail,
      fallback: ServiceProviderLabels.fallbackName,
    );
  }

  bool _isPlaceholderPersonLabel(String value) {
    final v = value.trim().toLowerCase();
    return v.isEmpty || v == 'driver' || v == 'customer';
  }

  String? phoneFromDetail(dynamic detail) {
    if (detail == null) return null;
    if (detail is bl.CustomerDetail || detail is bd.DriverDetail) {
      final p = (detail.phone ?? '').trim();
      return p.isEmpty ? null : p;
    }
    if (detail is bd.AssignedDriver) {
      final p = (detail.phone ?? '').trim();
      return p.isEmpty ? null : p;
    }
    if (detail is Map) {
      for (final k in const ['phone', 'mobile', 'contact_number']) {
        final p = '${detail[k] ?? ''}'.trim();
        if (p.isNotEmpty) return p;
      }
    }
    return null;
  }

  double? ratingFromDetail(dynamic detail) {
    if (detail == null) return null;
    if (detail is bl.DriverDetail) return detail.avgRating;
    if (detail is bd.DriverDetail) return detail.avgRating;
    if (detail is bd.AssignedDriver) return detail.avgRating;
    if (detail is Map) {
      final r = detail['avg_rating'] ?? detail['avgRating'];
      if (r is num) return r.toDouble();
      return double.tryParse('${r ?? ''}');
    }
    return null;
  }

  /// Live trip: driver label from socket first, then booking `driver_detail`.
  String customerLiveDriverDisplayName() {
    final s = (customerSocketDriverName.value ?? '').trim();
    if (s.isNotEmpty && !_isPlaceholderPersonLabel(s)) return s;
    final d = serviceDetail.value;
    final fromDetail = personNameFromDetail(d?.driverDetail, fallback: '');
    if (fromDetail.isNotEmpty && !_isPlaceholderPersonLabel(fromDetail)) {
      return fromDetail;
    }
    final assigned = (d?.assignedDriver?.name ?? '').trim();
    if (assigned.isNotEmpty) return assigned;
    return '';
  }

  /// Avatar URL for live map marker (socket → API `driver_detail` / `assigned_driver`).
  String customerLiveDriverAvatarUrl() => _customerAssignedDriverAvatarUrl();

  /// Driver rating for customer live trip UI (socket → API).
  String customerLiveDriverRatingLabel() {
    final rating = customerLiveDriverRating();
    if (rating == null || !rating.isFinite) return '';
    return rating.toStringAsFixed(1);
  }

  double? customerLiveDriverRating() {
    final cached = customerSocketDriverRating.value;
    if (cached != null && cached.isFinite) return cached;
    final d = serviceDetail.value;
    return ratingFromDetail(d?.driverDetail) ??
        ratingFromDetail(d?.assignedDriver);
  }

  String customerLiveDriverPhone() {
    final cached = (customerSocketDriverPhone.value ?? '').trim();
    if (cached.isNotEmpty) return cached;
    final d = serviceDetail.value;
    return phoneFromDetail(d?.driverDetail) ??
        phoneFromDetail(d?.assignedDriver) ??
        '';
  }

  String driverActiveCustomerPhone() {
    final d = serviceDetail.value;
    return phoneFromDetail(d?.customerDetail) ?? '';
  }

  Future<void> _launchTelUri(String rawPhone) async {
    final digits = rawPhone.replaceAll(RegExp(r'[^\d+]'), '');
    if (digits.isEmpty) {
      showAppSnackBar(
        title: 'Call',
        message: 'Phone number is not available.',
        isError: true,
      );
      return;
    }
    final uri = Uri.parse(
      digits.startsWith('+') ? 'tel:$digits' : 'tel:$digits',
    );
    try {
      final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!ok) {
        showAppSnackBar(
          title: 'Call',
          message: 'Could not open the phone app.',
          isError: true,
        );
      }
    } catch (_) {
      showAppSnackBar(
        title: 'Call',
        message: 'Could not open the phone app.',
        isError: true,
      );
    }
  }

  Future<void> launchCustomerDriverPhoneCall() async {
    final phone = customerLiveDriverPhone().trim();
    if (phone.isEmpty) {
      showAppSnackBar(
        title: 'Call service provider',
        message: 'Service provider phone number is not available yet.',
        isError: true,
      );
      return;
    }
    await _launchTelUri(phone);
  }

  void openActiveCustomerBookingChat() {
    final detail = serviceDetail.value;
    final bookingId =
        postBookingApiId.value ??
        _activeCustomerLiveTrackingBookingId ??
        detail?.id;
    if (bookingId == null || bookingId <= 0) {
      showAppSnackBar(
        title: 'Messages',
        message: 'Booking details are not ready yet.',
        isError: true,
      );
      return;
    }

    final status = (detail?.status ?? '').toString().toLowerCase().trim();
    final hasDriver =
        (detail?.driverId != null) ||
        detail?.driverDetail != null ||
        detail?.assignedDriver != null;
    if (!bookingChatVisibleForCustomer(
      statusLower: status,
      hasDriverAssigned: hasDriver,
    )) {
      showAppSnackBar(
        title: 'Messages',
        message: 'Chat is not available for this booking.',
        isError: true,
      );
      return;
    }

    final driverName = customerLiveDriverDisplayName().trim();
    final driverImage = customerLiveDriverAvatarUrl().trim();

    Get.toNamed(
      Routes.DRIVER_CHAT,
      arguments: {
        'bookingId': bookingId,
        'status': status,
        'peerId': detail?.driverId,
        'peerName': driverName.isNotEmpty
            ? driverName
            : ServiceProviderLabels.fallbackName,
        'peerImage': driverImage,
      },
    );
  }

  Future<void> launchDriverCustomerPhoneCall() async {
    final phone = driverActiveCustomerPhone().trim();
    if (phone.isEmpty) {
      showAppSnackBar(
        title: 'Call customer',
        message: 'Customer phone number is not available yet.',
        isError: true,
      );
      return;
    }
    await _launchTelUri(phone);
  }

  void _applyCustomerSocketDriverFields({
    String? driverName,
    String? driverAvatarUrl,
    String? driverPhone,
    double? driverAvgRating,
  }) {
    final dn = driverName?.trim();
    if (dn != null && dn.isNotEmpty) {
      customerSocketDriverName.value = dn;
    }
    final av = driverAvatarUrl?.trim();
    if (av != null && av.isNotEmpty) {
      customerSocketDriverAvatarUrl.value = av;
    }
    final ph = driverPhone?.trim();
    if (ph != null && ph.isNotEmpty) {
      customerSocketDriverPhone.value = ph;
    }
    if (driverAvgRating != null && driverAvgRating.isFinite) {
      customerSocketDriverRating.value = driverAvgRating;
    }
  }

  void _syncCustomerAssignedDriverFromBookingDetail(int bookingId) {
    final detail = serviceDetail.value;
    if (detail?.id != bookingId) return;

    final name = personNameFromDetail(detail!.driverDetail, fallback: '');
    final assignedName = (detail.assignedDriver?.name ?? '').trim();
    if (name.isNotEmpty && !_isPlaceholderPersonLabel(name)) {
      customerSocketDriverName.value = name;
    } else if (assignedName.isNotEmpty) {
      customerSocketDriverName.value = assignedName;
    }

    final avatar = (avatarUrlFromDetail(detail.driverDetail) ?? '').trim();
    if (avatar.isNotEmpty) {
      customerSocketDriverAvatarUrl.value = avatar;
    } else {
      final assignedAvatar = (detail.assignedDriver?.profile ?? '').trim();
      if (assignedAvatar.isNotEmpty) {
        customerSocketDriverAvatarUrl.value = assignedAvatar;
      }
    }

    final rating =
        ratingFromDetail(detail.driverDetail) ??
        ratingFromDetail(detail.assignedDriver);
    if (rating != null && rating.isFinite) {
      customerSocketDriverRating.value = rating;
    }

    final phone =
        phoneFromDetail(detail.driverDetail) ??
        phoneFromDetail(detail.assignedDriver);
    if (phone != null && phone.isNotEmpty) {
      customerSocketDriverPhone.value = phone;
    }
  }

  String customerNameFromBooking(bl.Bookings b) =>
      personNameFromDetail(b.customerDetail, fallback: 'Customer');

  String? customerAvatarUrl(bl.Bookings b) =>
      avatarUrlFromDetail(b.customerDetail);

  bl.Bookings? _driverBookingFromLists(int bookingId) {
    if (bookingId <= 0) return null;
    for (final b in driverNearbyUnassignedBookings) {
      if (b.id == bookingId) return b;
    }
    for (final b in driverPushNewBookings) {
      if (b.id == bookingId) return b;
    }
    return null;
  }

  void _seedActiveDriverCustomerFromBookingLists(int bookingId) {
    final b = _driverBookingFromLists(bookingId);
    if (b == null) return;
    final name = customerNameFromBooking(b).trim();
    if (name.isNotEmpty && name != 'Customer') {
      activeDriverCustomerName.value = name;
    }
    final avatar = customerAvatarUrl(b)?.trim() ?? '';
    if (avatar.isNotEmpty) {
      activeDriverCustomerAvatarUrl.value = avatar;
    }
  }

  void _syncActiveDriverCustomerFromBookingDetail(int bookingId) {
    final detail = serviceDetail.value;
    if (detail?.id != bookingId) return;
    final name = personNameFromDetail(detail!.customerDetail, fallback: '');
    if (name.isNotEmpty) {
      activeDriverCustomerName.value = name;
    }
    final avatar = avatarUrlFromDetail(detail.customerDetail)?.trim() ?? '';
    if (avatar.isNotEmpty) {
      activeDriverCustomerAvatarUrl.value = avatar;
    }
  }

  /// Customer label and avatar for the active driver trip panel.
  ({String name, String avatarUrl}) activeDriverCustomerDisplay() {
    var name = activeDriverCustomerName.value.trim();
    var avatarUrl = activeDriverCustomerAvatarUrl.value.trim();
    final activeId = activeDriverBookingId.value;
    if (activeId != null && activeId > 0) {
      final b = _driverBookingFromLists(activeId);
      if (b != null) {
        if (name.isEmpty || name == 'Customer') {
          final n = customerNameFromBooking(b).trim();
          if (n.isNotEmpty) name = n;
        }
        if (avatarUrl.isEmpty) {
          avatarUrl = (customerAvatarUrl(b) ?? '').trim();
        }
      }
      final detail = serviceDetail.value;
      if (detail != null && detail.id == activeId) {
        if (name.isEmpty || name == 'Customer') {
          final n = personNameFromDetail(
            detail.customerDetail,
            fallback: '',
          ).trim();
          if (n.isNotEmpty) name = n;
        }
        if (avatarUrl.isEmpty) {
          avatarUrl = (avatarUrlFromDetail(detail.customerDetail) ?? '').trim();
        }
      }
      for (final item in bookings) {
        if (item.id != activeId) continue;
        if (name.isEmpty || name == 'Customer') {
          final itemName = item.title.trim();
          if (itemName.isNotEmpty) name = itemName;
        }
        if (avatarUrl.isEmpty) {
          avatarUrl = (item.driverAvatarUrl ?? '').trim();
        }
        break;
      }
    }
    if (name.isEmpty) name = 'Customer';
    return (name: name, avatarUrl: avatarUrl);
  }

  /// Customer name, avatar, and service label for driver trip bottom sheets.
  ({String name, String avatarUrl, String service})
  activeDriverTripCustomerMeta() {
    final customer = activeDriverCustomerDisplay();
    var service = 'Service';
    final activeId = activeDriverBookingId.value;
    if (activeId != null && activeId > 0) {
      for (final item in bookings) {
        if (item.id != activeId) continue;
        final itemService = item.service.trim();
        if (itemService.isNotEmpty) service = itemService;
        break;
      }
      if (service == 'Service') {
        final b = _driverBookingFromLists(activeId);
        if (b != null) {
          final s = bookingServiceTypeDisplay(b.serviceType).trim();
          if (s.isNotEmpty) service = s;
        }
      }
      if (service == 'Service') {
        final detail = serviceDetail.value;
        if (detail != null && detail.id == activeId) {
          final s = bookingServiceTypeDisplay(detail.serviceType).trim();
          if (s.isNotEmpty) {
            service = s;
          } else {
            final label = detail.serviceTypeLabel?.trim();
            if (label != null && label.isNotEmpty) service = label;
          }
        }
      }
    }
    return (
      name: customer.name,
      avatarUrl: customer.avatarUrl,
      service: service,
    );
  }

  String _currencyAmountFallback(dynamic totalPrice, String? currency) {
    final value = double.tryParse('${totalPrice ?? ''}');
    if (value == null) return '—';
    final symbol = (currency ?? '').toLowerCase() == 'usd' ? '\$' : '';
    final fixed = value.toStringAsFixed(2);
    return '$symbol$fixed';
  }

  String _formatBookingDate(String? iso) {
    if (iso == null || iso.trim().isEmpty) return '—';
    final dt = DateTime.tryParse(iso);
    if (dt == null) return iso;
    final local = dt.toLocal();
    final mm = local.month.toString().padLeft(2, '0');
    final dd = local.day.toString().padLeft(2, '0');
    final yyyy = local.year.toString();
    final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
    final minute = local.minute.toString().padLeft(2, '0');
    final ap = local.hour >= 12 ? 'PM' : 'AM';
    return '$mm/$dd/$yyyy, $hour:$minute $ap';
  }

  String _titleize(String input) {
    final clean = input.trim();
    if (clean.isEmpty) return '';
    return clean
        .split(RegExp(r'\s+'))
        .where((w) => w.isNotEmpty)
        .map((w) => '${w[0].toUpperCase()}${w.substring(1).toLowerCase()}')
        .join(' ');
  }

  Future<void> _syncProfileHeaderFromSettings() async {
    final settings = Get.find<SettingsController>();
    await settings.ensureCustomerProfileLoaded();
    refreshProfileHeader();
  }

  void _startGreetingTicker() {
    _greetingTick.value++;
    _greetingTimer?.cancel();
    _greetingTimer = Timer.periodic(const Duration(minutes: 1), (_) {
      _greetingTick.value++;
    });
  }

  void startPostBookingJourney({int? bookingApiId}) {
    if ((bookingApiId ?? 0) > 0) {
      _clearCustomerTripEndedMarker();
    }
    postBookingApiId.value = bookingApiId;
    postBookingStartedAt.value = DateTime.now();
    postBookingStage.value = PostBookingStage.providerEnRoutePickup;
    customerTripPanelUserDismissed.value = false;
    customerTripPanelCollapsed.value = false;
    enRoutePanelMode.value = EnRoutePanelMode.summary;
    homeNavIndex.value = 0;
    _postBookingTimer?.cancel();
    _postBookingTimer = null;
    final id = bookingApiId ?? 0;
    if (id > 0 && Get.isRegistered<BookingLiveSocketService>()) {
      _persistCustomerLiveSession(bookingId: id);
      unawaited(startCustomerLiveTracking(id));
    }
  }

  void clearPostBookingJourney({bool immediate = false}) {
    void apply() {
      if (isClosed) return;
      customerTripPanelEnabled.value = false;
      customerTripPanelCollapsed.value = false;
      _customerLiveTracking = false;
      _activeCustomerLiveTrackingBookingId = null;
      _postBookingTimer?.cancel();
      _postBookingTimer = null;
      postBookingStartedAt.value = null;
      postBookingApiId.value = null;
      postBookingStage.value = PostBookingStage.providerEnRoutePickup;
      enRoutePanelMode.value = EnRoutePanelMode.summary;
      customerTrackingUpdateMessage.value = null;
      customerSocketDriverName.value = null;
      customerSocketDriverAvatarUrl.value = null;
      customerSocketDriverPhone.value = null;
      customerSocketDriverRating.value = null;
      customerSocketTrackingCode.value = null;
      customerSocketBookingStatusRaw.value = null;
      _clearPersistedCustomerLiveSession();
      if (Get.isRegistered<CancelReasonController>()) {
        Get.find<CancelReasonController>().reset();
      }
    }

    if (immediate) {
      apply();
      return;
    }
    final phase = WidgetsBinding.instance.schedulerPhase;
    if (phase == SchedulerPhase.transientCallbacks ||
        phase == SchedulerPhase.midFrameMicrotasks ||
        phase == SchedulerPhase.persistentCallbacks) {
      WidgetsBinding.instance.addPostFrameCallback((_) => apply());
      return;
    }
    apply();
  }

  void _persistCustomerLiveSession({
    required int bookingId,
    String? trackingCode,
    String? driverName,
    String? driverAvatarUrl,
  }) {
    if (!Prefs().isCustomerRole || bookingId <= 0) return;
    Prefs().putData(_activeCustomerLiveBookingIdKey, bookingId.toString());
    Prefs().putBool(_activeCustomerLiveTrackingStartedKey, true);
    Prefs().putData(
      _activeCustomerPostBookingStageKey,
      postBookingStage.value.name,
    );
    final started = postBookingStartedAt.value;
    if (started != null) {
      Prefs().putData(
        _activeCustomerPostBookingStartedAtMsKey,
        started.millisecondsSinceEpoch.toString(),
      );
    }
    final code = (trackingCode ?? customerSocketTrackingCode.value ?? '')
        .trim()
        .toUpperCase();
    if (code.isNotEmpty) {
      Prefs().putData(_activeCustomerTrackingCodeKey, code);
    }
    final dn = (driverName ?? customerSocketDriverName.value ?? '').trim();
    if (dn.isNotEmpty) {
      Prefs().putData(_activeCustomerSocketDriverNameKey, dn);
    }
    final av = (driverAvatarUrl ?? customerSocketDriverAvatarUrl.value ?? '')
        .trim();
    if (av.isNotEmpty) {
      Prefs().putData(_activeCustomerSocketDriverAvatarKey, av);
    }
  }

  void _clearPersistedCustomerLiveSession() {
    if (!Prefs().isCustomerRole) return;
    Prefs().putBool(_activeCustomerLiveTrackingStartedKey, false);
    unawaited(Prefs().removeData(_activeCustomerLiveBookingIdKey));
    unawaited(Prefs().removeData(_activeCustomerPostBookingStageKey));
    unawaited(Prefs().removeData(_activeCustomerTrackingCodeKey));
    unawaited(Prefs().removeData(_activeCustomerPostBookingStartedAtMsKey));
    unawaited(Prefs().removeData(_activeCustomerSocketDriverNameKey));
    unawaited(Prefs().removeData(_activeCustomerSocketDriverAvatarKey));
    _clearPersistedCustomerPickupOtp();
  }

  void _markCustomerTripEndedInPrefs(int bookingId) {
    if (!Prefs().isCustomerRole || bookingId <= 0) return;
    Prefs().putData(_customerTripEndedBookingIdKey, bookingId.toString());
  }

  void _clearCustomerTripEndedMarker() {
    unawaited(Prefs().removeData(_customerTripEndedBookingIdKey));
  }

  PostBookingStage _postBookingStageFromPersistedName(String raw) {
    final name = raw.trim();
    for (final stage in PostBookingStage.values) {
      if (stage.name == name) return stage;
    }
    return PostBookingStage.providerEnRoutePickup;
  }

  bool _customerLiveSessionShouldEnd(bd.BookingDetailData? detail) {
    if (_isExpiredCustomerPickupWaitFromDetail(detail)) return true;
    return _driverActiveBookingShouldClear(detail);
  }

  /// Provider dashboard: clear local session only for terminal booking states.
  /// Expired customer pickup wait must not hide an in-progress driver job.
  bool _driverActiveBookingShouldClear(bd.BookingDetailData? detail) {
    if (detail == null) return false;
    if (BookingTrackingStatus.isBookingCancelled(
      bookingStatus: detail.status?.toString(),
      trackingStatus: detail.trackingStatus,
    )) {
      return true;
    }
    if (BookingTrackingStatus.isVehicleDelivered(detail.trackingStatus)) {
      return true;
    }
    if (_customerTripAwaitingDeliveryInspection(detail: detail)) {
      return false;
    }
    final life = '${detail.status ?? ''}'.trim().toUpperCase();
    if (life == 'COMPLETED' ||
        life == 'CANCELLED' ||
        life == 'CANCELED' ||
        life == 'FAILED' ||
        life == 'REFUNDED') {
      return true;
    }
    return BookingTrackingStatus.isBookingServiceCompleted(
      bookingStatus: detail.status?.toString(),
      trackingStatus: detail.trackingStatus,
    );
  }

  Future<void> _clearCustomerTripAfterBookingEnded({
    bool refreshBookingsList = true,
    int? endedBookingId,
  }) async {
    final tripId =
        endedBookingId ??
        postBookingApiId.value ??
        _activeCustomerLiveTrackingBookingId ??
        int.tryParse(Prefs().getData(_activeCustomerLiveBookingIdKey).trim());
    if (tripId != null && tripId > 0) {
      _markCustomerTripEndedInPrefs(tripId);
    }
    customerTripPanelEnabled.value = false;
    _customerLiveTracking = false;
    _activeCustomerLiveTrackingBookingId = null;
    clearPostBookingJourney(immediate: true);
    if (Get.isRegistered<BookingLiveSocketService>()) {
      await stopCustomerLiveTracking();
    }
    if (refreshBookingsList) {
      unawaited(refreshBookings());
    }
  }

  void dismissCustomerTripPanel() {
    setCustomerTripPanelCollapsed(true);
  }

  void toggleCustomerTripPanelCollapsed() {
    setCustomerTripPanelCollapsed(!customerTripPanelCollapsed.value);
  }

  void setCustomerTripPanelCollapsed(bool collapsed) {
    customerTripPanelCollapsed.value = collapsed;
    if (isCustomerLiveTrackingActive) {
      _customerLiveCameraPausedUntil = null;
      _scheduleCustomerLiveCameraUpdate(forceFollow: true);
    }
  }

  void openEnRouteContactOptions() {
    enRoutePanelMode.value = EnRoutePanelMode.contactOptions;
  }

  void openEnRouteCancelReason() {
    if (isActiveTripCancellationBlocked) {
      showAppSnackBar(
        title: 'Cannot cancel booking',
        message:
            'This booking cannot be cancelled after vehicle handover OTP verification.',
        isError: true,
      );
      return;
    }
    enRoutePanelMode.value = EnRoutePanelMode.cancelReason;
  }

  void resetEnRoutePanel() {
    enRoutePanelMode.value = EnRoutePanelMode.summary;
    if (Get.isRegistered<CancelReasonController>()) {
      Get.find<CancelReasonController>().reset();
    }
  }

  /// From the "Service Provider Has Arrived" sheet — acknowledges handoff; journey
  /// milestones continue via [booking_tracking_update].
  void confirmProviderArrived() {
    if (postBookingStage.value != PostBookingStage.providerArrived) return;
    final tracking = BookingTrackingStatus.normalizeTrackingCode(
      customerSocketTrackingCode.value ?? serviceDetail.value?.trackingStatus,
    );
    if (BookingTrackingStatus.isCustomerPickupOtpSharePhase(tracking)) {
      return;
    }
    postBookingStage.value = PostBookingStage.serviceStarted;
    resetEnRoutePanel();
  }

  void _resetMapAnnotationManagers() {
    _routeAnnotationManager = null;
    _destinationPinManager = null;
    _driverPickupRouteManager = null;
    _driverEnRouteSelfPinManager = null;
    _driverPickupCustomerPinManager = null;
    _driverServiceLegRouteManager = null;
    _driverServiceLegCarPinManager = null;
    _driverServiceLegServiceLocationPinManager = null;
    _customerLiveDriverPinManager = null;
    _customerLiveCustomerProfilePinManager = null;
    _customerLiveDestinationPinManager = null;
    _customerPickupPinManager = null;
    _customerServicePinManager = null;
    _customerLiveRouteManager = null;
  }

  Future<void> _disposeDriverEnRouteMapAnnotations() async {
    await _driverPickupRouteManager?.deleteAll();
    await _driverEnRouteSelfPinManager?.deleteAll();
    await _driverPickupCustomerPinManager?.deleteAll();
    _driverPickupRouteManager = null;
    _driverEnRouteSelfPinManager = null;
    _driverPickupCustomerPinManager = null;
  }

  Future<void> _disposeDriverServiceLegMapAnnotations() async {
    await _driverServiceLegRouteManager?.deleteAll();
    await _driverServiceLegCarPinManager?.deleteAll();
    await _driverServiceLegServiceLocationPinManager?.deleteAll();
    await _driverServiceLegEvPinManager?.deleteAll();
    _driverServiceLegRouteManager = null;
    _driverServiceLegCarPinManager = null;
    _driverServiceLegServiceLocationPinManager = null;
    _driverServiceLegEvPinManager = null;
    _driverServiceLegCachedRouteCoords = null;
    _driverServiceLegRouteTrimAnchorSeg = 0;
    _driverServiceLegStops = const [];
  }

  Future<void> _disposeDriverReturnLegMapAnnotations() async {
    await _driverReturnLegRouteManager?.deleteAll();
    await _driverReturnLegCarPinManager?.deleteAll();
    await _driverReturnLegHomePinManager?.deleteAll();
    _driverReturnLegRouteManager = null;
    _driverReturnLegCarPinManager = null;
    _driverReturnLegHomePinManager = null;
    _driverReturnLegCachedRouteCoords = null;
    _driverReturnLegRouteTrimAnchorSeg = 0;
    _driverReturnLegCameraFitted = false;
    _driverReturnLegRoutePendingRedraw = false;
  }

  /// Clears live-trip layers so re-created managers do not stack duplicate pins.
  Future<void> _disposeCustomerLiveMapAnnotations() async {
    await _customerLiveDriverPinManager?.deleteAll();
    _customerLiveDriverPinManager = null;
    await _customerLiveCustomerProfilePinManager?.deleteAll();
    _customerLiveCustomerProfilePinManager = null;
    await _customerLiveDestinationPinManager?.deleteAll();
    _customerLiveDestinationPinManager = null;
    await _customerPickupPinManager?.deleteAll();
    _customerPickupPinManager = null;
    await _customerServicePinManager?.deleteAll();
    _customerServicePinManager = null;
    await _customerLiveRouteManager?.deleteAll();
    _customerLiveRouteManager = null;
  }

  Future<void> onMapCreated(MapboxMap mapboxMap) async {
    mapbox = mapboxMap;
    await _disposeCustomerLiveMapAnnotations();
    await _disposeDriverEnRouteMapAnnotations();
    await _disposeDriverServiceLegMapAnnotations();
    await _disposeDriverReturnLegMapAnnotations();
    _resetMapAnnotationManagers();
    if (Prefs().isDriverRole &&
        (isDriverEnRouteToPickup ||
            isDriverEnRouteToServiceCenter ||
            isDriverEnRouteToDropOff)) {
      await _refreshMapLocationPuck();
    }
    if (!isCustomerLiveTrackingActive) {
      unawaited(_bootstrapAutoRecenter());
    }
    if (_locationPermissionRecenterPending) {
      unawaited(_recenterMapAfterLocationPermission());
    }
    if (Prefs().isDriverRole) {
      unawaited(_ensureDriverHomeRecenters());
      if (isDriverEnRouteToDropOff) {
        unawaited(drawDriverRouteToCustomerDropOffWithCustomPins());
      } else if (isDriverEnRouteToServiceCenter) {
        unawaited(drawDriverRouteToServiceCenterWithCustomPins());
      } else if (hasStartedService.value &&
          !_driverPickupArrivedPopupShown &&
          (_driverPickupRoutePendingRedraw ||
              _driverPickupCachedRouteCoords == null)) {
        unawaited(_refreshDriverPickupRouteWhenMapReady());
      }
    } else if (Prefs().isCustomerRole) {
      final id = _activeCustomerLiveTrackingBookingId;
      if (id != null && id > 0) {
        unawaited(_syncCustomerLiveTrackingMapAnnotations(id));
        if (_customerLiveRoutePendingRedraw) {
          unawaited(_refreshCustomerLiveRouteIfPossible());
        }
      }
    }
  }

  Future<void> _ensureDriverHomeRecenters() async {
    // Driver login can land on map before GPS/puck is warm; retry shortly.
    await recenterMapOnUserLocation();
    await Future<void>.delayed(const Duration(milliseconds: 1200));
    // Skip the follow-up nudge if the driver has already taken control.
    if (_driverMapManuallyMoved) return;
    await recenterMapOnUserLocation();
  }

  /// Recenters the map on the device location (home tab my-location control).
  /// This is an explicit request, so it clears the manual-move lock.
  Future<void> recenterMapOnUserLocation() async {
    if (mapbox == null) return;
    if (Prefs().isCustomerRole && isCustomerLiveTrackingActive) {
      _customerLiveCameraPausedUntil = null;
      _scheduleCustomerLiveCameraUpdate(forceFollow: true);
      return;
    }
    Alert.log('MapRecenter', 'provider current-location pointer tapped');
    _driverMapManuallyMoved = false;
    if (Prefs().isDriverRole) {
      // A nearby-booking refresh can complete during this camera animation.
      // Keep that overview fit from replacing the explicit GPS recenter.
      _driverExplicitRecenterFitLockUntil = DateTime.now().add(
        const Duration(seconds: 8),
      );
      await mapbox!.cancelCameraAnimation();
    }
    // User explicitly tapped recenter — always show settings dialog if denied.
    await _moveCameraToCurrentLocation(showSettingsDialog: true);
  }

  /// Map tap: place pin at tapped coordinate and build driving route from user location.
  void onMapTap(MapContentGestureContext context) {
    // if (context.gestureState != GestureState.ended) return;
    // unawaited(
    //   drawDrivingRouteToDestination(
    //     context.point.coordinates,
    //     showUserErrors: true,
    //   ),
    // );
  }

  /// Longitude from Mapbox [Position] or a GeoJSON `[lng, lat, …]` list.
  double _coordLng(Position p) {
    final o = p as Object;
    if (o is List && o.length >= 2) return (o[0] as num).toDouble();
    return p.lng.toDouble();
  }

  /// Latitude from Mapbox [Position] or a GeoJSON `[lng, lat, …]` list.
  double _coordLat(Position p) {
    final o = p as Object;
    if (o is List && o.length >= 2) return (o[1] as num).toDouble();
    return p.lat.toDouble();
  }

  /// Closest point on the polyline to [targetLat]/[targetLng] (for destination pins).
  ({double lat, double lng}) _closestPointOnRoutePolyline(
    List<Position> route,
    double targetLat,
    double targetLng,
  ) {
    if (route.isEmpty) return (lat: targetLat, lng: targetLng);
    if (route.length == 1) {
      return (lat: _coordLat(route.first), lng: _coordLng(route.first));
    }
    var bestDist = double.infinity;
    var bestLat = _coordLat(route.first);
    var bestLng = _coordLng(route.first);
    for (var i = 0; i < route.length - 1; i++) {
      final seg = _closestPointOnSegmentLonLat(
        _coordLng(route[i]),
        _coordLat(route[i]),
        _coordLng(route[i + 1]),
        _coordLat(route[i + 1]),
        targetLng,
        targetLat,
      );
      final dist = Geolocator.distanceBetween(
        targetLat,
        targetLng,
        seg.$2,
        seg.$1,
      );
      if (dist < bestDist) {
        bestDist = dist;
        bestLat = seg.$2;
        bestLng = seg.$1;
      }
    }
    return (lat: bestLat, lng: bestLng);
  }

  /// Route terminus + home pin share the same on-line coordinate (like the car pin).
  ({List<Position> route, double pinLat, double pinLng})
  _routeWithHomePinOnPolylineTerminus(
    List<Position> route,
    double destLat,
    double destLng,
  ) {
    if (!destLat.isFinite || !destLng.isFinite) {
      return (route: route, pinLat: destLat, pinLng: destLng);
    }
    var out = _finalizeRouteAtDestinationPin(route, destLat, destLng);
    if (out.isEmpty) {
      return (route: out, pinLat: destLat, pinLng: destLng);
    }

    final snap = _closestPointOnRoutePolyline(out, destLat, destLng);
    var pinLat = snap.lat;
    var pinLng = snap.lng;

    if (out.length >= 2) {
      final gapToDest = Geolocator.distanceBetween(
        pinLat,
        pinLng,
        destLat,
        destLng,
      );
      if (gapToDest <= 25) {
        pinLat = destLat;
        pinLng = destLng;
        out[out.length - 1] = Position(destLng, destLat);
      } else {
        out[out.length - 1] = Position(pinLng, pinLat);
      }
    } else {
      out[0] = Position(pinLng, pinLat);
    }

    return (route: out, pinLat: pinLat, pinLng: pinLng);
  }

  /// Project [vehLng], [vehLat] onto segment A→B (WGS84, small-distance planar OK).
  (double lng, double lat) _closestPointOnSegmentLonLat(
    double lon1,
    double lat1,
    double lon2,
    double lat2,
    double vehLng,
    double vehLat,
  ) {
    final dx = lon2 - lon1;
    final dy = lat2 - lat1;
    final len2 = dx * dx + dy * dy;
    if (len2 < 1e-22) return (lon1, lat1);
    var t = ((vehLng - lon1) * dx + (vehLat - lat1) * dy) / len2;
    t = t.clamp(0.0, 1.0);
    return (lon1 + t * dx, lat1 + t * dy);
  }

  /// Drops the polyline behind the vehicle: keep path from snapped point toward destination only.
  ({List<Position> trimmed, int newAnchorSeg})
  _trimDrivingPolylineAheadOfVehicle({
    required List<Position> fullRoute,
    required double lat,
    required double lng,
    required int anchorSeg,
  }) {
    final n = fullRoute.length;
    if (n < 2) {
      return (
        trimmed: fullRoute,
        newAnchorSeg: anchorSeg.clamp(0, math.max(n - 1, 0)),
      );
    }
    final startScan = anchorSeg.clamp(0, n - 2);
    var bestDist = double.infinity;
    var bestI = startScan;

    late double bestLon;
    late double bestLat;
    bestLon = _coordLng(fullRoute[startScan]);
    bestLat = _coordLat(fullRoute[startScan]);

    for (var i = startScan; i < n - 1; i++) {
      final lon1 = _coordLng(fullRoute[i]);
      final lat1 = _coordLat(fullRoute[i]);
      final lon2 = _coordLng(fullRoute[i + 1]);
      final lat2 = _coordLat(fullRoute[i + 1]);
      final seg = _closestPointOnSegmentLonLat(
        lon1,
        lat1,
        lon2,
        lat2,
        lng,
        lat,
      );
      final dist = Geolocator.distanceBetween(lat, lng, seg.$2, seg.$1);
      if (dist < bestDist) {
        bestDist = dist;
        bestI = i;
        bestLon = seg.$1;
        bestLat = seg.$2;
      }
    }

    final snappedAnchorSeg = math.max(anchorSeg, bestI);

    final trimmed = <Position>[
      Position(bestLon, bestLat),
      ...fullRoute.skip(bestI + 1),
    ];
    return (trimmed: trimmed, newAnchorSeg: snappedAnchorSeg);
  }

  /// Ensures the drawn line reaches marker coords (Mapbox routes end on the road).
  List<Position> _alignDrivingRouteEndpoints(
    List<Position> route, {
    double? startLat,
    double? startLng,
    double? endLat,
    double? endLng,
    double mergeWithinMeters = 10,
    double appendIfWithinMeters = 120,
  }) {
    if (route.isEmpty) {
      if (startLat != null &&
          startLng != null &&
          endLat != null &&
          endLng != null) {
        return [Position(startLng, startLat), Position(endLng, endLat)];
      }
      return route;
    }

    final out = List<Position>.from(route);

    void applyStart() {
      final sLat = startLat!;
      final sLng = startLng!;
      final dist = Geolocator.distanceBetween(
        _coordLat(out.first),
        _coordLng(out.first),
        sLat,
        sLng,
      );
      if (dist <= mergeWithinMeters) {
        out[0] = Position(sLng, sLat);
      } else if (dist <= appendIfWithinMeters) {
        out.insert(0, Position(sLng, sLat));
      } else {
        out[0] = Position(sLng, sLat);
      }
    }

    void applyEnd() {
      final eLat = endLat!;
      final eLng = endLng!;
      final dist = Geolocator.distanceBetween(
        _coordLat(out.last),
        _coordLng(out.last),
        eLat,
        eLng,
      );
      if (dist <= mergeWithinMeters) {
        out[out.length - 1] = Position(eLng, eLat);
      } else if (dist <= appendIfWithinMeters) {
        out.add(Position(eLng, eLat));
      } else {
        // Keep the road-network terminus and add a connector to the marker.
        out.add(Position(eLng, eLat));
      }
    }

    if (startLat != null && startLng != null) {
      applyStart();
    }
    if (endLat != null && endLng != null) {
      applyEnd();
    }
    return out;
  }

  /// Straight segment from the route terminus to the marker when off the road network.
  List<Position> _ensureRouteReachesLatLng(
    List<Position> route,
    double lat,
    double lng, {
    double minConnectorMeters = 8,
  }) {
    if (!lat.isFinite || !lng.isFinite) return route;
    if (route.isEmpty) return [Position(lng, lat)];
    final dist = Geolocator.distanceBetween(
      _coordLat(route.last),
      _coordLng(route.last),
      lat,
      lng,
    );
    if (dist <= minConnectorMeters) {
      final out = List<Position>.from(route);
      out[out.length - 1] = Position(lng, lat);
      return out;
    }
    return [...route, Position(lng, lat)];
  }

  /// After trim, re-attach the cached suffix that leads to the destination pin.
  List<Position> _appendCachedRouteSuffixTowardDestination({
    required List<Position> fullRoute,
    required List<Position> trimmed,
    required double destLat,
    required double destLng,
  }) {
    if (fullRoute.length < 2 || trimmed.isEmpty) return trimmed;

    var destIdx = fullRoute.length - 1;
    var nearestDestDist = Geolocator.distanceBetween(
      _coordLat(fullRoute[destIdx]),
      _coordLng(fullRoute[destIdx]),
      destLat,
      destLng,
    );
    for (var i = 0; i < fullRoute.length; i++) {
      final d = Geolocator.distanceBetween(
        _coordLat(fullRoute[i]),
        _coordLng(fullRoute[i]),
        destLat,
        destLng,
      );
      if (d < nearestDestDist) {
        nearestDestDist = d;
        destIdx = i;
      }
    }

    var joinIdx = 0;
    var joinDist = double.infinity;
    for (var i = 0; i <= destIdx; i++) {
      final d = Geolocator.distanceBetween(
        _coordLat(fullRoute[i]),
        _coordLng(fullRoute[i]),
        _coordLat(trimmed.last),
        _coordLng(trimmed.last),
      );
      if (d < joinDist) {
        joinDist = d;
        joinIdx = i;
      }
    }

    if (joinIdx >= destIdx) return trimmed;

    final tail = fullRoute.sublist(joinIdx + 1, destIdx + 1);
    if (tail.isEmpty) return trimmed;

    final out = List<Position>.from(trimmed);
    final firstTail = tail.first;
    final alreadyHasTail =
        Geolocator.distanceBetween(
          _coordLat(out.last),
          _coordLng(out.last),
          _coordLat(firstTail),
          _coordLng(firstTail),
        ) <
        12;
    if (!alreadyHasTail) {
      out.addAll(tail);
    } else if (out.length >= 2 && tail.length > 1) {
      out.addAll(tail.skip(1));
    }
    return out;
  }

  /// Snaps the polyline terminus to the pin coordinate (short join only).
  List<Position> _finalizeRouteAtDestinationPin(
    List<Position> route,
    double destLat,
    double destLng,
  ) {
    if (!destLat.isFinite || !destLng.isFinite) return route;
    final dest = Position(destLng, destLat);
    if (route.isEmpty) return [dest];
    final gap = Geolocator.distanceBetween(
      _coordLat(route.last),
      _coordLng(route.last),
      destLat,
      destLng,
    );
    if (gap <= 2) {
      final out = List<Position>.from(route);
      out[out.length - 1] = dest;
      return out;
    }
    return [...route, dest];
  }

  /// One-time build: driving route + optional last-mile leg (not on every GPS tick).
  Future<List<Position>> _buildDrivingRouteToDestinationPin({
    required Position origin,
    required double destLat,
    required double destLng,
  }) async {
    if (!destLat.isFinite || !destLng.isFinite) return const [];
    final dest = Position(destLng, destLat);
    var route = await _fetchDrivingRoutePoints(
      start: origin,
      destination: dest,
    );
    if (route.length < 2) {
      route = [origin, dest];
    }
    route = _alignDrivingRouteEndpoints(
      route,
      startLat: _coordLat(origin),
      startLng: _coordLng(origin),
    );

    final last = route.last;
    final gap = Geolocator.distanceBetween(
      _coordLat(last),
      _coordLng(last),
      destLat,
      destLng,
    );
    if (gap > 15) {
      final connector = await _fetchDrivingRoutePoints(
        start: last,
        destination: dest,
      );
      if (connector.length >= 2) {
        route = _mergeAdjacentRoutePolylines(route, connector);
      }
    }

    return _finalizeRouteAtDestinationPin(route, destLat, destLng);
  }

  ({double lat, double lng})? _coordsFromBookingLocation(
    bd.BookingLocation? loc,
  ) {
    if (loc == null) return null;
    final lat = loc.latitude;
    final lng = loc.longitude;
    if (lat == null || lng == null || !lat.isFinite || !lng.isFinite) {
      return null;
    }
    return (lat: lat, lng: lng);
  }

  /// EV charging → car wash when both; otherwise the single booked stop.
  List<_DriverServiceMapStop> _orderedDriverServiceStopsFromDetail(
    bd.BookingDetailData? detail,
  ) {
    if (detail == null) return const [];
    final composition = bookingServiceComposition(detail.serviceType);
    final stops = <_DriverServiceMapStop>[];

    void addEvStop() {
      final ev = _coordsFromBookingLocation(detail.evChargingLocation);
      if (ev != null) {
        stops.add(
          _DriverServiceMapStop(
            lat: ev.lat,
            lng: ev.lng,
            kind: _DriverServiceStopKind.evCharging,
          ),
        );
      } else if (composition.isEvOnly) {
        final fallback = _coordsFromBookingLocation(detail.serviceLocation);
        if (fallback != null) {
          stops.add(
            _DriverServiceMapStop(
              lat: fallback.lat,
              lng: fallback.lng,
              kind: _DriverServiceStopKind.evCharging,
            ),
          );
        }
      }
    }

    void addWashStop() {
      final wash = _coordsFromBookingLocation(detail.serviceLocation);
      if (wash != null) {
        stops.add(
          _DriverServiceMapStop(
            lat: wash.lat,
            lng: wash.lng,
            kind: _DriverServiceStopKind.carWash,
          ),
        );
      }
    }

    if (composition.isCombined) {
      // Per requirements: EV charging station first, then car wash
      addEvStop();
      addWashStop();
    } else {
      if (composition.hasCarWash) addWashStop();
      if (composition.hasEvCharging) addEvStop();
    }

    return stops;
  }

  bool get _isActiveComboBooking =>
      bookingServiceComposition(serviceDetail.value?.serviceType).isCombined;

  int get _comboServiceStopIndex =>
      serviceDetail.value?.comboServiceStopIndex ?? 0;

  bool get _driverHeadingToComboSecondStop {
    if (!_isActiveComboBooking) return false;
    final code = BookingTrackingStatus.normalizeTrackingCode(
      serviceDetail.value?.trackingStatus,
    );
    if (code == BookingTrackingStatus.firstServiceCompleted) return true;
    if (_comboServiceStopIndex >= 1) return true;
    return BookingTrackingStatus.isComboSecondStopPhase(code);
  }

  List<_DriverServiceMapStop> _driverServiceStopsForCurrentLeg(
    bd.BookingDetailData? detail,
  ) {
    final stops = _orderedDriverServiceStopsFromDetail(detail);
    if (stops.isEmpty ||
        !bookingServiceComposition(detail?.serviceType).isCombined) {
      return stops;
    }
    final idx = (detail?.comboServiceStopIndex ?? 0).clamp(0, stops.length - 1);
    return [stops[idx]];
  }

  String get driverCurrentServiceStopLabel {
    if (!_isActiveComboBooking) return 'Service Location';
    return _driverHeadingToComboSecondStop || _comboServiceStopIndex >= 1
        ? 'Car Wash'
        : 'EV Charging Station';
  }

  String get driverReadyToHeadPrompt =>
      'Ready to Head to $driverCurrentServiceStopLabel?';

  String get driverServiceCompletedButtonLabel {
    if (_isActiveComboBooking && _comboServiceStopIndex == 0) {
      return 'Charging Complete — Head to Car Wash';
    }
    return 'Service Completed';
  }

  Future<void> _completeComboFirstStopAndPrepareSecondLeg() async {
    final id = activeDriverBookingId.value ?? serviceDetailBookingId.value;
    if (id == null || id <= 0) return;
    if (!await submitDriverBookingTrackingStatus(
      BookingTrackingStatus.firstServiceCompleted,
      bookingId: id,
    )) {
      return;
    }
    setReadyToHeadService();
    await fetchServiceDetail(bookingId: id, force: true);
    _syncDriverTripUiFromServiceDetail();
  }

  Future<List<Position>> _buildDrivingRouteThroughServiceStops({
    required Position origin,
    required List<_DriverServiceMapStop> stops,
  }) async {
    if (stops.isEmpty) return const [];
    if (stops.length == 1) {
      final s = stops.first;
      return _buildDrivingRouteToDestinationPin(
        origin: origin,
        destLat: s.lat,
        destLng: s.lng,
      );
    }

    final ordered = <Position>[
      origin,
      ...stops.map((s) => Position(s.lng, s.lat)),
    ];
    var route = await _fetchDrivingRouteThroughPositions(ordered);
    if (route.length < 2) {
      route = <Position>[ordered.first];
      for (var i = 1; i < ordered.length; i++) {
        final leg = await _fetchDrivingRoutePoints(
          start: route.last,
          destination: ordered[i],
        );
        if (leg.length >= 2) {
          route = _mergeAdjacentRoutePolylines(route, leg);
        } else {
          route = [...route, ordered[i]];
        }
      }
    }

    route = _alignDrivingRouteEndpoints(
      route,
      startLat: _coordLat(origin),
      startLng: _coordLng(origin),
    );
    final last = stops.last;
    return _finalizeRouteAtDestinationPin(route, last.lat, last.lng);
  }

  Future<Uint8List> _servicePinMarkerBytes() async {
    final path = Assets.imagesIcServicePin.path;
    final cacheKey = '$path@${_serviceMapPinWidthPx}x$_serviceMapPinHeightPx';
    if (_cachedServicePinBytes != null && _cachedServicePinPath == cacheKey) {
      return _cachedServicePinBytes!;
    }
    final bytes = await _buildHomePinOnMapRaster(
      path,
      widthPx: _serviceMapPinWidthPx,
      heightPx: _serviceMapPinHeightPx,
    );
    _cachedServicePinBytes = bytes;
    _cachedServicePinPath = cacheKey;
    return bytes;
  }

  Future<Uint8List> _evPinMarkerBytes() async {
    final path = Assets.imagesIcEvPin.path;
    final cacheKey = '$path@${_serviceMapPinWidthPx}x$_serviceMapPinHeightPx';
    if (_cachedEvPinBytes != null && _cachedEvPinPath == cacheKey) {
      return _cachedEvPinBytes!;
    }
    final bytes = await _buildHomePinOnMapRaster(
      path,
      widthPx: _serviceMapPinWidthPx,
      heightPx: _serviceMapPinHeightPx,
    );
    _cachedEvPinBytes = bytes;
    _cachedEvPinPath = cacheKey;
    return bytes;
  }

  Future<void> _placeDriverServiceLegCarWashPin(double lat, double lng) async {
    if (mapbox == null || !Prefs().isDriverRole) return;
    final bytes = await _servicePinMarkerBytes();
    _driverServiceLegServiceLocationPinManager ??= await mapbox!.annotations
        .createPointAnnotationManager(id: 'driver_service_leg_car_wash_pin');
    await _driverServiceLegServiceLocationPinManager!.deleteAll();
    await _driverServiceLegServiceLocationPinManager!.create(
      PointAnnotationOptions(
        geometry: Point(coordinates: Position(lng, lat)),
        image: bytes,
        iconAnchor: IconAnchor.CENTER,
        iconSize: 0.9, // 25% smaller than original 1.2
      ),
    );
  }

  Future<void> _placeDriverServiceLegEvPin(double lat, double lng) async {
    if (mapbox == null || !Prefs().isDriverRole) return;
    final bytes = await _evPinMarkerBytes();
    _driverServiceLegEvPinManager ??= await mapbox!.annotations
        .createPointAnnotationManager(id: 'driver_service_leg_ev_pin');
    await _driverServiceLegEvPinManager!.deleteAll();
    await _driverServiceLegEvPinManager!.create(
      PointAnnotationOptions(
        geometry: Point(coordinates: Position(lng, lat)),
        image: bytes,
        iconAnchor: IconAnchor.CENTER,
        iconSize: 0.9, // 25% smaller than original 1.2
      ),
    );
  }

  Future<void> _placeDriverServiceStopsOnRoute(
    List<Position> route,
    List<_DriverServiceMapStop> stops,
  ) async {
    await _driverServiceLegServiceLocationPinManager?.deleteAll();
    await _driverServiceLegEvPinManager?.deleteAll();
    if (route.length < 2 || stops.isEmpty) return;

    for (final stop in stops) {
      final snap = _closestPointOnRoutePolyline(route, stop.lat, stop.lng);
      switch (stop.kind) {
        case _DriverServiceStopKind.carWash:
          await _placeDriverServiceLegCarWashPin(snap.lat, snap.lng);
          break;
        case _DriverServiceStopKind.evCharging:
          await _placeDriverServiceLegEvPin(snap.lat, snap.lng);
          break;
      }
    }
  }

  Future<void> _applyUserRoutePolyline(List<Position> coordinates) async {
    if (mapbox == null || coordinates.length < 2) return;
    _routeAnnotationManager ??= await mapbox!.annotations
        .createPolylineAnnotationManager(id: 'user_route_line');
    await _routeAnnotationManager!.deleteAll();
    await _routeAnnotationManager!.create(
      PolylineAnnotationOptions(
        geometry: LineString(coordinates: coordinates),
        lineColor: ui.Color(0xFF34B620).toARGB32(),
        lineWidth: 8,
        lineOpacity: 1,
      ),
    );
  }

  Future<void> _refreshDriverPickupRouteTrimDisplay({
    double? vehicleLat,
    double? vehicleLng,
  }) async {
    if (mapbox == null ||
        !Prefs().isDriverRole ||
        isDriverEnRouteToServiceCenter) {
      return;
    }
    if (_driverPickupCachedRouteCoords == null ||
        (_driverPickupCachedRouteCoords!.length < 2)) {
      return;
    }

    late final double lat;
    late final double lng;
    if (vehicleLat != null && vehicleLng != null) {
      lat = vehicleLat;
      lng = vehicleLng;
    } else {
      final pos = await _geolocationAsMapPosition();
      if (pos == null) return;
      lat = _coordLat(pos);
      lng = _coordLng(pos);
    }

    final r = _trimDrivingPolylineAheadOfVehicle(
      fullRoute: _driverPickupCachedRouteCoords!,
      lat: lat,
      lng: lng,
      anchorSeg: _driverPickupRouteTrimAnchorSeg,
    );

    var trimmed = r.trimmed.length >= 2
        ? r.trimmed
        : _driverPickupCachedRouteCoords!;
    _driverPickupRouteTrimAnchorSeg = r.newAnchorSeg;

    final pickupLat = activeDriverPickupLat.value;
    final pickupLng = activeDriverPickupLng.value;
    if (pickupLat != null && pickupLng != null) {
      trimmed = _alignDrivingRouteEndpoints(
        trimmed,
        startLat: lat,
        startLng: lng,
        endLat: pickupLat,
        endLng: pickupLng,
      );
    } else {
      trimmed = _alignDrivingRouteEndpoints(
        trimmed,
        startLat: lat,
        startLng: lng,
      );
    }
    await _redrawDriverPickupRouteFromCache(vehicleLat: lat, vehicleLng: lng);
  }

  Future<Uint8List> _driverEnRouteSelfMarkerBytes() async {
    final url = Prefs().userImage().trim();
    if (_cachedDriverEnRouteSelfMarkerBytes != null &&
        _cachedDriverEnRouteSelfAvatarUrl == url) {
      return _cachedDriverEnRouteSelfMarkerBytes!;
    }
    final bytes = await _buildCompositeUserMarker(url);
    _cachedDriverEnRouteSelfMarkerBytes = bytes;
    _cachedDriverEnRouteSelfAvatarUrl = url;
    return bytes;
  }

  Future<void> _placeDriverEnRouteSelfPin(double lat, double lng) async {
    if (mapbox == null || !Prefs().isDriverRole) return;
    if (!isDriverEnRouteToPickup || isDriverEnRouteToServiceCenter) {
      await _driverEnRouteSelfPinManager?.deleteAll();
      return;
    }
    if (isDriverEnRouteToPickup) {
      await _refreshMapLocationPuck();
    }
    await _driverEnRouteSelfPinManager?.deleteAll();
    // Use a red navigation triangle that rotates with driving direction
    // instead of the user avatar pin during active en-route navigation.
    final bearing = _updateDriverNavBearing(lat, lng);
    final bytes = await _buildDriverNavTriangleBytes(bearing);
    _driverEnRouteSelfPinManager ??= await mapbox!.annotations
        .createPointAnnotationManager(id: 'driver_enroute_self_pin');
    await _driverEnRouteSelfPinManager!.deleteAll();
    await _driverEnRouteSelfPinManager!.create(
      PointAnnotationOptions(
        geometry: Point(coordinates: Position(lng, lat)),
        image: bytes,
        iconAnchor: IconAnchor.CENTER,
        iconSize: 1.0,
        iconRotate: bearing,
      ),
    );
  }

  Future<void> _placeDriverPickupCustomerLocationPin(
    double lat,
    double lng,
  ) async {
    if (mapbox == null || !Prefs().isDriverRole) return;
    final bytes = await _loadPinImageBytes();
    _driverPickupCustomerPinManager ??= await mapbox!.annotations
        .createPointAnnotationManager(
          id: 'driver_pickup_customer_location_pin',
        );
    await _driverPickupCustomerPinManager!.deleteAll();
    await _driverPickupCustomerPinManager!.create(
      PointAnnotationOptions(
        geometry: Point(coordinates: Position(lng, lat)),
        image: bytes,
        iconAnchor: IconAnchor.BOTTOM,
        iconSize: 1,
      ),
    );
  }

  Future<void> _drawDriverPickupDrivingRoute(List<Position> coordinates) async {
    if (mapbox == null || coordinates.length < 2) return;
    try {
      _driverPickupRouteManager ??= await mapbox!.annotations
          .createPolylineAnnotationManager(id: 'driver_pickup_route');
      await _driverPickupRouteManager!.deleteAll();
      await _driverPickupRouteManager!.create(
        PolylineAnnotationOptions(
          geometry: LineString(coordinates: coordinates),
          lineColor: ui.Color(0xFF34B620).toARGB32(),
          lineWidth: 8,
          lineOpacity: 1,
        ),
      );
      Alert.log(
        'DriverPickupRoute',
        'polyline drawn (${coordinates.length} pts)',
      );
    } catch (e, st) {
      Alert.log('DriverPickupRoute', 'polyline draw failed: $e\n$st');
    }
  }

  Future<void> _syncDriverEnRouteMarkersToDrawnRoute(
    List<Position> drawnRoute, {
    required double pickupLat,
    required double pickupLng,
    double? vehicleLat,
    double? vehicleLng,
  }) async {
    if (drawnRoute.isEmpty) return;
    final startLat = vehicleLat ?? _coordLat(drawnRoute.first);
    final startLng = vehicleLng ?? _coordLng(drawnRoute.first);
    final endLat = _coordLat(drawnRoute.last);
    final endLng = _coordLng(drawnRoute.last);
    await _placeDriverPickupCustomerLocationPin(endLat, endLng);
    await _placeDriverEnRouteSelfPin(startLat, startLng);
    if (isDriverEnRouteToPickup) {
      await _refreshMapLocationPuck();
    }
  }

  Future<void> refreshDriverEnRouteMapDisplay({
    double? vehicleLat,
    double? vehicleLng,
  }) async {
    if (isDriverEnRouteToPickup) {
      await _redrawDriverPickupRouteFromCache(
        vehicleLat: vehicleLat,
        vehicleLng: vehicleLng,
      );
      return;
    }
    if (isDriverEnRouteToServiceCenter) {
      await _redrawDriverServiceLegRouteFromCache(
        vehicleLat: vehicleLat,
        vehicleLng: vehicleLng,
      );
      return;
    }
    if (isDriverEnRouteToDropOff) {
      await _redrawDriverReturnLegRouteFromCache(
        vehicleLat: vehicleLat,
        vehicleLng: vehicleLng,
      );
    }
  }

  Future<void> _refreshDriverReturnLegRouteTrimDisplay({
    double? vehicleLat,
    double? vehicleLng,
  }) async {
    if (mapbox == null || !Prefs().isDriverRole || !isDriverEnRouteToDropOff) {
      return;
    }
    final cached = _driverReturnLegCachedRouteCoords;
    if (cached == null ||
        cached.length < 2 ||
        _driverReturnLegRoutePendingRedraw) {
      await drawDriverRouteToCustomerDropOffWithCustomPins();
      return;
    }
    await _redrawDriverReturnLegRouteFromCache(
      vehicleLat: vehicleLat,
      vehicleLng: vehicleLng,
    );
  }

  Future<void> _refreshDriverServiceLegRouteTrimDisplay({
    double? vehicleLat,
    double? vehicleLng,
  }) async {
    if (mapbox == null ||
        !Prefs().isDriverRole ||
        !isDriverEnRouteToServiceCenter) {
      return;
    }
    await _redrawDriverServiceLegRouteFromCache(
      vehicleLat: vehicleLat,
      vehicleLng: vehicleLng,
    );
  }

  /// Trims the cached service-center route behind the car and redraws line + car pin
  /// at the snapped point on the polyline so the marker sits on the route.
  Future<void> _redrawDriverServiceLegRouteFromCache({
    double? vehicleLat,
    double? vehicleLng,
  }) async {
    if (mapbox == null || !Prefs().isDriverRole) return;
    final full = _driverServiceLegCachedRouteCoords;
    if (full == null || full.length < 2) return;

    final stops = _driverServiceLegStops;
    if (stops.isEmpty) return;

    late final double vLat;
    late final double vLng;
    if (vehicleLat != null && vehicleLng != null) {
      vLat = vehicleLat;
      vLng = vehicleLng;
    } else {
      final origin = await _driverRouteOriginPosition();
      if (origin == null) return;
      vLat = _coordLat(origin);
      vLng = _coordLng(origin);
    }

    var toDraw = List<Position>.from(full);
    if (full.length >= 2) {
      try {
        final r = _trimDrivingPolylineAheadOfVehicle(
          fullRoute: full,
          lat: vLat,
          lng: vLng,
          anchorSeg: _driverServiceLegRouteTrimAnchorSeg,
        );
        if (r.trimmed.length >= 2) {
          toDraw = r.trimmed;
          _driverServiceLegRouteTrimAnchorSeg = r.newAnchorSeg;
        }
      } catch (e, st) {
        Alert.log(
          'DriverServiceRoute',
          'trim failed, using full route: $e\n$st',
        );
      }
    }

    toDraw = _appendCachedRouteSuffixTowardDestination(
      fullRoute: full,
      trimmed: toDraw,
      destLat: stops.last.lat,
      destLng: stops.last.lng,
    );

    toDraw = _alignDrivingRouteEndpoints(
      toDraw,
      startLat: vLat,
      startLng: vLng,
    );
    final lastStop = stops.last;
    toDraw = _finalizeRouteAtDestinationPin(toDraw, lastStop.lat, lastStop.lng);

    await _driverEnRouteSelfPinManager?.deleteAll();
    await _drawDriverServiceLegPolyline(toDraw);
    await _placeDriverServiceStopsOnRoute(toDraw, stops);
    await _placeDriverServiceLegCarPin(
      _coordLat(toDraw.first),
      _coordLng(toDraw.first),
    );
  }

  Future<void> _redrawDriverPickupRouteFromCache({
    double? vehicleLat,
    double? vehicleLng,
  }) async {
    if (mapbox == null ||
        !Prefs().isDriverRole ||
        isDriverEnRouteToServiceCenter ||
        isDriverEnRouteToDropOff) {
      return;
    }
    final full = _driverPickupCachedRouteCoords;
    if (full == null || full.length < 2) return;

    final pickupLat = activeDriverPickupLat.value;
    final pickupLng = activeDriverPickupLng.value;
    if (pickupLat == null || pickupLng == null) return;

    List<Position> toDraw = List<Position>.from(full);

    late final double vLat;
    late final double vLng;
    if (vehicleLat != null && vehicleLng != null) {
      vLat = vehicleLat;
      vLng = vehicleLng;
    } else {
      final origin = await _driverRouteOriginPosition();
      if (origin == null) return;
      vLat = _coordLat(origin);
      vLng = _coordLng(origin);
    }

    if (full.length > 2) {
      try {
        final r = _trimDrivingPolylineAheadOfVehicle(
          fullRoute: full,
          lat: vLat,
          lng: vLng,
          anchorSeg: _driverPickupRouteTrimAnchorSeg,
        );
        if (r.trimmed.length >= 2) {
          toDraw = r.trimmed;
          _driverPickupRouteTrimAnchorSeg = r.newAnchorSeg;
        }
      } catch (e, st) {
        Alert.log(
          'DriverPickupRoute',
          'trim failed, using full route: $e\n$st',
        );
      }
    }

    toDraw = _alignDrivingRouteEndpoints(
      toDraw,
      startLat: vLat,
      startLng: vLng,
    );
    toDraw = _finalizeRouteAtDestinationPin(toDraw, pickupLat, pickupLng);

    await _drawDriverPickupDrivingRoute(toDraw);
    if (toDraw.length >= 2) {
      await _syncDriverEnRouteMarkersToDrawnRoute(
        toDraw,
        pickupLat: pickupLat,
        pickupLng: pickupLng,
        vehicleLat: vLat,
        vehicleLng: vLng,
      );
    }
  }

  Future<void> drawRouteToDestinationLatLng({
    required double latitude,
    required double longitude,
    bool progressiveDriverPickupRouteTrim = false,
  }) async {
    await drawDrivingRouteToDestination(
      Position(longitude, latitude),
      showUserErrors: true,
      progressiveDriverPickupRouteTrim: progressiveDriverPickupRouteTrim,
    );
  }

  /// Draws driving route from current puck to [destination] and shows a pin there.
  Future<void> drawDrivingRouteToDestination(
    Position destination, {
    bool showUserErrors = true,
    bool progressiveDriverPickupRouteTrim = false,
  }) async {
    if (mapbox == null) return;

    Position? origin = await _getPuckPosition();
    if (origin == null) {
      await _moveCameraToCurrentLocation();
      origin = await _getPuckPosition();
    }
    if (origin == null) {
      hasActiveRoute.value = false;
      if (showUserErrors) {
        showAppSnackBar(
          title: 'Location',
          message: 'Unable to fetch your current location.',
          isError: true,
        );
      }
      return;
    }

    final routePoints = await _fetchDrivingRoutePoints(
      start: origin,
      destination: destination,
    );
    if (routePoints.length < 2) {
      hasActiveRoute.value = false;
      await _routeAnnotationManager?.deleteAll();
      await _destinationPinManager?.deleteAll();
      _driverPickupCachedRouteCoords = null;
      _driverPickupRouteTrimAnchorSeg = 0;
      if (showUserErrors) {
        showAppSnackBar(
          title: 'Route',
          message: 'Unable to fetch driving route. Please try again.',
          isError: true,
        );
      }
      return;
    }

    if (progressiveDriverPickupRouteTrim && Prefs().isDriverRole) {
      _driverPickupCachedRouteCoords = List<Position>.from(routePoints);
      _driverPickupRouteTrimAnchorSeg = 0;
      await _refreshDriverPickupRouteTrimDisplay(
        vehicleLat: _coordLat(origin),
        vehicleLng: _coordLng(origin),
      );
    } else {
      _driverPickupCachedRouteCoords = null;
      _driverPickupRouteTrimAnchorSeg = 0;
      await _applyUserRoutePolyline(routePoints);
    }

    await _placeDestinationPin(destination);

    final camera = await mapbox!.cameraForCoordinatesPadding(
      routePoints.map((p) => Point(coordinates: p)).toList(),
      CameraOptions(),
      MbxEdgeInsets(top: 180, left: 48, bottom: 220, right: 48),
      null,
      null,
    );
    await mapbox!.easeTo(camera, MapAnimationOptions(duration: 900));
    hasActiveRoute.value = true;
  }

  Future<void> clearRouteAndPin() async {
    await _routeAnnotationManager?.deleteAll();
    await _destinationPinManager?.deleteAll();
    await _disposeDriverEnRouteMapAnnotations();
    await _disposeDriverServiceLegMapAnnotations();
    await _disposeDriverReturnLegMapAnnotations();
    _cachedDriverEnRouteSelfMarkerBytes = null;
    // Reset navigation triangle cache and bearing tracking for the new leg.
    _cachedNavTriangleBytes = null;
    _cachedNavTriangleBearing = -999;
    _lastDriverNavLat = null;
    _lastDriverNavLng = null;
    _lastDriverNavBearing = 0;
    _cachedDriverEnRouteSelfAvatarUrl = '';
    _driverPickupCameraFitted = false;
    hasActiveRoute.value = false;
    _driverPickupCachedRouteCoords = null;
    _driverPickupRouteTrimAnchorSeg = 0;
    _driverPickupRoutePendingRedraw = false;
    _driverServiceLegCachedRouteCoords = null;
    _driverServiceLegRouteTrimAnchorSeg = 0;
    if (Prefs().isDriverRole) {
      unawaited(_refreshMapLocationPuck());
    }
  }

  Future<void> _placeDestinationPin(Position destination) async {
    if (mapbox == null) return;
    final bytes = await _loadPinImageBytes();
    _destinationPinManager ??= await mapbox!.annotations
        .createPointAnnotationManager(id: 'destination_pin');
    await _destinationPinManager!.deleteAll();
    await _destinationPinManager!.create(
      PointAnnotationOptions(
        geometry: Point(coordinates: destination),
        image: bytes,
        iconAnchor: IconAnchor.BOTTOM,
        iconSize: 1,
      ),
    );
  }

  static const int _destinationPinSizePx = 84;

  Future<Uint8List> _loadPinImageBytes() async {
    final path = Assets.imagesIcLocation.path;
    final cacheKey = '$path@${_destinationPinSizePx}px';
    if (_pinImageBytes != null && _pinImageLoadedPath == cacheKey) {
      return _pinImageBytes!;
    }
    final data = await rootBundle.load(path);
    final raw = data.buffer.asUint8List();
    final codec = await ui.instantiateImageCodec(raw);
    final frame = await codec.getNextFrame();
    final src = frame.image;
    final s = _destinationPinSizePx.toDouble();
    final recorder = ui.PictureRecorder();
    final canvas = ui.Canvas(recorder);
    canvas.drawImageRect(
      src,
      ui.Rect.fromLTWH(0, 0, src.width.toDouble(), src.height.toDouble()),
      ui.Rect.fromLTWH(0, 0, s, s),
      ui.Paint()..filterQuality = ui.FilterQuality.medium,
    );
    src.dispose();
    final raster = await recorder.endRecording().toImage(
      _destinationPinSizePx,
      _destinationPinSizePx,
    );
    final png = await raster.toByteData(format: ui.ImageByteFormat.png);
    raster.dispose();
    _pinImageBytes = png!.buffer.asUint8List();
    _pinImageLoadedPath = cacheKey;
    return _pinImageBytes!;
  }

  List<Position> _positionsFromMapboxDirectionsResponse(
    Map<String, dynamic> decoded,
  ) {
    final routes = decoded['routes'] as List<dynamic>? ?? const [];
    if (routes.isEmpty) return const [];
    final geometry = routes.first['geometry'] as Map<String, dynamic>?;
    final coordinates = geometry?['coordinates'] as List<dynamic>? ?? const [];

    final points = <Position>[];
    for (final item in coordinates) {
      if (item is! List || item.length < 2) continue;
      final lon = (item[0] as num?)?.toDouble();
      final lat = (item[1] as num?)?.toDouble();
      if (lon == null || lat == null) continue;
      points.add(Position(lon, lat));
    }
    return points;
  }

  double? _durationSecondsFromMapboxDirectionsResponse(
    Map<String, dynamic> decoded,
  ) {
    final routes = decoded['routes'];
    if (routes is! List || routes.isEmpty) return null;
    final first = routes.first;
    if (first is! Map) return null;
    final duration = first['duration'];
    if (duration is num && duration.isFinite && duration > 0) {
      return duration.toDouble();
    }
    return double.tryParse('${duration ?? ''}');
  }

  Future<List<Position>> _fetchDrivingRoutePoints({
    required Position start,
    required Position destination,
    void Function(double seconds)? onDuration,
  }) async {
    final accessToken = EnvService.mapboxAccessToken.trim();
    if (accessToken.isEmpty) {
      Alert.log('MapboxRoute', 'MAPBOX_ACCESS_TOKEN empty; skip directions');
      return const [];
    }

    final double sl;
    final double sa;
    final double dl;
    final double da;
    try {
      sl = (start.lng).toDouble();
      sa = (start.lat).toDouble();
      dl = (destination.lng).toDouble();
      ;
      da = (destination.lat).toDouble();
      ;
    } catch (e, st) {
      Alert.log('MapboxRoute', 'Invalid start/end Position: $e\n$st');
      return const [];
    }

    if (!sl.isFinite || !sa.isFinite || !dl.isFinite || !da.isFinite) {
      return const [];
    }

    final coordPath = '$sl,$sa;$dl,$da';
    final uri = Uri.https(
      'api.mapbox.com',
      '/directions/v5/mapbox/driving/$coordPath',
      {
        'alternatives': 'false',
        'geometries': 'geojson',
        'overview': 'full',
        'steps': 'false',
        'approaches': 'curb;curb',
        'access_token': accessToken,
      },
    );

    try {
      final client = HttpClient();
      final request = await client.getUrl(uri);
      final response = await request.close();
      final responseBody = await utf8.decodeStream(response);
      if (response.statusCode != 200) {
        final snippet = responseBody.length > 280
            ? responseBody.substring(0, 280)
            : responseBody;
        Alert.log(
          'MapboxRoute',
          'Directions HTTP ${response.statusCode}: $snippet',
        );
        return const [];
      }
      final decoded = jsonDecode(responseBody) as Map<String, dynamic>;
      final code = '${decoded['code'] ?? ''}';
      if (code.contains('NoRoute') || code.contains('InvalidInput')) {
        Alert.log(
          'MapboxRoute',
          'Directions error code=$code message=${decoded['message']}',
        );
        return const [];
      }
      final duration = _durationSecondsFromMapboxDirectionsResponse(decoded);
      if (duration != null && duration > 0) {
        onDuration?.call(duration);
      }
      return _positionsFromMapboxDirectionsResponse(decoded);
    } catch (e, st) {
      Alert.log('MapboxRoute', 'Directions request failed: $e\n$st');
      return const [];
    }
  }

  /// Mapbox Directions with multiple stops: `first;second;…` in lon,lat order.
  Future<List<Position>> _fetchDrivingRouteThroughPositions(
    List<Position> orderedStops,
  ) async {
    if (orderedStops.length < 2) return const [];
    final accessToken = EnvService.mapboxAccessToken.trim();
    if (accessToken.isEmpty) {
      Alert.log('MapboxRoute', 'MAPBOX_ACCESS_TOKEN empty; skip directions');
      return const [];
    }

    final coordPath = orderedStops
        .map((p) => '${_coordLng(p)},${_coordLat(p)}')
        .join(';');
    final uri = Uri.https(
      'api.mapbox.com',
      '/directions/v5/mapbox/driving/$coordPath',
      {
        'alternatives': 'false',
        'geometries': 'geojson',
        'overview': 'full',
        'steps': 'false',
        'approaches': List.filled(orderedStops.length, 'curb').join(';'),
        'access_token': accessToken,
      },
    );

    try {
      final client = HttpClient();
      final request = await client.getUrl(uri);
      final response = await request.close();
      final responseBody = await utf8.decodeStream(response);
      if (response.statusCode != 200) {
        final snippet = responseBody.length > 280
            ? responseBody.substring(0, 280)
            : responseBody;
        Alert.log(
          'MapboxRoute',
          'Directions (multi) HTTP ${response.statusCode}: $snippet',
        );
        return const [];
      }
      final decoded = jsonDecode(responseBody) as Map<String, dynamic>;
      final code = '${decoded['code'] ?? ''}';
      if (code.contains('NoRoute') || code.contains('InvalidInput')) {
        Alert.log(
          'MapboxRoute',
          'Directions (multi) code=$code message=${decoded['message']}',
        );
        return const [];
      }
      return _positionsFromMapboxDirectionsResponse(decoded);
    } catch (e, st) {
      Alert.log('MapboxRoute', 'Directions (multi) request failed: $e\n$st');
      return const [];
    }
  }

  List<Position> _mergeAdjacentRoutePolylines(
    List<Position> first,
    List<Position> second,
  ) {
    if (first.isEmpty) return List<Position>.from(second);
    if (second.isEmpty) return List<Position>.from(first);
    final a = first.last;
    final b = second.first;
    final joinDist = Geolocator.distanceBetween(
      _coordLat(a),
      _coordLng(a),
      _coordLat(b),
      _coordLng(b),
    );
    final skipFirstSecond = joinDist < 35;
    return <Position>[...first, ...second.skip(skipFirstSecond ? 1 : 0)];
  }

  bool _coordsFarApart(double lat1, double lng1, double lat2, double lng2) {
    if (!lat1.isFinite || !lng1.isFinite || !lat2.isFinite || !lng2.isFinite) {
      return false;
    }
    return Geolocator.distanceBetween(lat1, lng1, lat2, lng2) >= 80;
  }

  /// Driving route from driver GPS → pickup (booking `latitude` / `longitude`).
  Future<void> drawDriverRouteToPickup({
    required double pickupLat,
    required double pickupLng,
  }) async {
    if (!Prefs().isDriverRole) return;
    if (mapbox == null) {
      _driverPickupRoutePendingRedraw = true;
      return;
    }

    await _disposeDriverServiceLegMapAnnotations();
    await _disposeDriverEnRouteMapAnnotations();

    final origin = await _driverRouteOriginPosition();
    if (origin == null) {
      _driverPickupRoutePendingRedraw = true;
      hasActiveRoute.value = false;
      return;
    }

    final routePoints = await _buildDrivingRouteToDestinationPin(
      origin: origin,
      destLat: pickupLat,
      destLng: pickupLng,
    );
    if (routePoints.length < 2) {
      hasActiveRoute.value = false;
      return;
    }
    _driverPickupCachedRouteCoords = List<Position>.from(routePoints);
    _driverPickupRouteTrimAnchorSeg = 0;
    _driverPickupRoutePendingRedraw = false;
    _driverPickupCameraFitted = false;

    await _refreshMapLocationPuck();
    await _redrawDriverPickupRouteFromCache(
      vehicleLat: _coordLat(origin),
      vehicleLng: _coordLng(origin),
    );

    if (!_driverPickupCameraFitted) {
      try {
        final drawn = _driverPickupCachedRouteCoords ?? routePoints;
        final camera = await mapbox!.cameraForCoordinatesPadding(
          drawn.map((p) => Point(coordinates: p)).toList(),
          CameraOptions(),
          MbxEdgeInsets(top: 180, left: 48, bottom: 220, right: 48),
          null,
          null,
        );
        await mapbox!.easeTo(camera, MapAnimationOptions(duration: 900));
        _driverPickupCameraFitted = true;
      } catch (_) {}
    }
    hasActiveRoute.value = true;
    Alert.log(
      'DriverPickupRoute',
      'polyline drawn (${routePoints.length} pts) → pickup',
    );
  }

  /// Car pin while driving to the service location. Snapped to the trimmed polyline
  /// via [_redrawDriverServiceLegRouteFromCache] with [IconAnchor.CENTER].
  static const int _driverServiceLegCarPinWidthPx = 216;
  static const int _driverServiceLegCarPinHeightPx = 232;

  Future<Uint8List> _driverCarPinMarkerBytes() async {
    final layoutKey =
        _driverServiceLegCarPinWidthPx * 100000 +
        _driverServiceLegCarPinHeightPx;
    if (_cachedDriverCarPinMarkerBytes != null &&
        _cachedDriverCarPinMarkerLayoutKey == layoutKey) {
      return _cachedDriverCarPinMarkerBytes!;
    }
    final bytes = await _buildDriverCarPinOnMapRaster(
      Assets.imagesIcCarPin.path,
      widthPx: _driverServiceLegCarPinWidthPx,
      heightPx: _driverServiceLegCarPinHeightPx,
    );
    _cachedDriverCarPinMarkerBytes = bytes;
    _cachedDriverCarPinMarkerLayoutKey = layoutKey;
    return bytes;
  }

  Future<Uint8List> _buildDriverCarPinOnMapRaster(
    String assetPath, {
    required int widthPx,
    required int heightPx,
  }) async {
    final data = await rootBundle.load(assetPath);
    final raw = data.buffer.asUint8List();
    final codec = await ui.instantiateImageCodec(raw);
    final frame = await codec.getNextFrame();
    final src = frame.image;
    final w = widthPx.toDouble();
    final h = heightPx.toDouble();

    final recorder = ui.PictureRecorder();
    final canvas = ui.Canvas(recorder);

    const inset = 8.0;
    final availH = h - inset * 2;
    final availW = w - inset * 2;
    final srcW = src.width.toDouble();
    final srcH = src.height.toDouble();
    final scale = math.min(availW / srcW, availH / srcH);
    final dw = srcW * scale;
    final dh = srcH * scale;
    final dx = (w - dw) / 2;
    final dy = (h - dh) / 2;

    canvas.drawImageRect(
      src,
      ui.Rect.fromLTWH(0, 0, srcW, srcH),
      ui.Rect.fromLTWH(dx, dy, dw, dh),
      ui.Paint()..filterQuality = ui.FilterQuality.high,
    );
    src.dispose();

    final raster = await recorder.endRecording().toImage(widthPx, heightPx);
    final png = await raster.toByteData(format: ui.ImageByteFormat.png);
    raster.dispose();
    return png!.buffer.asUint8List();
  }

  /// Computes bearing from last known driver position to [lat]/[lng],
  /// caches the result, and updates the last-known coords.
  double _updateDriverNavBearing(double lat, double lng) {
    final prevLat = _lastDriverNavLat;
    final prevLng = _lastDriverNavLng;
    _lastDriverNavLat = lat;
    _lastDriverNavLng = lng;
    if (prevLat != null && prevLng != null) {
      final dist = Geolocator.distanceBetween(prevLat, prevLng, lat, lng);
      if (dist > 3) {
        _lastDriverNavBearing = Geolocator.bearingBetween(
          prevLat,
          prevLng,
          lat,
          lng,
        );
      }
    }
    return _lastDriverNavBearing;
  }

  /// Renders a red navigation-style arrow (pointing upward = north at 0°).
  /// Returns PNG bytes; cached per 5-degree bearing bucket.
  Future<Uint8List> _buildDriverNavTriangleBytes(double bearing) async {
    // Snap to 5° bucket so we don't re-render every degree.
    final bucket = (bearing / 5).round() * 5.0;
    if (_cachedNavTriangleBytes != null &&
        (_cachedNavTriangleBearing - bucket).abs() < 0.5) {
      return _cachedNavTriangleBytes!;
    }

    // White circle with dark arrow inside — matches reference nav puck style.
    const size = 120.0;
    const center = size / 2;
    const circleRadius = center - 6.0;

    final recorder = ui.PictureRecorder();
    final canvas = ui.Canvas(recorder);

    // ── Drop shadow ──
    final shadowPaint = ui.Paint()
      ..color = const ui.Color(0x40000000)
      ..maskFilter = const ui.MaskFilter.blur(ui.BlurStyle.normal, 7);
    canvas.drawCircle(
      const ui.Offset(center, center + 3),
      circleRadius,
      shadowPaint,
    );

    // ── White circle background ──
    final bgPaint = ui.Paint()
      ..color = const ui.Color(0xFFFFFFFF)
      ..style = ui.PaintingStyle.fill;
    canvas.drawCircle(const ui.Offset(center, center), circleRadius, bgPaint);

    // ── Dark filled arrow (matches reference: solid near-black) ──
    const tip = 18.0; // top of arrow
    const base = size - 22.0; // bottom of arrow
    const halfW = 22.0; // half-width at base
    const notchUp = 14.0; // notch height from base
    final arrowPaint = ui.Paint()
      ..color = const ui.Color(0xFF1C1C1E)
      ..style = ui.PaintingStyle.fill;
    final path = ui.Path()
      ..moveTo(center, tip) // tip
      ..lineTo(center + halfW, base) // bottom-right
      ..lineTo(center, base - notchUp) // notch
      ..lineTo(center - halfW, base) // bottom-left
      ..close();
    canvas.drawPath(path, arrowPaint);

    final picture = recorder.endRecording();
    final img = await picture.toImage(size.toInt(), size.toInt());
    final png = await img.toByteData(format: ui.ImageByteFormat.png);
    img.dispose();

    _cachedNavTriangleBytes = png!.buffer.asUint8List();
    _cachedNavTriangleBearing = bucket;
    return _cachedNavTriangleBytes!;
  }

  Future<void> _placeDriverServiceLegCarPin(double lat, double lng) async {
    if (mapbox == null || !Prefs().isDriverRole) return;
    final bearing = _updateDriverNavBearing(lat, lng);
    final bytes = await _buildDriverNavTriangleBytes(bearing);
    _driverServiceLegCarPinManager ??= await mapbox!.annotations
        .createPointAnnotationManager(id: 'driver_service_leg_car_pin');
    await _driverServiceLegCarPinManager!.deleteAll();
    await _driverServiceLegCarPinManager!.create(
      PointAnnotationOptions(
        geometry: Point(coordinates: Position(lng, lat)),
        image: bytes,
        iconAnchor: IconAnchor.CENTER,
        iconSize: 1.0,
        iconRotate: bearing,
      ),
    );
  }

  Future<void> _drawDriverServiceLegPolyline(List<Position> coordinates) async {
    if (mapbox == null || coordinates.length < 2) return;
    try {
      _driverServiceLegRouteManager ??= await mapbox!.annotations
          .createPolylineAnnotationManager(id: 'driver_service_leg_route');
      await _driverServiceLegRouteManager!.deleteAll();
      await _driverServiceLegRouteManager!.create(
        PolylineAnnotationOptions(
          geometry: LineString(coordinates: coordinates),
          lineColor: ui.Color(0xFF34B620).toARGB32(),
          lineWidth: 8,
          lineOpacity: 1,
        ),
      );
    } catch (e, st) {
      Alert.log('DriverServiceRoute', 'polyline draw failed: $e\n$st');
    }
  }

  /// Driver → service stop(s): car wash [ic_service_pin], EV [ic_ev_pin], or both in order.
  Future<void> drawDriverRouteToServiceCenterWithCustomPins() async {
    if (!Prefs().isDriverRole) return;
    if (mapbox == null) return;

    final bookingId =
        activeDriverBookingId.value ?? serviceDetailBookingId.value;
    var detail = serviceDetail.value;
    var stops = _driverServiceStopsForCurrentLeg(detail);
    if (stops.isEmpty && bookingId != null && bookingId > 0) {
      await fetchServiceDetail(bookingId: bookingId, force: true);
      detail = serviceDetail.value;
      stops = _driverServiceStopsForCurrentLeg(detail);
    }
    if (stops.isEmpty) {
      showAppSnackBar(
        title: 'Route',
        message: 'Service location is not available for this booking yet.',
        isError: true,
      );
      return;
    }

    await _disposeDriverReturnLegMapAnnotations();
    await _disposeDriverServiceLegMapAnnotations();
    await _disposeDriverEnRouteMapAnnotations();
    await _routeAnnotationManager?.deleteAll();
    await _destinationPinManager?.deleteAll();
    _driverPickupCachedRouteCoords = null;
    _driverPickupRouteTrimAnchorSeg = 0;
    _driverPickupRoutePendingRedraw = false;

    final origin = await _driverRouteOriginPosition();
    if (origin == null) {
      showAppSnackBar(
        title: 'Location',
        message: 'Unable to fetch your current location.',
        isError: true,
      );
      return;
    }

    var routePoints = await _buildDrivingRouteThroughServiceStops(
      origin: origin,
      stops: stops,
    );
    if (routePoints.length < 2) {
      // Route API failed — fall back to straight-line segments so the map
      // still shows a visual path on Android when the Directions API is
      // unreachable or returns no route.
      routePoints = <Position>[
        origin,
        ...stops.map((s) => Position(s.lng, s.lat)),
      ];
      Alert.log(
        'DriverServiceRoute',
        'Directions API returned no route; using straight-line fallback',
      );
    }

    _driverServiceLegStops = List<_DriverServiceMapStop>.from(stops);
    _driverServiceLegCachedRouteCoords = List<Position>.from(routePoints);
    _driverServiceLegRouteTrimAnchorSeg = 0;

    await _refreshMapLocationPuck();
    await _redrawDriverServiceLegRouteFromCache(
      vehicleLat: _coordLat(origin),
      vehicleLng: _coordLng(origin),
    );

    try {
      final camera = await mapbox!.cameraForCoordinatesPadding(
        routePoints.map((p) => Point(coordinates: p)).toList(),
        CameraOptions(),
        MbxEdgeInsets(top: 180, left: 48, bottom: 220, right: 48),
        null,
        null,
      );
      await mapbox!.easeTo(camera, MapAnimationOptions(duration: 900));
    } catch (_) {}
    hasActiveRoute.value = true;
    final composition = bookingServiceComposition(detail?.serviceType);
    Alert.log(
      'DriverServiceRoute',
      'polyline (${routePoints.length} pts) '
          'stops=${stops.length} combined=${composition.isCombined}',
    );
  }

  ({double lat, double lng})? _driverReturnDestinationCoords() {
    final lat = activeDriverPickupLat.value;
    final lng = activeDriverPickupLng.value;
    if (lat != null && lng != null && lat.isFinite && lng.isFinite) {
      return (lat: lat, lng: lng);
    }
    return _customerPickupCoordsFromDetail(serviceDetail.value);
  }

  /// Home pin art is bottom-aligned so [IconAnchor.BOTTOM] sits on the route terminus.
  Future<Uint8List> _buildHomePinOnMapRaster(
    String assetPath, {
    required int widthPx,
    required int heightPx,
  }) async {
    final data = await rootBundle.load(assetPath);
    final raw = data.buffer.asUint8List();
    final codec = await ui.instantiateImageCodec(raw);
    final frame = await codec.getNextFrame();
    final src = frame.image;
    final w = widthPx.toDouble();
    final h = heightPx.toDouble();

    final recorder = ui.PictureRecorder();
    final canvas = ui.Canvas(recorder);

    const inset = 4.0;
    final availH = h - inset;
    final availW = w - inset * 2;
    final srcW = src.width.toDouble();
    final srcH = src.height.toDouble();
    final scale = math.min(availW / srcW, availH / srcH);
    final dw = srcW * scale;
    final dh = srcH * scale;
    final dx = (w - dw) / 2;
    final dy = h - dh - inset;

    canvas.drawImageRect(
      src,
      ui.Rect.fromLTWH(0, 0, srcW, srcH),
      ui.Rect.fromLTWH(dx, dy, dw, dh),
      ui.Paint()..filterQuality = ui.FilterQuality.high,
    );
    src.dispose();

    final raster = await recorder.endRecording().toImage(widthPx, heightPx);
    final png = await raster.toByteData(format: ui.ImageByteFormat.png);
    raster.dispose();
    return png!.buffer.asUint8List();
  }

  Future<Uint8List> _loadHomePinImageBytes() async {
    final path = Assets.imagesIcHomePin.path;
    final cacheKey = '$path@${_homePinWidthPx}x$_homePinHeightPx@bottom';
    if (_homePinImageBytes != null && _homePinImageLoadedPath == cacheKey) {
      return _homePinImageBytes!;
    }
    final bytes = await _buildHomePinOnMapRaster(
      path,
      widthPx: _homePinWidthPx,
      heightPx: _homePinHeightPx,
    );
    _homePinImageBytes = bytes;
    _homePinImageLoadedPath = cacheKey;
    return bytes;
  }

  Future<void> _placeDriverReturnLegCarPin(double lat, double lng) async {
    if (mapbox == null || !Prefs().isDriverRole) return;
    final bearing = _updateDriverNavBearing(lat, lng);
    final bytes = await _buildDriverNavTriangleBytes(bearing);
    _driverReturnLegCarPinManager ??= await mapbox!.annotations
        .createPointAnnotationManager(id: 'driver_return_leg_car_pin');
    await _driverReturnLegCarPinManager!.deleteAll();
    await _driverReturnLegCarPinManager!.create(
      PointAnnotationOptions(
        geometry: Point(coordinates: Position(lng, lat)),
        image: bytes,
        iconAnchor: IconAnchor.CENTER,
        iconSize: 1.0,
        iconRotate: bearing,
      ),
    );
  }

  Future<void> _placeDriverReturnLegHomePin(double lat, double lng) async {
    if (mapbox == null || !Prefs().isDriverRole) return;
    try {
      final bytes = await _loadHomePinImageBytes();
      _driverReturnLegHomePinManager ??= await mapbox!.annotations
          .createPointAnnotationManager(id: 'driver_return_leg_home_pin');
      await _driverReturnLegHomePinManager!.deleteAll();
      await _driverReturnLegHomePinManager!.create(
        PointAnnotationOptions(
          geometry: Point(coordinates: Position(lng, lat)),
          image: bytes,
          iconAnchor: IconAnchor.CENTER,
          iconSize: 1.2,
        ),
      );
    } catch (e, st) {
      Alert.log('DriverReturnRoute', 'home pin failed: $e\n$st');
    }
  }

  Future<void> _drawDriverReturnLegPolyline(List<Position> coordinates) async {
    if (mapbox == null || coordinates.length < 2) return;
    try {
      _driverReturnLegRouteManager ??= await mapbox!.annotations
          .createPolylineAnnotationManager(id: 'driver_return_leg_route');
      await _driverReturnLegRouteManager!.deleteAll();
      await _driverReturnLegRouteManager!.create(
        PolylineAnnotationOptions(
          geometry: LineString(coordinates: coordinates),
          lineColor: ui.Color(0xFF34B620).toARGB32(),
          lineWidth: 8,
          lineOpacity: 1,
        ),
      );
    } catch (e, st) {
      Alert.log('DriverReturnRoute', 'polyline draw failed: $e\n$st');
    }
  }

  Future<void> _redrawDriverReturnLegRouteFromCache({
    double? vehicleLat,
    double? vehicleLng,
  }) async {
    if (mapbox == null || !Prefs().isDriverRole) return;
    final full = _driverReturnLegCachedRouteCoords;
    if (full == null || full.length < 2) return;

    final dest = _driverReturnDestinationCoords();
    if (dest == null) return;

    late final double vLat;
    late final double vLng;
    if (vehicleLat != null && vehicleLng != null) {
      vLat = vehicleLat;
      vLng = vehicleLng;
    } else {
      final origin = await _driverRouteOriginPosition();
      if (origin == null) return;
      vLat = _coordLat(origin);
      vLng = _coordLng(origin);
    }

    var toDraw = List<Position>.from(full);
    if (full.length >= 2) {
      try {
        final r = _trimDrivingPolylineAheadOfVehicle(
          fullRoute: full,
          lat: vLat,
          lng: vLng,
          anchorSeg: _driverReturnLegRouteTrimAnchorSeg,
        );
        if (r.trimmed.length >= 2) {
          toDraw = r.trimmed;
          _driverReturnLegRouteTrimAnchorSeg = r.newAnchorSeg;
        }
      } catch (e, st) {
        Alert.log(
          'DriverReturnRoute',
          'trim failed, using full route: $e\n$st',
        );
      }
    }

    toDraw = _appendCachedRouteSuffixTowardDestination(
      fullRoute: full,
      trimmed: toDraw,
      destLat: dest.lat,
      destLng: dest.lng,
    );

    toDraw = _alignDrivingRouteEndpoints(
      toDraw,
      startLat: vLat,
      startLng: vLng,
    );
    final routed = _routeWithHomePinOnPolylineTerminus(
      toDraw,
      dest.lat,
      dest.lng,
    );
    toDraw = routed.route;

    // Polyline first, then pins on top (home was previously hidden under the line).
    await _drawDriverReturnLegPolyline(toDraw);
    await _placeDriverReturnLegHomePin(routed.pinLat, routed.pinLng);
    await _placeDriverReturnLegCarPin(
      _coordLat(toDraw.first),
      _coordLng(toDraw.first),
    );
    await _driverEnRouteSelfPinManager?.deleteAll();
  }

  /// Mapbox route from driver GPS → customer pickup; car pin + home pin (mockup).
  Future<void> drawDriverRouteToCustomerDropOffWithCustomPins() async {
    if (!Prefs().isDriverRole) return;
    if (mapbox == null) {
      _driverReturnLegRoutePendingRedraw = true;
      return;
    }

    final bookingId =
        activeDriverBookingId.value ?? serviceDetailBookingId.value;
    if (bookingId != null && bookingId > 0) {
      await _ensureDriverPickupCoordsLoaded(bookingId);
    }

    final dest = _driverReturnDestinationCoords();
    if (dest == null) {
      showAppSnackBar(
        title: 'Route',
        message:
            'Customer pickup location is not available for this booking yet.',
        isError: true,
      );
      return;
    }

    await _disposeDriverServiceLegMapAnnotations();
    await _disposeDriverEnRouteMapAnnotations();
    await _routeAnnotationManager?.deleteAll();
    await _destinationPinManager?.deleteAll();
    _driverPickupCachedRouteCoords = null;
    _driverPickupRouteTrimAnchorSeg = 0;
    _driverPickupRoutePendingRedraw = false;

    final origin = await _driverRouteOriginPosition();
    if (origin == null) {
      _driverReturnLegRoutePendingRedraw = true;
      showAppSnackBar(
        title: 'Location',
        message: 'Unable to fetch your current location.',
        isError: true,
      );
      return;
    }

    var usedDirectFallback = false;
    var routePoints = await _buildDrivingRouteToDestinationPin(
      origin: origin,
      destLat: dest.lat,
      destLng: dest.lng,
    );
    if (routePoints.length < 2) {
      final cached = _driverReturnLegCachedRouteCoords;
      if (cached != null && cached.length >= 2) {
        // Keep the last good route visible through a temporary Directions API
        // failure. The next GPS tick will retry the route request.
        _driverReturnLegRoutePendingRedraw = true;
        await _redrawDriverReturnLegRouteFromCache(
          vehicleLat: _coordLat(origin),
          vehicleLng: _coordLng(origin),
        );
        Alert.log(
          'DriverReturnRoute',
          'Directions unavailable; retained cached return route',
        );
        return;
      }
      // With no previous route, retain a visible path until Directions can be
      // retried instead of leaving the provider with a blank map.
      routePoints = <Position>[origin, Position(dest.lng, dest.lat)];
      usedDirectFallback = true;
      Alert.log(
        'DriverReturnRoute',
        'Directions returned no route; using temporary direct fallback',
      );
    }

    // Replace the old return annotations only after a new route/fallback is
    // ready, avoiding a blank interval while the network request is pending.
    await _disposeDriverReturnLegMapAnnotations();
    _driverReturnLegCachedRouteCoords = List<Position>.from(routePoints);
    _driverReturnLegRouteTrimAnchorSeg = 0;
    // A direct fallback remains visible, while a later GPS tick retries the
    // real driving route when connectivity recovers.
    _driverReturnLegRoutePendingRedraw = usedDirectFallback;
    _driverReturnLegCameraFitted = false;

    await _refreshMapLocationPuck();
    await _redrawDriverReturnLegRouteFromCache(
      vehicleLat: _coordLat(origin),
      vehicleLng: _coordLng(origin),
    );

    if (!_driverReturnLegCameraFitted) {
      try {
        final camera = await mapbox!.cameraForCoordinatesPadding(
          routePoints.map((p) => Point(coordinates: p)).toList(),
          CameraOptions(),
          MbxEdgeInsets(top: 180, left: 48, bottom: 220, right: 48),
          null,
          null,
        );
        await mapbox!.easeTo(camera, MapAnimationOptions(duration: 900));
        _driverReturnLegCameraFitted = true;
      } catch (_) {}
    }
    hasActiveRoute.value = true;
    Alert.log(
      'DriverReturnRoute',
      'polyline drawn (${routePoints.length} pts) → pickup',
    );
  }

  /// Ensures your location → pickup [→ service] route is cached for progressive trim.
  Future<void> drawDriverProgressiveRouteToPickupAndOptionalService({
    required double pickupLat,
    required double pickupLng,
  }) async {
    if (mapbox == null || !Prefs().isDriverRole) return;

    await _disposeDriverServiceLegMapAnnotations();

    Position? origin = await _getPuckPosition();
    if (origin == null) {
      await _moveCameraToCurrentLocation();
      origin = await _getPuckPosition();
    }
    if (origin == null) {
      hasActiveRoute.value = false;
      showAppSnackBar(
        title: 'Location',
        message: 'Unable to fetch your current location.',
        isError: true,
      );
      return;
    }

    final pickupPos = Position(pickupLng, pickupLat);
    final detail = serviceDetail.value;
    final composition = bookingServiceComposition(detail?.serviceType);
    final serviceStops = _orderedDriverServiceStopsFromDetail(detail);
    // Combined bookings: pickup first; car wash → EV is drawn on the service leg.
    final includeServiceOnPickupLeg =
        !composition.isCombined &&
        serviceStops.length == 1 &&
        _coordsFarApart(
          pickupLat,
          pickupLng,
          serviceStops.first.lat,
          serviceStops.first.lng,
        );

    List<Position> routePoints;
    if (includeServiceOnPickupLeg) {
      final stop = serviceStops.first;
      final servicePos = Position(stop.lng, stop.lat);
      routePoints = await _fetchDrivingRouteThroughPositions(<Position>[
        origin,
        pickupPos,
        servicePos,
      ]);
      if (routePoints.length < 2) {
        final leg1 = await _fetchDrivingRoutePoints(
          start: origin,
          destination: pickupPos,
        );
        final leg2 = await _fetchDrivingRoutePoints(
          start: pickupPos,
          destination: servicePos,
        );
        routePoints = _mergeAdjacentRoutePolylines(leg1, leg2);
      }
    } else {
      routePoints = await _fetchDrivingRoutePoints(
        start: origin,
        destination: pickupPos,
      );
    }

    if (routePoints.length < 2) {
      hasActiveRoute.value = false;
      await _routeAnnotationManager?.deleteAll();
      await _destinationPinManager?.deleteAll();
      _driverPickupCachedRouteCoords = null;
      _driverPickupRouteTrimAnchorSeg = 0;
      showAppSnackBar(
        title: 'Route',
        message: 'Unable to fetch driving route. Please try again.',
        isError: true,
      );
      return;
    }

    _driverPickupCachedRouteCoords = List<Position>.from(routePoints);
    _driverPickupRouteTrimAnchorSeg = 0;
    await _refreshDriverPickupRouteTrimDisplay(
      vehicleLat: _coordLat(origin),
      vehicleLng: _coordLng(origin),
    );

    Position destPin = pickupPos;
    if (includeServiceOnPickupLeg && serviceStops.isNotEmpty) {
      final stop = serviceStops.first;
      destPin = Position(stop.lng, stop.lat);
    }
    await _placeDestinationPin(destPin);

    final camera = await mapbox!.cameraForCoordinatesPadding(
      routePoints.map((p) => Point(coordinates: p)).toList(),
      CameraOptions(),
      MbxEdgeInsets(top: 180, left: 48, bottom: 220, right: 48),
      null,
      null,
    );
    await mapbox!.easeTo(camera, MapAnimationOptions(duration: 900));
    hasActiveRoute.value = true;
  }

  /// Ensures auto-recenter happens when app opens, even if first GPS fix is late.
  Future<void> _bootstrapAutoRecenter() async {
    await _moveCameraToCurrentLocation();
    // Retry a few times because initial puck/location can be delayed on cold start.
    for (int i = 0; i < 2; i++) {
      await Future<void>.delayed(const Duration(seconds: 2));
      // Stop the cold-start nudges once the driver has moved the map by hand.
      if (_driverMapManuallyMoved) return;
      await _moveCameraToCurrentLocation();
    }
  }

  /// Requests location permission.
  ///
  /// When [showSettingsDialog] is true and the permission is permanently
  /// denied, shows the "Open Settings" dialog so the user can fix it.
  /// Pass false for background / polling paths that should fail silently.
  Future<bool> _requestLocationPermission({
    bool showSettingsDialog = false,
  }) async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      if (showSettingsDialog && Platform.isAndroid) {
        showLocationServicesSettingsDialog();
      }
      return false;
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.deniedForever && showSettingsDialog) {
      showLocationPermissionSettingsDialog();
    }
    return permission == LocationPermission.whileInUse ||
        permission == LocationPermission.always;
  }

  /// Returns true when the app already has location permission (no dialog shown).
  Future<bool> _checkHasLocationPermission() async {
    if (!await Geolocator.isLocationServiceEnabled()) return false;
    final permission = await Geolocator.checkPermission();
    return permission == LocationPermission.whileInUse ||
        permission == LocationPermission.always;
  }

  /// Requests location permission and, if the user has just granted it, immediately
  /// fetches GPS, centres the map, updates driver presence, and refreshes nearby jobs
  /// so the “latitude and longitude are required” error clears without a manual restart.
  Future<void> _requestLocationPermissionAndSync() async {
    if (_locationPermissionSyncInFlight) return;
    _locationPermissionSyncInFlight = true;
    try {
      final alreadyGranted = await _checkHasLocationPermission();
      // Also show the device Location Services prompt when GPS is off. If app
      // permission is permanently denied, the existing app-settings dialog is
      // shown instead.
      final nowGranted = await _requestLocationPermission(
        showSettingsDialog: true,
      );
      if (!nowGranted || isClosed) return;

      // Keep this request pending until Mapbox and Android's first GPS fix are
      // both ready. A one-shot call is easily lost during a permission dialog.
      _locationPermissionRecenterPending = true;
      _suppressNearbyFitAfterLocationPermission = true;

      try {
        // Move the camera first; this must not wait on dashboard API calls.
        await _recenterMapAfterLocationPermission();

        // Permission was just newly granted — additionally resync driver data.
        // Only trigger nearby bookings fetch for approved drivers.
        if (!alreadyGranted &&
            Prefs().isDriverRole &&
            Prefs().isDriverApproved) {
          await _syncDriverPresence();
          if (!isClosed) {
            await fetchDriverNearbyUnassignedBookings(refresh: true);
          }
        }
      } finally {
        _suppressNearbyFitAfterLocationPermission = false;
      }
    } finally {
      _locationPermissionSyncInFlight = false;
    }
  }

  /// Reliably completes the camera move after the runtime permission dialog.
  /// Mapbox creation and Android's first GPS fix are asynchronous, so retry a
  /// few times instead of discarding the request when either is not ready yet.
  Future<void> _recenterMapAfterLocationPermission() async {
    if (_locationPermissionRecenterInFlight) return;
    _locationPermissionRecenterInFlight = true;
    final startedAt = DateTime.now();
    const retryDelays = <Duration>[
      Duration.zero,
      Duration(milliseconds: 700),
      Duration(seconds: 2),
      Duration(seconds: 4),
    ];
    try {
      for (final delay in retryDelays) {
        if (delay > Duration.zero) await Future<void>.delayed(delay);
        if (isClosed) return;
        if (!await Geolocator.isLocationServiceEnabled()) return;
        final permission = await Geolocator.checkPermission();
        if (permission != LocationPermission.whileInUse &&
            permission != LocationPermission.always) {
          return;
        }
        if (mapbox == null) continue;

        await _moveCameraToCurrentLocation();
        final movedAt = _lastCurrentLocationCameraMoveAt;
        if (movedAt != null && !movedAt.isBefore(startedAt)) {
          _locationPermissionRecenterPending = false;
          return;
        }
      }
    } finally {
      _locationPermissionRecenterInFlight = false;
    }
  }

  /// GPS fix as Mapbox geo [Position] (longitude, latitude) for immediate camera targeting.
  Future<Position?> _geolocationAsMapPosition({
    bool preferCachedPosition = false,
  }) async {
    geo.Position? lastKnown;
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
      if (preferCachedPosition) {
        final live = _latestDriverLiveCoords;
        final liveAt = _latestDriverLiveCoordsAt;
        if (live != null &&
            liveAt != null &&
            DateTime.now().difference(liveAt) <= const Duration(seconds: 45)) {
          return Position(live.lng, live.lat);
        }
      }
      lastKnown = await Geolocator.getLastKnownPosition();
      if (preferCachedPosition && lastKnown != null) {
        return Position(lastKnown.longitude, lastKnown.latitude);
      }
      final p = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 20),
        ),
      );
      return Position(p.longitude, p.latitude);
    } catch (_) {
      lastKnown ??= await Geolocator.getLastKnownPosition();
      if (lastKnown == null) return null;
      return Position(lastKnown.longitude, lastKnown.latitude);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────────
  // Map resume — redraw stale annotations after returning from native screen
  // ───────────────────────────────────────────────────────────────────────────────

  void _subscribeMapResumeChannel() {
    if (!Platform.isAndroid) return;
    try {
      _mapResumeEventSub = _mapResumeChannel.receiveBroadcastStream().listen(
        (_) => unawaited(onMapResumed()),
      );
    } catch (_) {
      // Channel not available in non-Android environments — ignore.
    }
  }

  /// Called when MainActivity.onResume fires on Android (e.g. after returning
  /// from DriverNavigationActivity). Annotation managers become stale after the
  /// native GL surface is paused/resumed, so we must fully redraw the active route.
  Future<void> onMapResumed() async {
    if (mapbox == null) return;
    Alert.log(
      'MapResume',
      'onResume fired — redrawing active route annotations',
    );

    // Invalidate all cached annotation manager references so they are
    // recreated fresh against the resumed GL surface.
    _resetMapAnnotationManagers();
    await _disposeDriverEnRouteMapAnnotations();
    await _disposeDriverServiceLegMapAnnotations();
    await _disposeDriverReturnLegMapAnnotations();
    await _disposeCustomerLiveMapAnnotations();
    // Also clear nav-triangle cache so it is re-rendered.
    _cachedNavTriangleBytes = null;
    _cachedNavTriangleBearing = -999;

    // Driver redraw is handled by DriverDashboardController.onMapResumed override
    // using retry variants — skip here to avoid a redundant non-retry draw.
    if (Prefs().isCustomerRole) {
      final id = _activeCustomerLiveTrackingBookingId;
      if (id != null && id > 0) {
        _customerLiveRoutePendingRedraw = true;
        unawaited(_refreshCustomerLiveRouteIfPossible());
      }
    }
  }

  Future<void> _moveCameraToCurrentLocation({
    bool showSettingsDialog = false,
  }) async {
    if (_isRecentering) return;
    _isRecentering = true;
    try {
      // Request permission first. On iOS this may show a system dialog;
      // release the lock before awaiting so that the bootstrap retry loop
      // (which fires 2 s later) is not blocked by the dialog wait time.
      _isRecentering = false;
      final hasPermission = await _requestLocationPermission(
        showSettingsDialog: showSettingsDialog,
      );
      if (!hasPermission) return;
      if (mapbox == null) return;
      // Re-acquire lock for the map camera work.
      if (_isRecentering) return;
      _isRecentering = true;

      await _ensureIosPreciseLocationIfPossible();
      await _refreshMapLocationPuck();

      // iOS does not expose the puck style layer consistently at cold start,
      // so center from the OS GPS fix first and use the Mapbox puck only as a fallback.
      final gps = await _geolocationAsMapPosition(
        preferCachedPosition: showSettingsDialog,
      );
      final isDriver = Prefs().isDriverRole;
      final zoom = isDriver ? driverCurrentLocationZoom : 15.0;
      final padding = isDriver
          ? MbxEdgeInsets(
              top: 120,
              left: 24,
              bottom: driverHasActiveTripPanelVisible
                  ? driverTripSheetMapFabClearancePx
                  : 80,
              right: 24,
            )
          : null;
      if (gps != null) {
        Alert.log(
          'MapRecenter',
          'moving camera to ${_coordLat(gps)},${_coordLng(gps)} zoom=$zoom',
        );
        await mapbox!.cancelCameraAnimation();
        await mapbox!.easeTo(
          CameraOptions(
            center: Point(coordinates: gps),
            zoom: zoom,
            padding: padding,
          ),
          MapAnimationOptions(duration: 700),
        );
        _lastCurrentLocationCameraMoveAt = DateTime.now();
        return;
      }

      for (int i = 0; i < 10; i++) {
        await Future<void>.delayed(const Duration(milliseconds: 300));
        final position = await _getPuckPosition();
        if (position == null) continue;
        await mapbox!.cancelCameraAnimation();
        await mapbox!.flyTo(
          CameraOptions(
            center: Point(coordinates: position),
            zoom: zoom,
            padding: padding,
          ),
          MapAnimationOptions(duration: 1200),
        );
        _lastCurrentLocationCameraMoveAt = DateTime.now();
        return;
      }
    } finally {
      _isRecentering = false;
    }
  }

  Future<void> _ensureIosPreciseLocationIfPossible() async {
    if (!Platform.isIOS) return;
    try {
      final accuracy = await Geolocator.getLocationAccuracy();
      if (accuracy == LocationAccuracyStatus.precise) return;
      await Geolocator.requestTemporaryFullAccuracy(
        purposeKey: 'DriverMapRecenter',
      );
    } catch (_) {
      // Keep recenter resilient even if temporary full accuracy is unavailable.
    }
  }

  Future<Position?> _getPuckPosition() async {
    if (mapbox == null) return null;
    try {
      Layer? layer;
      if (Platform.isAndroid) {
        layer = await mapbox!.style.getLayer("mapbox-location-indicator-layer");
      } else {
        layer = await mapbox!.style.getLayer("puck");
      }
      if (layer is! LocationIndicatorLayer) return null;
      final location = layer.location;
      if (location == null) return null;
      return Position(location[1]!, location[0]!);
    } catch (_) {
      return null;
    }
  }

  Future<Uint8List> _loadUserPuckImage() async {
    final avatarUrl = Prefs().userImage().trim();
    if (_userPuckImage != null && _userPuckImageForUrl == avatarUrl) {
      return _userPuckImage!;
    }
    _userPuckImage = await _buildCompositeUserMarker(avatarUrl);
    _userPuckImageForUrl = avatarUrl;
    return _userPuckImage!;
  }

  Future<LocationPuck> _buildUserPuck() async {
    try {
      return LocationPuck(
        locationPuck2D: DefaultLocationPuck2D(
          topImage: await _loadUserPuckImage(),
          opacity: 1,
        ),
      );
    } catch (_) {
      // Fallback to Mapbox default puck if asset fails.
      return LocationPuck(locationPuck2D: DefaultLocationPuck2D());
    }
  }

  Future<LocationPuck> _locationPuckForMap() async {
    if (Prefs().isCustomerRole && _customerLiveTracking) {
      return LocationPuck(locationPuck2D: DefaultLocationPuck2D());
    }
    if (Prefs().isDriverRole && isDriverEnRouteToPickup) {
      return LocationPuck(locationPuck2D: DefaultLocationPuck2D());
    }
    if (Prefs().isDriverRole && isDriverEnRouteToServiceCenter) {
      return LocationPuck(locationPuck2D: DefaultLocationPuck2D());
    }
    if (Prefs().isDriverRole && isDriverEnRouteToDropOff) {
      return LocationPuck(locationPuck2D: DefaultLocationPuck2D());
    }
    return _buildUserPuck();
  }

  Future<void> _refreshMapLocationPuck() async {
    if (mapbox == null) return;
    try {
      // Hide GPS puck during live trip — route annotation pins mark driver/customer.
      if ((Prefs().isCustomerRole && _customerLiveTracking) ||
          (Prefs().isDriverRole && isDriverEnRouteToPickup) ||
          (Prefs().isDriverRole && isDriverEnRouteToServiceCenter) ||
          (Prefs().isDriverRole && isDriverEnRouteToDropOff)) {
        await mapbox!.location.updateSettings(
          LocationComponentSettings(enabled: false),
        );
        return;
      }
      await mapbox!.location.updateSettings(
        LocationComponentSettings(
          enabled: true,
          pulsingEnabled: true,
          pulsingMaxRadius: 24,
          puckBearingEnabled: false,
          puckBearing: PuckBearing.HEADING,
          locationPuck: await _locationPuckForMap(),
        ),
      );
    } catch (_) {}
  }

  Future<Uint8List> _buildCompositeUserMarker(String avatarUrl) async {
    final markerBytes = (await rootBundle.load(
      'assets/images/ic_user_marker.png',
    )).buffer.asUint8List();

    final markerCodec = await ui.instantiateImageCodec(markerBytes);
    final markerFrame = await markerCodec.getNextFrame();
    final markerImage = markerFrame.image;

    final avatarBytes = await _loadAvatarBytes(avatarUrl);
    if (avatarBytes == null) return markerBytes;

    final avatarCodec = await ui.instantiateImageCodec(avatarBytes);
    final avatarFrame = await avatarCodec.getNextFrame();
    final avatarImage = avatarFrame.image;

    // Keep marker image compact for map rendering (prevents stretched/oversized marker).
    const targetWidth = 232.0;
    final markerW = markerImage.width.toDouble();
    final markerH = markerImage.height.toDouble();
    final targetHeight = targetWidth * (markerH / markerW);

    final recorder = ui.PictureRecorder();
    final canvas = ui.Canvas(recorder);

    // Draw marker as-is (no resize distortion)
    canvas.drawImageRect(
      markerImage,
      ui.Rect.fromLTWH(
        0,
        0,
        markerImage.width.toDouble(),
        markerImage.height.toDouble(),
      ),
      ui.Rect.fromLTWH(0, 0, targetWidth, targetHeight),
      ui.Paint(),
    );

    // Avatar placement:
    // - Legacy pin template (291x413): keep tuned coordinates.
    // - Square marker template: center-fit with inset ring padding.
    final isLegacyPinTemplate = markerW == 291.0 && markerH == 413.0;
    late final double avatarDiameter;
    late final ui.Offset avatarCenter;
    if (isLegacyPinTemplate) {
      final markerScale = targetWidth / 291.0;
      avatarDiameter = 218.0 * markerScale;
      avatarCenter = ui.Offset(145.5 * markerScale, 145.0 * markerScale);
    } else {
      // Square marker template (e.g., 128x128):
      // keep avatar in the top rounded center (about 68px on 128px artboard).
      final minSide = targetWidth < targetHeight ? targetWidth : targetHeight;
      avatarDiameter = minSide * (68.0 / 128.0);
      avatarCenter = ui.Offset(targetWidth / 2, targetHeight * (42.0 / 128.0));
    }

    final avatarRect = ui.Rect.fromCenter(
      center: avatarCenter,
      width: avatarDiameter,
      height: avatarDiameter,
    );

    canvas.save();
    canvas.clipPath(ui.Path()..addOval(avatarRect));

    canvas.drawImageRect(
      avatarImage,
      ui.Rect.fromLTWH(
        0,
        0,
        avatarImage.width.toDouble(),
        avatarImage.height.toDouble(),
      ),
      avatarRect,
      ui.Paint(),
    );

    canvas.restore();

    final composed = await recorder.endRecording().toImage(
      targetWidth.toInt(),
      targetHeight.toInt(),
    );

    final pngBytes = await composed.toByteData(format: ui.ImageByteFormat.png);
    return pngBytes!.buffer.asUint8List();
  }

  Future<Uint8List?> _loadAvatarBytes(String avatarUrl) async {
    if (avatarUrl.isNotEmpty) {
      try {
        final uri = Uri.parse(avatarUrl);
        final client = HttpClient();
        final request = await client.getUrl(uri);
        final response = await request.close();
        if (response.statusCode == 200) {
          final builder = BytesBuilder(copy: false);
          await for (final chunk in response) {
            builder.add(chunk);
          }
          return builder.takeBytes();
        }
      } catch (_) {}
    }

    // Fallback avatar while URL is unavailable.
    try {
      final bytes = await rootBundle.load('assets/images/ic_avatar.png');
      return bytes.buffer.asUint8List();
    } catch (_) {
      return null;
    }
  }

  void _invalidateCustomerLiveDriverMarkerCache() {
    _cachedCustomerLiveCustomerProfileMarkerBytes = null;
    _cachedCustomerLiveCustomerProfileAvatarUrl = '';
  }

  String _customerEffectiveTrackingCode() {
    final socket = (customerSocketTrackingCode.value ?? '').trim();
    if (socket.isNotEmpty) {
      return BookingTrackingStatus.normalizeTrackingCode(socket);
    }
    return BookingTrackingStatus.normalizeTrackingCode(
      serviceDetail.value?.trackingStatus,
    );
  }

  String _customerLiveRouteLegKeyNow({bool defaultToPickupWhenEmpty = false}) {
    return BookingTrackingStatus.customerLiveRouteLegKey(
      _customerEffectiveTrackingCode(),
      defaultToPickupWhenEmpty: defaultToPickupWhenEmpty,
    );
  }

  void _invalidateCustomerLiveRouteIfLegChanged({
    bool defaultToPickupWhenEmpty = false,
  }) {
    final detail = serviceDetail.value;
    final leg = detail != null
        ? _resolveCustomerLiveRouteLegKey(detail)
        : _customerLiveRouteLegKeyNow(
            defaultToPickupWhenEmpty: defaultToPickupWhenEmpty,
          );
    if (_customerLiveRouteLegKey == leg) return;
    _customerLiveRouteLegKey = leg;
    _customerLiveFullRouteCoords = null;
    _customerLiveRouteTrimAnchorSeg = 0;
    _lastCustomerLiveRouteAt = null;
    _lastCustomerLiveRouteDriverLat = null;
    _lastCustomerLiveRouteDriverLng = null;
    _customerLiveCameraFitted = false;
    _customerLiveEtaRouteRequestGeneration++;
    customerLiveEtaArrivalAt.value = null;
  }

  /// Pickup coords from booking detail (`address`, `latitude`, `longitude` strings).
  bool _customerDetailHasPickupCoords(bd.BookingDetailData? detail) {
    return _customerPickupCoordsFromDetail(detail) != null;
  }

  ({double lat, double lng})? _customerPickupCoordsFromDetail(
    bd.BookingDetailData? detail,
  ) {
    if (detail == null) return null;
    final pLat = detail.latitude;
    final pLng = detail.longitude;
    if (pLat != null && pLng != null && pLat.isFinite && pLng.isFinite) {
      return (lat: pLat, lng: pLng);
    }
    final pick = detail.pickupLocation;
    final pl = pick?.latitude;
    final pg = pick?.longitude;
    if (pl != null && pg != null && pl.isFinite && pg.isFinite) {
      return (lat: pl, lng: pg);
    }
    return null;
  }

  /// Destination for the active customer live route leg (from booking detail).
  ({double lat, double lng})? _customerLiveRouteDestinationCoords(
    String legKey,
    bd.BookingDetailData detail,
  ) {
    switch (legKey) {
      case 'pickup':
        return _customerPickupCoordsFromDetail(detail);
      case 'service':
        final stops = _driverServiceStopsForCurrentLeg(detail);
        if (stops.isNotEmpty) {
          final active = stops.first;
          return (lat: active.lat, lng: active.lng);
        }
        final sLat = detail.serviceLocation?.latitude;
        final sLng = detail.serviceLocation?.longitude;
        if (sLat == null || sLng == null || !sLat.isFinite || !sLng.isFinite) {
          return null;
        }
        return (lat: sLat, lng: sLng);
      case 'return':
        final drop = detail.dropoffLocation;
        final dLat = drop?.latitude ?? detail.latitude;
        final dLng = drop?.longitude ?? detail.longitude;
        if (dLat == null || dLng == null || !dLat.isFinite || !dLng.isFinite) {
          return null;
        }
        return (lat: dLat, lng: dLng);
      default:
        return null;
    }
  }

  Future<void> _customerLiveMapOnBookingDetailRefreshed(int bookingId) async {
    _invalidateCustomerLiveRouteIfLegChanged(defaultToPickupWhenEmpty: true);
    await _syncCustomerLiveTrackingMapAnnotations(bookingId);
  }

  Future<void> _driverRefreshRouteAfterBookingDetailUpdate() async {
    if (!isDriverEnRouteToPickup) return;
    final bookingId =
        activeDriverBookingId.value ?? serviceDetailBookingId.value;
    if (bookingId == null || bookingId <= 0) return;
    if (!await _ensureDriverPickupCoordsLoaded(bookingId)) return;
    final lat = activeDriverPickupLat.value!;
    final lng = activeDriverPickupLng.value!;
    await drawDriverRouteToPickup(pickupLat: lat, pickupLng: lng);
  }

  void _syncDriverPickupCoordsFromBookingDetail(int bookingId) {
    final detail = serviceDetail.value;
    if (detail?.id != bookingId) return;
    final coords = _customerPickupCoordsFromDetail(detail);
    if (coords == null) return;
    activeDriverPickupLat.value = coords.lat;
    activeDriverPickupLng.value = coords.lng;
    final address = (detail!.pickupLocation?.address ?? detail.address ?? '')
        .trim();
    if (address.isNotEmpty) {
      activeDriverPickupAddress.value = address;
    }
  }

  Future<({double lat, double lng})?> _geocodeDriverPickupAddress(
    bd.BookingDetailData? detail, {
    required double proximityLat,
    required double proximityLng,
  }) async {
    final address = (detail?.pickupLocation?.address ?? detail?.address ?? '')
        .trim();
    if (address.length < 5) return null;
    try {
      final places = await _driverAlternateLocationSearch
          .searchAddressSuggestions(
            query: address,
            latitude: proximityLat,
            longitude: proximityLng,
            limit: 3,
          );
      if (places.isEmpty) return null;
      final place = places.first;
      if (!place.latitude.isFinite || !place.longitude.isFinite) return null;
      return (lat: place.latitude, lng: place.longitude);
    } catch (error) {
      Alert.log(
        'DriverPickupGeocode',
        'Could not resolve booking pickup address: $error',
      );
      return null;
    }
  }

  /// Pickup lat/lng from driver map booking lists (before detail API returns).
  void _seedDriverPickupFromBookingLists(int bookingId) {
    if (bookingId <= 0) return;
    final b = _driverBookingFromLists(bookingId);
    if (b == null) return;
    final lat = b.mapCardLatitude;
    final lng = b.mapCardLongitude;
    if (lat == null || lng == null || !lat.isFinite || !lng.isFinite) {
      return;
    }
    activeDriverPickupLat.value = lat;
    activeDriverPickupLng.value = lng;
    final addr = b.serviceLocation?.address?.trim() ?? '';
    if (addr.isNotEmpty) activeDriverPickupAddress.value = addr;
  }

  Future<bool> _ensureDriverPickupCoordsLoaded(int bookingId) async {
    // Booking-list map coordinates represent the service stop on some API
    // responses. Always prefer the full detail's pickup coordinates before
    // using any cached value for pickup navigation or arrival checks.
    final currentDetail = serviceDetail.value;
    if (currentDetail?.id == bookingId &&
        _customerPickupCoordsFromDetail(currentDetail) != null) {
      _syncDriverPickupCoordsFromBookingDetail(bookingId);
      return true;
    }
    await fetchServiceDetail(bookingId: bookingId, force: true);
    if (serviceDetail.value?.id != bookingId ||
        _customerPickupCoordsFromDetail(serviceDetail.value) == null) {
      return false;
    }
    _syncDriverPickupCoordsFromBookingDetail(bookingId);
    return activeDriverPickupLat.value != null &&
        activeDriverPickupLng.value != null;
  }

  Future<void> _refreshDriverPickupRouteWhenMapReady() async {
    if (!Prefs().isDriverRole || mapbox == null) return;
    if (!isDriverEnRouteToPickup) return;
    final bookingId =
        activeDriverBookingId.value ?? serviceDetailBookingId.value;
    if (bookingId == null || bookingId <= 0) return;
    if (!await _ensureDriverPickupCoordsLoaded(bookingId)) return;
    final lat = activeDriverPickupLat.value!;
    final lng = activeDriverPickupLng.value!;
    await drawDriverRouteToPickup(pickupLat: lat, pickupLng: lng);
  }

  Future<Position?> _driverRouteOriginPosition() async {
    // 1. Try the Mapbox puck layer (fast, no I/O).
    final puck = await _getPuckPosition();
    if (puck != null) return puck;

    // 2. Use last-known GPS immediately — avoids the 8-second getCurrentPosition
    //    timeout that blocks route drawing when the puck is disabled (e.g. during
    //    en-route legs where the puck is hidden and replaced by a custom pin).
    try {
      final last = await Geolocator.getLastKnownPosition();
      if (last != null) return Position(last.longitude, last.latitude);
    } catch (_) {}

    // 3. Full GPS fix as fallback.
    final gps = await _geolocationAsMapPosition();
    if (gps != null) return gps;

    // 4. Cached booking coords as last resort.
    final coords = await _currentDriverCoordsForBookingList();
    if (coords != null) return Position(coords.lng, coords.lat);

    return null;
  }

  String _customerAssignedDriverAvatarUrl() {
    final fromSocket = (customerSocketDriverAvatarUrl.value ?? '').trim();
    if (fromSocket.isNotEmpty) return fromSocket;
    final d = serviceDetail.value;
    final fromDd = (avatarUrlFromDetail(d?.driverDetail) ?? '').trim();
    if (fromDd.isNotEmpty) return fromDd;
    return (avatarUrlFromDetail(d?.assignedDriver) ?? '').trim();
  }

  Future<Uint8List> _customerLiveCustomerProfileMarkerBytes() async {
    final url = Prefs().userImage().trim();
    if (_cachedCustomerLiveCustomerProfileMarkerBytes != null &&
        _cachedCustomerLiveCustomerProfileAvatarUrl == url) {
      return _cachedCustomerLiveCustomerProfileMarkerBytes!;
    }
    final bytes = await _buildCompositeUserMarker(url);
    _cachedCustomerLiveCustomerProfileMarkerBytes = bytes;
    _cachedCustomerLiveCustomerProfileAvatarUrl = url;
    return bytes;
  }

  Future<void> _placeCustomerLiveCustomerProfilePin(
    double lat,
    double lng,
  ) async {
    if (mapbox == null || !Prefs().isCustomerRole) return;
    final bytes = await _customerLiveCustomerProfileMarkerBytes();
    // Reuse the existing manager when available; create it once otherwise.
    // Always deleteAll before adding so GPS updates move the pin rather than
    // stacking a second copy on top of the first.
    _customerLiveCustomerProfilePinManager ??= await mapbox!.annotations
        .createPointAnnotationManager(id: 'customer_live_profile_pin');
    await _customerLiveCustomerProfilePinManager!.deleteAll();
    await _customerLiveCustomerProfilePinManager!.create(
      PointAnnotationOptions(
        geometry: Point(coordinates: Position(lng, lat)),
        image: bytes,
        iconAnchor: IconAnchor.BOTTOM,
        iconSize: 1,
      ),
    );
  }

  /// Black teardrop location pin (same asset as mockup destination marker).
  Future<void> _placeCustomerLiveLocationPin({
    required PointAnnotationManager? manager,
    required String managerId,
    required void Function(PointAnnotationManager?) setManager,
    required double lat,
    required double lng,
    double iconSize = 1,
  }) async {
    if (mapbox == null || !Prefs().isCustomerRole) return;
    final bytes = await _loadPinImageBytes();
    var pinManager = manager;
    pinManager ??= await mapbox!.annotations.createPointAnnotationManager(
      id: managerId,
    );
    setManager(pinManager);
    await pinManager!.deleteAll();
    await pinManager.create(
      PointAnnotationOptions(
        geometry: Point(coordinates: Position(lng, lat)),
        image: bytes,
        iconAnchor: IconAnchor.BOTTOM,
        iconSize: iconSize,
      ),
    );
  }

  Future<void> _placeCustomerLiveRouteDestinationPin(
    double lat,
    double lng,
  ) async {
    await _placeCustomerLiveLocationPin(
      manager: _customerLiveDestinationPinManager,
      managerId: 'customer_live_route_destination_pin',
      setManager: (m) => _customerLiveDestinationPinManager = m,
      lat: lat,
      lng: lng,
    );
  }

  /// Driver live position — car icon marker (matches driver-side car pin).
  Future<void> _placeCustomerLiveDriverLocationPin(
    double lat,
    double lng,
  ) async {
    if (mapbox == null || !Prefs().isCustomerRole) return;
    final bytes = await _driverCarPinMarkerBytes();
    _customerLiveDriverPinManager ??= await mapbox!.annotations
        .createPointAnnotationManager(id: 'customer_live_driver_location_pin');
    await _customerLiveDriverPinManager!.deleteAll();
    await _customerLiveDriverPinManager!.create(
      PointAnnotationOptions(
        geometry: Point(coordinates: Position(lng, lat)),
        image: bytes,
        iconAnchor: IconAnchor.CENTER,
        iconSize: 0.9,
      ),
    );
  }

  /// Returns the correct map pin bytes for the active service stop:
  /// EV charging icon for EV/combo-first-stop, car wash icon otherwise.
  Future<Uint8List> _serviceStopPinBytes(bd.BookingDetailData? detail) async {
    final composition = bookingServiceComposition(detail?.serviceType);
    if (composition.isEvOnly) return _evPinMarkerBytes();
    // Combo: first stop is EV charging, second is car wash.
    if (composition.isCombined) {
      final stopIndex = detail?.comboServiceStopIndex ?? 0;
      if (stopIndex == 0) return _evPinMarkerBytes();
    }
    return _servicePinMarkerBytes();
  }

  /// Service center destination pin — icon matches the active service type.
  Future<void> _placeCustomerLiveServiceCenterPin(
    double lat,
    double lng, {
    bd.BookingDetailData? detail,
  }) async {
    if (mapbox == null || !Prefs().isCustomerRole) return;
    final bytes = await _serviceStopPinBytes(detail);
    _customerLiveDestinationPinManager ??= await mapbox!.annotations
        .createPointAnnotationManager(
          id: 'customer_live_route_destination_pin',
        );
    await _customerLiveDestinationPinManager!.deleteAll();
    await _customerLiveDestinationPinManager!.create(
      PointAnnotationOptions(
        geometry: Point(coordinates: Position(lng, lat)),
        image: bytes,
        iconAnchor: IconAnchor.CENTER,
        iconSize: 0.9,
      ),
    );
  }

  /// Route end: customer profile (pickup/return) or location pin (service center).
  Future<void> _syncCustomerLiveRouteDestinationMarkers(
    bd.BookingDetailData detail, {
    double? routeEndLat,
    double? routeEndLng,
  }) async {
    if (mapbox == null || !Prefs().isCustomerRole) return;
    final leg = _resolveCustomerLiveRouteLegKey(detail);
    final dest = _customerLiveRouteDestinationCoords(leg, detail);
    if (dest == null) {
      await _customerLiveCustomerProfilePinManager?.deleteAll();
      await _customerLiveDestinationPinManager?.deleteAll();
      return;
    }
    final pinLat = routeEndLat ?? dest.lat;
    final pinLng = routeEndLng ?? dest.lng;
    if (leg == 'pickup') {
      await _placeCustomerLiveCustomerProfilePin(pinLat, pinLng);
      await _customerLiveDestinationPinManager?.deleteAll();
    } else if (leg == 'return') {
      await _placeCustomerLiveHomePin(pinLat, pinLng);
      await _customerLiveCustomerProfilePinManager?.deleteAll();
      await _customerLiveDestinationPinManager?.deleteAll();
    } else {
      // Service leg: show service center icon matched to the service type.
      await _customerLiveCustomerProfilePinManager?.deleteAll();
      await _placeCustomerLiveServiceCenterPin(pinLat, pinLng, detail: detail);
    }
  }

  Future<void> _placeCustomerLiveHomePin(double lat, double lng) async {
    if (mapbox == null || !Prefs().isCustomerRole) return;
    final bytes = await _loadHomePinImageBytes();
    _customerLiveDestinationPinManager ??= await mapbox!.annotations
        .createPointAnnotationManager(id: 'customer_live_home_pin');
    await _customerLiveDestinationPinManager!.deleteAll();
    await _customerLiveDestinationPinManager!.create(
      PointAnnotationOptions(
        geometry: Point(coordinates: Position(lng, lat)),
        image: bytes,
        iconAnchor: IconAnchor.CENTER,
        iconSize: 1.2,
      ),
    );
  }

  Future<void> _syncCustomerLiveMarkersToDrawnRoute(
    bd.BookingDetailData detail,
    List<Position> drawnRoute, {
    double? driverLat,
    double? driverLng,
    double? homePinLat,
    double? homePinLng,
  }) async {
    if (drawnRoute.isEmpty) return;
    final endLat = homePinLat ?? _coordLat(drawnRoute.last);
    final endLng = homePinLng ?? _coordLng(drawnRoute.last);
    await _syncCustomerLiveRouteDestinationMarkers(
      detail,
      routeEndLat: endLat,
      routeEndLng: endLng,
    );
    final startLat = driverLat ?? _coordLat(drawnRoute.first);
    final startLng = driverLng ?? _coordLng(drawnRoute.first);
    await _placeCustomerLiveDriverLocationPin(startLat, startLng);
  }

  Future<void> _drawCustomerLiveDrivingRoute(List<Position> coordinates) async {
    if (mapbox == null || coordinates.length < 2) return;
    try {
      _customerLiveRouteManager ??= await mapbox!.annotations
          .createPolylineAnnotationManager(
            id: 'customer_live_driver_pickup_route',
          );
      await _customerLiveRouteManager!.deleteAll();
      await _customerLiveRouteManager!.create(
        PolylineAnnotationOptions(
          geometry: LineString(coordinates: coordinates),
          lineColor: ui.Color(0xFF34B620).toARGB32(),
          lineWidth: 8,
          lineOpacity: 1,
        ),
      );
      Alert.log(
        'CustomerLiveRoute',
        'polyline drawn (${coordinates.length} pts)',
      );
    } catch (e, st) {
      Alert.log('CustomerLiveRoute', 'polyline draw failed: $e\n$st');
    }
  }

  Future<void> _redrawCustomerLiveRoutePolylineFromCache() async {
    if (mapbox == null || !Prefs().isCustomerRole) return;
    final full = _customerLiveFullRouteCoords;
    if (full == null || full.length < 2) return;

    final lat = driverLiveLat.value;
    final lng = driverLiveLng.value;
    List<Position> toDraw = List<Position>.from(full);

    if (lat != null &&
        lng != null &&
        lat.isFinite &&
        lng.isFinite &&
        full.length > 2) {
      try {
        final r = _trimDrivingPolylineAheadOfVehicle(
          fullRoute: full,
          lat: lat,
          lng: lng,
          anchorSeg: _customerLiveRouteTrimAnchorSeg,
        );
        if (r.trimmed.length >= 2) {
          toDraw = r.trimmed;
          _customerLiveRouteTrimAnchorSeg = r.newAnchorSeg;
        }
      } catch (e, st) {
        Alert.log(
          'CustomerLiveRoute',
          'trim failed, using full route: $e\n$st',
        );
      }
    }

    final detail = serviceDetail.value;
    ({double lat, double lng})? destCoords;
    var routeAppendIfWithinMeters = 120.0;
    if (detail != null) {
      final leg = _resolveCustomerLiveRouteLegKey(detail);
      destCoords = _customerLiveRouteDestinationCoords(leg, detail);
      if (leg == 'return') routeAppendIfWithinMeters = 2500;
    }

    if (lat != null && lng != null && toDraw.isNotEmpty) {
      toDraw = _alignDrivingRouteEndpoints(
        toDraw,
        startLat: lat,
        startLng: lng,
        endLat: destCoords?.lat,
        endLng: destCoords?.lng,
        appendIfWithinMeters: routeAppendIfWithinMeters,
      );
    } else if (destCoords != null && toDraw.isNotEmpty) {
      toDraw = _alignDrivingRouteEndpoints(
        toDraw,
        endLat: destCoords.lat,
        endLng: destCoords.lng,
        appendIfWithinMeters: routeAppendIfWithinMeters,
      );
    }
    var homePinLat = destCoords?.lat;
    var homePinLng = destCoords?.lng;
    if (destCoords != null && toDraw.isNotEmpty) {
      final leg = detail != null
          ? _resolveCustomerLiveRouteLegKey(detail)
          : 'pickup';
      if (leg == 'return') {
        final routed = _routeWithHomePinOnPolylineTerminus(
          toDraw,
          destCoords.lat,
          destCoords.lng,
        );
        toDraw = routed.route;
        homePinLat = routed.pinLat;
        homePinLng = routed.pinLng;
      } else {
        toDraw = _finalizeRouteAtDestinationPin(
          toDraw,
          destCoords.lat,
          destCoords.lng,
        );
      }
    }

    await _drawCustomerLiveDrivingRoute(toDraw);

    if (detail != null && toDraw.length >= 2) {
      await _syncCustomerLiveMarkersToDrawnRoute(
        detail,
        toDraw,
        driverLat: lat,
        driverLng: lng,
        homePinLat: homePinLat,
        homePinLng: homePinLng,
      );
    }
  }

  /// Resolves live route leg; early trip always uses pickup when coords exist.
  String _resolveCustomerLiveRouteLegKey(bd.BookingDetailData detail) {
    final code = _customerEffectiveTrackingCode();
    final leg = BookingTrackingStatus.customerLiveRouteLegKey(
      code,
      defaultToPickupWhenEmpty: true,
    );
    if (_customerPickupCoordsFromDetail(detail) == null) return leg;

    switch (leg) {
      case 'service':
      case 'return':
        return leg;
      case 'pickup':
        return 'pickup';
      default:
        if (code.isEmpty ||
            code == BookingTrackingStatus.driverStartedToCustomer ||
            code == BookingTrackingStatus.driverNearCustomer ||
            postBookingStage.value == PostBookingStage.providerEnRoutePickup) {
          return 'pickup';
        }
        return 'none';
    }
  }

  Future<void> _refreshCustomerLiveRouteIfPossible() async {
    if (!Prefs().isCustomerRole || mapbox == null) return;
    final id = _activeCustomerLiveTrackingBookingId;
    if (id == null || id <= 0) return;
    final lat = driverLiveLat.value;
    final lng = driverLiveLng.value;
    if (lat == null || lng == null || !lat.isFinite || !lng.isFinite) {
      return;
    }
    await _ensureCustomerLiveBookingDetailLoaded(id);
    await _updateCustomerLiveDriverRoute(driverLat: lat, driverLng: lng);
    _customerLiveRoutePendingRedraw = false;
  }

  /// Ensures booking detail is loaded with pickup coords AND, on the service leg,
  /// with service/EV location coords so route + destination pin can be drawn.
  Future<bd.BookingDetailData?> _ensureCustomerLiveBookingDetailLoaded(
    int bookingId,
  ) async {
    var detail = serviceDetail.value;
    final alreadyLoaded =
        detail?.id == bookingId &&
        _customerDetailHasPickupCoords(detail) &&
        _customerDetailHasServiceCoordsIfNeeded(detail);
    if (alreadyLoaded) return detail;
    await fetchServiceDetail(bookingId: bookingId, force: true);
    detail = serviceDetail.value;
    if (detail?.id == bookingId && _customerDetailHasPickupCoords(detail)) {
      return detail;
    }
    return null;
  }

  /// Returns true when the service/EV coords are present — or when we are not
  /// on the service leg and so they are not required.
  bool _customerDetailHasServiceCoordsIfNeeded(bd.BookingDetailData? detail) {
    if (detail == null) return false;
    final leg = _customerLiveRouteLegKeyNow(defaultToPickupWhenEmpty: true);
    if (leg != 'service') return true; // only required on service leg
    final stops = _orderedDriverServiceStopsFromDetail(detail);
    return stops.isNotEmpty;
  }

  Future<void> _onCustomerDriverLocationUpdate(
    DriverLocationUpdate e,
    int bookingId,
  ) async {
    if (!Prefs().isCustomerRole) return;
    if (!e.hasCoordinates) return;
    driverLiveLat.value = e.latitude;
    driverLiveLng.value = e.longitude;
    customerLiveLastGpsAt.value = DateTime.now();
    _ensureCustomerLiveEtaTicker();
    if (mapbox == null) {
      _customerLiveRoutePendingRedraw = true;
      unawaited(_ensureCustomerLiveBookingDetailLoaded(bookingId));
      return;
    }
    _customerLiveRoutePendingRedraw = false;
    await _updateCustomerLiveDriverPin();
    final detail = serviceDetail.value?.id == bookingId
        ? serviceDetail.value
        : await _ensureCustomerLiveBookingDetailLoaded(bookingId);
    // Always sync destination markers after each location update so the
    // service/pickup/home icon remains visible even when route build is skipped.
    if (detail != null) {
      await _syncCustomerLiveRouteDestinationMarkers(detail);
    }
  }

  /// Driving route from socket driver position → pickup / service / drop-off per [tracking_status].
  Future<void> _updateCustomerLiveDriverRoute({
    required double driverLat,
    required double driverLng,
  }) async {
    if (mapbox == null || !Prefs().isCustomerRole) return;
    final activeBookingId = _activeCustomerLiveTrackingBookingId;
    if (activeBookingId == null || activeBookingId <= 0) return;

    var detail = serviceDetail.value;
    if (detail?.id != activeBookingId ||
        !_customerDetailHasPickupCoords(detail)) {
      detail = await _ensureCustomerLiveBookingDetailLoaded(activeBookingId);
    }
    if (detail == null) return;

    final legKey = _resolveCustomerLiveRouteLegKey(detail);
    _invalidateCustomerLiveRouteIfLegChanged(defaultToPickupWhenEmpty: true);
    if (legKey == 'none') {
      await _customerLiveRouteManager?.deleteAll();
      _customerLiveFullRouteCoords = null;
      Alert.log(
        'CustomerLiveRoute',
        'skip route (leg=none, tracking=${_customerEffectiveTrackingCode()})',
      );
      return;
    }

    final destCoords = _customerLiveRouteDestinationCoords(legKey, detail);
    if (destCoords == null) {
      Alert.log(
        'CustomerLiveRoute',
        'skip route (no destination for leg=$legKey)',
      );
      // Even without a routable destination, still place the destination marker
      // so the service/pickup/home icon appears on the map.
      await _syncCustomerLiveRouteDestinationMarkers(detail);
      return;
    }

    final now = DateTime.now();
    var shouldRebuild = false;
    final cached = _customerLiveFullRouteCoords;
    if (cached == null || cached.length < 2) {
      shouldRebuild = true;
    } else if (_lastCustomerLiveRouteAt == null) {
      shouldRebuild = true;
    } else if (now.difference(_lastCustomerLiveRouteAt!) >=
        _customerLiveRouteMinInterval) {
      shouldRebuild = true;
    } else if (_lastCustomerLiveRouteDriverLat != null &&
        _lastCustomerLiveRouteDriverLng != null) {
      final moved = Geolocator.distanceBetween(
        _lastCustomerLiveRouteDriverLat!,
        _lastCustomerLiveRouteDriverLng!,
        driverLat,
        driverLng,
      );
      if (moved >= _customerLiveRouteMinMoveMeters) {
        shouldRebuild = true;
      }
    }

    if (!shouldRebuild) {
      await _redrawCustomerLiveRoutePolylineFromCache();
      return;
    }

    final origin = Position(driverLng, driverLat);
    final dest = Position(destCoords.lng, destCoords.lat);
    final etaRequestGeneration = ++_customerLiveEtaRouteRequestGeneration;
    var pts = await _fetchDrivingRoutePoints(
      start: origin,
      destination: dest,
      onDuration: (seconds) {
        if (etaRequestGeneration != _customerLiveEtaRouteRequestGeneration ||
            _activeCustomerLiveTrackingBookingId != activeBookingId ||
            _customerLiveRouteLegKey != legKey) {
          return;
        }
        _setCustomerLiveEtaFromRouteSeconds(seconds);
      },
    );
    if (pts.length < 2) {
      pts = <Position>[origin, dest];
    }

    pts = _alignDrivingRouteEndpoints(
      pts,
      startLat: driverLat,
      startLng: driverLng,
      endLat: destCoords.lat,
      endLng: destCoords.lng,
    );
    _customerLiveFullRouteCoords = List<Position>.from(pts);
    _customerLiveRouteTrimAnchorSeg = 0;
    _lastCustomerLiveRouteAt = now;
    _lastCustomerLiveRouteDriverLat = driverLat;
    _lastCustomerLiveRouteDriverLng = driverLng;
    await _redrawCustomerLiveRoutePolylineFromCache();
  }

  Future<void> _clearCustomerLiveTrackingPins() async {
    await _disposeCustomerLiveMapAnnotations();
    _customerLiveDriverPinManager = null;
    _customerLiveCustomerProfilePinManager = null;
    _customerLiveDestinationPinManager = null;
    _customerPickupPinManager = null;
    _customerServicePinManager = null;
    _customerLiveRouteManager = null;
  }

  Future<void> _placeCustomerPickupPin(double lat, double lng) async {
    if (mapbox == null) return;
    final bytes = await _loadPinImageBytes();
    _customerPickupPinManager ??= await mapbox!.annotations
        .createPointAnnotationManager(id: 'customer_pickup_pin');
    await _customerPickupPinManager!.deleteAll();
    await _customerPickupPinManager!.create(
      PointAnnotationOptions(
        geometry: Point(coordinates: Position(lng, lat)),
        image: bytes,
        iconAnchor: IconAnchor.BOTTOM,
        iconSize: 1,
      ),
    );
  }

  Future<void> _placeCustomerServicePin(
    double lat,
    double lng, {
    bd.BookingDetailData? detail,
  }) async {
    if (mapbox == null) return;
    final bytes = await _serviceStopPinBytes(detail);
    _customerServicePinManager ??= await mapbox!.annotations
        .createPointAnnotationManager(id: 'customer_service_pin');
    await _customerServicePinManager!.deleteAll();
    await _customerServicePinManager!.create(
      PointAnnotationOptions(
        geometry: Point(coordinates: Position(lng, lat)),
        image: bytes,
        iconAnchor: IconAnchor.CENTER,
        iconSize: 0.9,
      ),
    );
  }

  /// Driver live position on the customer map — location pin only (no driver photo).
  Future<void> _updateCustomerLiveDriverPin() async {
    if (mapbox == null || !Prefs().isCustomerRole) return;
    final lat = driverLiveLat.value;
    final lng = driverLiveLng.value;
    if (lat == null || lng == null || !lat.isFinite || !lng.isFinite) {
      return;
    }
    // Move the car pin and camera first. Route refreshes may call the network,
    // so they must not delay the customer's real-time view of the provider.
    await _placeCustomerLiveDriverLocationPin(lat, lng);
    _scheduleCustomerLiveCameraUpdate();
    await _updateCustomerLiveDriverRoute(driverLat: lat, driverLng: lng);
  }

  void _scheduleCustomerLiveCameraUpdate({bool forceFollow = false}) {
    _customerLiveCameraUpdatePending = true;
    _customerLiveForceFollowPending =
        _customerLiveForceFollowPending || forceFollow;
    if (_customerLiveCameraUpdateInFlight) return;
    unawaited(_drainCustomerLiveCameraUpdates());
  }

  Future<void> _drainCustomerLiveCameraUpdates() async {
    if (_customerLiveCameraUpdateInFlight) return;
    _customerLiveCameraUpdateInFlight = true;
    try {
      while (_customerLiveCameraUpdatePending) {
        _customerLiveCameraUpdatePending = false;
        final forceFollow = _customerLiveForceFollowPending;
        _customerLiveForceFollowPending = false;
        await _updateCustomerLiveTrackingCamera(forceFollow: forceFollow);
      }
    } finally {
      _customerLiveCameraUpdateInFlight = false;
    }
  }

  Future<void> _updateCustomerLiveTrackingCamera({
    required bool forceFollow,
  }) async {
    if (mapbox == null ||
        !Prefs().isCustomerRole ||
        !isCustomerLiveTrackingActive) {
      return;
    }
    final pausedUntil = _customerLiveCameraPausedUntil;
    if (!forceFollow &&
        pausedUntil != null &&
        DateTime.now().isBefore(pausedUntil)) {
      return;
    }
    if (pausedUntil != null) {
      _customerLiveCameraPausedUntil = null;
    }

    if (!_customerLiveCameraFitted && !forceFollow) {
      await _maybeFitCustomerLiveTrackingCamera();
      return;
    }

    final lat = driverLiveLat.value;
    final lng = driverLiveLng.value;
    if (lat == null || lng == null || !lat.isFinite || !lng.isFinite) return;

    final previousLat = _lastCustomerLiveCameraLat;
    final previousLng = _lastCustomerLiveCameraLng;
    if (!forceFollow && previousLat != null && previousLng != null) {
      final moved = Geolocator.distanceBetween(
        previousLat,
        previousLng,
        lat,
        lng,
      );
      if (moved < _customerLiveCameraMinMoveMeters) return;
    }

    try {
      final currentMap = mapbox;
      if (currentMap == null) return;
      final currentCamera = await currentMap.getCameraState();
      await currentMap.easeTo(
        CameraOptions(
          center: Point(coordinates: Position(lng, lat)),
          zoom: math.max(currentCamera.zoom, _customerLiveCameraFollowZoom),
          bearing: currentCamera.bearing,
          pitch: currentCamera.pitch,
          padding: MbxEdgeInsets(
            top: 120,
            left: 24,
            bottom: customerTripPanelCollapsed.value ? 80 : 240,
            right: 24,
          ),
        ),
        MapAnimationOptions(duration: 850),
      );
      _customerLiveCameraFitted = true;
      _lastCustomerLiveCameraLat = lat;
      _lastCustomerLiveCameraLng = lng;
    } catch (_) {}
  }

  Future<void> _maybeFitCustomerLiveTrackingCamera() async {
    if (_customerLiveCameraFitted ||
        mapbox == null ||
        !Prefs().isCustomerRole) {
      return;
    }
    final dLat = driverLiveLat.value;
    final dLng = driverLiveLng.value;
    final detail = serviceDetail.value;
    if (detail == null) return;

    final legKey = _customerLiveRouteLegKeyNow(defaultToPickupWhenEmpty: true);
    final pts = <Position>[];
    if (dLat != null && dLng != null && dLat.isFinite && dLng.isFinite) {
      pts.add(Position(dLng, dLat));
    }
    final dest = _customerLiveRouteDestinationCoords(legKey, detail);
    if (dest != null) {
      pts.add(Position(dest.lng, dest.lat));
    }
    if (pts.length < 2) {
      return;
    }
    try {
      final camera = await mapbox!.cameraForCoordinatesPadding(
        pts.map((p) => Point(coordinates: p)).toList(),
        CameraOptions(),
        MbxEdgeInsets(top: 180, left: 48, bottom: 220, right: 48),
        null,
        null,
      );
      final fittedZoom = camera.zoom ?? _customerLiveCameraFollowZoom;
      final closerCamera = CameraOptions(
        center: camera.center,
        zoom: math.min(
          fittedZoom + _customerLiveCameraZoomBoost,
          _customerLiveCameraMaxFitZoom,
        ),
        bearing: camera.bearing,
        pitch: camera.pitch,
        padding: camera.padding,
      );
      await mapbox!.easeTo(closerCamera, MapAnimationOptions(duration: 700));
      _customerLiveCameraFitted = true;
      _lastCustomerLiveCameraLat = dLat;
      _lastCustomerLiveCameraLng = dLng;
    } catch (_) {}
  }

  static bool _isCancelledBookingStatus(String raw) {
    final life = raw.trim().toUpperCase();
    return life == 'CANCELLED' || life == 'CANCELED';
  }

  static bool _isTimerTimeoutBookingStatus(String raw) {
    final life = raw.trim().toUpperCase();
    return life == 'TIMER_TIMEOUT' ||
        life == 'ACCEPT_TIMEOUT' ||
        life == 'SCHEDULED_PICKUP_TIMEOUT';
  }

  static bool _isCustomerNoShowBoardReturnEvent(BookingStatusSocketEvent e) {
    final status = e.status.trim().toUpperCase();
    if (status == 'CUSTOMER_NO_SHOW') return true;
    final reason = '${e.raw['reason'] ?? e.raw['cancellation_reason'] ?? ''}'
        .trim()
        .toLowerCase();
    if (reason == 'customer_no_show') return true;
    final msg = (e.message ?? '').toLowerCase();
    return msg.contains('no-show') || msg.contains('no show');
  }

  void _handleDriverCustomerNoShowBoardReturn(BookingStatusSocketEvent e) {
    final id = e.bookingId;
    if (id == null || id <= 0) return;
    final alreadyHandled = hasHandledDriverCustomerNoShow(id);
    noteDriverCustomerNoShowHandled(id);
    clearBookingTimerState();
    returnDriverToHomeAfterCustomerNoShow();
    if (alreadyHandled) return;
    final msg = (e.message ?? '').trim();
    if (msg.isNotEmpty) {
      showAppSnackBar(title: 'No show · No call', message: msg);
    }
  }

  /// Joins the booking socket room so `booking_status_update` (e.g. CANCELLED) is received.
  Future<void> _ensureDriverJoinedBookingRoomForStatusUpdates(
    int bookingId,
  ) async {
    if (!Prefs().isDriverRole || bookingId <= 0) return;
    if (!Get.isRegistered<BookingLiveSocketService>()) return;

    await fetchServiceDetail(bookingId: bookingId, force: true);
    if (_driverActiveBookingShouldClear(serviceDetail.value)) {
      _clearPersistedActiveDriverService();
      resetAcceptedService();
      activeDriverBookingId.value = null;
      await Get.find<BookingLiveSocketService>().disconnect();
      return;
    }

    bindDriverCancelledBookingListeners();
    final socket = Get.find<BookingLiveSocketService>();
    if (socket.activeBookingId != bookingId || !socket.isConnected.value) {
      await socket.connectForBooking(bookingId);
    }
    bindBookingTimerListener();
  }

  /// Driver: [booking_status_update] on live booking socket + always-on dashboard socket.
  void bindDriverCancelledBookingListeners() {
    bindDriverBookingStatusListener();
    bindDriverDashboardBookingStatusListener();
  }

  void bindDriverBookingStatusListener() {
    if (!Prefs().isDriverRole) return;
    if (!Get.isRegistered<BookingLiveSocketService>()) return;
    final socket = Get.find<BookingLiveSocketService>();
    _driverBookingStatusSub ??= socket.onBookingStatusUpdate.listen(
      _onDriverBookingStatusSocketEvent,
    );
    _driverBookingTrackingSub ??= socket.onBookingTrackingUpdate.listen(
      _onDriverBookingTrackingSocketEvent,
    );
  }

  void bindDriverDashboardBookingStatusListener() {
    if (!Prefs().isDriverRole) return;
    if (!Get.isRegistered<DriverDashboardSocketService>()) return;
    final socket = Get.find<DriverDashboardSocketService>();
    _driverDashBookingStatusSub ??= socket.onBookingStatusUpdate.listen(
      _onDriverBookingStatusSocketEvent,
    );
    _driverDashBookingTimerSub ??= socket.onBookingTimerUpdate.listen(
      applyBookingTimerSocketEvent,
    );
  }

  void _onDriverBookingStatusSocketEvent(BookingStatusSocketEvent e) {
    if (_isCustomerNoShowBoardReturnEvent(e)) {
      _handleDriverCustomerNoShowBoardReturn(e);
      return;
    }
    if (_isTimerTimeoutBookingStatus(e.status)) {
      final id = e.bookingId;
      if (id == null || id <= 0) return;
      handleDriverOnDemandAcceptTimeout(bookingId: id, showMessage: true);
      return;
    }
    final status = e.status.trim().toUpperCase();
    final id = e.bookingId;
    if (id == null || id <= 0) return;
    if (_isCancelledBookingStatus(status)) {
      unawaited(_handleBookingCancelled(id));
      return;
    }
    if (status == 'COMPLETED') {
      unawaited(_handleDriverBookingCompleted(id));
    }
  }

  void _onDriverBookingTrackingSocketEvent(BookingTrackingSocketEvent e) {
    final code = BookingTrackingStatus.normalizeTrackingCode(e.trackingStatus);
    final id = e.bookingId;
    if (id == null || id <= 0) return;
    if (code == BookingTrackingStatus.bookingCancelled ||
        _isCancelledBookingStatus(code) ||
        _isCancelledBookingStatus(
          '${e.raw['booking_status'] ?? e.raw['bookingStatus'] ?? ''}',
        )) {
      unawaited(_handleBookingCancelled(id));
    }
  }

  Future<void> unbindDriverBookingStatusListener() async {
    await _driverBookingStatusSub?.cancel();
    _driverBookingStatusSub = null;
    await _driverBookingTrackingSub?.cancel();
    _driverBookingTrackingSub = null;
    await _driverDashBookingStatusSub?.cancel();
    _driverDashBookingStatusSub = null;
    await _driverDashBookingTimerSub?.cancel();
    _driverDashBookingTimerSub = null;
  }

  /// Ends live tracking immediately when [booking_status_update] is `CANCELLED`.
  Future<void> _handleBookingCancelled(int bookingId) async {
    if (bookingId <= 0 || _bookingCancelledHandledId == bookingId) return;
    _bookingCancelledHandledId = bookingId;

    if (Prefs().isCustomerRole) {
      final trackingId = _activeCustomerLiveTrackingBookingId;
      final postId = postBookingApiId.value;
      final persistedId = int.tryParse(
        Prefs().getData(_activeCustomerLiveBookingIdKey).trim(),
      );
      final socketBookingId = Get.isRegistered<BookingLiveSocketService>()
          ? Get.find<BookingLiveSocketService>().activeBookingId
          : null;
      final detailId = serviceDetail.value?.id ?? serviceDetailBookingId.value;
      final matchesTrip =
          trackingId == bookingId ||
          postId == bookingId ||
          socketBookingId == bookingId ||
          persistedId == bookingId ||
          detailId == bookingId;
      if (!matchesTrip) {
        _bookingCancelledHandledId = null;
        return;
      }
      final msg = bookingLifecycleCustomerMessage('CANCELLED');
      if (msg.isNotEmpty) {
        showAppSnackBar(title: 'Booking', message: msg, isError: true);
      }
      await _clearCustomerTripAfterBookingEnded();
      unawaited(fetchActiveBooking());
      return;
    }

    if (Prefs().isDriverRole) {
      await _stopDriverTrackingForCancelledBooking(bookingId);
    }
  }

  bool _driverHasActiveBookingContext(int bookingId) {
    if (bookingId <= 0) return false;
    if (activeDriverBookingId.value == bookingId) return true;
    if (serviceDetailBookingId.value == bookingId) return true;
    final socketBookingId = Get.isRegistered<BookingLiveSocketService>()
        ? Get.find<BookingLiveSocketService>().activeBookingId
        : null;
    return socketBookingId == bookingId;
  }

  Future<void> _stopDriverTrackingForCancelledBooking(int bookingId) async {
    removeBookingFromNearbyUnassignedLists(bookingId);
    bookings.removeWhere((x) => x.id == bookingId);
    isDriverNearbyUnassignedLoading.value = false;

    if (!_driverHasActiveBookingContext(bookingId)) {
      return;
    }

    clearBookingTimerState();
    resetAcceptedService();
    await clearRouteAndPin();
    hasActiveRoute.value = false;
    activeDriverBookingId.value = null;
    activeDriverCustomerName.value = 'Customer';
    activeDriverCustomerAvatarUrl.value = '';
    activeDriverPickupLat.value = null;
    activeDriverPickupLng.value = null;
    activeDriverPickupAddress.value = '';

    if (serviceDetailBookingId.value == bookingId ||
        serviceDetail.value?.id == bookingId) {
      serviceDetailBookingId.value = bookingId;
      if (serviceDetail.value != null && serviceDetail.value!.id == bookingId) {
        serviceDetail.value!.status = 'CANCELLED';
        serviceDetail.value!.trackingStatus = 'BOOKING_CANCELLED';
        serviceDetail.refresh();
      }
    }

    _dismissDriverNearbyUnassignedSheetIfOpen();

    if (Get.currentRoute == Routes.DRIVER_CAR_DETAILS) {
      Get.back<void>();
    }
    if (Get.isBottomSheetOpen == true || Get.isDialogOpen == true) {
      Get.back<void>();
    }

    if (Get.isRegistered<BookingLiveSocketService>()) {
      final live = Get.find<BookingLiveSocketService>();
      live.stopDriverLocationHeartbeat();
      await live.disconnect();
    }

    showAppSnackBar(
      title: 'Booking',
      message: 'This booking has been cancelled',
      isError: true,
    );
    unawaited(refreshBookings());
    unawaited(fetchServiceDetail(bookingId: bookingId, force: true));
  }

  /// Clears the driver's active map route, stops location heartbeat and
  /// disconnects the live socket when [booking_status_update] is `COMPLETED`.
  Future<void> _handleDriverBookingCompleted(int bookingId) async {
    if (!Prefs().isDriverRole) return;
    if (!_driverHasActiveBookingContext(bookingId)) {
      unawaited(refreshBookings());
      return;
    }

    clearBookingTimerState();
    resetAcceptedService();
    await clearRouteAndPin();
    hasActiveRoute.value = false;
    activeDriverBookingId.value = null;
    activeDriverCustomerName.value = 'Customer';
    activeDriverCustomerAvatarUrl.value = '';
    activeDriverPickupLat.value = null;
    activeDriverPickupLng.value = null;
    activeDriverPickupAddress.value = '';
    if (serviceDetailBookingId.value == bookingId) {
      serviceDetailBookingId.value = null;
      serviceDetail.value = null;
      serviceDetailError.value = '';
    }
    _dismissDriverNearbyUnassignedSheetIfOpen();

    if (Get.isRegistered<BookingLiveSocketService>()) {
      final live = Get.find<BookingLiveSocketService>();
      live.stopDriverLocationHeartbeat();
      await live.disconnect();
    }

    unawaited(refreshBookings());
    unawaited(fetchDriverNearbyUnassignedBookings(refresh: true));
  }

  void _handleCustomerBookingSocketSideEffects(
    BookingStatusSocketEvent e,
    int bookingId,
  ) {
    if (!Prefs().isCustomerRole) return;
    final life = e.status.trim().toUpperCase();
    if (life.isEmpty) return;

    final msg = bookingLifecycleCustomerMessage(life);
    if (msg.isNotEmpty) {
      driverLiveStatus.value = msg;
    }

    switch (life) {
      case 'ASSIGNED':
        unawaited(fetchServiceDetail(bookingId: bookingId, force: true));
        unawaited(refreshBookings());
        break;
      case 'COMPLETED':
        showAppSnackBar(title: 'Booking', message: msg);
        unawaited(
          _clearCustomerTripAfterBookingEnded(endedBookingId: bookingId),
        );
        break;
      case 'CANCELLED':
        unawaited(_handleBookingCancelled(bookingId));
        break;
      default:
        break;
    }
  }

  /// Places pickup (from booking details) + driver (from socket) markers on the customer home map.
  Future<void> _syncCustomerLiveTrackingMapAnnotations(int bookingId) async {
    if (mapbox == null || !Prefs().isCustomerRole) return;
    await _ensureCustomerLiveBookingDetailLoaded(bookingId);
    final detail = serviceDetail.value;
    if (detail?.id != bookingId) return;

    final sLat = detail?.serviceLocation?.latitude;
    final sLng = detail?.serviceLocation?.longitude;
    if (sLat != null && sLng != null && sLat.isFinite && sLng.isFinite) {
      final pickup = _customerPickupCoordsFromDetail(detail);
      if (pickup != null &&
          _coordsFarApart(pickup.lat, pickup.lng, sLat, sLng)) {
        await _placeCustomerServicePin(sLat, sLng, detail: detail);
      } else {
        await _customerServicePinManager?.deleteAll();
      }
    } else {
      await _customerServicePinManager?.deleteAll();
    }

    _invalidateCustomerLiveRouteIfLegChanged(defaultToPickupWhenEmpty: true);

    final dLat = driverLiveLat.value;
    final dLng = driverLiveLng.value;
    if (dLat != null && dLng != null && dLat.isFinite && dLng.isFinite) {
      await _updateCustomerLiveDriverPin();
      // Always sync destination markers after updating the driver pin so the
      // service location icon is placed even when the route-build path exits
      // early (e.g. serviceLocation coords not yet in detail).
      if (detail != null) {
        await _syncCustomerLiveRouteDestinationMarkers(detail);
      }
    } else if (detail != null) {
      await _syncCustomerLiveRouteDestinationMarkers(detail);
      await _customerLiveRouteManager?.deleteAll();
      _customerLiveFullRouteCoords = null;
    } else {
      await _customerLiveRouteManager?.deleteAll();
      _customerLiveFullRouteCoords = null;
    }
    _scheduleCustomerLiveCameraUpdate();
  }

  /// Call when booking is created but no tracking code yet (awaiting provider).
  void setBookingConfirmedStage() {
    if (!Prefs().isCustomerRole) return;
    if (postBookingStage.value == PostBookingStage.bookingConfirmed) return;
    postBookingStage.value = PostBookingStage.bookingConfirmed;
    customerTripPanelUserDismissed.value = false;
  }

  /// Called by ServiceBookingController immediately after booking is confirmed.
  /// Shows the booking panel on the home screen right away.
  void activateCustomerBookingConfirmedPanel(int bookingId) {
    if (!Prefs().isCustomerRole || bookingId <= 0) return;
    customerTripPanelEnabled.value = true;
    customerTripPanelUserDismissed.value = false;
    customerTripPanelCollapsed.value = false;
    postBookingApiId.value = bookingId;
    if (postBookingStartedAt.value == null) {
      postBookingStartedAt.value = DateTime.now();
    }
    setBookingConfirmedStage();
    homeNavIndex.value = 0;
    // Refresh the active booking tab with the newly confirmed booking.
    unawaited(fetchActiveBooking());
  }

  void _syncPostBookingStageFromTracking(String codeRaw) {
    if (!Prefs().isCustomerRole) return;
    final code = codeRaw.trim().toUpperCase();
    // No tracking code yet — booking confirmed but provider hasn’t started
    if (code.isEmpty) {
      if (postBookingStage.value == PostBookingStage.bookingConfirmed) return;
      postBookingStage.value = PostBookingStage.bookingConfirmed;
      return;
    }
    final previousStage = postBookingStage.value;
    switch (code) {
      case BookingTrackingStatus.driverStartedToCustomer:
      case BookingTrackingStatus.driverNearCustomer:
        postBookingStage.value = PostBookingStage.providerEnRoutePickup;
        break;
      case BookingTrackingStatus.driverReachedCustomer:
      case BookingTrackingStatus.otpPending:
      case BookingTrackingStatus.otpVerified:
        postBookingStage.value = PostBookingStage.providerArrived;
        break;
      case BookingTrackingStatus.vehiclePicked:
      case BookingTrackingStatus.driverStartedToServiceCenter:
      case BookingTrackingStatus.driverReachedServiceCenter:
      case BookingTrackingStatus.serviceStarted:
      case BookingTrackingStatus.serviceInProgress:
      case BookingTrackingStatus.firstServiceCompleted:
      case BookingTrackingStatus.driverHeadingToNextServiceStop:
      case BookingTrackingStatus.driverReachedNextServiceStop:
      case BookingTrackingStatus.secondServiceStarted:
      case BookingTrackingStatus.secondServiceInProgress:
        postBookingStage.value = PostBookingStage.serviceStarted;
        break;
      case BookingTrackingStatus.serviceCompleted:
      case BookingTrackingStatus.secondServiceCompleted:
      case BookingTrackingStatus.beforeImagesUploaded:
      case BookingTrackingStatus.afterImagesUploaded:
      case BookingTrackingStatus.driverLeftServiceCenter:
      case BookingTrackingStatus.driverReturningToCustomer:
        postBookingStage.value = PostBookingStage.carOnWayBack;
        break;
      case BookingTrackingStatus.driverReachedCustomerReturn:
      case BookingTrackingStatus.vehicleDelivered:
        postBookingStage.value = PostBookingStage.carBackHome;
        break;
      default:
        break;
    }
    if (postBookingStage.value != previousStage) {
      customerTripPanelUserDismissed.value = false;
    }
  }

  void _clearCustomerVehiclePickupOtp() {
    customerVehiclePickupOtp.value = null;
    customerVehiclePickupOtpHint.value = null;
    _clearPersistedCustomerPickupOtp();
  }

  void _hydrateCustomerVehiclePickupOtpFromBookingMap(
    Map<String, dynamic> booking,
  ) {
    if (!Prefs().isCustomerRole) return;
    final otp =
        '${booking['vehicle_pickup_otp'] ?? booking['vehiclePickupOtp'] ?? booking['pickup_otp'] ?? booking['pickupOtp'] ?? ''}'
            .trim();
    if (otp.isEmpty) return;
    final bookingId = int.tryParse('${booking['id'] ?? ''}');
    _setCustomerVehiclePickupOtp(otp, bookingId: bookingId);
  }

  void _hydrateCustomerVehiclePickupOtpFromDetail(
    bd.BookingDetailData? detail,
  ) {
    if (!Prefs().isCustomerRole || detail == null) return;
    final otp = (detail.vehiclePickupOtp ?? '').trim();
    if (otp.isEmpty) {
      if (!BookingTrackingStatus.isCustomerPickupOtpSharePhase(
        detail.trackingStatus,
      )) {
        _clearCustomerVehiclePickupOtp();
      } else if (detail.id != null && detail.id! > 0) {
        _restoreCustomerPickupOtpForBooking(detail.id!);
      }
      return;
    }
    _setCustomerVehiclePickupOtp(otp, bookingId: detail.id);
  }

  /// Pickup OTP shown on dashboard + service details until the driver verifies it.
  String? customerPickupOtpForDisplay({
    int? bookingId,
    bd.BookingDetailData? detail,
  }) {
    if (!Prefs().isCustomerRole) return null;

    final resolvedDetail =
        detail ??
        (serviceDetail.value != null &&
                (bookingId == null || serviceDetail.value!.id == bookingId)
            ? serviceDetail.value
            : null);
    final tracking = BookingTrackingStatus.normalizeTrackingCode(
      resolvedDetail?.trackingStatus ?? customerSocketTrackingCode.value,
    );
    if (!BookingTrackingStatus.isCustomerPickupOtpSharePhase(tracking)) {
      return null;
    }

    final fromDetail = (resolvedDetail?.vehiclePickupOtp ?? '').trim();
    if (fromDetail.isNotEmpty) return fromDetail;

    final fromController = (customerVehiclePickupOtp.value ?? '').trim();
    if (fromController.isNotEmpty) return fromController;

    final bid = bookingId ?? resolvedDetail?.id ?? postBookingApiId.value;
    if (bid != null && bid > 0) {
      final persisted = _readPersistedCustomerPickupOtp(bid);
      if (persisted != null && persisted.isNotEmpty) return persisted;
    }

    return null;
  }

  void _persistCustomerPickupOtp(int bookingId, String otp) {
    if (!Prefs().isCustomerRole || bookingId <= 0) return;
    final code = otp.trim();
    if (code.isEmpty) return;
    Prefs().putData(_activeCustomerPickupOtpBookingIdKey, bookingId.toString());
    Prefs().putData(_activeCustomerPickupOtpKey, code);
  }

  String? _readPersistedCustomerPickupOtp(int bookingId) {
    if (bookingId <= 0) return null;
    final persistedBookingId = int.tryParse(
      Prefs().getData(_activeCustomerPickupOtpBookingIdKey).trim(),
    );
    if (persistedBookingId != bookingId) return null;
    final otp = Prefs().getData(_activeCustomerPickupOtpKey).trim();
    return otp.isEmpty ? null : otp;
  }

  void _clearPersistedCustomerPickupOtp() {
    if (!Prefs().isCustomerRole) return;
    unawaited(Prefs().removeData(_activeCustomerPickupOtpKey));
    unawaited(Prefs().removeData(_activeCustomerPickupOtpBookingIdKey));
  }

  void _restoreCustomerPickupOtpForBooking(int bookingId, {String? pickupOtp}) {
    if (!Prefs().isCustomerRole || bookingId <= 0) return;
    final direct = (pickupOtp ?? '').trim();
    if (direct.isNotEmpty) {
      _setCustomerVehiclePickupOtp(direct, bookingId: bookingId);
      return;
    }
    if ((customerVehiclePickupOtp.value ?? '').trim().isNotEmpty) return;
    final persisted = _readPersistedCustomerPickupOtp(bookingId);
    if (persisted != null) {
      _setCustomerVehiclePickupOtp(persisted, bookingId: bookingId);
    }
  }

  void _setCustomerVehiclePickupOtp(String otp, {int? bookingId}) {
    final code = otp.trim();
    if (code.isEmpty) return;
    customerVehiclePickupOtp.value = code;
    customerVehiclePickupOtpHint.value = bookingPickupOtpShareMessage(code);
    final bid =
        bookingId ??
        postBookingApiId.value ??
        _activeCustomerLiveTrackingBookingId;
    if (bid != null && bid > 0) {
      _persistCustomerPickupOtp(bid, code);
    }
  }

  /// Applies `booking_status_update` (e.g. OTP_GENERATED with pickup OTP).
  void _applyCustomerBookingStatusSocketEvent(BookingStatusSocketEvent e) {
    if (!Prefs().isCustomerRole) return;
    customerLiveLastStatusAt.value = DateTime.now();
    _ensureCustomerLiveEtaTicker();
    final stUpper = e.status.trim().toUpperCase();

    if (stUpper == 'OTP_GENERATED') {
      final o = e.otp?.trim();
      if (o != null && o.isNotEmpty) {
        _setCustomerVehiclePickupOtp(o);
        showAppSnackBar(
          title: 'Pickup OTP',
          message: bookingPickupOtpShareMessage(o),
        );
      }

      _applyCustomerSocketDriverFields(
        driverName: e.driverName,
        driverAvatarUrl: e.driverProfilePictureUrl,
        driverPhone: e.driverPhone,
        driverAvgRating: e.driverAvgRating,
      );
      return;
    }

    if (stUpper == 'OTP_VERIFIED') {
      _clearCustomerVehiclePickupOtp();
    }
  }

  void _applyBookingTrackingSocketEvent(
    BookingTrackingSocketEvent e, {
    required int joinedBookingId,
  }) {
    if (!Prefs().isCustomerRole) return;
    if (e.bookingId != null && e.bookingId != joinedBookingId) return;

    final code = e.trackingStatus.trim().toUpperCase();
    if (code.isEmpty) return;
    customerLiveLastStatusAt.value = DateTime.now();
    customerLiveEtaArrivalAt.value = null;
    _lastCustomerLiveRouteAt = null;
    _customerLiveEtaRouteRequestGeneration++;
    _ensureCustomerLiveEtaTicker();

    if (BookingTrackingStatus.isCustomerPickupOtpSharePhase(code)) {
      final socketOtp = e.pickupOtp?.trim();
      if (socketOtp != null && socketOtp.isNotEmpty) {
        _setCustomerVehiclePickupOtp(socketOtp);
      } else if ((customerVehiclePickupOtp.value ?? '').trim().isEmpty) {
        unawaited(fetchServiceDetail(bookingId: joinedBookingId, force: true));
      }
    }

    if (!customerTripPanelEnabled.value) {
      _ensureCustomerTripPanelForActiveBooking(
        joinedBookingId,
        trackingCode: code,
      );
    }

    if (!customerTripPanelEnabled.value && !isCustomerLiveTrackingActive) {
      return;
    }

    if (code == BookingTrackingStatus.bookingCancelled ||
        _isCancelledBookingStatus(
          '${e.raw['booking_status'] ?? e.raw['bookingStatus'] ?? ''}',
        )) {
      unawaited(_handleBookingCancelled(joinedBookingId));
      return;
    }

    customerSocketTrackingCode.value = code;
    driverLiveStatus.value = bookingTrackingCustomerMessage(code);

    final msg = e.serverMessage?.trim();
    customerTrackingUpdateMessage.value = (msg != null && msg.isNotEmpty)
        ? msg
        : null;

    _applyCustomerSocketDriverFields(
      driverName: e.driverName,
      driverAvatarUrl: e.driverProfilePictureUrl,
      driverPhone: e.driverPhone,
      driverAvgRating: e.driverAvgRating,
    );

    postBookingApiId.value = joinedBookingId;
    if (postBookingStartedAt.value == null) {
      postBookingStartedAt.value = DateTime.now();
    }
    homeNavIndex.value = 0;
    _syncPostBookingStageFromTracking(code);
    _persistCustomerLiveSession(
      bookingId: joinedBookingId,
      trackingCode: code,
      driverName: e.driverName,
      driverAvatarUrl: e.driverProfilePictureUrl,
    );

    const clearPickupOtp = {
      BookingTrackingStatus.otpVerified,
      BookingTrackingStatus.vehiclePicked,
      BookingTrackingStatus.driverStartedToServiceCenter,
      BookingTrackingStatus.driverReachedServiceCenter,
      BookingTrackingStatus.serviceStarted,
      BookingTrackingStatus.serviceInProgress,
      BookingTrackingStatus.serviceCompleted,
      BookingTrackingStatus.beforeImagesUploaded,
      BookingTrackingStatus.afterImagesUploaded,
      BookingTrackingStatus.driverLeftServiceCenter,
      BookingTrackingStatus.driverReturningToCustomer,
      BookingTrackingStatus.driverReachedCustomerReturn,
      BookingTrackingStatus.vehicleDelivered,
    };
    if (clearPickupOtp.contains(code)) {
      _clearCustomerVehiclePickupOtp();
    }

    _invalidateCustomerLiveRouteIfLegChanged();
    final dLat = driverLiveLat.value;
    final dLng = driverLiveLng.value;
    if (dLat != null && dLng != null && dLat.isFinite && dLng.isFinite) {
      unawaited(
        _updateCustomerLiveDriverRoute(driverLat: dLat, driverLng: dLng),
      );
    }
    unawaited(_syncCustomerLiveTrackingMapAnnotations(joinedBookingId));
  }

  /// **Customer:** primary line for live trip progress (socket + `tracking_status` + API).
  ///
  /// When [forBookingId] is set (e.g. service detail), socket-derived lines only apply if
  /// live tracking / post-booking state is for that booking so another trip does not leak in.
  String customerTripStatusLine({int? forBookingId}) {
    bool socketDataAppliesToViewedBooking() {
      if (forBookingId == null) return true;
      final pb = postBookingApiId.value;
      final liveId = _activeCustomerLiveTrackingBookingId;
      return pb == forBookingId || liveId == forBookingId;
    }

    if (socketDataAppliesToViewedBooking()) {
      final serverMsg = (customerTrackingUpdateMessage.value ?? '').trim();
      if (serverMsg.isNotEmpty) return serverMsg;

      final socketTrack = (customerSocketTrackingCode.value ?? '').trim();
      if (socketTrack.isNotEmpty) {
        return BookingTrackingStatus.customerMessageFor(socketTrack);
      }
    }

    final detail = serviceDetail.value;
    final detailMatches =
        detail != null && (forBookingId == null || detail.id == forBookingId);
    if (detailMatches) {
      final detailCode = _normalizeTrackingCodeFromDetail(
        detail.trackingStatus,
      );
      if (detailCode != null && detailCode.isNotEmpty) {
        return BookingTrackingStatus.customerMessageFor(detailCode);
      }
    }

    if (socketDataAppliesToViewedBooking()) {
      final live = (driverLiveStatus.value ?? '').trim();
      if (live.isNotEmpty) {
        if (BookingTrackingStatus.isKnownCode(live)) {
          return BookingTrackingStatus.customerMessageFor(live);
        }
        return live;
      }
      final bookingStatusRaw = (customerSocketBookingStatusRaw.value ?? '')
          .trim();
      if (bookingStatusRaw.isNotEmpty) {
        return _formatCustomerBookingStatusLabel(bookingStatusRaw);
      }
    }
    return '';
  }

  String _formatCustomerBookingStatusLabel(String raw) {
    final s = raw.replaceAll('_', ' ').trim();
    if (s.isEmpty) return '';
    return s
        .split(RegExp(r'\s+'))
        .where((w) => w.isNotEmpty)
        .map(
          (w) =>
              '${w[0].toUpperCase()}${w.length > 1 ? w.substring(1).toLowerCase() : ''}',
        )
        .join(' ');
  }

  String customerPostBookingPanelTitle(PostBookingStage stage) {
    final line = customerTripStatusLine(forBookingId: postBookingApiId.value);
    if (line.isNotEmpty) return line;
    switch (stage) {
      case PostBookingStage.bookingConfirmed:
        return 'Your booking is confirmed! A provider will be assigned shortly.';
      case PostBookingStage.providerEnRoutePickup:
        return 'Your service provider is enroute to pick up your vehicle';
      case PostBookingStage.serviceStarted:
        return 'Your service provider is enroute to drop off your vehicle';
      case PostBookingStage.providerArrived:
        return 'Service Provider Has Arrived';
      case PostBookingStage.carOnWayBack:
        return 'Your Car Is On Its Way Home!';
      case PostBookingStage.carBackHome:
        return 'Your Car Is Back Home!';
    }
  }

  String? _normalizeTrackingCodeFromDetail(dynamic v) {
    if (v == null) return null;
    final s = '$v'.trim();
    if (s.isEmpty) return null;
    final upper = s.toUpperCase();
    if (BookingTrackingStatus.isKnownCode(upper)) return upper;
    return s;
  }

  void _startCustomerLiveSocketWatchdog() {
    _customerLiveSocketWatchdog?.cancel();
    _customerLiveTrackingStartedAt ??= DateTime.now();
    _customerLiveSocketWatchdog = Timer.periodic(
      _customerLiveSocketHealthInterval,
      (_) => unawaited(_recoverCustomerLiveSocketIfNeeded()),
    );
  }

  Future<void> _recoverCustomerLiveSocketIfNeeded({bool force = false}) async {
    if (!Prefs().isCustomerRole || !_customerLiveTracking) return;
    if (_customerLiveReconnectInFlight) return;
    final bookingId = _activeCustomerLiveTrackingBookingId;
    if (bookingId == null || bookingId <= 0) return;
    if (!Get.isRegistered<BookingLiveSocketService>()) return;

    final socket = Get.find<BookingLiveSocketService>();
    final now = DateTime.now();
    final lastFeedAt =
        customerLiveLastGpsAt.value ?? _customerLiveTrackingStartedAt ?? now;
    final feedIsStale =
        now.difference(lastFeedAt) >= _customerLiveGpsStaleAfter;
    final socketIsBroken =
        socket.activeBookingId != bookingId || !socket.isConnected.value;
    if (!force && !feedIsStale && !socketIsBroken) return;

    final lastAttempt = _customerLiveLastReconnectAt;
    if (lastAttempt != null &&
        now.difference(lastAttempt) < _customerLiveReconnectThrottle) {
      return;
    }

    _customerLiveReconnectInFlight = true;
    _customerLiveLastReconnectAt = now;
    try {
      Alert.log(
        'CustomerLiveTracking',
        'recover socket booking=$bookingId stale=$feedIsStale connected=${socket.isConnected.value}',
      );
      await socket.connectForBooking(bookingId, forceReconnect: true);
      _customerLiveRoutePendingRedraw = true;
      if (mapbox != null) {
        unawaited(_refreshCustomerLiveRouteIfPossible());
      }
    } finally {
      _customerLiveReconnectInFlight = false;
    }
  }

  /// **Customer:** subscribe to driver GPS + status for [bookingId] (call when an active trip is shown).
  ///
  /// Optional [pushTrackingCode] / message / driver fields seed the UI immediately from a
  /// `TRACKING_UPDATE` push before the next socket event arrives.
  Future<void> startCustomerLiveTracking(
    int bookingId, {
    String? pushTrackingCode,
    String? pushTrackingMessage,
    String? pushPickupOtp,
    String? pushDriverName,
    String? pushDriverAvatarUrl,
  }) async {
    if (bookingId <= 0) return;
    if (!Prefs().isCustomerRole) return;
    if (!Get.isRegistered<BookingLiveSocketService>()) return;

    final endedId = int.tryParse(
      Prefs().getData(_customerTripEndedBookingIdKey).trim(),
    );
    if (endedId != null && endedId == bookingId) {
      await _clearCustomerTripAfterBookingEnded(endedBookingId: bookingId);
      return;
    }
    _clearCustomerTripEndedMarker();

    _bookingCancelledHandledId = null;
    final socket = Get.find<BookingLiveSocketService>();
    final alreadyTrackingSameBooking =
        _customerLiveTracking &&
        socket.activeBookingId == bookingId &&
        _customerLocationSub != null &&
        _customerBookingStatusSub != null &&
        _customerBookingTrackingSub != null;
    if (alreadyTrackingSameBooking) {
      if (!Prefs().isDriverRole &&
          !await _customerMayJoinLiveBooking(
            bookingId,
            hintTrackingCode: pushTrackingCode,
          )) {
        await _clearCustomerTripAfterBookingEnded(endedBookingId: bookingId);
      } else {
        await _recoverCustomerLiveSocketIfNeeded(
          force: !socket.isConnected.value,
        );
      }
      return;
    }

    final pushCode = (pushTrackingCode ?? '').trim().toUpperCase();
    if (pushCode.isNotEmpty &&
        !BookingTrackingStatus.isEligibleForLiveSocketJoin(pushCode)) {
      if (BookingTrackingStatus.isVehicleDelivered(pushCode)) {
        await _handleCustomerVehicleDelivered(bookingId);
      } else {
        await _clearCustomerTripAfterBookingEnded(endedBookingId: bookingId);
      }
      return;
    }

    if (!Prefs().isDriverRole &&
        !await _customerMayJoinLiveBooking(
          bookingId,
          hintTrackingCode: pushTrackingCode,
        )) {
      await fetchServiceDetail(bookingId: bookingId, force: true);
      if (_customerTripAwaitingDeliveryInspection(
        trackingCode: pushCode,
        detail: serviceDetail.value,
      )) {
        await _handleCustomerVehicleDelivered(bookingId);
      } else if (_customerHasActiveTripContext(bookingId) &&
          _customerLiveSessionShouldEnd(serviceDetail.value)) {
        await _clearCustomerTripAfterBookingEnded(endedBookingId: bookingId);
      } else {
        _customerLiveTracking = false;
        _activeCustomerLiveTrackingBookingId = null;
      }
      return;
    }

    final stashedOtp = (customerVehiclePickupOtp.value ?? '').trim();
    final stashedOtpBookingId =
        postBookingApiId.value ?? _activeCustomerLiveTrackingBookingId;
    await stopCustomerLiveTracking();

    _activeCustomerLiveTrackingBookingId = bookingId;
    _customerLiveCameraFitted = false;
    _customerLiveCameraPausedUntil = null;
    _customerLiveCameraUpdatePending = false;
    _customerLiveForceFollowPending = false;
    _lastCustomerLiveCameraLat = null;
    _lastCustomerLiveCameraLng = null;
    _customerLiveRouteLegKey = null;
    _customerLiveFullRouteCoords = null;
    _customerLiveRouteTrimAnchorSeg = 0;
    customerLiveEtaArrivalAt.value = null;
    customerLiveLastGpsAt.value = null;
    customerLiveLastStatusAt.value = null;
    _customerLiveEtaRouteRequestGeneration++;
    _ensureCustomerLiveEtaTicker();
    _customerLiveTracking = true;
    _customerLiveTrackingStartedAt = DateTime.now();
    _customerLiveLastReconnectAt = null;

    if (!Prefs().isDriverRole) {
      await fetchServiceDetail(bookingId: bookingId, force: true);
      if (_customerLiveSessionShouldEnd(serviceDetail.value)) {
        await _clearCustomerTripAfterBookingEnded(endedBookingId: bookingId);
        return;
      }
      final detailCode = BookingTrackingStatus.normalizeTrackingCode(
        serviceDetail.value?.trackingStatus,
      );
      if (!BookingTrackingStatus.shouldShowCustomerTripPanel(
        detailCode,
        bookingStatus: serviceDetail.value?.status?.toString(),
      )) {
        _customerLiveTracking = false;
        _activeCustomerLiveTrackingBookingId = null;
        return;
      }
      if ((customerVehiclePickupOtp.value ?? '').trim().isEmpty) {
        _restoreCustomerPickupOtpForBooking(
          bookingId,
          pickupOtp: pushPickupOtp,
        );
        if ((customerVehiclePickupOtp.value ?? '').trim().isEmpty &&
            stashedOtp.isNotEmpty &&
            stashedOtpBookingId == bookingId) {
          _setCustomerVehiclePickupOtp(stashedOtp, bookingId: bookingId);
        }
      }
    }

    customerTripPanelEnabled.value = true;
    await socket.connectForBooking(bookingId);
    bindBookingTimerListener();

    if (Prefs().isCustomerRole) {
      postBookingApiId.value = bookingId;
      if (postBookingStartedAt.value == null) {
        postBookingStartedAt.value = DateTime.now();
      }
      postBookingStage.value = PostBookingStage.providerEnRoutePickup;
    }

    _customerLocationSub = socket.onDriverLocation.listen((e) {
      if (e.bookingId != null && e.bookingId != bookingId) return;
      if (!e.hasCoordinates) return;
      if (Prefs().isCustomerRole) {
        unawaited(_onCustomerDriverLocationUpdate(e, bookingId));
      } else {
        driverLiveLat.value = e.latitude;
        driverLiveLng.value = e.longitude;
      }
    });
    _customerBookingTrackingSub = socket.onBookingTrackingUpdate.listen((e) {
      if (e.bookingId != null && e.bookingId != bookingId) return;
      if (e.trackingStatus.trim().isEmpty) return;
      _applyBookingTrackingSocketEvent(e, joinedBookingId: bookingId);
    });
    _customerBookingStatusSub = socket.onBookingStatusUpdate.listen((e) {
      if (e.bookingId != null && e.bookingId != bookingId) return;
      final st = e.status.trim();
      if (st.isEmpty) return;
      customerSocketBookingStatusRaw.value = st;
      if (_isCancelledBookingStatus(st)) {
        unawaited(_handleBookingCancelled(bookingId));
        return;
      }
      _applyCustomerBookingStatusSocketEvent(e);
      _handleCustomerBookingSocketSideEffects(e, bookingId);
    });

    if (Prefs().isCustomerRole) {
      final code = (pushTrackingCode ?? '').trim().toUpperCase();
      if (code.isNotEmpty) {
        final msg = (pushTrackingMessage ?? '').trim();
        final dn = (pushDriverName ?? '').trim();
        final av = (pushDriverAvatarUrl ?? '').trim();
        _applyBookingTrackingSocketEvent(
          BookingTrackingSocketEvent(
            bookingId: bookingId,
            trackingStatus: code,
            serverMessage: msg.isEmpty ? null : msg,
            pickupOtp: pushPickupOtp,
            driverName: dn.isEmpty ? null : dn,
            driverProfilePictureUrl: av.isEmpty ? null : av,
            raw: const <String, dynamic>{},
          ),
          joinedBookingId: bookingId,
        );
      }
    }

    _customerTrackingPollTimer?.cancel();
    _customerTrackingPollTimer = Timer.periodic(const Duration(seconds: 30), (
      _,
    ) {
      if (!_customerLiveTracking) return;
      final id = _activeCustomerLiveTrackingBookingId;
      if (id != null && id > 0) {
        unawaited(fetchServiceDetail(bookingId: id, force: true));
      }
    });
    _startCustomerLiveSocketWatchdog();

    if (Prefs().isCustomerRole) {
      _persistCustomerLiveSession(bookingId: bookingId);
      await _disposeCustomerLiveMapAnnotations();
      _customerLiveDriverPinManager = null;
      _customerLiveCustomerProfilePinManager = null;
      _customerLiveDestinationPinManager = null;
      _customerLiveRouteManager = null;
      await _refreshMapLocationPuck();
      await _syncCustomerLiveTrackingMapAnnotations(bookingId);
    }
  }

  /// Stops socket listeners and clears last known live values.
  Future<void> stopCustomerLiveTracking() async {
    _stopCustomerLiveEtaTicker();
    _customerLiveSocketWatchdog?.cancel();
    _customerLiveSocketWatchdog = null;
    _customerLiveReconnectInFlight = false;
    _customerLiveTrackingStartedAt = null;
    _customerLiveLastReconnectAt = null;
    _customerTrackingPollTimer?.cancel();
    _customerTrackingPollTimer = null;
    await _customerLocationSub?.cancel();
    await _customerBookingStatusSub?.cancel();
    await _customerBookingTrackingSub?.cancel();
    _customerLocationSub = null;
    _customerBookingStatusSub = null;
    _customerBookingTrackingSub = null;
    _activeCustomerLiveTrackingBookingId = null;
    _customerLiveCameraFitted = false;
    _customerLiveCameraPausedUntil = null;
    _customerLiveCameraUpdatePending = false;
    _customerLiveForceFollowPending = false;
    _lastCustomerLiveCameraLat = null;
    _lastCustomerLiveCameraLng = null;
    _cachedCustomerLiveCustomerProfileMarkerBytes = null;
    _cachedCustomerLiveCustomerProfileAvatarUrl = '';
    _lastCustomerLiveRouteAt = null;
    _lastCustomerLiveRouteDriverLat = null;
    _lastCustomerLiveRouteDriverLng = null;
    _customerLiveFullRouteCoords = null;
    _customerLiveRouteTrimAnchorSeg = 0;
    _customerLiveRouteLegKey = null;
    _customerLiveRoutePendingRedraw = false;
    customerLiveEtaArrivalAt.value = null;
    customerLiveLastGpsAt.value = null;
    customerLiveLastStatusAt.value = null;
    customerLiveEtaTick.value = 0;
    _customerLiveEtaRouteRequestGeneration++;
    await _clearCustomerLiveTrackingPins();
    final liveSocket = Get.isRegistered<BookingLiveSocketService>()
        ? Get.find<BookingLiveSocketService>()
        : null;
    final shouldDisconnectSocket =
        _customerLiveTracking ||
        (Prefs().isCustomerRole && (liveSocket?.activeBookingId ?? 0) > 0);
    if (shouldDisconnectSocket && liveSocket != null) {
      await liveSocket.disconnect();
    }
    _customerLiveTracking = false;
    if (Prefs().isCustomerRole) {
      unawaited(_refreshMapLocationPuck());
    }
    driverLiveLat.value = null;
    driverLiveLng.value = null;
    driverLiveStatus.value = null;
    customerSocketTrackingCode.value = null;
    customerSocketBookingStatusRaw.value = null;
    customerVehiclePickupOtpHint.value = null;
    customerTrackingUpdateMessage.value = null;
    customerSocketDriverName.value = null;
    customerSocketDriverAvatarUrl.value = null;
    customerSocketDriverPhone.value = null;
    customerSocketDriverRating.value = null;
    unawaited(unbindBookingTimerListener());
  }

  @override
  void onClose() {
    WidgetsBinding.instance.removeObserver(this);
    unawaited(unbindBookingTimerListener());
    unawaited(unbindDriverBookingStatusListener());
    unawaited(unbindCustomerDashboardBookingListeners());
    unawaited(_driverNewBookingSocketSub?.cancel());
    _driverNewBookingSocketSub = null;
    unawaited(_mapResumeEventSub?.cancel());
    _mapResumeEventSub = null;
    _customerHomeResumeWorker?.dispose();
    if (Get.isRegistered<DriverDashboardSocketService>()) {
      unawaited(Get.find<DriverDashboardSocketService>().disconnect());
    }
    if (Get.isRegistered<CustomerDashboardSocketService>()) {
      unawaited(Get.find<CustomerDashboardSocketService>().disconnect());
    }
    unawaited(stopCustomerLiveTracking());
    _greetingTimer?.cancel();
    _postBookingTimer?.cancel();
    _driverPickupArrivalTimer?.cancel();
    _driverLocationApiHeartbeat?.cancel();
    _stopDriverLivePositionStream();
    if (Get.isRegistered<BookingLiveSocketService>()) {
      Get.find<BookingLiveSocketService>().stopDriverLocationHeartbeat();
    }
    _driverManualServiceLocationDebounce?.cancel();
    driverAlternateServiceLocationReasonController.dispose();
    driverManualServiceLocationController.dispose();
    _driverHomeNavNearbyWorker?.dispose();
    _driverHomeRecenterWorker?.dispose();
    super.onClose();
  }
}
