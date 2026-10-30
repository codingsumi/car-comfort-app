import 'package:flutter/material.dart';

import 'package:car_comfort/app/gen/assets.gen.dart';
import 'package:car_comfort/app/utils/service_type_label.dart';

/// Map pin symbol for a job on the driver home map.
///
/// - [isAssigned] `false` (default): white card for nearby **unassigned** bookings the driver can
///   accept. Semi-transparent border, dark icon.
/// - [isAssigned] `true`: dark navy card for the driver's own **assigned / confirmed** bookings.
///   White icon + a small coloured status dot in the top-right corner.
class DriverJobMapSymbol extends StatelessWidget {
  const DriverJobMapSymbol({
    super.key,
    required this.serviceType,
    required this.durationLabel,
    this.iconSize = 20,
    this.minWidth = 34,
    this.isAssigned = false,
    this.onTap,
  });

  final String? serviceType;
  final String durationLabel;
  /// Service icon height/width — kept compact on the map.
  final double iconSize;
  /// Minimum badge width; grows horizontally so duration text is not clipped.
  final double minWidth;
  /// When true, renders as the provider's own assigned booking (dark card + white icon).
  final bool isAssigned;
  final VoidCallback? onTap;

  static const Color _assignedBg = Color(0xff1C2D3A);     // dark navy
  static const Color _assignedIconColor = Colors.white;
  static const Color _assignedTextColor = Colors.white;
  static const Color _assignedAccent = Color(0xff34C759);  // green dot

  static const Color _unassignedBg = Colors.white;
  static const Color _unassignedIconColor = Color(0xff1C1C1E);
  static const Color _unassignedTextColor = Color(0xff1C1C1E);

  @override
  Widget build(BuildContext context) {
    final comp = bookingServiceComposition(serviceType);
    final iconColor = isAssigned ? _assignedIconColor : _unassignedIconColor;
    final icon = _JobServiceIcon(
      composition: comp,
      size: iconSize,
      color: iconColor,
    );

    final card = Container(
      padding: const EdgeInsets.fromLTRB(6, 5, 6, 4),
      decoration: BoxDecoration(
        color: isAssigned ? _assignedBg : _unassignedBg,
        borderRadius: BorderRadius.circular(12),
        border: isAssigned
            ? Border.all(color: _assignedAccent, width: 1.5)
            : Border.all(color: const Color(0xffE8E8EF)),
        boxShadow: [
          BoxShadow(
            color: isAssigned
                ? const Color(0xff1C2D3A).withValues(alpha: 0.45)
                : const Color(0x33000000),
            blurRadius: isAssigned ? 10 : 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          SizedBox(
            height: iconSize,
            child: Center(child: icon),
          ),
          const SizedBox(height: 2),
          Text(
            durationLabel,
            maxLines: 1,
            softWrap: false,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: isAssigned ? _assignedTextColor : _unassignedTextColor,
              height: 1.1,
            ),
          ),
        ],
      ),
    );

    // For assigned pins add a small green status dot in the top-right corner.
    final badge = isAssigned
        ? Stack(
            clipBehavior: Clip.none,
            children: [
              card,
              Positioned(
                top: -3,
                right: -3,
                child: Container(
                  width: 9,
                  height: 9,
                  decoration: BoxDecoration(
                    color: _assignedAccent,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 1.5),
                  ),
                ),
              ),
            ],
          )
        : card;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: IntrinsicWidth(
          child: ConstrainedBox(
            constraints: BoxConstraints(minWidth: minWidth),
            child: badge,
          ),
        ),
      ),
    );
  }
}

class _JobServiceIcon extends StatelessWidget {
  const _JobServiceIcon({
    required this.composition,
    required this.size,
    this.color = const Color(0xff1C1C1E),
  });

  final BookingServiceComposition composition;
  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    if (composition.isCombined) {
      final iconSize = size * 0.88;
      return Row(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _evIcon(iconSize),
          const SizedBox(width: 2),
          _carWashIcon(iconSize),
        ],
      );
    }
    if (composition.hasEvCharging) {
      return _evIcon(size);
    }
    if (composition.hasCarWash) {
      return _carWashIcon(size);
    }
    return Icon(
      Icons.work_outline_rounded,
      size: size * 0.8,
      color: color,
    );
  }

  Widget _evIcon(double iconSize) {
    return _assetIcon(
      Assets.imagesIcEvPin.path,
      iconSize,
      fallback: Icons.ev_station_rounded,
    );
  }

  Widget _carWashIcon(double iconSize) {
    return _assetIcon(
      Assets.imagesIcServicePin.path,
      iconSize,
      fallback: Icons.local_car_wash_rounded,
    );
  }

  Widget _assetIcon(
    String path,
    double iconSize, {
    required IconData fallback,
  }) {
    return Image.asset(
      path,
      width: iconSize,
      height: iconSize,
      fit: BoxFit.contain,
      cacheWidth: (iconSize * 2).ceil(),
      cacheHeight: (iconSize * 2).ceil(),
      filterQuality: FilterQuality.high,
      colorBlendMode: BlendMode.srcIn,
      color: color == Colors.white ? Colors.white : null,
      errorBuilder: (_, __, ___) => Icon(
        fallback,
        size: iconSize * 0.85,
        color: color,
      ),
    );
  }
}
