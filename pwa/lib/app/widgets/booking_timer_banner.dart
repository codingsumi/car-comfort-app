import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../utils/booking_timer_utils.dart';
import 'text.dart';

/// Countdown banner for on-demand accept / arrival-wait timers.
class BookingTimerBanner extends StatelessWidget {
  const BookingTimerBanner({
    super.key,
    required this.phase,
    required this.remainingSeconds,
    this.trailing,
  });

  final String phase;
  final int remainingSeconds;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final title = bookingTimerPhaseTitle(phase);
    final subtitle = bookingTimerPhaseSubtitle(phase, remainingSeconds);
    final showChip = normalizeBookingTimerPhase(phase) != 'accept_timeout';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xffFFF4F4),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: const Color(0xffE70B1C).withValues(alpha: 0.35),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CommonText.medium(
                  title,
                  size: 14,
                  color: const Color(0xff1C1C1E),
                ),
                const SizedBox(height: 4),
                CommonText.regular(
                  subtitle,
                  size: 12,
                  color: const Color(0xff5E5E5E),
                ),
              ],
            ),
          ),
          if (showChip) ...[
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xffE70B1C),
                borderRadius: BorderRadius.circular(20),
              ),
              child: CommonText.bold(
                formatBookingTimerCountdown(remainingSeconds),
                size: 16,
                color: Colors.white,
              ),
            ),
          ],
          if (trailing != null) ...[const SizedBox(width: 8), trailing!],
        ],
      ),
    );
  }
}

/// Reactive wrapper — pass [remainingSeconds] from an `Obx` that reads [tick].
class ObxBookingTimerBanner extends StatelessWidget {
  const ObxBookingTimerBanner({
    super.key,
    required this.phase,
    required this.remainingSeconds,
    required this.tick,
    this.trailing,
  });

  final String phase;
  final int Function() remainingSeconds;
  final RxInt tick;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      tick.value;
      return BookingTimerBanner(
        phase: phase,
        remainingSeconds: remainingSeconds(),
        trailing: trailing,
      );
    });
  }
}
