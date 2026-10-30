import 'package:car_comfort/app/utils/extensions/extension.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';

import '../../gen/assets.gen.dart';
import '../../utils/validator.dart';
import '../../widgets/button.dart';
import '../../widgets/image.dart';
import '../../widgets/text.dart';
import '../../widgets/text_field.dart';
import 'auth_controller.dart';

class ResetPasswordView extends GetView<AuthController> {
  const ResetPasswordView({super.key});

  @override
  Widget build(BuildContext context) {
    final keyboardInset = MediaQuery.viewInsetsOf(context).bottom;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(
        systemNavigationBarIconBrightness: Brightness.light,
        systemNavigationBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
        statusBarColor: Colors.transparent,
      ),
      child: Scaffold(
        resizeToAvoidBottomInset: false,
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
                  color: context.colorScheme.scrim.withValues(alpha: 0.34),
                ),
              ),
              SafeArea(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 18),
                  child: SingleChildScrollView(
                    keyboardDismissBehavior:
                        ScrollViewKeyboardDismissBehavior.onDrag,
                    padding: EdgeInsets.only(bottom: keyboardInset + 20),
                    child: Form(
                      key: controller.resetPasswordFormKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const SizedBox(height: 12),
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
                            ],
                          ).paddingOnly(bottom: 32),
                          CommonText.regular(
                            'Reset Password',
                            color: context.colorScheme.onPrimary,
                            size: 29,
                          ),
                          const SizedBox(height: 10),
                          const CommonText.regular(
                            'Set your new password and confirm it to continue.',
                            color: Colors.white70,
                            size: 14,
                          ),
                          const SizedBox(height: 20),
                          Obx(
                            () => CommonTextField(
                              controller: controller.passwordController,
                              hintText: 'New Password',
                              obscure: controller.hidePassword.value,
                              validator: (value) =>
                                  validatePassword(value, checkRegex: true),
                              textColor: context.colorScheme.onPrimary,
                              cursorColor: context.colorScheme.onPrimary,
                              hintColor: Colors.white70,
                              bgColor: Colors.black.withValues(alpha: 0.2),
                              borderRadius: 20,
                              padding: 12,
                              suffixIcon: InkWell(
                                onTap: controller.togglePassword,
                                child: Padding(
                                  padding: const EdgeInsets.only(right: 12),
                                  child: SvgImageFromAsset.square(
                                    controller.hidePassword.value
                                        ? Assets.imagesIcHide
                                        : Assets.imagesIcShow,
                                    size: 12,
                                    color: context.colorScheme.onPrimary,
                                  ),
                                ),
                              ),
                              iconConstraints: const BoxConstraints(
                                minWidth: 36,
                                minHeight: 36,
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),
                          Obx(
                            () => CommonTextField(
                              controller: controller.confirmPasswordController,
                              hintText: 'Confirm Password',
                              obscure: controller.hideConfirmPassword.value,
                              validator: (value) => validateConfirmPassword(
                                value,
                                controller.passwordController.text,
                              ),
                              textColor: context.colorScheme.onPrimary,
                              cursorColor: context.colorScheme.onPrimary,
                              hintColor: Colors.white70,
                              bgColor: Colors.black.withValues(alpha: 0.2),
                              borderRadius: 20,
                              padding: 12,
                              suffixIcon: InkWell(
                                onTap: controller.toggleConfirmPassword,
                                child: Padding(
                                  padding: const EdgeInsets.only(right: 12),
                                  child: SvgImageFromAsset.square(
                                    controller.hideConfirmPassword.value
                                        ? Assets.imagesIcHide
                                        : Assets.imagesIcShow,
                                    size: 12,
                                    color: context.colorScheme.onPrimary,
                                  ),
                                ),
                              ),
                              iconConstraints: const BoxConstraints(
                                minWidth: 36,
                                minHeight: 36,
                              ),
                            ),
                          ),
                          const SizedBox(height: 28),
                          Obx(
                            () => AppButton(
                              label: controller.isLoading.value
                                  ? 'Please wait...'
                                  : 'Continue',
                              onPressed: controller.isLoading.value
                                  ? null
                                  : controller.resetPassword,
                              bgColor: const Color(0xffF2051F),
                              btnCornerRadius: 14,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              Obx(
                () => controller.isLoading.value
                    ? Positioned.fill(
                        child: IgnorePointer(
                          child: Container(
                            color: Colors.black.withValues(alpha: 0.22),
                            alignment: Alignment.center,
                            child: const SizedBox(
                              width: 30,
                              height: 30,
                              child: CircularProgressIndicator(
                                strokeWidth: 3,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ),
                      )
                    : const SizedBox.shrink(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
