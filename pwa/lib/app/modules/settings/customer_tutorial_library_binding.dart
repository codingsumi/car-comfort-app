import 'package:get/get.dart';

import '../../network/repository/auth_repository.dart';
import 'customer_tutorial_library_controller.dart';

class CustomerTutorialLibraryBinding extends Bindings {
  @override
  void dependencies() {
    Get.lazyPut<AuthRepository>(() => AuthRepository(), fenix: true);
    Get.lazyPut<CustomerTutorialLibraryController>(
      () => CustomerTutorialLibraryController(Get.find()),
    );
  }
}
