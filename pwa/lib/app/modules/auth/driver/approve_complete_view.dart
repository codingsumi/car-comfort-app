import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../gen/assets.gen.dart';
import '../../../widgets/button.dart';
import '../../../widgets/text.dart';
import '../auth_controller.dart';

class ApproveCompleteView extends StatelessWidget {
  const ApproveCompleteView({super.key});

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
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 22),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(
                      child: Center(
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            SizedBox(
                              // height: 400,
                              // width: 400,
                              child: Assets.gifConfetti.image(
                                fit: BoxFit.fitWidth,
                              ),
                            ),
                            Column(
                              mainAxisSize: MainAxisSize.min,
                              crossAxisAlignment: CrossAxisAlignment.center,
                              children: [
                                SizedBox(
                                  height: 120,
                                  width: 120,
                                  child: Assets.imagesIcSuccess.image(
                                    fit: BoxFit.contain,
                                  ),
                                ),

                                const SizedBox(height: 18),
                                const CommonText.regular(
                                  'Your registration is complete.\nWelcome to Car Comfort.',
                                  size: 16,
                                  textAlign: TextAlign.center,
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                    Obx(
                      () => AppButton(
                        label: controller.isLoading.value
                            ? 'Checking...'
                            : 'Continue',
                        onPressed: controller.isLoading.value
                            ? null
                            : controller.refreshDriverApprovalStatusFromReview,
                        bgColor: const Color(0xffF2051F),
                        btnCornerRadius: 14,
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
                  ),
                  const SizedBox(width: 10),
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
