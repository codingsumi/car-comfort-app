import 'package:get/get.dart';

import 'customer_billing_history_controller.dart';

class CustomerBillingHistoryBinding extends Bindings {
  @override
  void dependencies() {
    Get.lazyPut<CustomerBillingHistoryController>(
      () => CustomerBillingHistoryController(),
    );
  }
}
