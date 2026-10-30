import 'booking_detail_response.dart' show Dynamic;

num? _asNum(dynamic value) {
  if (value == null) return null;
  if (value is num) return value;
  if (value is String) return num.tryParse(value.trim());
  return null;
}

int? _asInt(dynamic value) {
  final n = _asNum(value);
  if (n == null) return null;
  return n.round();
}

String? _jsonString(dynamic value) {
  if (value == null) return null;
  if (value is String) {
    final t = value.trim();
    return t.isEmpty ? null : t;
  }
  return value.toString();
}

bool? _asBool(dynamic value) {
  if (value == null) return null;
  if (value is bool) return value;
  if (value is num) return value != 0;
  if (value is String) {
    final s = value.toLowerCase().trim();
    if (s == 'true' || s == '1' || s == 'yes') return true;
    if (s == 'false' || s == '0' || s == 'no') return false;
  }
  return null;
}

class BookingReviewResponse {
  BookingReviewResponse({this.status, this.message, this.errorType, this.data});

  BookingReviewResponse.fromJson(dynamic json) {
    status = json['status'];
    message = json['message'];
    errorType = json['error_type'];
    data = json['data'] != null ? Data.fromJson(json['data']) : null;
  }

  String? status;
  String? message;
  dynamic errorType;
  Data? data;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['status'] = status;
    map['message'] = message;
    map['error_type'] = errorType;
    if (data != null) {
      map['data'] = data?.toJson();
    }
    return map;
  }
}

class Data {
  Data({
    this.bookingId,
    this.status,
    this.serviceType,
    this.location,
    this.serviceDetails,
    this.vehicle,
    this.evChargingDetails,
    this.bookingImages,
    this.priceSummary,
    this.serviceNotes,
  });

  Data.fromJson(dynamic json) {
    bookingId = _asInt(json['booking_id']);
    status = json['status']?.toString();
    serviceType = json['service_type']?.toString();
    location = json['location'] != null
        ? Location.fromJson(json['location'])
        : null;
    serviceDetails = json['service_details'] != null
        ? ServiceDetails.fromJson(json['service_details'])
        : null;
    vehicle = json['vehicle'] != null
        ? Vehicle.fromJson(json['vehicle'])
        : null;
    evChargingDetails = json['ev_charging_details'] != null
        ? EvChargingDetails.fromJson(json['ev_charging_details'])
        : null;
    final sn = json['service_notes'];
    serviceNotes = sn is Map ? ServiceNotes.fromJson(sn) : null;
    if (json['booking_images'] != null) {
      bookingImages = [];
      json['booking_images'].forEach((v) {
        bookingImages?.add(Dynamic.fromJson(v));
      });
    }
    priceSummary = json['price_summary'] != null
        ? PriceSummary.fromJson(json['price_summary'])
        : null;
  }

  int? bookingId;
  String? status;
  String? serviceType;
  Location? location;
  ServiceDetails? serviceDetails;
  Vehicle? vehicle;
  EvChargingDetails? evChargingDetails;
  List<dynamic>? bookingImages;
  PriceSummary? priceSummary;
  ServiceNotes? serviceNotes;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['booking_id'] = bookingId;
    map['status'] = status;
    map['service_type'] = serviceType;
    if (location != null) {
      map['location'] = location?.toJson();
    }
    if (serviceDetails != null) {
      map['service_details'] = serviceDetails?.toJson();
    }
    if (vehicle != null) {
      map['vehicle'] = vehicle?.toJson();
    }
    if (evChargingDetails != null) {
      map['ev_charging_details'] = evChargingDetails?.toJson();
    }
    if (bookingImages != null) {
      map['booking_images'] = bookingImages?.map((v) => v.toJson()).toList();
    }
    if (priceSummary != null) {
      map['price_summary'] = priceSummary?.toJson();
    }
    if (serviceNotes != null) {
      map['service_notes'] = serviceNotes?.toJson();
    }
    return map;
  }
}

class ServiceNotes {
  ServiceNotes({
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
    this.parkingInstructions,
    this.notes,
  });

  factory ServiceNotes.fromJson(dynamic json) {
    if (json is! Map) return ServiceNotes();
    final m = Map<String, dynamic>.from(json);
    return ServiceNotes(
      vehicleParkedLocation: m['vehicle_parked_location']?.toString(),
      vehicleParkedLocationLabel: m['vehicle_parked_location_label']?.toString(),
      vehicleParkedLocationOther: m['vehicle_parked_location_other']?.toString(),
      providerParkLocation: m['provider_park_location']?.toString(),
      providerParkLocationLabel: m['provider_park_location_label']?.toString(),
      providerParkLocationOther: m['provider_park_location_other']?.toString(),
      vehicleKeyLocation: m['vehicle_key_location']?.toString(),
      vehicleKeyLocationLabel: m['vehicle_key_location_label']?.toString(),
      vehicleKeyLocationOther: m['vehicle_key_location_other']?.toString(),
      keyReturnLocation: m['key_return_location']?.toString(),
      keyReturnLocationLabel: m['key_return_location_label']?.toString(),
      keyReturnLocationOther: m['key_return_location_other']?.toString(),
      parkingInstructions: m['parking_instructions']?.toString(),
      notes: m['notes']?.toString(),
    );
  }

  final String? vehicleParkedLocation;
  final String? vehicleParkedLocationLabel;
  final String? vehicleParkedLocationOther;
  final String? providerParkLocation;
  final String? providerParkLocationLabel;
  final String? providerParkLocationOther;
  final String? vehicleKeyLocation;
  final String? vehicleKeyLocationLabel;
  final String? vehicleKeyLocationOther;
  final String? keyReturnLocation;
  final String? keyReturnLocationLabel;
  final String? keyReturnLocationOther;
  final String? parkingInstructions;
  final String? notes;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
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
    map['parking_instructions'] = parkingInstructions;
    map['notes'] = notes;
    return map;
  }
}

class PriceSummary {
  PriceSummary({this.title, this.applicableCharges, this.total});

  PriceSummary.fromJson(dynamic json) {
    if (json is! Map) return;
    final m = Map<String, dynamic>.from(json);
    title = m['title']?.toString();
    final rawLines = m['applicable_charges'] ?? m['applicableCharges'];
    if (rawLines is List) {
      applicableCharges = [];
      for (final v in rawLines) {
        if (v is Map) {
          applicableCharges!.add(Lines.fromJson(Map<String, dynamic>.from(v)));
        }
      }
    }
    total = _asDouble(
      m['total'] ?? m['estimated_total'] ?? m['estimatedTotal'],
    );
  }

  String? title;
  List<Lines>? applicableCharges;
  double? total;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['title'] = title;
    if (applicableCharges != null) {
      map['applicable_charges'] = applicableCharges
          ?.map((v) => v.toJson())
          .toList();
    }
    map['total'] = total;
    return map;
  }
}

double? _asDouble(dynamic value) {
  final n = _asNum(value);
  if (n == null) return null;
  return n.toDouble();
}

class Lines {
  Lines({this.key, this.label, this.amount, this.sectionTitle, this.valueText});

  Lines.fromJson(dynamic json) {
    if (json is! Map) return;
    final m = Map<String, dynamic>.from(json);
    key = m['key']?.toString();
    label = m['label']?.toString();
    amount = _asDouble(m['amount']);
    sectionTitle =
        m['section_title']?.toString() ?? m['sectionTitle']?.toString();
    valueText = m['value_text']?.toString() ?? m['valueText']?.toString();
  }

  String? key;
  String? label;
  double? amount;
  String? sectionTitle;
  String? valueText;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['key'] = key;
    map['label'] = label;
    map['amount'] = amount;
    map['section_title'] = sectionTitle;
    map['value_text'] = valueText;
    return map;
  }
}

class EvChargingDetails {
  EvChargingDetails({this.targetKwh, this.kwhToCharge, this.chargingCost});

  EvChargingDetails.fromJson(dynamic json) {
    targetKwh = _asNum(json['targetKwh']);
    kwhToCharge = _asNum(json['kwhToCharge']);
    chargingCost = _asNum(json['chargingCost']);
  }

  num? targetKwh;
  num? kwhToCharge;
  num? chargingCost;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['targetKwh'] = targetKwh;
    map['kwhToCharge'] = kwhToCharge;
    map['chargingCost'] = chargingCost;
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
    this.isDefault,
    this.licensePlate,
    this.fuelType,
    this.batteryCapacityKwh,
    this.createdAt,
    this.updatedAt,
    this.images,
    this.vehicleChargeLimit,
    this.currentBatteryStatus,
    this.currentBatteryStatusLabel,
    this.currentBatteryCharge,
    this.ratePerKw,
  });

  Vehicle.fromJson(dynamic json) {
    id = _asInt(json['id']);
    userId = _asInt(json['user_id']);
    vehicleType = json['vehicle_type']?.toString();
    make = json['make']?.toString();
    model = json['model']?.toString();
    year = _asNum(json['year']);
    color = json['color']?.toString();
    nickname = json['nickname']?.toString();
    isDefault = _asBool(json['is_default']);
    licensePlate = json['license_plate']?.toString();
    fuelType = json['fuel_type']?.toString();
    batteryCapacityKwh = _jsonString(json['battery_capacity_kwh']);
    createdAt = json['createdAt']?.toString();
    updatedAt = json['updatedAt']?.toString();
    if (json['images'] != null) {
      images = [];
      json['images'].forEach((v) {
        images?.add(Dynamic.fromJson(v));
      });
    }
    vehicleChargeLimit = _asNum(json['vehicle_charge_limit']);
    currentBatteryStatus = json['current_battery_status']?.toString();
    currentBatteryStatusLabel =
        json['current_battery_status_label']?.toString();
    currentBatteryCharge = _jsonString(json['current_battery_charge']);
    ratePerKw = _jsonString(json['rate_per_kw']);
  }

  int? id;
  int? userId;
  String? vehicleType;
  String? make;
  String? model;
  num? year;
  String? color;
  String? nickname;
  bool? isDefault;
  String? licensePlate;
  String? fuelType;
  String? batteryCapacityKwh;
  String? createdAt;
  String? updatedAt;
  List<dynamic>? images;
  num? vehicleChargeLimit;
  String? currentBatteryStatus;
  String? currentBatteryStatusLabel;
  String? currentBatteryCharge;
  String? ratePerKw;

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
    map['is_default'] = isDefault;
    map['license_plate'] = licensePlate;
    map['fuel_type'] = fuelType;
    map['battery_capacity_kwh'] = batteryCapacityKwh;
    map['createdAt'] = createdAt;
    map['updatedAt'] = updatedAt;
    if (images != null) {
      map['images'] = images?.map((v) => v.toJson()).toList();
    }
    map['vehicle_charge_limit'] = vehicleChargeLimit;
    map['current_battery_status'] = currentBatteryStatus;
    map['current_battery_status_label'] = currentBatteryStatusLabel;
    map['current_battery_charge'] = currentBatteryCharge;
    map['rate_per_kw'] = ratePerKw;
    return map;
  }
}

class ServiceDetails {
  ServiceDetails({
    this.packageId,
    this.package,
    this.customPackageName,
    this.customPrice,
    this.scheduleType,
    this.scheduledAt,
    this.addons,
  });

  ServiceDetails.fromJson(dynamic json) {
    packageId = json['package_id'];
    package = json['package'];
    customPackageName = json['custom_package_name'];
    customPrice = json['custom_price'];
    scheduleType = json['schedule_type'];
    scheduledAt = json['scheduled_at'];
    if (json['addons'] != null) {
      addons = [];
      json['addons'].forEach((v) {
        addons?.add(Dynamic.fromJson(v));
      });
    }
  }

  dynamic packageId;
  dynamic package;
  dynamic customPackageName;
  dynamic customPrice;
  String? scheduleType;
  dynamic scheduledAt;
  List<dynamic>? addons;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['package_id'] = packageId;
    map['package'] = package;
    map['custom_package_name'] = customPackageName;
    map['custom_price'] = customPrice;
    map['schedule_type'] = scheduleType;
    map['scheduled_at'] = scheduledAt;
    if (addons != null) {
      map['addons'] = addons?.map((v) => v.toJson()).toList();
    }
    return map;
  }
}

class Location {
  Location({
    this.address,
    this.latitude,
    this.longitude,
    this.serviceLocation,
    this.evCharging,
  });

  Location.fromJson(dynamic json) {
    address = json['address'];
    latitude = json['latitude'];
    longitude = json['longitude'];
    serviceLocation = json['service_location'] != null
        ? ServiceLocation.fromJson(json['service_location'])
        : null;
    evCharging = json['ev_charging'] != null
        ? EvCharging.fromJson(json['ev_charging'])
        : null;
  }

  String? address;
  String? latitude;
  String? longitude;
  ServiceLocation? serviceLocation;
  EvCharging? evCharging;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['address'] = address;
    map['latitude'] = latitude;
    map['longitude'] = longitude;
    if (serviceLocation != null) {
      map['service_location'] = serviceLocation?.toJson();
    }
    if (evCharging != null) {
      map['ev_charging'] = evCharging?.toJson();
    }
    return map;
  }
}

class EvCharging {
  EvCharging({this.address, this.name, this.latitude, this.longitude});

  EvCharging.fromJson(dynamic json) {
    address = json['address'];
    name = json['name']?.toString();
    latitude = json['latitude'];
    longitude = json['longitude'];
  }

  String? address;
  String? name;
  String? latitude;
  String? longitude;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['address'] = address;
    map['name'] = name;
    map['latitude'] = latitude;
    map['longitude'] = longitude;
    return map;
  }
}

class ServiceLocation {
  ServiceLocation({this.address, this.name, this.latitude, this.longitude});

  ServiceLocation.fromJson(dynamic json) {
    address = json['address'];
    name = json['name']?.toString();
    latitude = json['latitude'];
    longitude = json['longitude'];
  }

  String? address;
  String? name;
  String? latitude;
  String? longitude;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['address'] = address;
    map['name'] = name;
    map['latitude'] = latitude;
    map['longitude'] = longitude;
    return map;
  }
}
