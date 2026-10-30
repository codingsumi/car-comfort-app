import 'dart:async';
import 'dart:developer' as dev;

import 'package:car_comfort/app/utils/pref.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../services/onesignal_service.dart';

import '../constants/ui_constants.dart';
import '../gen/assets.gen.dart';
import '../network/utils/network_exception.dart';
import '../utils/extensions/extension.dart';
import 'session_auth_helper.dart';
import '../widgets/button.dart';
import '../widgets/text.dart';

void log(String runtimeType, String msg) {
  if (kDebugMode) {
    dev.log(msg, name: runtimeType.toString().toUpperCase());
  }
}

enum AlertType { success, error, info, processing }

void showAlertDialog(
  String? title, {
  String? content,
  String? primaryText,
  bool? primaryTextItalic,
  String? secondaryText,
  bool? showSecondary,
  bool? showPrimary,
  bool? canDismiss,
  VoidCallback? primaryClick,
  VoidCallback? secondaryClick,
  AlertType? alertType,
  Color? primaryBtnClr,
  Color? primaryBtnTextClr,
  Widget? contentWidget,
  double? buttonTextSize,
}) {
  Color? primaryBtnColor;
  Color? primaryTextColor;
  Color? secondaryBtnColor;
  Color? secondaryTextColor;

  switch (alertType ?? AlertType.success) {
    case AlertType.success:
      {
        primaryTextColor = Get.context!.colorScheme.onPrimary;
        primaryBtnColor = Get.context!.colorScheme.primary;
        secondaryBtnColor = Get.context!.colorScheme.secondary;
        secondaryTextColor = Get.context!.colorScheme.onSecondary;
      }
    case AlertType.error:
      {
        primaryBtnColor = Get.context!.colorScheme.primary;
        primaryTextColor = Get.context!.colorScheme.onPrimary;
        secondaryBtnColor = Get.context!.colorScheme.secondary;
        secondaryTextColor = Get.context!.colorScheme.onSecondary;
      }
    case AlertType.info:
      {
        primaryBtnColor = Get.context!.colorScheme.primary;
        primaryTextColor = Get.context!.colorScheme.onPrimary;
        secondaryBtnColor = Get.context!.colorScheme.secondary;
        secondaryTextColor = Get.context!.colorScheme.onSecondary;
      }
    case AlertType.processing:
      {
        showSecondary = false;
        showPrimary = false;
      }
  }

  Get.dialog(
    PopScope(
      canPop: canDismiss ?? false,
      child: Align(
        alignment: Alignment.center,
        child: Dialog(
          insetPadding: EdgeInsets.all(UIConstants.margin32),
          backgroundColor: Colors.transparent,
          child: Wrap(
            children: [
              Stack(
                children: [
                  Container(
                    margin: EdgeInsets.only(top: UIConstants.margin36),
                    padding: EdgeInsets.only(top: UIConstants.margin36),
                    decoration: BoxDecoration(color: Get.context?.colorScheme.onPrimary, borderRadius: BorderRadius.circular(UIConstants.defaultRadius)),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Visibility(
                          visible: title?.isNullOrEmpty == false,
                          child: Flexible(
                            child: CommonText.bold(
                              title ?? "",
                              size: 18,
                              textAlign: TextAlign.center,
                            ).marginOnly(bottom: content?.isNullOrEmpty == false ? 16 : 0),
                          ),
                        ),
                        Visibility(
                          visible: content?.isNullOrEmpty == false || contentWidget != null,
                          child: Flexible(child: contentWidget ?? CommonText.medium(content ?? "", textAlign: TextAlign.center).marginOnly(bottom: 16)),
                        ),
                        Row(
                          spacing: 8,
                          children: [
                            Visibility(
                              visible: showSecondary ?? true,
                              child: Expanded(
                                child: Wrap(
                                  alignment: WrapAlignment.center,
                                  children: [
                                    AppButton(
                                      vPadding: 12,
                                      hPadding: (showPrimary ?? true) ? 4 : 48,
                                      textSize: buttonTextSize,
                                      bgColor: secondaryBtnColor ?? primaryBtnColor,
                                      txtColor: secondaryTextColor ?? primaryTextColor,
                                      btnCornerRadius: 12,
                                      isMax: showPrimary ?? true,
                                      onPressed:
                                          secondaryClick ??
                                          () {
                                            Get.back();
                                          },
                                      isItalic: primaryTextItalic ?? false,
                                      label: secondaryText ?? 'Cancel',
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            Visibility(
                              visible: showPrimary ?? true,
                              child: Expanded(
                                child: Wrap(
                                  alignment: WrapAlignment.center,
                                  children: [
                                    AppButton(
                                      vPadding: 12,
                                      hPadding: (showSecondary ?? true) ? 4 : 48,
                                      textSize: buttonTextSize,
                                      bgColor: primaryBtnClr ?? primaryBtnColor,
                                      txtColor: primaryBtnTextClr ?? primaryTextColor,
                                      btnCornerRadius: 12,
                                      isMax: showSecondary ?? true,
                                      onPressed:
                                          primaryClick ??
                                          () {
                                            Get.back();
                                          },
                                      isItalic: primaryTextItalic ?? false,
                                      label: primaryText ?? 'Okay',
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ).marginOnly(top: 8),
                      ],
                    ).paddingAll(18),
                  ),
                  Align(
                    alignment: Alignment.topCenter,
                    child: Card(
                      elevation: 4,
                      shadowColor: Get.context?.colorScheme.outline.withValues(alpha: 0.3),
                      margin: EdgeInsets.zero,
                      color: Get.context?.colorScheme.onPrimary,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(100), // Circular shape
                      ),
                      clipBehavior: Clip.hardEdge,
                      child: getAlertIcon(alertType ?? AlertType.success, Get.context as BuildContext),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    ),
    barrierDismissible: canDismiss ?? false,
  );
}

Widget getAlertIcon(AlertType alertType, BuildContext context) {
  switch (alertType) {
    case AlertType.success:
      return Container(
        alignment: Alignment.center,
        height: 80,
        width: 80,
        decoration: BoxDecoration(color: context.colorScheme.onPrimary, shape: BoxShape.circle),
        child: Container(
          height: 50,
          width: 50,
          decoration: BoxDecoration(color: context.colorScheme.primary, shape: BoxShape.circle),
          //ADD SUCCESS ICON HERE
          child: Assets.launcherLogo.image(color: context.colorScheme.onPrimary, height: 28, width: 28).paddingAll(18),
        ),
      );
    case AlertType.error:
      return Container(
        padding: const EdgeInsets.all(8),
        alignment: Alignment.center,
        height: 80,
        width: 80,
        decoration: BoxDecoration(color: context.colorScheme.onPrimary, shape: BoxShape.circle),
        child: Container(
          height: 56,
          width: 56,
          decoration: BoxDecoration(color: context.colorScheme.errorContainer, shape: BoxShape.circle),
          //ADD ERROR ICON HERE
          child: Assets.launcherLogo.image(color: context.colorScheme.onPrimary, height: 28, width: 28).paddingAll(8),
        ),
      );
    case AlertType.info:
      return Container(
        padding: const EdgeInsets.all(8),
        alignment: Alignment.center,
        height: 80,
        width: 80,
        decoration: BoxDecoration(color: context.colorScheme.onPrimary, shape: BoxShape.circle),
        child: Container(
          height: 56,
          width: 56,
          decoration: BoxDecoration(color: context.colorScheme.primaryContainer, shape: BoxShape.circle),
          //ADD INFO ICON HERE
          child: Assets.launcherLogo.image(color: context.colorScheme.onPrimary, height: 28, width: 28).paddingAll(8),
        ),
      );
    case AlertType.processing:
      return Container(
        padding: const EdgeInsets.all(8),
        alignment: Alignment.center,
        height: 80,
        width: 80,
        decoration: BoxDecoration(color: context.colorScheme.onPrimary, shape: BoxShape.circle),
        child: SizedBox(
          height: 50,
          width: 50,
          child: CircularProgressIndicator(color: context.colorScheme.primary, strokeWidth: 5, backgroundColor: context.colorScheme.primaryContainer),
        ),
      );
  }
}

void showAPIErrorDialog(NetworkException error, {VoidCallback? onClicked}) {
  if (Get.isDialogOpen == false) {
    showAlertDialog(
      "Error",
      content: error.message,
      showSecondary: false,
      canDismiss: false,
      alertType: AlertType.error,
      primaryClick:
          onClicked ??
          () {
            if (error.errBody?.type == "invalid_token" || error.errBody?.type == "expired_token" || error.message == "Token not found") {
              unawaited((() async {
                await OneSignalService.logout();
                await Prefs().clear();
              })().catchError((Object e) {
                debugPrint('Alerts: logout/clear failed: $e');
              }));
              // Get.offAllNamed(Routes.AUTH);
            } else {
              Get.back();
            }
          },
    );
  }
}
