// ignore: deprecated_member_use, avoid_web_libraries_in_flutter
import 'dart:html' as html;

import 'package:get/get.dart';

Future<void> goBack(dynamic result) async {
  if (Get.rootDelegate.history.length > 1) {
    Future.delayed(const Duration(milliseconds: 100), () {
      html.window.history.back();
    });
  } else {
    if (html.window.history.length > 1) {
      html.window.history.back(); // Go back only if history exists
    }
  }
}

void clearHistory(dynamic route) {
  html.window.history.replaceState(null, 'newState', route);
}

void logOutResetHistory(dynamic route) {
  for (var i = 0; i < html.window.history.length; i++) {
    html.window.history.back();
  }
  Future.delayed(const Duration(milliseconds: 100), () {
    html.window.history.replaceState(null, 'newState', route);
  });
}

GetDelegate navigateToRoute() => Get.rootDelegate;
