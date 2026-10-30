import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../../utils/pref.dart';

/// Interceptor that appends authentication and meta headers to every request.
///
/// Doing this at request time (instead of once in [BaseOptions]) guarantees
/// that updated tokens or timezone information are always sent.
class AuthInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    // Platform & build type
    options.headers['platform'] = _platformHeader;
    options.headers['isDebug'] = kDebugMode.toString();

    // Timezone – stored when the app launches
    options.headers['timezone'] = Prefs().getTimeZoneData(Prefs.timezone);

    // Authorisation
    final token = Prefs().token();
    if (token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }

    super.onRequest(options, handler);
  }

  static String get _platformHeader {
    if (kIsWeb) return 'web';
    return defaultTargetPlatform == TargetPlatform.android ? 'android' : 'ios';
  }
}
