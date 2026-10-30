import 'package:car_comfort/app/utils/extensions/extension.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';

import '../../../gen/assets.gen.dart';
import '../../../routes/app_pages.dart';
import '../../../utils/role_switch_signup_flow.dart';
import '../auth_entry_navigation.dart';
import '../../../widgets/button.dart';
import '../../../widgets/text.dart';
import '../../../widgets/upload_image_slot.dart';
import 'driver_signup_controller.dart';

class UploadInsuranceCardView extends GetView<DriverSignupController> {
  const UploadInsuranceCardView({super.key});

  @override
  Widget build(BuildContext context) {
    final onPrimary = context.colorScheme.onPrimary;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(
        systemNavigationBarIconBrightness: Brightness.light,
        systemNavigationBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
        statusBarColor: Colors.transparent,
      ),
      child: Scaffold(
        resizeToAvoidBottomInset: true,
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
                  child: LayoutBuilder(
                    builder: (context, constraints) {
                      final keyboardBottom = MediaQuery.viewInsetsOf(
                        context,
                      ).bottom;
                      return SingleChildScrollView(
                        keyboardDismissBehavior:
                            ScrollViewKeyboardDismissBehavior.onDrag,
                        padding: EdgeInsets.only(bottom: 12 + keyboardBottom),
                        child: ConstrainedBox(
                          constraints: BoxConstraints(
                            minHeight: constraints.maxHeight,
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Column(
                                mainAxisSize: MainAxisSize.min,
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
                                          borderRadius: BorderRadius.circular(
                                            20,
                                          ),
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
                                    ],
                                  ).paddingOnly(bottom: 28),
                                  CommonText.bold(
                                    'Upload Photo of Insurance Card',
                                    color: onPrimary,
                                    size: 16,
                                  ),
                                  const SizedBox(height: 16),
                                  Obx(
                                    () => UploadImageSlot(
                                      imagePath: controller
                                          .insuranceCardFrontPath
                                          .value,
                                      placeholderLabel: 'Upload Front Image',
                                      onUploadTap: () =>
                                          controller.pickInsuranceCardSide(
                                            context,
                                            isFront: true,
                                          ),
                                    ),
                                  ),
                                  const SizedBox(height: 16),
                                  Obx(
                                    () => UploadImageSlot(
                                      imagePath: controller
                                          .insuranceCardBackPath
                                          .value,
                                      placeholderLabel: 'Upload Back Image',
                                      onUploadTap: () =>
                                          controller.pickInsuranceCardSide(
                                            context,
                                            isFront: false,
                                          ),
                                    ),
                                  ),
                                  const SizedBox(height: 24),
                                ],
                              ),
                              Column(
                                mainAxisSize: MainAxisSize.min,
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  Obx(
                                    () => AppButton(
                                      label: controller.isLoading.value
                                          ? 'Please wait...'
                                          : 'Next',
                                      onPressed: controller.isLoading.value
                                          ? null
                                          : controller.completeInsuranceCardUpload,
                                      bgColor: const Color(0xffF2051F),
                                      btnCornerRadius: 14,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
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
                                          onTap: () =>
                                              openLoginForRole('driver'),
                                        ),
                                      ],
                                    ),
                                  const SizedBox(height: 12),
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    },
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
