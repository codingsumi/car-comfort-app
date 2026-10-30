import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../gen/assets.gen.dart';
import '../../theme/design_tokens.dart';
import '../../utils/extensions/extension.dart';
import '../../widgets/button.dart';
import '../../widgets/text.dart';
import 'onboarding_controller.dart';

class OnboardingView extends GetView<OnboardingController> {
  const OnboardingView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: [
          Assets.imagesSplashBg.image(
            fit: BoxFit.cover,
          ),
          Container(color: Colors.black.withValues(alpha: 0.35)),
          SafeArea(
            child: Column(
              children: [
                Expanded(
                  child: PageView.builder(
                    controller: controller.pageController,
                    itemCount: controller.slides.length,
                    onPageChanged: controller.onPageChanged,
                    itemBuilder: (_, index) {
                      final slide = controller.slides[index];
                      return Padding(
                        padding: EdgeInsets.fromLTRB(AppSpacing.xl, 120, AppSpacing.xl, AppSpacing.xxl),
                        child: Align(
                          alignment: Alignment.bottomCenter,
                          child: Container(
                            padding: AppInsets.card,
                            decoration: BoxDecoration(
                              color: context.colorScheme.onPrimary,
                              borderRadius: BorderRadius.circular(AppRadius.xxl),
                            ),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                CommonText.bold(slide.title, size: AppTextSize.heading, color: const Color(0xff001C26)),
                                const SizedBox(height: AppSpacing.sm + 2),
                                CommonText.regular(slide.subtitle, size: AppTextSize.body, color: const Color(0xff4C5F78)),
                                if (slide.bullets.isNotEmpty) ...[
                                  const SizedBox(height: AppSpacing.lg),
                                  ...slide.bullets.map(
                                    (item) => Padding(
                                      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                                      child: Row(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          const Padding(
                                            padding: EdgeInsets.only(top: 7),
                                            child: Icon(Icons.circle, size: 8, color: Color(0xffC4101F)),
                                          ),
                                          const SizedBox(width: AppSpacing.sm + 2),
                                          Expanded(
                                            child: CommonText.regular(item, size: AppTextSize.body, color: const Color(0xff3B3D47)),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ],
                                const SizedBox(height: AppSpacing.lg + 2),
                                AppButton(
                                  label: slide.primaryActionText,
                                  onPressed: controller.onPrimaryAction,
                                  bgColor: const Color(0xffC4101F),
                                ),
                                if (slide.showSkip)
                                  Center(
                                    child: TextButton(
                                      onPressed: controller.skip,
                                      child: const CommonText.medium('Skip for Now', color: Color(0xff4C5F78)),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
                Obx(
                  () => Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(
                      controller.slides.length,
                      (index) => AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        margin: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: AppSpacing.lg),
                        height: 8,
                        width: controller.currentPage.value == index ? 24 : 8,
                        decoration: BoxDecoration(
                          color: controller.currentPage.value == index ? const Color(0xffC4101F) : Colors.white70,
                          borderRadius: BorderRadius.circular(99),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
