import 'package:get/get.dart';

import 'driver_payment_history_controller.dart';

class DriverPaymentHistoryBinding extends Bindings {
  @override
  void dependencies() {
    Get.lazyPut<DriverPaymentHistoryController>(
      () => DriverPaymentHistoryController(),
    );
  }
}
