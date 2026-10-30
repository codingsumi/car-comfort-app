import 'package:car_comfort/app/utils/extensions/extension.dart';
import 'package:flutter/material.dart';
import 'package:flutter_html/flutter_html.dart';
import 'package:get/get.dart';

import '../../gen/assets.gen.dart';
import '../../routes/app_pages.dart';
import '../../theme/design_tokens.dart';
import '../../widgets/text.dart';
import '../dashboard/dashboard_controller.dart';
import '../driver_dashboard/driver_header_back_button.dart';
import 'legal_html_styles.dart';
import 'need_help_controller.dart';

class NeedHelpView extends GetView<NeedHelpController> {
  const NeedHelpView({super.key});

  static const Color _cardGrey = Color(0xff2E2E2E);
  static const Color _accentRed = Color(0xffE70B1C);
  static const Color _subtitleGrey = Color(0xff5E5E5E);

  void _onBack() {
    final from = Get.arguments?['from'];
    if (from == Routes.SETTINGS) {
      Get.back();
      return;
    }
    if (Get.isRegistered<DashboardController>()) {
      Get.find<DashboardController>().homeNavIndex.value = 2;
    } else {
      Get.back();
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    return Scaffold(
      backgroundColor: const Color(0xffFAFAFA),
      body: Column(
        children: [
          Obx(
                () => _TopHeader(
              title: controller.screenTitle.value,
              onBack: _onBack,
            ),
          ),
          Expanded(
            child: Obx(() {
              if (controller.isLoading.value) {
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
              final err = controller.errorMessage.value;
              final html = controller.htmlContent.value;
              final hasEmail =
                  controller.supportEmail.value != null &&
                      controller.supportEmail.value!.trim().isNotEmpty;

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
                      onPressed: controller.refreshFromNetwork,
                      child: const CommonText.medium('Try again', size: 14),
                    ),
                  ],
                );
              }

              return SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: EdgeInsets.fromLTRB(16, 20, 16, 24 + bottomInset),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(
                      child: Container(
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
                      ),
                    ).paddingOnly(bottom: 32, top: 8),
                    const CommonText.semiBold(
                      'How we can help you?',
                      size: 20,
                      textAlign: TextAlign.center,
                      color: Color(0xff2C2C2E),
                    ),
                    const SizedBox(height: 16),
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
                      ),
                    const SizedBox(height: 24),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (hasEmail) ...[
                          Expanded(
                            child: _SupportOptionCard(
                              title: 'Email Us',
                              icon: Icons.mail_outline_rounded,
                              onTap: controller.openSupportEmail,
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
                      icon: Icons.phone_outlined,
                      onTap: controller.openSupportCall,
                      subtitle: '1-800-702-3590',
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

class _TopHeader extends StatelessWidget {
  final String title;
  final VoidCallback onBack;

  const _TopHeader({required this.title, required this.onBack});

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
            Container(color: context.colorScheme.scrim.withValues(alpha: 0.45)),
            Padding(
              padding: EdgeInsets.fromLTRB(14, top + 12, 14, 8),
              child: Row(
                children: [
                  DriverHeaderBackButton(onTap: onBack),
                  const SizedBox(width: 10),
                  Expanded(
                    child: CommonText.regular(
                      title,
                      color: context.colorScheme.onPrimary,
                      size: 16,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
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
      color: NeedHelpView._cardGrey,
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
