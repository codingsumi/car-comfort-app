import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../gen/assets.gen.dart';
import '../../utils/extensions/extension.dart';
import '../../widgets/button.dart';
import '../../widgets/text.dart';
import 'auth_entry_navigation.dart';

/// First unauthenticated step after splash — user picks customer or service provider,
/// then continues to [Routes.LOGIN].
class WelcomeView extends StatelessWidget {
  const WelcomeView({super.key});

  void _continueAs(String role) => openLoginForRole(role);

  @override
  Widget build(BuildContext context) {
    final scheme = context.colorScheme;

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
        body: Stack(
          fit: StackFit.expand,
          children: [
            Image.asset('assets/images/welcome_img.png', fit: BoxFit.cover, cacheWidth: 1080, cacheHeight: 1920),
            Container(color: scheme.scrim.withValues(alpha: 0.24)),
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
                child: Column(
                  children: [
                    Center(
                      child: Assets.launcherLogo.image(
                        width: 145,
                        fit: BoxFit.contain,
                      ),
                    ),
                    const Spacer(),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
                      decoration: BoxDecoration(
                        color: scheme.onPrimary,
                        borderRadius: BorderRadius.circular(18),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.12),
                            blurRadius: 24,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: Column(
                        children: [
                          Container(
                            width: 44,
                            height: 44,
                            decoration: const BoxDecoration(
                              color: Color(0xffC4101F),
                              shape: BoxShape.circle,
                            ),
                            alignment: Alignment.center,
                            child: Assets.launcherLogo.image(
                              width: 26,
                              height: 26,
                              fit: BoxFit.contain,
                            ),
                          ),
                          const SizedBox(height: 14),
                          const CommonText.bold(
                            'Select your role',
                            color: Color(0xff1B1B1F),
                            size: 20,
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 8),
                          const CommonText.regular(
                            'Please select your role to continue signing in.',
                            color: Color(0xff6B7280),
                            size: 14,
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 18),
                          Row(
                            children: [
                              Expanded(
                                child: AppButton(
                                  label: 'Customer',
                                  onPressed: () => _continueAs('customer'),
                                  bgColor: const Color(0xff1B1B1F),
                                  txtColor: Colors.white,
                                  btnCornerRadius: 12,
                                  vPadding: 14,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: AppButton(
                                  label: 'Service Provider',
                                  onPressed: () => _continueAs('driver'),
                                  bgColor: const Color(0xffC4101F),
                                  txtColor: Colors.white,
                                  btnCornerRadius: 12,
                                  vPadding: 14,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const Spacer(flex: 2),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}