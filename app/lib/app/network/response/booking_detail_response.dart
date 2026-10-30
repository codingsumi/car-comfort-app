import 'booking_list_response.dart' show CustomerDetail;
import 'booking_review_response.dart' show PriceSummary;
import '../../utils/ev_account_card_on_file.dart';

double? _bdToDouble(dynamic v) {
  if (v == null) return null;
  if (v is num) return v.toDouble();
  return double.tryParse('$v');
}

class BookingDetailResponse {
  BookingDetailResponse({this.status, this.message, this.data});

  BookingDetailResponse.fromJson(dynamic json) {
    status = json['status'];
    message = json['message'];
    data = json['data'] != null ? Data.fromJson(json['data']) : null;
  }
  String? status;
  String? message;
  Data? data;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['status'] = status;
    map['message'] = message;
    if (data != null) {
      map['data'] = data?.toJson();
    }
    return map;
  }
}

/// Backward-compatible alias for older code that used `BookingDetailData`.
typedef BookingDetailData = Data;

class BookingLocation {
  BookingLocation({this.address, this.name, this.latitude, this.longitude});

  final String? address;
  final String? name;
  final double? latitude;
  final double? longitude;
}

class Data {
  Data({
    this.id,
    this.userId,
    this.customerId,
    this.providerId,
    this.assignedDriverUserId,
    this.serviceType,
    this.packageId,
    this.packageName,
    this.address,
    this.latitude,
    this.longitude,
    this.serviceAddress,
    this.serviceLatitude,
    this.serviceLongitude,
    this.serviceLocationName,
    this.evChargingAddress,
    this.chargingLatitude,
    this.chargingLongitude,
    this.evChargingLocationName,
    this.customPackageName,
    this.customPrice,
    this.scheduleType,
    this.scheduledAt,
    this.serviceDatetime,
    this.serviceLat,
    this.serviceLng,
    this.trackingStatus,
    this.vehicleId,
    this.vehicleChargeLimit,
    this.parkingInstructions,
    this.notes,
    this.vehicleParkedLocation,
    this.vehicleParkedLocationLabel,
    this.vehicleParkedLocationOther,
    this.providerParkLocation,
    this.providerParkLocationLabel,
    this.providerParkLocationOther,
    this.vehicleKeyLocation,
    this.vehicleKeyLocationLabel,
    this.vehicleKeyLocationOther,
    this.keyReturnLocation,
    this.keyReturnLocationLabel,
    this.keyReturnLocationOther,
    this.basePrice,
    this.addonPrice,
    this.serviceFee,
    this.totalPrice,
    this.status,
    this.bookingCode,
    this.cancelledAt,
    this.cancelledBy,
    this.cancellationReason,
    this.cancellationFee,
    this.refundAmount,
    this.refundStatus,
    this.refundReason,
    this.disputeStatus,
    this.createdAt,
    this.updatedAt,
    this.assignedDriver,
    this.package,
    this.vehicle,
    this.addons,
    this.images,
    this.serviceImages,
    this.customerDetail,
    this.driverDetail,
    this.invoice,
    this.bookingTip,
    this.customerPostService,
    this.onDemandAcceptDeadlineAt,
    this.arrivalWaitExpiresAt,
    this.driverAcceptedAt,
    this.driverArrivedCustomerAt,
    this.driverStartedToServiceCenterAt,
    this.currentBatteryCharge,
    this.currentBatteryStatus,
    this.currentBatteryStatusLabel,
    this.evAccountCardOnFile,
    this.vehiclePickupOtp,
    this.priceSummary,
    this.driverEarning,
    this.distanceMiles,
    this.serviceDurationMinutes,
  });

  Data.fromJson(dynamic json) {
    id = json['id'];
    userId = json['user_id'];
    customerId = json['customer_id'];
    providerId = json['provider_id'];
    assignedDriverUserId = json['assigned_driver_user_id'];
    serviceType = json['service_type']?.toString();
    packageId = json['package_id'];
    packageName = json['package_name']?.toString();
    address = json['address']?.toString();
    latitude = _toDouble(json['latitude'] ?? json['lat']);
    longitude = _toDouble(json['longitude'] ?? json['lng'] ?? json['lon']);
    final pickRaw = json['pickup_location'] ?? json['pickupLocation'];
    if (pickRaw is Map) {
      final pm = Map<String, dynamic>.from(pickRaw);
      address ??= pm['address']?.toString();
      latitude ??= _toDouble(pm['latitude'] ?? pm['lat']);
      longitude ??= _toDouble(pm['longitude'] ?? pm['lng'] ?? pm['lon']);
    }
    serviceAddress = json['service_address'];
    serviceLatitude = _toDouble(json['service_latitude']);
    serviceLongitude = _toDouble(json['service_longitude']);
    serviceLocationName = json['service_location_name']?.toString();
    evChargingAddress = json['ev_charging_address'];
    chargingLatitude = json['charging_latitude'];
    chargingLongitude = json['charging_longitude'];
    evChargingLocationName = json['ev_charging_location_name']?.toString();
    final serviceLocRaw = json['service_location'];
    if (serviceLocRaw is Map) {
      final sm = Map<String, dynamic>.from(serviceLocRaw);
      serviceLocationName ??= sm['name']?.toString();
      serviceAddress ??= sm['address']?.toString();
      serviceLatitude ??= _toDouble(sm['latitude'] ?? sm['lat']);
      serviceLongitude ??= _toDouble(sm['longitude'] ?? sm['lng'] ?? sm['lon']);
    }
    final evLocRaw = json['ev_charging_location'] ?? json['ev_charging'];
    if (evLocRaw is Map) {
      final em = Map<String, dynamic>.from(evLocRaw);
      evChargingLocationName ??= em['name']?.toString();
      evChargingAddress ??= em['address'];
      chargingLatitude ??= em['latitude'] ?? em['lat'];
      chargingLongitude ??= em['longitude'] ?? em['lng'] ?? em['lon'];
    }
    customPackageName = json['custom_package_name'];
    customPrice = json['custom_price'];
    scheduleType = json['schedule_type'] ?? json['scheduleType'];
    scheduledAt = json['scheduled_at'] ?? json['scheduledAt'];
    serviceDatetime = json['service_datetime'] ?? json['serviceDatetime'];
    serviceLat = json['service_lat'];
    serviceLng = json['service_lng'];
    trackingStatus = json['tracking_status'];
    comboServiceStopIndex = _toInt(json['combo_service_stop_index']);
    vehicleId = json['vehicle_id'];
    vehicleChargeLimit = json['vehicle_charge_limit'];
    parkingInstructions = json['parking_instructions'];
    notes = json['notes'];
    vehicleParkedLocation = json['vehicle_parked_location']?.toString();
    vehicleParkedLocationLabel = json['vehicle_parked_location_label']
        ?.toString();
    vehicleParkedLocationOther = json['vehicle_parked_location_other']
        ?.toString();
    providerParkLocation = json['provider_park_location']?.toString();
    providerParkLocationLabel = json['provider_park_location_label']
        ?.toString();
    providerParkLocationOther = json['provider_park_location_other']
        ?.toString();
    vehicleKeyLocation = json['vehicle_key_location']?.toString();
    vehicleKeyLocationLabel = json['vehicle_key_location_label']?.toString();
    vehicleKeyLocationOther = json['vehicle_key_location_other']?.toString();
    keyReturnLocation = json['key_return_location']?.toString();
    keyReturnLocationLabel = json['key_return_location_label']?.toString();
    keyReturnLocationOther = json['key_return_location_other']?.toString();
    basePrice = json['base_price'];
    addonPrice = json['addon_price'];
    serviceFee = json['service_fee'];
    totalPrice = _toDouble(json['total_price']);
    status = json['status'];
    bookingCode = json['booking_code'];
    cancelledAt = json['cancelled_at'];
    cancelledBy = json['cancelled_by'];
    cancellationReason = json['cancellation_reason'];
    cancellationFee = json['cancellation_fee'];
    refundAmount = json['refund_amount'];
    refundStatus = json['refund_status']?.toString();
    refundReason = json['refund_reason']?.toString();
    disputeStatus = json['dispute_status']?.toString();
    // API tends to use `created_at` / `updated_at`; keep backward-compat.
    createdAt = json['created_at'] ?? json['createdAt'];
    updatedAt = json['updated_at'] ?? json['updatedAt'];
    assignedDriver = json['assigned_driver'] != null
        ? AssignedDriver.fromJson(json['assigned_driver'])
        : null;
    package = json['package'] != null
        ? Package.fromJson(json['package'])
        : null;
    vehicle = json['vehicle'] != null
        ? Vehicle.fromJson(json['vehicle'])
        : null;
    if (json['addons'] != null) {
      addons = [];
      json['addons'].forEach((v) {
        addons?.add(Dynamic.fromJson(v));
      });
    }
    if (json['images'] != null) {
      images = [];
      json['images'].forEach((v) {
        images?.add(Dynamic.fromJson(v));
      });
    }
    serviceImages = json['service_images'] != null
        ? BookingServiceImages.fromJson(json['service_images'])
        : null;
    final rawCustomer =
        json['customer_detail'] ?? json['customerDetail'] ?? json['customer'];
    customerDetail = rawCustomer is Map
        ? CustomerDetail.fromJson(rawCustomer)
        : null;
    driverDetail = json['driver_detail'] != null
        ? DriverDetail.fromJson(json['driver_detail'])
        : null;
    invoice = json['invoice'];
    final tipRaw = json['tip'];
    bookingTip = tipRaw is Map
        ? BookingTipSummary.fromJson(Map<String, dynamic>.from(tipRaw))
        : null;
    final cpsRaw = json['customer_post_service'] ?? json['customerPostService'];
    customerPostService = cpsRaw is Map
        ? CustomerPostService.fromJson(Map<String, dynamic>.from(cpsRaw))
        : null;
    onDemandAcceptDeadlineAt =
        json['on_demand_accept_deadline_at'] ??
        json['onDemandAcceptDeadlineAt'];
    arrivalWaitExpiresAt =
        json['arrival_wait_expires_at'] ?? json['arrivalWaitExpiresAt'];
    driverAcceptedAt = json['driver_accepted_at'] ?? json['driverAcceptedAt'];
    driverArrivedCustomerAt =
        json['driver_arrived_customer_at'] ?? json['driverArrivedCustomerAt'];
    driverStartedToServiceCenterAt =
        json['driver_started_to_service_center_at'] ??
        json['driverStartedToServiceCenterAt'];
    currentBatteryCharge =
        json['current_battery_charge']?.toString() ??
        json['currentBatteryCharge']?.toString();
    currentBatteryStatus =
        json['current_battery_status']?.toString() ??
        json['currentBatteryStatus']?.toString();
    currentBatteryStatusLabel =
        json['current_battery_status_label']?.toString() ??
        json['currentBatteryStatusLabel']?.toString();
    evAccountCardOnFile = resolveEvAccountCardOnFileValue(
      rawValue:
          json[kEvAccountCardOnFileApiField] ??
          json['evAccountCardOnFile'] ??
          json['has_ev_account_card_on_file'] ??
          json['has_ev_account_with_card_on_file'],
      notes: json['notes'],
    );
    vehiclePickupOtp =
        '${json['vehicle_pickup_otp'] ?? json['vehiclePickupOtp'] ?? json['pickup_otp'] ?? json['pickupOtp'] ?? ''}'
            .trim();
    if (vehiclePickupOtp != null && vehiclePickupOtp!.isEmpty) {
      vehiclePickupOtp = null;
    }
    final psRaw = json['price_summary'] ?? json['priceSummary'];
    priceSummary = psRaw is Map
        ? PriceSummary.fromJson(Map<String, dynamic>.from(psRaw))
        : null;
    final earnRaw = json['driver_earning'] ?? json['driverEarning'];
    driverEarning = earnRaw != null
        ? DriverEarningSummary.fromJson(earnRaw)
        : null;
    distanceMiles = _toDouble(json['distance_miles'] ?? json['distanceMiles']);
    serviceDurationMinutes = _toInt(
      json['service_duration_minutes'] ?? json['serviceDurationMinutes'],
    );
  }
  int? id;
  int? userId;
  int? customerId;
  int? providerId;
  int? assignedDriverUserId;
  String? serviceType;
  int? packageId;
  String? packageName;
  String? address;
  double? latitude;
  double? longitude;
  String? serviceAddress;
  double? serviceLatitude;
  double? serviceLongitude;
  String? serviceLocationName;
  dynamic evChargingAddress;
  dynamic chargingLatitude;
  dynamic chargingLongitude;
  String? evChargingLocationName;
  dynamic customPackageName;
  dynamic customPrice;
  String? scheduleType;
  dynamic scheduledAt;
  dynamic serviceDatetime;
  String? serviceLat;
  String? serviceLng;
  dynamic trackingStatus;
  int? comboServiceStopIndex;
  int? vehicleId;
  dynamic vehicleChargeLimit;
  String? parkingInstructions;
  dynamic notes;
  String? vehicleParkedLocation;
  String? vehicleParkedLocationLabel;
  String? vehicleParkedLocationOther;
  String? providerParkLocation;
  String? providerParkLocationLabel;
  String? providerParkLocationOther;
  String? vehicleKeyLocation;
  String? vehicleKeyLocationLabel;
  String? vehicleKeyLocationOther;
  String? keyReturnLocation;
  String? keyReturnLocationLabel;
  String? keyReturnLocationOther;
  String? basePrice;
  String? addonPrice;
  String? serviceFee;
  double? totalPrice;
  String? status;
  String? bookingCode;
  dynamic cancelledAt;
  dynamic cancelledBy;
  dynamic cancellationReason;
  String? cancellationFee;
  String? refundAmount;
  String? refundStatus;
  String? refundReason;
  String? disputeStatus;
  String? createdAt;
  String? updatedAt;
  AssignedDriver? assignedDriver;
  Package? package;
  Vehicle? vehicle;
  List<dynamic>? addons;
  List<dynamic>? images;
  BookingServiceImages? serviceImages;
  CustomerDetail? customerDetail;
  DriverDetail? driverDetail;
  String? invoice;
  BookingTipSummary? bookingTip;
  CustomerPostService? customerPostService;
  dynamic onDemandAcceptDeadlineAt;
  dynamic arrivalWaitExpiresAt;
  dynamic driverAcceptedAt;
  dynamic driverArrivedCustomerAt;
  dynamic driverStartedToServiceCenterAt;
  String? currentBatteryCharge;
  String? currentBatteryStatus;
  String? currentBatteryStatusLabel;
  bool? evAccountCardOnFile;
  String? vehiclePickupOtp;
  PriceSummary? priceSummary;
  DriverEarningSummary? driverEarning;
  double? distanceMiles;
  int? serviceDurationMinutes;

  /// Backward-compatible fields used heavily in service detail views.
  int? get driverId => assignedDriverUserId ?? assignedDriver?.id;

  bool get canCustomerReviewDriver {
    if (customerPostService != null) {
      return customerPostService!.canReview;
    }
    if (assignedDriver?.review != null) return false;
    return assignedDriver?.canReview == true;
  }

  bool get canCustomerTipDriver {
    if (customerPostService != null) {
      return customerPostService!.canTip;
    }
    if ('${status ?? ''}'.trim().toLowerCase() != 'completed') return false;
    if (driverId == null) return false;
    final tipStatus = bookingTip?.status?.trim().toLowerCase() ?? '';
    if (tipStatus == 'succeeded' || tipStatus == 'processing') return false;
    return true;
  }

  bool get hasCustomerReviewedDriver =>
      customerPostService?.hasReviewed == true ||
      assignedDriver?.review != null;

  bool get hasCustomerTippedDriver =>
      customerPostService?.hasTipped == true ||
      bookingTip?.status?.trim().toLowerCase() == 'succeeded';

  /// UI helper: formatted amount, preferring server display when added later.
  String? get totalPriceDisplay {
    final value = totalPrice;
    if (value == null) return null;
    return '\$${value.toStringAsFixed(2)}';
  }

  /// UI helper: allow views to prefer a ready-to-display service label.
  String? get serviceTypeLabel => serviceType;

  BookingLocation? get pickupLocation {
    final a = (address ?? '').trim();
    if (a.isEmpty && latitude == null && longitude == null) return null;
    return BookingLocation(
      address: address,
      latitude: latitude,
      longitude: longitude,
    );
  }

  BookingLocation? get serviceLocation {
    final a = (serviceAddress ?? '').trim();
    final name = (serviceLocationName ?? '').trim();
    // Prefer the typed double fields; fall back to the string variants
    // (service_lat / service_lng) that some API responses use instead.
    final lat = serviceLatitude ?? _bdToDouble(serviceLat);
    final lng = serviceLongitude ?? _bdToDouble(serviceLng);
    if (a.isEmpty && name.isEmpty && lat == null && lng == null) {
      return null;
    }
    return BookingLocation(
      address: serviceAddress,
      name: serviceLocationName,
      latitude: lat,
      longitude: lng,
    );
  }

  /// EV charging stop (car wash uses [serviceLocation]).
  BookingLocation? get evChargingLocation {
    final a = (evChargingAddress ?? '').toString().trim();
    final lat = _toDouble(chargingLatitude);
    final lng = _toDouble(chargingLongitude);
    if (a.isEmpty &&
        lat == null &&
        lng == null &&
        (evChargingLocationName ?? '').trim().isEmpty) {
      return null;
    }
    return BookingLocation(
      address: a.isEmpty ? null : a,
      name: evChargingLocationName,
      latitude: lat,
      longitude: lng,
    );
  }

  /// Most flows return to the pickup point; keep as pickup unless API adds a dedicated dropoff.
  BookingLocation? get dropoffLocation => pickupLocation;

  static double? _toDouble(dynamic v) {
    if (v == null) return null;
    if (v is num) return v.toDouble();
    return double.tryParse('$v');
  }

  static int? _toInt(dynamic v) {
    if (v == null) return null;
    if (v is int) return v;
    if (v is num) return v.toInt();
    return int.tryParse('$v');
  }

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['id'] = id;
    map['user_id'] = userId;
    map['customer_id'] = customerId;
    map['provider_id'] = providerId;
    map['assigned_driver_user_id'] = assignedDriverUserId;
    map['service_type'] = serviceType;
    map['package_id'] = packageId;
    map['package_name'] = packageName;
    map['address'] = address;
    map['latitude'] = latitude;
    map['longitude'] = longitude;
    map['service_address'] = serviceAddress;
    map['service_latitude'] = serviceLatitude;
    map['service_longitude'] = serviceLongitude;
    map['service_location_name'] = serviceLocationName;
    map['ev_charging_address'] = evChargingAddress;
    map['charging_latitude'] = chargingLatitude;
    map['charging_longitude'] = chargingLongitude;
    map['ev_charging_location_name'] = evChargingLocationName;
    map['custom_package_name'] = customPackageName;
    map['custom_price'] = customPrice;
    map['schedule_type'] = scheduleType;
    map['scheduled_at'] = scheduledAt;
    map['service_datetime'] = serviceDatetime;
    map['service_lat'] = serviceLat;
    map['service_lng'] = serviceLng;
    map['tracking_status'] = trackingStatus;
    map['vehicle_id'] = vehicleId;
    map['vehicle_charge_limit'] = vehicleChargeLimit;
    map['parking_instructions'] = parkingInstructions;
    map['notes'] = notes;
    map['vehicle_parked_location'] = vehicleParkedLocation;
    map['vehicle_parked_location_label'] = vehicleParkedLocationLabel;
    map['vehicle_parked_location_other'] = vehicleParkedLocationOther;
    map['provider_park_location'] = providerParkLocation;
    map['provider_park_location_label'] = providerParkLocationLabel;
    map['provider_park_location_other'] = providerParkLocationOther;
    map['vehicle_key_location'] = vehicleKeyLocation;
    map['vehicle_key_location_label'] = vehicleKeyLocationLabel;
    map['vehicle_key_location_other'] = vehicleKeyLocationOther;
    map['key_return_location'] = keyReturnLocation;
    map['key_return_location_label'] = keyReturnLocationLabel;
    map['key_return_location_other'] = keyReturnLocationOther;
    map['base_price'] = basePrice;
    map['addon_price'] = addonPrice;
    map['service_fee'] = serviceFee;
    map['total_price'] = totalPrice;
    map['status'] = status;
    map['booking_code'] = bookingCode;
    map['cancelled_at'] = cancelledAt;
    map['cancelled_by'] = cancelledBy;
    map['cancellation_reason'] = cancellationReason;
    map['cancellation_fee'] = cancellationFee;
    map['refund_amount'] = refundAmount;
    map['refund_status'] = refundStatus;
    map['refund_reason'] = refundReason;
    map['dispute_status'] = disputeStatus;
    map['created_at'] = createdAt;
    map['updated_at'] = updatedAt;
    if (assignedDriver != null) {
      map['assigned_driver'] = assignedDriver?.toJson();
    }
    if (package != null) {
      map['package'] = package?.toJson();
    }
    if (vehicle != null) {
      map['vehicle'] = vehicle?.toJson();
    }
    if (addons != null) {
      map['addons'] = addons?.map((v) => v.toJson()).toList();
    }
    if (images != null) {
      map['images'] = images?.map((v) => v.toJson()).toList();
    }
    if (serviceImages != null) {
      map['service_images'] = serviceImages?.toJson();
    }
    if (customerDetail != null) {
      map['customer_detail'] = customerDetail?.toJson();
    }
    if (driverDetail != null) {
      map['driver_detail'] = driverDetail?.toJson();
    }
    map['invoice'] = invoice;
    map['on_demand_accept_deadline_at'] = onDemandAcceptDeadlineAt;
    map['arrival_wait_expires_at'] = arrivalWaitExpiresAt;
    map['driver_accepted_at'] = driverAcceptedAt;
    map['driver_arrived_customer_at'] = driverArrivedCustomerAt;
    map['driver_started_to_service_center_at'] = driverStartedToServiceCenterAt;
    map['current_battery_charge'] = currentBatteryCharge;
    map['current_battery_status'] = currentBatteryStatus;
    map['current_battery_status_label'] = currentBatteryStatusLabel;
    map[kEvAccountCardOnFileApiField] = evAccountCardOnFile;
    map['vehicle_pickup_otp'] = vehiclePickupOtp;
    return map;
  }
}

class BookingServiceImage {
  BookingServiceImage({
    this.id,
    this.imageUrl,
    this.imageType,
    this.type,
    this.createdAt,
  });

  BookingServiceImage.fromJson(dynamic json) {
    id = json['id'];
    imageUrl = json['image_url']?.toString();
    imageType = json['image_type']?.toString();
    type = json['type']?.toString();
    createdAt = json['created_at']?.toString();
  }

  int? id;
  String? imageUrl;
  String? imageType;
  String? type;
  String? createdAt;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['id'] = id;
    map['image_url'] = imageUrl;
    map['image_type'] = imageType;
    map['type'] = type;
    map['created_at'] = createdAt;
    return map;
  }
}

class BookingServiceImages {
  const BookingServiceImages({
    this.before = const [],
    this.after = const [],
    this.customer = const [],
  });

  factory BookingServiceImages.fromJson(dynamic json) {
    if (json == null) return const BookingServiceImages();

    // ── Flat-list format: [{"image_url":"…","type":"before"}, …] ──────────────
    // Some API versions return a plain array where each item has a `type` or
    // `image_type` field. Group them into before / after / customer buckets.
    if (json is List) {
      final all = _parseImageList(json);
      return BookingServiceImages(
        before: _filterByType(all, const ['before', 'before_service']),
        after: _filterByType(all, const ['after', 'after_service']),
        customer: _filterByType(all, const ['customer']),
      )._deduplicated();
    }

    // ── Structured format: {"before":[…], "after":[…], "customer":[…]} ───────
    if (json is! Map) return const BookingServiceImages();
    final map = Map<String, dynamic>.from(json as Map);
    return BookingServiceImages(
      before: _parseImageList(map['before'] ?? map['before_service']),
      after: _parseImageList(map['after'] ?? map['after_service']),
      customer: _parseImageList(map['customer'] ?? map['customer_photos']),
    )._deduplicated();
  }

  final List<BookingServiceImage> before;
  final List<BookingServiceImage> after;
  final List<BookingServiceImage> customer;

  List<String> get beforeUrls => _urlsFrom(before);
  List<String> get afterUrls => _urlsFrom(after);
  List<String> get customerUrls => _urlsFrom(customer);

  bool get hasAny =>
      beforeUrls.isNotEmpty || afterUrls.isNotEmpty || customerUrls.isNotEmpty;

  // ── Internal helpers ───────────────────────────────────────────────────────

  /// Deduplicate records within each section (by URL), then remove any URL
  /// that already appears in a higher-priority section (before > after > customer).
  /// Prevents the same image from rendering multiple times.
  BookingServiceImages _deduplicated() {
    final beforeDeduped = _deduplicateById(_deduplicateByUrl(before));
    final beforeUrlSet = {
      for (final e in beforeDeduped) e.imageUrl?.trim() ?? '',
    }..remove('');
    final afterDeduped = _deduplicateById(
      _deduplicateByUrl(after),
    ).where((e) => !beforeUrlSet.contains(e.imageUrl?.trim() ?? '')).toList();
    final seenUrls = {
      ...beforeUrlSet,
      for (final e in afterDeduped) e.imageUrl?.trim() ?? '',
    }..remove('');
    final customerDeduped = _deduplicateById(
      _deduplicateByUrl(customer),
    ).where((e) => !seenUrls.contains(e.imageUrl?.trim() ?? '')).toList();
    return BookingServiceImages(
      before: beforeDeduped,
      after: afterDeduped,
      customer: customerDeduped,
    );
  }

  /// Parse a raw API list of image objects into typed records.
  static List<BookingServiceImage> _parseImageList(dynamic raw) {
    if (raw is! List) return const [];
    return raw
        .map(BookingServiceImage.fromJson)
        .where((e) => (e.imageUrl ?? '').trim().isNotEmpty)
        .toList();
  }

  /// Filter parsed images by their type/imageType field.
  static List<BookingServiceImage> _filterByType(
    List<BookingServiceImage> all,
    List<String> types,
  ) {
    return all.where((e) {
      final t = (e.type ?? e.imageType ?? '').trim().toLowerCase();
      return types.contains(t);
    }).toList();
  }

  /// Remove records with duplicate URLs (keep first occurrence).
  static List<BookingServiceImage> _deduplicateByUrl(
    List<BookingServiceImage> items,
  ) {
    final seen = <String>{};
    return items.where((e) {
      final url = (e.imageUrl ?? '').trim();
      return url.isNotEmpty && seen.add(url);
    }).toList();
  }

  /// Remove records with duplicate non-null IDs (keep first occurrence).
  static List<BookingServiceImage> _deduplicateById(
    List<BookingServiceImage> items,
  ) {
    final seen = <int>{};
    return items.where((e) {
      final id = e.id;
      if (id == null) return true; // no id → keep
      return seen.add(id);
    }).toList();
  }

  static List<String> _urlsFrom(List<BookingServiceImage> items) {
    return items
        .map((e) => e.imageUrl?.trim() ?? '')
        .where((url) => url.isNotEmpty)
        .toList();
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'before': before.map((e) => e.toJson()).toList(),
      'after': after.map((e) => e.toJson()).toList(),
      'customer': customer.map((e) => e.toJson()).toList(),
    };
  }
}

class DriverDetail {
  DriverDetail({
    this.id,
    this.name,
    this.profilePicture,
    this.avgRating,
    this.reviewCount,
    this.phone,
  });

  DriverDetail.fromJson(dynamic json) {
    if (json is! Map) return;
    final m = Map<String, dynamic>.from(json);
    id = m['id'];
    name = m['name']?.toString();
    if (name == null || name!.trim().isEmpty) {
      final first = m['first_name']?.toString() ?? '';
      final last = m['last_name']?.toString() ?? '';
      final full = '$first $last'.trim();
      if (full.isNotEmpty) name = full;
    }
    profilePicture =
        m['profile_picture']?.toString() ??
        m['profile_image']?.toString() ??
        m['profile']?.toString() ??
        m['avatar']?.toString() ??
        m['avatar_url']?.toString();
    avgRating = _bdToDouble(m['avg_rating'] ?? m['avgRating']);
    reviewCount = m['review_count'] ?? m['reviewCount'];
    phone =
        m['phone']?.toString() ??
        m['mobile']?.toString() ??
        m['contact_number']?.toString();
  }
  int? id;
  String? name;
  String? profilePicture;
  double? avgRating;
  dynamic reviewCount;
  String? phone;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['id'] = id;
    map['name'] = name;
    map['profile_picture'] = profilePicture;
    map['avg_rating'] = avgRating;
    map['review_count'] = reviewCount;
    map['phone'] = phone;
    return map;
  }
}

class Vehicle {
  Vehicle({
    this.id,
    this.userId,
    this.vehicleType,
    this.make,
    this.model,
    this.year,
    this.color,
    this.nickname,
    this.licensePlate,
    this.createdAt,
    this.updatedAt,
    this.images,
  });

  Vehicle.fromJson(dynamic json) {
    id = json['id'];
    userId = json['user_id'];
    vehicleType = json['vehicle_type'];
    make = json['make'];
    model = json['model'];
    year = json['year'];
    color = json['color'];
    nickname = json['nickname'];
    licensePlate = json['license_plate'];
    createdAt = json['createdAt'];
    updatedAt = json['updatedAt'];
    if (json['images'] != null) {
      images = [];
      json['images'].forEach((v) {
        images?.add(Dynamic.fromJson(v));
      });
    }
  }
  int? id;
  int? userId;
  String? vehicleType;
  String? make;
  String? model;
  int? year;
  String? color;
  String? nickname;
  String? licensePlate;
  String? createdAt;
  String? updatedAt;
  List<dynamic>? images;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['id'] = id;
    map['user_id'] = userId;
    map['vehicle_type'] = vehicleType;
    map['make'] = make;
    map['model'] = model;
    map['year'] = year;
    map['color'] = color;
    map['nickname'] = nickname;
    map['license_plate'] = licensePlate;
    map['createdAt'] = createdAt;
    map['updatedAt'] = updatedAt;
    if (images != null) {
      map['images'] = images?.map((v) => v.toJson()).toList();
    }
    return map;
  }
}

class Package {
  Package({
    this.id,
    this.serviceId,
    this.name,
    this.description,
    this.basePrice,
    this.durationMinutes,
    this.isActive,
    this.createdAt,
    this.updatedAt,
    this.service,
  });

  Package.fromJson(dynamic json) {
    id = json['id'];
    serviceId = json['service_id'];
    name = json['name'];
    description = json['description'];
    basePrice = json['base_price'];
    durationMinutes = Data._toInt(
      json['duration_minutes'] ?? json['durationMinutes'],
    );
    isActive = json['is_active'];
    createdAt = json['createdAt'];
    updatedAt = json['updatedAt'];
    service = json['service'] != null
        ? Service.fromJson(json['service'])
        : null;
  }
  int? id;
  int? serviceId;
  String? name;
  String? description;
  String? basePrice;
  int? durationMinutes;
  bool? isActive;
  String? createdAt;
  String? updatedAt;
  Service? service;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['id'] = id;
    map['service_id'] = serviceId;
    map['name'] = name;
    map['description'] = description;
    map['base_price'] = basePrice;
    map['duration_minutes'] = durationMinutes;
    map['is_active'] = isActive;
    map['createdAt'] = createdAt;
    map['updatedAt'] = updatedAt;
    if (service != null) {
      map['service'] = service?.toJson();
    }
    return map;
  }
}

class Service {
  Service({this.id, this.name, this.icon});

  Service.fromJson(dynamic json) {
    id = json['id'];
    name = json['name'];
    icon = json['icon'];
  }
  int? id;
  String? name;
  dynamic icon;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['id'] = id;
    map['name'] = name;
    map['icon'] = icon;
    return map;
  }
}

class CustomerPostService {
  CustomerPostService({
    required this.canReview,
    required this.canTip,
    required this.hasReviewed,
    required this.hasTipped,
  });

  factory CustomerPostService.fromJson(Map<String, dynamic> json) {
    return CustomerPostService(
      canReview: json['can_review'] == true || json['canReview'] == true,
      canTip: json['can_tip'] == true || json['canTip'] == true,
      hasReviewed: json['has_reviewed'] == true || json['hasReviewed'] == true,
      hasTipped: json['has_tipped'] == true || json['hasTipped'] == true,
    );
  }

  final bool canReview;
  final bool canTip;
  final bool hasReviewed;
  final bool hasTipped;
}

class BookingTipSummary {
  BookingTipSummary({this.id, this.amount, this.status, this.currency});

  factory BookingTipSummary.fromJson(Map<String, dynamic> json) {
    return BookingTipSummary(
      id: json['id'] as int?,
      amount: _bdToDouble(json['amount']),
      status: json['status']?.toString(),
      currency: json['currency']?.toString(),
    );
  }

  final int? id;
  final double? amount;
  final String? status;
  final String? currency;
}

class BookingDriverReview {
  BookingDriverReview({
    this.id,
    this.rating,
    this.message,
    this.adminResponse,
    this.adminRespondedAt,
  });

  factory BookingDriverReview.fromJson(Map<String, dynamic> json) {
    final ratingRaw = json['rating'];
    return BookingDriverReview(
      id: json['id'] as int?,
      rating: ratingRaw is int ? ratingRaw : int.tryParse('${ratingRaw ?? ''}'),
      message: json['message']?.toString(),
      adminResponse: json['admin_response']?.toString(),
      adminRespondedAt: json['admin_responded_at']?.toString(),
    );
  }

  final int? id;
  final int? rating;
  final String? message;

  /// Official response written by an admin in the Admin Panel.
  final String? adminResponse;
  final String? adminRespondedAt;

  bool get hasAdminResponse =>
      adminResponse != null && adminResponse!.trim().isNotEmpty;
}

class AssignedDriver {
  AssignedDriver({
    this.id,
    this.name,
    this.profile,
    this.avgRating,
    this.phone,
    this.canReview,
    this.review,
  });

  AssignedDriver.fromJson(dynamic json) {
    if (json is! Map) return;
    final m = Map<String, dynamic>.from(json);
    id = m['id'];
    name = m['name']?.toString();
    profile =
        m['profile']?.toString() ??
        m['profile_picture']?.toString() ??
        m['profile_image']?.toString() ??
        m['avatar']?.toString();
    avgRating = _bdToDouble(m['avg_rating'] ?? m['avgRating']);
    phone =
        m['phone']?.toString() ??
        m['mobile']?.toString() ??
        m['contact_number']?.toString();
    canReview = m['can_review'] == true || m['canReview'] == true;
    final reviewRaw = m['review'];
    review = reviewRaw is Map
        ? BookingDriverReview.fromJson(Map<String, dynamic>.from(reviewRaw))
        : null;
  }
  int? id;
  String? name;
  String? profile;
  double? avgRating;
  String? phone;
  bool? canReview;
  BookingDriverReview? review;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['id'] = id;
    map['name'] = name;
    map['profile'] = profile;
    map['avg_rating'] = avgRating;
    map['phone'] = phone;
    map['can_review'] = canReview;
    if (review != null) {
      map['review'] = {
        'id': review!.id,
        'rating': review!.rating,
        'message': review!.message,
        'admin_response': review!.adminResponse,
        'admin_responded_at': review!.adminRespondedAt,
      };
    }
    return map;
  }
}

class DriverEarningSummary {
  const DriverEarningSummary({
    required this.amount,
    this.tipAmount,
    required this.totalPayout,
    this.kind,
    this.payoutLabel,
    this.note,
    this.cancellationFee,
    this.plannedServicePayout,
  });

  factory DriverEarningSummary.fromJson(dynamic json) {
    if (json is! Map)
      return const DriverEarningSummary(amount: 0, totalPayout: 0);
    final m = Map<String, dynamic>.from(json);
    final amount = _bdToDouble(m['amount']) ?? 0;
    final tip = _bdToDouble(m['tip_amount'] ?? m['tipAmount']);
    final total =
        _bdToDouble(m['total_payout'] ?? m['totalPayout']) ??
        (amount + (tip ?? 0));
    return DriverEarningSummary(
      amount: amount,
      tipAmount: tip != null && tip > 0 ? tip : null,
      totalPayout: total,
      kind: m['kind']?.toString(),
      payoutLabel:
          m['payout_label']?.toString() ?? m['payoutLabel']?.toString(),
      note: m['note']?.toString(),
      cancellationFee: _bdToDouble(
        m['cancellation_fee'] ?? m['cancellationFee'],
      ),
      plannedServicePayout: _bdToDouble(
        m['planned_service_payout'] ?? m['plannedServicePayout'],
      ),
    );
  }

  final double amount;
  final double? tipAmount;
  final double totalPayout;
  final String? kind;
  final String? payoutLabel;
  final String? note;
  final double? cancellationFee;
  final double? plannedServicePayout;

  bool get isNoShowShare => kind == 'no_show';
  bool get isCancellationShare => kind == 'cancellation_share';
  bool get isAdjustedPayout => isNoShowShare || isCancellationShare;

  String get heroEarningLabel {
    if (isNoShowShare) return 'NO-SHOW SHARE';
    if (isCancellationShare) return 'CANCELLATION SHARE';
    return 'YOUR EARNING';
  }

  String get primaryPayoutLabel =>
      (payoutLabel != null && payoutLabel!.trim().isNotEmpty)
      ? payoutLabel!.trim()
      : 'Service payout';

  String get totalPayoutDisplay => '\$${totalPayout.toStringAsFixed(2)}';
  String get amountDisplay => '\$${amount.toStringAsFixed(2)}';
}

/// Generic catch-all item used by some endpoints for `addons` / `images`.
/// Keeping this class name to match legacy generated code.
class Dynamic {
  Dynamic({Map<String, dynamic>? raw}) : _raw = raw;

  Dynamic.fromJson(dynamic json) : _raw = _asMap(json);

  final Map<String, dynamic>? _raw;

  Map<String, dynamic> toJson() => _raw ?? const <String, dynamic>{};

  static Map<String, dynamic>? _asMap(dynamic json) {
    if (json == null) return null;
    if (json is Map<String, dynamic>) return json;
    if (json is Map) {
      return json.map((k, v) => MapEntry('$k', v));
    }
    return <String, dynamic>{'value': json};
  }
}
