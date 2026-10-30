import 'package:flutter/material.dart';

import '../constants/booking_tracking_status.dart';
import '../network/response/booking_detail_response.dart';
import '../utils/booking_route_plan.dart';
import 'text.dart';

/// Route Plan timeline for customer and driver service detail screens.
class BookingRoutePlanCard extends StatelessWidget {
  const BookingRoutePlanCard({
    super.key,
    required this.detail,
    required this.pickupAddress,
    required this.dropoffAddress,
    required this.trackingNorm,
    this.cardShadow = _defaultShadow,
  });

  final BookingDetailData? detail;
  final String pickupAddress;
  final String dropoffAddress;
  final String trackingNorm;
  final List<BoxShadow> cardShadow;

  static const Color _labelGrey = Color(0xff8E8E93);
  static const Color _brandRed = Color(0xffC4101F);
  static const List<BoxShadow> _defaultShadow = [
    BoxShadow(color: Color(0x12000000), blurRadius: 14, offset: Offset(0, 4)),
    BoxShadow(color: Color(0x08000000), blurRadius: 4, offset: Offset(0, 1)),
  ];

  @override
  Widget build(BuildContext context) {
    final planStops = buildBookingRoutePlanStops(
      detail: detail,
      pickupAddress: pickupAddress,
      dropoffAddress: dropoffAddress,
    );
    if (planStops.isEmpty) return const SizedBox.shrink();

    final dropLabel = BookingTrackingStatus.routePlanDropoffLabel(trackingNorm);
    final legCount = planStops.length;

    return Container(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
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
                  Icons.route_rounded,
                  size: 18,
                  color: Color(0xff636366),
                ),
              ),
              const SizedBox(width: 10),
              const CommonText.semiBold(
                'Route Plan',
                size: 17,
                color: Color(0xff1C1C1E),
              ),
            ],
          ),
          const SizedBox(height: 18),
          ...List.generate(planStops.length, (index) {
            final stop = planStops[index];
            final isLast = index == planStops.length - 1;
            final label = stop.label == 'DROPOFF' ? dropLabel : stop.label;
            final style = BookingTrackingStatus.routeLegStyle(
              legIndex: index,
              legCount: legCount,
              trackingNorm: trackingNorm,
            );
            final colors = _palette(style);
            final lines = splitRouteAddressLines(stop.address);
            final placeName = (stop.placeName ?? '').trim();
            final title = placeName.isNotEmpty ? placeName : lines.$1;
            final subtitle = placeName.isNotEmpty
                ? stop.address.trim().isNotEmpty && stop.address.trim() != '—'
                    ? stop.address.trim()
                    : lines.$2
                : lines.$2;
            final spec = (stop.specification ?? '').trim();

            return _timelineRow(
              label: label,
              labelColor: colors.$1,
              dotColor: colors.$2,
              title: title,
              subtitle: subtitle,
              specification: spec.isEmpty ? null : spec,
              isLast: isLast,
            );
          }),
        ],
      ),
    );
  }

  (Color, Color) _palette(BookingRouteLegStyle style) {
    switch (style) {
      case BookingRouteLegStyle.active:
        return (_brandRed, _brandRed);
      case BookingRouteLegStyle.completed:
        return (const Color(0xff1B5E20), const Color(0xff34B620));
      case BookingRouteLegStyle.upcoming:
        return (_labelGrey, const Color(0xff6D6D70));
    }
  }

  Widget _timelineRow({
    required String label,
    required Color labelColor,
    required Color dotColor,
    required String title,
    required String? subtitle,
    required String? specification,
    required bool isLast,
  }) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 20,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: dotColor,
                    shape: BoxShape.circle,
                  ),
                ),
                if (!isLast)
                  Expanded(
                    child: Center(
                      child: Container(
                        width: 2,
                        color: const Color(0xffE5E5EA),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  CommonText.semiBold(
                    label,
                    size: 11,
                    letterSpacing: 0.6,
                    color: labelColor,
                  ),
                  const SizedBox(height: 4),
                  CommonText.semiBold(
                    title,
                    size: 15,
                    color: const Color(0xff1C1C1E),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (subtitle != null && subtitle.trim().isNotEmpty) ...[
                    const SizedBox(height: 2),
                    CommonText.regular(
                      subtitle.trim(),
                      size: 13,
                      color: _labelGrey,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  if (specification != null) ...[
                    const SizedBox(height: 4),
                    CommonText.regular(
                      specification,
                      size: 13,
                      color: const Color(0xff48484A),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
