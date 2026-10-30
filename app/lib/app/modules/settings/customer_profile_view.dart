import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';

import '../../gen/assets.gen.dart';
import '../../routes/app_pages.dart';
import '../../utils/app_snackbar.dart';
import '../../utils/pref.dart';
import '../../widgets/image.dart';
import '../../widgets/local_image_gallery_viewer.dart';
import '../../widgets/text.dart';
import '../../widgets/blurred_image_screen_header.dart';
import 'settings_controller.dart';

/// Customer profile (view-only) opened from the top-left avatar on Dashboard.
class CustomerProfileView extends GetView<SettingsController> {
  const CustomerProfileView({super.key});

  static const Color _primaryRed = Color(0xffF2051F);

  @override
  Widget build(BuildContext context) {
    return GetBuilder<SettingsController>(
      builder: (c) {
        final controller = c;

        final fullName =
            '${controller.firstNameController.text} ${controller.lastNameController.text}'
                .trim();
        final email = controller.emailController.text.trim();
        final phoneRaw = controller.phoneController.text.trim();
        final dialCode = controller.profileDialCode.value.trim();
        final phoneWithCountryCode = phoneRaw.isEmpty
            ? ''
            : (phoneRaw.startsWith('+')
                  ? phoneRaw
                  : (dialCode.isEmpty ? phoneRaw : '$dialCode $phoneRaw'));
        final fallbackName = Prefs().userFullName().trim();
        final displayName = (fullName.isNotEmpty ? fullName : fallbackName)
            .trim();
        final avatarPath =
            controller.profileImagePath?.trim().isNotEmpty == true
            ? controller.profileImagePath?.trim()
            : Prefs().userImage().trim();

        final referralCode = controller.referralCode.value.trim();
        final referralMasked = referralCode.isEmpty
            ? 'Tap to copy'
            : referralCode;
        final vehiclesCount = controller.vehiclesCount.value;

        return Scaffold(
          backgroundColor: Colors.white,
          body: Column(
            children: [
              BlurredImageScreenHeader(
                title: 'Profile',
                showLeading: true,
                onBack: Get.back,
                titleColor: Colors.white,
                // Keeps spacing consistent with other screens that use this header.
                titleSize: 18,
              ),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Center(
                        child: TappableProfilePhoto(
                          imagePath: avatarPath,
                          child: Container(
                            width: 178,
                            height: 178,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: const Color(0xffDADAE1),
                                width: 2,
                              ),
                            ),
                            child: ClipOval(
                              child:
                                  (avatarPath != null && avatarPath.isNotEmpty)
                                  ? (avatarPath.startsWith('http')
                                        ? ImageFromNetwork(
                                            fit: BoxFit.cover,
                                            width: 178,
                                            height: 178,
                                            avatarPath,
                                            placeholderWidget: Container(
                                              color: Colors.white,
                                              child: const Icon(
                                                Icons.person_rounded,
                                                size: 90,
                                                color: Colors.grey,
                                              ),
                                            ),
                                          )
                                        : Image.file(
                                            File(avatarPath),
                                            width: 178,
                                            height: 178,
                                            fit: BoxFit.cover,
                                            cacheWidth: 356,
                                            cacheHeight: 356,
                                          ))
                                  : Container(
                                      color: Colors.white,
                                      child: const Icon(
                                        Icons.person_rounded,
                                        size: 90,
                                        color: Colors.grey,
                                      ),
                                    ),
                            ),
                          ),
                          showZoomBadge: false,
                        ),
                      ),
                      const SizedBox(height: 12),
                      CommonText.bold(
                        displayName.isEmpty ? 'Profile' : displayName,
                        size: 18,
                        color: const Color(0xff1A1A1A),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 4),
                      CommonText.regular(
                        email.isNotEmpty ? email : Prefs().userEmail(),
                        size: 12,
                        color: Colors.grey.shade600,
                        textAlign: TextAlign.center,
                        maxLines: 1,
                      ),
                      if (phoneWithCountryCode.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        CommonText.regular(
                          phoneWithCountryCode,
                          size: 12,
                          color: Colors.grey.shade600,
                          textAlign: TextAlign.center,
                          maxLines: 1,
                        ),
                      ],
                      const SizedBox(height: 18),

                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          CommonText.extraBold('Referral Code', size: 14),
                          // const SizedBox(width: 10),
                          _MaskedReferralCode(
                            maskedText: referralMasked,
                            actualText: referralCode,
                            primaryRed: _primaryRed,
                          ),
                        ],
                      ),
                      const SizedBox(height: 28),

                      Center(
                        child: Container(
                          width: 180,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 12,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade300,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceAround,
                            children: [
                              CommonText.medium('Referrals', size: 14),
                              Obx(
                                () => CommonText.medium(
                                  '${controller.activeReferralsCount.value}',
                                  size: 14,
                                  color: const Color(0xff1A1A1A),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),

                      const SizedBox(height: 18),
                      CommonText.extraBold('Account', size: 14),
                      const SizedBox(height: 10),
                      _AccountCard(
                        vehiclesCount: vehiclesCount,
                        onPersonalInfo: () => Get.toNamed(
                          Routes.PROFILE_SETTINGS,
                          arguments: {'editMode': false},
                        ),
                        onVehicles: () async {
                          await Get.toNamed(Routes.VEHICLES);
                          await controller.loadVehiclesCount();
                        },
                        onPaymentMethods: () =>
                            Get.toNamed(Routes.PAYMENT_METHOD),
                      ),
                      const SizedBox(height: 18),

                      InkWell(
                        borderRadius: BorderRadius.circular(14),
                        onTap: controller.showLogoutDialog,
                        child: Container(
                          height: 50,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: _primaryRed, width: 2),
                          ),
                          child: Center(
                            child: CommonText.medium(
                              'Log Out',
                              size: 15,
                              color: _primaryRed,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({
    required this.title,
    required this.onBack,
    required this.onShare,
  });

  final String title;
  final VoidCallback onBack;
  final VoidCallback onShare;

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return SizedBox(
      height: top + 56,
      child: Padding(
        padding: EdgeInsets.only(top: top, left: 12, right: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            InkWell(
              onTap: onBack,
              borderRadius: BorderRadius.circular(20),
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: Assets.imagesBack.image(
                  width: 24,
                  height: 24,
                  color: Colors.black87,
                  fit: BoxFit.contain,
                ),
              ),
            ),
            Expanded(
              child: Center(
                child: CommonText.regular(
                  title,
                  size: 18,
                  color: Colors.black87,
                ),
              ),
            ),
            IconButton(
              onPressed: onShare,
              icon: const Icon(
                Icons.ios_share_rounded,
                size: 22,
                color: Colors.black87,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MaskedReferralCode extends StatelessWidget {
  const _MaskedReferralCode({
    required this.maskedText,
    required this.actualText,
    required this.primaryRed,
  });

  final String maskedText;
  final String actualText;
  final Color primaryRed;

  @override
  Widget build(BuildContext context) {
    final canCopy = actualText.trim().isNotEmpty;
    return InkWell(
      onTap: () async {
        if (!canCopy) {
          Get.snackbar(
            'Referral',
            'Referral code not available yet.',
            snackPosition: SnackPosition.BOTTOM,
            backgroundColor: const Color(0xFF1A1A1A),
            colorText: Colors.white,
          );
          return;
        }
        await Clipboard.setData(ClipboardData(text: actualText));
        showAppSnackBar(title: 'Referral', message: 'Code copied');
      },
      borderRadius: BorderRadius.circular(10),
      child: Container(
        height: 32,
        width: 180,
        padding: const EdgeInsets.symmetric(horizontal: 8),
        decoration: BoxDecoration(
          color: primaryRed,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            Expanded(
              child: CommonText.medium(
                maskedText,
                size: 16,
                color: Colors.white,
                textAlign: TextAlign.center,
              ),
            ),
            const SizedBox(width: 10),

            const Icon(Icons.copy_rounded, size: 16, color: Colors.white),
          ],
        ),
      ),
    );
  }
}

class _AccountCard extends StatelessWidget {
  const _AccountCard({
    required this.vehiclesCount,
    required this.onPersonalInfo,
    required this.onVehicles,
    required this.onPaymentMethods,
  });

  final int vehiclesCount;
  final VoidCallback onPersonalInfo;
  final VoidCallback onVehicles;
  final VoidCallback onPaymentMethods;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xffE8E8EF)),
      ),
      child: Column(
        children: [
          _AccountRow(
            title: 'Personal Information',
            icon: Icons.person_outline_rounded,
            onTap: onPersonalInfo,
          ),
          const Divider(height: 1, thickness: 1, color: Color(0xffE8E8EF)),
          _AccountRow(
            title: 'My Vehicles',
            icon: Icons.directions_car_outlined,
            trailingBadge: vehiclesCount,
            onTap: onVehicles,
          ),
          const Divider(height: 1, thickness: 1, color: Color(0xffE8E8EF)),
          _AccountRow(
            title: 'Payment Methods',
            icon: Icons.credit_card_outlined,
            onTap: onPaymentMethods,
          ),
        ],
      ),
    );
  }
}

class _AccountRow extends StatelessWidget {
  const _AccountRow({
    required this.title,
    required this.icon,
    this.trailingBadge,
    required this.onTap,
  });

  final String title;
  final IconData icon;
  final int? trailingBadge;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Icon(icon, color: const Color(0xff5B5B5B), size: 20),
            const SizedBox(width: 12),
            Expanded(
              child: CommonText.medium(
                title,
                size: 13,
                color: const Color(0xff1A1A1A),
              ),
            ),
            if (trailingBadge != null) ...[
              Container(
                width: 20,
                height: 20,
                decoration: const BoxDecoration(
                  color: CustomerProfileView._primaryRed,
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: CommonText.medium(
                    '$trailingBadge',
                    size: 11,
                    color: Colors.white,
                  ),
                ),
              ),
              const SizedBox(width: 10),
            ],
            const Icon(
              Icons.chevron_right_rounded,
              color: Color(0xff9AA3B2),
              size: 20,
            ),
          ],
        ),
      ),
    );
  }
}
