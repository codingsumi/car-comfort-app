import 'package:get/get.dart';

import 'customer_invoice_detail_controller.dart';

class CustomerInvoiceDetailBinding extends Bindings {
  @override
  void dependencies() {
    Get.lazyPut<CustomerInvoiceDetailController>(
      () => CustomerInvoiceDetailController(),
    );
  }
}
