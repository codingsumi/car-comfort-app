import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../network/repository/support_repository.dart';
import '../../routes/app_pages.dart';
import '../../utils/app_snackbar.dart';
import '../../utils/custom_loader.dart';
import '../../widgets/widgets.dart';
import '../dashboard/dashboard_controller.dart';
import 'customer_media_report_config.dart';

class CustomerMediaReportController extends GetxController {
  CustomerMediaReportController({required this.config})
      : _repo = Get.find<SupportRepository>();

  static const int maxAttachments = 10;

  final CustomerMediaReportConfig config;
  final SupportRepository _repo;

  final descriptionController = TextEditingController();
  final bookingIdController = TextEditingController();
  final mediaPaths = <String>[].obs;
  final isSubmitting = false.obs;

  @override
  void onClose() {
    descriptionController.dispose();
    bookingIdController.dispose();
    super.onClose();
  }

  bool isVideoPath(String path) {
    final lower = path.trim().toLowerCase();
    return lower.endsWith('.mp4') ||
        lower.endsWith('.mov') ||
        lower.endsWith('.avi') ||
        lower.endsWith('.mkv') ||
        lower.endsWith('.webm') ||
        lower.endsWith('.mpeg') ||
        lower.endsWith('.m4v');
  }

  Future<void> addMedia(BuildContext context) async {
    if (mediaPaths.length >= maxAttachments) {
      showAppSnackBar(
        title: config.snackBarTitle,
        message: 'You can attach up to $maxAttachments photos or videos.',
        isError: true,
      );
      return;
    }

    await chooseMediaTypeDialog(
      context,
      pictureClick: () => _addPhoto(context),
      videoClick: () => _addVideo(context),
    );
  }

  Future<void> _addPhoto(BuildContext context) async {
    await attachmentDialog(
      context,
      cameraClick: () => _pickPhoto(isCamera: true),
      galleryClick: () => _pickPhoto(isCamera: false),
    );
  }

  Future<void> _pickPhoto({required bool isCamera}) async {
    if (mediaPaths.length >= maxAttachments) return;
    final path = await pickPicture(isCamera: isCamera);
    if (path == null || path.trim().isEmpty) return;
    if (Get.isDialogOpen == true) Get.back<void>();
    mediaPaths.add(path);
  }

  Future<void> _addVideo(BuildContext context) async {
    if (mediaPaths.length >= maxAttachments) return;
    await attachmentDialog(
      context,
      cameraClick: () => _pickVideo(isCamera: true),
      galleryClick: () => _pickVideo(isCamera: false),
    );
  }

  Future<void> _pickVideo({required bool isCamera}) async {
    if (mediaPaths.length >= maxAttachments) return;
    final path = await pickVideo(isCamera: isCamera);
    // pickVideo now dismisses the dialog before launching the camera/gallery,
    // and returns null (not '') when the user cancels or an error occurs.
    if (path == null || path.trim().isEmpty) return;
    mediaPaths.add(path);
  }

  void removeMediaAt(int index) {
    if (index < 0 || index >= mediaPaths.length) return;
    mediaPaths.removeAt(index);
  }

  void _returnToSettingsMenu() {
    if (Get.isRegistered<DashboardController>()) {
      Get.find<DashboardController>().homeNavIndex.value = 2;
    }

    final onReportScreen =
        Get.currentRoute == Routes.REPORT_ACCIDENT_DAMAGE ||
        Get.currentRoute == Routes.REPORT_MISSING_ITEM;

    if (onReportScreen && (Get.key.currentState?.canPop() ?? false)) {
      Get.back<void>(closeOverlays: true, result: true);
      return;
    }

    if (Get.currentRoute != Routes.SETTINGS &&
        Get.currentRoute != Routes.DASHBOARD) {
      Get.until(
        (route) {
          final name = route.settings.name;
          return name == Routes.SETTINGS || name == Routes.DASHBOARD;
        },
      );
    }

    if (Get.isRegistered<DashboardController>()) {
      Get.find<DashboardController>().homeNavIndex.value = 2;
    }
  }

  Future<void> submit() async {
    final description = descriptionController.text.trim();
    if (description.length < 10) {
      showAppSnackBar(
        title: config.snackBarTitle,
        message: config.descriptionValidationMessage,
        isError: true,
      );
      return;
    }

    if (mediaPaths.isEmpty) {
      showAppSnackBar(
        title: config.snackBarTitle,
        message: 'Please attach at least one photo or video.',
        isError: true,
      );
      return;
    }

    final bookingId = int.tryParse(bookingIdController.text.trim());

    isSubmitting.value = true;
    Loader.showLoading();
    final res = await _repo.submitMediaReport(
      reportType: config.reportType,
      description: description,
      mediaPaths: mediaPaths.toList(),
      bookingId: bookingId,
    );
    Loader.hideLoading();
    isSubmitting.value = false;

    res.when(
      success: (response) {
        showAppSnackBar(
          title: config.snackBarTitle,
          message: response.message ?? 'Your report has been submitted.',
        );
        _returnToSettingsMenu();
      },
      error: (error) {
        showAppSnackBar(
          title: config.snackBarTitle,
          message: error.errorMessage,
          isError: true,
        );
      },
    );
  }
}
