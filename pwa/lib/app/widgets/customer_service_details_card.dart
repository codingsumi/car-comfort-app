import 'package:flutter/material.dart';

import '../network/response/booking_detail_response.dart';
import '../utils/customer_service_details_display.dart';
import 'text.dart';

/// Customer-facing service + vehicle breakdown (mirrors provider service details card).
class CustomerServiceDetailsCard extends StatelessWidget {
  const CustomerServiceDetailsCard({
    super.key,
    required this.detail,
    this.boxShadow = const [],
  });

  final BookingDetailData? detail;
  final List<BoxShadow> boxShadow;

  @override
  Widget build(BuildContext context) {
    final lines = buildCustomerServiceDetailLines(detail: detail);

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
            _CustomerServiceDetailLineWidget(line: lines[i]),
          ],
        ],
      ),
    );
  }
}

class _CustomerServiceDetailLineWidget extends StatelessWidget {
  const _CustomerServiceDetailLineWidget({required this.line});

  final CustomerServiceDetailLine line;

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
