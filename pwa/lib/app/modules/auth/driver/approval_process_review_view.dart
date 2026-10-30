import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../gen/assets.gen.dart';
import '../../../widgets/button.dart';
import '../../../widgets/text.dart';
import '../auth_controller.dart';

class ApprovalProcessReviewView extends StatelessWidget {
  const ApprovalProcessReviewView({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = Get.find<AuthController>();
    return Scaffold(
      backgroundColor: const Color(0xffF2F2F7),
      body: Column(
        children: [
          _ApprovalHeader(onBack: () => controller.onApprovalReviewBack()),
          Expanded(
            child: Container(
              width: double.infinity,
              margin: const EdgeInsets.only(top: 10),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 0, 24, 22),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(
                      child: Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            SizedBox(
                              height: 130,
                              width: 130,
                              child: Assets.imagesIcReview.image(
                                fit: BoxFit.contain,
                              ),
                            ),
                            const SizedBox(height: 22),
                            const CommonText.regular(
                              "We're Reviewing Your\nAccount",
                              size: 22,
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 10),
                            const CommonText.regular(
                              'Please be patient. We’ll notify you as soon as your\nprofile is approved.',
                              size: 12,
                              color: Color(0xff8B8B8B),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      ),
                    ),
                    Obx(
                      () => SafeArea(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            AppButton(
                              label: controller.isLoading.value
                                  ? 'Checking...'
                                  : 'Refresh status',
                              onPressed: controller.isLoading.value
                                  ? null
                                  : controller
                                      .refreshDriverApprovalStatusFromReview,
                              bgColor: const Color(0xffF2051F),
                              btnCornerRadius: 14,
                            ),
                            if (controller.showApprovalReviewLogout) ...[
                              const SizedBox(height: 12),
                              AppButton(
                                label: 'Logout',
                                type: ButtonType.outline,
                                borderColor: const Color(0xffF2051F),
                                txtColor: const Color(0xffF2051F),
                                onPressed: controller.isLoading.value
                                    ? null
                                    : controller
                                        .showLogoutDialogFromApprovalReview,
                                btnCornerRadius: 14,
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ApprovalHeader extends StatelessWidget {
  final VoidCallback onBack;

  const _ApprovalHeader({required this.onBack});

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
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
              padding: EdgeInsets.fromLTRB(20, top + 16, 20, 12),
              child: Row(
                children: [
                  InkWell(
                    onTap: onBack,
                    borderRadius: BorderRadius.circular(20),
                    child: Assets.imagesBack.image(
                      width: 26,
                      height: 26,
                      fit: BoxFit.contain,
                    ),
                  ).paddingOnly(right: 18),
                  const Expanded(
                    child: CommonText.regular(
                      'Approval Process',
                      color: Colors.white,
                      size: 18,
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
