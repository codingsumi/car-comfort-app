import 'package:get/get.dart';
import 'vehicles_controller.dart';

class VehiclesBinding extends Bindings {
  @override
  void dependencies() {
    Get.lazyPut<VehiclesController>(() => VehiclesController());
  }
}
