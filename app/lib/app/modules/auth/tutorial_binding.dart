import 'package:car_comfort/app/network/repository/auth_repository.dart';
import 'package:get/get.dart';

import 'tutorial_controller.dart';

class TutorialBinding extends Bindings {
  @override
  void dependencies() {
    if (!Get.isRegistered<AuthRepository>()) {
      Get.lazyPut<AuthRepository>(() => AuthRepository(), fenix: true);
    }
    Get.lazyPut<TutorialController>(
      () => TutorialController(Get.find<AuthRepository>()),
    );
  }
}
