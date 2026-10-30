import 'package:dio/dio.dart';
import 'package:get/get.dart';

import '../utils/api_handler.dart';
import '../utils/network_exception.dart';
import '../utils/network_result.dart';

typedef JsonMapper<T> = T Function(dynamic json);

/// Base class for all repositories.
///
/// Token injection is handled centrally by [AuthInterceptor] — do NOT
/// manually set the Authorization header here. That pattern was the root
/// cause of requests going out without a token when _cachedToken was stale.
abstract class BaseRepository {
  final Dio _dioClient = Get.find(tag: "dio_client");
  final ApiHandler _apiHandler = Get.find(tag: "handler");

  Future<NetworkResult<T>> get<T>(
    String path, {
    Map<String, dynamic> headers = const {},
    Map<String, dynamic> query = const {},
    required JsonMapper<T> fromJson,
  }) async {
    try {
      final res = await _dioClient.get(path, queryParameters: query);
      return _apiHandler.handleNetworkResult(response: res, fromJson: fromJson, shouldHandleUnauthorizedRequest: true);
    } catch (error) {
      return _apiHandler.handleDioException(error: error, shouldHandleUnauthorizedRequest: true);
    }
  }

  Future<NetworkResult<T>> post<T>(
    String path, {
    Object body = const {},
    Map<String, dynamic> headers = const {},
    Map<String, dynamic> query = const {},
    Duration? receiveTimeout,
    required JsonMapper<T> fromJson,
  }) async {
    try {
      final res = await _dioClient.post(
        path,
        data: body,
        queryParameters: query,
        options: receiveTimeout == null
            ? null
            : Options(
                receiveTimeout: receiveTimeout,
                sendTimeout: receiveTimeout,
              ),
      );
      return _apiHandler.handleNetworkResult(response: res, fromJson: fromJson, shouldHandleUnauthorizedRequest: true);
    } catch (error) {
      return _apiHandler.handleDioException(error: error, shouldHandleUnauthorizedRequest: true);
    }
  }

  Future<NetworkResult<T>> delete<T>(
    String path, {
    Object body = const {},
    Map<String, dynamic> headers = const {},
    Map<String, dynamic> query = const {},
    required JsonMapper<T> fromJson,
  }) async {
    try {
      final res = await _dioClient.delete(path, data: body, queryParameters: query);
      return _apiHandler.handleNetworkResult(
        response: res,
        fromJson: fromJson,
        shouldHandleUnauthorizedRequest: true,
      );
    } catch (error) {
      return _apiHandler.handleDioException(
        error: error,
        shouldHandleUnauthorizedRequest: true,
      );
    }
  }

  Future<NetworkResult<T>> patch<T>(
    String path, {
    Object body = const {},
    Map<String, dynamic> headers = const {},
    Map<String, dynamic> query = const {},
    required JsonMapper<T> fromJson,
  }) async {
    try {
      final res = await _dioClient.patch(path, data: body, queryParameters: query);
      return _apiHandler.handleNetworkResult(
        response: res,
        fromJson: fromJson,
        shouldHandleUnauthorizedRequest: true,
      );
    } catch (error) {
      return _apiHandler.handleDioException(
        error: error,
        shouldHandleUnauthorizedRequest: true,
      );
    }
  }

  Future<NetworkResult<List<int>>> downloadBytes(
    String path, {
    Map<String, dynamic> query = const {},
  }) async {
    try {
      final res = await _dioClient.get<List<int>>(
        path,
        queryParameters: query,
        options: Options(responseType: ResponseType.bytes),
      );
      final data = res.data;
      if (data == null || data.isEmpty) {
        return NetworkError(
          EmptyResponseException(
            errorMessage: 'Download returned an empty file.',
          ),
        );
      }
      return NetworkSuccess(data);
    } catch (error) {
      return _apiHandler.handleDioException(
        error: error,
        shouldHandleUnauthorizedRequest: true,
      );
    }
  }

  Future<NetworkResult<T>> put<T>(
    String path, {
    Object body = const {},
    Map<String, dynamic> headers = const {},
    Map<String, dynamic> query = const {},
    required JsonMapper<T> fromJson,
  }) async {
    try {
      final res = await _dioClient.put(path, data: body, queryParameters: query);
      return _apiHandler.handleNetworkResult(
        response: res,
        fromJson: fromJson,
        shouldHandleUnauthorizedRequest: true,
      );
    } catch (error) {
      return _apiHandler.handleDioException(
        error: error,
        shouldHandleUnauthorizedRequest: true,
      );
    }
  }
}
