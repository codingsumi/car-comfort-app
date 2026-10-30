import 'package:flutter/material.dart';
import 'package:get/get.dart';

/// Material green 700 — white text reads clearly on top.
const Color _successBg = Color(0xFF388E3C);

/// Material red 700.
const Color _errorBg = Color(0xFFC62828);

/// Shared [Get.snackbar] styling: success = green background, error = red; text is always white.
void showAppSnackBar({
  required String title,
  required String message,
  bool isError = false,
  SnackPosition snackPosition = SnackPosition.BOTTOM,
  Duration? duration,
  EdgeInsetsGeometry? margin,
}) {
  // Close any open dialog/loader first so the snackbar is never silently
  // swallowed by the `isDialogOpen` guard that Get.snackbar applies internally.
  if (Get.isDialogOpen == true) {
    Get.back();
  }

  // Let the navigator settle for one frame before showing the snackbar so it
  // renders on the correct route (especially after a loader dialog closes).
  WidgetsBinding.instance.addPostFrameCallback((_) {
    Get.snackbar(
      title,
      message,
      snackPosition: snackPosition,
      backgroundColor: isError ? _errorBg : _successBg,
      colorText: Colors.white,
      duration: duration ?? const Duration(seconds: 4),
      borderRadius: 8,
    );
  });
}
