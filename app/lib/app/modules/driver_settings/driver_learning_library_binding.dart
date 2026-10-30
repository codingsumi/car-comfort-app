import 'package:get/get.dart';

import '../../network/repository/auth_repository.dart';
import 'driver_learning_library_controller.dart';

class DriverLearningLibraryBinding extends Bindings {
  @override
  void dependencies() {
    Get.lazyPut<AuthRepository>(() => AuthRepository(), fenix: true);
    Get.lazyPut<DriverLearningLibraryController>(
      () => DriverLearningLibraryController(Get.find()),
    );
  }
}
