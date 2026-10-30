import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import '../constants/api_constants.dart';
import '../network/utils/log_util.dart';

class EnvService {
  static EnvService? _instance;

  static EnvService get instance => _instance ??= EnvService._internal();

  EnvService._internal();

  static String get baseUrl => getString('BASE_URL');

  /// HTTP origin (`scheme://host[:port]`) derived from [BASE_URL].
  /// Use for constructing absolute URLs (e.g. delete-account page) without
  /// hardcoding the environment hostname.
  static String get httpOrigin => socketIoOrigin;

  /// Host origin for Socket.IO (`scheme://host[:port]`). Strips path segments such
  /// as `/api/` from [BASE_URL] so the client connects to the HTTP origin, not
  /// a path under `/api/socket.io`.
  static String get socketIoOrigin {
    final raw = baseUrl.trim();
    if (raw.isEmpty) return '';
    try {
      final uri = Uri.parse(raw);
      if (uri.host.isEmpty) return '';
      final scheme = uri.scheme.isNotEmpty ? uri.scheme : 'https';
      final port = uri.port;
      final omitPort =
          (scheme == 'https' && (port == 443 || port == 0)) ||
          (scheme == 'http' && (port == 80 || port == 0));
      if (omitPort) return '$scheme://${uri.host}';
      return '$scheme://${uri.host}:$port';
    } catch (_) {
      return '';
    }
  }

  /// OneSignal **App ID** from `.env`. Prefer `ONESIGNAL_APP_ID`; falls back to
  /// legacy `ONESIGNAL_API_KEY` when that key holds your App ID string.
  static String get onesignalAppId {
    final dedicated = getString('ONESIGNAL_APP_ID').trim();
    if (dedicated.isNotEmpty && !_looksLikePlaceholder(dedicated)) {
      return dedicated;
    }
    return getString('ONESIGNAL_API_KEY').trim();
  }

  /// Same value as [onesignalAppId] (historic env name).
  static String get onesignalApiKey => onesignalAppId;

  static String get mapboxAccessToken => getString('MAPBOX_ACCESS_TOKEN');

  /// Secret token with `DOWNLOADS:READ` for Android Mapbox Navigation SDK binaries.
  /// Falls back to [mapboxAccessToken] when unset (must include downloads scope).
  static String get mapboxDownloadsToken {
    final dedicated = getString('MAPBOX_DOWNLOADS_TOKEN').trim();
    if (dedicated.isNotEmpty) return dedicated;
    return mapboxAccessToken.trim();
  }
  static String get googlePlacesApiKey => getString('GOOGLE_PLACES_API_KEY');
  static String get mapboxEvAccessToken =>
      getString('MAPBOX_EV_ACCESS_TOKEN', defaultValue: mapboxAccessToken);
  static String get stripePublishableKey => getString('STRIPE_PUBLISHABLE_KEY');

  /// Resolved at startup: admin settings API first, then [stripePublishableKey] from .env.
  static String stripePublishableKeyResolved = '';
  static String stripePaymentModeResolved = 'test';

  static String get effectiveStripePublishableKey {
    final resolved = stripePublishableKeyResolved.trim();
    if (resolved.isNotEmpty) return resolved;
    return stripePublishableKey.trim();
  }

  static String get stripeSecretKey => getString('STRIPE_SECRET_KEY');
  static String get firebaseDatabaseUrl => getString('FIREBASE_DATABASE_URL');

  static Future<void> init() async {
    try {
      await dotenv.load(fileName: '.env');
    } catch (e) {
      throw Exception(
        'Failed to load .env from app assets. Ensure .env exists and is listed in pubspec.yaml assets: $e',
      );
    }

    validateRequired();
    try {
      final pk = await refreshStripePublishableKeyFromApi().timeout(
        const Duration(seconds: 10),
      );
      if (pk.isNotEmpty) stripePublishableKeyResolved = pk;
    } catch (e) {
      Alert.log(
        'ENV_SERVICE',
        'Stripe publishable key API sync timed out or failed; using .env if set: $e',
      );
    }
    printAll();
  }

  /// Loads `pk_` key from GET /api/payments/stripe-config (admin panel settings).
  static Future<String> refreshStripePublishableKeyFromApi() async {
    final base = ApiConstants.baseUrl.trim();
    if (base.isEmpty) return '';
    try {
      final baseUri = Uri.parse(base.endsWith('/') ? base : '$base/');
      final path = baseUri.path.contains('/api')
          ? 'payments/stripe-config'
          : 'api/payments/stripe-config';
      final uri = baseUri.resolve(path);
      final dio = Dio(
        BaseOptions(
          connectTimeout: const Duration(seconds: 12),
          receiveTimeout: const Duration(seconds: 12),
          headers: {'Accept': 'application/json'},
        ),
      );
      final response = await dio.getUri(uri);
      final body = response.data;
      if (body is! Map) return '';
      final data = body['data'];
      if (data is! Map) return '';
      final pk = (data['publishable_key'] as String?)?.trim() ?? '';
      final mode = (data['payment_mode'] as String?)?.trim().toLowerCase() ?? '';
      if (mode == 'live' || mode == 'test') {
        stripePaymentModeResolved = mode;
      }
      if (pk.startsWith('pk_')) {
        Alert.log('ENV_SERVICE', 'Stripe publishable key loaded from API settings');
        return pk;
      }
    } catch (e) {
      Alert.log('ENV_SERVICE', 'Stripe config API unavailable, using .env if set: $e');
    }
    return '';
  }

  static String getString(String key, {String defaultValue = ''}) =>
      dotenv.env[key] ?? defaultValue;

  static bool hasKey(String key) => dotenv.env.containsKey(key);

  static Map<String, String> getAll() => dotenv.env;

  static void validateRequired() {
    final requiredKeys = [
      'BASE_URL',
      'MAPBOX_ACCESS_TOKEN',
      'GOOGLE_PLACES_API_KEY',
    ];

    final missingKeys = <String>[];
    for (final key in requiredKeys) {
      final value = getString(key).trim();
      if (!hasKey(key) || value.isEmpty || _looksLikePlaceholder(value)) {
        missingKeys.add(key);
      }
    }

    if (missingKeys.isNotEmpty) {
      throw Exception(
        'Missing required environment variables: ${missingKeys.join(', ')}',
      );
    }

    final oneSignal = onesignalAppId.trim();
    if (oneSignal.isEmpty || _looksLikePlaceholder(oneSignal)) {
      Alert.log(
        "ENV_SERVICE",
        'ONESIGNAL_APP_ID (or ONESIGNAL_API_KEY with your OneSignal App ID) is not set; OneSignal stays disabled.',
      );
    }

    final stripePk = stripePublishableKey.trim();
    if (stripePk.isEmpty || _looksLikePlaceholder(stripePk)) {
      Alert.log(
        "ENV_SERVICE",
        'STRIPE_PUBLISHABLE_KEY is not set (Stripe card entry will be disabled).',
      );
    }

    if (hasKey('STRIPE_SECRET_KEY') &&
        getString('STRIPE_SECRET_KEY').trim().isNotEmpty) {
      Alert.log(
        "ENV_SERVICE",
        'Warning: STRIPE_SECRET_KEY is present in .env. Do not ship secret keys in mobile apps.',
      );
    }
  }

  static bool _looksLikePlaceholder(String value) {
    final normalized = value.trim().toLowerCase();
    return normalized.startsWith('replace_with_') ||
        normalized.startsWith('your_') ||
        normalized == 'changeme' ||
        normalized == 'todo';
  }

  static void printAll() {
    Alert.log("ENV_SERVICE", '=== Environment Variables ===');
    final allVars = getAll();
    allVars.forEach((key, value) {
      // Mask sensitive values
      if (key.toLowerCase().contains('password') ||
          key.toLowerCase().contains('secret') ||
          key.toLowerCase().contains('key')) {
        Alert.log(
          "ENV_SERVICE",
          '$key: ${value.isNotEmpty ? '***MASKED***' : 'NOT_SET'}',
        );
      } else {
        Alert.log("ENV_SERVICE", '$key: $value');
      }
    });
    Alert.log("ENV_SERVICE", '============================');
  }
}
