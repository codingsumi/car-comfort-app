import 'package:get/get.dart';

import 'maintenance_controller.dart';

class MaintenanceBinding extends Bindings {
  @override
  void dependencies() {
    Get.lazyPut(MaintenanceController.new);
  }
}
