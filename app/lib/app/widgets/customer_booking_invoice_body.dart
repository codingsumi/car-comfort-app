import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../constants/booking_tracking_status.dart';
import '../constants/service_provider_labels.dart';
import '../modules/dashboard/dashboard_controller.dart';
import '../network/response/booking_detail_response.dart';
import '../utils/booking_timer_utils.dart';
import '../utils/booking_travel_distance.dart';
import '../utils/service_type_label.dart' show bookingServiceTypeDisplay;
import 'booking_price_summary_card.dart';
import 'booking_route_plan_card.dart';
import 'booking_service_images_card.dart';
import 'booking_service_notes_card.dart';
import 'customer_service_details_card.dart';
import 'image.dart';
import 'tappable_profile_avatar.dart';
import 'text.dart';
import 'vehicle_details_card.dart';

/// Rich invoice / completed-service layout shared by billing detail and post-service inspection.
class CustomerBookingInvoiceBody extends StatelessWidget {
  const CustomerBookingInvoiceBody({
    super.key,
    required this.detail,
    this.dashboard,
    this.loading = false,
    this.distanceFallback = '—',
    this.paymentAmountLabel,
    this.paymentDateLabel,
    this.paymentStatusLabel,
    this.showProviderHeader = false,
    this.showPaymentBanner = false,
    this.boxShadow = _cardShadow,
  });

  final BookingDetailData? detail;
  final DashboardController? dashboard;
  final bool loading;
  final String distanceFallback;
  final String? paymentAmountLabel;
  final String? paymentDateLabel;
  final String? paymentStatusLabel;
  /// When true, shows a combined customer + service provider participants card.
  final bool showProviderHeader;
  final bool showPaymentBanner;
  final List<BoxShadow> boxShadow;

  static const Color _danger = Color(0xffE70B1C);
  static const Color _labelGrey = Color(0xff8E8E93);
  static const Color _darkCard = Color(0xff2C2C2E);
  static const List<BoxShadow> _cardShadow = [
    BoxShadow(color: Color(0x12000000), blurRadius: 14, offset: Offset(0, 4)),
    BoxShadow(color: Color(0x08000000), blurRadius: 4, offset: Offset(0, 1)),
  ];

  @override
  Widget build(BuildContext context) {
    final d = detail;
    final bookingCode = _coalesceText([d?.bookingCode, d?.id?.toString()]);
    final totalPrice = _coalesceText([
      d?.totalPriceDisplay,
      d?.totalPrice != null ? '\$${d!.totalPrice!.toStringAsFixed(2)}' : null,
      d?.priceSummary?.total != null && (d!.priceSummary!.total ?? 0) > 0
          ? '\$${d.priceSummary!.total!.toStringAsFixed(2)}'
          : null,
    ]);
    final serviceType = bookingServiceTypeDisplay(
      _coalesceText([d?.serviceTypeLabel, d?.serviceType], 'Service'),
    );
    final statusLower = (d?.status ?? '').trim().toLowerCase();
    final bookingStatusLabel = _formatBookingStatusLabel(d?.status ?? '');
    final trackingNorm = BookingTrackingStatus.normalizeTrackingCode(
      d?.trackingStatus,
    );
    final trackingLabel = trackingNorm.isNotEmpty
        ? BookingTrackingStatus.customerMessageFor(trackingNorm)
        : null;
    final pickupAddress = _coalesceText([
      d?.pickupLocation?.address,
      d?.address,
    ]);
    final dropoffAddress = _coalesceText([
      d?.dropoffLocation?.address,
      d?.pickupLocation?.address,
      d?.address,
    ]);
    final serviceNotesCard = BookingServiceNotesCard.fromDetail(
      d,
      boxShadow: boxShadow,
    );
    final showScheduled = d != null && !isOnDemandScheduleType(d.scheduleType);
    final scheduledLabel = formatBookingScheduleLine(
      bookingScheduledAtIso(
        scheduledAt: d?.scheduledAt,
        serviceDatetime: d?.serviceDatetime,
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (loading)
          const Padding(
            padding: EdgeInsets.only(bottom: 12),
            child: LinearProgressIndicator(minHeight: 2),
          ),
        if (showPaymentBanner &&
            (paymentAmountLabel?.isNotEmpty ?? false)) ...[
          _paymentBanner(
            amount: paymentAmountLabel!,
            dateLabel: paymentDateLabel,
            statusLabel: paymentStatusLabel,
          ),
          const SizedBox(height: 14),
        ],
        _invoiceHeroCard(
          bookingId: bookingCode,
          totalPrice: totalPrice,
          serviceType: serviceType.isEmpty ? 'Service' : serviceType,
          bookingStatusLabel: bookingStatusLabel,
          statusLower: statusLower,
          trackingLabel: trackingLabel,
        ),
        const SizedBox(height: 14),
        if (showProviderHeader) ...[
          _participantsCard(d),
          const SizedBox(height: 14),
        ],
        CustomerServiceDetailsCard(detail: d, boxShadow: boxShadow),
        if (d?.vehicle != null) ...[
          const SizedBox(height: 14),
          CustomerVehicleDetailsCard(detail: d, boxShadow: boxShadow),
        ],
        const SizedBox(height: 14),
        _radiusCard(d, fallback: distanceFallback),
        if (showScheduled) ...[
          const SizedBox(height: 14),
          _scheduledDateTimeCard(scheduledLabel),
        ],
        const SizedBox(height: 14),
        BookingRoutePlanCard(
          detail: d,
          pickupAddress: pickupAddress,
          dropoffAddress: dropoffAddress,
          trackingNorm: trackingNorm,
          cardShadow: boxShadow,
        ),
        if (serviceNotesCard.hasContent) ...[
          const SizedBox(height: 14),
          serviceNotesCard,
        ],
        if (d?.serviceImages?.hasAny == true) ...[
          const SizedBox(height: 14),
          BookingServiceImagesCard(
            serviceImages: d!.serviceImages!,
            title: 'Service photos',
            beforeSectionTitle: 'Before service',
            afterSectionTitle: 'After service',
            customerSectionTitle: 'Customer photos',
            boxShadow: boxShadow,
          ),
        ],
        if (d?.priceSummary != null &&
            (d!.priceSummary!.applicableCharges?.isNotEmpty == true ||
                (d.priceSummary!.total ?? 0) > 0)) ...[
          const SizedBox(height: 14),
          BookingPriceSummaryCard(
            priceSummary: d.priceSummary!,
            totalLabel: 'Total',
          ),
        ],
      ],
    );
  }

  Widget _paymentBanner({
    required String amount,
    String? dateLabel,
    String? statusLabel,
  }) {
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
      decoration: BoxDecoration(
        color: const Color(0xffF0FAF2),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xffC8E6C9)),
        boxShadow: boxShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const CommonText.semiBold(
            'Payment',
            size: 16,
            color: Color(0xff1C1C1E),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: CommonText.semiBold(
                  amount,
                  size: 20,
                  color: const Color(0xff1B5E20),
                ),
              ),
              if (statusLabel != null && statusLabel.trim().isNotEmpty)
                CommonText.medium(
                  statusLabel.trim(),
                  size: 13,
                  color: const Color(0xff2E7D32),
                ),
            ],
          ),
          if (dateLabel != null && dateLabel.trim().isNotEmpty) ...[
            const SizedBox(height: 6),
            CommonText.regular(
              dateLabel.trim(),
              size: 13,
              color: _labelGrey,
            ),
          ],
        ],
      ),
    );
  }

  /// Combined participant card showing customer and service provider side by side.
  Widget _participantsCard(BookingDetailData? d) {
    final providerName = (d?.driverDetail?.name ?? '').trim();
    final providerAvatar = (d?.driverDetail?.profilePicture ?? '').trim();
    final customerName = (d?.customerDetail?.name ?? '').trim();
    final customerAvatar = (d?.customerDetail?.profilePicture ?? '').trim();
    final customerPhone = (d?.customerDetail?.phone ?? '').trim();

    final hasProvider = providerName.isNotEmpty || providerAvatar.isNotEmpty;

    return Container(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: boxShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Section title
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: const Color(0xffF2F2F7),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.people_outline_rounded,
                  size: 18,
                  color: Color(0xff636366),
                ),
              ),
              const SizedBox(width: 10),
              const CommonText.semiBold(
                'Booking participants',
                size: 17,
                color: Color(0xff1C1C1E),
              ),
            ],
          ),
          const SizedBox(height: 18),
          // Customer row
          _participantRow(
            label: 'CUSTOMER',
            name: customerName.isEmpty ? 'You' : customerName,
            avatarUrl: customerAvatar,
            secondaryLabel: customerPhone.isNotEmpty ? customerPhone : null,
          ),
          if (hasProvider) ...[  
            const SizedBox(height: 14),
            const Divider(height: 1, color: Color(0xffECECEC)),
            const SizedBox(height: 14),
            _participantRow(
              label: 'SERVICE PROVIDER',
              name: providerName.isEmpty
                  ? ServiceProviderLabels.fallbackName
                  : providerName,
              avatarUrl: providerAvatar,
              secondaryLabel: 'Your assigned technician',
              avatarTappable: true,
            ),
          ],
        ],
      ),
    );
  }

  Widget _participantRow({
    required String label,
    required String name,
    required String avatarUrl,
    String? secondaryLabel,
    bool avatarTappable = false,
  }) {
    return Row(
      children: [
        avatarTappable
            ? TappableProfileAvatar(
                imageUrl: avatarUrl,
                size: 60,
                previewProviderName: name,
              )
            : _personAvatar(avatarUrl),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CommonText.regular(
                label,
                size: 11,
                letterSpacing: 0.9,
                color: _labelGrey,
              ),
              const SizedBox(height: 4),
              CommonText.semiBold(
                name,
                size: 15,
                color: const Color(0xff1C1C1E),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              if (secondaryLabel != null && secondaryLabel.isNotEmpty) ...[  
                const SizedBox(height: 2),
                CommonText.regular(
                  secondaryLabel,
                  size: 13,
                  color: _labelGrey,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _personAvatar(String imageUrl) {
    const bg = Color(0xffE8E8EF);
    if (imageUrl.isNotEmpty) {
      return ClipOval(
        child: CachedNetworkImage(
          imageUrl: imageUrl,
          width: 60,
          height: 60,
          fit: BoxFit.cover,
          placeholder: (_, _) =>
              const IcUserAvatarPlaceholder(size: 60, backgroundColor: bg),
          errorWidget: (_, _, _) =>
              const IcUserAvatarPlaceholder(size: 60, backgroundColor: bg),
        ),
      );
    }
    return const ClipOval(
      child: IcUserAvatarPlaceholder(size: 60, backgroundColor: bg),
    );
  }

  Widget _invoiceHeroCard({
    required String bookingId,
    required String totalPrice,
    required String serviceType,
    required String bookingStatusLabel,
    required String statusLower,
    String? trackingLabel,
  }) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: boxShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Center(
            child: CommonText.semiBold(
              'Service invoice',
              size: 17,
              color: Color(0xff1C1C1E),
            ),
          ),
          const SizedBox(height: 18),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _metaBlock(
                  label: 'BOOKING ID',
                  value: _formatBookingId(bookingId),
                  alignEnd: false,
                  valueRed: false,
                ),
              ),
              Expanded(
                child: _metaBlock(
                  label: 'TOTAL',
                  value: totalPrice,
                  alignEnd: true,
                  valueRed: true,
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          const Divider(height: 1, color: Color(0xffECECEC)),
          const SizedBox(height: 16),
          _metaBlock(
            label: 'BOOKING STATUS',
            value: bookingStatusLabel,
            alignEnd: false,
            valueRed: false,
            valueColor: _bookingStatusColor(statusLower),
          ),
          if (trackingLabel != null && trackingLabel.trim().isNotEmpty) ...[
            const SizedBox(height: 16),
            _metaBlock(
              label: 'SERVICE STATUS',
              value: trackingLabel.trim(),
              alignEnd: false,
              valueRed: false,
              valueColor: _bookingStatusColor(statusLower),
            ),
          ],
          const SizedBox(height: 16),
          _metaBlock(
            label: 'SERVICE TYPE',
            value: serviceType,
            alignEnd: false,
            valueRed: false,
          ),
        ],
      ),
    );
  }

  Widget _metaBlock({
    required String label,
    required String value,
    required bool alignEnd,
    required bool valueRed,
    Color? valueColor,
  }) {
    return Column(
      crossAxisAlignment:
          alignEnd ? CrossAxisAlignment.end : CrossAxisAlignment.start,
      children: [
        CommonText.regular(
          label,
          size: 12,
          letterSpacing: 0.9,
          color: _labelGrey,
          textAlign: alignEnd ? TextAlign.right : TextAlign.left,
        ),
        const SizedBox(height: 4),
        CommonText.semiBold(
          value,
          size: 14,
          color: valueColor ?? (valueRed ? _danger : const Color(0xff1C1C1E)),
          textAlign: alignEnd ? TextAlign.right : TextAlign.left,
        ),
      ],
    );
  }

  Widget _scheduledDateTimeCard(String label) {
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: boxShadow,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: const Color(0xffF2F2F7),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(
              Icons.calendar_today_outlined,
              size: 18,
              color: Color(0xff636366),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const CommonText.semiBold(
                  'Date & time',
                  size: 17,
                  color: Color(0xff1C1C1E),
                ),
                const SizedBox(height: 6),
                CommonText.regular(
                  label,
                  size: 14,
                  color: _labelGrey,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _radiusCard(BookingDetailData? d, {required String fallback}) {
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
      decoration: BoxDecoration(
        color: _darkCard,
        borderRadius: BorderRadius.circular(18),
        boxShadow: boxShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              border: Border.all(color: Colors.white38),
              borderRadius: BorderRadius.circular(6),
            ),
            child: const Icon(
              Icons.location_on_outlined,
              color: Colors.white70,
              size: 16,
            ),
          ),
          const SizedBox(height: 12),
          const CommonText.regular(
            'ESTIMATED RADIUS',
            size: 11,
            letterSpacing: 1.0,
            color: Colors.white70,
          ),
          const SizedBox(height: 6),
          BookingEstimatedRadiusText(detail: d, fallback: fallback),
        ],
      ),
    );
  }

  static Color _bookingStatusColor(String statusLower) {
    if (statusLower == 'cancelled' || statusLower == 'canceled') return _danger;
    if (statusLower == 'completed' || statusLower == 'vehicle_delivered') {
      return const Color(0xff1B5E20);
    }
    return const Color(0xff1C1C1E);
  }

  static String _formatBookingStatusLabel(String raw) {
    final normalized = raw.trim().replaceAll('_', ' ');
    if (normalized.isEmpty) return '—';
    return normalized
        .split(RegExp(r'\s+'))
        .where((w) => w.isNotEmpty)
        .map((w) => '${w[0].toUpperCase()}${w.substring(1).toLowerCase()}')
        .join(' ');
  }

  String _coalesceText(List<dynamic> candidates, [String fallback = '—']) {
    for (final c in candidates) {
      final s = '${c ?? ''}'.trim();
      if (s.isNotEmpty) return s;
    }
    return fallback;
  }

  String _formatBookingId(String code) {
    final t = code.trim();
    if (t.isEmpty || t == '—') return '—';
    if (t.startsWith('#')) return t;
    return '#$t';
  }
}
