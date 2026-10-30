import 'package:flutter/foundation.dart';

import '../utils/env_service.dart';

class ApiConstants {
  static String get baseUrl {
    final value = EnvService.baseUrl.trim();
    if (kIsWeb && value.isEmpty) {
      return 'https://node.carcomfort.betaplanets.com/';
    }
    return value;
  }

  static String get onesignalAppId {
    final value = EnvService.onesignalAppId.trim();
    if (kIsWeb && value.isEmpty) {
      return 'd62e9559-40ae-4355-9276-c53f9bd99667';
    }
    return value;
  }

  static String get onesignalApiKey => onesignalAppId;

  static String get stripePublishableKey {
    final value = EnvService.effectiveStripePublishableKey.trim();
    if (kIsWeb && value.isEmpty) {
      return 'pk_test_51QOYnPLxguvr6pIcWmZwlEqIyt6m1Rl8zW1tW2KGxtBNYsToOeyx4aMlqfMszqgNYGJUHmxjLdxayfEggCYPXTCI00j0A0RZEF';
    }
    return value;
  }

  static String get stripeSecretKey {
    final value = EnvService.stripeSecretKey.trim();
    if (kIsWeb && value.isEmpty) {
      return '';
    }
    return value;
  }
}
