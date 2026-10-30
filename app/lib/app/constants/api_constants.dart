
import '../utils/env_service.dart';

class ApiConstants {
  static String get baseUrl => EnvService.baseUrl;
  static String get onesignalAppId => EnvService.onesignalAppId;
  static String get onesignalApiKey => EnvService.onesignalApiKey;
  static String get stripePublishableKey => EnvService.effectiveStripePublishableKey;
  static String get stripeSecretKey => EnvService.stripeSecretKey;
}
