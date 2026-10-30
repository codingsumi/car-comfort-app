import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../routes/app_pages.dart';

/// Legacy onboarding routes (insurance / registration) redirect here.
class RedirectToBackgroundCheckView extends StatefulWidget {
  const RedirectToBackgroundCheckView({super.key});

  @override
  State<RedirectToBackgroundCheckView> createState() =>
      _RedirectToBackgroundCheckViewState();
}

class _RedirectToBackgroundCheckViewState
    extends State<RedirectToBackgroundCheckView> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (Get.currentRoute != Routes.BACKGROUND_CHECK) {
        Get.offNamed(Routes.BACKGROUND_CHECK);
      }
    });
  }

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
