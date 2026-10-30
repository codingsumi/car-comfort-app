import 'package:dio/dio.dart';

import '../../models/api_error.dart';
import '../../utils/extensions/extension.dart';
import 'exception_message.dart';
import 'network_exception.dart';
import 'network_result.dart';

typedef JsonMapper<T> = T Function(dynamic json);

typedef ErrorMapper = DefaultApiError? Function(dynamic json);

class ApiHandler {
  final ErrorMapper errorMapper;

  final bool shouldShowApiErrors;
  final ExceptionMessage exceptionMessages;

  ApiHandler({
    this.errorMapper = ApiHandler.getErrorMessageFromResponse,
    this.shouldShowApiErrors = true,
    this.exceptionMessages = const ExceptionMessage(),
  });

  Future<NetworkResult<T>> handleNetworkResult<T>({
    required Response<dynamic> response,
    required JsonMapper<T> fromJson,
    bool shouldHandleUnauthorizedRequest = true,
  }) async {
    try {
      final correctCodes = [200, 201, 204];

      if (response.statusCode == 400 || !correctCodes.contains(response.statusCode)) {
        return NetworkResult.error(_handleResponse(response: response, shouldHandleUnauthorizedRequest: shouldHandleUnauthorizedRequest));
      } else {
        if (isResponseBlank(response) ?? true) {
          return NetworkResult.error(UnexpectedErrorException(errorMessage: exceptionMessages.unexpectedError));
        } else {
          final data = response.data;

          if (data == null) {
            if (response.statusCode == 204) {
              try {
                return NetworkResult.success(fromJson(const <String, dynamic>{}));
              } catch (e) {
                return NetworkResult.error(
                  UnableToProcessException(
                    errorMessage: "ERROR $e",
                    shouldShowApiError: shouldShowApiErrors,
                  ),
                );
              }
            }
            return NetworkResult.error(
              EmptyResponseException(
                errorMessage: exceptionMessages.emptyResponse,
                shouldShowApiError: shouldShowApiErrors,
              ),
            );
          } else {
            try {
              return NetworkResult.success(fromJson(data));
            } catch (e) {
              return NetworkResult.error(UnableToProcessException(
                  errorMessage: "ERROR $e", // exceptionMessages.unableToProcess,
                  shouldShowApiError: shouldShowApiErrors));
            }
          }
        }
      }
    } catch (e) {
      return NetworkResult.error(UnexpectedErrorException(errorMessage: exceptionMessages.unexpectedError));
    }
  }

  NetworkResult<T> handleDioException<T>({dynamic error, bool shouldHandleUnauthorizedRequest = true}) {
    return NetworkResult.error(_getDioException(error: error, shouldHandleUnauthorizedRequest: shouldHandleUnauthorizedRequest));
  }

  NetworkException _handleResponse<T>({Response<T>? response, bool shouldHandleUnauthorizedRequest = true}) {
    final dynamic errorJson = response?.data;

    String? errMsg;
    DefaultApiError? error;

    try {
      error = errorMapper(errorJson);
      errMsg = error?.message;
    } catch (_) {}

    final int statusCode = response?.statusCode ?? -1;
    switch (statusCode) {
      case 400:
        return DefaultApiException(
            apiErrorMessage: errMsg, errBody: error, errorMessage: exceptionMessages.defaultError, shouldShowApiError: shouldShowApiErrors);
      case 401:
      case 403:
        return UnauthorizedRequestException(
            apiErrorMessage: errMsg, errBody: error, errorMessage: exceptionMessages.unauthorizedRequest, shouldShowApiError: shouldShowApiErrors);
      case 404:
        return NotFoundException(
            apiErrorMessage: errMsg, errBody: error, errorMessage: exceptionMessages.notFound, shouldShowApiError: shouldShowApiErrors);
      case 409:
        return ConflictException(apiErrorMessage: errMsg, errorMessage: exceptionMessages.conflict, shouldShowApiError: shouldShowApiErrors);
      case 408:
        return RequestTimeoutException(
            apiErrorMessage: errMsg, errorMessage: exceptionMessages.requestTimeout, shouldShowApiError: shouldShowApiErrors);
      case 422:
        return UnableToProcessException(
            apiErrorMessage: errMsg, errBody: error, errorMessage: exceptionMessages.unableToProcess, shouldShowApiError: shouldShowApiErrors);
      case 500:
        return InternalServerErrorException(
            apiErrorMessage: errMsg, errorMessage: exceptionMessages.internalServerError, shouldShowApiError: shouldShowApiErrors);
      case 503:
        return ServiceUnavailableException(
            apiErrorMessage: errMsg, errorMessage: exceptionMessages.serviceUnavailable, shouldShowApiError: shouldShowApiErrors);
      default:
        return DefaultApiException(apiErrorMessage: errMsg, errorMessage: exceptionMessages.defaultError, shouldShowApiError: shouldShowApiErrors);
    }
  }

  NetworkException _getDioException({dynamic error, bool shouldHandleUnauthorizedRequest = true}) {
    if (error is Exception) {
      try {
        NetworkException networkExceptions = UnexpectedErrorException(errorMessage: exceptionMessages.unexpectedError);

        if (error is DioException) {
          networkExceptions = switch (error.type) {
            DioExceptionType.cancel => RequestCanceledException(errorMessage: exceptionMessages.requestCancelled),
            DioExceptionType.connectionTimeout =>
              RequestTimeoutException(errorMessage: exceptionMessages.requestTimeout, shouldShowApiError: shouldShowApiErrors),
            DioExceptionType.unknown => _looksLikeConnectionError(error.error)
                ? NoInternetConnectionException(errorMessage: exceptionMessages.noInternetConnection)
                : UnexpectedErrorException(errorMessage: exceptionMessages.unexpectedError),
            DioExceptionType.receiveTimeout => SendTimeoutException(errorMessage: exceptionMessages.sendTimeout),
            DioExceptionType.badResponse =>
              _handleResponse(response: error.response, shouldHandleUnauthorizedRequest: shouldHandleUnauthorizedRequest),
            DioExceptionType.sendTimeout => SendTimeoutException(errorMessage: exceptionMessages.sendTimeout),
            DioExceptionType.badCertificate => UnexpectedErrorException(errorMessage: exceptionMessages.unexpectedError),
            DioExceptionType.connectionError => NoInternetConnectionException(errorMessage: exceptionMessages.noInternetConnection),
          };
        } else if (_looksLikeConnectionError(error)) {
          networkExceptions = NoInternetConnectionException(errorMessage: exceptionMessages.noInternetConnection);
        } else {
          networkExceptions = UnexpectedErrorException(errorMessage: exceptionMessages.unexpectedError);
        }
        return networkExceptions;
      } on FormatException catch (_) {
        return FormatException(errorMessage: exceptionMessages.formatException);
      } catch (_) {
        return UnexpectedErrorException(errorMessage: exceptionMessages.unexpectedError);
      }
    } else {
      if (error.toString().contains("is not a subtype of")) {
        return UnableToProcessException(errorMessage: exceptionMessages.unableToProcess, shouldShowApiError: false);
      } else {
        return UnexpectedErrorException(errorMessage: exceptionMessages.unexpectedError);
      }
    }
  }

  bool _looksLikeConnectionError(Object? error) {
    final text = error?.toString().toLowerCase() ?? '';
    return text.contains('socketexception') ||
        text.contains('network is unreachable') ||
        text.contains('failed host lookup') ||
        text.contains('connection refused');
  }

  static DefaultApiError? getErrorMessageFromResponse(dynamic json) {
    return json != null ? DefaultApiError.fromJson(json) : null;
  }
}
