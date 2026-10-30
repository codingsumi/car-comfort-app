import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../../constants/api_constants.dart';
import '../../utils/pref.dart';
import 'auth_interceptor.dart';
import 'log_interceptor.dart' as logger;
import 'maintenance_interceptor.dart';
import 'retry_interceptor.dart';
import 'session_expired_interceptor.dart';

class DioClient {
  Dio _dio = Dio();

  DioClient() {
    var headerMap = <String, String>{
      "platform": Platform.isAndroid ? "android" : "ios",
      "isDebug": kDebugMode.toString(),
      "timezone": Prefs().getTimeZoneData(Prefs.timezone),
      if (Prefs().token().isNotEmpty) 'Authorization': "Bearer ${Prefs().token()}"
    };

    var baseOptions = BaseOptions(
      baseUrl: ApiConstants.baseUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      headers: headerMap,
    );

    _dio = Dio(baseOptions);

    _dio.interceptors.add(AuthInterceptor());
    _dio.interceptors.add(RetryInterceptor(dio: _dio));
    _dio.interceptors.add(logger.LogInterceptor());
    _dio.interceptors.add(SessionExpiredInterceptor());
    _dio.interceptors.add(MaintenanceInterceptor());
  }

  Dio getClient() => _dio;
}
