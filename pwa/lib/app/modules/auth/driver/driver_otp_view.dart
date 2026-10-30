import 'dart:async';

import 'package:car_comfort/app/utils/extensions/extension.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';

import '../../../gen/assets.gen.dart';
import '../../../routes/app_pages.dart';
import '../../../utils/role_switch_signup_flow.dart';
import '../../../widgets/button.dart';
import '../../../widgets/text.dart';
import 'driver_signup_controller.dart';

String _formatOtpResend(int totalSeconds) {
  final m = totalSeconds ~/ 60;
  final s = totalSeconds % 60;
  return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
}

class DriverOtpView extends StatefulWidget {
  const DriverOtpView({super.key});

  @override
  State<DriverOtpView> createState() => _DriverOtpViewState();
}

class _DriverOtpViewState extends State<DriverOtpView> {
  static const _otpResendDurationSeconds = 90;

  late final DriverSignupController controller =
      Get.find<DriverSignupController>();
  late final FocusNode _otpFocusNode = FocusNode();
  late final TextEditingController _otpController = TextEditingController();

  Timer? _otpResendTimer;
  int _otpResendSeconds = _otpResendDurationSeconds;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _startOtpResendCountdown();
      _otpFocusNode.requestFocus();
    });
  }

  void _startOtpResendCountdown() {
    _otpResendTimer?.cancel();
    setState(() => _otpResendSeconds = _otpResendDurationSeconds);
    _otpResendTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_otpResendSeconds <= 1) {
        setState(() => _otpResendSeconds = 0);
        timer.cancel();
      } else {
        setState(() => _otpResendSeconds -= 1);
      }
    });
  }

  void _dismissKeyboard() {
    FocusManager.instance.primaryFocus?.unfocus();
  }

  @override
  void dispose() {
    _otpResendTimer?.cancel();
    _otpFocusNode.dispose();
    _otpController.dispose();
    super.dispose();
  }

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
        backgroundColor: context.colorScheme.scrim,
        resizeToAvoidBottomInset: true,
        body: GestureDetector(
          behavior: HitTestBehavior.translucent,
          onTap: _dismissKeyboard,
          child: Stack(
            fit: StackFit.expand,
            children: [
            Positioned.fill(
              child: Assets.imagesSplashBg.image(fit: BoxFit.cover),
            ),
            Positioned.fill(
              child: Container(
                color: context.colorScheme.scrim.withValues(alpha: 0.28),
              ),
            ),
            SafeArea(
              child: SingleChildScrollView(
                keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                padding: EdgeInsets.only(bottom: keyboardInset + 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SizedBox(
                      height: 122,
                      child: Stack(
                        alignment: Alignment.topCenter,
                        children: [
                          Align(
                            alignment: Alignment.topLeft,
                            child: InkWell(
                              onTap: () => Get.offAllNamed(
                                Routes.BACKGROUND_CHECK,
                              ),
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
                            ],
                          ),
                          Align(
                            alignment: Alignment.topRight,
                            child: InkWell(
                              onTap: () => RoleSwitchSignupFlow.cancelProviderSignup(),
                              borderRadius: BorderRadius.circular(20),
                              child: CommonText.medium(
                                'Cancel Signup',
                                color: Colors.white70,
                                size: 13,
                              ),
                            ),
                          ).paddingOnly(top: 18, right: 4),
                        ],
                      ),
                    ).paddingOnly(top: 18, bottom: 22),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: CommonText.bold(
                        'OTP Verification',
                        color: context.colorScheme.onPrimary,
                        size: 28,
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Please enter the 6-digit code we sent to your email and phone.',
                      style: TextStyle(
                        color: Colors.white70,
                        fontSize: 14,
                        fontWeight: FontWeight.w400,
                        height: 1.35,
                      ),
                    ),
                    const SizedBox(height: 28),
                    _OtpSixBoxes(
                      otpController: _otpController,
                      focusNode: _otpFocusNode,
                      onSubmit: () {
                        if (!controller.isLoading.value) {
                          controller.verifyDriverOtp(_otpController.text);
                        }
                      },
                    ),
                    const SizedBox(height: 20),
                    Builder(
                      builder: (context) {
                        final secs = _otpResendSeconds;
                        final canResend = secs == 0;
                        return Center(
                          child: Material(
                            color: Colors.transparent,
                            child: InkWell(
                              onTap: canResend
                                  ? () async {
                                      final sent =
                                          await controller.onOtpResendTap();
                                      if (!mounted || !sent) return;
                                      _otpController.clear();
                                      _startOtpResendCountdown();
                                    }
                                  : null,
                              borderRadius: BorderRadius.circular(14),
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 22,
                                  vertical: 12,
                                ),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(
                                    color: context.colorScheme.onPrimary,
                                    width: 1.5,
                                  ),
                                ),
                                child: Text(
                                  canResend
                                      ? 'Resend code'
                                      : 'Resend code in ${_formatOtpResend(secs)}',
                                  style: TextStyle(
                                    color: context.colorScheme.onPrimary,
                                    fontSize: 14,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                    const SizedBox(height: 24),
                    Obx(
                      () => AppButton(
                        label: controller.isLoading.value
                            ? 'Please wait...'
                            : 'Continue',
                        onPressed: controller.isLoading.value
                            ? null
                            : () => controller.verifyDriverOtp(
                                  _otpController.text,
                                ),
                        bgColor: const Color(0xffC4101F),
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ).paddingSymmetric(horizontal: 18),
            ),
          ],
        ),
        ),
      ),
    );
  }
}

class _OtpSixBoxes extends StatelessWidget {
  const _OtpSixBoxes({
    required this.otpController,
    required this.focusNode,
    required this.onSubmit,
  });

  final TextEditingController otpController;
  final FocusNode focusNode;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: otpController,
      builder: (context, _) {
        final text = otpController.text;
        final chars = text.split('');

        return GestureDetector(
          onTap: () {
            if (!focusNode.canRequestFocus) return;
            focusNode.requestFocus();
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
                              color: context.colorScheme.scrim.withValues(
                                alpha: 0.18,
                              ),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: context.colorScheme.onPrimary,
                                width: 1.5,
                              ),
                            ),
                            child: Text(
                              hasDigit ? chars[i] : '–',
                              style: TextStyle(
                                color: context.colorScheme.onPrimary,
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
                controller: otpController,
                focusNode: focusNode,
                showCursor: false,
                enableInteractiveSelection: false,
                keyboardType: TextInputType.number,
                textInputAction: TextInputAction.done,
                maxLength: 6,
                onSubmitted: (_) => onSubmit(),
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
