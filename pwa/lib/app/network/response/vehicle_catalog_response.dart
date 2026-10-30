class VehicleCatalogResponse {
  VehicleCatalogResponse({
    this.otherOption,
    this.makes,
    this.colors,
  });

  factory VehicleCatalogResponse.fromJson(dynamic json) {
    if (json is! Map) {
      return VehicleCatalogResponse();
    }
    final makesRaw = json['makes'];
    return VehicleCatalogResponse(
      otherOption: json['other_option']?.toString(),
      makes: makesRaw is List
          ? makesRaw
              .map((e) => VehicleCatalogMake.fromJson(e))
              .where((e) => (e.label ?? '').trim().isNotEmpty)
              .toList()
          : null,
      colors: json['colors'] is List
          ? (json['colors'] as List).map((e) => e.toString()).toList()
          : null,
    );
  }

  String? otherOption;
  List<VehicleCatalogMake>? makes;
  List<String>? colors;
}

class VehicleCatalogMake {
  VehicleCatalogMake({this.value, this.label, this.models});

  factory VehicleCatalogMake.fromJson(dynamic json) {
    if (json is! Map) return VehicleCatalogMake();
    final modelsRaw = json['models'];
    return VehicleCatalogMake(
      value: json['value']?.toString(),
      label: json['label']?.toString(),
      models: modelsRaw is List
          ? modelsRaw.map((e) => e.toString()).where((e) => e.trim().isNotEmpty).toList()
          : null,
    );
  }

  String? value;
  String? label;
  List<String>? models;

  Map<String, dynamic> toJson() => {
        'value': value,
        'label': label,
        'models': models,
      };
}
