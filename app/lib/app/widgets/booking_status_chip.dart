import 'package:flutter/material.dart';

/// Compact color-coded status pill used on booking cards for both customer and
/// service-provider roles.  Keeps badge style, colors, typography, spacing and
/// alignment consistent across the whole app.
class BookingStatusChip extends StatelessWidget {
  const BookingStatusChip({
    required this.rawStatus,
    required this.label,
    super.key,
  });

  /// Raw lifecycle status string from the API (e.g. 'cancelled', 'completed').
  final String rawStatus;

  /// Human-readable label; falls back to a title-cased [rawStatus] when empty.
  final String label;

  // ── Palette ──────────────────────────────────────────────────────────────
  static const _completed = Color(0xff2E7D32);
  static const _cancelled = Color(0xffC62828);
  static const _pending   = Color(0xffE65100);
  static const _active    = Color(0xff0277BD);
  static const _draft     = Color(0xffF57F17);
  static const _fallback  = Color(0xff546E7A);

  @override
  Widget build(BuildContext context) {
    final s = rawStatus.trim().toLowerCase();

    final Color bg;
    final IconData icon;

    if (s == 'completed' || s == 'vehicle_delivered') {
      bg   = _completed;
      icon = Icons.check_circle_outline_rounded;
    } else if (s == 'cancelled' || s == 'canceled') {
      bg   = _cancelled;
      icon = Icons.cancel_outlined;
    } else if (s == 'pending' || s.isEmpty) {
      bg   = _pending;
      icon = Icons.schedule_rounded;
    } else if (s == 'assigned' || s == 'in_progress' || s == 'en_route') {
      bg   = _active;
      icon = Icons.directions_car_outlined;
    } else if (s == 'draft') {
      bg   = _draft;
      icon = Icons.edit_note_rounded;
    } else {
      bg   = _fallback;
      icon = Icons.info_outline_rounded;
    }

    final displayLabel = label.trim().isEmpty ? _titleize(s) : label.trim();

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: Colors.white),
          const SizedBox(width: 4),
          Text(
            displayLabel,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 10,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }

  static String _titleize(String raw) {
    if (raw.isEmpty) return 'Pending';
    return raw
        .replaceAll('_', ' ')
        .split(' ')
        .where((w) => w.isNotEmpty)
        .map((w) => '${w[0].toUpperCase()}${w.substring(1).toLowerCase()}')
        .join(' ');
  }
}
