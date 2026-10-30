import 'dart:async';
import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart' hide Size;

import '../../gen/assets.gen.dart';
import '../../routes/app_pages.dart';
import '../../theme/design_tokens.dart';
import '../../models/service_model.dart';
import '../../utils/pref.dart';
import '../../utils/service_type_label.dart';
import '../../utils/extensions/extension.dart';
import '../../constants/booking_tracking_status.dart';
import '../../constants/service_provider_labels.dart';
import '../../utils/booking_timer_utils.dart';
import '../../utils/driver_job_duration.dart';
import '../../widgets/booking_timer_banner.dart';
import '../../widgets/button.dart';
import '../../widgets/customer_pickup_otp_banner.dart';
import '../../widgets/image.dart';
import '../../widgets/tappable_profile_avatar.dart';
import '../../widgets/text.dart';
import '../../widgets/text_field.dart';
import '../settings/need_help_view.dart';
import '../settings/settings_view.dart';
import 'cancel_reason_controller.dart';
import 'customer_active_booking_tab.dart';
import 'dashboard_booking_timer.dart';
import 'dashboard_controller.dart';
import 'my_bookings_view.dart';

class DashboardView extends GetView<DashboardController> {
  const DashboardView({super.key});

  static const Color _primaryRed = Color(0xffC4101F);
  static const Color _navPillBg = Color(0xff2C2C2E);

  @override
  Widget build(BuildContext context) {
    // Index 1 shows CustomerActiveBookingTab for customer role,
    // MyBookingsView (history) for driver role.
    // Nav indices:
    //  0 = Home
    //  1 = My Bookings (history)
    //  2 = Active Booking (customers) — new dedicated tab
    //  3 = Settings
    //  4 = Support
    final tabs = <Widget>[
      _HomeTab(controller: controller),
      const MyBookingsView(),
      // Index 2: Active Booking tab for customers; drivers never land here
      Prefs().isCustomerRole
          ? const CustomerActiveBookingTab()
          : const SizedBox.shrink(),
      // const ServiceProviderProfileView(),
      const SettingsView(),
      const NeedHelpView(),
    ];

    return Scaffold(
      backgroundColor: const Color(0xffF2F2F7),
      body: Obx(
        () =>
            IndexedStack(index: controller.homeNavIndex.value, children: tabs),
      ),
      bottomNavigationBar: SafeArea(
        top: false,
        child: Container(
          color: Colors.transparent,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: Obx(
              () => _HomeBottomNavPill(
                selectedIndex: controller.homeNavIndex.value,
                onTap: (i) => controller.homeNavIndex.value = i,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _HomeTab extends StatefulWidget {
  final DashboardController controller;

  const _HomeTab({required this.controller});

  @override
  State<_HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<_HomeTab> {
  @override
  void initState() {
    super.initState();
    if (Prefs().isCustomerRole) {
      if (!widget.controller.isCustomerLiveTrackingActive) {
        widget.controller.customerTripPanelEnabled.value = false;
      }
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        unawaited(widget.controller.reconcileCustomerHomeTripState());
      });
    }
  }

  void _startBooking(String serviceLabel) {
    widget.controller.openServiceBooking(serviceLabel);
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.controller;
    final screenH = MediaQuery.sizeOf(context).height;
    return Scaffold(
      backgroundColor: const Color(0xffFAFAFA),
      body: Stack(
        fit: StackFit.expand,
        children: [
          _MapBackground(
            onMapCreated: c.onMapCreated,
            onMapTap: c.onMapTap,
            onMapScroll: c.onCustomerLiveMapGesture,
            onMapZoom: c.onCustomerLiveMapGesture,
          ),
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: ClipRRect(
              borderRadius: BorderRadius.only(
                bottomRight: Radius.circular(20),
                bottomLeft: Radius.circular(20),
              ),
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
                    Padding(
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
                              Obx(() {
                                c.profileHeaderRevision.value;
                                return Row(
                                  children: [
                                    InkWell(
                                      borderRadius: BorderRadius.circular(30),
                                      onTap: () =>
                                          Get.toNamed('/customer-profile'),
                                      child: Container(
                                        width: 40,
                                        height: 40,
                                        decoration: BoxDecoration(
                                          shape: BoxShape.circle,
                                          border: Border.all(
                                            color: const Color(0xffDADAE1),
                                            width: 2,
                                          ),
                                        ),
                                        child: ClipOval(
                                          child: c.avatarUrl.isEmpty
                                              ? const Icon(
                                                  Icons.person_rounded,
                                                  color: Colors.white,
                                                  size: 28,
                                                )
                                              : ImageFromNetwork(
                                                  c.avatarUrl,
                                                  fit: BoxFit.cover,
                                                  placeholderWidget: Container(
                                                    color: Colors.white,
                                                    child: const Icon(
                                                      Icons.person_rounded,
                                                      size: 28,
                                                      color: Colors.grey,
                                                    ),
                                                  ),
                                                ),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Column(
                                      mainAxisSize: MainAxisSize.min,
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        CommonText.regular(
                                          '${c.greetingLabel},',
                                          color: Colors.white70,
                                          size: 14,
                                        ),
                                        InkWell(
                                          onTap: () => Get.toNamed(
                                            Routes.PROFILE_SETTINGS,
                                          ),
                                          borderRadius: BorderRadius.circular(
                                            8,
                                          ),
                                          child: Padding(
                                            padding: const EdgeInsets.symmetric(
                                              vertical: 2,
                                            ),
                                            child: CommonText.bold(
                                              '${c.displayName}!',
                                              color: Colors.white,
                                              size: 22,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                );
                              }),
                              const SizedBox(width: 10),
                              const Spacer(),
                              // _HeaderIconButton(
                              //   icon: Icons.more_horiz_rounded,
                              //   onTap: () {},
                              // ),
                              // const SizedBox(width: 10),
                              _HeaderIconButton(
                                icon: Icons.notifications_none_rounded,
                                onTap: () => Get.toNamed(Routes.NOTIFICATIONS),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          //
                          // const _DriverStatusBanner(),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            top: MediaQuery.paddingOf(context).top + 160,
            left: 0,
            right: 0,
            child: Center(
              child: Obx(
                () => c.hasActiveRoute.value
                    ? Material(
                        color: Colors.white,
                        elevation: 3,
                        borderRadius: BorderRadius.circular(20),
                        child: InkWell(
                          onTap: c.clearRouteAndPin,
                          borderRadius: BorderRadius.circular(20),
                          child: const Padding(
                            padding: EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 8,
                            ),
                            child: CommonText.medium('Clear route', size: 14),
                          ),
                        ),
                      )
                    : const SizedBox.shrink(),
              ),
            ),
          ),
          // FAB + panel stacked in a bottom-anchored Column so the recenter
          // button always sits flush above the panel with no fixed offsets.
          // bottomNavigationBarHeight accounts for the pill nav bar that floats
          // above this stack when extendBody=true.
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Padding(
                  padding: const EdgeInsets.only(right: 16, bottom: 12),
                  child: FloatingActionButton(
                    onPressed: () => unawaited(c.recenterMapOnUserLocation()),
                    backgroundColor: Colors.black,
                    elevation: 4,
                    shape: const CircleBorder(),
                    child: SvgImageFromAsset.square(
                      Assets.imagesIcCurrentLocation,
                      size: 32,
                      color: Colors.white,
                    ),
                  ),
                ),
                Obx(
                  () => c.showCustomerTripPanel
                      ? _CustomerHomeTripOverlay(controller: c)
                      : _ServiceDetailsPanel(
                          controller: c,
                          maxHeight: screenH * 0.44,
                        ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer live-booking panel with persistent hide/show control
// ─────────────────────────────────────────────────────────────────────────────

class _CustomerHomeTripOverlay extends StatelessWidget {
  final DashboardController controller;

  const _CustomerHomeTripOverlay({required this.controller});

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final collapsed = controller.customerTripPanelCollapsed.value;
      return Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 6),
            child: _CustomerLiveEtaStatus(controller: controller),
          ),
          Align(
            alignment: Alignment.centerRight,
            child: Padding(
              padding: const EdgeInsets.only(right: 16, bottom: 4),
              child: GestureDetector(
                onTap: controller.toggleCustomerTripPanelCollapsed,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: DashboardView._primaryRed,
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
                        collapsed
                            ? Icons.keyboard_arrow_up_rounded
                            : Icons.keyboard_arrow_down_rounded,
                        size: 18,
                        color: DashboardView._primaryRed,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        collapsed ? 'Show Panel' : 'Hide Panel',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: DashboardView._primaryRed,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          if (!collapsed) _PostBookingJourneyPanel(controller: controller),
        ],
      );
    });
  }
}

class _CustomerLiveEtaStatus extends StatelessWidget {
  final DashboardController controller;

  const _CustomerLiveEtaStatus({required this.controller});

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      controller.customerLiveEtaTick.value;
      final countdown = controller.customerLiveEtaCountdownLabel;
      final arrival = controller.customerLiveEtaArrivalClockLabel;
      final gps = controller.customerLiveGpsFreshnessLabel;
      final status = controller.customerLiveStatusFreshnessLabel;
      final freshness = [
        gps,
        status,
      ].where((value) => value.isNotEmpty).join(' • ');
      final headline = countdown.isNotEmpty
          ? 'Live ETA  $countdown'
          : controller.customerLiveEtaExpected
          ? 'Calculating live ETA…'
          : 'Live service activity';
      final details = [
        if (arrival.isNotEmpty) 'Arrival about $arrival',
        if (freshness.isNotEmpty) freshness,
        if (arrival.isEmpty && freshness.isEmpty) 'Waiting for provider update',
      ].join(' • ');

      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xff34B620), width: 1.5),
          boxShadow: const [
            BoxShadow(
              color: Color(0x22000000),
              blurRadius: 6,
              offset: Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: const BoxDecoration(
                color: Color(0xffE8F5E9),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.navigation_rounded,
                color: Color(0xff238B2E),
                size: 19,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    headline,
                    style: const TextStyle(
                      color: Color(0xff1B5E20),
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    details,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.black54,
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Always-expanded inline service details panel
// ─────────────────────────────────────────────────────────────────────────────

class _ServiceDetailsPanel extends StatelessWidget {
  final DashboardController controller;
  final double maxHeight;

  const _ServiceDetailsPanel({
    required this.controller,
    required this.maxHeight,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        border: Border(
          top: BorderSide(color: DashboardView._primaryRed, width: 3),
        ),
        boxShadow: [
          BoxShadow(
            color: Color(0x33000000),
            blurRadius: 16,
            offset: Offset(0, -4),
          ),
        ],
      ),
      constraints: BoxConstraints(maxHeight: maxHeight),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Compact header ──────────────────────────────────────────────
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 10, 16, 6),
            child: CommonText.bold('Enter Service Details', size: 15),
          ),
          Divider(height: 1, color: Color(0xFFE0E0E0)),
          // ── Service options ─────────────────────────────────────────────
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Obx(() {
                    final list =
                        servicesOrderedForPicker(controller.services);
                    if (list.isEmpty) {
                      return const Padding(
                        padding: EdgeInsets.symmetric(vertical: 12),
                        child: Center(child: CircularProgressIndicator()),
                      );
                    }
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: _servicePickerRows(
                        controller: controller,
                        services: list,
                        dismissCallback: null, // inline - no modal to dismiss
                      ),
                    );
                  }),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

void openServiceDetailsSheet(BuildContext context) {
  final controller = Get.find<DashboardController>();
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    builder: (context) {
      return Obx(
        () => SafeArea(
          child: Container(
            margin: EdgeInsets.only(
              bottom: MediaQuery.of(context).viewInsets.bottom,
            ),
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              border: Border(
                top: BorderSide(color: DashboardView._primaryRed, width: 3),
              ),
              boxShadow: [
                BoxShadow(
                  color: Color(0x33000000),
                  blurRadius: 16,
                  offset: Offset(0, -4),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                /// 🔽 Drag Handle
                Container(
                  margin: const EdgeInsets.symmetric(vertical: 8),
                  height: 4,
                  width: 40,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),

                /// Header
                ListTile(
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 4,
                    vertical: 0,
                  ),
                  title: const CommonText.bold(
                    'Enter Service Details',
                    size: 16,
                  ),
                  trailing: Icon(
                    controller.isServiceDetailsExpanded.value
                        ? Icons.keyboard_arrow_down_rounded
                        : Icons.keyboard_arrow_up_rounded,
                    color: Colors.grey.shade600,
                  ),
                  onTap: () => Get.back(),
                ),

                Divider(height: 1, color: Colors.grey.shade300),
                const SizedBox(height: 8),

                /// Label
                const Align(
                  alignment: Alignment.centerLeft,
                  child: CommonText.bold(
                    'Select Service Type',
                    size: 12,
                    color: Colors.black54,
                  ),
                ),

                const SizedBox(height: 8),

                /// Service Options
                Obx(() {
                  final list = servicesOrderedForPicker(controller.services);
                  if (list.isEmpty) {
                    return const Center(child: CircularProgressIndicator());
                  }

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: _servicePickerRows(
                      controller: controller,
                      services: list,
                      dismissCallback: () => Get.back(),
                    ),
                  );
                }),
              ],
            ),
          ),
        ),
      );
    },
  );
}

List<Widget> _servicePickerRows({
  required DashboardController controller,
  required List<ServiceModel> services,
  VoidCallback? dismissCallback,
}) {
  final rows = <Widget>[];
  var index = 0;

  while (index < services.length) {
    if (rows.isNotEmpty) rows.add(const SizedBox(height: AppSpacing.sm));

    final service = services[index];
    final name = service.name ?? '';
    if (serviceTypePickerIsCombined(name)) {
      rows.add(_buildServiceCard(
        controller: controller,
        service: service,
        dismissCallback: dismissCallback,
      ));
      index += 1;
      continue;
    }

    if (index + 1 < services.length) {
      final next = services[index + 1];
      final nextName = next.name ?? '';
      if (serviceTypePickerIsCombined(nextName)) {
        rows.add(_buildServiceCard(
          controller: controller,
          service: service,
          dismissCallback: dismissCallback,
        ));
        index += 1;
        continue;
      }

      rows.add(
        Row(
          children: [
            Expanded(
              child: _buildServiceCard(
                controller: controller,
                service: service,
                dismissCallback: dismissCallback,
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: _buildServiceCard(
                controller: controller,
                service: next,
                dismissCallback: dismissCallback,
              ),
            ),
          ],
        ),
      );
      index += 2;
      continue;
    }

    rows.add(_buildServiceCard(
      controller: controller,
      service: service,
      dismissCallback: dismissCallback,
    ));
    index += 1;
  }

  return rows;
}

Widget _buildServiceCard({
  required DashboardController controller,
  required ServiceModel service,
  VoidCallback? dismissCallback,
}) {
  final name = service.name ?? '';
  final id = service.id;
  if (id == null || name.isEmpty) return const SizedBox.shrink();

  return _ServiceCard(
    title: serviceTypePickerLabel(name),
    icon: serviceTypePickerIcon(name),
    isCombined: serviceTypePickerIsCombined(name),
    selected: controller.selectedService.value == name,
    onTap: () {
      controller.selectedService.value = name;
      dismissCallback?.call();
      controller.openServiceBookingWithId(name, id);
    },
  );
}

class _PostBookingJourneyPanel extends StatelessWidget {
  final DashboardController controller;

  const _PostBookingJourneyPanel({required this.controller});

  static const Color _red = DashboardView._primaryRed;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Obx(() {
        final stage = controller.postBookingStage.value;
        final config = _stageConfig(stage);
        // Show confirmed/scheduled booking panel before provider starts the trip
        if (stage == PostBookingStage.bookingConfirmed) {
          return _bookingConfirmedPanel(context);
        }
        if (stage == PostBookingStage.providerEnRoutePickup) {
          final mode = controller.enRoutePanelMode.value;
          return _enRoutePanel(context, mode);
        }
        if (stage == PostBookingStage.providerArrived) {
          return Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              border: Border(top: BorderSide(color: _red, width: 3)),
              boxShadow: [
                BoxShadow(
                  color: Color(0x33000000),
                  blurRadius: 16,
                  offset: Offset(0, -4),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Align(
                  alignment: Alignment.centerRight,
                  child: InkWell(
                    onTap: controller.dismissCustomerTripPanel,
                    borderRadius: BorderRadius.circular(16),
                    child: Container(
                      width: 28,
                      height: 28,
                      decoration: const BoxDecoration(
                        color: Color(0xff2C2C2E),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.close_rounded,
                        size: 16,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 4),
                Container(
                  width: 82,
                  height: 82,
                  decoration: const BoxDecoration(
                    color: Color(0xff34B620),
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: const Icon(
                    Icons.check_rounded,
                    color: Colors.white,
                    size: 46,
                  ),
                ).marginSymmetric(horizontal: 110),
                const SizedBox(height: 10),
                const CommonText.bold(
                  'Service Provider Has Arrived',
                  size: 18,
                  color: Colors.black87,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 6),
                Obx(() {
                  final inOtpPhase =
                      BookingTrackingStatus.isCustomerPickupOtpSharePhase(
                        controller.customerSocketTrackingCode.value ??
                            controller.serviceDetail.value?.trackingStatus,
                      );
                  if (inOtpPhase) return const SizedBox.shrink();
                  final line = controller.customerTripStatusLine(
                    forBookingId: controller.postBookingApiId.value,
                  );
                  final sub = line.isNotEmpty
                      ? line
                      : 'Your service provider has arrived at the\nvehicle pick-up location.';
                  return CommonText.regular(
                    sub,
                    size: 12,
                    color: Colors.grey.shade700,
                    textAlign: TextAlign.center,
                  );
                }),
                const SizedBox(height: 12),
                Obx(() {
                  final showOtp =
                      BookingTrackingStatus.isCustomerPickupOtpSharePhase(
                        controller.customerSocketTrackingCode.value ??
                            controller.serviceDetail.value?.trackingStatus,
                      );
                  if (!showOtp) return const SizedBox.shrink();
                  return CustomerPickupOtpBanner(
                    otp: controller.customerPickupOtpForDisplay(
                      bookingId: controller.postBookingApiId.value,
                    ),
                    showWaitingWhenEmpty: true,
                  );
                }),
                const SizedBox(height: 12),
                _providerInfoRow(
                  onCallTap: () =>
                      unawaited(controller.launchCustomerDriverPhoneCall()),
                  onMessageTap: controller.openActiveCustomerBookingChat,
                ),
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: AppButton(
                    label: 'Confirm',
                    onPressed: controller.confirmProviderArrived,
                    type: ButtonType.primary,
                    bgColor: _red,
                    txtColor: Colors.white,
                    vPadding: 13,
                    btnCornerRadius: 14,
                    textSize: 16,
                  ),
                ),
              ],
            ),
          );
        }
        return Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            border: Border(top: BorderSide(color: _red, width: 3)),
            boxShadow: [
              BoxShadow(
                color: Color(0x33000000),
                blurRadius: 16,
                offset: Offset(0, -4),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Obx(() {
                final inOtpPhase =
                    BookingTrackingStatus.isCustomerPickupOtpSharePhase(
                      controller.customerSocketTrackingCode.value ??
                          controller.serviceDetail.value?.trackingStatus,
                    );
                final otp = controller.customerPickupOtpForDisplay(
                  bookingId: controller.postBookingApiId.value,
                );
                if (inOtpPhase) {
                  return CustomerPickupOtpBanner(
                    otp: otp,
                    showWaitingWhenEmpty: true,
                  );
                }
                return CommonText.medium(
                  config.title,
                  size: 15,
                  color: Colors.black87,
                  textAlign: TextAlign.center,
                );
              }),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: AppButton(
                  label: config.primaryCta,
                  onPressed: () {
                    if (config.openServiceDetails) {
                      Get.toNamed(
                        Routes.SERVICE_PROVIDER_PROFILE,
                        arguments: {
                          'inspectionMode': config.inspectionMode,
                          'bookingId': controller.postBookingApiId.value,
                        },
                      );
                    }
                  },
                  type: ButtonType.primary,
                  bgColor: _red,
                  txtColor: Colors.white,
                  vPadding: 13,
                  btnCornerRadius: 14,
                  textSize: 15,
                ),
              ),
              if (config.showProviderCard) ...[
                const SizedBox(height: 10),
                Obx(() {
                  final name = controller
                      .customerLiveDriverDisplayName()
                      .trim();
                  final displayName = name.isNotEmpty
                      ? name
                      : ServiceProviderLabels.fallbackNameYour;
                  final avatarUrl = controller
                      .customerLiveDriverAvatarUrl()
                      .trim();
                  final ratingLabel = controller
                      .customerLiveDriverRatingLabel();
                  return Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 10,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xffF2F2F7),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        TappableProfileAvatar(
                          imageUrl: avatarUrl,
                          size: 32,
                          showZoomBadge: false,
                          previewProviderName: displayName,
                          previewRating: controller.customerLiveDriverRating(),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              CommonText.semiBold(displayName, size: 13),
                              if (ratingLabel.isNotEmpty)
                                Row(
                                  children: [
                                    const Icon(
                                      Icons.star_rounded,
                                      size: 14,
                                      color: Colors.amber,
                                    ),
                                    const SizedBox(width: 2),
                                    CommonText.regular(ratingLabel, size: 12),
                                  ],
                                ),
                              _customerRequestedServiceDetails(),
                            ],
                          ),
                        ),
                        _tripContactActions(
                          onCallTap: () => unawaited(
                            controller.launchCustomerDriverPhoneCall(),
                          ),
                          onMessageTap: controller.openActiveCustomerBookingChat,
                        ),
                      ],
                    ),
                  );
                }),
              ],
              // Cancel Service — emergency option for active stages
              if (config.showCancelOption) ...[  
                const SizedBox(height: 10),
                Obx(() {
                  if (controller.isActiveTripCancellationBlocked) {
                    return const SizedBox.shrink();
                  }
                  return AppButton(
                    label: 'Cancel Service',
                    onPressed: () => _showCustomerCancelSheet(context),
                    type: ButtonType.tonal,
                    bgColor: const Color(0xffF5DCDC),
                    txtColor: _red,
                    btnCornerRadius: 14,
                    vPadding: 14,
                    textSize: 15,
                  );
                }),
              ],
            ],
          ),
        );
      }),
    );
  }

  /// Shows customer cancel-service bottom sheet (emergency cancel for active bookings).
  void _showCustomerCancelSheet(BuildContext context) {
    final mq = MediaQuery.of(context);
    final cancelCtrl = Get.isRegistered<CancelReasonController>()
        ? Get.find<CancelReasonController>()
        : null;
    if (cancelCtrl != null) {
      final id = controller.postBookingApiId.value;
      if (id != null) cancelCtrl.assignCancelBookingId(id);
      cancelCtrl.reset();
    }
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(bottom: mq.viewInsets.bottom),
          child: Container(
            margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: const Border(
                top: BorderSide(color: Color(0xffC4101F), width: 3),
              ),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 14),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade300,
                      borderRadius: BorderRadius.circular(99),
                    ),
                  ),
                ),
                Row(
                  children: [
                    const Icon(
                      Icons.warning_amber_rounded,
                      color: Color(0xffC4101F),
                      size: 22,
                    ),
                    const SizedBox(width: 8),
                    const Expanded(
                      child: CommonText.bold(
                        'Cancel Service',
                        size: 16,
                        color: Color(0xffC4101F),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                CommonText.regular(
                  'This is an emergency option. Please provide a reason for cancelling.',
                  size: 13,
                  color: Colors.black54,
                ),
                const SizedBox(height: 12),
                if (cancelCtrl != null)
                  CommonTextField(
                    controller: cancelCtrl.reasonController,
                    hintText: 'Enter reason for cancellation',
                    textColor: Colors.black87,
                    labelColor: Colors.black87,
                    hintColor: Colors.black38,
                    maxLines: 4,
                    minLines: 3,
                    keyboardType: TextInputType.multiline,
                    inputAction: TextInputAction.newline,
                    bgColor: Colors.transparent,
                    borderColor: Colors.black26,
                  ),
                const SizedBox(height: 14),
                if (cancelCtrl != null)
                  Obx(() {
                    final loading = cancelCtrl.isSubmitting.value;
                    return AppButton(
                      label: loading ? 'Cancelling...' : 'Confirm Cancellation',
                      onPressed: loading
                          ? null
                          : () => unawaited(cancelCtrl.submit()),
                      type: ButtonType.primary,
                      bgColor: const Color(0xffC4101F),
                      txtColor: Colors.white,
                      vPadding: 13,
                      btnCornerRadius: 12,
                      textSize: 15,
                    );
                  }),
                const SizedBox(height: 6),
                TextButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  child: CommonText.medium(
                    'Keep Booking',
                    size: 14,
                    color: Colors.black54,
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  /// Bottom panel shown immediately after booking is confirmed, before provider starts.
  Widget _bookingConfirmedPanel(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(top: BorderSide(color: Color(0xff4CAF50), width: 3)),
        boxShadow: [
          BoxShadow(
            color: Color(0x33000000),
            blurRadius: 16,
            offset: Offset(0, -4),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header row
          Row(
            children: [
              const Icon(Icons.check_circle_rounded,
                  color: Color(0xff4CAF50), size: 22),
              const SizedBox(width: 8),
              Expanded(
                child: CommonText.semiBold(
                  'Booking Confirmed',
                  size: 15,
                  color: const Color(0xff1B5E20),
                ),
              ),
              // Dismiss
              InkWell(
                onTap: controller.dismissCustomerTripPanel,
                borderRadius: BorderRadius.circular(20),
                child: const Padding(
                  padding: EdgeInsets.all(4),
                  child: Icon(Icons.close_rounded,
                      size: 18, color: Colors.black54),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          CommonText.regular(
            'Your booking is confirmed! A service provider will be assigned shortly.',
            size: 13,
            color: Colors.black87,
          ),
          const SizedBox(height: 12),
          // Booking ID row
          Obx(() {
            final detail = controller.serviceDetail.value;
            final bookingId = controller.postBookingApiId.value;
            final code = (detail?.bookingCode ?? '').trim();
            final displayId = code.isNotEmpty
                ? '#$code'
                : bookingId != null
                    ? '#$bookingId'
                    : '';
            final serviceType = (detail?.serviceType ?? '').trim();
            final scheduledAt = detail?.scheduledAt;
            final isScheduled = scheduledAt != null &&
                scheduledAt.toString().trim().isNotEmpty;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (displayId.isNotEmpty)
                  _kvRow('Booking ID', displayId),
                if (serviceType.isNotEmpty)
                  _kvRow('Service', serviceType),
                if (isScheduled)
                  _kvRow('Scheduled', _formatScheduledAt(scheduledAt)),
              ],
            );
          }),
          const SizedBox(height: 14),
          // CTA buttons
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () {
                    final id = controller.postBookingApiId.value;
                    if (id != null) {
                      Get.toNamed(
                        Routes.SERVICE_DETAIL,
                        arguments: {'bookingId': id},
                      );
                    }
                  },
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xffE70B1C)),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: CommonText.semiBold(
                    'View Details',
                    size: 13,
                    color: const Color(0xffE70B1C),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _formatScheduledAt(dynamic raw) {
    try {
      final dt = DateTime.parse(raw.toString()).toLocal();
      final months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      final h = dt.hour > 12 ? dt.hour - 12 : (dt.hour == 0 ? 12 : dt.hour);
      final m = dt.minute.toString().padLeft(2, '0');
      final ampm = dt.hour >= 12 ? 'PM' : 'AM';
      return '${months[dt.month - 1]} ${dt.day}, ${dt.year}  $h:$m $ampm';
    } catch (_) {
      return raw.toString();
    }
  }

  Widget _kvRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          CommonText.regular(label, size: 12, color: Colors.grey.shade600),
          const SizedBox(width: 6),
          CommonText.semiBold(value, size: 12, color: Colors.black87),
        ],
      ),
    );
  }

  Widget _enRoutePanel(BuildContext context, EnRoutePanelMode mode) {
    if (mode == EnRoutePanelMode.contactOptions) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          border: Border(top: BorderSide(color: _red, width: 3)),
          boxShadow: [
            BoxShadow(
              color: Color(0x33000000),
              blurRadius: 16,
              offset: Offset(0, -4),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const CommonText.medium('Contact'),
                const Spacer(),
                InkWell(
                  onTap: controller.resetEnRoutePanel,
                  borderRadius: BorderRadius.circular(16),
                  child: Container(
                    width: 24,
                    height: 24,
                    decoration: const BoxDecoration(
                      color: Color(0xff2C2C2E),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.close_rounded,
                      size: 14,
                      color: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: _darkActionTile(
                    label: 'Phone Call',
                    icon: Icons.phone,
                    onTap: () {
                      controller.resetEnRoutePanel();
                      unawaited(controller.launchCustomerDriverPhoneCall());
                    },
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _darkActionTile(
                    label: 'Messages',
                    icon: Icons.chat_bubble_outline_rounded,
                    onTap: () {
                      controller.resetEnRoutePanel();
                      controller.openActiveCustomerBookingChat();
                    },
                  ),
                ),
              ],
            ),
          ],
        ),
      );
    }

    if (mode == EnRoutePanelMode.cancelReason) {
      final mq = MediaQuery.of(context);
      final maxHeight = mq.size.height - mq.padding.top - mq.viewInsets.bottom - 8;

      return Padding(
        padding: EdgeInsets.only(bottom: mq.viewInsets.bottom),
        child: SafeArea(
          top: true,
          bottom: false,
          child: ConstrainedBox(
            constraints: BoxConstraints(maxHeight: math.max(220, maxHeight)),
            child: Container(
              width: double.infinity,
              padding: EdgeInsets.fromLTRB(16, 14, 16, 12 + mq.padding.bottom),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                border: Border(top: BorderSide(color: _red, width: 3)),
                boxShadow: [
                  BoxShadow(
                    color: Color(0x33000000),
                    blurRadius: 16,
                    offset: Offset(0, -4),
                  ),
                ],
              ),
              child: SingleChildScrollView(
                keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                  Row(
                    children: [
                      const Icon(Icons.warning_amber, size: 32),
                      const Spacer(),
                      InkWell(
                        onTap: controller.resetEnRoutePanel,
                        borderRadius: BorderRadius.circular(14),
                        child: const Padding(
                          padding: EdgeInsets.all(2),
                          child: Icon(Icons.cancel, size: 32),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  const CommonText.bold('Cancel This Booking', size: 14),
                  const SizedBox(height: 4),
                  CommonText.regular(
                    "Are you sure you want to cancel your service please give us a reason.",
                    size: 12,
                    color: Colors.grey.shade700,
                  ),
                  const SizedBox(height: 10),
                  CommonTextField(
                    controller:
                        Get.find<CancelReasonController>().reasonController,
                    hintText: 'Enter Details',
                    textColor: context.colorScheme.onSurface,
                    labelColor: context.colorScheme.onSurface,
                    hintColor: context.colorScheme.outlineVariant,
                    maxLines: 7,
                    minLines: 5,
                    keyboardType: TextInputType.multiline,
                    inputAction: TextInputAction.newline,
                    bgColor: Colors.transparent,
                    borderColor: context.colorScheme.outlineVariant,
                  ),
                  const SizedBox(height: 12),
                  Obx(() {
                    final cancel = Get.find<CancelReasonController>();
                    final loading = cancel.isSubmitting.value;
                    return SizedBox(
                      width: double.infinity,
                      child: AppButton(
                        label: loading ? 'Submitting...' : 'Submit',
                        onPressed: loading
                            ? null
                            : () => unawaited(cancel.submit()),
                        type: ButtonType.primary,
                        bgColor: _red,
                        txtColor: Colors.white,
                        vPadding: 12,
                        btnCornerRadius: 12,
                        textSize: 14,
                      ),
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

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(top: BorderSide(color: _red, width: 3)),
        boxShadow: [
          BoxShadow(
            color: Color(0x33000000),
            blurRadius: 16,
            offset: Offset(0, -4),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Obx(() {
            final inOtpPhase =
                BookingTrackingStatus.isCustomerPickupOtpSharePhase(
                  controller.customerSocketTrackingCode.value ??
                      controller.serviceDetail.value?.trackingStatus,
                );
            if (inOtpPhase) {
              return CustomerPickupOtpBanner(
                otp: controller.customerPickupOtpForDisplay(
                  bookingId: controller.postBookingApiId.value,
                ),
                showWaitingWhenEmpty: true,
              );
            }
            final msg = controller.customerTripStatusLine(
              forBookingId: controller.postBookingApiId.value,
            );
            final headline = msg.isNotEmpty
                ? msg
                : 'Your service provider is enroute to pick up your vehicle';
            return CommonText.medium(headline, size: 15, color: Colors.black87);
          }),
          Obx(() {
            final phase = controller.bookingTimerPhase.value;
            if (phase == null || phase.isEmpty) {
              return const SizedBox.shrink();
            }
            final phaseNorm = normalizeBookingTimerPhase(phase);
            if (phaseNorm == 'accept_countdown' ||
                phaseNorm == 'accept_timeout') {
              return const SizedBox.shrink();
            }
            return Padding(
              padding: const EdgeInsets.only(top: 10),
              child: ObxBookingTimerBanner(
                phase: phase,
                tick: controller.bookingTimerTick,
                remainingSeconds: controller.bookingTimerRemainingSeconds,
              ),
            );
          }),
          const SizedBox(height: 8),
          _providerInfoRow(
            onCallTap: () =>
                unawaited(controller.launchCustomerDriverPhoneCall()),
            onMessageTap: controller.openActiveCustomerBookingChat,
          ),
          const SizedBox(height: 10),
          Obx(() {
            if (controller.isActiveTripCancellationBlocked) {
              return const SizedBox.shrink();
            }
            return SizedBox(
              width: double.infinity,
              child: AppButton(
                label: 'Cancel Booking',
                onPressed: controller.openEnRouteCancelReason,
                type: ButtonType.primary,
                bgColor: _red,
                txtColor: Colors.white,
                vPadding: 12,
                btnCornerRadius: 12,
                textSize: 14,
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _providerInfoRow({
    VoidCallback? onCallTap,
    VoidCallback? onMessageTap,
  }) {
    return Obx(() {
      final name = controller.customerLiveDriverDisplayName().trim();
      final displayName = name.isNotEmpty
          ? name
          : ServiceProviderLabels.fallbackNameYour;
      final avatarUrl = controller.customerLiveDriverAvatarUrl().trim();
      final ratingLabel = controller.customerLiveDriverRatingLabel();
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
        decoration: BoxDecoration(
          color: const Color(0xffF2F2F7),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                TappableProfileAvatar(
                  imageUrl: avatarUrl,
                  size: 36,
                  previewProviderName: displayName,
                  previewRating: controller.customerLiveDriverRating(),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      CommonText.semiBold(displayName, size: 13),
                      if (ratingLabel.isNotEmpty)
                        Row(
                          children: [
                            const Icon(
                              Icons.star_rounded,
                              size: 14,
                              color: Colors.amber,
                            ),
                            const SizedBox(width: 2),
                            CommonText.regular(ratingLabel, size: 12),
                          ],
                        ),
                      _customerRequestedServiceDetails(),
                    ],
                  ),
                ),
              ],
            ),
            if (onCallTap != null || onMessageTap != null) ...[
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerRight,
                child: _tripContactActions(
                  onCallTap: onCallTap,
                  onMessageTap: onMessageTap,
                ),
              ),
            ],
          ],
        ),
      );
    });
  }

  Widget _tripContactActions({
    VoidCallback? onCallTap,
    VoidCallback? onMessageTap,
  }) {
    final effectiveMessageTap =
        onMessageTap ??
        (onCallTap != null ? controller.openActiveCustomerBookingChat : null);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (effectiveMessageTap != null) ...[
          _tripContactIconButton(
            icon: Icons.forum_outlined,
            label: 'Message',
            onTap: effectiveMessageTap,
            danger: true,
          ),
          if (onCallTap != null) const SizedBox(width: 8),
        ],
        if (onCallTap != null)
          _tripContactIconButton(
            icon: Icons.call_rounded,
            label: 'Call',
            onTap: onCallTap,
          ),
      ],
    );
  }

  Widget _customerRequestedServiceDetails() {
    final detail = controller.serviceDetail.value;
    final serviceType = bookingServiceTypeDisplay(detail?.serviceType).trim();
    final customPackage = '${detail?.customPackageName ?? ''}'.trim();
    final packageName = (detail?.package?.name ?? detail?.packageName ?? '')
        .trim();
    final selectedPackage = customPackage.isNotEmpty &&
            customPackage.toLowerCase() != 'null'
        ? customPackage
        : packageName;
    final requestedParts = <String>[
      if (serviceType.isNotEmpty) serviceType,
      if (selectedPackage.isNotEmpty &&
          selectedPackage.toLowerCase() != serviceType.toLowerCase())
        selectedPackage,
    ];
    final requestedService = requestedParts.isEmpty
        ? 'Service details updating'
        : requestedParts.join(' • ');
    final estimatedCompletion = detail == null
        ? '—'
        : estimatedServiceDurationLabelForBooking(
            packageDurationMinutes: detail.package?.durationMinutes,
            serviceDurationMinutes: detail.serviceDurationMinutes,
            serviceType: detail.serviceType,
            packageName: packageName,
            customPackageName: customPackage,
          );

    return Padding(
      padding: const EdgeInsets.only(top: 5),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _customerBookingInfoLine(
            icon: Icons.miscellaneous_services_rounded,
            label: 'Service requested',
            value: requestedService,
          ),
          const SizedBox(height: 3),
          _customerBookingInfoLine(
            icon: Icons.schedule_rounded,
            label: 'Estimated completion',
            value: estimatedCompletion == '—'
                ? 'Calculating…'
                : estimatedCompletion,
          ),
          Obx(() {
            controller.customerLiveEtaTick.value;
            final eta = controller.customerLiveEtaCountdownLabel;
            final arrival = controller.customerLiveEtaArrivalClockLabel;
            if (eta.isEmpty) return const SizedBox.shrink();
            final value = arrival.isEmpty ? eta : '$eta • about $arrival';
            return Padding(
              padding: const EdgeInsets.only(top: 3),
              child: _customerBookingInfoLine(
                icon: Icons.navigation_rounded,
                label: 'Provider ETA',
                value: value,
                emphasize: true,
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _customerBookingInfoLine({
    required IconData icon,
    required String label,
    required String value,
    bool emphasize = false,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 1),
          child: Icon(
            icon,
            size: 13,
            color: emphasize
                ? const Color(0xff238B2E)
                : const Color(0xff6A6A6A),
          ),
        ),
        const SizedBox(width: 4),
        Expanded(
          child: Text(
            '$label: $value',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: emphasize
                  ? const Color(0xff1B5E20)
                  : const Color(0xff4A4A4A),
              fontSize: 11,
              height: 1.2,
              fontWeight: emphasize ? FontWeight.w700 : FontWeight.w500,
            ),
          ),
        ),
      ],
    );
  }

  Widget _tripContactIconButton({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    bool danger = false,
  }) {
    final bgColor =
        danger ? const Color(0xffF5DCDC) : const Color(0xff2C2C2E);
    final iconColor = danger ? _red : Colors.white;
    final labelColor = danger ? _red : Colors.black54;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: bgColor,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: iconColor, size: 18),
          ),
          const SizedBox(height: 4),
          CommonText.medium(label, size: 10, color: labelColor),
        ],
      ),
    );
  }

  Widget _darkActionTile({
    required String label,
    required IconData icon,
    VoidCallback? onTap,
  }) {
    return Material(
      color: const Color(0xff2C2C2E),
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          height: 68,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              CommonText.medium(label, size: 12, color: Colors.white),
              Align(
                alignment: Alignment.bottomRight,
                child: Icon(icon, color: Colors.white54, size: 32),
              ),
            ],
          ),
        ),
      ),
    );
  }

  _PostBookingConfig _stageConfig(PostBookingStage stage) {
    final title = controller.customerPostBookingPanelTitle(stage);
    switch (stage) {
      case PostBookingStage.bookingConfirmed:
        return _PostBookingConfig(
          title: title,
          primaryCta: 'View Booking Details',
          showProviderCard: false,
          openServiceDetails: true,
          inspectionMode: false,
        );
      case PostBookingStage.providerEnRoutePickup:
        return _PostBookingConfig(
          title: title,
          primaryCta: 'Cancel Booking',
          showProviderCard: true,
          openServiceDetails: false,
          inspectionMode: false,
        );
      case PostBookingStage.serviceStarted:
        return _PostBookingConfig(
          title: title,
          primaryCta: 'View Service Details',
          showProviderCard: true,
          openServiceDetails: true,
          inspectionMode: false,
          showCancelOption: true,
        );
      case PostBookingStage.providerArrived:
        return _PostBookingConfig(
          title: title,
          primaryCta: 'Confirm',
          showProviderCard: false,
          openServiceDetails: false,
          inspectionMode: false,
        );
      case PostBookingStage.carOnWayBack:
        return _PostBookingConfig(
          title: title,
          primaryCta: 'View Service Details',
          showProviderCard: true,
          openServiceDetails: true,
          inspectionMode: false,
          showCancelOption: true,
        );
      case PostBookingStage.carBackHome:
        return _PostBookingConfig(
          title: title,
          primaryCta: 'Inspect Car & Complete Service',
          showProviderCard: true,
          openServiceDetails: true,
          inspectionMode: true,
        );
    }
  }
}

class _PostBookingConfig {
  final String title;
  final String primaryCta;
  final bool showProviderCard;
  final bool openServiceDetails;
  final bool inspectionMode;
  final bool showCancelOption;

  const _PostBookingConfig({
    required this.title,
    required this.primaryCta,
    required this.showProviderCard,
    required this.openServiceDetails,
    required this.inspectionMode,
    this.showCancelOption = false,
  });
}

class _DriverStatusBanner extends StatelessWidget {
  const _DriverStatusBanner();

  @override
  Widget build(BuildContext context) {
    return const SizedBox.shrink();
  }
}

class _HeaderIconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;

  const _HeaderIconButton({required this.icon, required this.onTap});

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
          child: Icon(icon, color: Colors.black87, size: 20),
        ),
      ),
    );
  }
}

class _MapBackground extends StatelessWidget {
  final ValueChanged<MapboxMap>? onMapCreated;
  final OnMapTapListener? onMapTap;
  final OnMapScrollListener? onMapScroll;
  final OnMapZoomListener? onMapZoom;

  const _MapBackground({
    this.onMapCreated,
    this.onMapTap,
    this.onMapScroll,
    this.onMapZoom,
  });

  @override
  Widget build(BuildContext context) {
    // Start at a low zoom with no fixed location so the permission prompt
    // fires immediately and the map recenters on the user's real position.
    final camera = CameraOptions(
      center: Point(coordinates: Position(0, 0)),
      zoom: 1,
      bearing: 0,
      pitch: 0,
    );
    return MapWidget(
      cameraOptions: camera,
      onMapCreated: onMapCreated,
      onTapListener: onMapTap,
      onScrollListener: onMapScroll,
      onZoomListener: onMapZoom,
    );
  }
}

class _HomeBottomNavPill extends StatefulWidget {
  final int selectedIndex;
  final ValueChanged<int> onTap;

  const _HomeBottomNavPill({required this.selectedIndex, required this.onTap});

  @override
  State<_HomeBottomNavPill> createState() => _HomeBottomNavPillState();
}

class _HomeBottomNavPillState extends State<_HomeBottomNavPill>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseController;
  late final Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);
    _pulseAnimation = Tween<double>(begin: 0.5, end: 1.0).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Nav tab indices (IndexedStack):
    //   0 = Home, 1 = My Bookings (history), 2 = Active Booking (customer only),
    //   3 = Settings, 4 = Support
    //
    // Drivers see only 4 tabs (index 2 skipped in their nav):
    //   pos 0→idx 0, pos 1→idx 1, pos 2→idx 3, pos 3→idx 4

    final DashboardController? dashCtrl = Get.isRegistered<DashboardController>()
        ? Get.find<DashboardController>()
        : null;

    final isCustomer = Prefs().isCustomerRole;
    // visibleIndices maps nav pill position → IndexedStack index
    final List<int> visibleIndices =
        isCustomer ? [0, 1, 2, 3, 4] : [0, 1, 3, 4];

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
      decoration: BoxDecoration(
        color: DashboardView._navPillBg,
        borderRadius: BorderRadius.circular(32),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: List.generate(visibleIndices.length, (pos) {
          final i = visibleIndices[pos]; // real IndexedStack index
          final selected = i == widget.selectedIndex;

          // Build the base icon for this tab.
          Widget innerIcon;
          switch (i) {
            case 0:
              innerIcon = Assets.imagesIcHome
                  .image(width: 22, height: 22,
                      color: selected ? DashboardView._navPillBg : Colors.white70)
                  .marginAll(10);
            case 1:
              innerIcon = Assets.imagesIcBooking
                  .image(width: 22, height: 22,
                      color: selected ? DashboardView._navPillBg : Colors.white70)
                  .marginAll(10);
            case 2:
              // Active Booking tab — Material icon
              innerIcon = Icon(Icons.bookmark_outlined, size: 22,
                  color: selected ? DashboardView._navPillBg : Colors.white70)
                  .marginAll(10);
            case 3:
              innerIcon = Assets.imagesIcSetting
                  .image(width: 22, height: 22,
                      color: selected ? DashboardView._navPillBg : Colors.white70)
                  .marginAll(10);
            default:
              innerIcon = Assets.imagesIcHeadphone
                  .image(width: 22, height: 22,
                      color: selected ? DashboardView._navPillBg : Colors.white70)
                  .marginAll(10);
          }

          // Wrap Active Booking tab (index 2) with animated green dot for customers.
          Widget iconWidget = innerIcon;
          if (i == 2 && isCustomer && dashCtrl != null) {
            iconWidget = Obx(() {
              final hasActive = dashCtrl.customerActiveBooking.value != null;
              return Stack(
                clipBehavior: Clip.none,
                children: [
                  Icon(Icons.bookmark_outlined, size: 22,
                      color: selected ? DashboardView._navPillBg : Colors.white70)
                      .marginAll(10),
                  if (hasActive)
                    Positioned(
                      top: 4,
                      right: 4,
                      child: AnimatedBuilder(
                        animation: _pulseAnimation,
                        builder: (_, __) => Opacity(
                          opacity: _pulseAnimation.value,
                          child: Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              color: Color(0xff34B620),
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              );
            });
          }

          return InkWell(
            onTap: () => widget.onTap(i),
            borderRadius: BorderRadius.circular(24),
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: selected ? Colors.white : Colors.transparent,
                shape: BoxShape.circle,
              ),
              child: iconWidget,
            ),
          );
        }),
      ),
    );
  }
}

class _ServiceCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final bool isCombined;
  final bool selected;
  final VoidCallback onTap;

  const _ServiceCard({
    required this.title,
    required this.icon,
    this.isCombined = false,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.xl),
      child: Container(
        padding: EdgeInsets.symmetric(
          vertical: isCombined ? AppSpacing.sm : AppSpacing.md,
          horizontal: AppSpacing.lg,
        ),
        decoration: BoxDecoration(
          color: Colors.black,
          borderRadius: BorderRadius.circular(AppRadius.xl),
          // Combined card: never show a coloured border (looks selected by default).
          // Single card: red when selected, subtle grey otherwise.
          border: isCombined
              ? null
              : Border.all(
                  color: selected
                      ? DashboardView._primaryRed
                      : const Color(0xffE8E8EF),
                  width: selected ? 2 : 1,
                ),
        ),
        child: isCombined ? _buildCombinedContent() : _buildSingleContent(),
      ),
    );
  }

  Widget _buildSingleContent() {
    return Column(
      children: [
        CommonText.semiBold(
          title,
          size: 18,
          textAlign: TextAlign.center,
          color: Colors.white,
        ),
        const SizedBox(height: AppSpacing.sm),
        Align(
          alignment: Alignment.bottomRight,
          child: _ServiceCardIcon(icon: icon, isCombined: false),
        ),
      ],
    );
  }

  Widget _buildCombinedContent() {
    return Row(
      children: [
        Expanded(
          child: CommonText.semiBold(
            title,
            size: 17,
            textAlign: TextAlign.center,
            color: Colors.white,
          ),
        ),
        _ServiceCardIcon(icon: icon, isCombined: true),
      ],
    );
  }
}

class _ServiceCardIcon extends StatelessWidget {
  final IconData icon;
  final bool isCombined;

  const _ServiceCardIcon({required this.icon, this.isCombined = false});

  @override
  Widget build(BuildContext context) {
    if (isCombined) {
      return const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.local_car_wash_rounded, size: 26, color: Colors.white),
          SizedBox(width: 4),
          Icon(Icons.ev_station_rounded, size: 26, color: Colors.white),
        ],
      );
    }

    return Icon(icon, size: 34, color: Colors.white);
  }
}
