class MapboxPlaceModel {
  const MapboxPlaceModel({
    required this.name,
    required this.address,
    required this.latitude,
    required this.longitude,
    required this.category,
    this.placeId,
    this.websiteUri,
    this.availableChargers,
    this.maxChargingPowerKw,
    this.ccs1MaxKw,
    this.ccs1ConnectorCount,
  });

  final String name;
  final String address;
  final double latitude;
  final double longitude;
  final String category;
  final String? placeId;
  final String? websiteUri;
  final int? availableChargers;
  final double? maxChargingPowerKw;

  /// Max charge rate in kW from CCS1 connectors only.
  final double? ccs1MaxKw;

  /// Number of CCS1 connectors at this station.
  final int? ccs1ConnectorCount;

  /// True when this station has at least one CCS1 connector at 50 kW+.
  bool get hasCcs1DcFast =>
      ccs1MaxKw != null && ccs1MaxKw! >= 50;

  factory MapboxPlaceModel.fromMapboxFeature(
    Map<String, dynamic> feature, {
    required String fallbackCategory,
  }) {
    final center = (feature['center'] as List?) ?? const [];
    final lon = center.isNotEmpty ? _toDouble(center[0]) : 0.0;
    final lat = center.length > 1 ? _toDouble(center[1]) : 0.0;
    final properties = feature['properties'] as Map<String, dynamic>?;
    final category = ((properties?['category'] ?? '') as String).trim();

    return MapboxPlaceModel(
      name: ((feature['text'] ?? feature['place_name'] ?? '') as String).trim(),
      address: ((feature['place_name'] ?? '') as String).trim(),
      latitude: lat,
      longitude: lon,
      category: category.isNotEmpty ? category : fallbackCategory,
      placeId: null,
      websiteUri: null,
      availableChargers: null,
      maxChargingPowerKw: null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'address': address,
      'latitude': latitude,
      'longitude': longitude,
      'category': category,
      'placeId': placeId,
      'websiteUri': websiteUri,
      'availableChargers': availableChargers,
      'maxChargingPowerKw': maxChargingPowerKw,
      'ccs1MaxKw': ccs1MaxKw,
      'ccs1ConnectorCount': ccs1ConnectorCount,
    };
  }

  static double _toDouble(dynamic value) {
    if (value is num) return value.toDouble();
    return double.tryParse('$value') ?? 0.0;
  }
}
