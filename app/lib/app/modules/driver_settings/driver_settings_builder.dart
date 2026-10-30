import 'package:get/get.dart';

import 'driver_settings_controller.dart';

class DriverSettingsBuilder extends Bindings {
  @override
  void dependencies() {
    Get.lazyPut<DriverSettingsController>(
      () => DriverSettingsController(),
      fenix: true,
    );
  }
}
