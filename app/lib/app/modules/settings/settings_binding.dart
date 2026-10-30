import 'package:get/get.dart';

import '../../network/repository/auth_repository.dart';
import 'need_help_controller.dart';
import '../../network/repository/support_repository.dart';
import 'settings_controller.dart';

class SettingsBinding extends Bindings {
  @override
  void dependencies() {
    if (!Get.isRegistered<AuthRepository>()) {
      Get.lazyPut<AuthRepository>(() => AuthRepository(), fenix: true);
    }
    Get.lazyPut<SettingsController>(
      () => SettingsController(Get.find()),
      fenix: true,
    );
    Get.lazyPut<NeedHelpController>(() => NeedHelpController(), fenix: true);
    if (!Get.isRegistered<SupportRepository>()) {
      Get.lazyPut<SupportRepository>(() => SupportRepository(), fenix: true);
    }
  }
}
