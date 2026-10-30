import 'package:dio/dio.dart';
import 'package:get/get.dart';

import '../../services/maintenance_service.dart';
import '../repository/endpoint.dart';

/// Redirects to maintenance screen when API returns 503 with maintenance payload.
class MaintenanceInterceptor extends Interceptor {
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (err.response?.statusCode != 503) {
      return super.onError(err, handler);
    }
    if (err.requestOptions.path == API.appStatus) {
      return super.onError(err, handler);
    }

    if (!Get.isRegistered<MaintenanceService>()) {
      return super.onError(err, handler);
    }

    final status = MaintenanceService.to.parseFromErrorResponse(err.response?.data);
    if (status != null && status.enabled) {
      MaintenanceService.to.showMaintenanceScreen(status, replaceAll: true);
    }

    return super.onError(err, handler);
  }
}
