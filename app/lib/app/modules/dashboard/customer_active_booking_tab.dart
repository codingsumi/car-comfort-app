import 'dart:async';

import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../gen/assets.gen.dart';
import '../../routes/app_pages.dart';
import '../../utils/service_type_label.dart';
import '../../widgets/button.dart';
import '../../widgets/image.dart';
import '../../widgets/text.dart';
import 'dashboard_controller.dart';

class CustomerActiveBookingTab extends StatefulWidget {
  const CustomerActiveBookingTab({super.key});

  @override
  State<CustomerActiveBookingTab> createState() =>
      _CustomerActiveBookingTabState();
}

class _CustomerActiveBookingTabState extends State<CustomerActiveBookingTab> {
  DashboardController? _controller;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (!Get.isRegistered<DashboardController>()) return;
      _controller = Get.find<DashboardController>();
      unawaited(_controller!.fetchActiveBooking());
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!Get.isRegistered<DashboardController>()) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }
    final controller = Get.find<DashboardController>();
    final top = MediaQuery.paddingOf(context).top;

    return Scaffold(
      backgroundColor: const Color(0xffFAFAFA),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Header — same style as _BookingsHeader ──────────────────
          ClipRRect(
            borderRadius:
                const BorderRadius.vertical(bottom: Radius.circular(18)),
            child: SizedBox(
              height: top + 84,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Assets.imagesHomeHBg.image(fit: BoxFit.cover),
                  Container(color: Colors.black.withValues(alpha: 0.45)),
                  Padding(
                    padding:
                        EdgeInsets.fromLTRB(20, top + 16, 16, 12),
                    child: Row(
                      children: [
                        const Expanded(
                          child: CommonText.regular(
                            'My Active Booking',
                            color: Colors.white,
                            size: 18,
                          ),
                        ),
                        Material(
                          color: Colors.white,
                          shape: const CircleBorder(),
                          child: InkWell(
                            onTap: () =>
                                unawaited(controller.fetchActiveBooking()),
                            customBorder: const CircleBorder(),
                            child: const SizedBox(
                              width: 36,
                              height: 36,
                              child: Icon(
                                Icons.refresh_rounded,
                                color: Colors.black87,
                                size: 20,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          // ── Body ────────────────────────────────────────────────────
          Expanded(
            child: Obx(() {
              final booking = controller.customerActiveBooking.value;
              if (booking == null) {
                return _EmptyState(
                  onStart: () => controller.homeNavIndex.value = 0,
                );
              }
              return _BookingBody(booking: booking);
            }),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  final VoidCallback onStart;
  const _EmptyState({required this.onStart});

  static const Color _red = Color(0xffC4101F);

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.calendar_today_outlined,
                  size: 38, color: Colors.grey),
            ),
            const SizedBox(height: 20),
            const CommonText.bold(
              'No Active Booking',
              size: 18,
              color: Colors.black87,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            CommonText.regular(
              "You don't have any active or upcoming bookings right now.",
              size: 14,
              color: Colors.grey.shade600,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 28),
            AppButton(
              label: 'Start a New Booking',
              onPressed: onStart,
              type: ButtonType.primary,
              bgColor: _red,
              txtColor: Colors.white,
              vPadding: 14,
              btnCornerRadius: 14,
              textSize: 15,
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Booking body
// ─────────────────────────────────────────────────────────────────────────────

class _BookingBody extends StatelessWidget {
  final dynamic booking;
  const _BookingBody({required this.booking});

  static const Color _red = Color(0xffC4101F);
  static const _shadow = [
    BoxShadow(color: Color(0x14000000), blurRadius: 14, offset: Offset(0, 4)),
    BoxShadow(color: Color(0x08000000), blurRadius: 4, offset: Offset(0, 1)),
  ];

  @override
  Widget build(BuildContext context) {
    final status =
        (booking.status ?? '').toString().trim().toLowerCase();
    final trackingStatus =
        (booking.trackingStatus ?? '').toString().trim();
    final serviceType =
        (booking.serviceType ?? '').toString().trim();
    final bookingCode =
        (booking.bookingCode ?? '').toString().trim();
    final scheduleType =
        (booking.scheduleType ?? '').toString().trim();
    final scheduledAt = booking.scheduledAt;
    final totalPrice = booking.totalPrice == null
        ? null
        : double.tryParse(booking.totalPrice.toString());
    final driver = booking.driver;
    final pickupAddress =
        (booking.pickupAddress ?? '').toString().trim();
    final serviceAddress =
        (booking.serviceAddress ?? '').toString().trim();
    final serviceLocationName =
        (booking.serviceLocationName ?? '').toString().trim();
    final chargeLimit = booking.chargeLimit == null
        ? null
        : int.tryParse(booking.chargeLimit.toString());
    final estRadiusMiles = booking.estRadiusMiles == null
        ? null
        : double.tryParse(booking.estRadiusMiles.toString());
    final bookedAt = booking.createdAt;

    final statusLabel = _resolveStatusLabel(status, trackingStatus);
    final statusColor = _resolveStatusColor(status, trackingStatus);
    final serviceLabel = serviceTypePickerLabel(serviceType);
    final isScheduled = scheduleType.toLowerCase() == 'scheduled';

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        // ── 1. Primary booking card ─────────────────────────────────
        _card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Status banner
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 11),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.09),
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(16),
                    topRight: Radius.circular(16),
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 9,
                      height: 9,
                      decoration: BoxDecoration(
                        color: statusColor,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 7),
                    CommonText.bold(
                      statusLabel.toUpperCase(),
                      size: 12,
                      color: statusColor,
                    ),
                    const Spacer(),
                    if (bookingCode.isNotEmpty)
                      CommonText.regular(
                        '#$bookingCode',
                        size: 11,
                        color: Colors.grey.shade500,
                      ),
                  ],
                ),
              ),

              // Service icon + name + price
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 58,
                      height: 58,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: const Color(0xffC4101F).withValues(alpha: 0.28),
                          width: 3,
                        ),
                      ),
                      child: Container(
                        margin: const EdgeInsets.all(4),
                        decoration: const BoxDecoration(
                          color: Color(0xffC4101F),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          serviceTypePickerIcon(serviceType),
                          size: 24,
                          color: Colors.white,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          CommonText.bold(
                            serviceLabel.isNotEmpty
                                ? serviceLabel
                                : 'Car Service',
                            size: 18,
                            color: Colors.black87,
                          ),
                          const SizedBox(height: 2),
                          CommonText.regular(
                            'Booking ID',
                            size: 12,
                            color: Colors.grey.shade500,
                          ),
                          if (bookingCode.isNotEmpty)
                            CommonText.regular(
                              '#$bookingCode',
                              size: 12,
                              color: Colors.black54,
                            ),
                        ],
                      ),
                    ),
                    if (totalPrice != null && totalPrice > 0)
                      CommonText.bold(
                        '\$${totalPrice.toStringAsFixed(2)}',
                        size: 20,
                        color: _red,
                      ),
                  ],
                ),
              ),

              const SizedBox(height: 14),
              const Divider(height: 1, color: Color(0xffEEEEEE)),
              const SizedBox(height: 11),

              // Schedule type + booked-on
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
                child: Row(
                  children: [
                    const Icon(Icons.auto_awesome_outlined,
                        size: 15, color: Colors.black45),
                    const SizedBox(width: 5),
                    CommonText.regular(
                      isScheduled ? 'Scheduled' : 'On Demand',
                      size: 13,
                      color: Colors.black54,
                    ),
                    const Spacer(),
                    const Icon(Icons.calendar_month_outlined,
                        size: 14, color: Colors.black45),
                    const SizedBox(width: 5),
                    CommonText.regular(
                      (isScheduled && scheduledAt != null)
                          ? 'Scheduled ${_fmtDate(scheduledAt)}'
                          : bookedAt != null
                              ? 'Booked on ${_fmtDate(bookedAt)}'
                              : 'In queue',
                      size: 12,
                      color: Colors.black54,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 14),

        // ── 2. Current status card ──────────────────────────────────
        _card(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const CommonText.bold(
                'Current Status',
                size: 15,
                color: Colors.black87,
              ),
              const SizedBox(height: 12),
              _StatusBox(
                  status: status, trackingStatus: trackingStatus),
            ],
          ),
        ),

        const SizedBox(height: 14),

        // ── 3. Service summary card ─────────────────────────────────
        _card(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const CommonText.bold(
                'Service Summary',
                size: 15,
                color: Colors.black87,
              ),
              const SizedBox(height: 12),

              // EST. RADIUS row
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xffF5F5F5),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 34,
                      height: 34,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(8),
                        boxShadow: const [
                          BoxShadow(
                              color: Color(0x0F000000), blurRadius: 4),
                        ],
                      ),
                      child: const Icon(Icons.my_location_rounded,
                          size: 17, color: Colors.black54),
                    ),
                    const SizedBox(width: 10),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        CommonText.regular(
                          'EST. RADIUS',
                          size: 10,
                          color: Colors.grey.shade500,
                        ),
                        CommonText.bold(
                          estRadiusMiles != null
                              ? '${estRadiusMiles.toStringAsFixed(1)} miles'
                              : 'N/A',
                          size: 13,
                          color: Colors.black87,
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // Route timeline — always show with placeholder text if empty
              _RouteTimeline(
                pickupAddress: pickupAddress,
                serviceAddress: serviceAddress,
                serviceLocationName: serviceLocationName,
                scheduledAt: scheduledAt,
                serviceType: serviceType,
                chargeLimit: chargeLimit,
              ),

              // Driver card
              if (driver != null &&
                  (driver.name?.isNotEmpty ?? false)) ...[
                const SizedBox(height: 12),
                const Divider(height: 1, color: Color(0xffEEEEEE)),
                const SizedBox(height: 12),
                _DriverRow(driver: driver),
              ],
            ],
          ),
        ),

        const SizedBox(height: 20),

        // ── 4. View Details button ──────────────────────────────────
        AppButton(
          label: 'View Details',
          onPressed: () => Get.toNamed(
            Routes.SERVICE_DETAIL,
            arguments: {'bookingId': booking.id},
          ),
          type: ButtonType.primary,
          bgColor: _red,
          txtColor: Colors.white,
          vPadding: 15,
          btnCornerRadius: 14,
          textSize: 15,
        ),
      ],
    );
  }

  Widget _card({required Widget child, EdgeInsets? padding}) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: _shadow,
      ),
      child: child,
    );
  }

  static String _resolveStatusLabel(
      String status, String trackingStatus) {
    if (trackingStatus.isNotEmpty) {
      switch (trackingStatus.toUpperCase()) {
        case 'DRIVER_STARTED_TO_CUSTOMER':
        case 'DRIVER_NEAR_CUSTOMER':
          return 'Active';
        case 'DRIVER_REACHED_CUSTOMER':
        case 'OTP_PENDING':
          return 'Provider Arrived';
        case 'OTP_VERIFIED':
        case 'VEHICLE_PICKED':
        case 'BEFORE_IMAGES_UPLOADED':
        case 'DRIVER_STARTED_TO_SERVICE_CENTER':
        case 'DRIVER_REACHED_SERVICE_CENTER':
        case 'VEHICLE_WAITING_IN_QUEUE':
        case 'SERVICE_STARTED':
        case 'SERVICE_IN_PROGRESS':
        case 'SECOND_SERVICE_STARTED':
        case 'SECOND_SERVICE_IN_PROGRESS':
        case 'SERVICE_COMPLETED':
        case 'SECOND_SERVICE_COMPLETED':
        case 'AFTER_IMAGES_UPLOADED':
        case 'DRIVER_LEFT_SERVICE_CENTER':
        case 'DRIVER_RETURNING_TO_CUSTOMER':
        case 'DRIVER_REACHED_CUSTOMER_RETURN':
          return 'Active';
        case 'VEHICLE_DELIVERED':
          return 'Completed';
      }
    }
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'confirmed':
        return 'Confirmed';
      case 'assigned':
        return 'Active';
      case 'in_progress':
        return 'Active';
      case 'scheduled':
        return 'Upcoming';
      default:
        return status.isNotEmpty
            ? status[0].toUpperCase() + status.substring(1)
            : 'Active';
    }
  }

  static Color _resolveStatusColor(
      String status, String trackingStatus) {
    if (trackingStatus.toUpperCase() == 'VEHICLE_DELIVERED') {
      return const Color(0xff34B620);
    }
    if (trackingStatus.isNotEmpty) return const Color(0xff34B620);
    switch (status) {
      case 'pending':
        return Colors.orange;
      case 'confirmed':
      case 'assigned':
      case 'in_progress':
        return const Color(0xff34B620);
      case 'scheduled':
        return const Color(0xff5856D6);
      default:
        return Colors.grey;
    }
  }

  static String _fmtDate(dynamic raw) {
    try {
      final dt = DateTime.parse(raw.toString()).toLocal();
      const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];
      final h = dt.hour > 12
          ? dt.hour - 12
          : (dt.hour == 0 ? 12 : dt.hour);
      final m = dt.minute.toString().padLeft(2, '0');
      final ampm = dt.hour >= 12 ? 'PM' : 'AM';
      return '${dt.day} ${months[dt.month - 1]}, $h:$m $ampm';
    } catch (_) {
      return raw.toString();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Current status box
// ─────────────────────────────────────────────────────────────────────────────

class _StatusBox extends StatelessWidget {
  final String status;
  final String trackingStatus;
  const _StatusBox({required this.status, required this.trackingStatus});

  @override
  Widget build(BuildContext context) {
    final info = _info(status, trackingStatus);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      decoration: BoxDecoration(
        color: const Color(0xffE8F5E9),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: const Color(0xff34B620).withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.directions_car_filled_rounded,
              size: 24,
              color: Color(0xff34B620),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CommonText.bold(info.title,
                    size: 13, color: Colors.black87),
                const SizedBox(height: 3),
                CommonText.regular(info.subtitle,
                    size: 12, color: Colors.black54, maxLines: 2),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static _StatusInfo _info(String status, String tracking) {
    switch (tracking.toUpperCase()) {
      case 'DRIVER_STARTED_TO_CUSTOMER':
        return const _StatusInfo(
          title: 'Service provider is on the way',
          subtitle: 'Your provider is heading towards you.',
        );
      case 'DRIVER_NEAR_CUSTOMER':
        return const _StatusInfo(
          title: 'Provider is nearby',
          subtitle: 'Your provider is almost at your location.',
        );
      case 'DRIVER_REACHED_CUSTOMER':
      case 'OTP_PENDING':
        return const _StatusInfo(
          title: 'Provider has arrived',
          subtitle: 'Share your OTP to hand over the vehicle.',
        );
      case 'OTP_VERIFIED':
      case 'VEHICLE_PICKED':
      case 'BEFORE_IMAGES_UPLOADED':
        return const _StatusInfo(
          title: 'Vehicle picked up',
          subtitle:
              'Your vehicle is on its way to the service center.',
        );
      case 'DRIVER_STARTED_TO_SERVICE_CENTER':
      case 'DRIVER_REACHED_SERVICE_CENTER':
      case 'VEHICLE_WAITING_IN_QUEUE':
        return const _StatusInfo(
          title: 'Heading to service center',
          subtitle:
              'Your vehicle is en route to the service location.',
        );
      case 'SERVICE_STARTED':
      case 'SERVICE_IN_PROGRESS':
      case 'SECOND_SERVICE_STARTED':
      case 'SECOND_SERVICE_IN_PROGRESS':
        return const _StatusInfo(
          title: 'Service in progress',
          subtitle: 'Your vehicle is currently being serviced.',
        );
      case 'SERVICE_COMPLETED':
      case 'SECOND_SERVICE_COMPLETED':
      case 'AFTER_IMAGES_UPLOADED':
      case 'DRIVER_LEFT_SERVICE_CENTER':
      case 'DRIVER_RETURNING_TO_CUSTOMER':
        return const _StatusInfo(
          title: 'Service complete — returning',
          subtitle: 'Your vehicle is on its way back to you.',
        );
      case 'DRIVER_REACHED_CUSTOMER_RETURN':
        return const _StatusInfo(
          title: 'Vehicle has arrived',
          subtitle:
              'Your provider is back. Please inspect your vehicle.',
        );
      case 'VEHICLE_DELIVERED':
        return const _StatusInfo(
          title: 'Service completed',
          subtitle: 'Your vehicle has been returned. Thank you!',
        );
    }
    switch (status) {
      case 'pending':
        return const _StatusInfo(
          title: 'Booking pending',
          subtitle:
              'We are assigning a service provider for you.',
        );
      case 'confirmed':
        return const _StatusInfo(
          title: 'Booking confirmed',
          subtitle: 'A provider will be assigned shortly.',
        );
      case 'assigned':
        return const _StatusInfo(
          title: 'Provider assigned',
          subtitle:
              'Your service provider will start heading soon.',
        );
      case 'in_progress':
        return const _StatusInfo(
          title: 'Service in progress',
          subtitle: 'Your vehicle is currently being serviced.',
        );
      case 'scheduled':
        return const _StatusInfo(
          title: 'Upcoming booking',
          subtitle: 'Your booking is scheduled and confirmed.',
        );
      default:
        return const _StatusInfo(
          title: 'Booking active',
          subtitle: 'Your booking is being processed.',
        );
    }
  }
}

class _StatusInfo {
  final String title;
  final String subtitle;
  const _StatusInfo({required this.title, required this.subtitle});
}

// ─────────────────────────────────────────────────────────────────────────────
// Route timeline
// ─────────────────────────────────────────────────────────────────────────────

class _RouteTimeline extends StatelessWidget {
  final String pickupAddress;
  final String serviceAddress;
  final String serviceLocationName;
  final dynamic scheduledAt;
  final String serviceType;
  final int? chargeLimit;

  const _RouteTimeline({
    required this.pickupAddress,
    required this.serviceAddress,
    required this.serviceLocationName,
    required this.scheduledAt,
    required this.serviceType,
    this.chargeLimit,
  });

  @override
  Widget build(BuildContext context) {
    final timeLabel =
        scheduledAt != null ? _fmtTime(scheduledAt) : '';
    final stopLabel = _stopLabel(serviceType);
    final serviceDisplay = serviceLocationName.isNotEmpty
        ? serviceLocationName
        : serviceAddress.isNotEmpty
            ? serviceAddress
            : 'Service location';
    final pickup = pickupAddress.isNotEmpty
        ? pickupAddress
        : 'Your location';
    final isEv = serviceType.toLowerCase() == 'ev_charging' ||
        serviceType.toLowerCase() == 'combo';

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Dashed connector
          SizedBox(
            width: 24,
            child: Column(
              children: [
                _Dot(filled: false),
                const Expanded(
                  child: SizedBox(
                    width: 2,
                    child: CustomPaint(
                      painter: _DashedLinePainter(),
                    ),
                  ),
                ),
                _Dot(filled: true),
              ],
            ),
          ),
          const SizedBox(width: 12),

          // Labels
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Pickup
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const CommonText.semiBold(
                            'Pickup',
                            size: 13,
                            color: Colors.black87,
                          ),
                          CommonText.regular(
                            pickup,
                            size: 12,
                            color: Colors.grey.shade600,
                            maxLines: 2,
                          ),
                        ],
                      ),
                    ),
                    if (timeLabel.isNotEmpty) ...[
                      const SizedBox(width: 8),
                      CommonText.regular(
                        timeLabel,
                        size: 12,
                        color: Colors.grey.shade500,
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 20),
                // Service stop
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CommonText.semiBold(
                      stopLabel,
                      size: 13,
                      color: Colors.black87,
                    ),
                    CommonText.regular(
                      serviceDisplay,
                      size: 12,
                      color: Colors.grey.shade600,
                      maxLines: 2,
                    ),
                    if (isEv && chargeLimit != null) ...[
                      const SizedBox(height: 3),
                      CommonText.semiBold(
                        'Charge limit: $chargeLimit%',
                        size: 12,
                        color: const Color(0xff34B620),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static String _stopLabel(String serviceType) {
    switch (serviceType.toLowerCase()) {
      case 'ev_charging':
        return 'Charging Station';
      case 'car_wash':
        return 'Wash Center';
      case 'combo':
        return 'Service Center';
      default:
        return 'Service Location';
    }
  }

  static String _fmtTime(dynamic raw) {
    try {
      final dt = DateTime.parse(raw.toString()).toLocal();
      final h = dt.hour > 12
          ? dt.hour - 12
          : (dt.hour == 0 ? 12 : dt.hour);
      final m = dt.minute.toString().padLeft(2, '0');
      final ampm = dt.hour >= 12 ? 'PM' : 'AM';
      return '$h:$m $ampm';
    } catch (_) {
      return '';
    }
  }
}

class _Dot extends StatelessWidget {
  final bool filled;
  const _Dot({required this.filled});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 16,
      height: 16,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: filled ? const Color(0xff34B620) : Colors.white,
        border: Border.all(
          color: const Color(0xff34B620),
          width: 2.5,
        ),
      ),
      child: filled
          ? const Center(
              child: Icon(Icons.circle, size: 6, color: Colors.white),
            )
          : null,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Driver row
// ─────────────────────────────────────────────────────────────────────────────

class _DriverRow extends StatelessWidget {
  final dynamic driver;
  const _DriverRow({required this.driver});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        ClipOval(
          child: driver.avatar != null &&
                  (driver.avatar?.isNotEmpty ?? false)
              ? ImageFromNetwork(
                  driver.avatar.toString(),
                  width: 42,
                  height: 42,
                  fit: BoxFit.cover,
                  placeholderWidget: _placeholder(),
                )
              : _placeholder(),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CommonText.semiBold(
                  driver.name ?? 'Service Provider', size: 14),
              if (driver.rating != null)
                Row(
                  children: [
                    const Icon(Icons.star_rounded,
                        size: 13, color: Colors.amber),
                    const SizedBox(width: 3),
                    CommonText.regular(
                      (driver.rating as num?)?.toStringAsFixed(1) ?? '',
                      size: 12,
                      color: Colors.grey.shade600,
                    ),
                  ],
                ),
            ],
          ),
        ),
        Container(
          padding:
              const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: const Color(0xffE8F5E9),
            borderRadius: BorderRadius.circular(20),
          ),
          child: const CommonText.semiBold(
            'Provider',
            size: 11,
            color: Color(0xff34B620),
          ),
        ),
      ],
    );
  }

  Widget _placeholder() {
    return Container(
      width: 42,
      height: 42,
      color: Colors.grey.shade200,
      child:
          const Icon(Icons.schedule_outlined, size: 24, color: Colors.grey),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashed line painter (replaces LayoutBuilder to avoid IntrinsicHeight crash)
// ─────────────────────────────────────────────────────────────────────────────

class _DashedLinePainter extends CustomPainter {
  const _DashedLinePainter();

  @override
  void paint(Canvas canvas, Size size) {
    const dashHeight = 5.0;
    const dashGap = 4.0;
    final paint = Paint()
      ..color = const Color(0xffCCCCCC)
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;

    double y = 0;
    while (y + dashHeight <= size.height) {
      canvas.drawLine(
        Offset(size.width / 2, y),
        Offset(size.width / 2, y + dashHeight),
        paint,
      );
      y += dashHeight + dashGap;
    }
  }

  @override
  bool shouldRepaint(_DashedLinePainter oldDelegate) => false;
}
