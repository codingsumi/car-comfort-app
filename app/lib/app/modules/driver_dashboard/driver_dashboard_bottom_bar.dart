import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../gen/assets.gen.dart';
import '../../routes/app_pages.dart';
import 'driver_dashboard_controller.dart';

/// Pill nav used on [DriverDashboardView] and wallet sub-screens (payment method,
/// payment history).
class DriverDashboardBottomBar extends GetView<DriverDashboardController> {
  const DriverDashboardBottomBar({super.key});

  static const Color navPillBg = Color(0xff2C2C2E);

  static void onNavItemTap(DriverDashboardController c, int index) {
    c.homeNavIndex.value = index;
    if (index != 0 && c.isServiceDetailsExpanded.value) {
      c.toggleServiceDetails();
    }
    final sub = Get.currentRoute;
    if (sub == Routes.DRIVER_PAYMENT_METHOD ||
        sub == Routes.DRIVER_PAYMENT_HISTORY ||
        sub == Routes.DRIVER_PROFILE ||
        sub == Routes.DRIVER_PROFILE_SETTINGS ||
        sub == Routes.DRIVER_NOTIFICATIONS ||
        sub == Routes.DRIVER_SUPPORT ||
        sub == Routes.DRIVER_PRIVACY_TERMS ||
        sub == Routes.DRIVER_CAR_DETAILS ||
        sub == Routes.DRIVER_CHAT) {
      Get.until((route) => route.settings.name == Routes.DRIVER_DASHBOARD);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        color: Colors.white,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
          child: Obx(
            () => _HomeBottomNavPill(
              selectedIndex: controller.homeNavIndex.value,
              onTap: (i) => onNavItemTap(controller, i),
            ),
          ),
        ),
      ),
    );
  }
}

class _HomeBottomNavPill extends StatelessWidget {
  final int selectedIndex;
  final ValueChanged<int> onTap;

  const _HomeBottomNavPill({
    required this.selectedIndex,
    required this.onTap,
  });

  static const int _tabCount = 5;

  /// Home → Bookings → Wallet → Settings → Support
  static Widget _tabIcon(int index, bool selected) {
    final selCol = DriverDashboardBottomBar.navPillBg;
    final unsel = Colors.white70;
    switch (index) {
      case 0:
        return Assets.imagesIcHome
            .image(width: 22, height: 22, color: selected ? selCol : unsel)
            .marginAll(10);
      case 1:
        return Assets.imagesIcBooking
            .image(width: 22, height: 22, color: selected ? selCol : unsel)
            .marginAll(10);
      case 2:
        return Icon(
          Icons.account_balance_wallet_rounded,
          size: 22,
          color: selected ? selCol : unsel,
        ).marginAll(10);
      case 3:
        return Assets.imagesIcSetting
            .image(width: 22, height: 22, color: selected ? selCol : unsel)
            .marginAll(10);
      case 4:
        return Assets.imagesIcHeadphone
            .image(width: 22, height: 22, color: selected ? selCol : unsel)
            .marginAll(10);
      default:
        return const SizedBox.shrink();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
      decoration: BoxDecoration(
        color: DriverDashboardBottomBar.navPillBg,
        borderRadius: BorderRadius.circular(32),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: List.generate(_tabCount, (i) {
          return InkWell(
            onTap: () => onTap(i),
            borderRadius: BorderRadius.circular(24),
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: selectedIndex == i ? Colors.white : Colors.transparent,
                shape: BoxShape.circle,
              ),
              child: _HomeBottomNavPill._tabIcon(i, selectedIndex == i),
            ),
          );
        }),
      ),
    );
  }
}
