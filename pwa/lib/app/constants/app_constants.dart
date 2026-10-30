import '../utils/env_service.dart';

class AppConstants {
  static const String appName = 'Car Comfort';
  static const String appVersion = '1.0.0';
  static const String appDescription = 'Car Comfort — premium car care services';
  static const String appSupportEmail = 'info@carcomfort-llc.com';
  static const String appPrivacyPolicyUrl = 'https://carcomfort-llc.com/privacy-policy/';
  static const String appTermsOfServiceUrl = 'https://carcomfort-llc.com/terms-and-conditions/';
  static const String appHelpCenterUrl = 'https://carcomfort-llc.com/contact/';
  /// Delete account URL is derived from the configured BASE_URL so it works
  /// across staging and production environments without code changes.
  /// Falls back to the legacy betaplanets.com endpoint if BASE_URL is not set.
  static String get appDeleteAccountUrl {
    try {
      final base = EnvService.httpOrigin.trim();
      if (base.isNotEmpty) return '$base/delete-account-request';
    } catch (_) {}
    // Fallback — should not be reached in a correctly configured build
    return 'https://node.carcomfort.betaplanets.com/delete-account-request';
  }

  // Cache keys
  static const String cacheKeyUser = 'user';
  static const String cacheKeyToken = 'token';
  static const String cacheKeyOnboarding = 'onboarding';
  static const String cacheKeySettings = 'settings';

  // Timeouts
  static const int connectionTimeout = 30000; // 30 seconds
  static const int receiveTimeout = 30000; // 30 seconds

  // Pagination
  static const int defaultPageSize = 20;
  static const int maxPageSize = 100;

  // File upload
  static const int maxFileSize = 15 * 1024 * 1024; // 15MB
  static const List<String> allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif'];
  static const List<String> allowedDocumentTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
}
