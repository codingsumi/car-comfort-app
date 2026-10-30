class ExceptionMessage {
  const ExceptionMessage();

  String get badRequest => "Sorry, The API request is invalid or improperly formed.";

  String get conflict => "Sorry, The request wasn't completed due to a conflict.";

  String get defaultError => "Sorry, Something went wrong.";

  String get emptyResponse => "Sorry, Couldn't receive response from the server.";

  String get formatException => "Sorry, The request wasn't formatted correctly.";

  String get internalServerError => "Sorry, this isn't working right now. Please try again soon or contact support for assistance.";

  String get noInternetConnection => "No internet connection";

  String get notAcceptable => "Sorry, The request is not acceptable";

  String get notFound => "Sorry, The resource requested couldn't be found.";

  String get requestCancelled => "Sorry, The request has been canceled";

  String get requestTimeout => "Sorry, The request has timed out.";

  String get sendTimeout => "Sorry, The request has send timeout in connection with API server";

  String get serviceUnavailable => "Sorry, The service is unavailable";

  String get unableToProcess => "Sorry, Couldn't process the data.";

  String get unauthorizedRequest => "Sorry, The request is unauthorized.";

  String get unexpectedError => "Something went wrong. Please try again.";

}