import 'package:get/get.dart';

Future<void> goBack(dynamic result) async {
  Get.back(result: result);
}

void clearHistory(dynamic route) {}

void logOutResetHistory(dynamic route) {}

GetInterface navigateToRoute() => Get;
