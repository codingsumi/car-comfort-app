import 'package:get/get.dart';

import '../models/app_config.dart';
import '../network/repository/app_repository.dart';
import '../network/utils/network_result.dart';

/// Fetches and caches public app configuration from the backend.
/// Register once at startup via [Get.put]; access anywhere with [AppConfigService.to].
class AppConfigService extends GetxService {
  static AppConfigService get to => Get.find<AppConfigService>();

  final AppRepository _repo = AppRepository();

  /// Current config. Defaults to [AppConfig()] until the first successful fetch.
  final Rx<AppConfig> _config = const AppConfig().obs;

  AppConfig get config => _config.value;

  /// Reactive referral discount percent (e.g. 10 for 10%).
  int get referralDiscountPercent => _config.value.referralDiscountPercent;

  /// Reactive human-readable label (e.g. "10%").
  String get referralDiscountLabel => _config.value.discountLabel;

  /// Fetch config from the API. Silently falls back to defaults on failure.
  Future<void> fetchConfig() async {
    final result = await _repo.fetchAppConfig();
    if (result case NetworkSuccess<AppConfig>(:final data)) {
      _config.value = data;
    }
    // On error: keep existing defaults — do not crash.
  }
}
