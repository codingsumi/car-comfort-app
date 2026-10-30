import 'package:get/get.dart';

import '../../network/repository/support_repository.dart';
import 'create_support_ticket_controller.dart';
import 'customer_media_report_config.dart';
import 'customer_media_report_controller.dart';
import 'support_ticket_detail_controller.dart';
import 'support_tickets_controller.dart';

class SupportBinding extends Bindings {
  @override
  void dependencies() {
    if (!Get.isRegistered<SupportRepository>()) {
      Get.lazyPut<SupportRepository>(() => SupportRepository(), fenix: true);
    }
  }
}

class SupportTicketsBinding extends Bindings {
  @override
  void dependencies() {
    SupportBinding().dependencies();
    Get.lazyPut<SupportTicketsController>(() => SupportTicketsController());
  }
}

class SupportTicketDetailBinding extends Bindings {
  @override
  void dependencies() {
    SupportBinding().dependencies();
    Get.lazyPut<SupportTicketDetailController>(
      () => SupportTicketDetailController(),
    );
  }
}

class CreateSupportTicketBinding extends Bindings {
  @override
  void dependencies() {
    SupportBinding().dependencies();
    Get.lazyPut<CreateSupportTicketController>(
      () => CreateSupportTicketController(),
    );
  }
}

class ReportAccidentDamageBinding extends Bindings {
  @override
  void dependencies() {
    SupportBinding().dependencies();
    Get.lazyPut<CustomerMediaReportController>(
      () => CustomerMediaReportController(
        config: CustomerMediaReportConfig.accidentDamage,
      ),
    );
  }
}

class ReportMissingItemBinding extends Bindings {
  @override
  void dependencies() {
    SupportBinding().dependencies();
    Get.lazyPut<CustomerMediaReportController>(
      () => CustomerMediaReportController(
        config: CustomerMediaReportConfig.missingItem,
      ),
    );
  }
}
