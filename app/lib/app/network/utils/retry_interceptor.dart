import 'dart:async';
import 'dart:math';

import 'package:dio/dio.dart';

/// A very small, dependency-free retry interceptor.
///
/// • Retries only on network-related [DioException]s (timeout, connection).
/// • Uses exponential back-off with jitter.
/// • Defaults to three attempts (original + 2 retries).
class RetryInterceptor extends Interceptor {
  RetryInterceptor({required this.dio, this.maxAttempts = 3});

  final Dio dio;
  final int maxAttempts;

  bool _isIdempotentMethod(String method) {
    final m = method.toUpperCase();
    return m == 'GET' || m == 'HEAD' || m == 'OPTIONS';
  }

  bool _shouldRetry(DioException err) {
    final request = err.requestOptions;
    final retryableByFlag = request.extra['retryable'] == true;
    final retryableMethod = _isIdempotentMethod(request.method);
    if (!retryableByFlag && !retryableMethod) return false;
    return err.type == DioExceptionType.connectionTimeout ||
        err.type == DioExceptionType.receiveTimeout ||
        err.type == DioExceptionType.connectionError ||
        err.type == DioExceptionType.sendTimeout;
  }

  Duration _getDelay(int attempt) {
    // Base 500ms × 2^(attempt-1)  + random jitter up to 250ms
    final baseDelay = 500 * pow(2, attempt - 1);
    final jitter = Random().nextInt(250);
    return Duration(milliseconds: baseDelay.toInt() + jitter);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    var attempt = err.requestOptions.extra['retry_attempt'] as int? ?? 0;

    if (attempt < maxAttempts && _shouldRetry(err)) {
      attempt += 1;
      err.requestOptions.extra['retry_attempt'] = attempt;

      await Future.delayed(_getDelay(attempt));

      try {
        final response = await dio.fetch(err.requestOptions);
        return handler.resolve(response);
      } on DioException catch (e) {
        // Pass the new error to be evaluated again (may retry)
        return super.onError(e, handler);
      }
    }

    // Give up – forward the original error.
    return super.onError(err, handler);
  }
}
