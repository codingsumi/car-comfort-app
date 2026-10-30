import 'dart:async';

import 'package:car_comfort/app/utils/extensions/extension.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../gen/assets.gen.dart';
import '../../routes/app_pages.dart';
import '../../services/legal_pages_cache_service.dart';
import '../../network/response/legal_page_response.dart';
import '../../theme/design_tokens.dart';
import '../../utils/legal_pages_navigation.dart';
import '../../utils/role_switch_service.dart';
import '../../widgets/button.dart';
import '../../widgets/text.dart';
import '../driver_dashboard/driver_dashboard_controller.dart';
import 'driver_settings_controller.dart';

class DriverSettingsView extends GetView<DriverSettingsController> {
  const DriverSettingsView({super.key});

  @override
  Widget build(BuildContext context) {
    final legalCache = Get.find<LegalPagesCacheService>();

    return Scaffold(
      backgroundColor: const Color(0xffFAFAFA),
      body: Column(
        children: [
          _DriverSettingsHeader(
            onNotifications: controller.openNotifications,
            onActiveBookingDetails: () => unawaited(
              Get.find<DriverDashboardController>()
                  .openActiveDriverBookingDetailsSheet(),
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                children: [
                  // ── Driver license expiration banner ────────────────────────────
                  Obx(() {
                    final dash = Get.isRegistered<DriverDashboardController>()
                        ? Get.find<DriverDashboardController>()
                        : null;
                    if (dash == null ||
                        !dash.shouldShowDriverLicenseComplianceBanner) {
                      return const SizedBox.shrink();
                    }
                    final blocked = dash.isDriverLicenseAcceptBlocked;
                    return GestureDetector(
                      onTap: dash.openDriverLicenseRenewal,
                      child: Container(
                        margin: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                        padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
                        decoration: BoxDecoration(
                          color: blocked
                              ? const Color(0xFFFEE2E2)
                              : const Color(0xFFFFF3CD),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: blocked
                                ? const Color(0xFFF87171)
                                : const Color(0xFFFFBF00),
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Icon(
                                  blocked
                                      ? Icons.error_outline_rounded
                                      : Icons.warning_amber_rounded,
                                  color: blocked
                                      ? const Color(0xFFB91C1C)
                                      : const Color(0xFF92400E),
                                  size: 20,
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      CommonText.bold(
                                        blocked
                                            ? 'Account suspended — license expired'
                                            : 'Driver license expiring soon',
                                        size: 13,
                                        color: blocked
                                            ? const Color(0xFF7F1D1D)
                                            : const Color(0xFF78350F),
                                      ),
                                      const SizedBox(height: 3),
                                      CommonText.regular(
                                        dash
                                            .driverLicenseComplianceBannerMessage,
                                        size: 12,
                                        color: blocked
                                            ? const Color(0xFF7F1D1D)
                                            : const Color(0xFF78350F),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            AppButton(
                              label: blocked
                                  ? 'Upload Renewed License'
                                  : 'Renew License Now',
                              onPressed: dash.openDriverLicenseRenewal,
                              bgColor: blocked
                                  ? const Color(0xFFB91C1C)
                                  : const Color(0xFF92400E),
                              txtColor: Colors.white,
                              btnCornerRadius: 10,
                              vPadding: 10,
                              textSize: 13,
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
                  // ───────────────────────────────────────────────────────────────
                  _item(
                    'Switch to customer',
                    Icons.person_outline_rounded,
                    () => unawaited(RoleSwitchService.useAsCustomer()),
                    context,
                  ),
                  _item(
                    'Profile Settings',
                    Icons.settings_outlined,
                    () => controller.openProfileSettings(),
                    context,
                  ),
                  _item(
                    'Payment Methods',
                    Icons.credit_card,
                    () => controller.openPaymentMethods(),
                    context,
                  ),
                  _item(
                    'Wallet',
                    Icons.account_balance_wallet_outlined,
                    () => controller.openWallet(),
                    context,
                  ),
                  _item(
                    'Booking History',
                    Icons.history_rounded,
                    () => controller.openBookingHistory(),
                    context,
                  ),
                  _item(
                    'Tutorials',
                    Icons.play_circle_outline_rounded,
                    () => controller.openTutorial(),
                    context,
                  ),
                  _item(
                    'Learning Center',
                    Icons.school_outlined,
                    () => controller.openLearning(),
                    context,
                  ),
                  _item(
                    'File a Claim',
                    Icons.phone_in_talk_outlined,
                    () async {
                      final uri = Uri.parse('tel:18007023590');
                      if (await canLaunchUrl(uri)) {
                        await launchUrl(uri);
                      }
                    },
                    context,
                  ),
                  _item(
                    'Report Accident/Damage',
                    Icons.car_crash_outlined,
                    () => Get.toNamed(Routes.REPORT_ACCIDENT_DAMAGE),
                    context,
                  ),
                  _item(
                    'Report Missing Item',
                    Icons.inventory_2_outlined,
                    () => Get.toNamed(Routes.REPORT_MISSING_ITEM),
                    context,
                  ),

                  Obx(
                    () => _item(
                      controller.isDownloadingEarningsStatement.value
                          ? 'Preparing earnings statement…'
                          : 'Earnings Statement (PDF)',
                      Icons.picture_as_pdf_outlined,
                      controller.isDownloadingEarningsStatement.value
                          ? () {}
                          : () => controller.showEarningsPrintDialog(),
                      context,
                    ),
                  ),

                  _item(
                    'Notifications',
                    Icons.notifications_none_rounded,
                    () => controller.openNotifications(),
                    context,
                  ),

                  Obx(() {
                    final pages = legalCache.menuPages;
                    return Column(
                      children: [
                        for (final page in pages)
                          _item(
                            page.displayTitle,
                            LegalPagesNavigation.iconForSlug(page.slug),
                            () => LegalPagesNavigation.open(
                              page,
                              fromRoute: Routes.DRIVER_PROFILE_SETTINGS,
                              audience: LegalAudience.provider,
                            ),
                            context,
                          ),
                      ],
                    );
                  }),

                  _item(
                    'Delete Account',
                    Icons.delete_outline_rounded,
                    () => Get.toNamed(Routes.ACCOUNT_DELETION_REQUEST),
                    context,
                  ),

                  _item(
                    'Logout',
                    Icons.logout_rounded,
                    () => controller.showLogoutDialog(),
                    context,
                  ),
                ],
              ).paddingSymmetric(horizontal: 12, vertical: 14),
            ),
          ),
        ],
      ),
      bottomNavigationBar: Obx(() {
        final dash = Get.find<DriverDashboardController>();
        if (!dash.showDriverActiveBookingQuickActions) {
          return const SizedBox.shrink();
        }
        return SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: AppButton(
              label: 'Call Customer',
              onPressed: () =>
                  unawaited(dash.launchDriverCustomerPhoneCall()),
              bgColor: const Color(0xff273844),
              txtColor: Colors.white,
              btnCornerRadius: 14,
              vPadding: 14,
            ),
          ),
        );
      }),
    );
  }

  Widget _item(
    String title,
    IconData icon,
    VoidCallback onTap,
    BuildContext context,
  ) {
    return Padding(
      padding: EdgeInsets.only(bottom: AppSpacing.md - 2),
      child: ListTile(
        onTap: onTap,
        tileColor: context.colorScheme.onPrimary,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: 2,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: Color(0xffE8E8EF)),
        ),
        leading: Icon(icon, color: const Color(0xffE70B1C), size: 18),
        title: CommonText.medium(title, size: 15),
        trailing: const Icon(Icons.chevron_right_rounded, size: 18),
      ),
    );
  }
}

class _DriverSettingsHeader extends StatelessWidget {
  final VoidCallback onNotifications;
  final VoidCallback? onActiveBookingDetails;

  const _DriverSettingsHeader({
    required this.onNotifications,
    this.onActiveBookingDetails,
  });

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    final dash = Get.find<DriverDashboardController>();
    return ClipRRect(
      borderRadius: const BorderRadius.vertical(bottom: Radius.circular(18)),
      child: SizedBox(
        height: top + 84,
        child: Stack(
          fit: StackFit.expand,
          children: [
            Assets.imagesHomeHBg.image(fit: BoxFit.cover),
            Container(color: Colors.black.withValues(alpha: 0.45)),
            Padding(
              padding: EdgeInsets.fromLTRB(20, top + 16, 16, 12),
              child: Row(
                children: [
                  Expanded(
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: CommonText.regular(
                        'Settings',
                        color: context.colorScheme.onPrimary,
                        size: 18,
                      ),
                    ),
                  ),
                  Obx(() {
                    if (!dash.showDriverActiveBookingQuickActions) {
                      return const SizedBox.shrink();
                    }
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: Material(
                        color: context.colorScheme.onPrimary,
                        shape: const CircleBorder(),
                        child: InkWell(
                          onTap: onActiveBookingDetails,
                          customBorder: const CircleBorder(),
                          child: const SizedBox(
                            width: 40,
                            height: 40,
                            child: Icon(
                              Icons.info_outline_rounded,
                              color: Colors.black87,
                              size: 22,
                            ),
                          ),
                        ),
                      ),
                    );
                  }),
                  Material(
                    color: context.colorScheme.onPrimary,
                    shape: const CircleBorder(),
                    child: InkWell(
                      onTap: onNotifications,
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
    );
  }
}
