import 'package:car_comfort/app/utils/extensions/extension.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';

import '../../gen/assets.gen.dart';
import '../../widgets/text.dart';
import 'splash_controller.dart';

class SplashView extends GetView<SplashController> {
  const SplashView({super.key});
  @override
  Widget build(BuildContext context) {
    controller;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(
        systemNavigationBarIconBrightness: Brightness.light,
        systemNavigationBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
        statusBarColor: Colors.transparent,
      ),
      child: Scaffold(
        // extendBody ensures the splash background fills behind the nav bar
        extendBody: true,
        extendBodyBehindAppBar: true,
        body: Stack(
          fit: StackFit.expand,
          children: [
            Assets.imagesSplashBg.image(fit: BoxFit.cover),
            Center(
              child: Assets.launcherLogo.image(width: 180, fit: BoxFit.contain),
            ),
            Positioned(
              // Respect nav bar inset so text is never hidden behind gesture bar
              bottom: MediaQuery.viewPaddingOf(context).bottom + 24,
              left: 20,
              right: 20,
              child: const CommonText.medium(
                'America’s first on-demand valet EV charging and car wash service provider, created to save you time and provide convenience without interrupting your daily schedules.',
                textAlign: TextAlign.center,
                size: 12,
                color: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
