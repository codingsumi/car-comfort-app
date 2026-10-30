import '../../models/app_config.dart';
import '../../models/maintenance_status.dart';
import '../utils/network_result.dart';
import 'base_repository.dart';
import 'endpoint.dart';

class AppRepository extends BaseRepository {
  Future<NetworkResult<MaintenanceStatus>> fetchMaintenanceStatus() async {
    return get<MaintenanceStatus>(
      API.appStatus,
      fromJson: (json) {
        if (json is! Map) return const MaintenanceStatus(enabled: false);
        final data = json['data'];
        if (data is! Map) return const MaintenanceStatus(enabled: false);
        final maintenance = data['maintenance'];
        if (maintenance is Map) {
          return MaintenanceStatus.fromJson(maintenance);
        }
        return const MaintenanceStatus(enabled: false);
      },
    );
  }

  /// Fetches public app config (e.g. referral discount percent) from
  /// [API.appStatus]. Returns [AppConfig] with defaults on any error.
  Future<NetworkResult<AppConfig>> fetchAppConfig() async {
    return get<AppConfig>(
      API.appStatus,
      fromJson: (json) {
        if (json is! Map) return const AppConfig();
        final data = json['data'];
        if (data is! Map) return const AppConfig();
        final configMap = data['config'];
        return AppConfig.fromJson(configMap);
      },
    );
  }
}
