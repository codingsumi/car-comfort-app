import 'package:get/get.dart';

import '../../network/repository/payment_repository.dart';
import 'payment_methods_controller.dart';

class PaymentMethodsBinding extends Bindings {
  @override
  void dependencies() {
    if (!Get.isRegistered<PaymentRepository>()) {
      Get.lazyPut<PaymentRepository>(() => PaymentRepository(), fenix: true);
    }
    if (!Get.isRegistered<PaymentMethodsController>()) {
      Get.lazyPut<PaymentMethodsController>(
        () => PaymentMethodsController(Get.find()),
        fenix: true,
      );
    }
  }
}
