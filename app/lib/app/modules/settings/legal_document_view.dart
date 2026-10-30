import 'package:flutter/material.dart';
import 'package:flutter_html/flutter_html.dart';
import 'package:get/get.dart';

import '../../gen/assets.gen.dart';
import '../../widgets/text.dart';
import '../auth/widgets/provider_signup_legal_document_footer.dart';
import '../driver_dashboard/driver_header_back_button.dart';
import 'legal_html_styles.dart';
import 'legal_page_controller.dart';

String? _signupConsentSlugFromArguments() {
  final args = Get.arguments;
  if (args is! Map) return null;
  final slug = args['signupConsentSlug']?.toString().trim() ?? '';
  return slug.isEmpty ? null : slug;
}

/// Renders CMS HTML from [GET /api/legal-page?page=…].
class LegalDocumentView extends GetView<LegalPageController> {
  const LegalDocumentView({super.key});

  @override
  Widget build(BuildContext context) {
    final signupConsentSlug = _signupConsentSlugFromArguments();

    return Scaffold(
      backgroundColor: const Color(0xffFAFAFA),
      body: Column(
        children: [
          Obx(
            () => _LegalHeader(title: controller.screenTitle.value),
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
              if (err != null && err.isNotEmpty) {
                return ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(22, 24, 22, 24),
                  children: [
                    CommonText.regular(
                      err,
                      size: 14,
                      color: Colors.red.shade700,
                    ),
                    const SizedBox(height: 16),
                    TextButton(
                      onPressed: controller.fetch,
                      child: const CommonText.medium('Try again', size: 14),
                    ),
                  ],
                );
              }
              final html = controller.htmlContent.value;
              if (html.isEmpty) {
                return ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(22, 24, 22, 24),
                  children: const [
                    CommonText.regular(
                      'No content is available for this page right now.',
                      size: 14,
                      color: Color(0xff323232),
                    ),
                  ],
                );
              }
              return SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(22, 16, 22, 32),
                child: Html(
                  data: html,
                  style: legalHtmlStyles(),
                ),
              );
            }),
          ),
          if (signupConsentSlug != null)
            ProviderSignupLegalDocumentFooter(
              slug: signupConsentSlug,
              documentTitle: controller.screenTitle.value,
            ),
        ],
      ),
    );
  }
}

class _LegalHeader extends StatelessWidget {
  const _LegalHeader({required this.title});

  final String title;

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
                  DriverHeaderBackButton(onTap: () => Get.back()),
                  const SizedBox(width: 10),
                  Expanded(
                    child: CommonText.regular(
                      title,
                      color: Colors.white,
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
