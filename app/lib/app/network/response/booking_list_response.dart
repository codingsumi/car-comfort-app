import '../../utils/driver_job_duration.dart';

class BookingListResponse {
  BookingListResponse({this.status, this.message, this.data});

  BookingListResponse.fromJson(dynamic json) {
    if (json is! Map) {
      status = null;
      message = null;
      data = null;
      return;
    }
    final m = Map<String, dynamic>.from(json);
    status = m['status']?.toString();
    message = m['message']?.toString();
    final d = m['data'];
    if (d == null) {
      data = null;
    } else if (d is List) {
      data = Data.fromJson({'bookings': d, 'pagination': m['pagination']});
    } else {
      data = Data.fromJson(d);
    }
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

int? _blToInt(dynamic v) {
  if (v == null) return null;
  if (v is int) return v;
  if (v is num) return v.toInt();
  return int.tryParse(v.toString().trim());
}

double? _blToDouble(dynamic v) {
  if (v == null) return null;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString().trim());
}

ServiceLocation? _bookingPickupLocation(Map<String, dynamic> m) {
  ServiceLocation? fromMap(dynamic raw) {
    if (raw is! Map) return null;
    final s = ServiceLocation.fromJson(raw);
    if (s.latitude != null &&
        s.longitude != null &&
        s.latitude!.isFinite &&
        s.longitude!.isFinite) {
      return s;
    }
    return null;
  }

  for (final key in [
    'pickup_location',
    'pickupLocation',
    'pickup',
    'service_pickup',
    // socket payloads may use 'location' or 'booking_location' at root level
    'location',
    'booking_location',
    'service_loc',
  ]) {
    final s = fromMap(m[key]);
    if (s != null) return s;
  }

  final lat = _blToDouble(m['latitude'] ?? m['lat'] ?? m['pickup_latitude']);
  final lng = _blToDouble(
    m['longitude'] ?? m['lng'] ?? m['lon'] ?? m['pickup_longitude'],
  );
  if (lat != null &&
      lng != null &&
      lat.isFinite &&
      lng.isFinite) {
    return ServiceLocation(
      address: m['pickup_address']?.toString() ??
          m['address']?.toString() ??
          '',
      latitude: lat,
      longitude: lng,
    );
  }

  final cust = m['customer'] ?? m['customer_detail'] ?? m['customerDetail'];
  if (cust is Map) {
    final cm = Map<String, dynamic>.from(cust);
    final locRaw = cm['location'] ?? cm['Location'];
    if (locRaw is Map) {
      final locMap = Map<String, dynamic>.from(locRaw);
      locMap['address'] =
          locMap['address']?.toString() ?? cm['name']?.toString() ?? '';
      final s = ServiceLocation.fromJson(locMap);
      if (s.latitude != null &&
          s.longitude != null &&
          s.latitude!.isFinite &&
          s.longitude!.isFinite) {
        return s;
      }
    }
  }
  return null;
}

class Data {
  Data({this.bookings, this.pagination});

  Data.fromJson(dynamic json) {
    if (json is List) {
      bookings = [];
      for (final v in json) {
        if (v is Map) {
          bookings!.add(Bookings.fromJson(Map<String, dynamic>.from(v)));
        }
      }
      pagination = null;
      return;
    }
    if (json is! Map) {
      bookings = null;
      pagination = null;
      return;
    }
    final m = Map<String, dynamic>.from(json);
    dynamic rawList = m['bookings'];
    if (rawList == null && m['data'] is Map) {
      final inner = Map<String, dynamic>.from(m['data'] as Map);
      rawList = inner['bookings'] ?? inner['items'] ?? inner['results'];
    }
    rawList ??= m['results'] ?? m['items'];
    if (rawList != null && rawList is List) {
      bookings = [];
      for (final v in rawList) {
        if (v is Map) {
          bookings!.add(Bookings.fromJson(Map<String, dynamic>.from(v)));
        }
      }
    }
    final pag = m['pagination'] ?? m['meta'];
    pagination = pag is Map ? Pagination.fromJson(pag) : null;
  }

  List<Bookings>? bookings;
  Pagination? pagination;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    if (bookings != null) {
      map['bookings'] = bookings?.map((v) => v.toJson()).toList();
    }
    if (pagination != null) {
      map['pagination'] = pagination?.toJson();
    }
    return map;
  }
}

class Pagination {
  Pagination({this.total, this.page, this.limit, this.totalPages});

  Pagination.fromJson(dynamic json) {
    if (json is! Map) return;
    final m = Map<String, dynamic>.from(json);
    total = _blToInt(m['total']);
    page = _blToInt(m['page'] ?? m['current_page']);
    limit = _blToInt(m['limit']);
    totalPages = _blToInt(m['totalPages'] ?? m['total_pages']);
  }

  int? total;
  int? page;
  int? limit;
  int? totalPages;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['total'] = total;
    map['page'] = page;
    map['limit'] = limit;
    map['totalPages'] = totalPages;
    return map;
  }
}

class Bookings {
  Bookings({
    this.id,
    this.bookingCode,
    this.status,
    this.cancelledBy,
    this.cancellationReason,
    this.trackingStatus,
    this.serviceType,
    this.scheduleType,
    this.scheduledAt,
    this.serviceDatetime,
    this.createdAt,
    this.totalPrice,
    this.currency,
    this.totalPriceDisplay,
    this.distanceMiles,
    this.requiresAdminAssignment = false,
    this.serviceLocation,
    this.customerDetail,
    this.driverId,
    this.driverDetail,
    this.packageId,
    this.packageName,
    this.customPackageName,
    this.serviceDurationMinutes,
    this.estimatedTravelMinutes,
    this.estimatedCompletionMinutes,
    this.providerEarning,
    this.providerEarningDisplay,
  });

  Bookings.fromJson(dynamic json) {
    if (json is! Map) return;
    final m = Map<String, dynamic>.from(json);
    id = _blToInt(m['id']);
    bookingCode =
        m['booking_code']?.toString() ?? m['bookingCode']?.toString();
    status = m['status']?.toString();
    cancelledBy =
        m['cancelled_by']?.toString() ?? m['cancelledBy']?.toString();
    cancellationReason =
        m['cancellation_reason']?.toString() ??
        m['cancellationReason']?.toString();
    trackingStatus = (m['tracking_status'] ?? m['trackingStatus'])?.toString();
    serviceType = m['service_type']?.toString() ?? m['serviceType']?.toString();
    scheduleType =
        m['schedule_type']?.toString() ?? m['scheduleType']?.toString();
    serviceDatetime =
        m['service_datetime']?.toString() ?? m['serviceDatetime']?.toString();
    scheduledAt = serviceDatetime ??
        m['scheduled_at']?.toString() ??
        m['scheduledAt']?.toString();
    createdAt = m['created_at']?.toString() ?? m['createdAt']?.toString();
    totalPrice = _blToDouble(m['total_price'] ?? m['totalPrice']);
    currency = m['currency']?.toString();
    totalPriceDisplay =
        m['total_price_display']?.toString() ?? m['totalPriceDisplay']?.toString();
    distanceMiles = _blToDouble(m['distance_miles'] ?? m['distanceMiles']);
    final slRaw = m['service_location'] ?? m['serviceLocation'];
    ServiceLocation? svc =
        slRaw is Map ? ServiceLocation.fromJson(slRaw) : null;
    final serviceAddr =
        (m['service_address'] ?? m['serviceAddress'])?.toString().trim() ?? '';
    final serviceName =
        (m['service_location_name'] ?? m['serviceLocationName'])
                ?.toString()
                .trim() ??
            '';
    if (svc != null) {
      if (serviceAddr.isNotEmpty && (svc.address ?? '').trim().isEmpty) {
        svc = ServiceLocation(
          address: serviceAddr,
          name: serviceName.isNotEmpty ? serviceName : svc.name,
          latitude: svc.latitude,
          longitude: svc.longitude,
        );
      } else if (serviceName.isNotEmpty && (svc.name ?? '').trim().isEmpty) {
        svc = ServiceLocation(
          address: svc.address,
          name: serviceName,
          latitude: svc.latitude,
          longitude: svc.longitude,
        );
      }
    } else if (serviceAddr.isNotEmpty) {
      final lat = _blToDouble(
        m['service_latitude'] ?? m['service_lat'] ?? m['serviceLatitude'],
      );
      final lng = _blToDouble(
        m['service_longitude'] ?? m['service_lng'] ?? m['serviceLongitude'],
      );
      svc = ServiceLocation(
        address: serviceAddr,
        name: serviceName.isNotEmpty ? serviceName : null,
        latitude: lat,
        longitude: lng,
      );
    }
    if (svc == null ||
        svc.latitude == null ||
        svc.longitude == null ||
        !svc.latitude!.isFinite ||
        !svc.longitude!.isFinite) {
      final inferred = _bookingPickupLocation(m);
      if (inferred != null) svc = inferred;
    }
    serviceLocation = svc;
    final rawCustomer = m['customer_detail'] ?? m['customerDetail'] ?? m['customer'];
    customerDetail = rawCustomer is Map
        ? CustomerDetail.fromJson(rawCustomer)
        : null;
    driverId = _blToInt(m['driver_id'] ?? m['driverId']);
    final ddRaw = m['driver_detail'] ?? m['driverDetail'];
    driverDetail = ddRaw is Map ? DriverDetail.fromJson(ddRaw) : null;
    packageId = _blToInt(m['package_id'] ?? m['packageId']);
    packageName = m['package_name']?.toString() ?? m['packageName']?.toString();
    customPackageName =
        m['custom_package_name']?.toString() ?? m['customPackageName']?.toString();
    serviceDurationMinutes = _blToInt(
      m['service_duration_minutes'] ?? m['serviceDurationMinutes'],
    );
    estimatedTravelMinutes = _blToInt(
      m['estimated_travel_minutes'] ?? m['estimatedTravelMinutes'],
    );
    estimatedCompletionMinutes = _blToInt(
      m['estimated_completion_minutes'] ?? m['estimatedCompletionMinutes'],
    );
    providerEarning = _blToDouble(m['provider_earning'] ?? m['providerEarning']);
    providerEarningDisplay = m['provider_earning_display']?.toString() ??
        m['providerEarningDisplay']?.toString();
    vehicleChargeLimit = m['vehicle_charge_limit'] ?? m['vehicleChargeLimit'];
    currentBatteryCharge =
        m['current_battery_charge']?.toString() ??
        m['currentBatteryCharge']?.toString();
    currentBatteryStatus =
        m['current_battery_status']?.toString() ??
        m['currentBatteryStatus']?.toString();
    currentBatteryStatusLabel =
        m['current_battery_status_label']?.toString() ??
        m['currentBatteryStatusLabel']?.toString();
  }

  int? id;
  String? bookingCode;
  String? status;
  String? cancelledBy;
  String? cancellationReason;
  String? trackingStatus;
  String? serviceType;
  String? scheduleType;
  String? scheduledAt;
  String? serviceDatetime;
  String? createdAt;
  double? totalPrice;
  String? currency;
  String? totalPriceDisplay;
  double? distanceMiles;
  bool requiresAdminAssignment = false;
  ServiceLocation? serviceLocation;
  CustomerDetail? customerDetail;
  int? driverId;
  DriverDetail? driverDetail;
  int? packageId;
  String? packageName;
  String? customPackageName;
  int? serviceDurationMinutes;
  int? estimatedTravelMinutes;
  int? estimatedCompletionMinutes;
  double? providerEarning;
  String? providerEarningDisplay;
  dynamic vehicleChargeLimit;
  String? currentBatteryCharge;
  String? currentBatteryStatus;
  String? currentBatteryStatusLabel;

  /// Convenience getters used by the home-map overlay cards.
  double? get mapCardLatitude => serviceLocation?.latitude;
  double? get mapCardLongitude => serviceLocation?.longitude;

  /// API `total_price_display` when set; otherwise formats [totalPrice] (socket `basic_info`).
  String get displayAmountLabel {
    final display = totalPriceDisplay?.trim();
    if (display != null && display.isNotEmpty) return display;
    final price = totalPrice;
    if (price == null || !price.isFinite) return '—';
    final c = (currency ?? '').trim().toLowerCase();
    final symbol = c.isEmpty || c == 'usd' ? '\$' : '${currency!.trim()} ';
    return '$symbol${price.toStringAsFixed(2)}';
  }

  /// Provider payout for job-board cards (never the customer total).
  String get displayProviderEarningLabel {
    return formatProviderEarningLabel(
      providerEarning: providerEarning,
      providerEarningDisplay: providerEarningDisplay,
    );
  }

  /// Socket event payloads are not always wrapped in the same envelope as REST.
  /// Accepts either a booking map directly, or `{ booking: {...} }`, or `{ data: {...} }`.
  ///
  /// Also normalizes `new_booking_available` shape:
  /// `{ booking_id, lat, lng, basic_info: { booking_code, service_type, ... } }`
  /// into the flat fields [Bookings.fromJson] expects (`id`, `service_location`, …).
  static Bookings? fromNewBookingAvailableEvent(dynamic data) {
    if (data == null) return null;
    dynamic payload = data;
    if (payload is List && payload.isNotEmpty) {
      payload = payload.first;
    }
    if (payload is Map) {
      final p = Map<String, dynamic>.from(payload);
      if (p['booking'] != null) {
        payload = p['booking'];
      } else if (p['payload'] != null) {
        payload = p['payload'];
      } else if (p['data'] != null) {
        payload = p['data'];
      }
    }
    if (payload is! Map) return null;

    final merged = _stringKeyMapFromDynamic(payload);
    if (merged == null) return null;

    final idVal = merged['id'] ?? merged['booking_id'] ?? merged['bookingId'];
    if (idVal != null) {
      if (idVal is int) {
        merged['id'] = idVal;
      } else {
        merged['id'] = int.tryParse('$idVal');
      }
    }

    final biRaw = merged['basic_info'];
    if (biRaw is Map) {
      final bi = _stringKeyMapFromDynamic(biRaw);
      if (bi != null) {
        // Prefer nested basic_info for pricing and booking metadata (socket payloads).
        for (final key in const [
          'total_price',
          'total_price_display',
          'booking_code',
          'service_type',
          'schedule_type',
          'scheduled_at',
          'service_datetime',
          'status',
          'service_address',
          'currency',
          'package_id',
          'package_name',
          'service_duration_minutes',
          'estimated_travel_minutes',
          'estimated_completion_minutes',
          'provider_earning',
          'provider_earning_display',
        ]) {
          if (bi.containsKey(key) && bi[key] != null) {
            merged[key] = bi[key];
          }
        }
        bi.forEach((k, v) {
          if (!merged.containsKey(k) || merged[k] == null) {
            merged[k] = v;
          }
        });
      }
    }

    if ((merged['scheduled_at'] == null ||
            '${merged['scheduled_at']}'.trim().isEmpty) &&
        merged['service_datetime'] != null) {
      merged['scheduled_at'] = merged['service_datetime'];
    }

    if (merged['service_location'] == null) {
      // Try common location-object keys that socket payloads may use.
      for (final locKey in const [
        'location',
        'booking_location',
        'service_loc',
        'pickup_location',
      ]) {
        final raw = merged[locKey];
        if (raw is Map) {
          final loc = ServiceLocation.fromJson(raw);
          if (loc.latitude != null &&
              loc.longitude != null &&
              loc.latitude!.isFinite &&
              loc.longitude!.isFinite) {
            merged['service_location'] = raw;
            break;
          }
        }
      }
    }

    if (merged['service_location'] == null) {
      // Fall back to flat lat/lng fields (various naming conventions).
      final lat = _readDouble(merged['lat']) ??
          _readDouble(merged['latitude']) ??
          _readDouble(merged['service_lat']) ??
          _readDouble(merged['service_latitude']);
      final lng = _readDouble(merged['lng']) ??
          _readDouble(merged['longitude']) ??
          _readDouble(merged['service_lng']) ??
          _readDouble(merged['service_longitude']);
      if (lat != null &&
          lng != null &&
          lat.isFinite &&
          lng.isFinite) {
        final addr = '${merged['service_address'] ?? merged['address'] ?? ''}'
            .trim();
        merged['service_location'] = <String, dynamic>{
          'address': addr.isEmpty ? null : addr,
          'name': merged['service_location_name']?.toString(),
          'latitude': lat,
          'longitude': lng,
        };
      }
    }

    return Bookings.fromJson(merged);
  }

  static Map<String, dynamic>? _stringKeyMapFromDynamic(Map<dynamic, dynamic> raw) {
    try {
      return Map<String, dynamic>.fromEntries(
        raw.entries.map((e) => MapEntry('${e.key}', e.value)),
      );
    } catch (_) {
      return null;
    }
  }

  static double? _readDouble(dynamic v) {
    if (v == null) return null;
    if (v is num) return v.toDouble();
    return double.tryParse('$v');
  }

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['id'] = id;
    map['booking_code'] = bookingCode;
    map['status'] = status;
    map['service_type'] = serviceType;
    map['schedule_type'] = scheduleType;
    map['scheduled_at'] = scheduledAt;
    map['created_at'] = createdAt;
    map['total_price'] = totalPrice;
    map['currency'] = currency;
    map['total_price_display'] = totalPriceDisplay;
    map['distance_miles'] = distanceMiles;
    if (serviceLocation != null) {
      map['service_location'] = serviceLocation?.toJson();
    }
    if (customerDetail != null) {
      map['customer_detail'] = customerDetail?.toJson();
    }
    map['driver_id'] = driverId;
    if (driverDetail != null) {
      map['driver_detail'] = driverDetail?.toJson();
    }
    map['package_id'] = packageId;
    map['package_name'] = packageName;
    map['service_duration_minutes'] = serviceDurationMinutes;
    map['estimated_travel_minutes'] = estimatedTravelMinutes;
    map['estimated_completion_minutes'] = estimatedCompletionMinutes;
    map['provider_earning'] = providerEarning;
    map['provider_earning_display'] = providerEarningDisplay;
    return map;
  }
}

class CustomerDetail {
  CustomerDetail({
    this.id,
    this.name,
    this.profilePicture,
    this.phone,
  });

  CustomerDetail.fromJson(dynamic json) {
    if (json is! Map) return;
    final m = Map<String, dynamic>.from(json);
    id = _blToInt(m['id']);
    name = m['name']?.toString();
    if (name == null || name!.trim().isEmpty) {
      final first = m['first_name']?.toString() ?? '';
      final last = m['last_name']?.toString() ?? '';
      final full = '$first $last'.trim();
      if (full.isNotEmpty) name = full;
    }
    profilePicture = m['profile_picture']?.toString() ??
        m['profile_image']?.toString() ??
        m['profile']?.toString() ??
        m['avatar']?.toString() ??
        m['avatar_url']?.toString() ??
        m['photo']?.toString();
    phone = m['phone']?.toString() ??
        m['mobile']?.toString() ??
        m['contact_number']?.toString();
  }

  int? id;
  String? name;
  String? profilePicture;
  String? phone;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['id'] = id;
    map['name'] = name;
    map['profile_picture'] = profilePicture;
    map['phone'] = phone;
    return map;
  }
}

class DriverDetail {
  DriverDetail({
    this.id,
    this.name,
    this.profilePicture,
    this.avgRating,
    this.reviewCount,
  });

  DriverDetail.fromJson(dynamic json) {
    if (json is! Map) return;
    final m = Map<String, dynamic>.from(json);
    id = _blToInt(m['id']);
    name = m['name']?.toString();
    profilePicture = m['profile_picture']?.toString();
    avgRating = _blToDouble(m['avg_rating'] ?? m['avgRating']);
    reviewCount = _blToInt(m['review_count'] ?? m['reviewCount']);
  }

  int? id;
  String? name;
  String? profilePicture;
  double? avgRating;
  int? reviewCount;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['id'] = id;
    map['name'] = name;
    map['profile_picture'] = profilePicture;
    map['avg_rating'] = avgRating;
    map['review_count'] = reviewCount;
    return map;
  }
}

class ServiceLocation {
  ServiceLocation({this.address, this.name, this.latitude, this.longitude});

  ServiceLocation.fromJson(dynamic json) {
    if (json is! Map) return;
    final m = Map<String, dynamic>.from(json);
    address = m['address']?.toString();
    name = m['name']?.toString();
    latitude = _blToDouble(m['latitude'] ?? m['lat']);
    longitude = _blToDouble(m['longitude'] ?? m['lng'] ?? m['lon']);
  }

  String? address;
  String? name;
  double? latitude;
  double? longitude;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['address'] = address;
    map['name'] = name;
    map['latitude'] = latitude;
    map['longitude'] = longitude;
    return map;
  }
}
