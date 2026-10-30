import 'package:get/get.dart';

import 'driver_profile_controller.dart';

class DriverProfileBinding extends Bindings {
  @override
  void dependencies() {
    Get.lazyPut<DriverProfileController>(() => DriverProfileController());
  }
}
