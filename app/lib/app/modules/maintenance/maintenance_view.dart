import 'package:car_comfort/app/gen/assets.gen.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';

import '../../theme/design_tokens.dart';
import '../../widgets/button.dart';
import '../../widgets/text.dart';
import 'maintenance_controller.dart';

class MaintenanceView extends GetView<MaintenanceController> {
  const MaintenanceView({super.key});

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(
        statusBarIconBrightness: Brightness.dark,
        statusBarBrightness: Brightness.light,
        statusBarColor: Colors.transparent,
      ),
      child: Scaffold(
        backgroundColor: const Color(0xffFAFAFA),
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            child: GetBuilder<MaintenanceController>(
              builder: (c) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: 24),
                    Center(
                      child: Assets.launcherLogo.image(width: 140, fit: BoxFit.contain),
                    ),
                    const Spacer(),
                    Icon(
                      Icons.construction_rounded,
                      size: 72,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    const CommonText.bold(
                      'Under maintenance',
                      size: 24,
                      textAlign: TextAlign.center,
                      color: Color(0xff1B1B1F),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    CommonText.regular(
                      c.status.displayMessage,
                      size: 15,
                      textAlign: TextAlign.center,
                      color: const Color(0xff6B7280),
                    ),
                    if (c.status.expectedReturn != null &&
                        c.status.expectedReturn!.trim().isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.lg),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 14,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xffE8E8EF)),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.schedule_rounded,
                              color: Color(0xff6B7280),
                              size: 22,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const CommonText.medium(
                                    'Expected back',
                                    size: 12,
                                    color: Color(0xff6B7280),
                                  ),
                                  const SizedBox(height: 4),
                                  CommonText.semiBold(
                                    c.status.expectedReturn!,
                                    size: 14,
                                    color: Color(0xff1B1B1F),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    const Spacer(flex: 2),
                    Obx(
                      () => AppButton(
                        label: c.isChecking.value ? 'Checking…' : 'Try again',
                        onPressed: c.isChecking.value ? null : c.retry,
                        bgColor: const Color(0xffF2051F),
                        btnCornerRadius: 14,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    const CommonText.regular(
                      'We’ll check if the service is available again.',
                      size: 13,
                      textAlign: TextAlign.center,
                      color: Color(0xff9CA3AF),
                    ),
                    const SizedBox(height: 16),
                  ],
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}
