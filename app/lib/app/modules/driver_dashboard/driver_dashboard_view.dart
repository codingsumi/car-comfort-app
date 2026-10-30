import 'dart:async';
import 'dart:math' as math;
import 'dart:ui';

import 'package:car_comfort/app/utils/extensions/extension.dart';
import 'package:car_comfort/app/utils/validator.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:get/get.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart';

import '../../gen/assets.gen.dart';
import '../../network/response/booking_list_response.dart' as bl;
import '../../routes/app_pages.dart';
import '../../theme/design_tokens.dart';
import '../../utils/app_snackbar.dart';
import '../../utils/booking_timer_utils.dart';
import '../../utils/driver_job_duration.dart';
import '../../utils/service_type_label.dart';
import '../../widgets/button.dart';
import '../../widgets/driver_contact_action_card.dart';
import '../../widgets/driver_job_map_symbol.dart';
import '../../widgets/driver_turn_by_turn_button.dart';
import '../../widgets/image.dart';
import '../../widgets/text.dart';
import '../../widgets/text_field.dart';
import 'driver_assigned_job_map_detail_sheet.dart';
import 'driver_completed_bookings_view.dart';
import 'driver_job_map_detail_sheet.dart';
import 'driver_dashboard_bottom_bar.dart';
import 'driver_dashboard_controller.dart';
import '../dashboard/cancel_reason_controller.dart';
import '../dashboard/dashboard_booking_timer.dart';
import '../dashboard/dashboard_controller.dart';
import '../driver_settings/driver_settings_view.dart';
import '../driver_settings/driver_support_view.dart';
import 'my_wallet_view.dart';

class DriverDashboardView extends GetView<DriverDashboardController> {
  const DriverDashboardView({super.key});

  static const Color _primaryRed = Color(0xffC4101F);

  @override
  Widget build(BuildContext context) {
    /// Home → Bookings → Wallet → Settings → Support (index 0–4).
    final tabs = <Widget>[
      _HomeTab(controller: controller),
      const DriverBookingsView(),
      const MyWalletView(),
      const DriverSettingsView(),
      const DriverSupportView(showBottomBar: false),
    ];

    return Scaffold(
      backgroundColor: const Color(0xffFAFAFA),
      body: Obx(
        () =>
            IndexedStack(index: controller.homeNavIndex.value, children: tabs),
      ),
      bottomNavigationBar: const DriverDashboardBottomBar().paddingOnly(top: 8),
    );
  }
}

class _HomeTab extends StatelessWidget {
  final DriverDashboardController controller;

  const _HomeTab({required this.controller});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xffFAFAFA),
      body: Stack(
        fit: StackFit.expand,
        children: [
          _MapBackground(
            onMapCreated: controller.onMapCreated,
            onCameraChangeListener: controller.onDriverMapCameraChanged,
            onMapTap: controller.onMapTap,
            onMapScroll: controller.onDriverMapScroll,
          ),
          _NearbyUnassignedBookingsOverlay(controller: controller),
          Obx(() {
            if (!controller.shouldShowDriverLicenseComplianceBanner) {
              return const SizedBox.shrink();
            }
            final blocked = controller.isDriverLicenseAcceptBlocked;
            return Positioned(
              top: MediaQuery.paddingOf(context).top + 88,
              left: 12,
              right: 12,
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: controller.openDriverLicenseRenewal,
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      color: blocked
                          ? const Color(0xFFB42318)
                          : const Color(0xFFB54708),
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.12),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          blocked
                              ? Icons.error_outline_rounded
                              : Icons.warning_amber_rounded,
                          color: Colors.white,
                          size: 22,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              CommonText.bold(
                                blocked
                                    ? 'Account suspended — license expired'
                                    : 'Driver license expiring soon',
                                color: Colors.white,
                                size: 14,
                              ),
                              const SizedBox(height: 4),
                              CommonText.regular(
                                controller.driverLicenseComplianceBannerMessage,
                                color: Colors.white.withValues(alpha: 0.95),
                                size: 12,
                              ),
                              const SizedBox(height: 6),
                              CommonText.bold(
                                'Tap to upload renewed license',
                                color: Colors.white,
                                size: 12,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          }),
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: Container(
                decoration: const BoxDecoration(color: Colors.black54),
                child: Stack(
                  children: [
                    Positioned.fill(
                      child: Assets.imagesHomeHBg.image(fit: BoxFit.fill),
                    ),
                    Positioned.fill(
                      child: BackdropFilter(
                        filter: ImageFilter.blur(sigmaX: 1, sigmaY: 1),
                        child: Container(
                          color: Colors.black.withValues(alpha: 0.5),
                        ),
                      ),
                    ),
                    Container(
                      padding: EdgeInsets.only(
                        left: 16,
                        right: 16,
                        bottom: 12,
                        top: MediaQuery.paddingOf(context).top + 12,
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Obx(() {
                                  controller.profileHeaderRevision.value;
                                  return Row(
                                    children: [
                                      InkWell(
                                        borderRadius: BorderRadius.circular(30),
                                        onTap: () =>
                                            Get.toNamed(Routes.DRIVER_PROFILE),
                                        child: Container(
                                          width: 40,
                                          height: 40,
                                          decoration: BoxDecoration(
                                            shape: BoxShape.circle,
                                            border: Border.all(
                                              color: Colors.white.withValues(
                                                alpha: 0.45,
                                              ),
                                              width: 2,
                                            ),
                                          ),
                                          child: ClipOval(
                                            child: controller.avatarUrl.isEmpty
                                                ? const Icon(
                                                    Icons.person_rounded,
                                                    color: Colors.white,
                                                    size: 24,
                                                  )
                                                : ImageFromNetwork(
                                                    controller.avatarUrl,
                                                    fit: BoxFit.cover,
                                                    placeholderWidget: Container(
                                                      color: Colors.white24,
                                                      child: const Icon(
                                                        Icons.person_rounded,
                                                        color: Colors.white,
                                                        size: 24,
                                                      ),
                                                    ),
                                                  ),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Column(
                                          mainAxisSize: MainAxisSize.min,
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            CommonText.regular(
                                              '${controller.greetingLabel},',
                                              color: Colors.white70,
                                              size: 14,
                                            ),
                                            InkWell(
                                              onTap: () => Get.toNamed(
                                                Routes.DRIVER_PROFILE,
                                              ),
                                              borderRadius:
                                                  BorderRadius.circular(8),
                                              child: Padding(
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                  vertical: 2,
                                                ),
                                                child: CommonText.bold(
                                                  '${controller.displayName}!',
                                                  color: Colors.white,
                                                  size: 22,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  );
                                }),
                              ),
                              _HeaderIconButton(
                                icon: Icons.notifications_none_rounded,
                                onTap: () => Get.toNamed(
                                  Routes.DRIVER_NOTIFICATIONS,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          // FABs + trip panel in a bottom-anchored Column so the buttons
          // always sit flush above the panel with no hardcoded offsets.
          // Rendered after _DriverHomeTripOverlay so FABs stay on top.
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Obx(() {
              controller.driverHomeTripPanel.value;
              final safeBottom = MediaQuery.paddingOf(context).bottom;
              return Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  // FABs stacked vertically, right-aligned, above the panel
                  Padding(
                    padding: EdgeInsets.only(
                      right: 16,
                      bottom: 8,
                      left: 0,
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        FloatingActionButton(
                          heroTag: 'driver_map_unassigned_list',
                          onPressed: () => _openUnassignedBookingsSheet(context),
                          backgroundColor: Colors.white,
                          elevation: 4,
                          shape: const CircleBorder(),
                          child: const Icon(
                            size: 32,
                            Icons.format_list_bulleted_rounded,
                            color: Colors.black87,
                          ),
                        ),
                        const SizedBox(height: 12),
                        FloatingActionButton(
                          heroTag: 'driver_map_recenter',
                          onPressed: () =>
                              unawaited(controller.recenterMapOnUserLocation()),
                          backgroundColor: Colors.black,
                          elevation: 4,
                          shape: const CircleBorder(),
                          child: SvgImageFromAsset.square(
                            Assets.imagesIcCurrentLocation,
                            size: 32,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Trip panel (or empty when no active booking)
                  _DriverHomeTripOverlay(controller: controller),
                  // Safe-area bottom spacing when no panel is shown
                  if (controller.driverHomeTripPanel.value.isEmpty)
                    SizedBox(height: safeBottom),
                ],
              );
            }),
          ),
        ],
      ),
    );
  }

  void _openUnassignedBookingsSheet(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (_) => _UnassignedBookingsBottomSheet(controller: controller),
    );
  }
}

/// Listens to [DashboardController.driverHomeTripPanel] via [ever] + [setState]
/// so the map stack is not rebuilt by [Obx] during the semantics pass.
class _DriverHomeTripOverlay extends StatefulWidget {
  final DriverDashboardController controller;

  const _DriverHomeTripOverlay({required this.controller});

  @override
  State<_DriverHomeTripOverlay> createState() => _DriverHomeTripOverlayState();
}

class _DriverHomeTripOverlayState extends State<_DriverHomeTripOverlay> {
  late String _panel;
  bool _collapsed = false;
  final List<Worker> _workers = [];

  @override
  void initState() {
    super.initState();
    final c = widget.controller;
    _panel = c.driverHomeTripPanel.value;
    _workers.add(
      ever<String>(c.driverHomeTripPanel, (panel) {
        if (!mounted) return;
        setState(() => _panel = panel);
      }),
    );
    _workers.add(
      ever<int>(c.bookingTimerTick, (_) {
        if (!mounted) return;
        if (_panel == DashboardController.driverHomePanelStartPickup) {
          setState(() {});
        }
      }),
    );
    _workers.add(
      ever<bool>(c.isDriverStatusUpdating, (_) {
        if (!mounted) return;
        if (_panel == DashboardController.driverHomePanelStartPickup) {
          setState(() {});
        }
      }),
    );
    _workers.add(
      ever(c.serviceDetail, (_) {
        if (!mounted || _panel.isEmpty) return;
        setState(() {});
      }),
    );
  }

  @override
  void dispose() {
    for (final worker in _workers) {
      worker.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_panel.isEmpty) {
      return const SizedBox.shrink();
    }
    return Align(
      alignment: Alignment.bottomCenter,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Collapse / expand handle — always visible so driver can toggle
          Align(
            alignment: Alignment.centerRight,
            child: Padding(
              padding: const EdgeInsets.only(right: 16, bottom: 4),
              child: GestureDetector(
                onTap: () => setState(() => _collapsed = !_collapsed),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: const Color(0xffC4101F),
                      width: 1.5,
                    ),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x22000000),
                        blurRadius: 6,
                        offset: Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        _collapsed
                            ? Icons.keyboard_arrow_up_rounded
                            : Icons.keyboard_arrow_down_rounded,
                        size: 18,
                        color: const Color(0xffC4101F),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        _collapsed ? 'Show Panel' : 'Hide Panel',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Color(0xffC4101F),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          if (!_collapsed)
            _DriverHomeTripPanelBody(
              controller: widget.controller,
              panel: _panel,
            ),
        ],
      ),
    );
  }
}

/// Renders the driver home trip sheet from [DashboardController.driverHomeTripPanel].
class _DriverHomeTripPanelBody extends StatelessWidget {
  final DriverDashboardController controller;
  final String panel;

  const _DriverHomeTripPanelBody({
    required this.controller,
    required this.panel,
  });

  @override
  Widget build(BuildContext context) {
    if (panel.isEmpty) {
      return const SizedBox.shrink();
    }
    switch (panel) {
      case DashboardController.driverHomePanelSafety:
        return _SafetyFeaturesPanel(controller: controller);
      case DashboardController.driverHomePanelPickupHandover:
        return _DriverPickupHandoverPanel(controller: controller);
      case DashboardController.driverHomePanelReadyToHead:
        return _ReadyToHeadPanel(controller: controller);
      case DashboardController.driverHomePanelEnrouteService:
        return _HaveYouArriveLocationPanel(controller: controller);
      case DashboardController.driverHomePanelArriveService:
        return _ArriveForServicePanel(controller: controller);
      case DashboardController.driverHomePanelWaitingService:
        return _WaitingOnVehicleServicePanel(controller: controller);
      case DashboardController.driverHomePanelSelectLocation:
        return _SelectNewServiceLocationPanel(controller: controller);
      case DashboardController.driverHomePanelCancelTrip:
        return _CancelTripPanel(controller: controller);
      case DashboardController.driverHomePanelDropoff:
        return _VehicleIsEnroteToDropOffPannal(controller: controller);
      case DashboardController.driverHomePanelPickupEnRoute:
        return _StartedServicePanel(controller: controller);
      case DashboardController.driverHomePanelStartPickup:
        return _DriverStartPickupPanel(controller: controller);
      default:
        return const SizedBox.shrink();
    }
  }
}

class _HeaderIconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  final Color? iconColor;

  const _HeaderIconButton({
    required this.icon,
    required this.onTap,
    this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      shape: const CircleBorder(),
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: SizedBox(
          width: 36,
          height: 36,
          child: Icon(
            icon,
            color: iconColor ?? Colors.black87,
            size: 20,
          ),
        ),
      ),
    );
  }
}

class _MapBackground extends StatelessWidget {
  final ValueChanged<MapboxMap>? onMapCreated;
  final OnMapTapListener? onMapTap;
  final OnCameraChangeListener? onCameraChangeListener;
  final OnMapScrollListener? onMapScroll;

  const _MapBackground({
    this.onMapCreated,
    this.onMapTap,
    this.onCameraChangeListener,
    this.onMapScroll,
  });

  @override
  Widget build(BuildContext context) {
    final camera = CameraOptions(
      center: Point(coordinates: Position(-98.0, 39.5)),
      zoom: 2,
      bearing: 0,
      pitch: 0,
    );
    return MapWidget(
      cameraOptions: camera,
      onMapCreated: onMapCreated,
      onTapListener: onMapTap,
      onCameraChangeListener: onCameraChangeListener,
      onScrollListener: onMapScroll,
    );
  }
}

class _UnassignedBookingsBottomSheet extends StatelessWidget {
  final DriverDashboardController controller;

  const _UnassignedBookingsBottomSheet({required this.controller});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height,
        child: Column(
          children: [
            const SizedBox(height: 8),
            Container(
              width: 42,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xffD9D9D9),
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  const Expanded(
                    child: CommonText.semiBold(
                      'Nearby Unassigned Bookings',
                      size: 17,
                    ),
                  ),
                  Obx(() {
                    final count = controller.driverMapOverlayBookings.length;
                    return CommonText.medium(
                      '$count',
                      size: 14,
                      color: const Color(0xff6B7280),
                    );
                  }),
                  const SizedBox(width: 8),
                  Obx(() {
                    final isRefreshing =
                        controller.isDriverNearbyUnassignedLoading.value &&
                        controller.driverNearbyUnassignedInitialLoadDone.value;
                    return Material(
                      color: const Color(0xffF2F2F7),
                      shape: const CircleBorder(),
                      child: InkWell(
                        customBorder: const CircleBorder(),
                        onTap: isRefreshing
                            ? null
                            : () => unawaited(
                                  controller.fetchDriverNearbyUnassignedBookings(
                                    refresh: true,
                                  ),
                                ),
                        child: SizedBox(
                          width: 36,
                          height: 36,
                          child: isRefreshing
                              ? const Padding(
                                  padding: EdgeInsets.all(8),
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(
                                  Icons.refresh_rounded,
                                  size: 20,
                                  color: Color(0xff1C1C1E),
                                ),
                        ),
                      ),
                    );
                  }),
                ],
              ),
            ),
            const SizedBox(height: 10),
            const Divider(height: 1),
            Expanded(
              child: Obx(() {
                controller.driverNearbyUnassignedBookings.length;
                controller.driverPushNewBookings.length;
                controller.acceptingDriverBookingId.value;
                controller.activeDriverBookingId.value;
                controller.hasStartedService.value;
                controller.driverNearbyUnassignedHasMore.value;
                controller.isDriverNearbyUnassignedLoading.value;
                controller.isDriverNearbyUnassignedLoadingMore.value;
                controller.driverNearbyUnassignedInitialLoadDone.value;
                final items = controller.driverMapOverlayBookings.toList();
                final isLoadingFirst =
                    controller.isDriverNearbyUnassignedLoading.value &&
                    items.isEmpty &&
                    !controller.driverNearbyUnassignedInitialLoadDone.value;
                if (isLoadingFirst) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (items.isEmpty) {
                  return Center(
                    child: controller.isDriverNearbyUnassignedLoading.value
                        ? const Padding(
                            padding: EdgeInsets.all(24),
                            child: SizedBox(
                              width: 28,
                              height: 28,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                          )
                        : const CommonText.medium(
                            'No unassigned bookings available right now.',
                            size: 14,
                            color: Color(0xff6B7280),
                          ),
                  );
                }
                final isLoadingMore =
                    controller.isDriverNearbyUnassignedLoadingMore.value;
                final hasMore = controller.driverNearbyUnassignedHasMore.value;
                final listCount = items.length + (isLoadingMore ? 1 : 0);
                return NotificationListener<ScrollNotification>(
                  onNotification: (n) {
                    if (n.metrics.axis != Axis.vertical) return false;
                    if (n is! ScrollUpdateNotification &&
                        n is! ScrollEndNotification) {
                      return false;
                    }
                    final m = n.metrics;
                    if (!m.hasPixels) return false;
                    if (hasMore && m.pixels >= m.maxScrollExtent - 180) {
                      controller.loadMoreDriverNearbyUnassignedBookings();
                    }
                    return false;
                  },
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 10, 16, 20),
                    itemCount: listCount,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (_, i) {
                      if (i >= items.length) {
                        return const Padding(
                          padding: EdgeInsets.symmetric(vertical: 12),
                          child: Center(child: CircularProgressIndicator()),
                        );
                      }
                      return _buildBookingListCard(context, items[i]);
                    },
                  ),
                );
              }),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBookingListCard(BuildContext context, bl.Bookings booking) {
    const cardRed = Color(0xffE70B1C);
    const cardBorder = Color(0xffE8E8EF);
    const detailsBg = Color(0xffF4F4F6);
    final id = booking.id ?? 0;
    // Human-friendly reference: prefer API booking_code; fallback to CC-XXXX.
    final displayRef = _bookingDisplayRef(booking.bookingCode, id);
    final isAccepting = controller.acceptingDriverBookingId.value == id;
    final customerName = controller.customerNameFromBooking(booking);
    final avatarUrl = (() {
      final fromHelper = controller.customerAvatarUrl(booking)?.trim() ?? '';
      if (fromHelper.isNotEmpty) return fromHelper;
      final fromModel = booking.customerDetail?.profilePicture?.trim() ?? '';
      if (fromModel.isNotEmpty) return fromModel;
      final fromGeneric =
          controller.avatarUrlFromDetail(booking.customerDetail)?.trim() ?? '';
      return fromGeneric;
    })();
    final serviceName = bookingServiceTypeDisplay(booking.serviceType);
    final amount = booking.displayProviderEarningLabel;
    final schedule = formatProviderTimeOfServiceLabel(
      scheduleType: booking.scheduleType,
      scheduledAtIso: bookingScheduledAtIso(
        scheduledAt: booking.scheduledAt,
        serviceDatetime: booking.serviceDatetime,
      ),
      createdAtIso: booking.createdAt,
    );

    final locationText = booking.serviceLocation?.address ?? "";

    return Container(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: cardBorder),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipOval(
                child: avatarUrl.isEmpty
                    ? Container(
                        width: 52,
                        height: 52,
                        color: const Color(0xffE8E8EF),
                        child: const Icon(
                          Icons.person_rounded,
                          color: Colors.grey,
                          size: 28,
                        ),
                      )
                    : ImageFromNetwork(
                        avatarUrl,
                        width: 52,
                        height: 52,
                        fit: BoxFit.cover,
                        placeholderWidget: Container(
                          width: 52,
                          height: 52,
                          color: const Color(0xffE8E8EF),
                        ),
                      ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CommonText.semiBold(customerName, size: 16, maxLines: 1),
                    const SizedBox(height: 4),
                    CommonText.regular(
                      serviceName.isEmpty ? 'Service' : serviceName,
                      size: 13,
                      color: Colors.grey.shade600,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const CommonText.regular(
                    'Your payout',
                    size: 11,
                    color: Color(0xff6D6D72),
                  ),
                  const SizedBox(height: 2),
                  CommonText.bold(amount, size: 17, color: cardRed),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.black,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: CommonText.regular(
                      displayRef,
                      size: 11,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: detailsBg,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      Icons.calendar_today_outlined,
                      size: 18,
                      color: Colors.grey.shade700,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: CommonText.regular(
                        schedule,
                        size: 13,
                        color: Colors.grey.shade800,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      Icons.location_on_outlined,
                      size: 18,
                      color: Colors.grey.shade700,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: CommonText.regular(
                        locationText,
                        size: 13,
                        color: Colors.grey.shade800,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: AppButton(
                  label: isAccepting ? 'Accepting…' : 'Accept',
                  onPressed: (isAccepting || id <= 0)
                      ? null
                      : () => unawaited(controller.acceptDriverBooking(id)),
                  bgColor: Colors.black,
                  txtColor: Colors.white,
                  textSize: 14,
                  btnCornerRadius: 10,
                  vPadding: 11,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: AppButton(
                  label: 'Reject',
                  onPressed: (isAccepting || id <= 0)
                      ? null
                      : () => unawaited(controller.rejectDriverBooking(id)),
                  bgColor: const Color(0xffE70B1C),
                  txtColor: Colors.white,
                  textSize: 14,
                  btnCornerRadius: 10,
                  vPadding: 11,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _removeBookingFromDashboardLists(int bookingId) {
    controller.removeBookingFromNearbyUnassignedLists(bookingId);
  }
}

/// Overlay that renders **all** driver map pins:
/// • Dark navy pins for the provider's own assigned/confirmed bookings.
/// • White pins for nearby unassigned bookings the driver can accept.
class _NearbyUnassignedBookingsOverlay extends StatefulWidget {
  final DriverDashboardController controller;

  const _NearbyUnassignedBookingsOverlay({required this.controller});

  @override
  State<_NearbyUnassignedBookingsOverlay> createState() =>
      _NearbyUnassignedBookingsOverlayState();
}

class _NearbyUnassignedBookingsOverlayState
    extends State<_NearbyUnassignedBookingsOverlay> {
  static const double _symbolIconSize = 22.5;
  static const double _symbolMinWidth = 32;
  /// Horizontal centering estimate for map pins (badge may grow for longer labels).
  static const double _symbolAnchorWidth = 46;
  static const double _symbolHeight = 54;

  Timer? _debounce;
  Worker? _tickWorker;
  Worker? _listWorker;
  Worker? _pushListWorker;
  Worker? _assignedListWorker;
  /// Pixel positions for unassigned booking pins (keyed by booking id).
  final Map<int, Offset> _unassignedPixels = {};
  /// Pixel positions for assigned booking pins (keyed by booking id).
  final Map<int, Offset> _assignedPixels = {};

  @override
  void initState() {
    super.initState();
    _tickWorker = ever(widget.controller.driverNearbyMapLayoutTick, (_) {
      _scheduleProject();
    });
    _listWorker = ever(widget.controller.driverNearbyUnassignedBookings, (_) {
      _scheduleProject();
    });
    _pushListWorker = ever(widget.controller.driverPushNewBookings, (_) {
      _scheduleProject();
    });
    _assignedListWorker = ever(widget.controller.driverRawBookings, (_) {
      _scheduleProject();
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _scheduleProject());
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _tickWorker?.dispose();
    _listWorker?.dispose();
    _pushListWorker?.dispose();
    _assignedListWorker?.dispose();
    super.dispose();
  }

  void _scheduleProject() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 24), _projectToScreen);
    if (_unassignedPixels.isEmpty && _assignedPixels.isEmpty) {
      unawaited(_projectToScreen());
    }
  }

  Future<void> _projectToScreen() async {
    final map = widget.controller.mapbox;
    if (!mounted || map == null) return;
    final showUnassigned =
        widget.controller.driverHomeMapShowsNearbyUnassignedPins;
    final showAssigned = widget.controller.driverHomeMapShowsAssignedPins;

    if (!showUnassigned && !showAssigned) {
      if (_unassignedPixels.isNotEmpty || _assignedPixels.isNotEmpty) {
        setState(() {
          _unassignedPixels.clear();
          _assignedPixels.clear();
        });
      }
      return;
    }

    final size = MediaQuery.sizeOf(context);
    final maxH = size.height;
    final maxW = size.width;
    final padTop = MediaQuery.paddingOf(context).top;

    // ── Project unassigned bookings ───────────────────────────────────────
    final nextUnassigned = <int, Offset>{};
    if (showUnassigned) {
      final unassigned = widget.controller.driverMapOverlayBookings.toList();
      var fallbackIndex = 0;
      final withCoords = <({int id, double lat, double lng})>[];
      for (final b in unassigned) {
        final id = b.id;
        if (id == null) continue;
        final lat = b.mapCardLatitude;
        final lng = b.mapCardLongitude;
        if (lat != null && lng != null) {
          withCoords.add((id: id, lat: lat, lng: lng));
        } else {
          final y = (padTop + 120 + fallbackIndex * 72.0)
              .clamp(72.0, maxH - _symbolHeight - 24);
          nextUnassigned[id] = Offset(maxW * 0.5, y);
          fallbackIndex++;
        }
      }
      if (withCoords.isNotEmpty) {
        final projected = await Future.wait(
          withCoords.map((entry) async {
            try {
              final px = await map.pixelForCoordinate(
                Point(coordinates: Position(entry.lng, entry.lat)),
              );
              return (id: entry.id, offset: Offset(px.x, px.y));
            } catch (_) {
              return null;
            }
          }),
        );
        for (final item in projected) {
          if (item == null) continue;
          nextUnassigned[item.id] = item.offset;
        }
      }
    }

    // ── Project assigned bookings ─────────────────────────────────────────
    final nextAssigned = <int, Offset>{};
    if (showAssigned) {
      final assigned =
          widget.controller.driverAssignedActiveMapBookings.toList();
      final withCoords = <({int id, double lat, double lng})>[];
      for (final b in assigned) {
        final id = b.id;
        if (id == null) continue;
        // Skip if same id already shown as unassigned (shouldn't happen, but guard).
        if (nextUnassigned.containsKey(id)) continue;
        final lat = b.mapCardLatitude;
        final lng = b.mapCardLongitude;
        if (lat != null && lng != null) {
          withCoords.add((id: id, lat: lat, lng: lng));
        }
      }
      if (withCoords.isNotEmpty) {
        final projected = await Future.wait(
          withCoords.map((entry) async {
            try {
              final px = await map.pixelForCoordinate(
                Point(coordinates: Position(entry.lng, entry.lat)),
              );
              return (id: entry.id, offset: Offset(px.x, px.y));
            } catch (_) {
              return null;
            }
          }),
        );
        for (final item in projected) {
          if (item == null) continue;
          nextAssigned[item.id] = item.offset;
        }
      }
    }

    if (!mounted) return;
    setState(() {
      _unassignedPixels
        ..clear()
        ..addAll(nextUnassigned);
      _assignedPixels
        ..clear()
        ..addAll(nextAssigned);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      widget.controller.driverNearbyUnassignedBookings.length;
      widget.controller.driverPushNewBookings.length;
      widget.controller.driverRawBookings.length;
      widget.controller.driverNearbyMapLayoutTick.value;
      widget.controller.acceptingDriverBookingId.value;
      widget.controller.activeDriverBookingId.value;
      widget.controller.hasStartedService.value;

      final showUnassigned =
          widget.controller.driverHomeMapShowsNearbyUnassignedPins;
      final showAssigned = widget.controller.driverHomeMapShowsAssignedPins;
      if (!showUnassigned && !showAssigned) {
        return const SizedBox.shrink();
      }

      final size = MediaQuery.sizeOf(context);
      final maxW = size.width;
      final maxH = size.height;

      return Stack(
        clipBehavior: Clip.none,
        children: [
          // Assigned pins (rendered first / below so unassigned pins appear on top).
          if (showAssigned)
            for (final b
                in widget.controller.driverAssignedActiveMapBookings)
              if (b.id != null)
                _buildAssignedSymbol(context, b, maxW, maxH),
          // Unassigned pins.
          if (showUnassigned)
            for (final b in widget.controller.driverMapOverlayBookings)
              if (b.id != null)
                _buildUnassignedSymbol(context, b, maxW, maxH),
        ],
      );
    });
  }

  // ── Unassigned pin ────────────────────────────────────────────────────────

  Widget _buildUnassignedSymbol(
    BuildContext context,
    bl.Bookings b,
    double maxW,
    double maxH,
  ) {
    final id = b.id!;
    final anchor = _unassignedPixels[id];
    if (anchor == null) return const SizedBox.shrink();

    const margin = 8.0;
    var left = anchor.dx - _symbolAnchorWidth / 2;
    left = left.clamp(margin, maxW - _symbolAnchorWidth - margin);
    var top = anchor.dy - _symbolHeight / 2;
    top = top.clamp(margin, maxH - _symbolHeight - margin);

    final minutes = resolveEstimatedServiceMinutes(
      estimatedCompletionMinutes: b.estimatedCompletionMinutes,
      serviceDurationMinutes: b.serviceDurationMinutes,
      serviceType: b.serviceType,
      packageName: b.packageName,
    );
    final durationLabel = formatJobDurationLabel(minutes);
    final isAccepting = widget.controller.acceptingDriverBookingId.value == id;

    return Positioned(
      left: left,
      top: top,
      child: DriverJobMapSymbol(
        serviceType: b.serviceType,
        durationLabel: durationLabel,
        iconSize: _symbolIconSize,
        minWidth: _symbolMinWidth,
        isAssigned: false,
        onTap: () => _openUnassignedDetail(context, b, isAccepting),
      ),
    );
  }

  void _openUnassignedDetail(
    BuildContext context,
    bl.Bookings b,
    bool isAccepting,
  ) {
    final id = b.id ?? 0;
    if (id <= 0) return;
    unawaited(
      showDriverJobMapDetailSheet(
        context,
        booking: b,
        isAccepting: isAccepting,
        // Always enabled — acceptDriverBooking handles any block with a clear
        // snackbar explaining the reason (and verifies via server reconcile
        // before surfacing errors, to avoid false blocks from stale state).
        acceptEnabled: true,
        onAccept: () {
          Get.back<void>();
          unawaited(widget.controller.acceptDriverBooking(id));
        },
        onReject: () {
          Get.back<void>();
          unawaited(_rejectBookingCard(id));
        },
      ),
    );
  }

  Future<void> _rejectBookingCard(int bookingId) async {
    final ok = await widget.controller.rejectDriverBooking(bookingId);
    if (!ok) return;
    _unassignedPixels.remove(bookingId);
    if (mounted) setState(() {});
  }

  // ── Assigned pin ──────────────────────────────────────────────────────────

  Widget _buildAssignedSymbol(
    BuildContext context,
    bl.Bookings b,
    double maxW,
    double maxH,
  ) {
    final id = b.id!;
    final anchor = _assignedPixels[id];
    if (anchor == null) return const SizedBox.shrink();

    const margin = 8.0;
    var left = anchor.dx - _symbolAnchorWidth / 2;
    left = left.clamp(margin, maxW - _symbolAnchorWidth - margin);
    var top = anchor.dy - _symbolHeight / 2;
    top = top.clamp(margin, maxH - _symbolHeight - margin);

    final minutes = resolveEstimatedServiceMinutes(
      estimatedCompletionMinutes: b.estimatedCompletionMinutes,
      serviceDurationMinutes: b.serviceDurationMinutes,
      serviceType: b.serviceType,
      packageName: b.packageName,
    );
    final durationLabel = formatJobDurationLabel(minutes);

    return Positioned(
      left: left,
      top: top,
      child: DriverJobMapSymbol(
        serviceType: b.serviceType,
        durationLabel: durationLabel,
        iconSize: _symbolIconSize,
        minWidth: _symbolMinWidth,
        isAssigned: true,
        onTap: () => _openAssignedDetail(context, b),
      ),
    );
  }

  void _openAssignedDetail(BuildContext context, bl.Bookings b) {
    final id = b.id ?? 0;
    if (id <= 0) return;
    final customerName = widget.controller.customerNameFromBooking(b);
    final avatarUrl =
        widget.controller.customerAvatarUrl(b)?.trim() ?? '';
    unawaited(
      showDriverAssignedJobMapDetailSheet(
        context,
        booking: b,
        customerName: customerName,
        customerAvatarUrl: avatarUrl,
      ),
    );
  }
}

/// Full-width driver home trip sheet chrome (no [Align] — parent stack aligns).
class _DriverTripBottomSheetShell extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final BoxConstraints? constraints;

  const _DriverTripBottomSheetShell({
    required this.child,
    this.padding = const EdgeInsets.fromLTRB(0, 12, 0, 12),
    this.constraints,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding,
      constraints: constraints,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        border: Border(
          top: BorderSide(color: DriverDashboardView._primaryRed, width: 3),
        ),
        boxShadow: [
          BoxShadow(
            color: Color(0x33000000),
            blurRadius: 16,
            offset: Offset(0, -4),
          ),
        ],
      ),
      child: child,
    );
  }
}

class _DriverStartPickupPanel extends StatelessWidget {
  final DriverDashboardController controller;

  const _DriverStartPickupPanel({required this.controller});

  @override
  Widget build(BuildContext context) {
    final isUpdating = controller.isDriverStatusUpdating.value;
    final showCountdown = controller.isDriverOnDemandAcceptCountdownVisible;
    final location = controller.driverActivePickupLocationLabel;
    final showCancel = !controller.isDriverTripCancellationBlocked;

    return _DriverTripBottomSheetShell(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(
                    padding: EdgeInsets.only(top: 2),
                    child: Icon(
                      Icons.location_on_rounded,
                      color: DriverDashboardView._primaryRed,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        CommonText.medium(
                          location,
                          size: 16,
                          color: const Color(0xff1C1C1E),
                          maxLines: 2,
                        ),
                        const SizedBox(height: 4),
                        CommonText.regular(
                          showCountdown
                              ? 'Start driving to pick-up before the timer ends.'
                              : 'Tap start to head to the pickup location.',
                          size: 12,
                          color: const Color(0xff5E5E5E),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _ActiveCustomerTripCard(
                controller: controller,
                onContactTap: () =>
                    unawaited(controller.launchDriverCustomerPhoneCall()),
                showAcceptCountdownChip: showCountdown,
              ),
              const SizedBox(height: 14),
              Row(
                // crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (showCancel) ...[
                    Expanded(
                      // flex: 11,
                      child:
                      AppButton(
                        label: 'Cancel Service',
                        onPressed: isUpdating
                            ? null
                            : controller.openDriverHomeCancelAction,
                        bgColor: const Color(0xff273844),
                        txtColor: Colors.white,
                        btnCornerRadius: 14,
                        vPadding: 12,
                      ),
                    ),
                    const SizedBox(width: 10),
                  ],
                  Expanded(
                    // flex: showCancel ? 14 : 1,
                    child: AppButton(
                      label: isUpdating ? 'Starting...' : 'Start',
                      onPressed: isUpdating
                          ? null
                          : controller.startActiveDriverService,
                      type: isUpdating ? ButtonType.disabled : ButtonType.primary,
                      bgColor: isUpdating ? null : const Color(0xffE70B1C),
                      btnCornerRadius: 14,
                      vPadding: 12,
                    ),
                  ),
                ],
              ),
            ],
          ),
    );
  }
}

class _DriverPickupHandoverPanel extends StatelessWidget {
  final DriverDashboardController controller;

  const _DriverPickupHandoverPanel({required this.controller});

  @override
  Widget build(BuildContext context) {
    return _DriverTripBottomSheetShell(
      child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CommonText.bold(
              'Arrived at pickup location',
              size: 16,
              color: Color(0xff1C1C1E),
            ),
            const SizedBox(height: 6),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16),
              child: CommonText.regular(
                'Enter car details to verify the customer OTP and upload before-service photos.',
                size: 13,
                color: Color(0xff5E5E5E),
                textAlign: TextAlign.center,
              ),
            ),
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: _ActiveCustomerTripCard(
                controller: controller,
                onMessageTap: controller.openActiveDriverBookingChat,
                onContactTap: () =>
                    unawaited(controller.launchDriverCustomerPhoneCall()),
              ),
            ),
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: AppButton(
                label: 'Enter car details',
                onPressed: () => Get.toNamed(Routes.DRIVER_CAR_DETAILS),
                bgColor: const Color(0xffE70B1C),
                btnCornerRadius: 14,
                vPadding: 12,
              ),
            ),
          ],
        ),
    );
  }
}

class _StartedServicePanel extends StatelessWidget {
  final DriverDashboardController controller;

  const _StartedServicePanel({required this.controller});

  @override
  Widget build(BuildContext context) {
    final showCancel = !controller.isDriverTripCancellationBlocked;
    return _DriverTripBottomSheetShell(
      child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CommonText.regular(
              'Enroute to pick up customer vehicle',
              size: 16,
              color: Color(0xff5E5E5E),
            ),
            // Arrival wait timer is shown on car details only, not the home map sheet.
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: _ActiveCustomerTripCard(
                controller: controller,
                onContactTap: () =>
                    unawaited(controller.launchDriverCustomerPhoneCall()),
              ),
            ),
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: DriverTurnByTurnButton(
                onNavigate: controller.startDriverTurnByTurnToPickup,
              ),
            ),
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: AppButton(
                label: 'Arrived at service pickup location',
                onPressed: () async {
                  final ok = await controller.markDriverBookingArrived();
                  if (!ok) return;
                  Get.toNamed(Routes.DRIVER_CAR_DETAILS);
                },
                bgColor: const Color(0xffE70B1C),
                btnCornerRadius: 14,
                vPadding: 12,
              ),
            ),
            if (showCancel) ...[
              const SizedBox(height: 10),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: AppButton(
                  label: 'Cancel Service',
                  onPressed: controller.openDriverHomeCancelAction,
                  bgColor: const Color(0xff273844),
                  txtColor: Colors.white,
                  btnCornerRadius: 14,
                  vPadding: 12,
                ),
              ),
            ],
          ],
        ),
    );
  }
}

/// Customer row used across driver trip bottom sheets (name, photo, service type).
class _ActiveCustomerTripCard extends StatelessWidget {
  final DriverDashboardController controller;
  final VoidCallback? onContactTap;
  final VoidCallback? onMessageTap;
  final bool showServiceType;
  final bool showAcceptCountdownChip;

  const _ActiveCustomerTripCard({
    required this.controller,
    this.onContactTap,
    this.onMessageTap,
    this.showServiceType = true,
    this.showAcceptCountdownChip = false,
  });

  @override
  Widget build(BuildContext context) {
    final meta = controller.activeDriverTripCustomerMeta();
    final showTimerChip = showAcceptCountdownChip &&
        controller.isDriverOnDemandAcceptCountdownVisible;
    final effectiveMessageTap = onMessageTap ??
        (onContactTap != null ? controller.openActiveDriverBookingChat : null);
    return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: const Color(0xffF2F2F7),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 20,
                  backgroundColor: const Color(0xffD9D9D9),
                  child: ClipOval(
                    child: meta.avatarUrl.isEmpty
                        ? const Icon(Icons.person_rounded, color: Colors.white)
                        : ImageFromNetwork(
                            meta.avatarUrl,
                            width: 40,
                            height: 40,
                            fit: BoxFit.cover,
                            placeholderWidget: Container(
                              width: 40,
                              height: 40,
                              color: const Color(0xffD9D9D9),
                              child: const Icon(
                                Icons.person_rounded,
                                color: Colors.white,
                              ),
                            ),
                          ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      CommonText.medium(meta.name, size: 16, maxLines: 1),
                      if (showServiceType) ...[
                        const SizedBox(height: 2),
                        CommonText.regular(
                          meta.service,
                          size: 12,
                          color: const Color(0xff5E5E5E),
                          maxLines: 1,
                        ),
                      ],
                    ],
                  ),
                ),
                if (showTimerChip) ...[
                  _DriverAcceptCountdownChip(controller: controller),
                  const SizedBox(width: 8),
                ],
                _BookingDetailsActionButton(
                  onTap: () => unawaited(
                    controller.openActiveDriverBookingDetailsSheet(),
                  ),
                ),
              ],
            ),
            if (effectiveMessageTap != null || onContactTap != null) ...[
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  if (effectiveMessageTap != null)
                    _ContactActionButton(
                      buttonSize: 44,
                      iconSize: 20,
                      onTap: effectiveMessageTap,
                      text: 'Message',
                      icon: Icons.forum_outlined,
                    ),
                  if (effectiveMessageTap != null && onContactTap != null)
                    const SizedBox(width: 8),
                  if (onContactTap != null)
                    _ContactActionButton(
                      buttonSize: 44,
                      iconSize: 20,
                      onTap: onContactTap!,
                      text: 'Call',
                    ),
                ],
              ),
            ],
          ],
        ),
      );
  }
}

/// Compact MM:SS chip shown beside the call button during the 15-minute accept window.
class _DriverAcceptCountdownChip extends StatelessWidget {
  final DriverDashboardController controller;

  const _DriverAcceptCountdownChip({required this.controller});

  @override
  Widget build(BuildContext context) {
    final countdown = formatBookingTimerCountdown(
      controller.driverAcceptCountdownRemainingSeconds(),
    );
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          constraints: const BoxConstraints(minWidth: 52),
          height: 44,
          padding: const EdgeInsets.symmetric(horizontal: 8),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: DriverDashboardView._primaryRed,
            borderRadius: BorderRadius.circular(12),
          ),
          child: CommonText.bold(
            countdown,
            size: 13,
            color: Colors.white,
          ),
        ),
        const CommonText.medium('To start', size: 10),
      ],
    );
  }
}

class _ReadyToHeadPanel extends StatelessWidget {
  final DriverDashboardController controller;

  const _ReadyToHeadPanel({required this.controller});

  @override
  Widget build(BuildContext context) {
    return _DriverTripBottomSheetShell(
      child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Obx(
              () => CommonText.regular(
                controller.driverReadyToHeadPrompt,
                size: 16,
                color: const Color(0xff5E5E5E),
              ),
            ),
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: _ActiveCustomerTripCard(
                controller: controller,
                onContactTap: () =>
                    unawaited(controller.launchDriverCustomerPhoneCall()),
              ),
            ),
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Obx(
                () => DriverTurnByTurnButton(
                  label:
                      'Navigate to ${controller.driverCurrentServiceStopLabel}',
                  onNavigate: () =>
                      controller.startDriverTurnByTurnToServiceCenter(
                    requireActiveLeg: false,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Obx(
                () => AppButton(
                  label:
                      'En Route To ${controller.driverCurrentServiceStopLabel}',
                  onPressed: controller.haveYouArriveLocation,
                  bgColor: const Color(0xffE70B1C),
                  btnCornerRadius: 14,
                  vPadding: 12,
                ),
              ),
            ),
            Obx(() {
              if (controller.isDriverTripCancellationBlocked) {
                return const SizedBox.shrink();
              }
              return Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const SizedBox(height: 10),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: AppButton(
                      label: 'Cancel Trip',
                      onPressed: controller.openCancelTripView,
                      bgColor: const Color(0xff273844),
                      txtColor: Colors.white70,
                      btnCornerRadius: 14,
                      vPadding: 10,
                    ),
                  ),
                ],
              );
            }),
          ],
        ),
    );
  }
}

class _HaveYouArriveLocationPanel extends StatelessWidget {
  final DriverDashboardController controller;

  const _HaveYouArriveLocationPanel({required this.controller});

  @override
  Widget build(BuildContext context) {
    return _DriverTripBottomSheetShell(
      child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  const Expanded(
                    child: CommonText.regular(
                      'Have you arrived at service location?',
                      size: 14,
                      color: Color(0xff5E5E5E),
                    ),
                  ),
                  Obx(() {
                    // Service-en-route timer — always ticks from local clock via serviceTimerTick
                    controller.serviceTimerTick.value;
                    final elapsed = controller.driverServiceEnRouteElapsedSeconds();
                    final display = formatElapsedStopwatch(elapsed);
                    final over90Min = elapsed > 90 * 60;
                    return Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: over90Min
                            ? const Color(0xffFF9500)
                            : const Color(0xffE70B1C),
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            over90Min
                                ? Icons.schedule_rounded
                                : Icons.timer_outlined,
                            color: Colors.white,
                            size: 16,
                          ),
                          const SizedBox(width: 5),
                          Text(
                            display,
                            style: const TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                              letterSpacing: 1.5,
                            ),
                          ),
                        ],
                      ),
                    );
                  })
                ],
              ),
            ),
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: _ActiveCustomerTripCard(
                controller: controller,
                onContactTap: () =>
                    unawaited(controller.launchDriverCustomerPhoneCall()),
              ),
            ),
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: DriverTurnByTurnButton(
                onNavigate: controller.startDriverTurnByTurnToServiceCenter,
              ),
            ),
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Obx(() {
                final showCancel = !controller.isDriverTripCancellationBlocked;
                return Row(
                  // crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (showCancel) ...[
                      Expanded(
                        flex: 11,
                        child: AppButton(
                          label: 'Cancel Service',
                          onPressed: controller.openCancelTripView,
                          bgColor: const Color(0xff273844),
                          txtColor: Colors.white,
                          btnCornerRadius: 14,
                          vPadding: 12,
                        ),
                      ),
                      const SizedBox(width: 10),
                    ],
                    Expanded(
                      flex: showCancel ? 14 : 1,
                      child: AppButton(
                        label: 'Arrived',
                        onPressed: controller.arriveForService,
                        bgColor: const Color(0xffE70B1C),
                        btnCornerRadius: 14,
                        vPadding: 12,
                      ),
                    ),
                  ],
                );
              }),
            ),
          ],
        ),
    );
  }
}

class _ArriveForServicePanel extends StatelessWidget {
  final DriverDashboardController controller;

  const _ArriveForServicePanel({required this.controller});

  Widget _statusButton(String title, {VoidCallback? onTap}) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          height: 40,
          decoration: BoxDecoration(
            color: const Color(0xffD9D9D9),
            borderRadius: BorderRadius.circular(12),
          ),
          alignment: Alignment.center,
          child: CommonText.regular(
            title,
            size: 14,
            color: const Color(0xff6A6A6A),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return _DriverTripBottomSheetShell(
      child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CommonText.regular(
              'Arrive For Service',
              size: 16,
              color: Color(0xff5E5E5E),
            ),
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: _ActiveCustomerTripCard(
                controller: controller,
                onContactTap: () =>
                    unawaited(controller.launchDriverCustomerPhoneCall()),
              ),
            ),
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: _statusButton(
                'Vehicle Being Serviced',
                onTap: controller.vehicleBeingServiced,
              ),
            ),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: _statusButton(
                'Vehicle Waiting To Be Service',
                onTap: controller.waitingOnVehicleService,
              ),
            ),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: _statusButton(
                'Issue With Service Location',
                onTap: controller.selectNewServiceLocation,
              ),
            ),
          ],
        ),
    );
  }
}

class _WaitingOnVehicleServicePanel extends StatelessWidget {
  final DriverDashboardController controller;

  const _WaitingOnVehicleServicePanel({required this.controller});

  @override
  Widget build(BuildContext context) {
    return _DriverTripBottomSheetShell(
      child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CommonText.regular(
              'Waiting on Vehicle Service',
              size: 16,
              color: Color(0xff5E5E5E),
            ),
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: _ActiveCustomerTripCard(
                controller: controller,
                onContactTap: () =>
                    unawaited(controller.launchDriverCustomerPhoneCall()),
              ),
            ),
            const SizedBox(height: 10),
            // Service timer chip on the waiting-for-service panel
            Obx(() {
              controller.serviceTimerTick.value;
              final svcElapsed = controller.driverServiceInProgressElapsedSeconds();
              if (svcElapsed <= 0) {
                return const SizedBox.shrink();
              }
              final display = controller.driverServiceInProgressElapsedLabel();
              final overdue = svcElapsed > 45 * 60;
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Center(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: overdue
                          ? const Color(0xffFF9500)
                          : const Color(0xffE70B1C),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          overdue
                              ? Icons.warning_rounded
                              : Icons.timer_outlined,
                          color: Colors.white,
                          size: 16,
                        ),
                        const SizedBox(width: 6),
                        CommonText.regular(
                          'Time elapsed: $display',
                          letterSpacing: 1.0,
                          color: Colors.white,
                          size: 15,
                          // style: const TextStyle(
                          //   fontFamily: 'monospace',
                          //   fontSize: 15,
                          //   fontWeight: FontWeight.bold,
                          //   color: Colors.white,
                          //   letterSpacing: 1.0,
                          // ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Obx(
                () => AppButton(
                  label: controller.driverServiceCompletedButtonLabel,
                  onPressed: controller.vehicleIsEnroteToDropOffPannal,
                  bgColor: const Color(0xffE70B1C),
                  btnCornerRadius: 14,
                  vPadding: 12,
                ),
              ),
            ),
          ],
        ),
    );
  }
}

class _SelectNewServiceLocationPanel extends StatelessWidget {
  final DriverDashboardController controller;

  const _SelectNewServiceLocationPanel({required this.controller});

  static const Color _fieldBg = Colors.transparent;

  Color _fieldBorder(BuildContext context) =>
      context.colorScheme.outlineVariant;

  @override
  Widget build(BuildContext context) {
    final maxH = MediaQuery.sizeOf(context).height * 0.72;
    return _DriverTripBottomSheetShell(
      constraints: BoxConstraints(maxHeight: maxH),
      padding: EdgeInsets.zero,
      child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(0, 12, 0, 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const CommonText.regular(
                'Select New Service Location',
                size: 16,
                color: Color(0xff5E5E5E),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 10),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: _ActiveCustomerTripCard(
                  controller: controller,
                  onContactTap: () =>
                    unawaited(controller.launchDriverCustomerPhoneCall()),
                ),
              ),
              const SizedBox(height: 12),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: _DriverAlternateServiceLocationFields(
                  controller: controller,
                  fieldBorder: _fieldBorder(context),
                ),
              ),
              const SizedBox(height: 12),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Obx(() {
                  final loading = controller
                      .isSubmittingDriverAlternateServiceLocation
                      .value;
                  return AppButton(
                    label: loading
                        ? 'Saving...'
                        : 'Select New Service Location',
                    onPressed: loading
                        ? null
                        : () => unawaited(
                            controller.submitDriverAlternateServiceLocation(),
                          ),
                    bgColor: const Color(0xffE70B1C),
                    btnCornerRadius: 14,
                    vPadding: 12,
                    type: loading ? ButtonType.disabled : ButtonType.primary,
                  );
                }),
              ),
            ],
          ),
        ),
    );
  }
}

class _DriverAlternateServiceLocationFields extends StatelessWidget {
  final DriverDashboardController controller;
  final Color fieldBorder;

  const _DriverAlternateServiceLocationFields({
    required this.controller,
    required this.fieldBorder,
  });

  static const Color _fieldBg = Colors.transparent;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Obx(() {
          controller.driverAlternateLocationDropdownVersion.value;
          controller.isSearchingDriverAlternateLocations.value;
          final hasOptions =
              controller.driverAlternateServiceOptions.isNotEmpty;
          if (!hasOptions &&
              !controller.isSearchingDriverAlternateLocations.value) {
            return const SizedBox.shrink();
          }
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (hasOptions)
                CommonDropDownField(
                  key: ValueKey(
                    'driver_alt_loc_${controller.driverAlternateLocationDropdownVersion.value}_'
                    '${controller.driverSelectedAlternateService.value ?? ''}',
                  ),
                  hintText: controller.isSearchingDriverAlternateLocations.value
                      ? 'Loading nearby locations...'
                      : 'Select',
                  labelText: 'Automatic Car Wash Locations Nearby.',
                  labelColor: context.colorScheme.secondary,
                  hintColor: fieldBorder,
                  selectedTextColor: context.colorScheme.onSurface,
                  selectedValue:
                      controller.driverSelectedAlternateService.value,
                  items: controller.driverAlternateServiceOptions.toList(),
                  bgColor: _fieldBg,
                  borderColor: fieldBorder,
                  onSave: controller.setDriverSelectedAlternateService,
                ),
              if (controller.isSearchingDriverAlternateLocations.value)
                const Padding(
                  padding: EdgeInsets.only(top: 8),
                  child: LinearProgressIndicator(minHeight: 2),
                ),
            ],
          );
        }),
        Obx(() {
          final err =
              controller.driverAlternateLocationSearchError.value?.trim() ?? '';
          if (err.isEmpty) return const SizedBox.shrink();
          return Padding(
            padding: const EdgeInsets.only(top: 8),
            child: CommonText.regular(
              err,
              size: 12,
              color: context.colorScheme.error,
            ),
          );
        }),
        const SizedBox(height: 12),
        CommonTextField(
          controller: controller.driverManualServiceLocationController,
          textColor: context.colorScheme.onSurface,
          hintColor: fieldBorder,
          hintText: 'Enter service location',
          labelText: "Can't Find Service Location? Enter It Here",
          labelColor: context.colorScheme.secondary,
          bgColor: _fieldBg,
          borderColor: fieldBorder,
          keyboardType: TextInputType.streetAddress,
          textCapitalization: TextCapitalization.words,
          inputFormatters: addressInputFormatters,
          onChanged: controller.onDriverManualServiceLocationChanged,
          suffixIcon: Obx(() {
            if (controller.isSearchingDriverManualServiceLocation.value) {
              return const Padding(
                padding: EdgeInsets.all(12),
                child: SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              );
            }
            if (controller.driverManualServiceLocationController.text
                .trim()
                .isNotEmpty) {
              return IconButton(
                icon: Icon(
                  Icons.close_rounded,
                  color: Colors.grey.shade600,
                  size: 20,
                ),
                onPressed: () {
                  controller.driverManualServiceLocationController.clear();
                  controller.driverManualServiceLocationSuggestions.clear();
                  controller.driverManualServiceLocationError.value = null;
                },
              );
            }
            return Icon(
              Icons.search_rounded,
              color: Colors.grey.shade600,
            ).marginOnly(right: 12);
          }),
        ),
        Obx(() {
          final suggestions = controller.driverManualServiceLocationSuggestions;
          final err =
              controller.driverManualServiceLocationError.value?.trim() ?? '';
          if (suggestions.isEmpty && err.isEmpty) {
            return const SizedBox.shrink();
          }
          return Container(
            margin: const EdgeInsets.only(top: 8),
            decoration: BoxDecoration(
              color: context.colorScheme.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: fieldBorder),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (err.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.all(10),
                    child: CommonText.regular(
                      err,
                      size: 12,
                      color: context.colorScheme.error,
                    ),
                  ),
                ...suggestions.map(
                  (place) => InkWell(
                    onTap: () => controller
                        .selectDriverManualServiceLocationSuggestion(place),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 10,
                      ),
                      child: CommonText.regular(
                        place.address,
                        size: 13,
                        color: context.colorScheme.onSurface,
                        maxLines: 2,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        }),
        const SizedBox(height: 12),
        CommonTextField(
          controller: controller.driverAlternateServiceLocationReasonController,
          textColor: context.colorScheme.onSurface,
          hintColor: fieldBorder,
          hintText: 'e.g. Original address not accessible',
          labelText: 'Reason for location change',
          labelColor: context.colorScheme.secondary,
          bgColor: _fieldBg,
          borderColor: fieldBorder,
          maxLines: 2,
          minLines: 1,
          keyboardType: TextInputType.text,
        ),
      ],
    );
  }
}

class _VehicleIsEnroteToDropOffPannal extends StatelessWidget {
  final DriverDashboardController controller;

  const _VehicleIsEnroteToDropOffPannal({required this.controller});

  @override
  Widget build(BuildContext context) {
    return _DriverTripBottomSheetShell(
      child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CommonText.regular(
              'Vehicle is en route to drop-off',
              size: 16,
              color: Color(0xff5E5E5E),
            ),
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: _ActiveCustomerTripCard(
                      controller: controller,
                      onContactTap: () => unawaited(
                        controller.launchDriverCustomerPhoneCall(),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Column(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: context.colorScheme.onPrimary,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: context.colorScheme.scrim),
                        ),
                        child: const Icon(
                          Icons.shield_sharp,
                          color: Color(0xff2C2C2E),
                          size: 18,
                        ),
                      ),
                      const CommonText.medium('Safety', size: 10),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: DriverTurnByTurnButton(
                label: 'Navigate to drop-off',
                onNavigate: controller.startDriverTurnByTurnToDropOff,
              ),
            ),
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Obx(() {
                final busy = controller.isDriverReturnDropoffArrivalInFlight.value ||
                    controller.isDriverStatusUpdating.value;
                return AppButton(
                  label: busy
                      ? 'Recording arrival…'
                      : 'Arrived at drop off location',
                  onPressed: busy
                      ? null
                      : () async {
                          final ok = await controller
                              .markDriverReturnDropoffCompleteAndOpenAfterServiceView();
                          if (!context.mounted) return;
                          if (ok) {
                            showAppSnackBar(
                              title: 'Drop-off',
                              message: 'Return arrival recorded.',
                            );
                          }
                        },
                  bgColor: const Color(0xffE70B1C),
                  btnCornerRadius: 14,
                  vPadding: 12,
                );
              }),
            ),
          ],
        ),
    );
  }
}

class _CancelTripPanel extends StatelessWidget {
  final DriverDashboardController controller;

  const _CancelTripPanel({required this.controller});

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    final maxHeight = mq.size.height - mq.padding.top - mq.viewInsets.bottom - 8;

    return Padding(
      padding: EdgeInsets.only(bottom: mq.viewInsets.bottom),
      child: SafeArea(
        top: true,
        bottom: false,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: math.max(220, maxHeight)),
          child: _DriverTripBottomSheetShell(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: SingleChildScrollView(
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
            Row(
              children: [
                Container(
                  width: 50,
                  height: 50,
                  decoration: const BoxDecoration(
                    color: Color(0xff2C2C2E),
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: SvgPicture.asset(
                      Assets.imagesIcEmergency,
                      width: 18,
                      height: 18,
                      colorFilter: const ColorFilter.mode(
                        Colors.white,
                        BlendMode.srcIn,
                      ),
                    ),
                  ),
                ),
                const Spacer(),
                InkWell(
                  onTap: () {
                    if (controller.hasStartedService.value) {
                      controller.setReadyToHeadService();
                    } else {
                      controller.dismissCancelTripView();
                    }
                  },
                  borderRadius: BorderRadius.circular(16),
                  child: Container(
                    width: 32,
                    height: 32,
                    decoration: const BoxDecoration(
                      color: Color(0xff2C2C2E),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.close,
                      color: Colors.white,
                      size: 16,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            const CommonText.medium(
              'Cancel This Trip',
              size: 24,
              color: Color(0xff2E2E2E),
            ),
            const SizedBox(height: 4),
            const CommonText.regular(
              'Are you sure you want to cancel your service please\ngive us a reason.',
              size: 14,
              color: Color(0xff3D3D3D),
            ),
            const SizedBox(height: 12),
            CommonTextField(
              controller: Get.find<CancelReasonController>().reasonController,
              hintText: 'Enter Details',
              textColor: const Color(0xff2E2E2E),
              labelColor: const Color(0xff2E2E2E),
              hintColor: const Color(0xff8E8E93),
              cursorColor: const Color(0xff2E2E2E),
              maxLines: 7,
              minLines: 5,
              keyboardType: TextInputType.multiline,
              inputAction: TextInputAction.newline,
              bgColor: const Color(0xffF2F2F2),
              borderColor: const Color(0xffD8D8D8),
            ),
            const SizedBox(height: 16),
            Obx(() {
              final cancel = Get.find<CancelReasonController>();
              final loading = cancel.isSubmitting.value;
              return AppButton(
                label: loading ? 'Submitting…' : 'Submit',
                onPressed: loading
                    ? null
                    : () => unawaited(_submitDriverCancelTrip(controller)),
                bgColor: const Color(0xffE70B1C),
                btnCornerRadius: 14,
                vPadding: 12,
              );
            }),
          ],
        ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SafetyFeaturesPanel extends StatelessWidget {
  final DriverDashboardController controller;

  const _SafetyFeaturesPanel({required this.controller});

  @override
  Widget build(BuildContext context) {
    return _DriverTripBottomSheetShell(
      child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  const Expanded(
                    child: CommonText.regular(
                      'Safety Features',
                      size: 18,
                      color: Color(0xff5E5E5E),
                    ),
                  ),
                  InkWell(
                    onTap: controller.closeContactOptions,
                    borderRadius: BorderRadius.circular(18),
                    child: Container(
                      width: 28,
                      height: 28,
                      decoration: const BoxDecoration(
                        color: Color(0xff2E2E2E),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.close,
                        color: Colors.white,
                        size: 16,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: DriverContactActionCard(
                      title: 'Phone Call',
                      icon: Icons.call_outlined,
                      onTap: () {
                        controller.closeContactOptions();
                        unawaited(controller.launchDriverCustomerPhoneCall());
                      },
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: DriverContactActionCard(
                      title: 'Messages',
                      icon: Icons.forum_outlined,
                      onTap: () {
                        controller.closeContactOptions();
                        controller.openActiveDriverBookingChat();
                      },
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
    );
  }
}

class _ContactActionButton extends StatelessWidget {
  final VoidCallback onTap;
  final double buttonSize;
  final double iconSize;
  final String? text;
  final IconData icon;

  const _ContactActionButton({
    required this.onTap,
    required this.buttonSize,
    required this.iconSize,
    this.text,
    this.icon = Icons.call_rounded,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Column(
        children: [
          Container(
            width: buttonSize,
            height: buttonSize,
            decoration: BoxDecoration(
              color: const Color(0xff273844),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              icon,
              color: Colors.white,
              size: iconSize,
            ),
          ),
          CommonText.medium(text ?? 'Contact', size: 10),
        ],
      ),
    );
  }
}

class _BookingDetailsActionButton extends StatelessWidget {
  final VoidCallback onTap;

  const _BookingDetailsActionButton({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Column(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: const Color(0xffF2F2F7),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xffD1D1D6)),
            ),
            child: const Icon(
              Icons.info_outline_rounded,
              color: Color(0xff2C2C2E),
              size: 20,
            ),
          ),
          const CommonText.medium('Details', size: 10),
        ],
      ),
    );
  }
}

class _ServiceCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  const _ServiceCard({
    required this.title,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.xl),
      child: Container(
        padding: const EdgeInsets.symmetric(
          vertical: AppSpacing.xl,
          horizontal: AppSpacing.md,
        ),
        decoration: BoxDecoration(
          color: Colors.black,
          borderRadius: BorderRadius.circular(AppRadius.xl),
          border: Border.all(
            color: selected
                ? DriverDashboardView._primaryRed
                : const Color(0xffE8E8EF),
            width: selected ? 2 : 1,
          ),
        ),
        child: Column(
          children: [
            CommonText.semiBold(
              title,
              size: 18,
              textAlign: TextAlign.center,
              color: Colors.white,
            ),
            const SizedBox(height: AppSpacing.sm),
            Align(
              alignment: AlignmentGeometry.bottomEnd,
              child: Icon(icon, size: 34, color: Colors.white),
            ),
          ],
        ),
      ),
    );
  }
}

Future<void> _submitDriverCancelTrip(DriverDashboardController controller) async {
  if (controller.isDriverTripCancellationBlocked) {
    showAppSnackBar(
      title: 'Cannot cancel trip',
      message:
          'This booking cannot be cancelled after vehicle handover OTP verification.',
      isError: true,
    );
    return;
  }
  final bookingId =
      controller.activeDriverBookingId.value ??
      controller.serviceDetailBookingId.value;
  if (bookingId == null || bookingId <= 0) {
    showAppSnackBar(
      title: 'Cancel failed',
      message: 'Active booking could not be identified.',
      isError: true,
    );
    return;
  }
  final cancel = Get.find<CancelReasonController>();
  cancel.assignCancelBookingId(bookingId);
  await cancel.submit();
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Returns a user-facing booking reference.
/// Prefers the API-supplied [bookingCode]; falls back to a zero-padded
/// CC-XXXX code so raw database primary keys are never shown in the UI.
String _bookingDisplayRef(String? bookingCode, int id) {
  final code = (bookingCode ?? '').trim();
  if (code.isNotEmpty) return code;
  if (id <= 0) return '—';
  return 'CC-${id.toString().padLeft(4, '0')}';
}
