import 'package:get/get.dart';

import '../network/response/vehicle_catalog_response.dart';

/// Vehicle make/model catalog for customer add-vehicle flows.
class VehicleCatalog {
  VehicleCatalog._();

  static const String other = 'Other';

  static final List<VehicleCatalogMake> defaultMakes = [
    VehicleCatalogMake(value: 'acura', label: 'Acura', models: ['ILX', 'Integra', 'MDX', 'RDX', 'TLX']),
    VehicleCatalogMake(value: 'audi', label: 'Audi', models: ['A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q3', 'Q5', 'Q7', 'Q8', 'e-tron']),
    VehicleCatalogMake(value: 'bmw', label: 'BMW', models: ['2 Series', '3 Series', '4 Series', '5 Series', '7 Series', 'X1', 'X3', 'X5', 'X7', 'i4', 'iX']),
    VehicleCatalogMake(value: 'buick', label: 'Buick', models: ['Enclave', 'Encore', 'Envision', 'LaCrosse', 'Regal']),
    VehicleCatalogMake(value: 'cadillac', label: 'Cadillac', models: ['CT4', 'CT5', 'Escalade', 'XT4', 'XT5', 'XT6', 'Lyriq']),
    VehicleCatalogMake(value: 'chevrolet', label: 'Chevrolet', models: ['Blazer', 'Bolt EV', 'Camaro', 'Colorado', 'Corvette', 'Equinox', 'Malibu', 'Silverado', 'Suburban', 'Tahoe', 'Traverse']),
    VehicleCatalogMake(value: 'chrysler', label: 'Chrysler', models: ['300', 'Pacifica', 'Voyager']),
    VehicleCatalogMake(value: 'dodge', label: 'Dodge', models: ['Challenger', 'Charger', 'Durango', 'Hornet']),
    VehicleCatalogMake(value: 'ford', label: 'Ford', models: ['Bronco', 'Edge', 'Escape', 'Expedition', 'Explorer', 'F-150', 'Fusion', 'Maverick', 'Mustang', 'Ranger']),
    VehicleCatalogMake(value: 'genesis', label: 'Genesis', models: ['G70', 'G80', 'G90', 'GV60', 'GV70', 'GV80']),
    VehicleCatalogMake(value: 'gmc', label: 'GMC', models: ['Acadia', 'Canyon', 'Sierra', 'Terrain', 'Yukon', 'Hummer EV']),
    VehicleCatalogMake(value: 'honda', label: 'Honda', models: ['Accord', 'Civic', 'CR-V', 'HR-V', 'Odyssey', 'Passport', 'Pilot', 'Ridgeline']),
    VehicleCatalogMake(value: 'hyundai', label: 'Hyundai', models: ['Elantra', 'Ioniq 5', 'Ioniq 6', 'Kona', 'Palisade', 'Santa Fe', 'Sonata', 'Tucson']),
    VehicleCatalogMake(value: 'infiniti', label: 'Infiniti', models: ['Q50', 'Q60', 'QX50', 'QX55', 'QX60', 'QX80']),
    VehicleCatalogMake(value: 'jeep', label: 'Jeep', models: ['Cherokee', 'Compass', 'Gladiator', 'Grand Cherokee', 'Renegade', 'Wrangler', 'Wagoneer']),
    VehicleCatalogMake(value: 'kia', label: 'Kia', models: ['EV6', 'EV9', 'Forte', 'K5', 'Niro', 'Seltos', 'Sorento', 'Soul', 'Sportage', 'Telluride']),
    VehicleCatalogMake(value: 'lexus', label: 'Lexus', models: ['ES', 'GX', 'IS', 'LC', 'LS', 'LX', 'NX', 'RC', 'RX', 'RZ', 'TX', 'UX']),
    VehicleCatalogMake(value: 'lincoln', label: 'Lincoln', models: ['Aviator', 'Corsair', 'Nautilus', 'Navigator']),
    VehicleCatalogMake(value: 'mazda', label: 'Mazda', models: ['CX-30', 'CX-5', 'CX-50', 'CX-70', 'CX-90', 'Mazda3', 'MX-5 Miata']),
    VehicleCatalogMake(value: 'mercedes_benz', label: 'Mercedes-Benz', models: ['A-Class', 'C-Class', 'E-Class', 'S-Class', 'GLA', 'GLB', 'GLC', 'GLE', 'GLS', 'EQB', 'EQE', 'EQS']),
    VehicleCatalogMake(value: 'mini', label: 'MINI', models: ['Cooper', 'Countryman']),
    VehicleCatalogMake(value: 'mitsubishi', label: 'Mitsubishi', models: ['Eclipse Cross', 'Mirage', 'Outlander', 'Outlander Sport']),
    VehicleCatalogMake(value: 'nissan', label: 'Nissan', models: ['Altima', 'Armada', 'Frontier', 'Kicks', 'Leaf', 'Maxima', 'Murano', 'Pathfinder', 'Rogue', 'Sentra', 'Titan', 'Versa', 'Z']),
    VehicleCatalogMake(value: 'porsche', label: 'Porsche', models: ['718', '911', 'Cayenne', 'Macan', 'Panamera', 'Taycan']),
    VehicleCatalogMake(value: 'ram', label: 'Ram', models: ['1500', '2500', '3500', 'ProMaster']),
    VehicleCatalogMake(value: 'rivian', label: 'Rivian', models: ['R1S', 'R1T']),
    VehicleCatalogMake(value: 'subaru', label: 'Subaru', models: ['Ascent', 'BRZ', 'Crosstrek', 'Forester', 'Impreza', 'Legacy', 'Outback', 'Solterra', 'WRX']),
    VehicleCatalogMake(value: 'tesla', label: 'Tesla', models: ['Model 3', 'Model Y', 'Model S', 'Model X', 'Cybertruck']),
    VehicleCatalogMake(value: 'toyota', label: 'Toyota', models: ['4Runner', 'Camry', 'Corolla', 'Crown', 'GR86', 'Highlander', 'Prius', 'RAV4', 'Sequoia', 'Sienna', 'Tacoma', 'Tundra', 'Venza', 'bZ4X']),
    VehicleCatalogMake(value: 'volkswagen', label: 'Volkswagen', models: ['Atlas', 'Golf', 'ID.4', 'Jetta', 'Passat', 'Taos', 'Tiguan']),
    VehicleCatalogMake(value: 'volvo', label: 'Volvo', models: ['C40', 'EX30', 'EX90', 'S60', 'S90', 'V60', 'V90', 'XC40', 'XC60', 'XC90']),
  ];

  static bool isOther(String? value) =>
      value != null && value.trim().toLowerCase() == other.toLowerCase();

  static List<String> makeLabels(List<VehicleCatalogMake> makes) =>
      makes.map((m) => m.label ?? '').where((l) => l.trim().isNotEmpty).toList();

  static List<String> modelLabelsForMake(
    List<VehicleCatalogMake> makes,
    String? selectedMakeLabel,
  ) {
    final makeLabel = (selectedMakeLabel ?? '').trim();
    if (makeLabel.isEmpty || isOther(makeLabel)) return const [];

    final entry = makes.firstWhereOrNull(
      (m) => (m.label ?? '').trim().toLowerCase() == makeLabel.toLowerCase(),
    );
    final models = entry?.models ?? const <String>[];
    return models.where((m) => m.trim().isNotEmpty).toList();
  }

  static String? resolveValue({
    required String? selected,
    required String? otherText,
  }) {
    final picked = (selected ?? '').trim();
    if (picked.isEmpty) return null;
    if (isOther(picked)) {
      final custom = (otherText ?? '').trim();
      return custom.isEmpty ? null : custom;
    }
    return picked;
  }

  static void applyStoredMakeModel({
    required List<VehicleCatalogMake> makes,
    required String? storedMake,
    required String? storedModel,
    required void Function(String? make) setMake,
    required void Function(String? model) setModel,
    required void Function(String makeOther) setMakeOther,
    required void Function(String modelOther) setModelOther,
    required void Function() clearMakeOther,
    required void Function() clearModelOther,
  }) {
    final mk = (storedMake ?? '').trim();
    final md = (storedModel ?? '').trim();

    clearMakeOther();
    clearModelOther();

    if (mk.isEmpty) {
      setMake(null);
      setModel(null);
      return;
    }

    final makeEntry = makes.firstWhereOrNull(
      (m) => (m.label ?? '').trim().toLowerCase() == mk.toLowerCase(),
    );

    if (makeEntry == null) {
      setMake(other);
      setMakeOther(mk);
      setModel(other);
      if (md.isNotEmpty) setModelOther(md);
      return;
    }

    setMake(makeEntry.label);
    if (md.isEmpty) {
      setModel(null);
      return;
    }

    final modelMatch = (makeEntry.models ?? const <String>[]).firstWhereOrNull(
      (m) => m.trim().toLowerCase() == md.toLowerCase(),
    );

    if (modelMatch != null) {
      setModel(modelMatch);
    } else {
      setModel(other);
      setModelOther(md);
    }
  }

  static List<VehicleCatalogMake> makesFromResponse(VehicleCatalogResponse? response) {
    final fromApi = response?.makes;
    if (fromApi != null && fromApi.isNotEmpty) return fromApi;
    return defaultMakes;
  }
}
