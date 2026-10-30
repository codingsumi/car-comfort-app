import 'package:flutter/material.dart';
import 'package:get/get_utils/get_utils.dart';

import '../models/bottom_bar_model.dart';
import '../utils/extensions/extension.dart';
import 'image.dart';

class NavBar extends StatelessWidget {
  const NavBar({
    super.key,
    required this.items,
    this.currentIndex = 0,
    this.onTap,
    this.selectedItemColor,
    this.unselectedItemColor,
    this.margin = const EdgeInsets.all(8),
    this.itemPadding = const EdgeInsets.symmetric(vertical: 10, horizontal: 10),
    this.duration = const Duration(milliseconds: 500),
    this.curve = Curves.easeOutQuint,
    this.indicatorColor,
    this.borderRadius = 30,
    this.splashBorderRadius,
    this.backgroundColor = Colors.white,
    this.splashColor,
  });

  final List<NavBarItem> items;
  final int currentIndex;
  final Function(int)? onTap;
  final Color? selectedItemColor;
  final Color? unselectedItemColor;
  final EdgeInsets margin;
  final EdgeInsets itemPadding;
  final Duration duration;
  final Curve curve;
  final Color? indicatorColor;
  final double? borderRadius;
  final Color? backgroundColor;
  final Color? splashColor;
  final double? splashBorderRadius;

  @override
  Widget build(BuildContext context) {
    final selectedColor = selectedItemColor ?? context.colorScheme.onPrimary;
    final unselectedColor = unselectedItemColor ?? context.colorScheme.outline;

    return Container(
      color: backgroundColor,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: List.generate(
          items.length,
          (index) {
            final item = items[index];
            final isSelected = index == currentIndex;

            return TweenAnimationBuilder<double>(
              tween: Tween(
                begin: isSelected ? 0.0 : 1.0,
                end: isSelected ? 1.0 : 0.0,
              ),
              curve: curve,
              duration: duration,
              builder: (context, t, _) {
                return Material(
                  color: Colors.transparent,
                  borderRadius: BorderRadius.circular(splashBorderRadius ?? 8),
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: () => onTap?.call(index),
                    focusColor: splashColor ?? selectedColor.withValues(alpha: 0.1),
                    highlightColor: splashColor ?? selectedColor.withValues(alpha: 0.1),
                    splashColor: splashColor ?? selectedColor.withValues(alpha: 0.1),
                    hoverColor: splashColor ?? selectedColor.withValues(alpha: 0.1),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SizedBox(
                          width: 24,
                          height: 24,
                          child: SquareSvgImageFromAsset(
                            color: Color.lerp(unselectedColor, selectedColor, t),
                            isSelected ? item.activeIcon : item.icon,
                            size: 24,
                          ),
                        ).marginAll(10),
                        // Animated bottom indicator
                        ClipRect(
                          child: Align(
                            alignment: Alignment.bottomCenter,
                            widthFactor: t,
                            child: Container(
                              height: 4,
                              width: 16,
                              decoration: BoxDecoration(
                                color: indicatorColor ?? selectedColor,
                                borderRadius: BorderRadius.circular(10),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            );
          },
        ),
      ).marginOnly(
        left: 24,
        right: 24,
        top: 16,
        bottom: context.mediaQueryViewPadding.bottom + 8,
      ),
    );
  }
}
