import 'dart:async';

import 'package:car_comfort/app/utils/extensions/extension.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:get/get.dart';

import '../../utils/app_snackbar.dart';
import '../../utils/custom_loader.dart';
import '../../utils/ev_account_card_on_file.dart';
import '../../network/response/booking_review_response.dart' as br;
import '../../network/response/packages_response.dart' as pkg;
import '../../routes/app_pages.dart';
import '../../widgets/button.dart';
import '../../widgets/text.dart';
import '../../utils/driver_job_duration.dart';
import '../../utils/pref.dart';
import '../../utils/permission_utils.dart';
import '../../utils/validator.dart';
import '../../utils/vehicle_colors.dart';
import '../../widgets/vehicle_make_model_fields.dart';
import '../../widgets/widgets.dart';
import '../dashboard/dashboard_controller.dart';
import '../settings/payment_methods_binding.dart';
import '../settings/payment_methods_controller.dart';
import '../../constants/ev_charging_booking_options.dart';
import '../../constants/booking_service_notes.dart';
import '../../models/vehicle_model.dart';
import '../../network/repository/vehicle_repository.dart';
import 'package:dio/dio.dart' as dio;
import 'models/mapbox_place_model.dart';
import 'services/mapbox_search_service.dart';
import '../../utils/media_url.dart';
import '../../utils/web_navigation.dart';
import 'service_booking_pending_args.dart';

/// One row in the CarComfort price summary block on review.
class ReviewPriceSummaryLine {
  const ReviewPriceSummaryLine({
    required this.label,
    required this.valueText,
    this.labelColor,
    this.isSectionHeader = false,
    this.isSubtotal = false,
  });

  final String label;
  final String valueText;
  final Color? labelColor;
  final bool isSectionHeader;
  final bool isSubtotal;
}

enum BookingPickupInputMode { none, gps, manual }

enum BookingServiceLocationInputMode { none, dropdown, manual }

/// Car wash, EV charging, and combined (wash + charge) booking flows.
class ServiceBookingController extends GetxController
    with VehicleMakeModelMixin {
  static const Color brandRed = Color(0xffC4101F);
  static const String addNewVehicleOptionLabel = 'Add new vehicle...';

  final _vehicleRepo = VehicleRepository();
  final myVehicles = <VehicleModel>[].obs;
  final isLoadingVehicles = false.obs;
  final isLoading = false.obs;

  final currentStep = 0.obs;

  /// From dashboard: `Car Wash` | `EV Charging` | `Car Wash + EV Charging`, etc.
  final selectedServiceLabel = 'Car Wash'.obs;
  final _mapboxSearchService = MapboxSearchService();
  final nearbyPlaces = <MapboxPlaceModel>[].obs;
  final isSearchingNearbyPlaces = false.obs;
  final nearbySearchError = RxnString();
  final manualAddressSuggestions = <MapboxPlaceModel>[].obs;
  final isSearchingManualAddress = false.obs;
  final manualAddressError = RxnString();
  final serviceLocationSuggestions = <MapboxPlaceModel>[].obs;
  final isSearchingServiceLocation = false.obs;
  final serviceLocationError = RxnString();
  Timer? _manualAddressDebounce;
  Timer? _serviceLocationDebounce;
  Timer? _evBatteryChargeLimitSyncDebounce;
  double? _selectedLatitude;
  double? _selectedLongitude;

  String get _normalizedServiceLabel {
    return selectedServiceLabel.value
        .trim()
        .toLowerCase()
        .replaceAll('_', ' ')
        .replaceAll('-', ' ')
        .replaceAll('&', ' and ')
        .replaceAll(RegExp(r'\s+'), ' ');
  }

  String get _displayServiceLabel {
    return selectedServiceLabel.value
        .trim()
        .replaceAll('_', ' ')
        .replaceAll('-', ' ')
        .replaceAll('&', ' and ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .toTitleCase();
  }

  bool _isAddNewVehicleOption(String? value) {
    final normalized = (value ?? '').trim().toLowerCase().replaceAll(
      '…',
      '...',
    );
    return normalized == addNewVehicleOptionLabel.toLowerCase();
  }

  String? _labelForVehicleId(int? id) {
    if (id == null) return null;
    for (final entry in _vehicleLabelToId.entries) {
      if (entry.value == id) return entry.key;
    }
    return null;
  }

  bool get _looksLikeComboService {
    final t = _normalizedServiceLabel;
    if (t.contains('combo')) return true;
    final hasCarWash = t.contains('car wash') || t == 'carwash';
    final hasEv = t.contains('ev charging') || t == 'ev';
    return hasCarWash && hasEv;
  }

  bool get _looksLikeEvOnlyService {
    final t = _normalizedServiceLabel;

    final hasCarWash = t.contains('car wash') || t == 'carwash';
    final hasEv = t.contains('ev charging') || t == 'ev';
    return hasEv && !hasCarWash && !t.contains('combo');
  }

  /// Both car wash and EV in one booking (dashboard opens with `Car Wash + EV Charging`, etc.).
  bool get isCombinedServiceFlow {
    return _looksLikeComboService;
  }

  /// Pure EV flow (not combined with car wash on the same booking screen).
  bool get isEvChargingFlow {
    return _looksLikeEvOnlyService;
  }

  /// Battery status applies to EV-only and combo bookings.
  bool get requiresEvBatteryOnVehicleStep =>
      isEvChargingFlow || isCombinedServiceFlow;

  /// Car wash + combo wash steps list car-wash packages (Basic, Deluxe, etc.).
  String? get _packageServiceQuery {
    if (isEvChargingFlow) return null;
    return 'car_wash';
  }

  /// Internal pages: combined uses 5 (location → wash package → charge → vehicle → review).
  /// Driver route order is charge first, then wash.
  int get flowStepCount => isCombinedServiceFlow ? 5 : 4;

  /// The horizontal stepper always shows 4 slots; combined maps wash + charge onto visual step 1.
  static const int stepperSlotCount = 4;

  bool get isScheduleAsap => selectedScheduleType.value == scheduleTypeAsap;
  bool get isScheduleScheduled =>
      selectedScheduleType.value == scheduleTypeScheduled;

  /// Display-only warning state; booking classification remains unchanged.
  bool get isSelectedScheduleWithin24Hours {
    final date = scheduledServiceDate.value;
    final time = scheduledServiceTime.value;
    if (date == null || time == null) return false;
    final scheduledAt = DateTime(
      date.year,
      date.month,
      date.day,
      time.hour,
      time.minute,
    );
    final timeUntil = scheduledAt.difference(DateTime.now());
    return !timeUntil.isNegative && timeUntil <= const Duration(hours: 24);
  }

  void setScheduleType(String type) {
    selectedScheduleType.value = type;
    notifyCanProceedChanged();
  }

  void setScheduledServiceDate(DateTime? date) {
    scheduledServiceDate.value = date;
    final formatted = date == null ? '' : formatUsDate(date);
    if (scheduledServiceDateController.text != formatted) {
      scheduledServiceDateController.text = formatted;
    }
    notifyCanProceedChanged();
  }

  void setScheduledServiceTime(TimeOfDay? time) {
    scheduledServiceTime.value = time;
    notifyCanProceedChanged();
  }

  /// Visual index for [ServiceBookingStepper] (0…3). Combined: internal 1 and 2 → 1.
  int get stepperVisualStep {
    if (!isCombinedServiceFlow) return currentStep.value;
    const map = [0, 1, 1, 2, 3];
    return map[currentStep.value.clamp(0, 4)];
  }

  List<String> get stepperLabels {
    if (isCombinedServiceFlow) {
      return ['Location', 'Service', 'Vehicle', 'Review'];
    }
    if (isEvChargingFlow) {
      return ['Location', 'Charging', 'Vehicle', 'Review'];
    }
    return ['Location', 'Service', 'Vehicle', 'Review'];
  }

  // —— Step 0: Location (car wash) ——
  final customerLocationController = TextEditingController();
  final manualAddressController = TextEditingController();
  final serviceLocationController = TextEditingController();
  final carWashOptions = <String>[].obs;
  final carWashPlaces = <MapboxPlaceModel>[].obs;
  final selectedCarWash = RxnString();
  final carWashLocationDropdownRenderVersion = 0.obs;
  final selectedCarWashAddress = RxnString();
  final selectedCarWashLocationName = RxnString();
  final selectedCarWashLatitude = RxnDouble();
  final selectedCarWashLongitude = RxnDouble();
  final selectedCarWashPlaceId = RxnString();
  final selectedCarWashWebsiteUrl = RxnString();
  final isLoadingCarWashWebsiteUrl = false.obs;
  final hasUserSelectedCarWashLocation = false.obs;

  // —— Step 0: EV —— charging type at location step ——
  final chargingTypeOptions = <String>['Tesla Supercharger', 'DC Fast Charger'];
  final selectedChargingType = RxnString();
  final evAccountCardOnFile = RxnBool();

  // —— Step 1: Service (car wash) ——
  final packageNameController = TextEditingController();
  final packagePriceController = TextEditingController();
  final comfortPackages = <String>[].obs;
  final selectedComfortPackage = RxnString();
  final packageItems = <pkg.Data>[].obs;
  final isLoadingPackages = false.obs;
  final Map<String, int> _packageLabelToId = {};

  /// True when the customer already has a car wash membership (Preferred Package, $0 wash cost).
  final hasMembershipWash = false.obs;

  /// Text entered by the customer for their car wash membership information.
  final membershipTextController = TextEditingController();

  /// True when the customer explicitly does NOT have a car wash membership.
  final noMembershipWash = false.obs;

  /// Text entered by the customer when they explicitly do NOT have a car wash membership.
  final noMembershipDetailsController = TextEditingController();

  static const String membershipPackageName = 'Custom Package';
  static const scheduleTypeAsap = 'asap';
  static const scheduleTypeScheduled = 'scheduled';
  final selectedScheduleType = scheduleTypeAsap.obs;
  final Rxn<DateTime> scheduledServiceDate = Rxn<DateTime>();
  final scheduledServiceDateController = TextEditingController();
  final Rxn<TimeOfDay> scheduledServiceTime = Rxn<TimeOfDay>();

  // —— Step 1: EV charging station ——
  final evStations = <EvStationInfo>[].obs;
  final selectedEvStationIndex = 0.obs;
  final selectedEvStationAddress = RxnString();
  final selectedEvChargingLocationName = RxnString();
  final selectedEvStationLatitude = RxnDouble();
  final selectedEvStationLongitude = RxnDouble();
  final evChargingPlaces = <MapboxPlaceModel>[].obs;
  final selectedEvChargingWebsiteUrl = RxnString();
  final isLoadingEvChargingWebsiteUrl = false.obs;
  final hasUserSelectedEvChargingLocation = false.obs;
  final evChargingLocationController = TextEditingController();
  final evChargingLocationSuggestions = <MapboxPlaceModel>[].obs;
  final isSearchingEvChargingLocation = false.obs;
  final evChargingLocationError = RxnString();
  final hasEvChargingLocationText = false.obs;
  final evChargingLocationInputMode = BookingServiceLocationInputMode.none.obs;
  Timer? _evChargingLocationDebounce;

  bool get isEvChargingLocationDropdownSelected =>
      evChargingLocationInputMode.value ==
          BookingServiceLocationInputMode.dropdown &&
      _hasSelectedEvStationCoords;

  bool get isEvChargingLocationManualSelected =>
      evChargingLocationInputMode.value ==
          BookingServiceLocationInputMode.manual &&
      hasEvChargingLocationText.value;

  // —— Step 2: Vehicle (car wash) ——
  final vehicleOptions = <String>[
    '2019 Mercedes-Benz C-Class',
    '2021 Toyota Camry',
    addNewVehicleOptionLabel,
  ];
  final evVehicleOptions = <String>[
    '2023 Tesla Model Y',
    '2022 Tesla Model 3',
    addNewVehicleOptionLabel,
  ];
  final selectedVehicle = RxnString();
  final selectedVehicleId = RxnInt();
  final vehicleDropdownRenderVersion = 0.obs;
  final vehicleStepFormKey = GlobalKey<FormState>();
  final vehicleStepAutoValidate = false.obs;
  final parkingNotesController = TextEditingController();
  final otherNotesVehicleController = TextEditingController();
  final selectedVehicleParkedLocation = RxnString();
  final selectedProviderParkLocation = RxnString();
  final selectedVehicleKeyLocation = RxnString();
  final selectedKeyReturnLocation = RxnString();
  final vehicleParkedLocationOtherController = TextEditingController();
  final providerParkLocationOtherController = TextEditingController();
  final vehicleKeyLocationOtherController = TextEditingController();
  final keyReturnLocationOtherController = TextEditingController();
  final hasManualAddressText = false.obs;
  final hasCustomerLocationText = false.obs;
  final hasServiceLocationText = false.obs;
  final pickupInputMode = BookingPickupInputMode.none.obs;
  final serviceLocationInputMode = BookingServiceLocationInputMode.none.obs;

  bool get isPickupGpsSelected =>
      pickupInputMode.value == BookingPickupInputMode.gps &&
      hasCustomerLocationText.value;

  bool get isPickupManualSelected =>
      pickupInputMode.value == BookingPickupInputMode.manual &&
      hasManualAddressText.value;

  bool get isServiceLocationDropdownSelected =>
      serviceLocationInputMode.value ==
          BookingServiceLocationInputMode.dropdown &&
      (selectedCarWash.value ?? '').trim().isNotEmpty;

  bool get isServiceLocationManualSelected =>
      serviceLocationInputMode.value ==
          BookingServiceLocationInputMode.manual &&
      hasServiceLocationText.value;

  /// Label → vehicle id mapping for dropdown choices built from [myVehicles].
  final Map<String, int> _vehicleLabelToId = {};

  /// Local path from [pickPicture] after user picks in vehicle step (car wash / EV).
  /// Multiple photos selected on the "Vehicle Details" step (car wash / combined).
  ///
  /// Stores local file paths and uploaded URLs for display on the vehicle step.
  final vehiclePhotoPaths = <String>[].obs;
  final _removedVehiclePhotoUrls = <String>{};

  // —— Step 2: EV vehicle ——
  final evBatteryStatusOptions =
      EvChargingBookingOptions.defaultBatteryStatusLabels().obs;
  final evChargeLimitOptions =
      EvChargingBookingOptions.vehicleChargeLimitLabels().obs;

  final selectedEvChargeLimit = RxnString();
  final selectedEvBatteryStatus = RxnString();
  final evBatteryStatusController = TextEditingController();
  final evPickupNotesController = TextEditingController();
  final evLicensePlateController = TextEditingController();
  final evParkedAtController = TextEditingController();
  final evVehicleType = RxnString();

  // —— Add vehicle (sub-screen) ——
  final vehicleNicknameController = TextEditingController();
  final vehiclePlateController = TextEditingController();
  final vehicleCustomColorController = TextEditingController();
  final vehicleNotesController = TextEditingController();
  final years = List.generate(35, (i) => '${DateTime.now().year - i}');
  List<String> get colors => VehicleColors.pickerOptions;
  final types = ['Sedan', 'SUV', 'Truck', 'Coupe', 'Van'];
  final selectedYear = RxnString();
  final selectedColor = RxnString();
  final selectedType = RxnString();

  // —— Step 3: Review / pricing (car wash) ——
  final subtotal = 65.0.obs;
  final serviceFee = 5.0.obs;

  // —— Step 3: Review / pricing (EV) ——
  final evServiceFee = 45.0.obs;
  final evChargingCost = 18.50.obs;
  final evServiceCharge = 5.35.obs;

  final bookingCode = 'CC12345'.obs;
  final bookingApiId = RxnInt();
  final hasStartedBooking = false.obs;
  final serviceId = RxnInt();
  final serviceLocationId = '1'.obs;
  final selectedLatitude = RxnDouble();
  final selectedLongitude = RxnDouble();

  /// Incremented when TextEditingController values change so [canProceed] can
  /// re-evaluate inside Obx (controllers are not reactive on their own).
  final reviewRevision = 0.obs;

  void notifyCanProceedChanged() => reviewRevision.value++;
  final confirmedTotalPrice = RxnDouble();

  /// From last successful [bookingConfirm] — human-readable booking id (e.g. `#CC-CW-…`).
  String? _confirmedBookingIdDisplay;

  /// From last successful [bookingConfirm] — e.g. `Car Wash`.
  String? _confirmedServiceTypeLabel;

  /// Server-calculated booking review (GET `/bookings/{id}/review`).
  final bookingReviewData = Rxn<br.Data>();

  List<String> get activeVehicleOptions =>
      (isEvChargingFlow || isCombinedServiceFlow)
      ? evVehicleOptions
      : vehicleOptions;

  EvStationInfo? get selectedEvStationOrNull {
    if (evStations.isEmpty) return null;
    final idx = selectedEvStationIndex.value.clamp(0, evStations.length - 1);
    return evStations[idx];
  }

  EvStationInfo get selectedEvStation =>
      selectedEvStationOrNull ?? const EvStationInfo.fallback();

  MapboxSearchCondition get mapboxSearchCondition {
    if (isCombinedServiceFlow) return MapboxSearchCondition.both;
    if (isEvChargingFlow) return MapboxSearchCondition.evCharging;
    return MapboxSearchCondition.carWash;
  }

  @override
  void onInit() {
    super.onInit();
    // Reset photo state at the start of every new booking flow so that photos
    // from a previous session (if the controller was somehow retained) are
    // never shown in the current flow.
    vehiclePhotoPaths.clear();
    _removedVehiclePhotoUrls.clear();
    bookingApiId.value = null;
    bookingReviewData.value = null;
    _fetchVehicles();
    loadVehicleCatalog();
    final args = Get.arguments;
    final params = Get.parameters;

    String? serviceParam;
    int? serviceIdParam;
    String? serviceLocIdParam;
    double? latParam;
    double? lngParam;

    // ── Priority 1: static holder set by DashboardController just before navigation.
    // Most reliable on web where Get.rootDelegate ignores arguments.
    final pending = ServiceBookingPendingArgs.consume();
    if (pending.label != null) {
      serviceParam = pending.label;
      serviceIdParam = pending.id;
    }

    // ── Priority 2: Get.arguments (works on mobile)
    if (serviceParam == null && args is Map) {
      if (args['service'] is String) serviceParam = args['service'] as String;
      if (args['service_id'] is int) serviceIdParam = args['service_id'] as int;
      final argServiceLoc = args['service_location_id'];
      if (argServiceLoc != null) serviceLocIdParam = argServiceLoc.toString();
      latParam = _asDouble(args['latitude']);
      lngParam = _asDouble(args['longitude']);
    } else if (args is Map) {
      final argServiceLoc = args['service_location_id'];
      if (argServiceLoc != null) serviceLocIdParam = argServiceLoc.toString();
      latParam = _asDouble(args['latitude']);
      lngParam = _asDouble(args['longitude']);
    }

    // ── Priority 3: Get.parameters (query string, sometimes populated on web)
    if (params.isNotEmpty) {
      if (serviceParam == null && params['service'] != null) {
        serviceParam = Uri.decodeQueryComponent(params['service']!);
      }
      if (serviceIdParam == null && params['service_id'] != null) {
        serviceIdParam = int.tryParse(params['service_id']!);
      }
      if (serviceLocIdParam == null && params['service_location_id'] != null) {
        serviceLocIdParam = params['service_location_id'];
      }
      if (latParam == null && params['latitude'] != null) {
        latParam = double.tryParse(params['latitude']!);
      }
      if (lngParam == null && params['longitude'] != null) {
        lngParam = double.tryParse(params['longitude']!);
      }
    }

    // ── Priority 4: Read directly from browser URL (web fallback)
    if (kIsWeb) {
      try {
        final qp = Uri.base.queryParameters;
        if (serviceParam == null && qp.containsKey('service')) {
          serviceParam = qp['service'];
        }
        if (serviceIdParam == null && qp.containsKey('service_id')) {
          serviceIdParam = int.tryParse(qp['service_id']!);
        }
        if (serviceLocIdParam == null &&
            qp.containsKey('service_location_id')) {
          serviceLocIdParam = qp['service_location_id'];
        }
        if (latParam == null && qp.containsKey('latitude')) {
          latParam = double.tryParse(qp['latitude']!);
        }
        if (lngParam == null && qp.containsKey('longitude')) {
          lngParam = double.tryParse(qp['longitude']!);
        }
      } catch (_) {
        // Uri.base not available on native — safe to ignore.
      }
    }

    if (serviceParam != null) {
      selectedServiceLabel.value = serviceParam;
    }
    if (serviceIdParam != null) {
      serviceId.value = serviceIdParam;
    }
    if (serviceLocIdParam != null && serviceLocIdParam.trim().isNotEmpty) {
      serviceLocationId.value = serviceLocIdParam.trim();
    }
    if (latParam != null) selectedLatitude.value = latParam;
    if (lngParam != null) selectedLongitude.value = lngParam;

    selectedCarWash.value = null;
    hasMembershipWash.value = false;
    noMembershipWash.value = false;
    membershipTextController.clear();
    selectedComfortPackage.value = null;
    packageNameController.clear();
    packagePriceController.clear();
    evAccountCardOnFile.value = null;
    _fetchPackagesForSelectedService();
    selectedChargingType.value = chargingTypeOptions.first;
    _seedEvBatteryDropdownDefaults();
    unawaited(_loadEvChargingBookingOptions());
    evVehicleType.value = isEvChargingFlow ? 'BEV' : 'SUV';
    // Leave null so the date picker opens with valid [firstDate, lastDate] range.
    scheduledServiceDate.value = null;
    scheduledServiceTime.value = null;
    scheduledServiceDateController.clear();
    pickupInputMode.value = BookingPickupInputMode.none;
    serviceLocationInputMode.value = BookingServiceLocationInputMode.none;
    evChargingLocationInputMode.value = BookingServiceLocationInputMode.none;

    if (isEvChargingFlow || isCombinedServiceFlow) {
      selectedVehicle.value = evVehicleOptions.first;
    } else {
      selectedVehicle.value = vehicleOptions.first;
    }

    void bump() => notifyCanProceedChanged();
    void syncCustomerLocationState() {
      hasCustomerLocationText.value = customerLocationController.text
          .trim()
          .isNotEmpty;
    }

    void syncManualAddressState() {
      hasManualAddressText.value = manualAddressController.text
          .trim()
          .isNotEmpty;
    }

    void syncServiceLocationState() {
      hasServiceLocationText.value = serviceLocationController.text
          .trim()
          .isNotEmpty;
    }

    void syncEvChargingLocationState() {
      hasEvChargingLocationText.value = evChargingLocationController.text
          .trim()
          .isNotEmpty;
    }

    customerLocationController.addListener(bump);
    customerLocationController.addListener(syncCustomerLocationState);
    manualAddressController.addListener(bump);
    manualAddressController.addListener(syncManualAddressState);
    serviceLocationController.addListener(bump);
    serviceLocationController.addListener(syncServiceLocationState);
    evChargingLocationController.addListener(bump);
    evChargingLocationController.addListener(syncEvChargingLocationState);
    syncCustomerLocationState();
    syncManualAddressState();
    syncServiceLocationState();
    parkingNotesController.addListener(bump);
    otherNotesVehicleController.addListener(bump);
    vehicleParkedLocationOtherController.addListener(bump);
    providerParkLocationOtherController.addListener(bump);
    vehicleKeyLocationOtherController.addListener(bump);
    keyReturnLocationOtherController.addListener(bump);
    otherNotesVehicleController.addListener(bump);
    packageNameController.addListener(bump);
    packagePriceController.addListener(bump);
    packageNameController.addListener(_onManualPackageInputForPresetClear);
    packagePriceController.addListener(_onManualPackageInputForPresetClear);
    evPickupNotesController.addListener(bump);
    evBatteryStatusController.addListener(bump);
    evLicensePlateController.addListener(bump);
    evParkedAtController.addListener(bump);
    scheduledServiceDateController.addListener(
      _syncScheduledServiceDateFromText,
    );
    syncManualAddressState();
    syncServiceLocationState();
    syncEvChargingLocationState();
  }

  @override
  void onReady() {
    super.onReady();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!isClosed) unawaited(pickCurrentLocationAndLoadNearby());
    });
  }

  void _seedEvBatteryDropdownDefaults() {
    const defaultBattery = EvChargingBookingOptions.defaultBatteryStatusLabel;
    const defaultChargeLimit = '50%';
    selectedEvBatteryStatus.value = defaultBattery;
    evBatteryStatusController.text = defaultBattery;
    selectedEvChargeLimit.value = defaultChargeLimit;
  }

  Future<void> _loadEvChargingBookingOptions() async {
    if (!isEvChargingFlow && !isCombinedServiceFlow) return;

    final result = await _vehicleRepo.getEvChargingBookingOptions();
    result.when(
      success: (data) {
        final batteryLabels = EvChargingBookingOptions.parseBatteryStatusLabels(
          data['battery_status_labels'] ?? data['battery_status_options'],
        );
        final chargeLimitLabels =
            EvChargingBookingOptions.parseVehicleChargeLimitLabels(
              data['vehicle_charge_limit_options'],
            );

        evBatteryStatusOptions
          ..clear()
          ..addAll(batteryLabels);
        evChargeLimitOptions
          ..clear()
          ..addAll(chargeLimitLabels);

        final selectedBattery = selectedEvBatteryStatus.value?.trim() ?? '';
        if (selectedBattery.isEmpty ||
            !evBatteryStatusOptions.contains(selectedBattery)) {
          final defaultLabel =
              EvChargingBookingOptions.resolveDefaultBatteryStatusLabel(
                apiData: data,
              );
          final fallback = evBatteryStatusOptions.contains(defaultLabel)
              ? defaultLabel
              : (evBatteryStatusOptions.isNotEmpty
                    ? evBatteryStatusOptions.first
                    : null);
          if (fallback != null) {
            selectedEvBatteryStatus.value = fallback;
            evBatteryStatusController.text = fallback;
          }
        }

        final selectedLimit = selectedEvChargeLimit.value?.trim() ?? '';
        if (selectedLimit.isEmpty ||
            !evChargeLimitOptions.contains(selectedLimit)) {
          final fallback = evChargeLimitOptions.contains('50%')
              ? '50%'
              : (evChargeLimitOptions.isNotEmpty
                    ? evChargeLimitOptions.first
                    : null);
          if (fallback != null) {
            selectedEvChargeLimit.value = fallback;
          }
        }

        reviewRevision.value++;
      },
      error: (_) {
        if (evBatteryStatusOptions.isEmpty) {
          evBatteryStatusOptions.assignAll(
            EvChargingBookingOptions.defaultBatteryStatusLabels(),
          );
        }
        if (evChargeLimitOptions.isEmpty) {
          evChargeLimitOptions.assignAll(
            EvChargingBookingOptions.vehicleChargeLimitLabels(),
          );
        }
      },
    );
  }

  void _syncScheduledServiceDateFromText() {
    final raw = scheduledServiceDateController.text.trim();
    if (raw.isEmpty) {
      if (scheduledServiceDate.value != null) {
        scheduledServiceDate.value = null;
        notifyCanProceedChanged();
      }
      return;
    }

    final parsed = parseUsDate(raw);
    if (parsed == null) {
      if (scheduledServiceDate.value != null) {
        scheduledServiceDate.value = null;
        notifyCanProceedChanged();
      }
      return;
    }

    final day = DateUtils.dateOnly(parsed);
    final today = DateUtils.dateOnly(DateTime.now());
    final lastSelectable = today.add(const Duration(days: 365));
    if (day.isBefore(today) || day.isAfter(lastSelectable)) {
      if (scheduledServiceDate.value != null) {
        scheduledServiceDate.value = null;
        notifyCanProceedChanged();
      }
      return;
    }

    if (scheduledServiceDate.value != day) {
      scheduledServiceDate.value = day;
      notifyCanProceedChanged();
    }
  }

  @override
  void onClose() {
    _manualAddressDebounce?.cancel();
    _serviceLocationDebounce?.cancel();
    _evChargingLocationDebounce?.cancel();
    _evBatteryChargeLimitSyncDebounce?.cancel();
    customerLocationController.dispose();
    manualAddressController.dispose();
    serviceLocationController.dispose();
    evChargingLocationController.dispose();
    packageNameController.dispose();
    packagePriceController.dispose();
    membershipTextController.dispose();
    noMembershipDetailsController.dispose();
    parkingNotesController.dispose();
    otherNotesVehicleController.dispose();
    vehicleParkedLocationOtherController.dispose();
    providerParkLocationOtherController.dispose();
    vehicleKeyLocationOtherController.dispose();
    keyReturnLocationOtherController.dispose();
    evPickupNotesController.dispose();
    evBatteryStatusController.dispose();
    evLicensePlateController.dispose();
    evParkedAtController.dispose();
    scheduledServiceDateController.dispose();
    disposeVehicleMakeModelFields();
    vehicleNicknameController.dispose();
    vehiclePlateController.dispose();
    vehicleCustomColorController.dispose();
    vehicleNotesController.dispose();
    super.onClose();
  }

  void _clearCarWashSelectionFields({bool keepOptions = true}) {
    selectedCarWash.value = null;
    selectedCarWashAddress.value = null;
    selectedCarWashLocationName.value = null;
    selectedCarWashLatitude.value = null;
    selectedCarWashLongitude.value = null;
    selectedCarWashPlaceId.value = null;
    selectedCarWashWebsiteUrl.value = null;
    hasUserSelectedCarWashLocation.value = false;
    if (!keepOptions) {
      carWashPlaces.clear();
      carWashOptions.clear();
    }
  }

  void clearManualPickupAddress() {
    manualAddressController.clear();
    manualAddressSuggestions.clear();
    manualAddressError.value = null;
    if (pickupInputMode.value == BookingPickupInputMode.manual) {
      pickupInputMode.value = BookingPickupInputMode.none;
      _selectedLatitude = null;
      _selectedLongitude = null;
      selectedLatitude.value = null;
      selectedLongitude.value = null;
    }
    reviewRevision.value++;
    notifyCanProceedChanged();
  }

  void clearCustomerPickupLocation() {
    customerLocationController.clear();
    if (pickupInputMode.value == BookingPickupInputMode.gps) {
      pickupInputMode.value = BookingPickupInputMode.none;
      _selectedLatitude = null;
      _selectedLongitude = null;
      selectedLatitude.value = null;
      selectedLongitude.value = null;
    }
    reviewRevision.value++;
    notifyCanProceedChanged();
  }

  void onManualAddressChanged(String value) {
    _manualAddressDebounce?.cancel();
    final query = value.trim();
    if (query.isEmpty) {
      manualAddressSuggestions.clear();
      manualAddressError.value = null;
      if (pickupInputMode.value == BookingPickupInputMode.manual) {
        pickupInputMode.value = BookingPickupInputMode.none;
      }
      return;
    }

    if (pickupInputMode.value == BookingPickupInputMode.gps) {
      customerLocationController.clear();
      pickupInputMode.value = BookingPickupInputMode.none;
    }

    if (query.length < 3) {
      manualAddressSuggestions.clear();
      manualAddressError.value = null;
      return;
    }

    _manualAddressDebounce = Timer(const Duration(milliseconds: 350), () async {
      isSearchingManualAddress.value = true;
      manualAddressError.value = null;
      try {
        final lat = selectedLatitude.value ?? _selectedLatitude;
        final lon = selectedLongitude.value ?? _selectedLongitude;
        final suggestions = await _mapboxSearchService.searchAddressSuggestions(
          query: query,
          latitude: lat,
          longitude: lon,
          limit: 5,
        );
        manualAddressSuggestions.assignAll(suggestions);
      } catch (e) {
        manualAddressSuggestions.clear();
        manualAddressError.value = '$e';
      } finally {
        isSearchingManualAddress.value = false;
      }
    });
  }

  void onServiceLocationChanged(String value) {
    _serviceLocationDebounce?.cancel();
    final query = value.trim();
    if (query.isEmpty) {
      serviceLocationSuggestions.clear();
      serviceLocationError.value = null;
      if (serviceLocationInputMode.value ==
          BookingServiceLocationInputMode.manual) {
        _clearCarWashSelectionFields(keepOptions: true);
        serviceLocationInputMode.value = BookingServiceLocationInputMode.none;
      }
      return;
    }

    if (serviceLocationInputMode.value ==
        BookingServiceLocationInputMode.dropdown) {
      _clearCarWashSelectionFields(keepOptions: true);
      serviceLocationInputMode.value = BookingServiceLocationInputMode.none;
    }

    if (query.length < 3) {
      serviceLocationSuggestions.clear();
      serviceLocationError.value = null;
      return;
    }

    _serviceLocationDebounce = Timer(
      const Duration(milliseconds: 350),
      () async {
        isSearchingServiceLocation.value = true;
        serviceLocationError.value = null;
        try {
          final lat = selectedLatitude.value ?? _selectedLatitude;
          final lon = selectedLongitude.value ?? _selectedLongitude;
          final suggestions = await _mapboxSearchService
              .searchAddressSuggestions(
                query: query,
                latitude: lat,
                longitude: lon,
                limit: 5,
              );
          serviceLocationSuggestions.assignAll(suggestions);
        } catch (e) {
          serviceLocationSuggestions.clear();
          serviceLocationError.value = '$e';
        } finally {
          isSearchingServiceLocation.value = false;
        }
      },
    );
  }

  Future<void> selectManualAddressSuggestion(MapboxPlaceModel place) async {
    customerLocationController.clear();
    manualAddressController.text = place.address;
    manualAddressController.selection = TextSelection.fromPosition(
      TextPosition(offset: manualAddressController.text.length),
    );
    _selectedLatitude = place.latitude;
    _selectedLongitude = place.longitude;
    selectedLatitude.value = place.latitude;
    selectedLongitude.value = place.longitude;
    pickupInputMode.value = BookingPickupInputMode.manual;
    manualAddressSuggestions.clear();
    manualAddressError.value = null;
    reviewRevision.value++;

    await discoverNearbyPlaces(
      latitude: place.latitude,
      longitude: place.longitude,
      condition: mapboxSearchCondition,
      radiusMiles: 5,
    );
  }

  Future<void> selectServiceLocationSuggestion(MapboxPlaceModel place) async {
    serviceLocationController.text = place.address;
    serviceLocationController.selection = TextSelection.fromPosition(
      TextPosition(offset: serviceLocationController.text.length),
    );
    final customOption = _serviceLocationOptionLabel(place);
    if (!carWashOptions.contains(customOption)) {
      carWashOptions.insert(0, customOption);
      carWashPlaces.insert(0, place);
    }
    setSelectedCarWash(customOption);
    hasUserSelectedCarWashLocation.value = true;
    serviceLocationInputMode.value = BookingServiceLocationInputMode.manual;
    carWashLocationDropdownRenderVersion.value++;
    selectedCarWashAddress.value = place.address;
    selectedCarWashLocationName.value = place.name.trim().isEmpty
        ? null
        : place.name.trim();
    selectedCarWashLatitude.value = place.latitude;
    selectedCarWashLongitude.value = place.longitude;
    serviceLocationSuggestions.clear();
    serviceLocationError.value = null;
    reviewRevision.value++;
  }

  void _clearEvStationSelectionFields({bool keepPlaces = true}) {
    selectedEvStationIndex.value = 0;
    selectedEvStationAddress.value = null;
    selectedEvChargingLocationName.value = null;
    selectedEvStationLatitude.value = null;
    selectedEvStationLongitude.value = null;
    selectedEvChargingWebsiteUrl.value = null;
    hasUserSelectedEvChargingLocation.value = false;
    if (!keepPlaces) {
      evChargingPlaces.clear();
      evStations.clear();
    }
  }

  void clearEvChargingLocationSelection() {
    evChargingLocationController.clear();
    evChargingLocationSuggestions.clear();
    evChargingLocationError.value = null;
    if (evChargingLocationInputMode.value ==
        BookingServiceLocationInputMode.manual) {
      _clearEvStationSelectionFields(keepPlaces: true);
    }
    evChargingLocationInputMode.value = BookingServiceLocationInputMode.none;
    reviewRevision.value++;
    notifyCanProceedChanged();
  }

  void onEvChargingLocationChanged(String value) {
    _evChargingLocationDebounce?.cancel();
    final query = value.trim();
    if (query.isEmpty) {
      evChargingLocationSuggestions.clear();
      evChargingLocationError.value = null;
      if (evChargingLocationInputMode.value ==
          BookingServiceLocationInputMode.manual) {
        _clearEvStationSelectionFields(keepPlaces: true);
        evChargingLocationInputMode.value =
            BookingServiceLocationInputMode.none;
      }
      return;
    }

    if (evChargingLocationInputMode.value ==
        BookingServiceLocationInputMode.dropdown) {
      _clearEvStationSelectionFields(keepPlaces: true);
      evChargingLocationInputMode.value = BookingServiceLocationInputMode.none;
    }

    if (query.length < 3) {
      evChargingLocationSuggestions.clear();
      evChargingLocationError.value = null;
      return;
    }

    _evChargingLocationDebounce = Timer(
      const Duration(milliseconds: 350),
      () async {
        isSearchingEvChargingLocation.value = true;
        evChargingLocationError.value = null;
        try {
          final lat = selectedLatitude.value ?? _selectedLatitude;
          final lon = selectedLongitude.value ?? _selectedLongitude;
          final suggestions = await _mapboxSearchService
              .searchAddressSuggestions(
                query: query,
                latitude: lat,
                longitude: lon,
                limit: 5,
              );
          evChargingLocationSuggestions.assignAll(suggestions);
        } catch (e) {
          evChargingLocationSuggestions.clear();
          evChargingLocationError.value = '$e';
        } finally {
          isSearchingEvChargingLocation.value = false;
        }
      },
    );
  }

  String _evChargingLocationOptionLabel(MapboxPlaceModel place) {
    final rawName = place.name.trim();
    final base = rawName.isEmpty ? 'EV Charging Station' : rawName;
    if (!evStations.any((station) => station.menuLabel == base)) {
      return base;
    }
    var suffix = 2;
    while (evStations.any(
      (station) => station.menuLabel == '$base ($suffix)',
    )) {
      suffix++;
    }
    return '$base ($suffix)';
  }

  EvStationInfo _evStationInfoFromPlace(
    MapboxPlaceModel place, {
    required String menuLabel,
  }) {
    final rawName = place.name.trim();
    return EvStationInfo(
      menuLabel: menuLabel,
      shortName: rawName.isEmpty ? 'EV Charging Station' : rawName,
      address: place.address,
      milesAwayLine: 'Nearby',
      availableChargers: _formatAvailableChargers(place.availableChargers),
      maxKw: _formatChargingSpeed(place.maxChargingPowerKw),
      reviewDistance: 'Nearby',
      reviewServiceLocation: 'Return to pickup location',
      latitude: place.latitude,
      longitude: place.longitude,
    );
  }

  void selectEvChargingLocationSuggestion(MapboxPlaceModel place) {
    evChargingLocationController.text = place.address;
    evChargingLocationController.selection = TextSelection.fromPosition(
      TextPosition(offset: evChargingLocationController.text.length),
    );
    final menuLabel = _evChargingLocationOptionLabel(place);
    final existingIdx = evStations.indexWhere(
      (station) =>
          station.address.trim() == place.address.trim() &&
          station.latitude == place.latitude &&
          station.longitude == place.longitude,
    );
    if (existingIdx < 0) {
      evChargingPlaces.insert(0, place);
      evStations.insert(
        0,
        _evStationInfoFromPlace(place, menuLabel: menuLabel),
      );
      setSelectedEvStation(menuLabel);
    } else {
      setSelectedEvStation(evStations[existingIdx].menuLabel);
    }
    hasUserSelectedEvChargingLocation.value = true;
    evChargingLocationInputMode.value = BookingServiceLocationInputMode.manual;
    evChargingLocationSuggestions.clear();
    evChargingLocationError.value = null;
    reviewRevision.value++;
    notifyCanProceedChanged();
  }

  String get flowTitle {
    if (isCombinedServiceFlow) {
      switch (currentStep.value) {
        case 0:
          return 'Combined Service Details';
        case 1:
          return 'Enter Car Wash Service Details';
        case 2:
          return 'Enter EV Charging Service Details';
        case 3:
          return 'Enter Service Details';
        default:
          return 'Enter Service Details';
      }
    }
    final s = _normalizedServiceLabel;
    if ((s.contains('car wash') || s == 'carwash') &&
        !s.contains('ev') &&
        !s.contains('combo')) {
      return 'Enter Car Wash Service Details';
    }
    if (_looksLikeEvOnlyService) {
      return 'Enter EV Charging Service Details';
    }
    return 'Enter Service Details';
  }

  String get appBarTitle {
    if (currentStep.value == flowStepCount - 1) return 'Review & Confirm';
    return flowTitle;
  }

  double get totalPrice {
    if (isCombinedServiceFlow) {
      return evServiceFee.value +
          evChargingCost.value +
          combinedBookingServiceCharge;
    }
    if (isEvChargingFlow) {
      return evServiceFee.value + evChargingCost.value + evServiceCharge.value;
    }
    return subtotal.value + serviceFee.value;
  }

  /// Matches combined-service review mock total breakdown.
  static const double combinedBookingServiceCharge = 4.55;

  double get reviewServiceChargeLineAmount => isCombinedServiceFlow
      ? combinedBookingServiceCharge
      : evServiceCharge.value;

  bool get _hasPickupCoordinates {
    final lat = _resolvedPickupLatitude();
    final lng = _resolvedPickupLongitude();
    return lat != null && lng != null && lat.isFinite && lng.isFinite;
  }

  bool get _hasBookingLocationInput =>
      hasCustomerLocationText.value || hasManualAddressText.value;

  bool get canProceed {
    // Subscribe Obx to text-field edits (see [reviewRevision] / [notifyCanProceedChanged]).
    reviewRevision.value;

    if (isCombinedServiceFlow) {
      switch (currentStep.value) {
        case 0:
          return (selectedCarWash.value ?? '').trim().isNotEmpty &&
              _hasBookingLocationInput &&
              _hasPickupCoordinates;
        case 1:
          // Membership wash option fulfils the package requirement on its own.
          if (hasMembershipWash.value) {
            if (isScheduleScheduled) {
              return scheduledServiceDate.value != null &&
                  scheduledServiceTime.value != null;
            }
            return true;
          }
          final hasPreset =
              comfortPackages.isNotEmpty &&
              (selectedComfortPackage.value ?? '').trim().isNotEmpty;
          final hasManual =
              packageNameController.text.trim().isNotEmpty &&
              packagePriceController.text.trim().isNotEmpty &&
              _isCustomPriceValid;
          if (!hasPreset && !hasManual) return false;
          if (isScheduleScheduled) {
            return scheduledServiceDate.value != null &&
                scheduledServiceTime.value != null;
          }
          return true;
        case 2:
          if (evStations.isEmpty) return false;
          if (evAccountCardOnFile.value == null) return false;
          if (isScheduleScheduled) {
            return scheduledServiceDate.value != null &&
                scheduledServiceTime.value != null;
          }
          return true;
        case 3:
          return selectedVehicle.value != null &&
              selectedVehicle.value!.isNotEmpty &&
              !_isAddNewVehicleOption(selectedVehicle.value) &&
              (selectedEvChargeLimit.value ?? '').trim().isNotEmpty &&
              _vehicleStepBatteryComplete &&
              _serviceNotesStepComplete;
        case 4:
          return true;
        default:
          return false;
      }
    }
    if (isEvChargingFlow) {
      switch (currentStep.value) {
        case 0:
          return (selectedChargingType.value ?? '').trim().isNotEmpty &&
              evAccountCardOnFile.value != null &&
              _hasBookingLocationInput &&
              _hasPickupCoordinates &&
              !isSearchingNearbyPlaces.value;
        case 1:
          if (evStations.isEmpty) return false;
          if (isScheduleScheduled) {
            return scheduledServiceDate.value != null &&
                scheduledServiceTime.value != null;
          }
          return true;
        case 2:
          return selectedVehicle.value != null &&
              selectedVehicle.value!.isNotEmpty &&
              !_isAddNewVehicleOption(selectedVehicle.value) &&
              selectedEvChargeLimit.value != null &&
              selectedEvChargeLimit.value!.isNotEmpty &&
              _vehicleStepBatteryComplete &&
              _serviceNotesStepComplete;
        case 3:
          return true;
        default:
          return false;
      }
    }

    switch (currentStep.value) {
      case 0:
        return (selectedCarWash.value ?? '').trim().isNotEmpty &&
            _hasBookingLocationInput &&
            _hasPickupCoordinates;
      case 1:
        // Membership wash option fulfils the package requirement on its own.
        if (hasMembershipWash.value) {
          if (isScheduleScheduled) {
            return scheduledServiceDate.value != null &&
                scheduledServiceTime.value != null;
          }
          return true;
        }
        final hasPreset =
            comfortPackages.isNotEmpty &&
            (selectedComfortPackage.value ?? '').trim().isNotEmpty;
        final hasManual =
            packageNameController.text.trim().isNotEmpty &&
            packagePriceController.text.trim().isNotEmpty &&
            _isCustomPriceValid;
        if (!hasPreset && !hasManual) return false;
        if (isScheduleScheduled) {
          return scheduledServiceDate.value != null &&
              scheduledServiceTime.value != null;
        }
        return true;
      case 2:
        return selectedVehicle.value != null &&
            selectedVehicle.value!.isNotEmpty &&
            !_isAddNewVehicleOption(selectedVehicle.value) &&
            _serviceNotesStepComplete;
      case 3:
        return true;
      default:
        return false;
    }
  }

  BookingServiceNotesFormData get serviceNotesFormData =>
      BookingServiceNotesFormData(
        vehicleParkedLocation: selectedVehicleParkedLocation.value,
        vehicleParkedLocationOther: vehicleParkedLocationOtherController.text,
        providerParkLocation: selectedProviderParkLocation.value,
        providerParkLocationOther: providerParkLocationOtherController.text,
        vehicleKeyLocation: selectedVehicleKeyLocation.value,
        vehicleKeyLocationOther: vehicleKeyLocationOtherController.text,
        keyReturnLocation: selectedKeyReturnLocation.value,
        keyReturnLocationOther: keyReturnLocationOtherController.text,
        additionalNotes: otherNotesVehicleController.text,
      );

  bool get _serviceNotesStepComplete => serviceNotesFormData.isComplete;

  /// EV / combo vehicle step: battery status and charge limit.
  bool get _vehicleStepBatteryComplete {
    if (!requiresEvBatteryOnVehicleStep) return true;
    if (validateEvBatteryStatus(selectedEvBatteryStatus.value) != null)
      return false;
    if ((selectedEvChargeLimit.value ?? '').trim().isEmpty) return false;
    return evBatteryChargeLimitConflictError == null;
  }

  // ── EV cross-field validation helpers ──────────────────────────────────────

  /// Returns an error message when the current battery status is >= the
  /// charge limit (illogical / impossible to fulfil).  Returns null when valid.
  String? get evBatteryChargeLimitConflictError {
    final battery = selectedEvBatteryStatus.value?.trim();
    final limit = selectedEvChargeLimit.value?.trim();
    if (battery == null || battery.isEmpty) return null;
    if (limit == null || limit.isEmpty) return null;

    final maxBat = _maxBatteryPercentFromLabel(battery);
    final limPct = _chargeLimitPercentFromLabel(limit);
    if (maxBat == null || limPct == null) return null;

    if (maxBat >= limPct) {
      return 'Current battery level ($battery) must be lower than '
          'the charge limit ($limit). Please adjust your selection.';
    }
    return null;
  }

  /// Upper-bound percent for a battery status label (e.g. '30-40%' → 40).
  static int? _maxBatteryPercentFromLabel(String label) {
    final l = label.trim();
    if (l.isEmpty) return null;
    // 'Above' means battery is above 50 % — treat as 51 for comparison.
    if (l.toLowerCase() == 'above') return 51;
    // Range: '30-40%'
    final range = RegExp(r'^(\d+)-(\d+)%$').firstMatch(l);
    if (range != null) return int.tryParse(range.group(2)!);
    // Single value: '20%'
    final single = RegExp(r'^(\d+)%$').firstMatch(l);
    if (single != null) return int.tryParse(single.group(1)!);
    return null;
  }

  /// Parses the numeric percent from a charge-limit label such as '80%'.
  static int? _chargeLimitPercentFromLabel(String label) {
    final match = RegExp(r'^(\d+)%$').firstMatch(label.trim());
    if (match != null) return int.tryParse(match.group(1)!);
    return null;
  }

  String? validateEvBatteryStatus(String? value) {
    final text = (value ?? '').trim();
    if (text.isEmpty) {
      return 'Please select current battery status';
    }
    if (EvChargingBookingOptions.optionForLabel(text) == null) {
      return 'Please select a valid battery status';
    }
    return null;
  }

  void onEvBatteryStatusChosen(String? value) {
    if (value == null || value.trim().isEmpty) return;
    selectedEvBatteryStatus.value = value;
    if (evBatteryStatusController.text != value) {
      evBatteryStatusController.text = value;
    }
    notifyCanProceedChanged();
    _scheduleSyncEvChargeLimitFromBatteryStatus();
  }

  bool get _isPackagePriceInvalidFormat {
    if (currentStep.value != 1) return false;
    if (isEvChargingFlow) return false;
    if (!_usesCustomPackage) return false;
    final raw = packagePriceController.text.trim();
    if (raw.isEmpty) return false;
    return !isValidPackagePrice(raw);
  }

  String get _validationErrorTitle =>
      _isPackagePriceInvalidFormat ? 'Invalid Format' : 'Missing info';

  String _validationMessage() {
    // Specific message when a manual price value is present but invalid
    if ((isCombinedServiceFlow ||
            (!isCombinedServiceFlow && !isEvChargingFlow)) &&
        currentStep.value == 1 &&
        _usesCustomPackage &&
        !_isCustomPriceValid) {
      final raw = packagePriceController.text.trim();
      if (raw.isNotEmpty) {
        return 'Enter a valid price (e.g. 9.99).';
      }
      return 'Please enter a package name and price.';
    }
    // Cross-field EV battery/charge-limit conflict — show specific message first.
    final batteryConflict = evBatteryChargeLimitConflictError;
    if (batteryConflict != null) return batteryConflict;

    if (isCombinedServiceFlow) {
      switch (currentStep.value) {
        case 0:
          return 'Add your location and select a service location.';
        case 1:
          return 'Choose a package (or enter name & price) and scheduling.';
        case 2:
          return 'Select a charging station, answer the EV account question, then pick scheduling.';
        case 3:
          return 'Select your vehicle, battery status, and charge limit.';
        default:
          return 'Please complete this step.';
      }
    }
    if (isEvChargingFlow) {
      switch (currentStep.value) {
        case 0:
          return 'Set your location, select a charging type, and answer the EV account question.';
        case 1:
          return 'Select a charging station, then pick scheduling.';
        case 2:
          return 'Select your vehicle, current battery status, and charge limit.';
        default:
          return 'Please complete this step.';
      }
    }
    switch (currentStep.value) {
      case 0:
        return 'Add your location and pick a car wash.';
      case 1:
        if (_usesCustomPackage && !_isCustomPriceValid) {
          final raw = packagePriceController.text.trim();
          if (raw.isNotEmpty) {
            return 'Enter a valid price (e.g. 9.99).';
          }
        }
        return 'Choose a package (or enter name & price) and scheduling.';
      case 2:
        return 'Select your vehicle and parking details.';
      default:
        return 'Please complete this step.';
    }
  }

  String get primaryButtonLabel {
    if (isCombinedServiceFlow) {
      switch (currentStep.value) {
        case 0:
          return 'Next: Service Details';
        case 1:
          return 'Next: Charge Details';
        case 2:
          return 'Next: Vehicle Details';
        case 3:
          return 'Next: Review & Payment';
        case 4:
          return 'Confirm Booking';
        default:
          return 'Next';
      }
    }
    if (isEvChargingFlow) {
      switch (currentStep.value) {
        case 0:
          return 'Next: Charging Details';
        case 1:
          return 'Next: Vehicle Details';
        case 2:
          return 'Next: Review & Payment';
        case 3:
          return 'Confirm Booking';
        default:
          return 'Next';
      }
    }
    switch (currentStep.value) {
      case 0:
        return 'Next: Car Wash Details';
      case 1:
        return 'Next: Vehicle Details';
      case 2:
        return 'Next: Review & Payment';
      case 3:
        return 'Confirm Booking';
      default:
        return 'Next';
    }
  }

  bool get _shouldStartBookingOnCurrentStep =>
      primaryButtonLabel == 'Next: Car Wash Details' ||
      primaryButtonLabel == 'Next: Charging Details' ||
      primaryButtonLabel == 'Next: Service Details';

  bool get _shouldSaveServiceDetailsOnCurrentStep =>
      primaryButtonLabel == 'Next: Vehicle Details';

  bool get _shouldSaveVehicleDetailsOnCurrentStep =>
      primaryButtonLabel == 'Next: Review & Payment';

  bool get _shouldFetchReviewOnCurrentStep =>
      primaryButtonLabel == 'Next: Review & Payment';

  bool get _shouldConfirmBookingOnCurrentStep =>
      primaryButtonLabel == 'Confirm Booking';

  void goNext() {
    unawaited(_goNext());
  }

  Future<void> _goNext() async {
    if (!isEvChargingFlow && currentStep.value == 0) {
      await _loadSelectedCarWashWebsiteUrl();
    }
    if (isCombinedServiceFlow && currentStep.value == 1) {
      await _loadSelectedCarWashWebsiteUrl();
    }
    if (isEvChargingFlow && currentStep.value == 0) {
      await _loadSelectedEvChargingWebsiteUrl();
    }
    if (isCombinedServiceFlow && currentStep.value == 2) {
      await _loadSelectedEvChargingWebsiteUrl();
    }
    if (_shouldSaveVehicleDetailsOnCurrentStep) {
      if (!validateVehicleStepForm()) {
        return;
      }
      await bookingStep3(advanceToNextStepOnSuccess: true);
      return;
    }

    if (!canProceed) {
      showAppSnackBar(
        title: _validationErrorTitle,
        message: _validationMessage(),
        isError: true,
      );
      return;
    }

    if (_shouldStartBookingOnCurrentStep) {
      if (!hasStartedBooking.value) {
        await bookingStart(advanceToNextStepOnSuccess: true);
      } else {
        final ok = await syncBookingLocation(advanceToNextStepOnSuccess: true);
        if (!ok) return;
      }
      return;
    }

    if (_shouldSaveServiceDetailsOnCurrentStep) {
      await bookingStep2(advanceToNextStepOnSuccess: true);
      return;
    }

    if (_shouldFetchReviewOnCurrentStep) {
      final ok = await fetchBookingReview();
      if (!ok) return;
    }

    if (_shouldConfirmBookingOnCurrentStep) {
      await bookingConfirm();
      return;
    }

    if (isCombinedServiceFlow && currentStep.value == 1) {
      await discoverNearbyPlaces(condition: MapboxSearchCondition.evCharging);
    }

    if (currentStep.value < flowStepCount - 1) {
      currentStep.value++;
      if (currentStep.value == flowStepCount - 1 && hasStartedBooking.value) {
        unawaited(fetchBookingReview());
      }
    } else {
      _showBookingConfirmed();
    }
  }

  bool validateVehicleStepForm() {
    vehicleStepAutoValidate.value = true;
    final form = vehicleStepFormKey.currentState;
    if (form == null) return true;
    return form.validate();
  }

  void goBack() {
    if (currentStep.value > 0) {
      currentStep.value--;
    } else if (kIsWeb) {
      // PWA routes use Get's router delegate, so there may be no navigator
      // entry to pop when booking was opened from the dashboard.
      offAllNamed(Routes.DASHBOARD);
    } else {
      Get.back();
    }
  }

  void closeFlow() => Get.back<void>();

  Future<void> fillCustomerLocationPlaceholder() async {
    await pickCurrentLocationAndLoadNearby(userInitiated: true);
  }

  Future<void> pickCurrentLocationAndLoadNearby({
    bool userInitiated = false,
  }) async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      nearbySearchError.value = 'Location services are disabled.';
      return;
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.deniedForever) {
      showLocationPermissionSettingsDialog();
      return;
    }
    if (permission == LocationPermission.denied) {
      nearbySearchError.value = 'Location permission is required.';
      return;
    }

    try {
      isSearchingNearbyPlaces.value = true;
      nearbySearchError.value = null;
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );
      final address = await _mapboxSearchService.reverseGeocodeAddress(
        latitude: position.latitude,
        longitude: position.longitude,
      );
      // Do not let a slower automatic browser location response replace a
      // pickup address entered while booking for another person.
      if (!userInitiated &&
          (pickupInputMode.value == BookingPickupInputMode.manual ||
              manualAddressController.text.trim().isNotEmpty)) {
        return;
      }
      _selectedLatitude = position.latitude;
      _selectedLongitude = position.longitude;
      // Keep reactive values in sync because bookingStart() reads these.
      selectedLatitude.value = position.latitude;
      selectedLongitude.value = position.longitude;
      manualAddressController.clear();
      manualAddressSuggestions.clear();
      manualAddressError.value = null;
      customerLocationController.text = address.isNotEmpty
          ? address
          : '${position.latitude}, ${position.longitude}';
      pickupInputMode.value = BookingPickupInputMode.gps;
      reviewRevision.value++;
      await discoverNearbyPlaces(
        latitude: position.latitude,
        longitude: position.longitude,
        condition: mapboxSearchCondition,
        radiusMiles: 5,
      );
    } catch (e) {
      nearbySearchError.value = '$e';
    } finally {
      isSearchingNearbyPlaces.value = false;
    }
  }

  Future<void> discoverNearbyPlaces({
    double? latitude,
    double? longitude,
    int limit = 30,
    MapboxSearchCondition? condition,
    double? radiusMiles,
  }) async {
    final lat = latitude ?? _selectedLatitude;
    final lon = longitude ?? _selectedLongitude;
    if (lat == null || lon == null) {
      nearbySearchError.value =
          'Latitude and longitude are required to discover nearby places.';
      return;
    }

    isSearchingNearbyPlaces.value = true;
    nearbySearchError.value = null;
    final resolvedCondition = condition ?? mapboxSearchCondition;
    final updateCarWash = resolvedCondition != MapboxSearchCondition.evCharging;
    final updateEvCharging = resolvedCondition != MapboxSearchCondition.carWash;
    if (updateCarWash) {
      hasUserSelectedCarWashLocation.value = false;
    }
    try {
      final places = await _mapboxSearchService.searchNearbyPlaces(
        latitude: lat,
        longitude: lon,
        condition: condition ?? mapboxSearchCondition,
        limit: limit,
        preferredEvChargerType: _chargerTypeForApi(),
      );
      final filteredPlaces = places /*radiusMiles == null
          ? places
          : places.where((place) {
              return _distanceInMiles(
                    fromLat: lat,
                    fromLon: lon,
                    toLat: place.latitude,
                    toLon: place.longitude,
                  ) <=
                  radiusMiles;
            }).toList()*/;
      nearbyPlaces.assignAll(filteredPlaces);
      _applyNearbyPlacesToOptions(
        filteredPlaces,
        updateCarWash: updateCarWash,
        updateEvCharging: updateEvCharging,
      );
    } catch (e) {
      nearbySearchError.value = '$e';
    } finally {
      isSearchingNearbyPlaces.value = false;
    }
  }

  void setSelectedChargingType(String? value) {
    final selected = value?.trim();
    if (selected == null ||
        selected.isEmpty ||
        selected == selectedChargingType.value) {
      return;
    }

    selectedChargingType.value = selected;
    final latitude = _resolvedPickupLatitude();
    final longitude = _resolvedPickupLongitude();
    if (latitude == null || longitude == null) return;

    unawaited(
      discoverNearbyPlaces(
        latitude: latitude,
        longitude: longitude,
        condition: mapboxSearchCondition,
        radiusMiles: 5,
      ),
    );
  }

  void clearServiceLocationSelection() {
    serviceLocationController.clear();
    serviceLocationSuggestions.clear();
    serviceLocationError.value = null;
    if (serviceLocationInputMode.value ==
        BookingServiceLocationInputMode.manual) {
      _clearCarWashSelectionFields(keepOptions: true);
    }
    serviceLocationInputMode.value = BookingServiceLocationInputMode.none;
    reviewRevision.value++;
    notifyCanProceedChanged();
  }

  void _applyNearbyPlacesToOptions(
    List<MapboxPlaceModel> places, {
    bool updateCarWash = true,
    bool updateEvCharging = true,
  }) {
    final carWashCandidates = places
        .where((e) => e.category.toLowerCase().contains('car_wash'))
        .toList();

    if (updateCarWash) {
      if (carWashCandidates.isNotEmpty) {
        final previousSelected = selectedCarWash.value;
        carWashPlaces.assignAll(carWashCandidates);
        carWashOptions.assignAll(
          carWashPlaces
              .map(_serviceLocationOptionLabel)
              .toList(growable: false),
        );
        final hasPreviousSelection =
            previousSelected != null &&
            previousSelected.trim().isNotEmpty &&
            carWashOptions.contains(previousSelected);
        if (hasPreviousSelection) {
          setSelectedCarWash(previousSelected);
          serviceLocationInputMode.value =
              BookingServiceLocationInputMode.dropdown;
        } else if (!isCombinedServiceFlow ||
            !hasUserSelectedCarWashLocation.value) {
          setSelectedCarWash(carWashOptions.first);
          serviceLocationInputMode.value =
              BookingServiceLocationInputMode.dropdown;
        }
      } else {
        carWashPlaces.clear();
        carWashOptions.clear();
        if (!isCombinedServiceFlow || !hasUserSelectedCarWashLocation.value) {
          selectedCarWash.value = null;
          selectedCarWashAddress.value = null;
          selectedCarWashLocationName.value = null;
          selectedCarWashLatitude.value = null;
          selectedCarWashLongitude.value = null;
        }
        if (!isEvChargingFlow) {
          nearbySearchError.value = isCombinedServiceFlow
              ? 'No nearby car wash locations found within 5 miles of your current location.'
              : 'No nearby car wash locations found within 5 miles of your current location.';
        }
      }
    }

    if (!updateEvCharging) return;

    final evPlaces = places
        .where((e) => e.category.toLowerCase().contains('ev_charging'))
        .toList();
    final resolvedEvPlaces = evPlaces.isNotEmpty
        ? evPlaces
        : ((isEvChargingFlow && places.isNotEmpty)
              ? places
              : <MapboxPlaceModel>[]);

    if (resolvedEvPlaces.isNotEmpty) {
      final previousEvLabel =
          selectedEvStationIndex.value >= 0 &&
              selectedEvStationIndex.value < evStations.length
          ? evStations[selectedEvStationIndex.value].menuLabel
          : null;
      evChargingPlaces.assignAll(resolvedEvPlaces);
      final nameCounts = <String, int>{};
      evStations.assignAll(
        resolvedEvPlaces.map((place) {
          final rawName = place.name.trim();
          final base = rawName.isEmpty ? 'EV Charging Station' : rawName;
          final n = nameCounts[base] ?? 0;
          nameCounts[base] = n + 1;
          final menuLabel = n == 0 ? base : '$base (${n + 1})';
          return EvStationInfo(
            menuLabel: menuLabel,
            shortName: rawName.isEmpty ? 'EV Charging Station' : rawName,
            address: place.address,
            milesAwayLine: 'Nearby',
            availableChargers: _formatAvailableChargers(
              place.availableChargers,
            ),
            maxKw: _formatChargingSpeed(place.maxChargingPowerKw),
            reviewDistance: 'Nearby',
            reviewServiceLocation: 'Return to pickup location',
            latitude: place.latitude,
            longitude: place.longitude,
          );
        }).toList(),
      );
      final hasPreviousEv =
          previousEvLabel != null &&
          previousEvLabel.trim().isNotEmpty &&
          evStations.any((e) => e.menuLabel == previousEvLabel);
      if (hasPreviousEv) {
        setSelectedEvStation(previousEvLabel);
        evChargingLocationInputMode.value =
            BookingServiceLocationInputMode.dropdown;
      } else if (isEvChargingFlow || !updateCarWash) {
        setSelectedEvStation(evStations.first.menuLabel);
        evChargingLocationInputMode.value =
            BookingServiceLocationInputMode.dropdown;
      }
    } else {
      evChargingPlaces.clear();
      evStations.clear();
      selectedEvStationIndex.value = 0;
      selectedEvStationAddress.value = null;
      selectedEvChargingLocationName.value = null;
      selectedEvStationLatitude.value = null;
      selectedEvStationLongitude.value = null;
      selectedEvChargingWebsiteUrl.value = null;
      if (isEvChargingFlow) {
        nearbySearchError.value =
            'No nearby EV charging locations found within 5 miles of your current location.';
      }
    }
  }

  String _serviceLocationOptionLabel(MapboxPlaceModel place) {
    final name = place.name.trim();
    final address = place.address.trim();
    if (name.isEmpty) return address;
    if (address.isEmpty) return name;
    return '$name • $address';
  }

  void setSelectedCarWash(String? value, {bool userSelected = false}) {
    if (value == null || value.trim().isEmpty) return;
    if (userSelected) {
      hasUserSelectedCarWashLocation.value = true;
      serviceLocationController.clear();
      serviceLocationSuggestions.clear();
      serviceLocationError.value = null;
      serviceLocationInputMode.value = BookingServiceLocationInputMode.dropdown;
    }
    selectedCarWash.value = value;
    final idx = carWashOptions.indexOf(value);
    if (idx >= 0 && idx < carWashPlaces.length) {
      final place = carWashPlaces[idx];
      selectedCarWashAddress.value = place.address;
      selectedCarWashLocationName.value = place.name.trim().isEmpty
          ? null
          : place.name.trim();
      selectedCarWashLatitude.value = place.latitude;
      selectedCarWashLongitude.value = place.longitude;
      selectedCarWashPlaceId.value = place.placeId;
      final existingWebsite = (place.websiteUri ?? '').trim();
      selectedCarWashWebsiteUrl.value = existingWebsite.isEmpty
          ? null
          : existingWebsite;
      if (selectedCarWashWebsiteUrl.value == null) {
        unawaited(_loadSelectedCarWashWebsiteUrl());
      }
    }
    reviewRevision.value++;
  }

  Future<void> _loadSelectedCarWashWebsiteUrl() async {
    if (isEvChargingFlow) return;
    if (isLoadingCarWashWebsiteUrl.value) return;
    final placeId = (selectedCarWashPlaceId.value ?? '').trim();
    if (placeId.isEmpty) return;
    if ((selectedCarWashWebsiteUrl.value ?? '').trim().isNotEmpty) return;

    isLoadingCarWashWebsiteUrl.value = true;
    try {
      final website = await _mapboxSearchService.fetchPlaceWebsiteByPlaceId(
        placeId: placeId,
      );
      final cleaned = (website ?? '').trim();
      selectedCarWashWebsiteUrl.value = cleaned.isEmpty ? null : cleaned;
      if (cleaned.isNotEmpty) {
        final selectedIdx = carWashOptions.indexOf(selectedCarWash.value);
        if (selectedIdx >= 0 && selectedIdx < carWashPlaces.length) {
          final place = carWashPlaces[selectedIdx];
          carWashPlaces[selectedIdx] = MapboxPlaceModel(
            name: place.name,
            address: place.address,
            latitude: place.latitude,
            longitude: place.longitude,
            category: place.category,
            placeId: place.placeId,
            websiteUri: cleaned,
            availableChargers: place.availableChargers,
            maxChargingPowerKw: place.maxChargingPowerKw,
          );
        }
      }
    } catch (_) {
      // Keep flow non-blocking when details endpoint is unavailable.
    } finally {
      isLoadingCarWashWebsiteUrl.value = false;
    }
  }

  Future<void> ensureSelectedCarWashWebsiteLoaded() async {
    await _loadSelectedCarWashWebsiteUrl();
  }

  Future<void> ensureSelectedEvChargingWebsiteLoaded() async {
    await _loadSelectedEvChargingWebsiteUrl();
  }

  void setSelectedEvStation(String? value, {bool userSelected = false}) {
    if (value == null || value.trim().isEmpty) return;
    if (userSelected) {
      hasUserSelectedEvChargingLocation.value = true;
      evChargingLocationController.clear();
      evChargingLocationSuggestions.clear();
      evChargingLocationError.value = null;
      evChargingLocationInputMode.value =
          BookingServiceLocationInputMode.dropdown;
    }
    final idx = evStations.indexWhere((e) => e.menuLabel == value);
    if (idx < 0) return;
    selectedEvStationIndex.value = idx;
    final station = evStations[idx];
    selectedEvStationAddress.value = station.address;
    selectedEvChargingLocationName.value = station.shortName.trim().isEmpty
        ? null
        : station.shortName.trim();
    selectedEvStationLatitude.value = station.latitude;
    selectedEvStationLongitude.value = station.longitude;

    if (idx >= 0 && idx < evChargingPlaces.length) {
      final place = evChargingPlaces[idx];
      final existing = (place.websiteUri ?? '').trim();
      selectedEvChargingWebsiteUrl.value = existing.isEmpty ? null : existing;
      final pid = (place.placeId ?? '').trim();
      if (existing.isEmpty && pid.isNotEmpty) {
        unawaited(_loadSelectedEvChargingWebsiteUrl());
      }
    } else {
      selectedEvChargingWebsiteUrl.value = null;
    }
    reviewRevision.value++;
  }

  Future<void> _loadSelectedEvChargingWebsiteUrl() async {
    if (!isEvChargingFlow && !isCombinedServiceFlow) return;
    if (isLoadingEvChargingWebsiteUrl.value) return;
    final idx = selectedEvStationIndex.value;
    if (idx < 0 || idx >= evChargingPlaces.length) return;
    final place = evChargingPlaces[idx];
    final placeId = (place.placeId ?? '').trim();
    if (placeId.isEmpty) return;
    if ((place.websiteUri ?? '').trim().isNotEmpty) return;
    if ((selectedEvChargingWebsiteUrl.value ?? '').trim().isNotEmpty) return;

    isLoadingEvChargingWebsiteUrl.value = true;
    try {
      final website = await _mapboxSearchService.fetchPlaceWebsiteByPlaceId(
        placeId: placeId,
      );
      final cleaned = (website ?? '').trim();
      selectedEvChargingWebsiteUrl.value = cleaned.isEmpty ? null : cleaned;
      if (cleaned.isNotEmpty) {
        evChargingPlaces[idx] = MapboxPlaceModel(
          name: place.name,
          address: place.address,
          latitude: place.latitude,
          longitude: place.longitude,
          category: place.category,
          placeId: place.placeId,
          websiteUri: cleaned,
          availableChargers: place.availableChargers,
          maxChargingPowerKw: place.maxChargingPowerKw,
        );
      }
    } catch (_) {
      // Non-blocking when details are unavailable.
    } finally {
      isLoadingEvChargingWebsiteUrl.value = false;
    }
  }

  /// Shows [attachmentDialog]; uses [pickPicture] for camera or gallery.
  void pickVehiclePhoto(BuildContext context) {
    attachmentDialog(
      context,
      cameraClick: () async {
        await _finishVehiclePick(isCamera: true);
      },
      galleryClick: () async {
        await _finishVehiclePick(isCamera: false);
      },
    );
  }

  Future<void> _finishVehiclePick({required bool isCamera}) async {
    if (isCamera) {
      final path = await pickPicture(isCamera: true);
      if (path != null && path.isNotEmpty) {
        if (!vehiclePhotoPaths.contains(path)) {
          vehiclePhotoPaths.add(path);
          vehiclePhotoPaths.refresh();
        }
        reviewRevision.value++;
      }
      return;
    }

    // Gallery: allow multi-select.
    final paths = await pickMultiImages();
    if (paths != null && paths.isNotEmpty) {
      var added = false;
      for (final path in paths) {
        if (path.trim().isEmpty) continue;
        if (!vehiclePhotoPaths.contains(path)) {
          vehiclePhotoPaths.add(path);
          added = true;
        }
      }
      if (added) vehiclePhotoPaths.refresh();
      reviewRevision.value++;
    }
  }

  void clearVehiclePhoto() {
    vehiclePhotoPaths.clear();
    _removedVehiclePhotoUrls.clear();
    vehiclePhotoPaths.refresh();
    reviewRevision.value++;
  }

  void removeVehiclePhotoAt(int index) {
    if (index < 0 || index >= vehiclePhotoPaths.length) return;
    final path = vehiclePhotoPaths[index].trim();
    if (path.startsWith('http')) {
      _removedVehiclePhotoUrls.add(path);
    }
    vehiclePhotoPaths.removeAt(index);
    vehiclePhotoPaths.refresh();
    reviewRevision.value++;
  }

  List<String> get localVehiclePhotoPaths => vehiclePhotoPaths
      .map((p) => p.trim())
      .where((p) => p.isNotEmpty && !p.startsWith('http'))
      .toList(growable: false);

  void _syncVehiclePhotosFromReview(br.Data? data) {
    final remote = _extractReviewImageUrls(data);
    final filteredRemote = remote
        .where((url) => !_removedVehiclePhotoUrls.contains(url))
        .toList();
    final pendingLocal = localVehiclePhotoPaths;
    vehiclePhotoPaths.assignAll([...filteredRemote, ...pendingLocal]);
    vehiclePhotoPaths.refresh();
  }

  List<String> _extractReviewImageUrls(br.Data? data) {
    final raw = data?.bookingImages;
    if (raw == null || raw.isEmpty) return const <String>[];
    return raw
        .map(_bookingReviewImageUrl)
        .where((s) => s.isNotEmpty)
        .toList(growable: false);
  }

  Future<void> onVehicleChosen(String? value) async {
    if (value == null) return;
    if (_isAddNewVehicleOption(value)) {
      final beforeVehicleIds = myVehicles
          .map((v) => v.id)
          .whereType<int>()
          .toSet();
      final previousSelectedId = selectedVehicleId.value;

      if (!_isAddNewVehicleOption(selectedVehicle.value) &&
          _vehicleLabelToId.containsKey(selectedVehicle.value)) {
        selectedVehicle.value = selectedVehicle.value;
        selectedVehicleId.value = _vehicleLabelToId[selectedVehicle.value];
      } else {
        final firstRealVehicle = _vehicleLabelToId.isNotEmpty
            ? _vehicleLabelToId.keys.first
            : null;
        selectedVehicle.value = firstRealVehicle;
        selectedVehicleId.value = firstRealVehicle == null
            ? null
            : _vehicleLabelToId[firstRealVehicle];
      }
      selectedVehicle.refresh();
      selectedVehicleId.refresh();
      vehicleDropdownRenderVersion.value++;
      await toNamed(Routes.ADD_VEHICLE);
      await _fetchVehicles();

      final newVehicle = myVehicles.firstWhereOrNull(
        (v) => v.id != null && !beforeVehicleIds.contains(v.id),
      );
      if (newVehicle?.id != null) {
        final newLabel = _labelForVehicleId(newVehicle!.id);
        if (newLabel != null) {
          selectedVehicle.value = newLabel;
          selectedVehicleId.value = newVehicle.id;
        }
      } else if (previousSelectedId != null) {
        final previousLabel = _labelForVehicleId(previousSelectedId);
        if (previousLabel != null) {
          selectedVehicle.value = previousLabel;
          selectedVehicleId.value = previousSelectedId;
        }
      }
      vehicleDropdownRenderVersion.value++;
      return;
    }
    selectedVehicle.value = value;
    selectedVehicleId.value = _vehicleLabelToId[value];
  }

  void onVehicleColorChosen(String? value) {
    if (value == null || value.trim().isEmpty) return;
    selectedColor.value = value.trim();
    if (!VehicleColors.isOther(value)) {
      vehicleCustomColorController.clear();
    }
  }

  String? get resolvedVehicleColor => VehicleColors.resolveForApi(
    selectedPickerValue: selectedColor.value,
    customColorText: vehicleCustomColorController.text,
  );

  void saveNewVehicle() async {
    final mk = resolvedVehicleMake;
    final md = resolvedVehicleModel;
    if (mk == null || mk.isEmpty || md == null || md.isEmpty) {
      showAppSnackBar(
        title: 'Vehicle',
        message: 'Please select or enter vehicle make and model.',
        isError: true,
      );
      return;
    }

    final col = resolvedVehicleColor;
    if (col == null || col.isEmpty) {
      showAppSnackBar(
        title: 'Vehicle color',
        message: VehicleColors.isOther(selectedColor.value)
            ? 'Please enter your vehicle color.'
            : 'Please select a vehicle color.',
        isError: true,
      );
      return;
    }

    final y = selectedYear.value ?? '';
    final type = selectedType.value;
    final plate = normalizeLicensePlate(vehiclePlateController.text);
    final plateError = validateLicensePlate(plate, allowEmpty: true);
    if (plateError != null) {
      showAppSnackBar(
        title: 'License plate',
        message: plateError,
        isError: true,
      );
      return;
    }
    final nick = vehicleNicknameController.text.trim();

    final label = [
      if (y.isNotEmpty) y,
      mk,
      md,
      if (col != null && col.isNotEmpty) '· $col',
    ].join(' ');

    final formData = dio.FormData.fromMap({
      'vehicle_type': type ?? 'SUV',
      'make': mk,
      'model': md,
      if (y.isNotEmpty) 'year': y,
      'color': col,
      if (nick.isNotEmpty) 'nickname': nick,
      if (plate.isNotEmpty) 'license_plate': plate,
    });

    final res = await _vehicleRepo.addVehicle(formData);
    res.when(
      success: (data) {
        myVehicles.add(data);
        _updateVehicleOptions();
        selectedVehicle.value = label;
        selectedVehicleId.value = data.id;
        if (selectedType.value != null) {
          evVehicleType.value = selectedType.value;
        }
        Get.back();
      },
      error: (e) {
        showAppSnackBar(title: 'Error', message: e.errorMessage, isError: true);
      },
    );
  }

  Future<void> _fetchVehicles() async {
    if (!Prefs().isCustomerRole) {
      myVehicles.clear();
      return;
    }
    isLoadingVehicles.value = true;
    final res = await _vehicleRepo.getVehicles();
    isLoadingVehicles.value = false;
    res.when(
      success: (data) {
        List<VehicleModel> list = data;
        if (list.isNotEmpty && !list.any((v) => v.isDefault)) {
          list = [
            list.first.copyWith(isDefault: true),
            ...list.skip(1).map((v) => v.copyWith(isDefault: false)),
          ];
        }
        myVehicles.value = list;
        _updateVehicleOptions();
      },
      error: (e) {
        // Handle error quietly or show snackbar
      },
    );
  }

  Future<void> _fetchPackagesForSelectedService() async {
    final packageService = _packageServiceQuery;
    if (packageService == null) {
      packageItems.clear();
      comfortPackages.clear();
      selectedComfortPackage.value = null;
      _packageLabelToId.clear();
      return;
    }

    isLoadingPackages.value = true;
    final res = await _vehicleRepo.getPackages(service: packageService);
    isLoadingPackages.value = false;
    res.when(
      success: (data) {
        final list = data.data ?? const <pkg.Data>[];
        packageItems.assignAll(list);
        _packageLabelToId.clear();
        packageNameController.clear();
        packagePriceController.clear();
        final labels = <String>[];
        for (final item in list) {
          final id = item.id;
          final label = _comfortPackageDropdownLabel(item);
          if (id == null || label.isEmpty) continue;
          labels.add(label);
          _packageLabelToId[label] = id;
        }
        comfortPackages.assignAll(labels);
        selectedComfortPackage.value = null;
      },
      error: (e) {
        comfortPackages.clear();
        selectedComfortPackage.value = null;
        showAppSnackBar(title: 'Packages', message: e.message, isError: true);
      },
    );
  }

  /// True when user picked a row from [comfortPackages] (hides manual package fields).
  bool get isCarComfortPackageSelected =>
      comfortPackages.isNotEmpty &&
      (selectedComfortPackage.value ?? '').trim().isNotEmpty;

  void setComfortPackageFromDropdown(String? v) {
    selectedComfortPackage.value = v;
    if ((v ?? '').trim().isNotEmpty) {
      packageNameController.clear();
      packagePriceController.clear();
    }
    notifyCanProceedChanged();
  }

  void clearComfortPackageSelection() {
    selectedComfortPackage.value = null;
    notifyCanProceedChanged();
  }

  /// Toggle the "I have a car wash membership" option.
  /// When enabled, clears all package selections — the Preferred Package ($0) will be used.
  void toggleMembershipWash(bool? value) {
    hasMembershipWash.value = value ?? false;
    if (hasMembershipWash.value) {
      noMembershipWash.value = false;
      selectedComfortPackage.value = null;
      packageNameController.clear();
      packagePriceController.clear();
      membershipTextController.text.trim().isNotEmpty
          ? membershipTextController.clear()
          : null;
    }
    notifyCanProceedChanged();
  }

  /// Toggle the "I don't have a car wash membership" option.
  /// Mutually exclusive with hasMembershipWash.
  void toggleNoMembership(bool? value) {
    noMembershipWash.value = value ?? false;
    if (noMembershipWash.value) {
      // Uncheck membership when no-membership is checked
      hasMembershipWash.value = false;
      selectedComfortPackage.value = null;
      packageNameController.clear();
      packagePriceController.clear();
      membershipTextController.clear();
    } else {
      // Uncheck no-membership when membership is checked
      selectedComfortPackage.value = null;
      packageNameController.clear();
      packagePriceController.clear();
    }
    notifyCanProceedChanged();
  }

  void setEvAccountCardOnFile(bool? value) {
    evAccountCardOnFile.value = value;
    notifyCanProceedChanged();
  }

  void _onManualPackageInputForPresetClear() {
    if (comfortPackages.isEmpty) return;
    if (packageNameController.text.trim().isNotEmpty ||
        packagePriceController.text.trim().isNotEmpty) {
      selectedComfortPackage.value = null;
    }
  }

  /// Same label string as the "Select Your Vehicle" dropdown (must match [_vehicleLabelToId] keys).
  String? _vehicleDropdownLabel(VehicleModel v) {
    final id = v.id;
    if (id == null) return null;
    final label = [
      if (v.year != null) v.year!,
      v.make ?? '',
      v.model ?? '',
      if (v.color != null) '· ${v.color}',
    ].join(' ');
    if (label.trim().isEmpty) return null;
    return label;
  }

  /// Label for the user's default vehicle when it appears in the current option list.
  String? _defaultVehicleLabelInOptions(List<String> optionLabels) {
    for (final v in myVehicles) {
      if (!v.isDefault) continue;
      final label = _vehicleDropdownLabel(v);
      if (label != null && optionLabels.contains(label)) return label;
    }
    return null;
  }

  void _updateVehicleOptions() {
    _vehicleLabelToId.clear();

    final newOptions = <String>[];
    for (final v in myVehicles) {
      final label = _vehicleDropdownLabel(v);
      if (label == null) continue;
      _vehicleLabelToId[label] = v.id!;
      newOptions.add(label);
    }

    vehicleOptions.assignAll([...newOptions, addNewVehicleOptionLabel]);
    evVehicleOptions.assignAll([...newOptions, addNewVehicleOptionLabel]);

    final sel = selectedVehicle.value;
    final hasValidSelectedVehicle =
        sel != null && _vehicleLabelToId.containsKey(sel);

    if (hasValidSelectedVehicle) {
      selectedVehicleId.value = _vehicleLabelToId[sel];
      vehicleDropdownRenderVersion.value++;
      return;
    }

    // Never keep the action item ("Add new vehicle...") as selected value.
    if (newOptions.isNotEmpty) {
      final preferred =
          _defaultVehicleLabelInOptions(newOptions) ?? newOptions.first;
      selectedVehicle.value = preferred;
      selectedVehicleId.value = _vehicleLabelToId[preferred];
    } else {
      selectedVehicle.value = null;
      selectedVehicleId.value = null;
    }
    vehicleDropdownRenderVersion.value++;
  }

  Future<void> bookingStep3({bool advanceToNextStepOnSuccess = false}) async {
    if (isLoading.value) return;

    final bookingId = bookingApiId.value;
    if (bookingId == null) {
      showAppSnackBar(
        title: 'Booking not started',
        message: 'Please complete the previous step before continuing.',
        isError: true,
      );
      return;
    }

    final vehicleId = selectedVehicleId.value;
    if (vehicleId == null) {
      showAppSnackBar(
        title: 'Vehicle required',
        message: 'Please select your vehicle before continuing.',
        isError: true,
      );
      return;
    }

    isLoading.value = true;
    Loader.showLoading();
    try {
      final notes = serviceNotesFormData;
      final providerNotes = buildEvAccountCardOnFileNotes(
        notes: otherNotesVehicleController.text.trim(),
        hasCardOnFile: requiresEvBatteryOnVehicleStep
            ? evAccountCardOnFile.value
            : null,
      );
      final result = await _vehicleRepo.bookingStep3(
        bookingId: bookingId,
        vehicleId: vehicleId,
        vehicleParkedLocation: BookingServiceNotes.apiValueForVehicleParked(
          notes.vehicleParkedLocation,
        ),
        vehicleParkedLocationOther: notes.vehicleParkedLocationOther,
        providerParkLocation: BookingServiceNotes.apiValueForProviderPark(
          notes.providerParkLocation,
        ),
        providerParkLocationOther: notes.providerParkLocationOther,
        vehicleKeyLocation: BookingServiceNotes.apiValueForVehicleKey(
          notes.vehicleKeyLocation,
        ),
        vehicleKeyLocationOther: notes.vehicleKeyLocationOther,
        keyReturnLocation: BookingServiceNotes.apiValueForKeyReturn(
          notes.keyReturnLocation,
        ),
        keyReturnLocationOther: notes.keyReturnLocationOther,
        vehicleChargeLimit: (isEvChargingFlow || isCombinedServiceFlow)
            ? _vehicleChargeLimitForApi()
            : null,
        currentBatteryCharge: requiresEvBatteryOnVehicleStep
            ? _evCurrentBatteryChargeForApi()
            : null,
        currentBatteryStatus: requiresEvBatteryOnVehicleStep
            ? _evCurrentBatteryStatusForApi()
            : null,
        notes: providerNotes.isEmpty ? null : providerNotes,
        evAccountCardOnFile: requiresEvBatteryOnVehicleStep
            ? evAccountCardOnFile.value
            : null,
        imagePaths: localVehiclePhotoPaths,
      );

      result.when(
        success: (_) async {
          final uploadedLocalPaths = localVehiclePhotoPaths.toList(
            growable: false,
          );
          // Disable internal photo sync so this call site can do a single,
          // controlled merge below — prevents duplicate display during the
          // intermediate rebuild window.
          final ok = await fetchBookingReview(syncPhotos: false);
          if (!ok) return;
          final remoteUrls = _extractReviewImageUrls(bookingReviewData.value);
          if (remoteUrls.isNotEmpty) {
            // Server has the uploaded photo(s) — use only those + nothing else.
            // Remove any local file paths (they've been uploaded), then sync
            // once cleanly so the list reflects exactly what the server has.
            vehiclePhotoPaths.removeWhere((p) => !p.trim().startsWith('http'));
            _syncVehiclePhotosFromReview(bookingReviewData.value);
          } else if (uploadedLocalPaths.isNotEmpty) {
            // Upload succeeded but server review doesn't yet reflect the image
            // (race condition) — keep the local paths as a temporary display.
            final existing = vehiclePhotoPaths
                .map((p) => p.trim())
                .where((p) => p.isNotEmpty)
                .toList();
            for (final path in uploadedLocalPaths) {
              if (!existing.contains(path)) existing.add(path);
            }
            vehiclePhotoPaths.assignAll(existing);
            vehiclePhotoPaths.refresh();
          }
          if (advanceToNextStepOnSuccess &&
              currentStep.value < flowStepCount - 1) {
            currentStep.value++;
          }
        },
        error: (err) {
          Loader.hideLoading();
          showAppSnackBar(
            title: 'Vehicle details failed',
            message: err.message,
            isError: true,
          );
        },
      );
    } catch (error) {
      showAppSnackBar(
        title: 'Vehicle photo upload failed',
        message: error.toString().replaceFirst('Exception: ', ''),
        isError: true,
      );
    } finally {
      Loader.hideLoading();
      isLoading.value = false;
    }
  }

  String? _vehicleChargeLimitForApi() {
    final selected = selectedEvChargeLimit.value?.trim() ?? '';
    if (selected.isEmpty) return null;
    final digits = selected.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.isEmpty) return null;
    return digits;
  }

  String? _evCurrentBatteryStatusForApi() {
    final selected =
        (selectedEvBatteryStatus.value ?? evBatteryStatusController.text)
            .trim();
    if (validateEvBatteryStatus(selected) != null) return null;
    return EvChargingBookingOptions.optionForLabel(selected)?.value;
  }

  /// Pricing percent for charge-limit auto-sync and legacy API field.
  String? _evCurrentBatteryChargeForApi() {
    final selected =
        (selectedEvBatteryStatus.value ?? evBatteryStatusController.text)
            .trim();
    if (validateEvBatteryStatus(selected) != null) return null;
    final pricingPercent = EvChargingBookingOptions.optionForLabel(
      selected,
    )?.pricingPercent;
    return pricingPercent?.toString();
  }

  int? _evChargeLimitOptionPercent(String? label) {
    if (label == null || label.trim().isEmpty) return null;
    final digits = label.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.isEmpty) return null;
    return int.tryParse(digits);
  }

  /// Smallest charge-limit option strictly above [soc], or `100%` if [soc] is full.
  String? _firstEvChargeLimitAboveSoc(int soc) {
    for (final opt in evChargeLimitOptions) {
      final p = _evChargeLimitOptionPercent(opt);
      if (p != null && p > soc) return opt;
    }
    if (soc >= 100) return '100%';
    return null;
  }

  void _scheduleSyncEvChargeLimitFromBatteryStatus() {
    _evBatteryChargeLimitSyncDebounce?.cancel();
    _evBatteryChargeLimitSyncDebounce = Timer(
      const Duration(milliseconds: 350),
      _syncEvChargeLimitFromBatteryStatusNow,
    );
  }

  void _syncEvChargeLimitFromBatteryStatusNow() {
    if (!requiresEvBatteryOnVehicleStep) return;
    final option = EvChargingBookingOptions.optionForLabel(
      selectedEvBatteryStatus.value,
    );
    if (option == null) return;

    // "Above" is separate from exact 50% and charge-limit 50%.
    if (option.value == 'above') return;

    // Exact 50% battery can keep a 50% charge limit without auto-bumping.
    if (option.value == '50') {
      final selectedPct = _evChargeLimitOptionPercent(
        selectedEvChargeLimit.value,
      );
      if (selectedPct != null && selectedPct >= 50) return;
      if ((selectedEvChargeLimit.value ?? '').trim().isEmpty) {
        selectedEvChargeLimit.value = '50%';
      }
      return;
    }

    final soc = option.pricingPercent;
    final selectedPct = _evChargeLimitOptionPercent(
      selectedEvChargeLimit.value,
    );
    if (selectedPct != null && selectedPct > soc) return;
    final next = _firstEvChargeLimitAboveSoc(soc);
    if (next == null) return;
    if (selectedEvChargeLimit.value != next) {
      selectedEvChargeLimit.value = next;
      reviewRevision.value++;
    }
  }

  Future<bool> fetchBookingReview({bool syncPhotos = true}) async {
    final bookingId = bookingApiId.value;
    if (bookingId == null) return false;
    final res = await _vehicleRepo.bookingReview(bookingId: bookingId);
    var ok = false;
    res.when(
      success: (data) {
        bookingReviewData.value = data.data;
        _hydrateScheduleFromReview(data.data);
        _hydrateServiceNotesFromReview(data.data?.serviceNotes);
        // Only auto-sync photos when the caller doesn't need to do its own
        // post-processing merge (avoids double-sync with stale local paths).
        if (syncPhotos) _syncVehiclePhotosFromReview(data.data);
        reviewRevision.value++;
        ok = true;
      },
      error: (err) {
        showAppSnackBar(
          title: 'Review failed',
          message: err.message,
          isError: true,
        );
        ok = false;
      },
    );
    return ok;
  }

  PaymentMethodsController _ensurePaymentMethodsController() {
    if (!Get.isRegistered<PaymentMethodsController>()) {
      PaymentMethodsBinding().dependencies();
    }
    return Get.find<PaymentMethodsController>();
  }

  Future<String?> _resolvePaymentMethodId() async {
    final pm = _ensurePaymentMethodsController();
    if (!pm.hasLoadedCardsAtLeastOnce && !pm.isLoading.value) {
      await pm.loadCards(showLoader: false);
    }
    if (pm.cards.isEmpty) return null;
    final sel = pm.cards.firstWhereOrNull((e) => e.isDefault) ?? pm.cards.first;
    return sel.id.trim().isEmpty ? null : sel.id.trim();
  }

  void _refreshDashboardIfRegistered() {
    if (!Prefs().isCustomerRole) return;
    if (!Get.isRegistered<DashboardController>()) return;
    final dash = Get.find<DashboardController>();
    unawaited(dash.refreshBookings());
    dash.refreshProfileHeader();
    // Show the booking panel on home screen immediately after booking is confirmed.
    final bookingId = bookingApiId.value;
    if (bookingId != null && bookingId > 0) {
      dash.activateCustomerBookingConfirmedPanel(bookingId);
    }
  }

  Future<void> bookingConfirm() async {
    if (isLoading.value) return;
    final bookingId = bookingApiId.value;
    if (bookingId == null) {
      showAppSnackBar(
        title: 'Booking not started',
        message: 'Please complete the previous steps before confirming.',
        isError: true,
      );
      return;
    }

    final pmId = await _resolvePaymentMethodId();
    if (pmId == null) {
      showAppSnackBar(
        title: 'Payment required',
        message: 'Please select a payment method to confirm booking.',
        isError: true,
      );
      unawaited(toNamed(Routes.PAYMENT_METHOD));
      return;
    }

    isLoading.value = true;
    Loader.showLoading();
    var shouldShowConfirmedDialog = false;

    try {
      final res = await _vehicleRepo.bookingConfirm(
        bookingId: bookingId,
        paymentMethodId: pmId,
      );

      res.when(
        success: (confirmRes) {
          _confirmedBookingIdDisplay = null;
          _confirmedServiceTypeLabel = null;
          final data = confirmRes.data;
          if (data != null) {
            if (data.bookingId != null) {
              bookingApiId.value = data.bookingId;
            } else {
              final rawDisplay =
                  data.bookingIdDisplay ?? data.confirmation?.bookingIdDisplay;
              if (rawDisplay != null && rawDisplay.trim().isNotEmpty) {
                final parsed = int.tryParse(rawDisplay.trim());
                bookingApiId.value = parsed ?? bookingApiId.value;
              }
            }
            if ((data.bookingCode ?? '').trim().isNotEmpty) {
              bookingCode.value = data.bookingCode!.trim();
            }
            final displayId =
                (data.bookingIdDisplay ?? data.confirmation?.bookingIdDisplay)
                    ?.trim();
            if (displayId != null && displayId.isNotEmpty) {
              _confirmedBookingIdDisplay = displayId;
            } else {
              _confirmedBookingIdDisplay = null;
            }
            final typeLabel =
                (data.serviceTypeLabel ?? data.confirmation?.serviceTypeLabel)
                    ?.trim();
            if (typeLabel != null && typeLabel.isNotEmpty) {
              _confirmedServiceTypeLabel = typeLabel;
            } else {
              _confirmedServiceTypeLabel = null;
            }
            final total = data.priceSummary?.total ?? data.transaction?.amount;
            if (total != null) {
              confirmedTotalPrice.value = total.toDouble();
            }
          }
          shouldShowConfirmedDialog = true;
          _refreshDashboardIfRegistered();
        },
        error: (err) {
          Loader.hideLoading();
          showAppSnackBar(
            title: 'Confirm failed',
            message: err.message,
            isError: true,
          );
        },
      );
    } finally {
      Loader.hideLoading();
      isLoading.value = false;
    }

    if (shouldShowConfirmedDialog) {
      _showBookingConfirmed();
    }
  }

  String get reviewApiAddress => reviewPickupAddressDisplay;

  String get reviewPickupAddressDisplay => reviewCustomerAddress;

  String get reviewApiServiceLocationName => reviewServiceLocationDisplay;

  String formatReviewLocationNameAndAddress({String? name, String? address}) {
    final n = (name ?? '').trim();
    final a = (address ?? '').trim();
    if (n.isNotEmpty && a.isNotEmpty) {
      if (a == n || a.startsWith(n)) return a;
      return '$n\n$a';
    }
    if (a.isNotEmpty) return a;
    if (n.isNotEmpty) return n;
    return '—';
  }

  (String?, String?) _parseCarWashSelectionLabel(String? label) {
    final t = (label ?? '').trim();
    if (t.isEmpty) return (null, null);
    final idx = t.indexOf('•');
    if (idx > 0) {
      return (t.substring(0, idx).trim(), t.substring(idx + 1).trim());
    }
    return (t, null);
  }

  String get reviewCarWashServiceLocationLine {
    var name = (selectedCarWashLocationName.value ?? '').trim();
    var address = (selectedCarWashAddress.value ?? '').trim();

    if (name.isEmpty || address.isEmpty) {
      final parsed = _parseCarWashSelectionLabel(selectedCarWash.value);
      if (name.isEmpty) name = (parsed.$1 ?? '').trim();
      if (address.isEmpty) address = (parsed.$2 ?? '').trim();
    }

    final apiLoc = bookingReviewData.value?.location?.serviceLocation;
    if (name.isEmpty) name = (apiLoc?.name ?? '').trim();
    if (address.isEmpty) address = (apiLoc?.address ?? '').trim();

    if (address.isEmpty && serviceLocationController.text.trim().isNotEmpty) {
      address = serviceLocationController.text.trim();
    }

    return formatReviewLocationNameAndAddress(name: name, address: address);
  }

  String get reviewEvChargingServiceLocationLine {
    var name = (selectedEvChargingLocationName.value ?? '').trim();
    var address = (selectedEvStationAddress.value ?? '').trim();

    if (name.isEmpty) name = selectedEvStation.shortName.trim();
    if (address.isEmpty) address = selectedEvStation.address.trim();

    final apiEv = bookingReviewData.value?.location?.evCharging;
    if (name.isEmpty) name = (apiEv?.name ?? '').trim();
    if (address.isEmpty) address = (apiEv?.address ?? '').trim();

    return formatReviewLocationNameAndAddress(name: name, address: address);
  }

  String get reviewServiceLocationDisplay {
    if (isCombinedServiceFlow) {
      return reviewCombinedWashServiceLocation;
    }
    if (isEvChargingFlow) {
      return reviewEvChargingServiceLocationLine;
    }
    return reviewCarWashServiceLocationLine;
  }

  String get reviewApiPackageName {
    final sd = bookingReviewData.value?.serviceDetails;
    final fromPkg = _reviewPackageDisplayName(sd?.package);
    if (fromPkg != null && fromPkg.isNotEmpty) return fromPkg;
    final custom = sd?.customPackageName?.toString();
    if (custom != null && custom.trim().isNotEmpty) return custom.trim();
    return reviewPackageLine;
  }

  /// Car wash menu package selected from CarComfort dropdown (not typed manually).
  bool get reviewIsCarComfortPackage {
    if (reviewIsCustomPackage) return false;
    final sd = bookingReviewData.value?.serviceDetails;
    if (sd?.packageId != null) return true;
    if (_reviewPackageDisplayName(sd?.package) != null) return true;
    return isCarComfortPackageSelected;
  }

  /// Package name entered manually on the service step.
  bool get reviewIsCustomPackage {
    final sd = bookingReviewData.value?.serviceDetails;
    final custom = sd?.customPackageName?.toString().trim();
    if (custom != null && custom.isNotEmpty) return true;
    return _usesCustomPackage;
  }

  String get reviewSelectedPackageName => reviewApiPackageName;

  /// [ServiceDetails.package] is `dynamic` (often a JSON [Map]); never use `.name` directly.
  String? _reviewPackageDisplayName(dynamic pkg) {
    if (pkg == null) return null;
    if (pkg is String) {
      final t = pkg.trim();
      return t.isEmpty ? null : t;
    }
    if (pkg is Map) {
      final m = Map<String, dynamic>.from(pkg);
      for (final key in ['name', 'title', 'label', 'package_name']) {
        final v = m[key];
        if (v != null) {
          final s = v.toString().trim();
          if (s.isNotEmpty) return s;
        }
      }
    }
    return null;
  }

  DateTime? _scheduledAtFromApiLocal() {
    final raw = bookingReviewData.value?.serviceDetails?.scheduledAt
        ?.toString();
    if (raw == null || raw.trim().isEmpty) return null;
    final dt = DateTime.tryParse(raw.trim());
    return dt?.toLocal();
  }

  String _formatReviewClockTime(DateTime dt) {
    final h = dt.hour;
    final h12 = h > 12 ? h - 12 : (h == 0 ? 12 : h);
    final ap = h >= 12 ? 'PM' : 'AM';
    final m = dt.minute.toString().padLeft(2, '0');
    return '$h12:$m $ap';
  }

  /// Review schedule date — prefers the picker on step 2, then API (local time).
  String get reviewScheduledDateLine {
    if (isScheduleAsap) return 'As soon as possible';
    final picked = scheduledServiceDate.value;
    if (picked != null) {
      return '${picked.month}/${picked.day}/${picked.year}';
    }
    final api = _scheduledAtFromApiLocal();
    if (api != null) return '${api.month}/${api.day}/${api.year}';
    return '—';
  }

  /// Review schedule time — prefers the picker on step 2, then API (local time).
  String get reviewScheduledTimeLine {
    if (!isScheduleScheduled) return '—';
    final picked = scheduledServiceTime.value;
    if (picked != null) return evReviewTimeFormatted;
    final api = _scheduledAtFromApiLocal();
    if (api != null) return _formatReviewClockTime(api);
    return '—';
  }

  String get reviewApiDateLine => reviewScheduledDateLine;

  String get reviewApiTimeLine => reviewScheduledTimeLine;

  int? _durationMinutesFromReviewPackage(dynamic pkg) {
    if (pkg is! Map) return null;
    final m = Map<String, dynamic>.from(pkg);
    for (final key in ['duration_minutes', 'durationMinutes']) {
      final v = m[key];
      if (v is num && v > 0) return v.round();
      if (v is String) {
        final n = int.tryParse(v.trim());
        if (n != null && n > 0) return n;
      }
    }
    return null;
  }

  int _resolveReviewServiceDurationMinutes({bool evSegment = false}) {
    if (!evSegment) {
      final fromSelected = selectedComfortPackageData?.durationMinutes;
      if (fromSelected != null && fromSelected > 0) return fromSelected;

      final fromApi = _durationMinutesFromReviewPackage(
        bookingReviewData.value?.serviceDetails?.package,
      );
      if (fromApi != null && fromApi > 0) return fromApi;
    }

    final serviceType = evSegment
        ? 'ev_charging'
        : (isCombinedServiceFlow
              ? 'combo'
              : (isEvChargingFlow ? 'ev_charging' : 'car_wash'));

    return fallbackServiceDurationMinutes(
      serviceType: serviceType,
      packageName: evSegment ? null : reviewApiPackageName,
    );
  }

  /// Car wash / combo wash segment — package duration when available.
  String get reviewEstimatedServiceDurationLine =>
      formatJobDurationLabel(_resolveReviewServiceDurationMinutes());

  /// EV charging segment on EV-only and combo bookings.
  String get reviewEstimatedEvChargingDurationLine => formatJobDurationLabel(
    _resolveReviewServiceDurationMinutes(evSegment: true),
  );

  void _hydrateServiceNotesFromReview(br.ServiceNotes? sn) {
    if (sn == null) return;
    void setChoice({
      required RxnString target,
      required TextEditingController otherController,
      String? apiValue,
      String? label,
      String? other,
      required String? Function(String? value, {String? other}) resolveLabel,
    }) {
      if (label != null && label.trim().isNotEmpty) {
        target.value = label.trim();
      } else if (apiValue != null && apiValue.trim().isNotEmpty) {
        final resolved = resolveLabel(apiValue, other: other);
        if (resolved != null && resolved.trim().isNotEmpty) {
          target.value = resolved.trim();
        } else if (apiValue.trim().toLowerCase() == 'other') {
          target.value = BookingServiceNotes.otherLabel;
        }
      }
      if (other != null && other.trim().isNotEmpty) {
        otherController.text = other.trim();
        if (target.value == null || target.value!.isEmpty) {
          target.value = BookingServiceNotes.otherLabel;
        }
      }
    }

    setChoice(
      target: selectedVehicleParkedLocation,
      otherController: vehicleParkedLocationOtherController,
      apiValue: sn.vehicleParkedLocation,
      label: sn.vehicleParkedLocationLabel,
      other: sn.vehicleParkedLocationOther,
      resolveLabel: BookingServiceNotes.labelForVehicleParked,
    );
    setChoice(
      target: selectedProviderParkLocation,
      otherController: providerParkLocationOtherController,
      apiValue: sn.providerParkLocation,
      label: sn.providerParkLocationLabel,
      other: sn.providerParkLocationOther,
      resolveLabel: BookingServiceNotes.labelForProviderPark,
    );
    setChoice(
      target: selectedVehicleKeyLocation,
      otherController: vehicleKeyLocationOtherController,
      apiValue: sn.vehicleKeyLocation,
      label: sn.vehicleKeyLocationLabel,
      other: sn.vehicleKeyLocationOther,
      resolveLabel: BookingServiceNotes.labelForVehicleKey,
    );
    setChoice(
      target: selectedKeyReturnLocation,
      otherController: keyReturnLocationOtherController,
      apiValue: sn.keyReturnLocation,
      label: sn.keyReturnLocationLabel,
      other: sn.keyReturnLocationOther,
      resolveLabel: BookingServiceNotes.labelForKeyReturn,
    );
    final extra = sn.notes?.trim() ?? '';
    if (extra.isNotEmpty) {
      otherNotesVehicleController.text = extra;
    }
  }

  void _hydrateScheduleFromReview(br.Data? data) {
    final raw = data?.serviceDetails?.scheduledAt?.toString();
    if (raw == null || raw.trim().isEmpty) return;
    final local = DateTime.tryParse(raw.trim())?.toLocal();
    if (local == null) return;
    scheduledServiceDate.value ??= DateTime(local.year, local.month, local.day);
    if (scheduledServiceDate.value != null) {
      scheduledServiceDateController.text = formatUsDate(
        scheduledServiceDate.value!,
      );
    }
    scheduledServiceTime.value ??= TimeOfDay(
      hour: local.hour,
      minute: local.minute,
    );
  }

  String get reviewApiVehicleLine {
    final v = bookingReviewData.value?.vehicle;
    if (v == null) return reviewVehicleLine;
    final parts = [
      if (v.year != null) v.year.toString(),
      if ((v.make ?? '').trim().isNotEmpty) v.make!.trim(),
      if ((v.model ?? '').trim().isNotEmpty) v.model!.trim(),
    ];
    final label = parts.join(' ');
    return label.trim().isEmpty ? reviewVehicleLine : label;
  }

  String get reviewApiVehicleColor =>
      bookingReviewData.value?.vehicle?.color ?? reviewEvVehicleColor;

  String get reviewApiVehicleLicense =>
      bookingReviewData.value?.vehicle?.licensePlate ??
      reviewCarWashLicenseDisplay;

  List<String> get reviewApiImages {
    final raw = bookingReviewData.value?.bookingImages;
    if (raw == null || raw.isEmpty) return const <String>[];
    return raw
        .map(_bookingReviewImageUrl)
        .where((s) => s.isNotEmpty)
        .toList(growable: false);
  }

  /// Local uploads and booking review images — for review UI.
  ///
  /// NOTE: `vehicle.images` from the booking review API are NOT included here.
  /// Those are stored profile photos for the customer's vehicle that may come
  /// from previous sessions. Only photos explicitly captured or selected in
  /// the current booking flow (vehiclePhotoPaths + bookingImages) are shown.
  List<String> get reviewVehicleImageUrls {
    final seen = <String>{};
    final merged = <String>[];

    void addAll(Iterable<String> urls) {
      for (final raw in urls) {
        final url = raw.trim();
        if (url.isEmpty || !seen.add(url)) continue;
        merged.add(url);
      }
    }

    addAll(vehiclePhotoPaths);
    addAll(reviewApiImages);

    return merged;
  }

  bool get hasReviewServiceNotes {
    if (serviceNotesFormData.displayRows.isNotEmpty) return true;
    if (reviewApiServiceNoteRows.isNotEmpty) return true;
    if (reviewServiceNotesSummary.trim().isNotEmpty) return true;
    if (reviewOtherNotes.trim().isNotEmpty) return true;
    return false;
  }

  List<({String question, String answer})> get reviewApiServiceNoteRows {
    final sn = bookingReviewData.value?.serviceNotes;
    if (sn == null) return const [];
    return BookingServiceNotesFormData.rowsFromDetail(
      vehicleParkedLocationLabel: sn.vehicleParkedLocationLabel,
      vehicleParkedLocation: sn.vehicleParkedLocation,
      vehicleParkedLocationOther: sn.vehicleParkedLocationOther,
      providerParkLocationLabel: sn.providerParkLocationLabel,
      providerParkLocation: sn.providerParkLocation,
      providerParkLocationOther: sn.providerParkLocationOther,
      vehicleKeyLocationLabel: sn.vehicleKeyLocationLabel,
      vehicleKeyLocation: sn.vehicleKeyLocation,
      vehicleKeyLocationOther: sn.vehicleKeyLocationOther,
      keyReturnLocationLabel: sn.keyReturnLocationLabel,
      keyReturnLocation: sn.keyReturnLocation,
      keyReturnLocationOther: sn.keyReturnLocationOther,
      parkingInstructions: sn.parkingInstructions,
    );
  }

  String _bookingReviewImageUrl(dynamic e) {
    String _extractRaw(dynamic src) {
      if (src == null) return '';
      if (src is String) return src.trim();
      if (src is Map) {
        final m = Map<String, dynamic>.from(src);
        // Include 'value' as a fallback key: Dynamic.fromJson(urlString) wraps
        // plain-string entries from booking_images as {'value': url}, so the
        // extractor must check 'value' to surface those URLs.
        for (final key in [
          'url',
          'image_url',
          'imageUrl',
          'image_path',
          'imagePath',
          'value',
        ]) {
          final v = m[key];
          if (v is String && v.trim().isNotEmpty) return v.trim();
        }
      }
      return '';
    }

    var raw = _extractRaw(e);
    if (raw.isEmpty) {
      try {
        final json = (e as dynamic).toJson();
        raw = _extractRaw(json);
      } catch (_) {}
    }
    if (raw.isEmpty) return '';

    // Filter sentinel/null strings before resolving.
    final lower = raw.toLowerCase();
    if (lower == 'null' || lower == 'undefined' || lower == 'none') return '';

    // Resolve relative paths to absolute URLs (e.g. /uploads/vehicle/x.jpg).
    final resolved = MediaUrl.resolve(raw);
    // After resolution, reject any URL that still cannot be an HTTP address.
    if (!resolved.startsWith('http://') && !resolved.startsWith('https://')) {
      return '';
    }
    return resolved;
  }

  double get reviewApiBasePrice => 0;

  double get reviewApiServiceFee => 0;

  double get reviewApiPlatformFee => 0;

  double get reviewApiTax => _priceSummaryAmountForKey('tax').abs();

  double get reviewApiTaxPercent => _priceSummaryPercentForKey('tax');

  double get reviewApiDiscountPercent =>
      _priceSummaryPercentForKey('discount_promotion');

  double get reviewApiTotalPrice =>
      (_reviewPriceSummary?.total ?? totalPrice).toDouble();

  /// e.g. `10` → ` (10%)`; empty if [percent] is null.
  String _reviewPercentSuffix(num? percent) {
    if (percent == null) return '';
    return ' (${percent.round()}%)';
  }

  String get reviewPriceLabelPackagePrice => 'Package Price';

  String get reviewPriceLabelServiceFee =>
      'Service fee${_reviewPercentSuffix(null)}';

  String get reviewPriceLabelPlatformFee =>
      'Platform fee${_reviewPercentSuffix(null)}';

  String get reviewPriceLabelTax => 'Tax${_reviewPercentSuffix(null)}';

  String get reviewPriceLabelReferralDiscount => 'Referral discount';

  /// Positive dollars discounted via referral (API `referral_discount_amount`).
  double get reviewApiReferralDiscountAmount =>
      _priceSummaryAmountForKey('discount').abs();

  /// Shown in Price Summary only when API `referral_discount_amount` is positive.
  bool get reviewShowReferralDiscountLine =>
      reviewApiReferralDiscountAmount > 0;

  String get reviewReferralDiscountDisplay =>
      '\$${reviewApiReferralDiscountAmount.toStringAsFixed(2)}';

  br.PriceSummary? get _reviewPriceSummary =>
      bookingReviewData.value?.priceSummary;

  String get reviewPriceSummaryTitle {
    final t = (_reviewPriceSummary?.title ?? 'CarComfort Price Summary').trim();
    return t.isEmpty ? 'CarComfort Price Summary' : t;
  }

  String get reviewPriceSummaryTotalLabel => 'Total';

  String get reviewPriceSummaryTotalDisplay {
    final total = _reviewPriceSummary?.total ?? reviewApiTotalPrice;
    return '\$${total.toStringAsFixed(2)}';
  }

  List<ReviewPriceSummaryLine> get reviewPriceSummaryDisplayLines {
    final ps = _reviewPriceSummary;
    if (ps?.applicableCharges != null && ps!.applicableCharges!.isNotEmpty) {
      return _priceSummaryLinesFromApi(ps);
    }
    return _priceSummaryLinesFallback();
  }

  /// Keys that must be hidden for EV-only bookings regardless of API data.
  static const _evExcludedKeys = {'detailing', 'vehicle_type'};

  List<ReviewPriceSummaryLine> _priceSummaryLinesFromApi(br.PriceSummary ps) {
    final rows = <ReviewPriceSummaryLine>[];
    final lines = ps.applicableCharges ?? const <br.Lines>[];

    for (var i = 0; i < lines.length; i++) {
      final line = lines[i];
      final key = (line.key ?? '').trim().toLowerCase();
      // Interior/exterior detailing and vehicle-type charges must never
      // appear for EV-only bookings. Guard defensively here in addition
      // to the backend filter so stale cached data cannot surface them.
      if (isEvChargingFlow && _evExcludedKeys.contains(key)) continue;
      // When membership wash or custom package is active, hide car-wash and
      // estimated fee lines — these have no charge to display to the customer.
      if ((hasMembershipWash.value || _usesCustomPackage) &&
          (key == 'car_wash' ||
              key == 'carwash' ||
              key == 'car_wash_fee' ||
              key == 'estimated_car_wash_fee')) {
        continue;
      }
      // Estimated charging cost is not applicable when a custom package is chosen.
      if (_usesCustomPackage && key == 'estimated_charging_cost') {
        continue;
      }
      final label = _priceSummaryLineLabel(line);
      if (label.isEmpty) continue;

      final rawSectionTitle = (line.sectionTitle ?? '').trim();
      final sectionTitle = _remapSectionTitle(rawSectionTitle);
      if (sectionTitle.isNotEmpty) {
        rows.add(
          ReviewPriceSummaryLine(
            label: sectionTitle,
            valueText: '',
            labelColor: brandRed,
            isSectionHeader: true,
          ),
        );
      }

      rows.add(
        ReviewPriceSummaryLine(
          label: label,
          valueText: _priceSummaryLineValue(line, ps),
          labelColor:
              key == 'customer_preferred_package' ||
                  key == 'package' ||
                  sectionTitle.isNotEmpty
              ? null
              : (_priceSummaryLineIsHighlighted(key, i) ? brandRed : null),
          isSubtotal: key == 'subtotal',
        ),
      );
    }

    return rows;
  }

  List<ReviewPriceSummaryLine> _priceSummaryLinesFallback() {
    final vehicleType =
        (bookingReviewData.value?.vehicle?.vehicleType ?? 'Sedan').trim();
    final customName = (packageNameController.text).trim();
    final customPrice = double.tryParse(
      normalizePackagePrice(packagePriceController.text) ?? '',
    );
    final usesCustom = _usesCustomPackage;
    final packageLabel = usesCustom && customName.isNotEmpty
        ? customName
        : (selectedComfortPackage.value ?? '').trim().isNotEmpty
        ? selectedComfortPackage.value!.trim()
        : 'Basic car wash';
    final packageAmount = usesCustom && customPrice != null
        ? customPrice
        : reviewApiBasePrice;

    final rows = <ReviewPriceSummaryLine>[];

    // Estimated charging cost is only shown when NOT using a custom package.
    if ((isEvChargingFlow || isCombinedServiceFlow) && !_usesCustomPackage) {
      rows.add(
        ReviewPriceSummaryLine(
          label: 'Estimated charging cost',
          valueText: '\$0.00',
        ),
      );
    }

    // Hide the car wash fee line when the customer has a membership, a custom
    // package, or is in an EV-only flow (cost is handled separately or n/a).
    if (!isEvChargingFlow && !hasMembershipWash.value && !_usesCustomPackage) {
      rows.add(
        ReviewPriceSummaryLine(
          label: 'Estimated car wash fee',
          valueText: '\$0.00',
        ),
      );
    }

    // Interior/exterior detailing is never applicable for EV-only bookings.
    final detailingAmount = _priceSummaryAmountForKey('detailing');
    if (!isEvChargingFlow && detailingAmount > 0) {
      rows.add(
        ReviewPriceSummaryLine(
          label: 'Interior/exterior detailing fee',
          valueText: '\$${detailingAmount.toStringAsFixed(2)}',
        ),
      );
    }

    if (usesCustom) {
      final serviceFeeAmount =
          _priceSummaryAmountForKey('carcomfort_service_fee') +
          _priceSummaryAmountForKey('service_fee');
      if (serviceFeeAmount > 0) {
        rows.add(
          ReviewPriceSummaryLine(
            label: 'CarComfort service fee',
            valueText: '\$${serviceFeeAmount.toStringAsFixed(2)}',
          ),
        );
      }
    }

    // Vehicle-type surcharge does not apply to EV-only bookings.
    final vehicleAmount = _priceSummaryAmountForKey('vehicle_type');
    if (!isEvChargingFlow && vehicleType.isNotEmpty) {
      rows.add(
        ReviewPriceSummaryLine(
          label: 'Vehicle type ($vehicleType)',
          valueText: vehicleAmount > 0
              ? '\$${vehicleAmount.toStringAsFixed(2)}'
              : '\$0.00',
        ),
      );
    }

    final convenienceAmount = _priceSummaryAmountForKey('convenience');
    if (convenienceAmount > 0) {
      rows.add(
        ReviewPriceSummaryLine(
          label: 'Convenience fee',
          valueText: '\$${convenienceAmount.toStringAsFixed(2)}',
        ),
      );
    }

    final discountAmount = reviewApiReferralDiscountAmount;
    rows.add(
      ReviewPriceSummaryLine(
        label: 'Discount and savings',
        valueText: discountAmount > 0
            ? '-\$${discountAmount.toStringAsFixed(2)}'
            : '\$0.00',
      ),
    );

    rows.add(
      ReviewPriceSummaryLine(
        label: 'Taxes',
        valueText: '\$${reviewApiTax.toStringAsFixed(2)}',
      ),
    );

    return rows;
  }

  bool _priceSummaryLineIsHighlighted(String key, int index) {
    if (index == 0) return true;
    return key.contains('basic') ||
        key.contains('package') ||
        key.contains('car_comfort');
  }

  /// Remaps known API section title strings to the preferred display text.
  String _remapSectionTitle(String title) {
    final lower = title.toLowerCase();
    if (lower == 'customer preferred package' ||
        lower == 'customer preferred') {
      return 'Custom Package';
    }
    return title;
  }

  String _priceSummaryLineLabel(br.Lines line) {
    final key = (line.key ?? '').trim().toLowerCase();
    if (key == 'discount_promotion') {
      final apiLabel = (line.label ?? '').trim();
      if (apiLabel.isNotEmpty &&
          !apiLabel.toLowerCase().startsWith('discount and')) {
        return apiLabel;
      }
      return 'Discount and savings';
    }
    if (key == 'tax') return 'Taxes';

    var label = (line.label ?? '').trim();
    if (label.isEmpty) return label;

    final lower = label.toLowerCase();
    if (lower.startsWith('discount and promotion')) {
      return 'Discount and savings';
    }
    if (lower.startsWith('taxes (')) {
      return 'Taxes';
    }
    return label;
  }

  double _priceSummaryAmountForKey(String needle) {
    final keyNeedle = needle.trim().toLowerCase();
    if (keyNeedle.isEmpty) return 0;
    final lines = _reviewPriceSummary?.applicableCharges ?? const <br.Lines>[];
    for (final line in lines) {
      final key = (line.key ?? '').toLowerCase();
      if (key.contains(keyNeedle)) return line.amount ?? 0;
    }
    return 0;
  }

  double _priceSummaryPercentForKey(String needle) {
    final keyNeedle = needle.trim().toLowerCase();
    if (keyNeedle.isEmpty) return 0;
    final lines = _reviewPriceSummary?.applicableCharges ?? const <br.Lines>[];
    for (final line in lines) {
      final key = (line.key ?? '').toLowerCase();
      if (!key.contains(keyNeedle)) continue;
      final label = line.label ?? '';
      final match = RegExp(r'\((\d+(?:\.\d+)?)%\)').firstMatch(label);
      if (match != null) {
        return double.tryParse(match.group(1) ?? '') ?? 0;
      }
    }
    return 0;
  }

  String _priceSummaryLineValue(br.Lines line, br.PriceSummary ps) {
    final key = (line.key ?? '').trim().toLowerCase();
    if (key == 'estimated_car_wash_fee' || key == 'estimated_charging_cost') {
      return '\$0.00';
    }
    final custom = line.valueText?.trim();
    if (custom != null && custom.isNotEmpty) {
      var value = custom.replaceFirst(
        RegExp(r'\s+held$', caseSensitive: false),
        '',
      );
      value = value.replaceAll(
        RegExp(r'\s*\([^)]*paid at[^)]*\)', caseSensitive: false),
        '',
      );
      if (value == r'$0' || value == '0') return '\$0.00';
      return value;
    }
    final amount = line.amount ?? 0;
    if (amount < 0) {
      return '-\$${amount.abs().toStringAsFixed(2)}';
    }
    return '\$${amount.toStringAsFixed(2)}';
  }

  String _formatAvailableChargers(int? numberOfPoints) {
    if (numberOfPoints == null) return 'N/A';
    return numberOfPoints.toString();
  }

  String _formatChargingSpeed(double? powerKw) {
    if (powerKw == null || powerKw <= 0) return 'N/A';
    final isWhole = powerKw % 1 == 0;
    return isWhole
        ? '${powerKw.toInt()} kW'
        : '${powerKw.toStringAsFixed(1)} kW';
  }

  void updateVehicle(VehicleModel vehicle) async {
    final formData = dio.FormData.fromMap({
      'vehicle_type': vehicle.vehicleType,
      'make': vehicle.make,
      'model': vehicle.model,
      'year': vehicle.year,
      'color': vehicle.color,
      'nickname': vehicle.nickname,
      'license_plate': vehicle.licensePlate,
    });

    final res = await _vehicleRepo.updateVehicle(vehicle.id!, formData);
    res.when(
      success: (data) {
        final index = myVehicles.indexWhere((v) => v.id == vehicle.id);
        if (index != -1) {
          myVehicles[index] = data;
          _updateVehicleOptions();
        }
      },
      error: (e) {
        showAppSnackBar(title: 'Error', message: e.errorMessage, isError: true);
      },
    );
  }

  void deleteVehicle(int id) async {
    final res = await _vehicleRepo.deleteVehicle(id);
    res.when(
      success: (_) {
        myVehicles.removeWhere((v) => v.id == id);
        _updateVehicleOptions();
      },
      error: (e) {
        showAppSnackBar(title: 'Error', message: e.errorMessage, isError: true);
      },
    );
  }

  void _showBookingConfirmed() {
    final serviceLabel =
        (_confirmedServiceTypeLabel != null &&
            _confirmedServiceTypeLabel!.isNotEmpty)
        ? _confirmedServiceTypeLabel!
        : _displayServiceLabel;

    final bookingIdForRow = _bookingIdDisplayForConfirmationDialog();

    Get.dialog<void>(
      _BookingConfirmedDialog(
        serviceLabel: serviceLabel,
        total: confirmedTotalPrice.value ?? reviewApiTotalPrice,
        bookingIdDisplay: bookingIdForRow,
      ),
      barrierDismissible: false,
      barrierColor: Colors.black54,
    );
  }

  /// Prefer API `booking_id_display`; otherwise fall back to numeric id or code.
  String _bookingIdDisplayForConfirmationDialog() {
    final fromApi = _confirmedBookingIdDisplay?.trim();
    if (fromApi != null && fromApi.isNotEmpty) {
      return fromApi.startsWith('#') ? fromApi : '#$fromApi';
    }
    final numeric = bookingApiId.value?.toString();
    if (numeric != null && numeric.isNotEmpty) {
      return '#$numeric';
    }
    final code = bookingCode.value.trim().replaceAll('#', '');
    return code.isEmpty ? '—' : '#$code';
  }

  String? _chargerTypeForApi() {
    final selected = (selectedChargingType.value ?? '').trim();
    if (selected.isEmpty) return null;
    switch (selected) {
      case 'Tesla Supercharger':
        return 'tesla_supercharger';
      case 'DC Fast Charger':
        return 'dc_fast_charger';
      default:
        final lower = selected.toLowerCase();
        if (lower.contains('tesla') || lower.contains('supercharger')) {
          return 'tesla_supercharger';
        }
        if (lower.contains('dc fast') ||
            lower.contains('ccs') ||
            lower.contains('chademo')) {
          return 'dc_fast_charger';
        }
        return null;
    }
  }

  String get _apiServiceType {
    if (isCombinedServiceFlow) return 'combo';
    if (isEvChargingFlow) return 'ev_charging';
    return 'car_wash';
  }

  double? _resolvedPickupLatitude() =>
      selectedLatitude.value ?? _selectedLatitude;

  double? _resolvedPickupLongitude() =>
      selectedLongitude.value ?? _selectedLongitude;

  bool get _hasSelectedEvStationCoords {
    final lat = selectedEvStationLatitude.value;
    final lng = selectedEvStationLongitude.value;
    return lat != null && lng != null && lat.isFinite && lng.isFinite;
  }

  String? _coordStringForApi(double? value) {
    if (value == null || !value.isFinite) return null;
    return '$value';
  }

  Map<String, dynamic>? _buildBookingLocationPayload() {
    final address = manualAddressController.text.trim().isNotEmpty
        ? manualAddressController.text.trim()
        : customerLocationController.text.trim();
    final latitude = _resolvedPickupLatitude();
    final longitude = _resolvedPickupLongitude();
    final hasEvStation = _hasSelectedEvStationCoords;
    final serviceAddress = isCombinedServiceFlow
        ? (selectedCarWashAddress.value ?? '').trim()
        : isEvChargingFlow
        ? (hasEvStation
              ? (selectedEvStationAddress.value ?? '').trim()
              : address)
        : (selectedCarWashAddress.value ?? '').trim().isNotEmpty
        ? selectedCarWashAddress.value!.trim()
        : address;
    final serviceLatitude = isCombinedServiceFlow
        ? selectedCarWashLatitude.value ?? latitude
        : isEvChargingFlow
        ? (hasEvStation ? selectedEvStationLatitude.value : latitude)
        : selectedCarWashLatitude.value ??
              selectedEvStationLatitude.value ??
              latitude;
    final serviceLongitude = isCombinedServiceFlow
        ? selectedCarWashLongitude.value ?? longitude
        : isEvChargingFlow
        ? (hasEvStation ? selectedEvStationLongitude.value : longitude)
        : selectedCarWashLongitude.value ??
              selectedEvStationLongitude.value ??
              longitude;
    final serviceLocationName = isCombinedServiceFlow
        ? ((selectedCarWashLocationName.value ?? '').trim().isNotEmpty
              ? selectedCarWashLocationName.value!.trim()
              : null)
        : (selectedCarWashLocationName.value ?? '').trim().isNotEmpty
        ? selectedCarWashLocationName.value!.trim()
        : (selectedEvChargingLocationName.value ?? '').trim().isNotEmpty
        ? selectedEvChargingLocationName.value!.trim()
        : null;

    if (address.isEmpty) return null;
    if (latitude == null ||
        longitude == null ||
        !latitude.isFinite ||
        !longitude.isFinite) {
      return null;
    }
    if (isCombinedServiceFlow && serviceAddress.isEmpty) return null;

    return {
      'address': address,
      'latitude': latitude,
      'longitude': longitude,
      'serviceAddress': serviceAddress,
      'serviceLatitude': serviceLatitude,
      'serviceLongitude': serviceLongitude,
      'serviceLocationName': serviceLocationName,
      'evChargingAddress': (selectedEvStationAddress.value ?? '').trim(),
      'chargingLatitude': selectedEvStationLatitude.value,
      'chargingLongitude': selectedEvStationLongitude.value,
      'evChargingLocationName':
          (selectedEvChargingLocationName.value ?? '').trim().isNotEmpty
          ? selectedEvChargingLocationName.value!.trim()
          : null,
      'chargerType': isEvChargingFlow ? _chargerTypeForApi() : null,
      'evAccountCardOnFile': evAccountCardOnFile.value,
    };
  }

  Future<bool> syncBookingLocation({
    bool advanceToNextStepOnSuccess = false,
  }) async {
    if (isLoading.value) return false;

    final bookingId = bookingApiId.value;
    if (bookingId == null) return false;

    final payload = _buildBookingLocationPayload();
    if (payload == null) {
      showAppSnackBar(
        title: 'Missing info',
        message: isCombinedServiceFlow
            ? 'Please select a car wash location.'
            : 'Please wait for your location to finish loading, then try again.',
        isError: true,
      );
      return false;
    }

    final pickupLat = _coordStringForApi(payload['latitude'] as double?);
    final pickupLng = _coordStringForApi(payload['longitude'] as double?);
    final serviceLat = _coordStringForApi(
      payload['serviceLatitude'] as double?,
    );
    final serviceLng = _coordStringForApi(
      payload['serviceLongitude'] as double?,
    );
    if (pickupLat == null || pickupLng == null) {
      showAppSnackBar(
        title: 'Location not ready',
        message:
            'Please wait for your location to finish loading, then try again.',
        isError: true,
      );
      return false;
    }

    isLoading.value = true;
    Loader.showLoading();
    var ok = false;
    try {
      final result = await _vehicleRepo.bookingUpdateLocation(
        bookingId: bookingId,
        address: payload['address'] as String,
        latitude: pickupLat,
        longitude: pickupLng,
        serviceAddress: payload['serviceAddress'] as String,
        serviceLatitude: serviceLat,
        serviceLongitude: serviceLng,
        serviceLocationName: payload['serviceLocationName'] as String?,
        evChargingAddress: (payload['evChargingAddress'] as String).isEmpty
            ? null
            : payload['evChargingAddress'] as String,
        chargingLatitude: payload['chargingLatitude'] as double?,
        chargingLongitude: payload['chargingLongitude'] as double?,
        evChargingLocationName: payload['evChargingLocationName'] as String?,
        chargerType: payload['chargerType'] as String?,
        evAccountCardOnFile: payload['evAccountCardOnFile'] as bool?,
      );
      result.when(
        success: (_) {
          ok = true;
          reviewRevision.value++;
          if (advanceToNextStepOnSuccess &&
              currentStep.value < flowStepCount - 1) {
            currentStep.value++;
          }
        },
        error: (err) {
          showAppSnackBar(
            title: 'Location update failed',
            message: err.message,
            isError: true,
          );
        },
      );
    } finally {
      Loader.hideLoading();
      isLoading.value = false;
    }
    return ok;
  }

  Future<void> bookingStart({bool advanceToNextStepOnSuccess = false}) async {
    if (isLoading.value) return;

    final payload = _buildBookingLocationPayload();
    if (payload == null) {
      showAppSnackBar(
        title: 'Missing info',
        message: isCombinedServiceFlow
            ? 'Please select a car wash location.'
            : 'Please wait for your location to finish loading, then try again.',
        isError: true,
      );
      return;
    }

    final pickupLat = _coordStringForApi(payload['latitude'] as double?);
    final pickupLng = _coordStringForApi(payload['longitude'] as double?);
    final serviceLat = _coordStringForApi(
      payload['serviceLatitude'] as double?,
    );
    final serviceLng = _coordStringForApi(
      payload['serviceLongitude'] as double?,
    );
    if (pickupLat == null || pickupLng == null) {
      showAppSnackBar(
        title: 'Location not ready',
        message:
            'Please wait for your location to finish loading, then try again.',
        isError: true,
      );
      return;
    }

    isLoading.value = true;
    Loader.showLoading();
    try {
      final result = await _vehicleRepo.bookingStart(
        serviceType: _apiServiceType,
        address: payload['address'] as String,
        latitude: pickupLat,
        longitude: pickupLng,
        serviceAddress: payload['serviceAddress'] as String,
        serviceLatitude: serviceLat,
        serviceLongitude: serviceLng,
        serviceLocationName: payload['serviceLocationName'] as String?,
        chargerType: payload['chargerType'] as String?,
        evAccountCardOnFile: payload['evAccountCardOnFile'] as bool?,
      );
      result.when(
        success: (res) async {
          Loader.hideLoading();
          hasStartedBooking.value = true;
          bookingApiId.value = res.data?.bookingId;
          if ((res.data?.bookingCode ?? '').trim().isNotEmpty) {
            bookingCode.value = res.data!.bookingCode!.trim();
          }
          if (advanceToNextStepOnSuccess &&
              currentStep.value < flowStepCount - 1) {
            currentStep.value++;
          }
        },
        error: (err) {
          Loader.hideLoading();
          showAppSnackBar(
            title: 'Booking failed',
            message: err.message,
            isError: true,
          );
        },
      );
    } finally {
      Loader.hideLoading();
      isLoading.value = false;
    }
  }

  Future<void> bookingStep2({bool advanceToNextStepOnSuccess = false}) async {
    if (isLoading.value) return;

    final bookingId = bookingApiId.value;
    if (bookingId == null) {
      showAppSnackBar(
        title: 'Booking not started',
        message: 'Please complete the previous step before continuing.',
        isError: true,
      );
      return;
    }

    isLoading.value = true;
    Loader.showLoading();
    try {
      final evAddress = (selectedEvStationAddress.value ?? '').trim();
      final evLocationName =
          (selectedEvChargingLocationName.value ?? '').trim().isNotEmpty
          ? selectedEvChargingLocationName.value!.trim()
          : null;
      final washLocationName =
          (selectedCarWashLocationName.value ?? '').trim().isNotEmpty
          ? selectedCarWashLocationName.value!.trim()
          : null;

      if (isCombinedServiceFlow) {
        if (evAddress.isEmpty ||
            selectedEvStationLatitude.value == null ||
            selectedEvStationLongitude.value == null) {
          showAppSnackBar(
            title: 'Missing info',
            message: 'Please select a charging station.',
            isError: true,
          );
          return;
        }
      }

      final result = await _vehicleRepo.bookingStep2(
        bookingId: bookingId,
        packageId: _step2PackageId,
        customPackageName: _step2CustomPackageName,
        customPrice: _step2CustomPrice,
        scheduleType: _step2ScheduleType,
        scheduledAt: _step2ScheduledAt,
        evChargingAddress: evAddress.isEmpty ? null : evAddress,
        chargingLatitude: selectedEvStationLatitude.value,
        chargingLongitude: selectedEvStationLongitude.value,
        evChargingLocationName: evLocationName,
        serviceLocationName: isCombinedServiceFlow ? washLocationName : null,
        chargerType: isEvChargingFlow ? _chargerTypeForApi() : null,
        evAccountCardOnFile: evAccountCardOnFile.value,
      );

      result.when(
        success: (_) {
          if (advanceToNextStepOnSuccess &&
              currentStep.value < flowStepCount - 1) {
            currentStep.value++;
          }
        },
        error: (err) {
          Loader.hideLoading();
          showAppSnackBar(
            title: 'Service details failed',
            message: err.message,
            isError: true,
          );
        },
      );
    } finally {
      Loader.hideLoading();
      isLoading.value = false;
    }
  }

  double? _asDouble(dynamic value) {
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value);
    return null;
  }

  bool get _usesCustomPackage =>
      hasMembershipWash.value ||
      packageNameController.text.trim().isNotEmpty ||
      packagePriceController.text.trim().isNotEmpty;

  /// True when the manually entered price is a valid positive currency amount.
  /// Rejects blank, non-numeric, zero, negative, leading zeros (000/099), and
  /// more than 2 decimal places.
  /// Note: membership wash is always valid (price is $0 by design).
  bool get _isCustomPriceValid {
    // Membership wash: $0 is always valid.
    if (hasMembershipWash.value) return true;

    // If user picked a preset package there is no manual price to validate.
    if (isCarComfortPackageSelected) return true;

    // If no package info entered but noMembershipWash checked, valid.
    if (noMembershipWash.value &&
        packageNameController.text.trim().isEmpty &&
        packagePriceController.text.trim().isEmpty)
      return true;

    if (!_usesCustomPackage) return true;
    return isValidPackagePrice(packagePriceController.text);
  }

  int? get _step2PackageId {
    // EV-only service update doesn't use package_id.
    if (isEvChargingFlow) return null;
    // Membership wash and custom entries do not map to a preset package id.
    if (hasMembershipWash.value) return null;
    if (_usesCustomPackage) return null;
    final selected = selectedComfortPackage.value?.trim();
    if (selected == null || selected.isEmpty) return null;
    return _packageLabelToId[selected];
  }

  String? get _step2CustomPackageName {
    // Membership wash sends a fixed name.
    if (hasMembershipWash.value) return membershipPackageName;
    if (!_usesCustomPackage) return null;
    final value = packageNameController.text.trim();
    return value.isEmpty ? null : value;
  }

  /// Membership information text entered by the customer.
  String? get membershipInfoText {
    final t = membershipTextController.text.trim();
    return t.isEmpty ? null : t;
  }

  String? get _step2CustomPrice {
    // Membership wash always sends $0.00.
    if (hasMembershipWash.value) return '0.00';
    if (!_usesCustomPackage) return null;
    return normalizePackagePrice(packagePriceController.text);
  }

  String get _step2ScheduleType => selectedScheduleType.value;

  String? get _step2ScheduledAt {
    if (!isScheduleScheduled) return null;
    final date = scheduledServiceDate.value;
    final time = scheduledServiceTime.value;
    if (date == null || time == null) return null;
    final scheduledDateTime = DateTime(
      date.year,
      date.month,
      date.day,
      time.hour,
      time.minute,
    );
    return scheduledDateTime.toUtc().toIso8601String();
  }

  // —— Review: shared ——
  String get reviewCustomerAddress {
    if (manualAddressController.text.trim().isNotEmpty) {
      return manualAddressController.text.trim();
    }
    if (customerLocationController.text.trim().isNotEmpty) {
      return customerLocationController.text.trim();
    }
    return (isEvChargingFlow || isCombinedServiceFlow)
        ? '123 Main Street, Johnson City, TN 37604'
        : '351 West Street, Garden City, NY 11530';
  }

  String get reviewCarWashSummary {
    final name = selectedCarWash.value ?? 'Car wash';
    return '$name · 135 North St, New York, NY 10013';
  }

  /// Car wash name only (e.g. for review card second row with store icon).
  String get reviewCarWashNameLine => selectedCarWash.value ?? '—';

  String get carWashReviewDateLine => reviewScheduledDateLine;

  String get carWashReviewTimeLine => reviewScheduledTimeLine;

  String get reviewCarWashVehicleTypeDisplay {
    final v = (selectedVehicle.value ?? '').toLowerCase();
    if (v.contains('model y') || v.contains('suv')) return 'SUV';
    if (v.contains('truck')) return 'Truck';
    if (v.contains('van')) return 'Van';
    return 'Sedan';
  }

  /// Car wash flow has no plate field; matches design placeholder when empty.
  String get reviewCarWashLicenseDisplay => 'XYZ 5678';

  String get reviewPackageLine {
    // Membership wash always shows as Custom Package.
    if (hasMembershipWash.value) return membershipPackageName;
    final preset = selectedComfortPackageData;
    if (preset != null) {
      final n = (preset.name ?? '').trim();
      if (n.isNotEmpty) return n;
    }
    if (packageNameController.text.trim().isNotEmpty) {
      return packageNameController.text.trim();
    }
    final sel = selectedComfortPackage.value?.trim();
    if (sel != null && sel.isNotEmpty) return sel;
    return 'Standard Wash';
  }

  /// Resolved API package row for the current dropdown selection (label includes price).
  pkg.Data? get selectedComfortPackageData {
    final sel = selectedComfortPackage.value?.trim();
    if (sel == null || sel.isEmpty) return null;
    final id = _packageLabelToId[sel];
    if (id == null) return null;
    for (final e in packageItems) {
      if (e.id == id) return e;
    }
    return null;
  }

  /// Formatted price for the selected CarComfort package (e.g. `\$45.00`), or null.
  String? get selectedComfortPackagePriceDisplay {
    final item = selectedComfortPackageData;
    if (item == null) return null;
    final p = _formatPackagePriceForDisplay(item.basePrice);
    return p.isEmpty ? null : p;
  }

  String _comfortPackageDropdownLabel(pkg.Data item) {
    final name = (item.name ?? '').trim();
    if (name.isEmpty) return '';
    final price = _formatPackagePriceForDisplay(item.basePrice);
    if (price.isEmpty) return name;
    return '$name  •  $price';
  }

  String _formatPackagePriceForDisplay(String? raw) {
    final t = (raw ?? '').trim();
    if (t.isEmpty) return '';
    final normalized = t.replaceAll(r'$', '').replaceAll(',', '').trim();
    final n = double.tryParse(normalized);
    if (n == null) {
      return t.contains(r'$') ? t : '\$$t';
    }
    return '\$${n.toStringAsFixed(2)}';
  }

  String get reviewVehicleLine => selectedVehicle.value ?? '—';

  String _pickupNotesForApi() {
    if (isEvChargingFlow && !isCombinedServiceFlow) {
      return evPickupNotesController.text.trim();
    }
    if (isCombinedServiceFlow) {
      return [
        parkingNotesController.text.trim(),
        evPickupNotesController.text.trim(),
      ].where((e) => e.isNotEmpty).join('\n\n');
    }
    return parkingNotesController.text.trim();
  }

  String get reviewServiceNotesSummary {
    final rows = serviceNotesFormData.displayRows;
    if (rows.isEmpty) {
      final api = bookingReviewData.value;
      final fromParking = api?.serviceNotes?.parkingInstructions?.trim() ?? '';
      if (fromParking.isNotEmpty) return fromParking;
      return reviewPickupNotes;
    }
    return rows.map((r) => '${r.question} ${r.answer}').join('\n');
  }

  String get reviewPickupNotes => reviewServiceNotesSummary;

  String get reviewOtherNotes => otherNotesVehicleController.text.trim();

  String get reviewNotesCombined {
    final a = reviewPickupNotes;
    final b = reviewOtherNotes;
    return [a, b].where((e) => e.isNotEmpty).join('\n\n');
  }

  String get reviewEvPickupNotes => evPickupNotesController.text.trim();

  String get reviewEvDriverNotes {
    return reviewEvPickupNotes;
  }

  String get reviewEvVehicleColor {
    final v = selectedVehicle.value ?? '';
    if (v.contains('·')) {
      return v.split('·').last.trim();
    }
    if (v.toLowerCase().contains('tesla')) return 'White';
    return '—';
  }

  String get reviewEvLicense => evLicensePlateController.text.trim().isEmpty
      ? 'XYZ 5678'
      : evLicensePlateController.text.trim();

  String get reviewEvParkedAt {
    final fromForm = evParkedAtController.text.trim();
    if (fromForm.isNotEmpty) return fromForm;
    return '—';
  }

  String get reviewEvCurrentBatteryStatus {
    final selected = selectedEvBatteryStatus.value?.trim();
    if (selected != null && selected.isNotEmpty) return selected;
    final text = evBatteryStatusController.text.trim();
    if (text.isNotEmpty) return text;
    final apiStatus = bookingReviewData
        .value
        ?.vehicle
        ?.currentBatteryStatusLabel
        ?.trim();
    if (apiStatus != null && apiStatus.isNotEmpty) return apiStatus;
    return '—';
  }

  /// Booking review API first, then form state (car wash / combined / EV).
  String get reviewVehicleBatteryCapacityLine {
    final apiStatus = bookingReviewData
        .value
        ?.vehicle
        ?.currentBatteryStatusLabel
        ?.trim();
    if (apiStatus != null && apiStatus.isNotEmpty) return apiStatus;
    final api = bookingReviewData.value?.vehicle?.currentBatteryCharge?.trim();
    if (api != null && api.isNotEmpty) return api;
    return reviewEvCurrentBatteryStatus;
  }

  /// Display label for review (range labels stay as-is).
  String get reviewBatteryCapacityPercentDisplay {
    final raw = reviewVehicleBatteryCapacityLine.trim();
    if (raw.isEmpty || raw == '—') return '—';
    if (raw.contains('-') || raw.toLowerCase().contains('above')) return raw;
    final cleaned = raw.replaceAll('%', '').trim();
    if (cleaned.isEmpty) return '—';
    final v = double.tryParse(cleaned.replaceAll(',', '.'));
    if (v == null) return raw;
    return '${v.round()}%';
  }

  String _formatReviewDate(DateTime? d) {
    if (d == null) return '—';
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    return '${months[d.month - 1]} ${d.day}, ${d.year}';
  }

  String get evReviewDateFormatted =>
      _formatReviewDate(scheduledServiceDate.value);

  String get evReviewDateLine => reviewScheduledDateLine;

  String get evReviewTimeLine => reviewScheduledTimeLine;

  String get evReviewTimeFormatted {
    final t = scheduledServiceTime.value;
    if (t == null) return '—';
    final hour = t.hour;
    final h12 = hour > 12 ? hour - 12 : (hour == 0 ? 12 : hour);
    final ap = hour >= 12 ? 'PM' : 'AM';
    final m = t.minute.toString().padLeft(2, '0');
    return '$h12:$m $ap';
  }

  String get reviewCombinedWashServiceLocation {
    var washName = (selectedCarWashLocationName.value ?? '').trim();
    var washAddress = (selectedCarWashAddress.value ?? '').trim();

    if (washName.isEmpty || washAddress.isEmpty) {
      final parsed = _parseCarWashSelectionLabel(selectedCarWash.value);
      if (washName.isEmpty) washName = (parsed.$1 ?? '').trim();
      if (washAddress.isEmpty) washAddress = (parsed.$2 ?? '').trim();
    }

    final apiLoc = bookingReviewData.value?.location?.serviceLocation;
    if (washName.isEmpty) washName = (apiLoc?.name ?? '').trim();
    if (washAddress.isEmpty) washAddress = (apiLoc?.address ?? '').trim();

    return formatReviewLocationNameAndAddress(
      name: washName,
      address: washAddress,
    );
  }

  String get reviewCombinedChargingServiceLocation {
    var evName = (selectedEvChargingLocationName.value ?? '').trim();
    var evAddress = (selectedEvStationAddress.value ?? '').trim();

    if (evName.isEmpty) evName = selectedEvStation.shortName.trim();
    if (evAddress.isEmpty) evAddress = selectedEvStation.address.trim();

    final apiEv = bookingReviewData.value?.location?.evCharging;
    if (evName.isEmpty) evName = (apiEv?.name ?? '').trim();
    if (evAddress.isEmpty) evAddress = (apiEv?.address ?? '').trim();

    return formatReviewLocationNameAndAddress(name: evName, address: evAddress);
  }

  String get reviewCombinedWashingStationLine {
    final washName = (selectedCarWashLocationName.value ?? '').trim();
    if (washName.isNotEmpty) return washName;
    final selected = selectedCarWash.value?.trim();
    if (selected == null || selected.isEmpty) {
      return selectedEvStation.shortName;
    }
    final parts = selected.split('•');
    final name = parts.first.trim();
    return name.isEmpty ? selectedEvStation.shortName : name;
  }

  String get reviewCombinedServiceLocation {
    final selectedAddress = (selectedCarWashAddress.value ?? '').trim();
    if (selectedAddress.isNotEmpty) return selectedAddress;
    final stationAddress = (selectedEvStationAddress.value ?? '').trim();
    if (stationAddress.isNotEmpty) return stationAddress;
    final selected = selectedCarWash.value?.trim();
    if (selected != null && selected.isNotEmpty) return selected;
    return '—';
  }

  String get reviewCombinedPickupNote {
    final wash = reviewPickupNotes;
    final ev = reviewEvPickupNotes;
    return [wash, ev].where((e) => e.isNotEmpty).join('\n\n');
  }

  String get reviewCombinedOtherNotes => reviewOtherNotes;

  String get reviewCombinedParkedAt {
    final p = parkingNotesController.text.trim();
    if (p.isNotEmpty) {
      return p.length > 80 ? '${p.substring(0, 80)}…' : p;
    }
    return 'Garage Level 3, Stall 102';
  }
}

class EvStationInfo {
  final String menuLabel;
  final String shortName;
  final String address;
  final String milesAwayLine;
  final String availableChargers;
  final String maxKw;
  final String reviewDistance;
  final String reviewServiceLocation;
  final double? latitude;
  final double? longitude;

  const EvStationInfo({
    required this.menuLabel,
    required this.shortName,
    required this.address,
    required this.milesAwayLine,
    required this.availableChargers,
    required this.maxKw,
    required this.reviewDistance,
    required this.reviewServiceLocation,
    this.latitude,
    this.longitude,
  });

  const EvStationInfo.fallback()
    : menuLabel = 'No charging station selected',
      shortName = 'Charging station unavailable',
      address = 'No location available',
      milesAwayLine = 'N/A',
      availableChargers = 'N/A',
      maxKw = 'N/A',
      reviewDistance = 'N/A',
      reviewServiceLocation = 'Return to pickup location',
      latitude = null,
      longitude = null;
}

class _BookingConfirmedDialog extends StatelessWidget {
  final String serviceLabel;
  final double total;

  /// Full line for the summary card, e.g. `#CC-CW-20260501-000008` (may already include `#`).
  final String bookingIdDisplay;

  const _BookingConfirmedDialog({
    required this.serviceLabel,
    required this.total,
    required this.bookingIdDisplay,
  });

  @override
  Widget build(BuildContext context) {
    const red = ServiceBookingController.brandRed;
    return PopScope(
      canPop: false,
      child: Dialog(
        insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
        backgroundColor: Colors.transparent,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560),
          child: Container(
            padding: const EdgeInsets.fromLTRB(20, 28, 20, 20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 64,
                  height: 64,
                  decoration: const BoxDecoration(
                    color: red,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.check_rounded,
                    color: Colors.white,
                    size: 36,
                  ),
                ),
                const SizedBox(height: 16),
                CommonText.bold(
                  'Booking Confirmed!',
                  size: 20,
                  color: Colors.black,
                ),
                const SizedBox(height: 8),
                CommonText.regular(
                  'Your service request has been successfully placed.',
                  size: 14,
                  color: Colors.grey.shade700,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                Icon(Icons.notifications_active_outlined, color: red, size: 28),
                const SizedBox(height: 6),
                CommonText.regular(
                  'You will be notified when a service provider has accepted your request!',
                  size: 13,
                  color: Colors.grey.shade600,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 20),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xffF2F2F7),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _row('Service Type', serviceLabel),
                      const SizedBox(height: 10),
                      _row('Estimated Price', '\$${_formatPrice(total)}'),
                      const SizedBox(height: 10),
                      _row('Booking ID', bookingIdDisplay),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: AppButton(
                    label: 'Home',
                    onPressed: () {
                      Get.find<ServiceBookingController>()
                          ._refreshDashboardIfRegistered();
                      offAllNamed(Routes.DASHBOARD);
                    },
                    type: ButtonType.primary,
                    bgColor: red,
                    txtColor: Colors.white,
                    vPadding: 14,
                    btnCornerRadius: 14,
                    textSize: 16,
                  ),
                ),
                // TextButton(
                //   onPressed: () {
                //     Get.back<void>();
                //     final c = Get.find<ServiceBookingController>();
                //     showBookingDriverStatusDialog(c);
                //   },
                //   child: CommonText.semiBold(
                //     'View Booking Details',
                //     size: 14,
                //     color: Colors.grey.shade700,
                //     isUnderLine: true,
                //   ),
                // ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  static Widget _row(String k, String v) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 110,
          child: CommonText.regular(k, size: 13, color: Colors.grey.shade600),
        ),
        Expanded(
          child: CommonText.bold(
            v,
            size: 13,
            color: Colors.black,
            textAlign: TextAlign.end,
          ),
        ),
      ],
    );
  }

  static String _formatPrice(double value) {
    final s = value.toStringAsFixed(2);
    if (s.endsWith('00')) return value.toStringAsFixed(0);
    if (s.endsWith('0')) return s.substring(0, s.length - 1);
    return s;
  }
}
