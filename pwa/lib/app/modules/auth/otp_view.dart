import 'package:car_comfort/app/utils/extensions/extension.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';

import '../../gen/assets.gen.dart';
import '../../widgets/button.dart';
import '../../widgets/text.dart';
import '../../utils/role_switch_signup_flow.dart';
import 'auth_controller.dart';

import 'widgets/auth_responsive_layout.dart';

String _formatOtpResend(int totalSeconds) {
  final m = totalSeconds ~/ 60;
  final s = totalSeconds % 60;
  return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
}

String _otpInstructionLine(AuthController controller) {
  if (controller.otpFlow.value == 'emailVerification') {
    final email = controller.verificationEmail.value.trim();
    if (email.isNotEmpty) {
      return 'Please enter 6-digit code we have sent to $email';
    }
  }
  final phone = controller.forgotPhoneController.text.trim();
  final email = controller.forgotEmailController.text.trim();
  if (phone.isNotEmpty) {
    return 'Please enter 6-digit code we have sent you on your phone ${controller.forgotDialCode.value}$phone';
  }
  if (email.isNotEmpty) {
    return 'Please enter 6-digit code we have sent to $email';
  }
  return 'Please enter 6-digit code we have sent you';
}

class OtpView extends GetView<AuthController> {
  const OtpView({super.key});

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
        backgroundColor: Colors.black,
        resizeToAvoidBottomInset: true,
        body: GestureDetector(
          behavior: HitTestBehavior.translucent,
          onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
          child: Stack(
            children: [
              AuthResponsiveLayout(
                onBack: () => RoleSwitchSignupFlow.handleSignupBack(),
                bgImage: Assets.imagesSplashBg,
                scrimOpacity: 0.28,
                headerWidget: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SizedBox(
                      height: 122,
                      child: Stack(
                        alignment: Alignment.topCenter,
                        children: [
                          Align(
                            alignment: Alignment.topLeft,
                            child: InkWell(
                              onTap: () =>
                                  RoleSwitchSignupFlow.handleSignupBack(),
                              borderRadius: BorderRadius.circular(20),
                              child: Assets.imagesBack.image(
                                width: 26,
                                height: 26,
                                fit: BoxFit.contain,
                              ),
                            ),
                          ).paddingOnly(top: 18),
                          Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Assets.launcherLogo.image(
                                width: 120,
                                fit: BoxFit.contain,
                              ),
                              const SizedBox(height: 6),
                              const CommonText.regular(
                                'Car Comfort',
                                color: Colors.white,
                                size: 15,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ).paddingOnly(top: 18, bottom: 22),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Align(
                      alignment: Alignment.centerLeft,
                      child: CommonText.bold(
                        'OTP Verification',
                        color: Colors.white,
                        size: 28,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Obx(
                      () => Text(
                        _otpInstructionLine(controller),
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 14,
                          fontWeight: FontWeight.w400,
                          height: 1.35,
                        ),
                      ),
                    ),
                    const SizedBox(height: 28),
                    _OtpSixBoxes(controller: controller),
                    const SizedBox(height: 20),
                    Obx(() {
                      final secs = controller.otpResendSeconds.value;
                      final canResend = secs == 0;
                      return Center(
                        child: Material(
                          color: Colors.transparent,
                          child: InkWell(
                            onTap: canResend ? controller.onOtpResendTap : null,
                            borderRadius: BorderRadius.circular(14),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 22,
                                vertical: 12,
                              ),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(
                                  color: Colors.white70,
                                  width: 1.5,
                                ),
                              ),
                              child: Text(
                                canResend
                                    ? 'Resend code'
                                    : 'Resend code in ${_formatOtpResend(secs)}',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ),
                        ),
                      );
                    }),
                    const SizedBox(height: 24),
                    Obx(
                      () => AppButton(
                        label: controller.isLoading.value
                            ? 'Please wait...'
                            : 'Continue',
                        onPressed: controller.isLoading.value
                            ? null
                            : controller.verifyOtp,
                        bgColor: const Color(0xffC4101F),
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],
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

class _OtpSixBoxes extends StatelessWidget {
  const _OtpSixBoxes({required this.controller});

  final AuthController controller;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: controller.otpController,
      builder: (context, _) {
        final text = controller.otpController.text;
        final chars = text.split('');

        return GestureDetector(
          onTap: () {
            FocusScope.of(context).requestFocus(controller.otpFocusNode);
          },
          behavior: HitTestBehavior.opaque,
          child: Stack(
            alignment: Alignment.center,
            children: [
              IgnorePointer(
                child: Row(
                  children: List.generate(6, (i) {
                    final hasDigit = i < chars.length;
                    return Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: AspectRatio(
                          aspectRatio: 1,
                          child: Container(
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: Colors.black.withValues(alpha: 0.18),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: Colors.white70,
                                width: 1.5,
                              ),
                            ),
                            child: Text(
                              hasDigit ? chars[i] : '–',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 22,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ),
                      ),
                    );
                  }),
                ),
              ),
              TextField(
                controller: controller.otpController,
                focusNode: controller.otpFocusNode,
                autofocus: true,
                showCursor: false,
                enableInteractiveSelection: false,
                keyboardType: TextInputType.number,
                textInputAction: TextInputAction.done,
                maxLength: 6,
                onSubmitted: (_) {
                  if (!controller.isLoading.value) {
                    controller.verifyOtp();
                  }
                },
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(6),
                ],
                style: const TextStyle(color: Colors.transparent, fontSize: 16),
                decoration: const InputDecoration(
                  counterText: '',
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.zero,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
