import 'dart:async';

import 'package:car_comfort/app/services/app_config_service.dart';
import 'package:car_comfort/app/utils/extensions/extension.dart';
import 'package:flutter/foundation.dart';
import 'package:car_comfort/app/utils/referral_share.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';

import '../../gen/assets.gen.dart';
import '../../routes/app_pages.dart';
import '../../utils/app_snackbar.dart';
import '../../widgets/button.dart';
import '../../widgets/text.dart';
import '../driver_dashboard/driver_header_back_button.dart';
import 'settings_controller.dart';

class ReferEarnView extends StatefulWidget {
  const ReferEarnView({super.key});

  @override
  State<ReferEarnView> createState() => _ReferEarnViewState();
}

class _ReferEarnViewState extends State<ReferEarnView> {
  late final SettingsController _controller;

  @override
  void initState() {
    super.initState();
    _controller = Get.find<SettingsController>();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_controller.ensureCustomerProfileLoaded());
    });
  }

  @override
  Widget build(BuildContext context) {
    return GetBuilder<SettingsController>(
      builder: (controller) {
        return Obx(() {
          final isLoading =
              controller.isProfileLoading &&
              controller.referralCode.value.isEmpty;
          final referralCode = controller.referralCode.value.trim();
          final displayCode = referralCode.isEmpty ? '—' : referralCode;

          // Reactive discount label from admin settings (e.g. "10%").
          final discountLabel = AppConfigService.to.config.discountLabel;

          return Scaffold(
            backgroundColor: const Color(0xffFAFAFA),
            body: Column(
              children: [
                const _TopHeader(title: 'Refer & Earn'),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(22, 20, 22, 24),
                    child: Column(
                      children: [
                        Assets.imagesCrown
                            .image(fit: BoxFit.contain, scale: 4)
                            .paddingOnly(top: 16),
                        Assets.imagesReward
                            .image(fit: BoxFit.contain, scale: 3.5)
                            .paddingOnly(bottom: 16),
                        // Headline — client copy
                        CommonText.regular(
                          'Refer your friends and family to CarComfort.',
                          size: 16,
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 16),
                        // Sub-copy — client copy
                        CommonText.regular(
                          'After they install the app and book their first service, '
                          "you'll both receive $discountLabel off our valet EV charging and car wash services.",
                          size: 11,
                          color: const Color(0xff555555),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 18),
                        if (isLoading)
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 12),
                            child: SizedBox(
                              width: 28,
                              height: 28,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                              ),
                            ),
                          )
                        else
                          _CopyCodeCard(
                            code: displayCode,
                            onCopy: () => _copyReferralCode(referralCode),
                          ),
                        const SizedBox(height: 14),
                        // Footer copy — client copy
                        CommonText.regular(
                          'Share your code and enjoy $discountLabel off on '
                          'valet EV charging and car wash services.',
                          size: 11,
                          color: const Color(0xff555555),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 28),
                        AppButton(
                          label: 'Share Code',
                          onPressed: !isLoading && referralCode.isNotEmpty
                              ? () => unawaited(
                                  _shareReferralCode(
                                    referralCode,
                                    discountLabel,
                                  ),
                                )
                              : null,
                          bgColor: const Color(0xffF2051F),
                          btnCornerRadius: 14,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          );
        });
      },
    );
  }

  Future<void> _copyReferralCode(String referralCode) async {
    if (referralCode.isEmpty) {
      showAppSnackBar(
        title: 'Referral',
        message: 'Referral code not available yet',
        isError: true,
      );
      return;
    }
    await Clipboard.setData(ClipboardData(text: referralCode));
    showAppSnackBar(title: 'Referral', message: 'Code copied');
  }

  Future<void> _shareReferralCode(
    String referralCode,
    String discountLabel,
  ) async {
    if (referralCode.isEmpty) {
      showAppSnackBar(
        title: 'Referral',
        message: 'Referral code not available yet',
        isError: true,
      );
      return;
    }

    try {
      await ReferralShare.shareReferralCode(
        referralCode,
        discountLabel: discountLabel,
      );
    } catch (e) {
      if (kDebugMode) debugPrint('Share referral failed: $e');
      showAppSnackBar(
        title: 'Referral',
        message: 'Could not open share. Please try again.',
        isError: true,
      );
    }
  }
}

class _CopyCodeCard extends StatelessWidget {
  final String code;
  final VoidCallback onCopy;

  const _CopyCodeCard({required this.code, required this.onCopy});

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minWidth: 146, maxWidth: 320),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xffF2F2F7),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xffCFCFD4)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Flexible(
            child: CommonText.medium(
              code,
              size: 16,
              textAlign: TextAlign.center,
              maxLines: 2,
            ),
          ),
          const SizedBox(width: 8),
          InkWell(
            onTap: onCopy,
            borderRadius: BorderRadius.circular(6),
            child: const Padding(
              padding: EdgeInsets.all(2),
              child: Icon(
                Icons.copy_rounded,
                size: 16,
                color: Color(0xffF2051F),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TopHeader extends StatelessWidget {
  final String title;

  const _TopHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return ClipRRect(
      borderRadius: const BorderRadius.vertical(bottom: Radius.circular(20)),
      child: SizedBox(
        height: top + 66,
        child: Stack(
          fit: StackFit.expand,
          children: [
            Assets.imagesHomeHBg.image(fit: BoxFit.cover),
            Container(color: Colors.black.withValues(alpha: 0.45)),
            Padding(
              padding: EdgeInsets.fromLTRB(14, top + 12, 14, 8),
              child: Row(
                children: [
                  const DriverHeaderBackButton(),
                  const SizedBox(width: 10),
                  Expanded(
                    child: CommonText.regular(
                      title,
                      color: context.colorScheme.onPrimary,
                      size: 16,
                    ),
                  ),
                  Material(
                    color: context.colorScheme.onPrimary,
                    shape: const CircleBorder(),
                    child: InkWell(
                      onTap: () => Get.toNamed(Routes.NOTIFICATIONS),
                      customBorder: const CircleBorder(),
                      child: const SizedBox(
                        width: 32,
                        height: 32,
                        child: Icon(
                          Icons.notifications_none_rounded,
                          color: Colors.black87,
                          size: 18,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
