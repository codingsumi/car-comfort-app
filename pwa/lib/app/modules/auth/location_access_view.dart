import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../gen/assets.gen.dart';
import '../../routes/app_pages.dart';
import '../../utils/extensions/extension.dart';
import '../../utils/pref.dart';
import '../../widgets/button.dart';
import '../../widgets/logo_widget.dart';
import '../../widgets/text.dart';

class LocationAccessView extends StatelessWidget {
  const LocationAccessView({super.key});
  static const _horizontalPadding = 32.0;

  String get _postPermissionRoute {
    final role = Prefs().getData(Prefs.role).toLowerCase();
    return role == 'driver' ? Routes.DRIVER_DASHBOARD : Routes.DASHBOARD;
  }

  Future<void> _allowLocation() async {
    await Permission.locationWhenInUse.request();
    Get.offAllNamed(_postPermissionRoute);
  }

  void _skip() => Get.offAllNamed(_postPermissionRoute);

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
          child: SingleChildScrollView(
            padding: EdgeInsets.fromLTRB(
              _horizontalPadding,
              20,
              _horizontalPadding,
              bottomInset + 24,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                LogoWidget().paddingOnly(bottom: 24),
                 CommonText.bold(
                  'Enable Location Services',
                  color: scheme.onPrimary,
                   size: 18,
                  textAlign: TextAlign.center,
                ).paddingOnly(bottom:20),
                 CommonText.regular(
                  'We need your location to:',
                   color: scheme.outlineVariant,
                  size: 14,
                  textAlign: TextAlign.center,
                ).paddingOnly(bottom:40),
                 CommonText.regular(
                  'Connect you with nearby service providers\nShow real-time provider location and ETA',
                  color:scheme.onPrimary,
                  size: 14,
                ),

                const SizedBox(height: 10),
                 CommonText.regular(
                  'Ensure accurate service delivery to your location',
                  color:scheme.onPrimary,
                  size: 14,
                ),
                const SizedBox(height: 10),
                 CommonText.regular(
                  'Provide the best service experience',
                  color:scheme.onPrimary,
                  size: 14,
                ),
                const SizedBox(height: 48),
                SizedBox(
                  height: 80,
                  width: 80,
                  child: Assets.imagesCameraAccess.image(
                    fit: BoxFit.contain,
                  ),
                ).paddingOnly(bottom: 48),
                AppButton(
                  label: 'Allow Location Access',
                  onPressed: () => _allowLocation(),
                  bgColor: primaryRed,
                  txtColor: scheme.onPrimary,
                  btnCornerRadius: 14,
                ).paddingOnly(bottom: 18),
                CommonText.medium(
                  'Skip for Now',
                  color: Colors.white70,
                  size: 14,
                  textAlign: TextAlign.center,
                  onTap: _skip,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
