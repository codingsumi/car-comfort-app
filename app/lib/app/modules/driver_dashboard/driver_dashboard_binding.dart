import 'package:get/get.dart';

import '../dashboard/cancel_reason_controller.dart';
import '../driver_settings/driver_support_binding.dart';
import '../settings/need_help_controller.dart';
import '../../network/repository/support_repository.dart';
import '../../network/response/legal_page_response.dart';
import 'driver_dashboard_controller.dart';
import '../driver_settings/driver_settings_controller.dart';

class DriverDashboardBinding extends Bindings {
  @override
  void dependencies() {
    Get.lazyPut<DriverDashboardController>(
      () => DriverDashboardController(),
    );
    Get.lazyPut<CancelReasonController>(
      () => CancelReasonController(),
    );
    Get.lazyPut<DriverSettingsController>(
      () => DriverSettingsController(),
      fenix: true,
    );
    if (!Get.isRegistered<NeedHelpController>(tag: kDriverSupportNeedHelpTag)) {
      Get.lazyPut<NeedHelpController>(
        () => NeedHelpController(audience: LegalAudience.provider),
        tag: kDriverSupportNeedHelpTag,
        fenix: true,
      );
    }
    if (!Get.isRegistered<SupportRepository>()) {
      Get.lazyPut<SupportRepository>(() => SupportRepository(), fenix: true);
    }
  }
}
