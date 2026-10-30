class PackagesResponse {
  PackagesResponse({
      this.status, 
      this.message, 
      this.data,});

  PackagesResponse.fromJson(dynamic json) {
    status = json['status'];
    message = json['message'];
    if (json['data'] != null) {
      data = [];
      json['data'].forEach((v) {
        data?.add(Data.fromJson(v));
      });
    }
  }
  String? status;
  String? message;
  List<Data>? data;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['status'] = status;
    map['message'] = message;
    if (data != null) {
      map['data'] = data?.map((v) => v.toJson()).toList();
    }
    return map;
  }

}

class Data {
  Data({
      this.id, 
      this.serviceId, 
      this.name, 
      this.description, 
      this.basePrice, 
      this.durationMinutes, 
      this.isActive, 
      this.createdAt, 
      this.updatedAt, 
      this.service,});

  Data.fromJson(dynamic json) {
    id = json['id'];
    serviceId = json['service_id'];
    name = json['name'];
    description = json['description'];
    basePrice = json['base_price'];
    durationMinutes = json['duration_minutes'];
    isActive = json['is_active'];
    createdAt = json['createdAt'];
    updatedAt = json['updatedAt'];
    service = json['service'] != null ? Service.fromJson(json['service']) : null;
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
  Service({
      this.id, 
      this.name,});

  Service.fromJson(dynamic json) {
    id = json['id'];
    name = json['name'];
  }
  int? id;
  String? name;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['id'] = id;
    map['name'] = name;
    return map;
  }

}