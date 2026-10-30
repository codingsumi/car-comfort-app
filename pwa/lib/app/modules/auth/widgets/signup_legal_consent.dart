import 'package:car_comfort/app/utils/extensions/extension.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../network/response/legal_page_response.dart';
import '../../../utils/legal_pages_navigation.dart';
import '../../../widgets/text.dart';
import '../auth_controller.dart';

/// Signup: open each required legal document and accept on the document screen.
class SignupLegalConsent extends StatelessWidget {
  const SignupLegalConsent({
    super.key,
    required this.controller,
    required this.audience,
  });

  final AuthController controller;
  final LegalAudience audience;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      if (controller.signupLegalLoading.value) {
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Center(
            child: SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: context.colorScheme.onPrimary,
              ),
            ),
          ),
        );
      }

      final pages = controller.signupLegalPages;
      if (pages.isEmpty) {
        return CommonText.regular(
          'Unable to load legal documents. Check your connection and try again.',
          color: Colors.white70,
          size: 13,
        ).paddingOnly(bottom: 8);
      }

      final acceptedCount = pages
          .where(
            (p) => controller.isSignupLegalAccepted((p.slug ?? '').trim()),
          )
          .length;

      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CommonText.regular(
            'Open each document, read it, and check the agreement box at the bottom:',
            color: context.colorScheme.onPrimary.withValues(alpha: 0.85),
            size: 14,
          ).paddingOnly(bottom: 6),
          CommonText.regular(
            '$acceptedCount of ${pages.length} accepted',
            color: context.colorScheme.onPrimary.withValues(alpha: 0.65),
            size: 12,
          ).paddingOnly(bottom: 10),
          ...pages.map(
            (page) => _ConsentRow(
              controller: controller,
              page: page,
            ),
          ),
        ],
      );
    });
  }
}

class _ConsentRow extends StatelessWidget {
  const _ConsentRow({
    required this.controller,
    required this.page,
  });

  final AuthController controller;
  final LegalPageData page;

  @override
  Widget build(BuildContext context) {
    final slug = (page.slug ?? '').trim();
    if (slug.isEmpty) return const SizedBox.shrink();

    return Obx(() {
      final viewed = controller.isSignupLegalViewed(slug);
      final accepted = controller.isSignupLegalAccepted(slug);
      final title = page.displayTitle;

      final status = _ConsentStatus.fromFlags(viewed: viewed, accepted: accepted);

      return Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () => controller.openSignupLegalPage(page),
            borderRadius: BorderRadius.circular(12),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.22),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: accepted
                      ? const Color(0xffF2051F).withValues(alpha: 0.6)
                      : Colors.white24,
                ),
              ),
              child: Row(
                children: [
                  _StatusIcon(status: status),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: TextStyle(
                            color: context.colorScheme.onPrimary,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          status.label,
                          style: TextStyle(
                            color: status.labelColor,
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    Icons.chevron_right_rounded,
                    color: context.colorScheme.onPrimary.withValues(alpha: 0.7),
                    size: 22,
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    });
  }
}

enum _ConsentStatus {
  notReviewed(
    label: 'Tap to open and review',
    labelColor: Color(0xFFFFB74D),
    icon: Icons.radio_button_unchecked,
    iconColor: Color(0xFFFFB74D),
  ),
  pendingAcceptance(
    label: 'Opened — accept at bottom of document',
    labelColor: Color(0xFF90CAF9),
    icon: Icons.visibility_outlined,
    iconColor: Color(0xFF90CAF9),
  ),
  accepted(
    label: 'Accepted',
    labelColor: Color(0xFF81C784),
    icon: Icons.check_circle,
    iconColor: Color(0xFF81C784),
  );

  const _ConsentStatus({
    required this.label,
    required this.labelColor,
    required this.icon,
    required this.iconColor,
  });

  final String label;
  final Color labelColor;
  final IconData icon;
  final Color iconColor;

  factory _ConsentStatus.fromFlags({
    required bool viewed,
    required bool accepted,
  }) {
    if (accepted) return _ConsentStatus.accepted;
    if (viewed) return _ConsentStatus.pendingAcceptance;
    return _ConsentStatus.notReviewed;
  }
}

class _StatusIcon extends StatelessWidget {
  const _StatusIcon({required this.status});

  final _ConsentStatus status;

  @override
  Widget build(BuildContext context) {
    return Icon(status.icon, color: status.iconColor, size: 22);
  }
}
