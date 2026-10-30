import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../services/driver_mapbox_navigation_service.dart';
import 'button.dart';

/// Opens native turn-by-turn navigation for the active driver leg.
class DriverTurnByTurnButton extends StatelessWidget {
  const DriverTurnByTurnButton({
    super.key,
    required this.onNavigate,
    this.label = 'Start navigation',
  });

  final Future<void> Function() onNavigate;
  final String label;

  @override
  Widget build(BuildContext context) {
    final nav = Get.find<DriverMapboxNavigationService>();
    if (!nav.isSupported) return const SizedBox.shrink();

    return AppButton(
      label: label,
      onPressed: () async => onNavigate(),
      type: ButtonType.tonal,
      bgColor: const Color(0xffE8EEF5),
      txtColor: const Color(0xff1C1C1E),
      btnCornerRadius: 14,
      vPadding: 12,
      textSize: 15,
    );
  }
}
