import 'package:car_comfort/app/utils/extensions/extension.dart';
import 'package:car_comfort/app/widgets/button.dart';
import 'package:car_comfort/app/widgets/image.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';

import '../../gen/assets.gen.dart';
import '../../network/response/legal_page_response.dart';
import '../../utils/app_snackbar.dart';
import '../../utils/legal_pages_navigation.dart';
import '../../utils/validator.dart';
import '../../widgets/text.dart';
import '../../widgets/text_field.dart';
import 'auth_controller.dart';
import 'auth_entry_navigation.dart';

class LoginView extends GetView<AuthController> {
  const LoginView({super.key});

  void _goBack() => goBackFromLogin();

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        _goBack();
      },
      child: AnnotatedRegion<SystemUiOverlayStyle>(
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
              children: [
                Positioned.fill(
                  child: Assets.imagesLoginBg.image(fit: BoxFit.cover),
                ),
                Positioned.fill(
                  child: Container(
                    color: context.colorScheme.scrim.withValues(alpha: 0.28),
                  ),
                ),
                SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 18),
                    child: Column(
                      children: [
                        const SizedBox(height: 8),
                        Expanded(
                          child: SingleChildScrollView(
                            child: Form(
                              key: controller.loginFormKey,
                              child: Column(
                                children: [
                                  const SizedBox(height: 58),
                                  Assets.launcherLogo.image(
                                    width: 132,
                                    fit: BoxFit.contain,
                                  ),
                                  const SizedBox(height: 8),
                                  CommonText.medium(
                                    'EV Charging and Car Wash Services',
                                    color: context.colorScheme.onPrimary,
                                    size: 13,
                                  ),
                                  Row(
                                    children: [
                                      InkWell(
                                        onTap: _goBack,
                                        borderRadius: BorderRadius.circular(20),
                                        child: Container(
                                          width: 30,
                                          height: 30,
                                          alignment: Alignment.center,
                                          child: Assets.imagesBack.image(
                                            width: 30,
                                            height: 30,
                                            fit: BoxFit.contain,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ).paddingOnly(bottom: 28),
                                  const Align(
                                    alignment: Alignment.centerLeft,
                                    child: CommonText.regular(
                                      'Hello there,',
                                      color: Colors.white70,
                                      size: 18,
                                    ),
                                  ),
                                  Align(
                                    alignment: Alignment.centerLeft,
                                    child: CommonText.regular(
                                      'Welcome to Car Comfort',
                                      color: context.colorScheme.onPrimary,
                                      size: 28,
                                    ),
                                  ),
                                  const SizedBox(height: 20),
                                  CommonTextField(
                                    controller: controller.emailController,
                                    hintText: 'Email Address',
                                    keyboardType: TextInputType.emailAddress,
                                    validator: (value) =>
                                        validateEmail(value, checkEmpty: true),
                                    suffixIcon: Padding(
                                      padding: const EdgeInsets.only(right: 12),
                                      child: SvgImageFromAsset.square(
                                        Assets.imagesIcEmail,
                                        size: 12,
                                        color: context.colorScheme.onPrimary,
                                      ),
                                    ),
                                    iconConstraints: const BoxConstraints(
                                      minWidth: 36,
                                      minHeight: 36,
                                    ),
                                    autofillHints: [AutofillHints.email],
                                  ),
                                  const SizedBox(height: 12),
                                  Obx(
                                    () => CommonTextField(
                                      controller: controller.passwordController,
                                      hintText: 'Password',
                                      obscure: controller.hidePassword.value,
                                      validator: (value) =>
                                          validatePassword(value),
                                      suffixIcon: InkWell(
                                        onTap: controller.togglePassword,
                                        child: Padding(
                                          padding: const EdgeInsets.only(
                                            right: 12,
                                          ),
                                          child: SvgImageFromAsset.square(
                                            controller.hidePassword.value
                                                ? Assets.imagesIcHide
                                                : Assets.imagesIcShow,
                                            size: 12,
                                            color:
                                                context.colorScheme.onPrimary,
                                          ),
                                        ),
                                      ),
                                      iconConstraints: const BoxConstraints(
                                        minWidth: 36,
                                        minHeight: 36,
                                      ),
                                      autofillHints: [AutofillHints.password],
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Wrap(
                                    alignment: WrapAlignment.spaceBetween,
                                    crossAxisAlignment:
                                        WrapCrossAlignment.center,
                                    runSpacing: 6,
                                    spacing: 48,
                                    children: [
                                      Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Obx(
                                            () => SizedBox(
                                              width: 24,
                                              height: 24,
                                              child: Checkbox(
                                                value:
                                                    controller.rememberMe.value,
                                                onChanged:
                                                    controller.toggleRememberMe,
                                                activeColor:
                                                    context.colorScheme.primary,
                                                checkColor: context
                                                    .colorScheme
                                                    .onPrimary,
                                                side: const BorderSide(
                                                  color: Colors.white70,
                                                ),
                                                materialTapTargetSize:
                                                    MaterialTapTargetSize
                                                        .shrinkWrap,
                                                visualDensity:
                                                    VisualDensity.compact,
                                              ),
                                            ),
                                          ),
                                          const SizedBox(width: 6),
                                          GestureDetector(
                                            onTap: () =>
                                                controller.toggleRememberMe(
                                                  !controller.rememberMe.value,
                                                ),
                                            child: const CommonText.regular(
                                              'Remember me',
                                              color: Colors.white70,
                                              size: 14,
                                            ),
                                          ),
                                        ],
                                      ),
                                      CommonText.medium(
                                        'Forgot Password?',
                                        color: context.colorScheme.onPrimary,
                                        size: 14,
                                        isUnderLine: true,
                                        onTap: controller.forgotPassword,
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 20),
                                  Obx(
                                    () => AppButton(
                                      label: controller.isLoading.value
                                          ? "Please wait..."
                                          : "Login",
                                      onPressed: controller.isLoading.value
                                          ? null
                                          : () {
                                              context.hideKeyboard();
                                              if (controller
                                                  .validateLoginForm()) {
                                                controller.login();
                                              }
                                            },
                                    ),
                                  ),
                                  const SizedBox(height: 10),
                                  Row(
                                    spacing: 8,
                                    children: [
                                      Expanded(child: Divider(height: 2)),
                                      const CommonText.regular(
                                        'Or continue with',
                                        color: Colors.white70,
                                        size: 12,
                                      ),
                                      Expanded(child: Divider(height: 2)),
                                    ],
                                  ),
                                  const SizedBox(height: 10),
                                  Obx(
                                    () => IgnorePointer(
                                      ignoring:
                                          controller.isSocialLoading.value,
                                      child: Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.center,
                                        children: [
                                          _SocialButton(
                                            icon: Assets.imagesGoogle,
                                            onTap: controller.signInWithGoogle,
                                          ),
                                          if (!GetPlatform.isAndroid) ...[
                                            const SizedBox(width: 14),
                                            _SocialButton(
                                              icon: Assets.imagesApple,
                                              onTap: controller.signInWithApple,
                                            ),
                                          ],
                                          const SizedBox(width: 14),
                                          _SocialButton(
                                            icon: Assets.imagesFacebook,
                                            // onTap: controller.signInWithFacebook,
                                            onTap: () => showAppSnackBar(
                                              title: 'Social',
                                              message: 'Coming Soon',
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                  Obx(
                                    () => controller.isSocialLoading.value
                                        ? const Padding(
                                            padding: EdgeInsets.only(top: 10),
                                            child: SizedBox(
                                              width: 18,
                                              height: 18,
                                              child: CircularProgressIndicator(
                                                strokeWidth: 2,
                                                color: Colors.white,
                                              ),
                                            ),
                                          )
                                        : const SizedBox.shrink(),
                                  ),
                                  const SizedBox(height: 16),
                                  RichText(
                                    textAlign: TextAlign.center,
                                    text: TextSpan(
                                      style: const TextStyle(
                                        color: Colors.white70,
                                        fontSize: 12,
                                        fontWeight: FontWeight.w400,
                                      ),
                                      children: [
                                        const TextSpan(
                                          text:
                                              'Continue with Google, Apple or Facebook, you agree to Car Comfort ',
                                        ),
                                        TextSpan(
                                          text: 'Terms and Conditions',
                                          style: TextStyle(
                                            color: context
                                                .colorScheme
                                                .primaryContainer,
                                            fontSize: 14,
                                            fontWeight: FontWeight.w700,
                                            decoration:
                                                TextDecoration.underline,
                                          ),
                                          recognizer: TapGestureRecognizer()
                                            ..onTap = () =>
                                                LegalPagesNavigation.openBySlug(
                                                  LegalPageQuery
                                                      .termsConditions,
                                                  audience:
                                                      LegalAudience.customer,
                                                ),
                                        ),
                                        TextSpan(
                                          text: ' & ',
                                          style: TextStyle(
                                            color: context
                                                .colorScheme
                                                .primaryContainer,
                                            fontSize: 14,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                        TextSpan(
                                          text: 'Privacy Policy',
                                          style: TextStyle(
                                            color: context
                                                .colorScheme
                                                .primaryContainer,
                                            fontSize: 14,
                                            fontWeight: FontWeight.w700,
                                            decoration:
                                                TextDecoration.underline,
                                          ),
                                          recognizer: TapGestureRecognizer()
                                            ..onTap = () =>
                                                LegalPagesNavigation.openBySlug(
                                                  LegalPageQuery.privacyPolicy,
                                                  audience:
                                                      LegalAudience.customer,
                                                ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(height: 10),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      const CommonText.regular(
                                        'Not a member?',
                                        color: Colors.white70,
                                        size: 14,
                                      ),
                                      CommonText.medium(
                                        'Sign up now',
                                        color: context.colorScheme.onPrimary,
                                        size: 14,
                                        isUnderLine: true,
                                        onTap: controller.openSignupFromLogin,
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 10),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SocialButton extends StatelessWidget {
  final AssetGenImage icon;
  final VoidCallback onTap;

  const _SocialButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        width: 52,
        height: 52,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white70),
        ),
        child: icon.image(width: 24, height: 24, fit: BoxFit.contain),
      ),
    );
  }
}
