import 'package:get/get.dart';

import '../../network/repository/auth_repository.dart';
import '../../network/repository/support_repository.dart';
import 'cancel_reason_controller.dart';
import 'dashboard_controller.dart';
import '../settings/need_help_controller.dart';
import '../../network/repository/support_repository.dart';
import '../settings/settings_controller.dart';

class DashboardBinding extends Bindings {
  @override
  void dependencies() {
    Get.lazyPut<CancelReasonController>(
      () => CancelReasonController(),
    );
    Get.lazyPut<DashboardController>(
      () => DashboardController(),
    );
    if (!Get.isRegistered<AuthRepository>()) {
      Get.lazyPut<AuthRepository>(() => AuthRepository(), fenix: true);
    }
    if (!Get.isRegistered<SettingsController>()) {
      Get.lazyPut<SettingsController>(
        () => SettingsController(Get.find<AuthRepository>()),
        fenix: true,
      );
    }
    Get.lazyPut<NeedHelpController>(() => NeedHelpController(), fenix: true);
    if (!Get.isRegistered<SupportRepository>()) {
      Get.lazyPut<SupportRepository>(() => SupportRepository(), fenix: true);
    }
  }
}
