import '../../models/api_error.dart';

sealed class NetworkException {
  final String errorMessage;

  final bool shouldShowApiError;

  final DefaultApiError? errBody;

  const NetworkException({required this.errorMessage, this.shouldShowApiError = true, this.errBody});

  String get message => errorMessage;
}

class ApiException extends NetworkException {
  final String? apiErrorMessage;

  const ApiException({this.apiErrorMessage, super.errBody, required super.errorMessage, super.shouldShowApiError});

  @override
  String get message => shouldShowApiError ? apiErrorMessage ?? errorMessage : errorMessage;
}

class UnauthorizedRequestException extends ApiException {
  const UnauthorizedRequestException({super.apiErrorMessage, required super.errorMessage, super.errBody, super.shouldShowApiError});
}

class NotFoundException extends ApiException {
  const NotFoundException({super.apiErrorMessage, required super.errorMessage, super.errBody, super.shouldShowApiError});

  @override
  String get message => shouldShowApiError ? apiErrorMessage ?? errorMessage : errorMessage;
}

class ConflictException extends ApiException {
  const ConflictException({super.apiErrorMessage, required super.errorMessage, super.shouldShowApiError});

  @override
  String get message => shouldShowApiError ? apiErrorMessage ?? errorMessage : errorMessage;
}

class RequestTimeoutException extends ApiException {
  const RequestTimeoutException({super.apiErrorMessage, required super.errorMessage, super.shouldShowApiError});

  @override
  String get message => shouldShowApiError ? apiErrorMessage ?? errorMessage : errorMessage;
}

class UnableToProcessException extends ApiException {
  const UnableToProcessException({super.apiErrorMessage, required super.errorMessage, super.errBody, super.shouldShowApiError});

  @override
  String get message => shouldShowApiError ? apiErrorMessage ?? errorMessage : errorMessage;
}

class InternalServerErrorException extends ApiException {
  const InternalServerErrorException({super.apiErrorMessage, required super.errorMessage, super.shouldShowApiError});

  @override
  String get message => shouldShowApiError ? apiErrorMessage ?? errorMessage : errorMessage;
}

class ServiceUnavailableException extends ApiException {
  const ServiceUnavailableException({super.apiErrorMessage, required super.errorMessage, super.shouldShowApiError});

  @override
  String get message => shouldShowApiError ? apiErrorMessage ?? errorMessage : errorMessage;
}

class EmptyResponseException extends ApiException {
  const EmptyResponseException({super.apiErrorMessage, required super.errorMessage, super.shouldShowApiError});

  @override
  String get message => shouldShowApiError ? apiErrorMessage ?? errorMessage : errorMessage;
}

class DefaultApiException extends ApiException {
  const DefaultApiException({super.apiErrorMessage, super.errBody, required super.errorMessage, super.shouldShowApiError});
}

class SendTimeoutException extends NetworkException {
  const SendTimeoutException({
    required super.errorMessage,
  });
}

class RequestCanceledException extends NetworkException {
  const RequestCanceledException({required super.errorMessage});
}

class NoInternetConnectionException extends NetworkException {
  const NoInternetConnectionException({required super.errorMessage});
}

class FormatException extends NetworkException {
  const FormatException({required super.errorMessage});
}

class UnexpectedErrorException extends NetworkException {
  const UnexpectedErrorException({
    required super.errorMessage,
  });
}
