import 'dart:ui';

import 'package:flutter/material.dart';

import '../gen/assets.gen.dart';
import '../utils/web_navigation.dart';
import 'text.dart';

/// Shared hero header: rounded bottom, blurred background image, dark scrim,
/// safe-area top padding, optional back + centered title + optional trailing.
class BlurredImageScreenHeader extends StatelessWidget {
  const BlurredImageScreenHeader({
    super.key,
    required this.title,
    this.titleWidget,
    this.showLeading = true,
    this.onBack,
    this.leading,
    this.trailing,
    this.backgroundAsset,
    this.bottomRadius = 20,
    this.horizontalPadding = 16,
    this.topPaddingExtra = 12,
    this.bottomPadding = 12,
    this.toolbarBottomGap = 12,
    this.blurSigma = 1.0,
    this.scrimAlpha = 0.5,
    this.titleColor = Colors.white,
    this.titleSize = 16,
    this.leadingWidth = 24,
    this.leadingHeight = 24,
    this.belowToolbar,
    this.backgroundFit = BoxFit.cover,
  });

  /// Toolbar title (e.g. screen name). Ignored for display when [titleWidget] is set.
  final String title;

  /// Optional center widget (e.g. reactive title + icons). When null, [title] is shown.
  final Widget? titleWidget;

  /// When true and [leading] is null, shows default back asset.
  final bool showLeading;

  /// Uses PWA-safe navigation when null.
  final VoidCallback? onBack;

  /// Replaces default back control when set.
  final Widget? leading;

  /// Right side (e.g. notifications).
  final Widget? trailing;

  /// Background photo; defaults to [Assets.imagesHomeHBg].
  final AssetGenImage? backgroundAsset;

  final double bottomRadius;
  final double horizontalPadding;
  final double topPaddingExtra;
  final double bottomPadding;
  final double toolbarBottomGap;
  final double blurSigma;
  final double scrimAlpha;
  final Color titleColor;
  final double titleSize;
  final double leadingWidth;
  final double leadingHeight;

  /// Extra content under the title row (inside the same padded column).
  final Widget? belowToolbar;

  /// How the background image is fitted (e.g. [BoxFit.fill] vs [BoxFit.cover]).
  final BoxFit backgroundFit;

  AssetGenImage get _bg => backgroundAsset ?? Assets.imagesHomeHBg;

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top + topPaddingExtra;

    return ClipRRect(
      borderRadius: BorderRadius.only(
        bottomLeft: Radius.circular(bottomRadius),
        bottomRight: Radius.circular(bottomRadius),
      ),
      child: Container(
        decoration: const BoxDecoration(color: Colors.black54),
        child: Stack(
          fit: StackFit.passthrough,
          children: [
            Positioned.fill(child: _bg.image(fit: backgroundFit)),
            Positioned.fill(
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: blurSigma, sigmaY: blurSigma),
                child: Container(
                  color: Colors.black.withValues(alpha: scrimAlpha),
                ),
              ),
            ),
            Padding(
              padding: EdgeInsets.only(
                left: horizontalPadding,
                right: horizontalPadding,
                bottom: bottomPadding,
                top: top,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      if (showLeading) ...[
                        leading ??
                            InkWell(
                              onTap: onBack ?? goBackToHome,
                              child: Assets.imagesBack.image(
                                width: leadingWidth,
                                height: leadingHeight,
                              ),
                            ),
                        const SizedBox(width: 10),
                      ],
                      Expanded(
                        child: Center(
                          child:
                              titleWidget ??
                              CommonText.bold(
                                title,
                                color: titleColor,
                                size: titleSize,
                                textAlign: TextAlign.center,
                              ),
                        ),
                      ),
                      if (trailing != null)
                        trailing!
                      else if (showLeading)
                        SizedBox(width: leadingWidth + 10),
                    ],
                  ),
                  if (toolbarBottomGap > 0) SizedBox(height: toolbarBottomGap),
                  ?belowToolbar,
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// White circular icon button used in [BlurredImageScreenHeader] trailing slots.
class HeaderCircleIconButton extends StatelessWidget {
  const HeaderCircleIconButton({
    super.key,
    required this.icon,
    required this.onTap,
    this.size = 36,
    this.iconSize = 20,
  });

  final IconData icon;
  final VoidCallback onTap;
  final double size;
  final double iconSize;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      shape: const CircleBorder(),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: SizedBox(
          width: size,
          height: size,
          child: Icon(icon, color: Colors.black87, size: iconSize),
        ),
      ),
    );
  }
}
