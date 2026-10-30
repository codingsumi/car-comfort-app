import 'package:flutter/material.dart';

import 'text.dart';

/// Explains cancellation fees; place directly above Cancel / Submit (cancel) actions.
class CancellationPolicyHint extends StatelessWidget {
  const CancellationPolicyHint({
    super.key,
    this.showTitle = true,
    this.dense = false,
  });

  final bool showTitle;
  final bool dense;

  static const List<String> _lines = <String>[
    'Scheduled bookings: \$25 cancellation fee if you cancel within 2 hours of the service time',
    r'$25 no-show fee if you do not show up, cancel while the provider is about 15 minutes from pickup, or cancel while the provider is waiting at pickup',
    'No refund if service has started',
  ];

  @override
  Widget build(BuildContext context) {
    final gap = dense ? 4.0 : 6.0;
    final linesColumn = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < _lines.length; i++) ...[
          CommonText.regular(
            '• ${_lines[i]}',
            size: dense ? 11 : 12,
            color: const Color(0xff3A3A3A),
          ),
          if (i < _lines.length - 1) SizedBox(height: gap),
        ],
      ],
    );

    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(
        dense ? 10 : 12,
        dense ? 10 : 12,
        dense ? 10 : 12,
        dense ? 8 : 10,
      ),
      decoration: BoxDecoration(
        color: const Color(0xffF2F2F7),
        borderRadius: BorderRadius.circular(12),
      ),
      child: showTitle
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CommonText.semiBold(
                  'Cancellation policy',
                  size: dense ? 12 : 13,
                  color: Colors.black87,
                ),
                SizedBox(height: dense ? 6 : 8),
                linesColumn,
              ],
            )
          : linesColumn,
    );
  }
}
