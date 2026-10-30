import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:get/utils.dart';

import '../../utils/alerts.dart';

class LogInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    try {
      printAll("(${DateTime.now()}) -> [${options.method}] || ${options.uri}");

      var headerMsg = "HEADERS -> \n${const JsonEncoder.withIndent("    ").convert(options.headers)}";

      // options.headers.forEach((key, v) {
      //   headerMsg += "$key : $v\n";
      // });

      printAll(headerMsg);

      if (options.data != null) {
        printAll('REQUEST BODY ->');
        try {
          printAll(const JsonEncoder.withIndent("    ").convert(options.data));
        } catch (e) {
          // e.printError();
          try {
            var fData = options.data as FormData;
            for (var entry in fData.fields) {
              printAll("${entry.key}:${entry.value}");
            }
            for (var entry in fData.files) {
              printAll("${entry.key}:${entry.value}");
            }
          } catch (e) {
            printAll(options.data.toString());
          }
        }
      }
    } catch (e) {
      e.printError;
    }
    return super.onRequest(options, handler);
  }

  @override
  void onResponse(Response<dynamic> response, ResponseInterceptorHandler handler) {
    try {
      log(runtimeType.toString(), "(${DateTime.now()}) <- [${response.statusCode}] || ${response.realUri}");

      log(runtimeType.toString(), 'RESPONSE BODY ->');
      String body = "";

      try {
        body = const JsonEncoder.withIndent("  ").convert(response.data);
      } catch (e) {
        e.printError();
        body = response.data.toString();
      }

      printAll(body);
    } catch (e) {
      e.printError;
    }

    return super.onResponse(response, handler);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    try {
      log(runtimeType.toString(), "-> [${err.response?.statusCode}] || ${err.requestOptions.uri}");
      log(runtimeType.toString(), 'ERR TYPE -> ${err.type}');
      log(runtimeType.toString(), 'ERR MESSAGE -> ${err.message}');
      if (err.error != null) {
        log(runtimeType.toString(), 'ERR RAW -> ${err.error}');
      }

      if (err.response?.data != null) {
        log(runtimeType.toString(), 'ERR BODY ->\n${err.response?.data}');
      }
    } catch (e) {
      e.printError;
    }

    return super.onError(err, handler);
  }

  void printAll(String msg) {
    msg.toString().split('\n').forEach((element) => log(runtimeType.toString(), element));
  }
}
