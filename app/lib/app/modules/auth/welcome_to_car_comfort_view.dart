import 'package:car_comfort/app/widgets/widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';
import '../../gen/assets.gen.dart';
import '../../routes/app_pages.dart';
import '../../utils/extensions/extension.dart';
import '../../widgets/button.dart';
import '../../widgets/logo_widget.dart';
import '../../widgets/text.dart';

class WelcomeToCarComfortView extends StatelessWidget {
  const WelcomeToCarComfortView({super.key});
  @override
  Widget build(BuildContext context) {
    final scheme = context.colorScheme;
    final primaryRed = scheme.primary;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(
        systemNavigationBarIconBrightness: Brightness.light,
        systemNavigationBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
        statusBarColor: Colors.transparent,
      ),
      child: Scaffold(
        backgroundColor: scheme.scrim,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                LogoWidget().paddingOnly(
                  bottom: 18,
                  left: 24,
                  right: 24,
                  top: 32,
                ),
                CommonText.extraBold(
                  'Welcome to Car Comfort',
                  color: scheme.onPrimary,
                  size: 18,
                  textAlign: TextAlign.center,
                ).paddingOnly(bottom: 8),
                CommonText.regular(
                  'EV Charging and Car Wash Services',
                  color: scheme.outlineVariant,
                  size: 14,
                  textAlign: TextAlign.center,
                ).paddingOnly(bottom: 68),
                Container(
                  width: 100,
                  height: 100,
                  decoration: BoxDecoration(
                    color: primaryRed,
                    shape: BoxShape.circle,
                  ),
                  padding: const EdgeInsets.all(28),
                  child: Assets.imagesDone.image(
                    fit: BoxFit.contain,
                    scale: 20,
                  ),
                ).paddingOnly(bottom: 18),
                CommonText.regular(
                  "You're all set! Let's get started with your first service.",
                  color: scheme.outlineVariant,
                  size: 14,
                  textAlign: TextAlign.center,
                ),
                spacer(),
                AppButton(
                  label: 'Get Started',
                  onPressed: () => Get.offAllNamed(Routes.TUTORIAL),
                  bgColor: primaryRed,
                  txtColor: scheme.onPrimary,
                  btnCornerRadius: 14,
                ).paddingOnly(bottom: 28),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
