import 'dart:async';

import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../constants/booking_tracking_status.dart';
import '../modules/driver_dashboard/driver_dashboard_controller.dart';
import '../network/response/booking_detail_response.dart';
import '../utils/booking_timer_utils.dart';
import '../utils/driver_service_details_display.dart';
import 'booking_route_plan_card.dart';
import 'driver_service_details_card.dart';
import 'booking_service_images_card.dart';
import 'booking_service_notes_card.dart';
import 'image.dart';
import 'text.dart';

const List<BoxShadow> _driverActiveBookingCardShadow = [
  BoxShadow(color: Color(0x12000000), blurRadius: 14, offset: Offset(0, 4)),
  BoxShadow(color: Color(0x08000000), blurRadius: 4, offset: Offset(0, 1)),
];

Future<void> showDriverActiveBookingDetailSheet(
  BuildContext context, {
  required int bookingId,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _DriverActiveBookingDetailSheet(bookingId: bookingId),
  );
}

class _DriverActiveBookingDetailSheet extends GetView<DriverDashboardController> {
  const _DriverActiveBookingDetailSheet({required this.bookingId});

  final int bookingId;

  static const Color _labelGrey = Color(0xff8E8E93);
  static const Color _danger = Color(0xffE70B1C);

  @override
  Widget build(BuildContext context) {
  final maxH = MediaQuery.sizeOf(context).height * 0.88;

    return Container(
      constraints: BoxConstraints(maxHeight: maxH),
      margin: const EdgeInsets.only(top: 8),
      decoration: const BoxDecoration(
        color: Color(0xffF4F4F4),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(top: BorderSide(color: _danger, width: 3)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 10),
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 12, 8, 8),
            child: Row(
              children: [
                const Expanded(
                  child: CommonText.bold(
                    'Active Booking Details',
                    size: 18,
                    color: Color(0xff1C1C1E),
                  ),
                ),
                IconButton(
                  onPressed: () => Get.back<void>(),
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
          ),
          Flexible(
            child: Obx(() {
              final detail = controller.serviceDetail.value;
              final loading = controller.isServiceDetailLoading.value &&
                  controller.serviceDetailBookingId.value == bookingId;
              final synced = mergeDriverServiceDetailForDisplay(
                apiDetail: detail,
                bookingId: bookingId,
                loadedBookingId: controller.serviceDetailBookingId.value,
              );
              final err = controller.serviceDetailError.value.trim();

              if (loading && detail?.id != bookingId && err.isEmpty) {
                return const Padding(
                  padding: EdgeInsets.symmetric(vertical: 48),
                  child: Center(child: CircularProgressIndicator()),
                );
              }

              final customer = synced?.customerDetail;
              final customerName =
                  (customer?.name ?? controller.activeDriverCustomerName.value)
                      .trim();
              final customerAvatar =
                  (customer?.profilePicture ??
                          controller.activeDriverCustomerAvatarUrl.value)
                      .trim();
              final bookingCode = _coalesce([
                synced?.bookingCode,
                synced?.id?.toString(),
                '$bookingId',
              ]);
              final trackingNorm = BookingTrackingStatus.normalizeTrackingCode(
                synced?.trackingStatus,
              );
              final trackingLabel = trackingNorm.isNotEmpty
                  ? BookingTrackingStatus.customerMessageFor(trackingNorm)
                  : null;
              final timeOfService = formatProviderTimeOfServiceLabel(
                scheduleType: synced?.scheduleType,
                scheduledAtIso: bookingScheduledAtIso(
                  scheduledAt: synced?.scheduledAt,
                  serviceDatetime: synced?.serviceDatetime,
                ),
              );
              final estimatedDuration = driverActiveServiceDurationCompact(synced);
              final earningsLabel = resolveDriverServiceProviderEarningsLabel(
                detail: synced,
              );
              final pickupAddress = _coalesce([
                synced?.pickupLocation?.address,
                synced?.address,
              ]);
              final dropoffAddress = _coalesce([
                synced?.dropoffLocation?.address,
                synced?.pickupLocation?.address,
                synced?.address,
              ]);
              final serviceNotesCard = BookingServiceNotesCard.fromDetail(
                synced,
                boxShadow: _driverActiveBookingCardShadow,
              );
              final vehicle = synced?.vehicle;
              final vehicleName = _vehicleDisplayName(vehicle);
              final licensePlate = (vehicle?.licensePlate ?? '').trim();
              final make = (vehicle?.make ?? '').trim();
              final model = (vehicle?.model ?? '').trim();
              final year = vehicle?.year?.toString().trim() ?? '';
              final color = (vehicle?.color ?? '').trim();
              final addons = synced?.addons ?? const [];

              return SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(18, 0, 18, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (loading)
                      const Padding(
                        padding: EdgeInsets.only(bottom: 12),
                        child: LinearProgressIndicator(minHeight: 2),
                      ),
                    _customerHeaderCard(
                      name: customerName.isNotEmpty ? customerName : 'Customer',
                      avatarUrl: customerAvatar,
                      bookingCode: bookingCode,
                      statusLabel: _formatStatus(synced?.status?.toString()),
                      trackingLabel: trackingLabel,
                    ),
                    const SizedBox(height: 12),
                    DriverServiceDetailsCard(
                      detail: synced,
                      timeOfService: timeOfService,
                      providerEarnings: earningsLabel,
                      estimatedDuration: estimatedDuration,
                      boxShadow: _driverActiveBookingCardShadow,
                    ),
                    if (vehicle != null) ...[
                      const SizedBox(height: 12),
                      _infoCard(
                        title: 'Vehicle',
                        rows: [
                          if (vehicleName.isNotEmpty)
                            _InfoRow('Vehicle', vehicleName),
                          if (licensePlate.isNotEmpty)
                            _InfoRow('License plate', licensePlate),
                          if (make.isNotEmpty) _InfoRow('Make', make),
                          if (model.isNotEmpty) _InfoRow('Model', model),
                          if (year.isNotEmpty) _InfoRow('Year', year),
                          if (color.isNotEmpty) _InfoRow('Color', color),
                        ],
                      ),
                    ],
                    const SizedBox(height: 12),
                    BookingRoutePlanCard(
                      detail: synced,
                      pickupAddress: pickupAddress,
                      dropoffAddress: dropoffAddress,
                      trackingNorm: trackingNorm,
                      cardShadow: _driverActiveBookingCardShadow,
                    ),
                    if (serviceNotesCard.hasContent) ...[
                      const SizedBox(height: 12),
                      serviceNotesCard,
                    ],
                    if (synced?.serviceImages?.hasAny == true) ...[
                      const SizedBox(height: 12),
                      BookingServiceImagesCard(
                        serviceImages: synced!.serviceImages!,
                        title: 'Vehicle Photos',
                        customerSectionTitle: 'Uploaded during booking',
                        boxShadow: _driverActiveBookingCardShadow,
                      ),
                    ],
                    if (addons.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      _infoCard(
                        title: 'Add-ons',
                        rows: [
                          for (final addon in addons)
                            _InfoRow(
                              _addonLabel(addon),
                              _addonPrice(addon),
                            ),
                        ],
                      ),
                    ],
                    if (err.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      CommonText.regular(
                        err,
                        size: 12,
                        color: Colors.red.shade400,
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ],
                ),
              );
            }),
          ),
        ],
      ),
    );
  }

  Widget _customerHeaderCard({
    required String name,
    required String avatarUrl,
    required String bookingCode,
    required String statusLabel,
    String? trackingLabel,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: _driverActiveBookingCardShadow,
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 26,
            backgroundColor: const Color(0xffD9D9D9),
            child: ClipOval(
              child: avatarUrl.isEmpty
                  ? const Icon(Icons.person_rounded, color: Colors.white)
                  : ImageFromNetwork(
                      avatarUrl,
                      width: 52,
                      height: 52,
                      fit: BoxFit.cover,
                      placeholderWidget: const Icon(
                        Icons.person_rounded,
                        color: Colors.white,
                      ),
                    ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CommonText.semiBold(name, size: 17, maxLines: 1),
                const SizedBox(height: 4),
                CommonText.regular(
                  'Booking $bookingCode',
                  size: 13,
                  color: _labelGrey,
                ),
                if (statusLabel.isNotEmpty && statusLabel != '—') ...[
                  const SizedBox(height: 2),
                  CommonText.medium(statusLabel, size: 12, color: _danger),
                ],
                if (trackingLabel != null && trackingLabel.trim().isNotEmpty) ...[
                  const SizedBox(height: 2),
                  CommonText.regular(
                    trackingLabel.trim(),
                    size: 12,
                    color: _labelGrey,
                    maxLines: 2,
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoCard({
    required String title,
    required List<_InfoRow> rows,
  }) {
    final visible = rows.where((r) => r.value.trim().isNotEmpty).toList();
    if (visible.isEmpty) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: _driverActiveBookingCardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CommonText.semiBold(title, size: 17, color: const Color(0xff1C1C1E)),
          const SizedBox(height: 12),
          for (var i = 0; i < visible.length; i++) ...[
            if (i > 0) const SizedBox(height: 10),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 5,
                  child: CommonText.medium(
                    visible[i].label,
                    size: 13,
                    color: _labelGrey,
                  ),
                ),
                Expanded(
                  flex: 6,
                  child: CommonText.semiBold(
                    visible[i].value,
                    size: 13,
                    textAlign: TextAlign.right,
                    maxLines: 4,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  String _vehicleDisplayName(Vehicle? vehicle) {
    if (vehicle == null) return '';
    final nickname = (vehicle.nickname ?? '').trim();
    if (nickname.isNotEmpty) return nickname;
    final make = (vehicle.make ?? '').trim();
    final model = (vehicle.model ?? '').trim();
    final year = vehicle.year?.toString().trim() ?? '';
    final parts = <String>[
      if (year.isNotEmpty) year,
      if (make.isNotEmpty) make,
      if (model.isNotEmpty) model,
    ];
    return parts.join(' ');
  }

  String _coalesce(List<dynamic> values, [String fallback = '—']) {
    for (final v in values) {
      final s = '${v ?? ''}'.trim();
      if (s.isNotEmpty) return s;
    }
    return fallback;
  }

  String _formatStatus(String? raw) {
    final s = (raw ?? '').trim();
    if (s.isEmpty) return '—';
    return s
        .replaceAll('_', ' ')
        .split(' ')
        .map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}')
        .join(' ');
  }

  String _addonLabel(dynamic addon) {
    final map = _addonMap(addon);
    return _coalesce([
      map['name'],
      map['title'],
      map['label'],
    ], 'Add-on');
  }

  String _addonPrice(dynamic addon) {
    final map = _addonMap(addon);
    return _coalesce([
      map['price_display'],
      map['priceDisplay'],
      map['amount_display'],
      map['price'] != null ? '\$${map['price']}' : null,
    ]);
  }

  Map<String, dynamic> _addonMap(dynamic addon) {
    if (addon is Dynamic) return addon.toJson();
    if (addon is Map) {
      return addon.map((k, v) => MapEntry('$k', v));
    }
    return const {};
  }
}

class _InfoRow {
  const _InfoRow(this.label, this.value);

  final String label;
  final String value;
}
