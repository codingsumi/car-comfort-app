import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import 'package:flutter/foundation.dart';
import 'package:get/get.dart';
import 'package:image_cropper/image_cropper.dart';
import 'package:image_picker/image_picker.dart';

import '../constants/app_strings.dart';
import '../constants/ui_constants.dart';
import '../network/utils/log_util.dart';
import '../utils/extensions/extension.dart';
import '../utils/image_upload_compress.dart';
import 'app_colors.dart';
import 'button.dart';
import 'text.dart';

class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.onTap,
    this.radius,
    this.color,
    this.borderWidth = 3,
    this.borderColor,
  });

  final Widget child;
  final Color? color;
  final double? radius;
  final VoidCallback? onTap;
  final double borderWidth;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: color ?? context.colorScheme.onPrimary,
        borderRadius: BorderRadius.circular(
          radius ?? UIConstants.defaultRadius,
        ),
        boxShadow: UIConstants.defaultShadow,
      ),
      child: Material(
        child: Ink(
          decoration: BoxDecoration(
            color: color ?? context.colorScheme.onPrimary,
            borderRadius: BorderRadius.circular(
              radius ?? UIConstants.defaultRadius,
            ),
            border: Border.all(
              color: borderWidth <= 0
                  ? Colors.transparent
                  : borderColor ??
                        context.colorScheme.primary.withValues(alpha: 0.4),
              width: borderWidth,
            ),
          ),
          child: InkWell(onTap: onTap, child: child),
        ),
      ),
    );
  }
}

class AppGrid extends StatelessWidget {
  final double? maxExtent;
  final List<Widget> child;
  final int phoneCount;
  final int tabletCount;
  final int landscapeCount;
  final double? axisSpacing;
  final SliverGridDelegate? delegate;
  final ScrollController? controller;
  final ScrollPhysics? physics;

  const AppGrid({
    super.key,
    required this.child,
    this.delegate,
    this.maxExtent = 120,
    this.phoneCount = 1,
    this.tabletCount = 2,
    this.landscapeCount = 3,
    this.controller,
    this.axisSpacing,
    this.physics,
  });

  @override
  Widget build(BuildContext context) {
    return GridView(
      controller: controller,
      shrinkWrap: true,
      physics: physics ?? AlwaysScrollableScrollPhysics(),
      padding: EdgeInsets.zero,
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: context.isPhone
            ? phoneCount
            : context.mediaQuerySize.width >= 850
            ? landscapeCount
            : tabletCount,
        mainAxisExtent: maxExtent,
        mainAxisSpacing: axisSpacing ?? 0,
        crossAxisSpacing: axisSpacing ?? 0,
      ),
      scrollDirection: Axis.vertical,
      children: child,
    );
  }
}

Future<void> attachmentDialog(
  BuildContext context, {
  Future<void> Function()? cameraClick,
  Future<void> Function()? galleryClick,
}) async {
  await showDialog<void>(
    context: context,
    barrierDismissible: true,
    builder: (dialogContext) {
      return Align(
        alignment: Alignment.center,
        child: Dialog(
          insetPadding: const EdgeInsets.symmetric(
            horizontal: 24,
            vertical: 24,
          ),
          backgroundColor: Colors.transparent,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: Stack(
              children: [
                Container(
                  margin: const EdgeInsets.only(top: 36),
                  padding: const EdgeInsets.only(top: 36),
                  decoration: BoxDecoration(
                    color: context.colorScheme.onPrimary,
                    borderRadius: BorderRadius.circular(
                      UIConstants.defaultRadius,
                    ),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      CommonText.bold(
                        'Choose Picture from',
                        size: 16,
                        color: context.colorScheme.onSurface,
                      ).marginOnly(bottom: 16),
                      AppButton(
                        vPadding: 12,
                        type: ButtonType.primary,
                        bgColor: context.colorScheme.primary,
                        txtColor: context.colorScheme.onPrimary,
                        btnCornerRadius: 12,
                        onPressed: () async {
                          Navigator.of(dialogContext).pop();
                          await Future<void>.delayed(
                            const Duration(milliseconds: 300),
                          );
                          if (cameraClick != null) {
                            await cameraClick();
                          }
                        },
                        label: 'Camera',
                      ),
                      AppButton(
                        vPadding: 12,
                        type: ButtonType.primary,
                        bgColor: context.colorScheme.primary,
                        txtColor: context.colorScheme.onPrimary,
                        btnCornerRadius: 12,
                        onPressed: () async {
                          Navigator.of(dialogContext).pop();
                          await Future<void>.delayed(
                            const Duration(milliseconds: 300),
                          );
                          if (galleryClick != null) {
                            await galleryClick();
                          }
                        },
                        label: 'Gallery',
                      ).marginSymmetric(vertical: 8),
                      AppButton(
                        vPadding: 12,
                        type: ButtonType.secondary,
                        btnCornerRadius: 12,
                        onPressed: () {
                          Navigator.of(dialogContext).pop();
                        },
                        label: 'Cancel',
                      ),
                    ],
                  ).paddingAll(16),
                ),
                Align(
                  alignment: Alignment.topCenter,
                  child: Card(
                    elevation: 4,
                    shadowColor: context.colorScheme.outline.withValues(
                      alpha: 0.3,
                    ),
                    margin: EdgeInsets.zero,
                    color: context.colorScheme.onPrimary,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(100),
                    ),
                    clipBehavior: Clip.hardEdge,
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      alignment: Alignment.center,
                      height: 80,
                      width: 80,
                      child: Container(
                        height: 56,
                        width: 56,
                        decoration: BoxDecoration(
                          color: context.colorScheme.primary,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          Icons.photo_camera_back,
                          color: context.colorScheme.onPrimary,
                          size: 24,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    },
  );
}

Future<String?> _processPickedImage({
  required XFile picFile,
  required bool isCamera,
  required bool crop,
}) async {
  final filePath = picFile.path.trim();
  if (filePath.isEmpty) return null;

  // Browser pickers return an in-memory `blob:` URL. Its host can contain a
  // dot even though the selected file is a valid image, so extension checks
  // against the URL itself are not meaningful on web.
  final isImage =
      kIsWeb || isUploadableImagePath(filePath) || !filePath.contains('.');
  if (!isImage) {
    showToast(AppStrings.onlyImageFilesAllowed, isError: true);
    return null;
  }

  final workingPath = isCamera
      ? await persistCameraCapture(picFile)
      : await stabilizePickedImagePath(filePath);

  Alert.log('Pick Picture', 'Working path: $workingPath');

  if (!kIsWeb && !await File(workingPath).exists()) {
    Alert.log('Pick Picture', 'Working image missing: $workingPath');
    return null;
  }

  var resultPath = workingPath;

  if (crop) {
    final croppedPath = await _cropAfterNativePicker(
      workingPath,
      fromCamera: isCamera,
    );
    if (croppedPath == null || croppedPath.isEmpty) {
      // For camera captures the image is already saved to app-documents storage
      // by persistCameraCapture. If the crop UI failed to present (e.g. because
      // the system camera dismiss animation was still running), fall back to the
      // uncropped image rather than discarding the capture entirely.
      if (isCamera) {
        Alert.log(
          'Pick Picture',
          'Crop UI returned null for camera — using uncropped image',
        );
        resultPath = workingPath;
      } else {
        // Gallery: null means the user cancelled the crop intentionally.
        return null;
      }
    } else {
      resultPath = croppedPath;
    }
  }

  final compressed = await compressImageForUpload(resultPath);
  return await existingImagePathOrNull(compressed) ??
      await existingImagePathOrNull(resultPath);
}

Future<String?> _cropAfterNativePicker(
  String sourcePath, {
  required bool fromCamera,
}) async {
  if (fromCamera) {
    // Native camera must fully dismiss before the OS can present the crop UI.
    // Use a longer delay on camera captures to handle slow dismissal animations
    // on iOS 17+ and some Android devices with modal camera apps.
    await Future<void>.delayed(const Duration(milliseconds: 1200));
    await WidgetsBinding.instance.endOfFrame;
  }

  try {
    return await cropPickedImage(sourcePath);
  } catch (error, stack) {
    Alert.log('Pick Picture', 'Crop failed: $error\n$stack');
    return null;
  }
}

Future<String?> pickPicture({bool isCamera = false, bool crop = false}) async {
  try {
    final picFile = await ImagePicker().pickImage(
      source: isCamera ? ImageSource.camera : ImageSource.gallery,
      imageQuality: 90,
    );
    Alert.log('Image Picked', '${picFile?.path}');
    if (picFile == null) {
      return null;
    }

    return _processPickedImage(
      picFile: picFile,
      isCamera: isCamera,
      crop: crop,
    );
  } catch (error, stack) {
    Alert.log('Pick Picture', 'Error uploading image: $error\n$stack');
    return null;
  }
}

Future<String?> cropPickedImage(String sourcePath) async {
  if (sourcePath.trim().isEmpty || kIsWeb) return sourcePath;

  final normalizedPath = File(sourcePath.trim()).absolute.path;
  if (!await File(normalizedPath).exists()) {
    Alert.log('Crop', 'Source missing: $normalizedPath');
    return null;
  }

  final croppedFile = await ImageCropper().cropImage(
    sourcePath: normalizedPath,
    maxWidth: 2400,
    maxHeight: 2400,
    compressFormat: ImageCompressFormat.jpg,
    compressQuality: 92,
    uiSettings: [
      AndroidUiSettings(
        toolbarTitle: 'Crop image',
        toolbarColor: Colors.black,
        toolbarWidgetColor: Colors.white,
        initAspectRatio: CropAspectRatioPreset.original,
        lockAspectRatio: false,
        aspectRatioPresets: [
          CropAspectRatioPreset.original,
          CropAspectRatioPreset.ratio16x9,
          CropAspectRatioPreset.ratio4x3,
          CropAspectRatioPreset.square,
        ],
      ),
      IOSUiSettings(
        title: 'Crop image',
        doneButtonTitle: 'Done',
        cancelButtonTitle: 'Cancel',
        aspectRatioPresets: [
          CropAspectRatioPreset.original,
          CropAspectRatioPreset.ratio16x9,
          CropAspectRatioPreset.ratio4x3,
          CropAspectRatioPreset.square,
        ],
      ),
    ],
  );

  if (croppedFile == null) {
    return null;
  }

  final croppedPath = croppedFile.path.trim();
  if (croppedPath.isEmpty) {
    return null;
  }

  final persisted = await persistProcessedImageFile(
    croppedPath,
    prefix: 'cropped',
  );
  Alert.log('Crop', 'Cropped image persisted: $persisted');
  return persisted;
}

Future<List<String>?> pickMultiImages({int maxCount = 10}) async {
  try {
    var pickedImagesList = <String>[];

    final picFiles = await ImagePicker().pickMultiImage(limit: 10);
    final limitedFiles = picFiles.take(10).toList();

    if (picFiles.length > 10) {
      showToast(AppStrings.onlyFirstTenImagesUsed, isError: false);
    }

    for (var picFile in limitedFiles) {
      Alert.log("Image Picked", picFile.path);

      final filePath = picFile.path.trim();
      if (filePath.isEmpty) continue;

      final isImage =
          kIsWeb || isUploadableImagePath(filePath) || !filePath.contains('.');

      if (isImage) {
        pickedImagesList.add(await compressImageForUpload(filePath));
      } else {
        showToast(AppStrings.onlyImageFilesAllowed, isError: true);
      }
    }

    return pickedImagesList;
  } catch (error) {
    Alert.log("Pick Picture", "Error uploading image: $error");
    return [];
  }
}

/*Future<dynamic> cropFile(String pickedImage) async {
  var file = await ImageCropper().cropImage(
    sourcePath: pickedImage,
    uiSettings: [
      AndroidUiSettings(
        toolbarTitle: 'Edit Image',
        toolbarColor: Colors.white,
        toolbarWidgetColor: Colors.black,
        activeControlsWidgetColor: Get.context!.colorScheme.primary,
        initAspectRatio: CropAspectRatioPreset.original,
        lockAspectRatio: false,
        aspectRatioPresets: [
          CropAspectRatioPreset.square,
          CropAspectRatioPreset.ratio3x2,
          CropAspectRatioPreset.original,
          CropAspectRatioPreset.ratio4x3,
          CropAspectRatioPreset.ratio16x9,
        ],
      ),
      IOSUiSettings(minimumAspectRatio: 1.0),
    ],
  );
  return file;
}*/

Future<String?> pickVideo({bool isCamera = false}) async {
  // Dismiss any open dialog/overlay before launching the system camera/gallery.
  // Failing to do so causes a black-screen glitch or crash on some iOS/Android
  // versions because the system camera tries to present on top of the dialog.
  if (Get.isDialogOpen == true) {
    Get.back<void>();
    // Give the framework one frame to fully close the dialog before the OS
    // presents the camera/gallery UI.
    await Future<void>.delayed(const Duration(milliseconds: 200));
  }
  try {
    final picFile = await ImagePicker().pickVideo(
      source: isCamera ? ImageSource.camera : ImageSource.gallery,
      maxDuration: const Duration(minutes: 3),
    );
    Alert.log('Video Picked', '${picFile?.path}');
    if (picFile == null || picFile.path.trim().isEmpty) return null;
    return picFile.path;
  } catch (error) {
    Alert.log('Pick Video', 'Error picking video: $error');
    return null;
  }
}

Future<void> chooseMediaTypeDialog(
  BuildContext context, {
  VoidCallback? pictureClick,
  VoidCallback? videoClick,
}) async {
  Get.dialog(
    Align(
      alignment: Alignment.center,
      child: Dialog(
        insetPadding: const EdgeInsets.all(32),
        backgroundColor: Colors.transparent,
        child: Wrap(
          children: [
            Stack(
              children: [
                Container(
                  margin: const EdgeInsets.only(top: 36),
                  padding: const EdgeInsets.only(top: 36),
                  decoration: BoxDecoration(
                    color: context.colorScheme.onPrimary,
                    borderRadius: BorderRadius.circular(
                      UIConstants.defaultRadius,
                    ),
                  ),
                  child: Column(
                    children: [
                      CommonText.bold(
                        "Choose Media Type",
                        size: 16,
                        color: context.colorScheme.onSurface,
                      ).marginOnly(bottom: 16),
                      AppButton(
                        vPadding: 12,
                        type: ButtonType.primary,
                        bgColor: context.colorScheme.primaryContainer,
                        txtColor: context.colorScheme.secondary,
                        btnCornerRadius: 12,
                        onPressed: pictureClick,
                        label: 'Picture',
                      ),
                      AppButton(
                        vPadding: 12,
                        type: ButtonType.primary,
                        bgColor: context.colorScheme.primaryContainer,
                        txtColor: context.colorScheme.secondary,
                        btnCornerRadius: 12,
                        onPressed: videoClick,
                        label: 'Video',
                      ).marginSymmetric(vertical: 8),
                      AppButton(
                        vPadding: 12,
                        type: ButtonType.secondary,
                        btnCornerRadius: 12,
                        onPressed: () {
                          Get.back();
                        },
                        label: 'Cancel',
                      ),
                    ],
                  ).paddingAll(16),
                ),
                Align(
                  alignment: Alignment.topCenter,
                  child: Card(
                    elevation: 4,
                    shadowColor: context.colorScheme.outline.withValues(
                      alpha: 0.3,
                    ),
                    margin: EdgeInsets.zero,
                    color: context.colorScheme.onPrimary,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(
                        100,
                      ), // Circular shape
                    ),
                    clipBehavior: Clip.hardEdge,
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      alignment: Alignment.center,
                      height: 80,
                      width: 80,
                      child: Container(
                        height: 56,
                        width: 56,
                        decoration: BoxDecoration(
                          color: context.colorScheme.primaryContainer,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          Icons.camera_alt_outlined,
                          color: context.colorScheme.primary,
                          size: 24,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    ),
    barrierDismissible: true,
  );
}

Widget paginationLoader() {
  return Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(borderRadius: BorderRadius.circular(100)),
    child: Padding(
      padding: const EdgeInsets.all(8.0),
      child: Stack(
        alignment: Alignment.center,
        children: [
          SpinKitThreeBounce(color: Get.context?.colorScheme.primary, size: 20),
          // ClipRRect(
          //   borderRadius: BorderRadius.circular(100),
          //   child: Assets.launcherAppIcon.image(
          //     fit: BoxFit.cover,
          //     height: 48,
          //     width: 48,
          //   ),
          // ),
          // const SizedBox(width: 56, height: 56, child: CircularProgressIndicator(strokeWidth: 4)),
        ],
      ),
    ),
  );
}

Widget loader(BuildContext context) {
  return Center(
    child: SpinKitThreeBounce(
      color: Get.context?.colorScheme.primary,
      size: 20,
    ).paddingOnly(bottom: 20, top: 20),
  );
}

double screenWidth = MediaQuery.sizeOf(Get.context as BuildContext).width;
double screenHeight = MediaQuery.sizeOf(Get.context as BuildContext).height;

Widget dot() {
  return Container(
    width: 6,
    height: 6,
    decoration: BoxDecoration(color: successClr, shape: BoxShape.circle),
  );
}

Widget commonGroupInfo(BuildContext context) {
  return Row(
    mainAxisAlignment: MainAxisAlignment.spaceBetween,
    children: [
      _singleRowItem(context, "GROUP", "AB01"),
      _singleRowItem(context, "POS", "Sample School Nam"),
      _singleRowItem(context, "PROGRAM", "N. Long-Surname"),
    ],
  );
}

Widget _singleRowItem(BuildContext context, String type, String detail) {
  return IntrinsicHeight(
    child: SizedBox(
      child: Row(
        children: [
          VerticalDivider(
            color: context.colorScheme.outline.withValues(alpha: 0.6),
            thickness: 1,
          ).marginSymmetric(vertical: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CommonText.medium(type, size: 12),
              CommonText.medium(
                detail,
                color: detail == "AB01" ? context.colorScheme.primary : null,
                size: 14,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ],
      ),
    ),
  );
}

Widget statusSingleItem(BuildContext context, String type) {
  return Row(
    children: [
      CommonText.semiBold(type, color: context.colorScheme.secondary),
      Column(
        children: [
          const Icon(
            Icons.keyboard_arrow_up_rounded,
            size: 8,
          ).marginOnly(bottom: 2),
          const Icon(Icons.keyboard_arrow_down_rounded, size: 6),
        ],
      ),
    ],
  );
}

Widget divider(BuildContext context) {
  return Divider(color: context.colorScheme.outline.withValues(alpha: 0.6));
}

Widget spacer() => const Expanded(child: SizedBox());

InputDecoration inputDecoration(BuildContext context, {String? hint}) {
  var borderStyle = OutlineInputBorder(
    borderRadius: BorderRadius.circular(32),
    borderSide: BorderSide(
      color: context.colorScheme.primary.withValues(alpha: 0.2),
      width: 2,
    ),
  );
  var focusedBorderStyle = OutlineInputBorder(
    borderRadius: BorderRadius.circular(32),
    borderSide: BorderSide(color: context.colorScheme.primary, width: 2),
  );

  return InputDecoration(
    floatingLabelStyle: context.textTheme.bodyLarge?.copyWith(
      color: context.colorScheme.primary,
      fontWeight: FontWeight.w600,
      fontSize: 14,
    ),
    labelStyle: context.textTheme.bodyLarge?.copyWith(
      color: context.colorScheme.outline,
      fontWeight: FontWeight.w400,
      fontSize: 14,
    ),
    hintStyle: context.textTheme.bodyLarge?.copyWith(
      color: context.colorScheme.outline,
      fontWeight: FontWeight.w400,
      fontSize: 14,
    ),
    errorStyle: context.textTheme.bodyLarge?.copyWith(
      color: context.colorScheme.error,
      fontWeight: FontWeight.w500,
      fontSize: 12,
    ),
    floatingLabelBehavior: FloatingLabelBehavior.auto,
    prefixIconColor: context.colorScheme.primary,
    fillColor: context.colorScheme.onPrimary,
    contentPadding: const EdgeInsets.all(8),
    focusedErrorBorder: focusedBorderStyle,
    focusedBorder: focusedBorderStyle,
    enabledBorder: borderStyle,
    errorBorder: borderStyle,
    alignLabelWithHint: true,
    border: borderStyle,
    errorMaxLines: 4,
    hintText: hint,
    filled: true,
  );
}

Widget categorySingleItem(
  bool selected,
  String title,
  Function(String type) callBack,
) {
  return Container(
    decoration: BoxDecoration(
      color: Get.context?.colorScheme.onPrimary,
      borderRadius: BorderRadius.circular(8),
      border: Border.all(
        color: selected
            ? Get.context!.colorScheme.primary
            : Get.context!.colorScheme.onPrimary,
        width: 2,
      ),
    ),
    child: InkWell(
      onTap: () {
        callBack("select");
      },
      child: Center(
        child: selected
            ? CommonText.bold(
                title.toTitleCase(),
                textAlign: TextAlign.center,
              ).marginAll(4)
            : CommonText.semiBold(
                title.toTitleCase(),
                textAlign: TextAlign.center,
              ).marginAll(4),
      ),
    ),
  );
}

Widget listItem(
  String title,
  String? image,
  bool isExpanded,
  VoidCallback callBack, {
  Widget? subTitle,
  bool showTrailing = true,
}) {
  return InkWell(
    borderRadius: BorderRadius.circular(12),
    onTap: callBack,
    child: ListTile(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12), // Adjust the radius as needed
      ),
      tileColor: Get.context?.colorScheme.onPrimary,
      subtitle: subTitle,
      onTap: callBack,
      title: CommonText.bold(
        title,
        size: 16,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
      ),
      contentPadding: EdgeInsets.only(left: 16, right: showTrailing ? 0 : 16),
      trailing: showTrailing
          ? Transform.rotate(
              angle: isExpanded ? 3.14 : 0, // rotate 180 degrees (in radians)
              child: IconButton(
                onPressed: callBack,
                iconSize: 32,
                icon: const Icon(Icons.keyboard_arrow_down_rounded),
              ),
            )
          : null,
    ),
  ).marginAll(8);
}

Widget soldBanner(int? isSold) {
  return Visibility(
    visible: isSold == 1,
    child: Align(
      alignment: Alignment.bottomCenter,
      child: Container(
        width: double.infinity,
        padding: EdgeInsets.all(8),
        margin: EdgeInsets.only(bottom: UIConstants.defaultMargin),
        color: Get.context!.colorScheme.primaryContainer.withAlpha(120),
        child: CommonText.extraBold(
          "SOLD",
          size: 12,
          textAlign: TextAlign.center,
          color: Get.context!.colorScheme.primary,
        ),
      ),
    ),
  );
}
