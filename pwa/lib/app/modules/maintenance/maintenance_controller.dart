import 'package:get/get.dart';

import '../../models/maintenance_status.dart';
import '../../routes/app_pages.dart';
import '../../services/maintenance_service.dart';

class MaintenanceController extends GetxController {
  final RxBool isChecking = false.obs;

  late MaintenanceStatus status;

  @override
  void onInit() {
    super.onInit();
    final args = Get.arguments;
    if (args is MaintenanceStatus) {
      status = args;
    } else {
      status = const MaintenanceStatus(
        enabled: true,
        message:
            'We are currently performing scheduled maintenance. Please check back soon.',
      );
    }
  }

  Future<void> retry() async {
    if (isChecking.value) return;
    isChecking.value = true;

    try {
      final latest = await MaintenanceService.to.fetchStatus();
      if (latest == null) {
        Get.offAllNamed(Routes.SPLASH);
        return;
      }
      status = latest;
      update();
    } finally {
      isChecking.value = false;
    }
  }
}
