import 'package:dio/dio.dart';

import '../repository/endpoint.dart';
import 'session_expired_dialog.dart';

/// Handles HTTP 401 responses: one dialog, then local logout.
///
/// Distinguishes two cases:
///  - `session_invalidated`: the account signed in on another device
///  - anything else: generic token expiry / account blocked
class SessionExpiredInterceptor extends Interceptor {
  static bool _sessionExpiredFlowActive = false;

  static void _endSessionExpiredFlow() {
    _sessionExpiredFlowActive = false;
  }

  static bool _isPublicAuthRequest(RequestOptions options) {
    const publicPaths = {
      API.login,
      API.customerRegister,
      API.forgotPassword,
      API.verifyOtp,
      API.verifyResetOtp,
      API.resendOtp,
      API.resendOtpEmail,
      API.verifyOtpEmail,
      API.resetPassword,
    };
    return publicPaths.contains(options.path);
  }

  /// Extracts `error_type` from a Dio 401 response body (if present).
  static String? _errorType(DioException err) {
    try {
      final data = err.response?.data;
      if (data is Map) return data['error_type']?.toString();
    } catch (_) {}
    return null;
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    final status = err.response?.statusCode;
    if (status != 401) {
      return super.onError(err, handler);
    }
    if (_isPublicAuthRequest(err.requestOptions)) {
      return super.onError(err, handler);
    }
    if (!_sessionExpiredFlowActive) {
      _sessionExpiredFlowActive = true;
      final errorType = _errorType(err);
      Future<void>.microtask(() async {
        try {
          await showSessionExpiredLogoutDialog(
            reason: errorType,
            onFlowEnded: _endSessionExpiredFlow,
          );
        } catch (_) {
          _endSessionExpiredFlow();
        }
      });
    }
    return super.onError(err, handler);
  }
}
