import '../network/repository/vehicle_repository.dart';
import '../network/response/vehicle_catalog_response.dart';
import 'vehicle_catalog.dart';
import 'vehicle_colors.dart';

/// Loads vehicle make/model catalog from API with local fallback.
class VehicleCatalogCache {
  static List<VehicleCatalogMake> _cachedMakes = VehicleCatalog.defaultMakes;
  static List<String>? _cachedColors;

  static List<VehicleCatalogMake> get makes => _cachedMakes;

  static List<String> get colorPresetsFromApi {
    final colors = _cachedColors;
    if (colors != null && colors.isNotEmpty) {
      return colors.where((c) => c.trim().isNotEmpty).toList();
    }
    return VehicleColors.pickerOptions;
  }

  /// Never throws.
  static Future<void> syncFromApi({bool force = false}) async {
    try {
      final res = await VehicleRepository().getVehicleCatalog();
      res.when(
        success: (data) {
          final makes = VehicleCatalog.makesFromResponse(data);
          if (makes.isNotEmpty) {
            _cachedMakes = makes;
          }
          final colors = data.colors;
          if (colors != null && colors.isNotEmpty) {
            _cachedColors = colors;
          }
        },
        error: (_) {},
      );
    } catch (_) {}
  }
}
