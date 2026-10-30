import 'package:flutter/foundation.dart';
import 'package:flutter_stripe/flutter_stripe.dart';

import 'env_service.dart';

/// Keeps the mobile Stripe SDK on the same publishable key as the backend secret key.
class StripeClientConfig {
  StripeClientConfig._();

  static String? _appliedPublishableKey;

  /// Refreshes publishable key AND payment mode from admin settings, then applies to flutter_stripe.
  /// Always calls the API so mode changes (test ↔ live) take effect without an app restart.
  /// Always forces re-application so the SDK never uses a stale cached key.
  static Future<String> ensurePublishableKeySynced() async {
    try {
      final pk = await EnvService.refreshStripePublishableKeyFromApi();
      if (pk.isNotEmpty) {
        EnvService.stripePublishableKeyResolved = pk;
      }
    } catch (_) {
      // Fall back to value already in EnvService.
    }

    final key = EnvService.effectiveStripePublishableKey.trim();
    if (key.isEmpty || !key.startsWith('pk_')) return '';

    // Always re-apply — never skip even if key looks the same.
    // This guarantees the SDK uses the freshly fetched key, not a cached one.
    Stripe.publishableKey = key;
    _appliedPublishableKey = key;
    final merchantId =
        EnvService.getString('STRIPE_APPLE_MERCHANT_IDENTIFIER').trim();
    if (merchantId.isNotEmpty && !kIsWeb) {
      Stripe.merchantIdentifier = merchantId;
    }
    if (!kIsWeb) {
      await Stripe.instance.applySettings();
    }

    if (kDebugMode) {
      debugPrint('[StripeClientConfig] Applied key: ${key.substring(0, 14)}...${key.substring(key.length - 4)} '
          '| mode: ${EnvService.stripePaymentModeResolved}');
    }

    return key;
  }
}
