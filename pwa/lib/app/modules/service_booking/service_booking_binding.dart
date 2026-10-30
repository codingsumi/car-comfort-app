import 'package:get/get.dart';

import 'service_booking_controller.dart';

class ServiceBookingBinding extends Bindings {
  @override
  void dependencies() {
    Get.lazyPut<ServiceBookingController>(ServiceBookingController.new);
  }
}
