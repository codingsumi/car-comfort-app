import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
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

  /// Resolved from the public app config for PWA deployments when no bundled
  /// env asset is present. Mapbox browser tokens are intentionally public.
  static String mapboxAccessTokenResolved = '';

  static String get mapboxAccessToken {
    final resolved = mapboxAccessTokenResolved.trim();
    if (resolved.isNotEmpty) return resolved;
    return getString('MAPBOX_ACCESS_TOKEN');
  }

  /// Browser-restricted Google Places keys are public and are loaded from the
  /// live config when the PWA has no bundled environment asset.
  static String googlePlacesApiKeyResolved = '';

  /// Secret token with `DOWNLOADS:READ` for Android Mapbox Navigation SDK binaries.
  /// Falls back to [mapboxAccessToken] when unset (must include downloads scope).
  static String get mapboxDownloadsToken {
    final dedicated = getString('MAPBOX_DOWNLOADS_TOKEN').trim();
    if (dedicated.isNotEmpty) return dedicated;
    return mapboxAccessToken.trim();
  }

  static String get googlePlacesApiKey {
    final resolved = googlePlacesApiKeyResolved.trim();
    if (resolved.isNotEmpty) return resolved;
    return getString('GOOGLE_PLACES_API_KEY');
  }

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
      try {
        await dotenv.load(fileName: 'assets/env');
      } catch (_) {
        try {
          await dotenv.load(fileName: '.env');
        } catch (e) {
          if (!kIsWeb) rethrow;
          // Web builds use the public fallbacks in ApiConstants when a local
          // env file is not supplied (for example, a fresh Chrome checkout).
          Alert.log('ENV_SERVICE', 'No local env file found for web: $e');
        }
      }
    } catch (e) {
      throw Exception(
        'Failed to load env config from assets/env or .env. Ensure env file exists and is listed in pubspec.yaml assets: $e',
      );
    }

    if (kIsWeb &&
        (mapboxAccessToken.trim().isEmpty ||
            googlePlacesApiKey.trim().isEmpty)) {
      try {
        final config = await refreshPublicMapConfigFromApi().timeout(
          const Duration(seconds: 10),
        );
        if (config['mapboxAccessToken']?.isNotEmpty ?? false) {
          mapboxAccessTokenResolved = config['mapboxAccessToken']!;
        }
        if (config['googlePlacesApiKey']?.isNotEmpty ?? false) {
          googlePlacesApiKeyResolved = config['googlePlacesApiKey']!;
        }
      } catch (e) {
        Alert.log('ENV_SERVICE', 'Public web map config unavailable: $e');
      }
    }

    validateRequired();
    if (!(kIsWeb && !hasKey('BASE_URL'))) {
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
      final mode =
          (data['payment_mode'] as String?)?.trim().toLowerCase() ?? '';
      if (mode == 'live' || mode == 'test') {
        stripePaymentModeResolved = mode;
      }
      if (pk.startsWith('pk_')) {
        Alert.log(
          'ENV_SERVICE',
          'Stripe publishable key loaded from API settings',
        );
        return pk;
      }
    } catch (e) {
      Alert.log(
        'ENV_SERVICE',
        'Stripe config API unavailable, using .env if set: $e',
      );
    }
    return '';
  }

  /// Reads browser-restricted map keys from the live configuration endpoint.
  /// This avoids depending on an ignored `.env` file in deployed PWAs.
  static Future<Map<String, String>> refreshPublicMapConfigFromApi() async {
    final base = ApiConstants.baseUrl.trim();
    if (base.isEmpty) return const {};
    try {
      final baseUri = Uri.parse(base.endsWith('/') ? base : '$base/');
      final path = baseUri.path.contains('/api')
          ? 'app/status'
          : 'api/app/status';
      final response = await Dio(
        BaseOptions(
          connectTimeout: const Duration(seconds: 12),
          receiveTimeout: const Duration(seconds: 12),
          headers: {'Accept': 'application/json'},
        ),
      ).getUri(baseUri.resolve(path));
      final body = response.data;
      if (body is! Map) return const {};
      final data = body['data'];
      if (data is! Map) return const {};
      final config = data['config'];
      if (config is! Map) return const {};

      final mapboxToken = '${config['mapbox_public_token'] ?? ''}'.trim();
      final googlePlacesKey = '${config['google_places_api_key'] ?? ''}'.trim();
      return {
        if (mapboxToken.startsWith('pk.')) 'mapboxAccessToken': mapboxToken,
        if (googlePlacesKey.startsWith('AIza'))
          'googlePlacesApiKey': googlePlacesKey,
      };
    } catch (e) {
      Alert.log('ENV_SERVICE', 'Public map config API unavailable: $e');
      return const {};
    }
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
      final value =
          (key == 'MAPBOX_ACCESS_TOKEN'
                  ? mapboxAccessToken
                  : key == 'GOOGLE_PLACES_API_KEY'
                  ? googlePlacesApiKey
                  : getString(key))
              .trim();
      if (!hasKey(key) || value.isEmpty || _looksLikePlaceholder(value)) {
        missingKeys.add(key);
      }
    }

    if (missingKeys.isNotEmpty && !kIsWeb) {
      throw Exception(
        'Missing required environment variables: ${missingKeys.join(', ')}',
      );
    }
    if (missingKeys.isNotEmpty && kIsWeb) {
      Alert.log(
        'ENV_SERVICE',
        'Missing local web environment variables: ${missingKeys.join(', ')}. Using web fallbacks where available.',
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
