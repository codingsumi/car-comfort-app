import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_html/flutter_html.dart';
import 'package:get/get.dart';

import '../../gen/assets.gen.dart';
import '../../utils/legal_pages_navigation.dart';
import '../../widgets/text.dart';
import '../auth/widgets/provider_signup_legal_document_footer.dart';
import '../driver_dashboard/driver_header_back_button.dart';
import 'legal_html_styles.dart';
import 'legal_page_controller.dart';

String? _signupConsentSlugFromArguments() {
  final args = LegalPagesNavigation.currentDocumentRouteData();
  final slug = args['signupConsentSlug']?.toString().trim() ?? '';
  return slug.isEmpty ? null : slug;
}

/// Renders CMS HTML from [GET /api/legal-page?page=…].
class LegalDocumentView extends StatelessWidget {
  const LegalDocumentView({super.key, required this.controllerTag});

  final String controllerTag;

  LegalPageController get controller =>
      Get.find<LegalPageController>(tag: controllerTag);

  @override
  Widget build(BuildContext context) {
    final signupConsentSlug = _signupConsentSlugFromArguments();
    final isDesktop = kIsWeb && MediaQuery.sizeOf(context).width >= 900;

    if (isDesktop) {
      return _DesktopLegalDocument(
        controller: controller,
        signupConsentSlug: signupConsentSlug,
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xffFAFAFA),
      body: Column(
        children: [
          Obx(() => _LegalHeader(title: controller.screenTitle.value)),
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
                child: Html(data: html, style: legalHtmlStyles()),
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

class _DesktopLegalDocument extends StatelessWidget {
  const _DesktopLegalDocument({
    required this.controller,
    required this.signupConsentSlug,
  });

  final LegalPageController controller;
  final String? signupConsentSlug;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xffF7F7FA),
      body: Column(
        children: [
          SafeArea(
            bottom: false,
            child: Container(
              height: 88,
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(bottom: BorderSide(color: Color(0xffE8E9EF))),
              ),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 1120),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: Obx(
                      () => Row(
                        children: [
                          _DesktopBackButton(
                            onPressed: LegalPagesNavigation.backFromDocument,
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                CommonText.bold(
                                  controller.screenTitle.value,
                                  size: 24,
                                  color: const Color(0xff202124),
                                ),
                                const SizedBox(height: 3),
                                const CommonText.regular(
                                  'Review how CarComfort handles your information.',
                                  size: 13,
                                  color: Color(0xff757575),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
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

              return SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(32, 36, 32, 48),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 1040),
                    child: _DesktopLegalContent(controller: controller),
                  ),
                ),
              );
            }),
          ),
          if (signupConsentSlug != null)
            ProviderSignupLegalDocumentFooter(
              slug: signupConsentSlug!,
              documentTitle: controller.screenTitle.value,
            ),
        ],
      ),
    );
  }
}

class _DesktopBackButton extends StatelessWidget {
  const _DesktopBackButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xffF3F4F7),
      shape: const CircleBorder(),
      child: IconButton(
        onPressed: onPressed,
        tooltip: 'Back',
        icon: const Icon(
          Icons.arrow_back_rounded,
          size: 22,
          color: Color(0xff202124),
        ),
      ),
    );
  }
}

class _DesktopLegalContent extends StatelessWidget {
  const _DesktopLegalContent({required this.controller});

  final LegalPageController controller;

  @override
  Widget build(BuildContext context) {
    final title = controller.screenTitle.value;
    final error = controller.errorMessage.value;
    final html = controller.htmlContent.value;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          height: 156,
          padding: const EdgeInsets.all(28),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            image: DecorationImage(
              image: Assets.imagesHomeHBg.provider(),
              fit: BoxFit.cover,
            ),
          ),
          child: Container(
            alignment: Alignment.bottomLeft,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              color: Colors.black.withValues(alpha: 0.54),
            ),
            child: CommonText.bold(title, size: 28, color: Colors.white),
          ),
        ),
        const SizedBox(height: 22),
        Container(
          padding: const EdgeInsets.fromLTRB(40, 36, 40, 44),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xffE3E5EC)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x0D161A2A),
                blurRadius: 20,
                offset: Offset(0, 8),
              ),
            ],
          ),
          child: _legalBody(error: error, html: html),
        ),
      ],
    );
  }

  Widget _legalBody({required String? error, required String html}) {
    if (error != null && error.isNotEmpty) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CommonText.regular(error, size: 14, color: Colors.red.shade700),
          const SizedBox(height: 16),
          TextButton(
            onPressed: controller.fetch,
            child: const CommonText.medium('Try again', size: 14),
          ),
        ],
      );
    }
    if (html.isEmpty) {
      return const CommonText.regular(
        'No content is available for this page right now.',
        size: 14,
        color: Color(0xff323232),
      );
    }
    return Html(data: html, style: legalHtmlStyles());
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
                  DriverHeaderBackButton(
                    onTap: LegalPagesNavigation.backFromDocument,
                  ),
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
