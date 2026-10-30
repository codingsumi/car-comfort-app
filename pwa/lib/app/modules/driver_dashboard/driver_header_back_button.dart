import 'package:flutter/material.dart';

import '../../gen/assets.gen.dart';
import '../../utils/web_navigation.dart';

class DriverHeaderBackButton extends StatelessWidget {
  const DriverHeaderBackButton({
    super.key,
    this.onTap,
    this.outlined = true,
    this.iconColor,
  });

  final VoidCallback? onTap;
  final bool outlined;
  final Color? iconColor;

  @override
  Widget build(BuildContext context) {
    final child = Assets.imagesBack.image(
      width: 24,
      height: 24,
      fit: BoxFit.contain,
      color: iconColor,
    );

    return InkWell(
      onTap: onTap ?? goBackToHome,
      child: Container(child: child),
    );
  }
}
