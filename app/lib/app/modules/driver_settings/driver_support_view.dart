import 'package:car_comfort/app/utils/extensions/extension.dart';
import 'package:flutter/material.dart';
import 'package:flutter_html/flutter_html.dart';
import 'package:get/get.dart';

import '../../gen/assets.gen.dart';
import '../../routes/app_pages.dart';
import '../../theme/design_tokens.dart';
import '../../widgets/text.dart';
import '../settings/legal_html_styles.dart';
import '../settings/need_help_controller.dart';
import 'driver_support_binding.dart';
import '../driver_dashboard/driver_dashboard_controller.dart';
import '../driver_dashboard/driver_dashboard_bottom_bar.dart';
import '../driver_dashboard/driver_header_back_button.dart';

class DriverSupportView extends StatelessWidget {
  const DriverSupportView({super.key, this.showBottomBar = true});

  final bool showBottomBar;

  static const Color _cardGrey = Color(0xff2E2E2E);
  static const Color _accentRed = Color(0xffE70B1C);
  static const Color _subtitleGrey = Color(0xff5E5E5E);

  void _onBack() {
    final dashRegistered = Get.isRegistered<DriverDashboardController>();
    final dash = dashRegistered ? Get.find<DriverDashboardController>() : null;
    if (!showBottomBar) {
      dash?.homeNavIndex.value = 3;
      return;
    }
    if (Get.currentRoute == Routes.DRIVER_SUPPORT) {
      Get.back();
      return;
    }
    dash?.homeNavIndex.value = 3;
    if (dash == null) Get.back();
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    final support = Get.find<NeedHelpController>(
      tag: kDriverSupportNeedHelpTag,
    );
    final showNavBar =
        showBottomBar && Get.isRegistered<DriverDashboardController>();

    return Scaffold(
      backgroundColor: const Color(0xffFAFAFA),
      bottomNavigationBar: showNavBar ? const DriverDashboardBottomBar() : null,
      body: Column(
        children: [
          ClipRRect(
            borderRadius: const BorderRadius.vertical(
              bottom: Radius.circular(18),
            ),
            child: SizedBox(
              height: top + 84,
              width: double.infinity,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Assets.imagesHomeHBg.image(fit: BoxFit.cover),
                  Container(color: Colors.black.withValues(alpha: 0.45)),
                  Padding(
                    padding: EdgeInsets.fromLTRB(12, top + 12, 12, 12),
                    child: Row(
                      children: [
                        DriverHeaderBackButton(onTap: _onBack),
                        Expanded(
                          child: Center(
                            child: CommonText.regular(
                              'Need Help?',
                              color: context.colorScheme.onPrimary,
                              size: 18,
                            ),
                          ),
                        ),
                        Material(
                          color: context.colorScheme.onPrimary,
                          shape: const CircleBorder(),
                          child: InkWell(
                            onTap: () =>
                                Get.toNamed(Routes.DRIVER_NOTIFICATIONS),
                            customBorder: const CircleBorder(),
                            child: const SizedBox(
                              width: 40,
                              height: 40,
                              child: Icon(
                                Icons.notifications_none_rounded,
                                color: Colors.black87,
                                size: 22,
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
          ),
          Expanded(
            child: Obx(() {
              if (support.isLoading.value) {
                return const Center(
                  child: SizedBox(
                    width: 28,
                    height: 28,
                    child: CircularProgressIndicator(
                      color: _accentRed,
                      strokeWidth: 2,
                    ),
                  ),
                );
              }

              final err = support.errorMessage.value;
              final html = support.htmlContent.value;
              final hasEmail =
                  support.supportEmail.value != null &&
                  support.supportEmail.value!.trim().isNotEmpty;

              if (err != null && err.isNotEmpty && html.isEmpty && !hasEmail) {
                return ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 24, 16, 12),
                  children: [
                    CommonText.regular(
                      err,
                      size: 14,
                      color: Colors.red.shade700,
                    ),
                    const SizedBox(height: 16),
                    TextButton(
                      onPressed: support.refreshFromNetwork,
                      child: const CommonText.medium('Try again', size: 14),
                    ),
                  ],
                );
              }

              return SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: EdgeInsets.fromLTRB(16, 24, 16, 24 + bottomInset),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 100,
                      height: 100,
                      decoration: BoxDecoration(
                        color: _accentRed,
                        borderRadius: BorderRadius.circular(100),
                      ),
                      child: const Icon(
                        Icons.support_agent_rounded,
                        color: Colors.white,
                        size: 54,
                      ),
                    ).paddingOnly(bottom: 48, top: 28),
                    const CommonText.regular(
                      'How we can help you?',
                      size: 20,
                      color: Color(0xff4A4A4A),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 14),
                    if (html.isNotEmpty)
                      Html(
                        data: html,
                        style: legalHtmlStyles(bodyColor: _subtitleGrey),
                      )
                    else
                      const CommonText.regular(
                        'Reach out using the options below and we will get back to you.',
                        textAlign: TextAlign.center,
                        size: 13,
                        color: _subtitleGrey,
                      ).paddingOnly(bottom: 58),
                    if (html.isNotEmpty) const SizedBox(height: 24),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (hasEmail) ...[
                          Expanded(
                            child: _SupportOptionCard(
                              title: 'Email Us',
                              icon: Icons.mail_outline_rounded,
                              onTap: support.openSupportEmail,
                            ),
                          ),
                          const SizedBox(width: 12),
                        ],
                        Expanded(
                          child: _SupportOptionCard(
                            title: 'Chat With Us',
                            icon: Icons.chat,
                            onTap: () => Get.toNamed(Routes.SUPPORT_TICKETS),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    _SupportOptionCard(
                      title: 'Call Support',
                      subtitle: '1-800-702-3590',
                      icon: Icons.phone_outlined,
                      onTap: support.openSupportCall,
                    ),
                  ],
                ),
              );
            }),
          ),
        ],
      ),
    );
  }
}

class _SupportOptionCard extends StatelessWidget {
  final String title;
  final String? subtitle;
  final IconData icon;
  final VoidCallback onTap;

  const _SupportOptionCard({
    required this.title,
    this.subtitle,
    required this.icon,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: DriverSupportView._cardGrey,
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        child: Container(
          height: 120,
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CommonText.regular(
                title,
                color: context.colorScheme.onPrimary,
                size: 15,
              ),
              if (subtitle != null) ...[
                const SizedBox(height: 4),
                CommonText.regular(
                  subtitle!,
                  color: context.colorScheme.onPrimary.withValues(alpha: 0.75),
                  size: 13,
                ),
              ],
              const Spacer(),
              Align(
                alignment: Alignment.bottomRight,
                child: Icon(
                  icon,
                  color: context.colorScheme.onPrimary.withValues(alpha: 0.95),
                  size: 32,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
