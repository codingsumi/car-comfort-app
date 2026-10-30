import 'package:get/get.dart';

import '../models/maintenance_status.dart';
import '../network/repository/app_repository.dart';
import '../network/utils/network_result.dart';
import '../routes/app_pages.dart';

/// Fetches maintenance mode from the API and routes users to the maintenance screen.
class MaintenanceService extends GetxService {
  static MaintenanceService get to => Get.find<MaintenanceService>();

  final AppRepository _repo = AppRepository();
  bool _navigatingToMaintenance = false;

  /// Returns maintenance info when enabled; null when app is operational or check failed.
  Future<MaintenanceStatus?> fetchStatus() async {
    final res = await _repo.fetchMaintenanceStatus();
    return switch (res) {
      NetworkSuccess<MaintenanceStatus>(:final data) =>
        data.enabled ? data : null,
      NetworkError<MaintenanceStatus>() => null,
    };
  }

  Future<bool> isMaintenanceEnabled() async {
    final status = await fetchStatus();
    return status != null;
  }

  void showMaintenanceScreen(MaintenanceStatus status, {bool replaceAll = true}) {
    if (_navigatingToMaintenance) return;
    if (Get.currentRoute == Routes.MAINTENANCE) return;

    _navigatingToMaintenance = true;
    final navigate = replaceAll ? Get.offAllNamed<void> : Get.toNamed<void>;
    navigate(
      Routes.MAINTENANCE,
      arguments: status,
    )?.whenComplete(() {
      _navigatingToMaintenance = false;
    });
  }

  /// Call after splash / on 503 from protected APIs.
  Future<bool> checkAndBlockIfMaintenance({bool replaceAll = true}) async {
    final status = await fetchStatus();
    if (status == null) return false;
    showMaintenanceScreen(status, replaceAll: replaceAll);
    return true;
  }

  MaintenanceStatus? parseFromErrorResponse(dynamic responseData) {
    if (responseData is! Map) return null;
    final details = responseData['data'];
    if (details is! Map) return null;
    if (details['maintenance'] != true && details['maintenance'] != 'true') {
      return null;
    }
    return MaintenanceStatus(
      enabled: true,
      message: responseData['message']?.toString(),
      expectedReturn: details['expected_return']?.toString(),
    );
  }
}
