import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../widgets/text.dart';
import '../auth_controller.dart';

/// Bottom consent bar shown on [LegalDocumentView] during signup.
class ProviderSignupLegalDocumentFooter extends StatelessWidget {
  const ProviderSignupLegalDocumentFooter({
    super.key,
    required this.slug,
    required this.documentTitle,
  });

  final String slug;
  final String documentTitle;

  @override
  Widget build(BuildContext context) {
    if (!Get.isRegistered<AuthController>()) {
      return const SizedBox.shrink();
    }
    final auth = Get.find<AuthController>();
    final bottom = MediaQuery.paddingOf(context).bottom;

    return Obx(() {
      final accepted = auth.isSignupLegalAccepted(slug);

      return Material(
        elevation: 8,
        color: Colors.white,
        child: SafeArea(
          top: false,
          child: Padding(
            padding: EdgeInsets.fromLTRB(16, 12, 16, 12 + bottom),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Divider(height: 1),
                const SizedBox(height: 12),
                InkWell(
                  onTap: () => _onAcceptChanged(auth, !accepted),
                  borderRadius: BorderRadius.circular(8),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SizedBox(
                          width: 24,
                          height: 24,
                          child: Checkbox(
                            value: accepted,
                            onChanged: (v) =>
                                _onAcceptChanged(auth, v ?? false),
                            activeColor: const Color(0xffF2051F),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(4),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: CommonText.regular(
                            'I have read and agree to the $documentTitle',
                            size: 14,
                            color: const Color(0xff323232),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                if (accepted) ...[
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: () => Get.back(),
                    style: TextButton.styleFrom(
                      foregroundColor: const Color(0xffF2051F),
                    ),
                    child: const Text('Back to registration'),
                  ),
                ],
              ],
            ),
          ),
        ),
      );
    });
  }

  void _onAcceptChanged(AuthController auth, bool value) {
    if (!value) {
      auth.setSignupLegalAccepted(slug, false);
      return;
    }
    auth.setSignupLegalAccepted(slug, true);
  }
}
