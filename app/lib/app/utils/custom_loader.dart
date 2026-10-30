import 'package:flutter/material.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import 'package:get/get.dart';

import '../utils/extensions/extension.dart';

class Loader {
  static bool _isShowing = false;

  //show loading
  static void showLoading() {
    if (_isShowing) return;
    final context = Get.context;
    if (context == null) return;
    _isShowing = true;
    Get.dialog(
      barrierDismissible: false,
      Dialog(
        child: Container(
          width: 72,
          height: 64,
          decoration: BoxDecoration(color: Get.context?.colorScheme.surface, borderRadius: BorderRadius.circular(16)),
          padding: const EdgeInsets.all(8.0),
          child: SpinKitThreeBounce(color: Get.context?.colorScheme.primary, size: 20),
        ),
      ).marginAll((Get.context as BuildContext).isTablet
          ? context.isPortrait
              ? MediaQuery.sizeOf(context).width * 0.37
              : MediaQuery.sizeOf(context).width * 0.23
          : MediaQuery.sizeOf(context).width * 0.30),
    );
  }

  //hide loading
  static void hideLoading() {
    if (!_isShowing) return;
    _isShowing = false;
    if (Get.isDialogOpen == true) {
      Get.back();
    }
    // Occasional GetX mismatch: loader route still open after first pop.
    if (Get.isDialogOpen == true) {
      Get.back();
    }
  }
}
