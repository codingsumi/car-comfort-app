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
import '../../widgets/legal_documents_menu.dart';
import '../../widgets/text.dart';
import 'settings_controller.dart';

class SettingsView extends GetView<SettingsController> {
  const SettingsView({super.key});

  @override
  Widget build(BuildContext context) {
    final legalCache = Get.find<LegalPagesCacheService>();

    return Scaffold(
      backgroundColor: const Color(0xffFAFAFA),
      body: Column(
        children: [
          _TopHeader(
            title: 'Settings',
            onNotifications: () => Get.toNamed(Routes.NOTIFICATIONS),
          ),
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                children: [
                  // _item(
                  //   'Profile Settings',
                  //   Icons.settings_outlined,
                  //   () => Get.toNamed(Routes.PROFILE_SETTINGS),
                  //   context,
                  // ),
                  // _item(
                  //   'Vehicles',
                  //   Icons.directions_car_outlined,
                  //   () => Get.toNamed(Routes.VEHICLES),
                  //   context,
                  // ),
                  _item(
                    'Switch to Service Provider',
                    Icons.local_taxi_outlined,
                    () => unawaited(RoleSwitchService.useAsDriver()),
                    context,
                  ),
                  _item(
                    'Payment Methods',
                    Icons.credit_card,
                    () => Get.toNamed(Routes.PAYMENT_METHOD),
                    context,
                  ),
                  _item(
                    'Booking History',
                    Icons.history_rounded,
                    () => controller.openBookingHistory(),
                    context,
                  ),
                  _item(
                    'Billing History',
                    Icons.receipt_long_outlined,
                    () => controller.openBillingHistory(),
                    context,
                  ),
                  _item(
                    'Notifications',
                    Icons.notifications_none_rounded,
                    () => Get.toNamed(Routes.NOTIFICATIONS),
                    context,
                  ),
                  _item(
                    'Refer & Earn',
                    Icons.link_rounded,
                    () => Get.toNamed(Routes.REFER_EARN),
                    context,
                  ),
                  _item(
                    'Tutorial',
                    Icons.play_circle_outline_rounded,
                    () => controller.openTutorial(),
                    context,
                  ),
                  _item('File a Claim', Icons.phone_in_talk_outlined, () async {
                    final uri = Uri.parse('tel:18007023590');
                    if (await canLaunchUrl(uri)) {
                      await launchUrl(uri);
                    }
                  }, context),
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
                  const LegalDocumentsMenu(
                    audience: LegalAudience.customer,
                    fromRoute: Routes.SETTINGS,
                  ),
                  Obx(() {
                    final supportPages = legalCache.menuPages.where(
                      (page) =>
                          page.showInMenu &&
                          page.slug?.trim().toLowerCase() ==
                              LegalPageQuery.support,
                    );
                    return Column(
                      children: [
                        for (final page in supportPages)
                          _item(
                            page.displayTitle,
                            LegalPagesNavigation.iconForSlug(page.slug),
                            () => LegalPagesNavigation.open(
                              page,
                              fromRoute: Routes.SETTINGS,
                              audience: LegalAudience.customer,
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
                    'Log Out',
                    Icons.logout_rounded,
                    controller.showLogoutDialog,
                    context,
                  ),
                ],
              ).paddingSymmetric(horizontal: 12, vertical: 14),
            ),
          ),
        ],
      ),
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

class _TopHeader extends StatelessWidget {
  final String title;
  final VoidCallback onNotifications;
  const _TopHeader({required this.title, required this.onNotifications});
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
                  Expanded(
                    child: CommonText.regular(
                      title,
                      color: Colors.white,
                      size: 16,
                    ),
                  ),
                  Material(
                    color: Colors.white,
                    shape: const CircleBorder(),
                    child: InkWell(
                      onTap: onNotifications,
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
