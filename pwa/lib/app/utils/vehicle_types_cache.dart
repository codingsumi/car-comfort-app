import 'dart:convert';

import '../network/repository/vehicle_repository.dart';
import '../network/response/vehicle_type_response.dart';
import 'pref.dart';

/// Persists and refreshes vehicle type options so add-vehicle dropdowns stay populated offline.
class VehicleTypesCache {
  static const _syncIntervalMs = 7200000; // 2 hours

  static List<VehicleList> read() {
    final jsonStr = Prefs().getVehicleTypesList();
    if (jsonStr.trim().isEmpty) return [];

    try {
      final decoded = jsonDecode(jsonStr);
      if (decoded is! List) return [];
      return decoded
          .map((e) => VehicleList.fromJson(e))
          .where((e) => (e.name ?? '').trim().isNotEmpty)
          .toList();
    } catch (_) {
      return [];
    }
  }

  static void save(List<VehicleList> types) {
    if (types.isEmpty) return;
    Prefs().putVehicleTypesList(
      jsonEncode(types.map((e) => e.toJson()).toList()),
    );
    Prefs().putLastVehicleTypesSync(DateTime.now().millisecondsSinceEpoch);
  }

  static List<String> namesFrom(List<VehicleList> types) {
    return types
        .map((e) => e.name ?? '')
        .where((name) => name.trim().isNotEmpty)
        .toList();
  }

  static List<VehicleList> fallbackFromNames(List<String> names) {
    return names.map((name) => VehicleList(name: name)).toList();
  }

  /// Refreshes cache from API when stale or empty. Never throws.
  static Future<void> syncFromApi({bool force = false}) async {
    final now = DateTime.now().millisecondsSinceEpoch;
    final hasCache = Prefs().getVehicleTypesList().trim().isNotEmpty;
    if (!force &&
        hasCache &&
        now - Prefs().getLastVehicleTypesSync() < _syncIntervalMs) {
      return;
    }

    try {
      final res = await VehicleRepository().getVehicleType();
      res.when(
        success: (data) {
          final list = data.data;
          if (list != null && list.isNotEmpty) {
            save(list);
          }
        },
        error: (_) {},
      );
    } catch (_) {}
  }
}
