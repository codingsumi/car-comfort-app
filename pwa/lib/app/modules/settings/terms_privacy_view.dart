import 'package:flutter/material.dart';

import '../../theme/design_tokens.dart';
import '../../widgets/text.dart';

class TermsPrivacyView extends StatelessWidget {
  const TermsPrivacyView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xffFAFAFA),
      appBar: AppBar(title: const CommonText.bold('Terms & Privacy Policy', size: 20)),
      body: const SingleChildScrollView(
        padding: AppInsets.card,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CommonText.bold('Terms of Service', size: 18),
            SizedBox(height: AppSpacing.sm),
            CommonText.regular(
              'By using CarComfort services, you agree to the terms for booking, payment, cancellation, and provider conduct.',
            ),
            SizedBox(height: AppSpacing.lg - 2),
            CommonText.bold('Privacy Policy', size: 18),
            SizedBox(height: AppSpacing.sm),
            CommonText.regular(
              'We use your location and profile details to deliver EV charging and car wash services efficiently and safely.',
            ),
            SizedBox(height: AppSpacing.sm),
            CommonText.regular(
              'Your data is protected and used only for service, communication, and product improvement purposes.',
            ),
          ],
        ),
      ),
    );
  }
}
