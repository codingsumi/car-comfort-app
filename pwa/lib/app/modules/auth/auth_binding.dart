import 'package:car_comfort/app/network/repository/auth_repository.dart';
import 'package:get/get.dart';

import 'auth_controller.dart';

class AuthBinding extends Bindings {
  @override
  void dependencies() {
    Get.lazyPut<AuthRepository>(() => AuthRepository(), fenix: true);
    Get.lazyPut<AuthController>(() => AuthController(Get.find()), fenix: true);
  }
}
