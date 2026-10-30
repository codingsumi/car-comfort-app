import 'package:flutter/material.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import 'package:get/get.dart';

import '../utils/extensions/extension.dart';

class Loader {
  static OverlayEntry? _overlayEntry;

  //show loading
  static void showLoading() {
    if (_overlayEntry != null) return;
    final context = Get.overlayContext ?? Get.context;
    if (context == null) return;

    _overlayEntry = OverlayEntry(
      builder: (context) => Stack(
        children: [
          const ModalBarrier(
            color: Colors.black12,
            dismissible: false,
          ),
          Center(
            child: Material(
              color: Colors.transparent,
              child: Container(
                width: 72,
                height: 64,
                decoration: BoxDecoration(
                  color: context.colorScheme.surface,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: const [
                    BoxShadow(
                      color: Colors.black12,
                      blurRadius: 10,
                      offset: Offset(0, 4),
                    ),
                  ],
                ),
                padding: const EdgeInsets.all(8.0),
                child: SpinKitThreeBounce(
                  color: context.colorScheme.primary,
                  size: 20,
                ),
              ),
            ),
          ),
        ],
      ),
    );

    try {
      final overlay = Overlay.of(context);
      overlay.insert(_overlayEntry!);
    } catch (e) {
      debugPrint("Error inserting loader overlay: $e");
      _overlayEntry = null;
    }
  }

  //hide loading
  static void hideLoading() {
    if (_overlayEntry != null) {
      try {
        _overlayEntry!.remove();
      } catch (e) {
        debugPrint("Error removing loader overlay: $e");
      }
      _overlayEntry = null;
    }
  }
}
