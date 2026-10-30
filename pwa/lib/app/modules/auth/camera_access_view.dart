import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../gen/assets.gen.dart';
import '../../routes/app_pages.dart';
import '../../utils/extensions/extension.dart';
import '../../widgets/button.dart';
import '../../widgets/logo_widget.dart';
import '../../widgets/text.dart';

/// Shown after [TutorialView]. Uses `assets/images/camera_access.png`.
class CameraAccessView extends StatelessWidget {
  const CameraAccessView({super.key});

  static const _horizontalPadding = 32.0;

  Future<void> _allowCamera() async {
    await Permission.camera.request();
    Get.offAllNamed(Routes.LOCATION_ACCESS);
  }

  void _skip() => Get.offAllNamed(Routes.LOCATION_ACCESS);

  @override
  Widget build(BuildContext context) {
    final scheme = context.colorScheme;
    final primaryRed = scheme.primary;
    final bottomInset = MediaQuery.paddingOf(context).bottom;

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
            padding: EdgeInsets.fromLTRB(
              _horizontalPadding,
              20,
              _horizontalPadding,
              bottomInset + 24,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: SingleChildScrollView(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        LogoWidget().paddingOnly(bottom: 24),
                        CommonText.bold(
                          'Enable Camera Access',
                          color: scheme.onPrimary,
                          size: 18,
                          textAlign: TextAlign.center,
                        ).paddingOnly(bottom: 20),
                        CommonText.regular(
                          'We need your Camera to:',
                          color: scheme.outlineVariant,
                          size: 14,
                          textAlign: TextAlign.center,
                        ).paddingOnly(bottom: 68),
                        CommonText.regular(
                          'Connect you with nearby service providers',
                          color: scheme.onPrimary,
                          size: 14,
                          textAlign: TextAlign.center,
                        ).paddingOnly(bottom: 4),
                        CommonText.regular(
                          'Show real-time provider location and ETA',
                          color: scheme.onPrimary,
                          size: 14,
                          textAlign: TextAlign.center,
                        ).paddingOnly(bottom: 48),
                        SizedBox(
                          height: 80,
                          width: 80,
                          child: Assets.imagesCameraAccess.image(
                            fit: BoxFit.contain,
                          ),
                        ).paddingOnly(bottom: 48),
                      ],
                    ),
                  ),
                ),
                AppButton(
                  label: 'Allow Camera Access',
                  onPressed: () => _allowCamera(),
                  bgColor: primaryRed,
                  txtColor: scheme.onPrimary,
                  btnCornerRadius: 14,
                ).paddingOnly(bottom: 18),
                Center(
                  child: CommonText.medium(
                    'Skip for Now',
                    color: Colors.white70,
                    size: 14,
                    onTap: _skip,
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
