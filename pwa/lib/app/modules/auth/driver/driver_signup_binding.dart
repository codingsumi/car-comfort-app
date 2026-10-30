import 'package:get/get.dart';

import '../../../network/repository/auth_repository.dart';
import '../../../network/repository/driver_signup_repository.dart';
import 'driver_signup_controller.dart';

class DriverSignupBinding extends Bindings {
  @override
  void dependencies() {
    if (!Get.isRegistered<AuthRepository>()) {
      Get.lazyPut<AuthRepository>(() => AuthRepository(), fenix: true);
    }
    Get.lazyPut<DriverSignupRepository>(
      () => DriverSignupRepository(),
      fenix: true,
    );
    Get.lazyPut<DriverSignupController>(
      () => DriverSignupController(Get.find(), Get.find()),
      fenix: true,
    );
  }
}
