import 'package:car_comfort/app/utils/extensions/extension.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_html/flutter_html.dart';
import 'package:get/get.dart';

import '../../gen/assets.gen.dart';
import '../../routes/app_pages.dart';
import '../../theme/design_tokens.dart';
import '../../widgets/button.dart';
import '../../widgets/text.dart';
import '../../utils/web_navigation.dart';
import '../../utils/app_snackbar.dart';
import '../dashboard/dashboard_controller.dart';
import '../driver_dashboard/driver_header_back_button.dart';
import 'legal_html_styles.dart';
import 'need_help_controller.dart';

class NeedHelpView extends StatefulWidget {
  const NeedHelpView({super.key});

  static const Color _cardGrey = Color(0xff2E2E2E);

  @override
  State<NeedHelpView> createState() => _NeedHelpViewState();
}

class _NeedHelpViewState extends State<NeedHelpView> {
  NeedHelpController get controller => Get.find<NeedHelpController>();
  String selectedTopic = 'General Inquiry';
  final messageController = TextEditingController();

  static const Color _accentRed = Color(0xffE70B1C);
  static const Color _subtitleGrey = Color(0xff5E5E5E);

  @override
  void dispose() {
    messageController.dispose();
    super.dispose();
  }

  void _onBack() {
    if (kIsWeb) {
      offAllNamed(Routes.DASHBOARD);
      return;
    }

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
    final isDesktop = kIsWeb && MediaQuery.sizeOf(context).width >= 900;
    if (isDesktop) {
      return _buildDesktopLayout(context);
    }

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
                    child: CircularProgressIndicator(strokeWidth: 2),
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
                            onTap: () => toNamed(Routes.SUPPORT_TICKETS),
                          ),
                        ),
                      ],
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

  Widget _buildDesktopLayout(BuildContext context) {
    return Obx(() {
      final hasEmail =
          controller.supportEmail.value != null &&
          controller.supportEmail.value!.trim().isNotEmpty;

      return Scaffold(
        backgroundColor: const Color(0xffFAFAFA),
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  IconButton(
                    onPressed: _onBack,
                    tooltip: 'Back',
                    icon: const Icon(
                      Icons.arrow_back_ios_new_rounded,
                      size: 20,
                      color: Colors.black87,
                    ),
                  ),
                  const SizedBox(width: 4),
                  const CommonText.bold(
                    'Support Center',
                    size: 24,
                    color: Colors.black87,
                  ),
                ],
              ),
              const Padding(
                padding: EdgeInsets.only(left: 52, top: 4),
                child: CommonText.regular(
                  'Get help with appointments, charging issues, and billing.',
                  size: 14,
                  color: Colors.black54,
                ),
              ),
              const SizedBox(height: 24),

              // Centered layout
              Center(
                child: Container(
                  constraints: const BoxConstraints(maxWidth: 800),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Banner Card
                      Container(
                        height: 180,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(20),
                          image: DecorationImage(
                            image: Assets.imagesHomeHBg.provider(),
                            fit: BoxFit.cover,
                          ),
                        ),
                        child: Container(
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(20),
                            color: Colors.black.withValues(alpha: 0.55),
                          ),
                          padding: const EdgeInsets.all(24),
                          child: const Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              CommonText.bold(
                                'How we can help you?',
                                size: 24,
                                color: Colors.white,
                              ),
                              SizedBox(height: 8),
                              CommonText.regular(
                                'Car Comfort is dedicated to providing premium, seamless EV charging and car wash services. Our support team is available around the clock to ensure your vehicle is always ready when you are.',
                                size: 13,
                                color: Colors.white70,
                                maxLines: 3,
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),

                      // What we can help with grid
                      Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: const Color(0xffE8E8EF)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Row(
                              children: [
                                Icon(
                                  Icons.support_agent_rounded,
                                  color: Colors.black54,
                                  size: 20,
                                ),
                                SizedBox(width: 8),
                                CommonText.bold(
                                  'What we can help with',
                                  size: 15,
                                  color: Colors.black87,
                                ),
                              ],
                            ),
                            const SizedBox(height: 20),
                            // Grid
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                  child: _buildHelpGridItem(
                                    icon: Icons.ev_station_outlined,
                                    title: 'Charging Issues',
                                    description:
                                        'Troubleshoot mobile charging appointments or station compatibility.',
                                  ),
                                ),
                                const SizedBox(width: 16),
                                Expanded(
                                  child: _buildHelpGridItem(
                                    icon: Icons.calendar_today_outlined,
                                    title: 'Service Booking',
                                    description:
                                        'Modify, cancel, or report issues with scheduled car care services.',
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                  child: _buildHelpGridItem(
                                    icon: Icons.credit_card_outlined,
                                    title: 'Billing & Account',
                                    description:
                                        'Manage payment methods, subscriptions, and invoice inquiries.',
                                  ),
                                ),
                                const SizedBox(width: 16),
                                Expanded(
                                  child: _buildHelpGridItem(
                                    icon: Icons.emergency_rounded,
                                    title: 'Urgent Assistance',
                                    description:
                                        'Get immediate help for active orders or request immediate cancellation.',
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Action buttons
                      Row(
                        children: [
                          if (hasEmail) ...[
                            Expanded(
                              child: _buildSupportActionCard(
                                title: 'Email Us',
                                subtext: 'Expect a response within 2 hours',
                                icon: Icons.mail_outline_rounded,
                                color: Colors.white,
                                textCol: Colors.black87,
                                subtextCol: Colors.black54,
                                onTap: controller.openSupportEmail,
                              ),
                            ),
                            const SizedBox(width: 16),
                          ],
                          Expanded(
                            child: _buildSupportActionCard(
                              title: 'Chat With Us',
                              subtext: 'Available 24/7 for immediate help',
                              icon: Icons.chat_bubble_outline_rounded,
                              color: const Color(0xffC4101F),
                              textCol: Colors.white,
                              subtextCol: Colors.white.withValues(alpha: 0.8),
                              onTap: () => toNamed(Routes.SUPPORT_TICKETS),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    });
  }

  Widget _buildHelpGridItem({
    required IconData icon,
    required String title,
    required String description,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xffF9FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xffE8E8EF)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: const Color(0xffC4101F), size: 24),
          const SizedBox(height: 12),
          CommonText.bold(title, size: 14, color: Colors.black87),
          const SizedBox(height: 6),
          CommonText.regular(
            description,
            size: 12,
            color: Colors.black54,
            maxLines: 3,
          ),
        ],
      ),
    );
  }

  Widget _buildReachUsItem({
    required IconData icon,
    required String title,
    required String value,
    required String subtext,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(8),
          ),
          alignment: Alignment.center,
          child: Icon(icon, color: const Color(0xffC4101F), size: 18),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CommonText.regular(title, size: 11, color: Colors.white38),
              CommonText.bold(value, size: 13, color: Colors.white),
              CommonText.regular(subtext, size: 12, color: Colors.white60),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildSupportActionCard({
    required String title,
    required String subtext,
    required IconData icon,
    required Color color,
    required Color textCol,
    required Color subtextCol,
    required VoidCallback onTap,
  }) {
    return Material(
      color: color,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: color != const Color(0xffC4101F)
                ? Border.all(color: const Color(0xffE8E8EF))
                : null,
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CommonText.bold(title, size: 16, color: textCol),
                    const SizedBox(height: 4),
                    CommonText.regular(subtext, size: 12, color: subtextCol),
                  ],
                ),
              ),
              Icon(icon, color: textCol, size: 24),
            ],
          ),
        ),
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
  final IconData icon;
  final VoidCallback onTap;

  const _SupportOptionCard({
    required this.title,
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
          width: double.infinity,
          constraints: const BoxConstraints(minHeight: 120),
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CommonText.regular(
                title,
                color: context.colorScheme.onPrimary,
                size: 15,
              ),
              const SizedBox(height: 24),
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
