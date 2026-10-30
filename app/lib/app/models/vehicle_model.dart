class VehicleModel {
  int? id;
  String? vehicleType;
  String? make;
  String? model;
  String? year;
  String? color;
  String? nickname;
  String? licensePlate;
  String? fuelType;
  String? batteryCapacityKwh;
  String? createdAt;
  String? updatedAt;
  List<Images>? images;
  bool isDefault;

  VehicleModel({
    this.id,
    this.vehicleType,
    this.make,
    this.model,
    this.year,
    this.color,
    this.nickname,
    this.licensePlate,
    this.fuelType,
    this.batteryCapacityKwh,
    this.createdAt,
    this.updatedAt,
    this.images,
    this.isDefault = false,
  });

  VehicleModel.fromJson(Map<String, dynamic> json)
      : isDefault = json['is_default'] == true ||
            json['is_default'] == 1 ||
            json['default'] == true {
    id = json['id'];
    vehicleType = json['vehicle_type'];
    make = json['make'];
    model = json['model'];
    year = json['year']?.toString();
    color = json['color'];
    nickname = json['nickname'];
    licensePlate = json['license_plate'];
    fuelType = (json['fuel_type'] ?? json['fuelType'])?.toString();
    batteryCapacityKwh =
        (json['battery_capacity_kwh'] ?? json['batteryCapacityKwh'])
            ?.toString();
    createdAt = json['createdAt'];
    updatedAt = json['updatedAt'];
    if (json['images'] != null) {
      images = [];
      json['images'].forEach((v) {
        images?.add(Images.fromJson(v));
      });
    }
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = <String, dynamic>{};
    data['id'] = id;
    data['vehicle_type'] = vehicleType;
    data['make'] = make;
    data['model'] = model;
    data['year'] = year;
    data['color'] = color;
    data['nickname'] = nickname;
    data['license_plate'] = licensePlate;
    data['fuel_type'] = fuelType;
    data['battery_capacity_kwh'] = batteryCapacityKwh;
    data['createdAt'] = createdAt;
    data['updatedAt'] = updatedAt;
    data['is_default'] = isDefault;
    if (images != null) {
      data['images'] = images?.map((v) => v.toJson()).toList();
    }
    return data;
  }

  VehicleModel copyWith({
    int? id,
    String? vehicleType,
    String? make,
    String? model,
    String? year,
    String? color,
    String? nickname,
    String? licensePlate,
    String? fuelType,
    String? batteryCapacityKwh,
    String? createdAt,
    String? updatedAt,
    List<Images>? images,
    bool? isDefault,
  }) {
    return VehicleModel(
      id: id ?? this.id,
      vehicleType: vehicleType ?? this.vehicleType,
      make: make ?? this.make,
      model: model ?? this.model,
      year: year ?? this.year,
      color: color ?? this.color,
      nickname: nickname ?? this.nickname,
      licensePlate: licensePlate ?? this.licensePlate,
      fuelType: fuelType ?? this.fuelType,
      batteryCapacityKwh: batteryCapacityKwh ?? this.batteryCapacityKwh,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      images: images ?? this.images,
      isDefault: isDefault ?? this.isDefault,
    );
  }
}

class Images {
  Images({
    this.id,
    this.imagePath,
    this.url,});

  Images.fromJson(dynamic json) {
    id = json['id'];
    imagePath = json['image_path'];
    url = json['url'];
  }
  int? id;
  String? imagePath;
  String? url;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['id'] = id;
    map['image_path'] = imagePath;
    map['url'] = url;
    return map;
  }

}