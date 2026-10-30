import 'package:car_comfort/app/utils/extensions/extension.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';

import '../../../gen/assets.gen.dart';
import '../../../utils/role_switch_signup_flow.dart';
import '../auth_entry_navigation.dart';
import '../../../widgets/button.dart';
import '../../../widgets/text.dart';
import 'driver_signup_controller.dart';

class BackgroundCheckView extends StatefulWidget {
  const BackgroundCheckView({super.key});

  @override
  State<BackgroundCheckView> createState() => _BackgroundCheckViewState();
}

class _BackgroundCheckViewState extends State<BackgroundCheckView> {
  late final DriverSignupController controller =
      Get.find<DriverSignupController>();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      controller.loadBackgroundCheckLegalPage(force: true);
    });
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(
        systemNavigationBarIconBrightness: Brightness.light,
        systemNavigationBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
        statusBarColor: Colors.transparent,
      ),
      child: Scaffold(
        body: GestureDetector(
          behavior: HitTestBehavior.translucent,
          onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
          child: Stack(
            fit: StackFit.expand,
            children: [
              Positioned.fill(
                child: Assets.imagesSignupBg.image(fit: BoxFit.fill),
              ),
              Positioned.fill(
                child: Container(
                  color: context.colorScheme.scrim.withValues(alpha: 0.2),
                ),
              ),
              SafeArea(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const SizedBox(height: 8),
                        Stack(
                          alignment: Alignment.center,
                          children: [
                            Align(
                              alignment: Alignment.centerLeft,
                              child: InkWell(
                                onTap: () => Get.back(),
                                borderRadius: BorderRadius.circular(20),
                                child: Assets.imagesBack.image(
                                  width: 26,
                                  height: 26,
                                  fit: BoxFit.contain,
                                ),
                              ),
                            ),
                            Assets.launcherLogo.image(
                              width: 120,
                              fit: BoxFit.contain,
                            ),
                            Align(
                              alignment: Alignment.centerRight,
                              child: InkWell(
                                onTap: () => RoleSwitchSignupFlow.cancelProviderSignup(),
                                borderRadius: BorderRadius.circular(20),
                                child: CommonText.medium(
                                  'Cancel Signup',
                                  color: Colors.white70,
                                  size: 13,
                                ),
                              ),
                            ),
                          ],
                        ).paddingOnly(bottom: 12),
                        CommonText.regular(
                          'Background Check Authorization',
                          color: context.colorScheme.onPrimary,
                          size: 22,
                        ).paddingOnly(bottom: 4),
                        CommonText.regular(
                          'Download the form, complete and sign it, then upload the signed PDF.',
                          color: context.colorScheme.onPrimary.withValues(
                            alpha: 0.75,
                          ),
                          size: 13,
                        ).paddingOnly(bottom: 20),
                        Obx(() {
                          if (controller.backgroundCheckLegalLoading.value) {
                            return const Padding(
                              padding: EdgeInsets.symmetric(vertical: 32),
                              child: Center(
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              ),
                            );
                          }
                          final hasPdf = (controller.backgroundCheckPdfUrl.value?.trim().isNotEmpty ?? false);
                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              if (!hasPdf)
                                CommonText.regular(
                                  'The authorization form is not available yet. Your admin must upload the PDF in Legal Pages.',
                                  color: context.colorScheme.onPrimary
                                      .withValues(alpha: 0.75),
                                  size: 13,
                                ).paddingOnly(bottom: 12),
                              Obx(
                                () => AppButton(
                                  label: controller
                                          .backgroundCheckDownloading.value
                                      ? 'Downloading form...'
                                      : 'Download authorization form (PDF)',
                                  onPressed: hasPdf && !controller.backgroundCheckDownloading.value
                                      ? controller.downloadBackgroundCheckForm
                                      : null,
                                  type: ButtonType.outline,
                                  txtColor: Colors.white,
                                  borderColor: Colors.white,
                                  btnCornerRadius: 50,
                                ),
                              ),
                              Obx(() {
                                if (!controller
                                    .backgroundCheckFormDownloaded.value) {
                                  return CommonText.regular(
                                    'Download the form above before uploading your signed PDF.',
                                    color: context.colorScheme.onPrimary
                                        .withValues(alpha: 0.65),
                                    size: 12,
                                  ).paddingOnly(top: 8, bottom: 4);
                                }
                                return Column(
                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                  children: [
                                    CommonText.regular(
                                      'Form downloaded successfully. Complete and sign it, then upload below.',
                                      color: context.colorScheme.onPrimary
                                          .withValues(alpha: 0.85),
                                      size: 12,
                                    ),
                                  ],
                                ).paddingOnly(top: 8, bottom: 4);
                              }),
                              const SizedBox(height: 8),
                              Obx(
                                () {
                                  final canUpload = controller
                                      .backgroundCheckFormDownloaded.value;
                                  final fileName =
                                      controller.signedFormName.value?.trim();
                                  return Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.stretch,
                                    children: [
                                      AppButton(
                                        label: "Upload signed PDF",
                                        type: ButtonType.outline,
                                        txtColor: Colors.white,
                                        borderColor: Colors.white,
                                        btnCornerRadius: 50,
                                        onPressed: canUpload
                                            ? controller
                                                .pickSignedBackgroundCheckForm
                                            : null,
                                        trailingIcon: Icon(
                                          Icons.upload_file,
                                          color: canUpload
                                              ? Colors.white
                                              : Colors.white38,
                                          size: 20,
                                        ),
                                      ),
                                      if (fileName != null &&
                                          fileName.isNotEmpty)
                                        CommonText.regular(
                                          'Selected: $fileName',
                                          color: context.colorScheme.onPrimary
                                              .withValues(alpha: 0.85),
                                          size: 12,
                                        ).paddingOnly(top: 8),
                                    ],
                                  );
                                },
                              ),
                            ],
                          );
                        }),
                        const SizedBox(height: 20),
                        Obx(
                          () => AppButton(
                            label: controller.isLoading.value
                                ? 'Please wait...'
                                : 'Continue',
                            onPressed: controller.isLoading.value
                                ? null
                                : controller.continueBackgroundCheck,
                            bgColor: const Color(0xffF2051F),
                            btnCornerRadius: 14,
                          ),
                        ),
                        const SizedBox(height: 12),
                        if (!RoleSwitchSignupFlow.isActive)
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const CommonText.regular(
                                'Already a member? ',
                                color: Colors.white70,
                                size: 14,
                              ),
                              CommonText.medium(
                                'Login',
                                color: context.colorScheme.onPrimary,
                                size: 14,
                                onTap: () => openLoginForRole('driver'),
                              ),
                            ],
                          ),
                        const SizedBox(height: 8),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
