import 'dart:io';

import 'package:flutter/material.dart';

import 'text.dart';

/// How the driver wants to open turn-by-turn directions.
enum DriverNavigationChoice {
  externalMaps,
  inAppMapbox,
}

/// Bottom sheet: platform maps app (Apple / Google) or in-app Mapbox navigation.
Future<DriverNavigationChoice?> showDriverNavigationChooser(
  BuildContext context,
) {
  final platformMapsLabel = Platform.isIOS ? 'Apple Maps' : 'Google Maps';
  final platformMapsHint = Platform.isIOS
      ? 'Opens Apple Maps from your current location — tap Go to start'
      : 'Opens Google Maps and starts driving directions';

  return showModalBottomSheet<DriverNavigationChoice>(
    context: context,
    backgroundColor: Colors.transparent,
    isScrollControlled: true,
    builder: (sheetContext) {
      return SafeArea(
        top: false,
        child: Container(
          margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
          ),
          padding: const EdgeInsets.fromLTRB(18, 12, 18, 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 44,
                  height: 5,
                  decoration: BoxDecoration(
                    color: const Color(0xffD0D0D0),
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const CommonText.medium(
                'Start navigation',
                size: 18,
                color: Color(0xff1B1B1F),
              ),
              const SizedBox(height: 6),
              const CommonText.regular(
                'Choose how you want to get turn-by-turn directions.',
                size: 13,
                color: Color(0xff6B7280),
              ),
              const SizedBox(height: 12),
              _NavigationOptionTile(
                icon: Icons.map_outlined,
                label: platformMapsLabel,
                subtitle: platformMapsHint,
                onTap: () => Navigator.of(sheetContext).pop(
                  DriverNavigationChoice.externalMaps,
                ),
              ),
              _NavigationOptionTile(
                icon: Icons.navigation_outlined,
                label: 'In-app navigation',
                subtitle: 'Turn-by-turn inside Car Comfort',
                onTap: () => Navigator.of(sheetContext).pop(
                  DriverNavigationChoice.inAppMapbox,
                ),
              ),
              TextButton(
                onPressed: () => Navigator.of(sheetContext).pop(),
                child: const CommonText.medium(
                  'Cancel',
                  size: 15,
                  color: Color(0xff6B7280),
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}

class _NavigationOptionTile extends StatelessWidget {
  const _NavigationOptionTile({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: const Color(0xffFAFAFA),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xffE8E8EF)),
        ),
        child: Row(
          children: [
            Icon(icon, color: const Color(0xff1C1C1E), size: 24),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  CommonText.medium(
                    label,
                    size: 15,
                    color: const Color(0xff1B1B1F),
                  ),
                  const SizedBox(height: 2),
                  CommonText.regular(
                    subtitle,
                    size: 12,
                    color: const Color(0xff6B7280),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              color: Color(0xff9CA3AF),
            ),
          ],
        ),
      ),
    );
  }
}
