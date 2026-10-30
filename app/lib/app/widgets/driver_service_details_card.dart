import 'package:flutter/material.dart';

import '../network/response/booking_detail_response.dart';
import '../utils/driver_service_details_display.dart';
import 'text.dart';

/// Provider-facing service details block (package menu #, EV battery, earnings).
class DriverServiceDetailsCard extends StatelessWidget {
  const DriverServiceDetailsCard({
    super.key,
    required this.detail,
    required this.timeOfService,
    required this.providerEarnings,
    required this.estimatedDuration,
    this.boxShadow = const [],
  });

  final BookingDetailData? detail;
  final String timeOfService;
  final String providerEarnings;
  final String estimatedDuration;
  final List<BoxShadow> boxShadow;

  @override
  Widget build(BuildContext context) {
    final lines = buildDriverActiveServiceDetailLines(
      detail: detail,
      timeOfService: timeOfService,
      providerEarnings: providerEarnings,
      estimatedDuration: estimatedDuration,
    );

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
          const CommonText.semiBold(
            'Service details',
            size: 17,
            color: Color(0xff1C1C1E),
          ),
          const SizedBox(height: 16),
          for (var i = 0; i < lines.length; i++) ...[
            if (i > 0) const SizedBox(height: 12),
            _DriverServiceDetailLineWidget(line: lines[i]),
          ],
        ],
      ),
    );
  }
}

class _DriverServiceDetailLineWidget extends StatelessWidget {
  const _DriverServiceDetailLineWidget({required this.line});

  final DriverServiceDetailLine line;

  @override
  Widget build(BuildContext context) {
    if (line.isStandalone) {
      return CommonText.regular(
        line.standaloneText!,
        size: 14,
        color: const Color(0xff1C1C1E),
      );
    }

    return Text.rich(
      TextSpan(
        style: const TextStyle(
          fontSize: 14,
          color: Color(0xff1C1C1E),
          height: 1.4,
        ),
        children: [
          TextSpan(
            text: '${line.label} – ',
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          TextSpan(text: line.value),
        ],
      ),
    );
  }
}
