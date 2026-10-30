import 'package:get/get.dart';

import '../settings/need_help_controller.dart';
import '../../network/repository/support_repository.dart';
import '../../network/response/legal_page_response.dart';

/// Tag for [NeedHelpController] used on driver support (tab + route) so it
/// does not clash with the customer [NeedHelpView] instance.
const String kDriverSupportNeedHelpTag = 'driver_support';

class DriverSupportBinding extends Bindings {
  @override
  void dependencies() {
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
