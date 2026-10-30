import 'package:flutter/material.dart';
import 'package:flutter_html/flutter_html.dart';
import 'package:get/get.dart';

import '../../gen/assets.gen.dart';
import '../../routes/app_pages.dart';
import '../../theme/design_tokens.dart';
import '../../widgets/text.dart';
import '../driver_dashboard/driver_header_back_button.dart';
import '../settings/legal_html_styles.dart';
import 'driver_privacy_terms_controller.dart';

/// Driver: Privacy Policy & Terms from [GET /api/legal-page].
class DriverPrivacyTermsView extends GetView<DriverPrivacyTermsController> {
  const DriverPrivacyTermsView({super.key});

  static const Color _sectionGrey = Color(0xff5E5E5E);

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;

    return Scaffold(
      backgroundColor: const Color(0xffFAFAFA),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
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
                        const DriverHeaderBackButton(),
                        const Expanded(
                          child: Center(
                            child: CommonText.regular(
                              'Privacy Policy / Terms',
                              color: Colors.white,
                              size: 16,
                            ),
                          ),
                        ),
                        Material(
                          color: Colors.white,
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
              final terms = controller.termsHtml.value;
              final privacy = controller.privacyHtml.value;
              if (err != null &&
                  err.isNotEmpty &&
                  terms.isEmpty &&
                  privacy.isEmpty) {
                return ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
                  children: [
                    CommonText.regular(
                      err,
                      size: 14,
                      color: Colors.red.shade700,
                    ),
                    const SizedBox(height: 16),
                    TextButton(
                      onPressed: controller.fetchBoth,
                      child: const CommonText.medium('Try again', size: 14),
                    ),
                  ],
                );
              }
              return SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (terms.isNotEmpty) ...[
                      CommonText.bold(
                        controller.termsSectionTitle.value,
                        size: 18,
                        color: const Color(0xff2C2C2E),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      Html(
                        data: terms,
                        style: legalHtmlStyles(bodyColor: _sectionGrey),
                      ),
                      const SizedBox(height: AppSpacing.xl),
                    ],
                    if (privacy.isNotEmpty) ...[
                      CommonText.bold(
                        controller.privacySectionTitle.value,
                        size: 18,
                        color: const Color(0xff2C2C2E),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      Html(
                        data: privacy,
                        style: legalHtmlStyles(bodyColor: _sectionGrey),
                      ),
                    ],
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
