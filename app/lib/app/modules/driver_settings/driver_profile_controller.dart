import 'package:get/get.dart';

import '../../network/repository/auth_repository.dart';
import '../../network/response/profile_response.dart';
import '../driver_dashboard/driver_dashboard_controller.dart';

class DriverProfileController extends GetxController {
  late final AuthRepository _authRepository;

  final Rxn<ProfileData> profileData = Rxn<ProfileData>();
  final RxBool isLoading = true.obs;
  final RxString errorMessage = ''.obs;

  @override
  void onInit() {
    super.onInit();
    if (!Get.isRegistered<AuthRepository>()) {
      Get.lazyPut<AuthRepository>(() => AuthRepository(), fenix: true);
    }
    _authRepository = Get.find<AuthRepository>();
    loadProfile();
  }

  Future<void> loadProfile() async {
    isLoading.value = true;
    errorMessage.value = '';
    final result = await _authRepository.getDriverMe();
    result.when(
      success: (ProfileResponse res) {
        profileData.value = res.data;
        if (Get.isRegistered<DriverDashboardController>()) {
          Get.find<DriverDashboardController>()
              .applyDriverLicenseComplianceFromProfile(res);
        }
        isLoading.value = false;
      },
      error: (err) {
        isLoading.value = false;
        errorMessage.value = err.message;
      },
    );
  }
}
