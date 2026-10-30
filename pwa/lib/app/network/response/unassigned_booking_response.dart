double? _ubToDouble(dynamic v) {
  if (v == null) return null;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString().trim());
}

int? _ubToInt(dynamic v) {
  if (v == null) return null;
  if (v is int) return v;
  if (v is num) return v.toInt();
  return int.tryParse(v.toString().trim());
}

class UnassignedBookingResponse {
  UnassignedBookingResponse({
    this.status,
    this.message,
    this.data,
  });

  UnassignedBookingResponse.fromJson(dynamic json) {
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
      data = Data.fromJson({
        'bookings': d,
        'pagination': m['pagination'],
      });
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

class Data {
  Data({
    this.bookings,
    this.pagination,
  });

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
    final pag = m['pagination'];
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
  Pagination({
    this.total,
    this.page,
    this.limit,
    this.totalPages,
  });

  Pagination.fromJson(dynamic json) {
    if (json is! Map) return;
    final m = Map<String, dynamic>.from(json);
    total = _ubToInt(m['total']);
    page = _ubToInt(m['page'] ?? m['current_page']);
    limit = _ubToInt(m['limit']);
    totalPages = _ubToInt(m['totalPages'] ?? m['total_pages']);
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
    this.serviceType,
    this.scheduleType,
    this.scheduledAt,
    this.createdAt,
    this.totalPrice,
    this.currency,
    this.totalPriceDisplay,
    this.distanceMiles,
    this.requiresAdminAssignment = false,
    this.serviceLocation,
    this.customer,
    this.packageId,
    this.packageName,
    this.serviceDurationMinutes,
    this.estimatedTravelMinutes,
    this.estimatedCompletionMinutes,
    this.providerEarning,
    this.providerEarningDisplay,
  });

  Bookings.fromJson(dynamic json) {
    if (json is! Map) return;
    final m = Map<String, dynamic>.from(json);
    id = _ubToInt(m['id']);
    bookingCode =
        m['booking_code']?.toString() ?? m['bookingCode']?.toString();
    status = m['status']?.toString();
    serviceType = m['service_type']?.toString() ?? m['serviceType']?.toString();
    scheduleType =
        m['schedule_type']?.toString() ?? m['scheduleType']?.toString();
    final serviceDatetimeRaw =
        m['service_datetime']?.toString() ?? m['serviceDatetime']?.toString();
    scheduledAt = serviceDatetimeRaw ??
        m['scheduled_at']?.toString() ??
        m['scheduledAt']?.toString();
    createdAt = m['created_at']?.toString() ?? m['createdAt']?.toString();
    totalPrice = _ubToDouble(m['total_price'] ?? m['totalPrice']);
    currency = m['currency']?.toString();
    totalPriceDisplay =
        m['total_price_display']?.toString() ?? m['totalPriceDisplay']?.toString();
    distanceMiles = _ubToDouble(m['distance_miles'] ?? m['distanceMiles']);
    requiresAdminAssignment =
        m['requires_admin_assignment'] == true ||
        m['requiresAdminAssignment'] == true;
    serviceLocation = _parseServiceLocation(m);
    customer = m['customer'] != null ? Customer.fromJson(m['customer']) : null;
    packageId = _ubToInt(m['package_id'] ?? m['packageId']);
    packageName = m['package_name']?.toString() ?? m['packageName']?.toString();
    serviceDurationMinutes = _ubToInt(
      m['service_duration_minutes'] ?? m['serviceDurationMinutes'],
    );
    estimatedTravelMinutes = _ubToInt(
      m['estimated_travel_minutes'] ?? m['estimatedTravelMinutes'],
    );
    estimatedCompletionMinutes = _ubToInt(
      m['estimated_completion_minutes'] ?? m['estimatedCompletionMinutes'],
    );
    providerEarning = _ubToDouble(m['provider_earning'] ?? m['providerEarning']);
    providerEarningDisplay = m['provider_earning_display']?.toString() ??
        m['providerEarningDisplay']?.toString();
  }

  static ServiceLocation? _parseServiceLocation(Map<String, dynamic> m) {
    dynamic raw = m['service_location'] ?? m['serviceLocation'];
    if (raw is Map) {
      final sl = ServiceLocation.fromJson(raw);
      if (sl.latitude != null && sl.longitude != null) return sl;
    }
    for (final key in [
      'pickup_location',
      'pickupLocation',
      'pickup',
      'service_pickup',
    ]) {
      final v = m[key];
      if (v is Map) {
        final sl = ServiceLocation.fromJson(v);
        if (sl.latitude != null && sl.longitude != null) return sl;
      }
    }
    final lat = _ubToDouble(m['latitude'] ?? m['lat'] ?? m['pickup_latitude']);
    final lng = _ubToDouble(
      m['longitude'] ?? m['lng'] ?? m['lon'] ?? m['pickup_longitude'],
    );
    if (lat != null && lng != null) {
      return ServiceLocation(
        address: m['pickup_address']?.toString() ??
            m['address']?.toString() ??
            '',
        latitude: lat,
        longitude: lng,
      );
    }
    return null;
  }

  int? id;
  String? bookingCode;
  String? status;
  String? serviceType;
  String? scheduleType;
  String? scheduledAt;
  String? createdAt;
  double? totalPrice;
  String? currency;
  String? totalPriceDisplay;
  double? distanceMiles;
  bool requiresAdminAssignment = false;
  ServiceLocation? serviceLocation;
  Customer? customer;
  int? packageId;
  String? packageName;
  int? serviceDurationMinutes;
  int? estimatedTravelMinutes;
  int? estimatedCompletionMinutes;
  double? providerEarning;
  String? providerEarningDisplay;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['id'] = id;
    map['booking_code'] = bookingCode;
    map['status'] = status;
    map['service_type'] = serviceType;
    map['schedule_type'] = scheduleType;
    map['created_at'] = createdAt;
    map['total_price'] = totalPrice;
    map['currency'] = currency;
    map['total_price_display'] = totalPriceDisplay;
    map['distance_miles'] = distanceMiles;
    if (serviceLocation != null) {
      map['service_location'] = serviceLocation?.toJson();
    }
    if (customer != null) {
      map['customer'] = customer?.toJson();
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

class Customer {
  Customer({
    this.id,
    this.name,
    this.profile,
    this.location,
    this.avgRating,
    this.reviewCount,
  });

  Customer.fromJson(dynamic json) {
    if (json is! Map) return;
    final m = Map<String, dynamic>.from(json);
    id = _ubToInt(m['id']);
    name = m['name']?.toString();
    profile = m['profile']?.toString() ??
        m['profile_picture']?.toString() ??
        m['profile_image']?.toString();
    location = m['location'] != null ? Location.fromJson(m['location']) : null;
    avgRating = _ubToDouble(m['avg_rating'] ?? m['avgRating']);
    reviewCount = _ubToInt(m['review_count'] ?? m['reviewCount']);
  }
  int? id;
  String? name;
  String? profile;
  Location? location;
  double? avgRating;
  int? reviewCount;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['id'] = id;
    map['name'] = name;
    map['profile'] = profile;
    if (location != null) {
      map['location'] = location?.toJson();
    }
    map['avg_rating'] = avgRating;
    map['review_count'] = reviewCount;
    return map;
  }
}

class Location {
  Location({
    this.latitude,
    this.longitude,
  });

  Location.fromJson(dynamic json) {
    if (json is! Map) return;
    final m = Map<String, dynamic>.from(json);
    latitude = _ubToDouble(m['latitude'] ?? m['lat']);
    longitude = _ubToDouble(m['longitude'] ?? m['lng'] ?? m['lon']);
  }
  double? latitude;
  double? longitude;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['latitude'] = latitude;
    map['longitude'] = longitude;
    return map;
  }
}

class ServiceLocation {
  ServiceLocation({
    this.address,
    this.latitude,
    this.longitude,
  });

  ServiceLocation.fromJson(dynamic json) {
    if (json is! Map) return;
    final m = Map<String, dynamic>.from(json);
    address = m['address']?.toString();
    latitude = _ubToDouble(m['latitude'] ?? m['lat']);
    longitude = _ubToDouble(m['longitude'] ?? m['lng'] ?? m['lon']);
  }
  String? address;
  double? latitude;
  double? longitude;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['address'] = address;
    map['latitude'] = latitude;
    map['longitude'] = longitude;
    return map;
  }
}
