import 'package:get/get.dart';

import '../../network/repository/legal_repository.dart';
import 'driver_privacy_terms_controller.dart';

class DriverPrivacyTermsBinding extends Bindings {
  @override
  void dependencies() {
    if (!Get.isRegistered<LegalRepository>()) {
      Get.lazyPut<LegalRepository>(() => LegalRepository(), fenix: true);
    }
    Get.lazyPut<DriverPrivacyTermsController>(
      () => DriverPrivacyTermsController(),
    );
  }
}
