import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../constants/ui_constants.dart';
import '../utils/extensions/extension.dart';
import '../widgets/image.dart';
import '../widgets/text.dart';

enum ButtonType {
  primary,
  primaryOutline,
  secondary,
  outline,
  noOutline,
  transparent,
  tonal,
  disabled,
}

class AppButton extends StatelessWidget {
  final VoidCallback? onPressed;
  final double btnCornerRadius;
  final Color? borderColor;
  final double borderWidth;
  final double? iconSize;
  final double? textSize;
  final double vPadding;
  final double hPadding;
  final ButtonType type;
  final Color? bgColor;
  final Color? txtColor;
  final String? icon;
  final Widget? trailingIcon;
  final String label;
  final bool isItalic;
  final bool isMax;

  const AppButton({
    required this.label,
    required this.onPressed,
    this.textSize = 16.0,
    this.type = ButtonType.primary,
    this.icon,
    this.trailingIcon,
    super.key,
    this.bgColor,
    this.txtColor,
    this.vPadding = 12,
    this.hPadding = 8,
    this.iconSize,
    this.borderColor,
    this.borderWidth = 0,
    this.btnCornerRadius = 16,
    this.isMax = true,
    this.isItalic=false
  });

  @override
  Widget build(BuildContext context) {
    final ColorScheme colorScheme = context.colorScheme;

    WidgetStateProperty<Color?> backgroundColor;
    WidgetStateProperty<BorderSide?>? side;
    Color textColor;

    ButtonStyle buttonStyle = ButtonStyle(
      shape: WidgetStateProperty.all(RoundedRectangleBorder(borderRadius: BorderRadius.circular(btnCornerRadius))),
      padding: WidgetStateProperty.all(EdgeInsets.symmetric(vertical: vPadding, horizontal: hPadding)),
      elevation: WidgetStateProperty.all(0),
    );

    switch (type) {
      case ButtonType.primary:
        side = WidgetStateProperty.all(BorderSide(color: borderWidth <= 0 ? Colors.transparent : colorScheme.onPrimary, width: borderWidth));
        backgroundColor = WidgetStateProperty.resolveWith(
          (states) {
            return states.contains(WidgetState.pressed) || states.contains(WidgetState.focused)
                ? colorScheme.primaryContainer
                : bgColor ?? colorScheme.primary;
          },
        );
        textColor = colorScheme.onPrimary;
        break;
      case ButtonType.primaryOutline:
        side = WidgetStateProperty.all(BorderSide(color: borderWidth <= 0 ? Colors.transparent : colorScheme.primary, width: borderWidth));
        backgroundColor = WidgetStateProperty.resolveWith(
          (states) {
            return states.contains(WidgetState.pressed) || states.contains(WidgetState.focused)
                ? colorScheme.primary
                : colorScheme.primary;
          },
        );
        textColor = colorScheme.primary;
        break;
      case ButtonType.transparent:
        textColor = colorScheme.secondary;
        backgroundColor = WidgetStateProperty.resolveWith(
          (states) {
            return states.contains(WidgetState.pressed) || states.contains(WidgetState.focused)
                ? colorScheme.secondaryContainer.withValues(alpha: 0.2)
                : Colors.transparent;
          },
        );
        side = null;
        break;
      case ButtonType.outline:
        side = WidgetStateProperty.all(BorderSide(color: borderColor ?? colorScheme.primary, width: 2));
        backgroundColor = WidgetStateProperty.resolveWith((states) => states.contains(WidgetState.pressed) || states.contains(WidgetState.focused)
            ? colorScheme.secondary.withValues(alpha: 0.1)
            : bgColor ?? Colors.transparent);
        textColor = colorScheme.primary;
        break;
      case ButtonType.noOutline:
        backgroundColor = WidgetStateProperty.resolveWith(
          (states) {
            return states.contains(WidgetState.pressed) || states.contains(WidgetState.focused) ? colorScheme.primaryContainer : colorScheme.primary;
          },
        );
        textColor = colorScheme.onPrimary;
        side = null;
        break;
      case ButtonType.tonal:
        side = WidgetStateProperty.all(BorderSide(color: borderWidth <= 0 ? Colors.transparent : colorScheme.primary, width: borderWidth));
        backgroundColor = WidgetStateProperty.resolveWith(
          (states) {
            return states.contains(WidgetState.pressed) || states.contains(WidgetState.focused)
                ? colorScheme.primaryContainer
                : colorScheme.primaryContainer;
          },
        );
        textColor = colorScheme.primary;
        break;
      case ButtonType.secondary:
        side = WidgetStateProperty.all(BorderSide(color: borderWidth <= 0 ? Colors.transparent : colorScheme.secondary, width: borderWidth));
        backgroundColor = WidgetStateProperty.resolveWith(
          (states) {
            return states.contains(WidgetState.pressed) || states.contains(WidgetState.focused) ? colorScheme.secondary : colorScheme.secondary;
          },
        );
        textColor = colorScheme.onSecondary;
        break;
      case ButtonType.disabled:
        side = WidgetStateProperty.all(BorderSide(color: colorScheme.primary, width: 1));
        backgroundColor = WidgetStateProperty.resolveWith(
          (states) {
            return states.contains(WidgetState.pressed) || states.contains(WidgetState.focused)
                ? colorScheme.primaryContainer
                : colorScheme.primaryContainer;
          },
        );
        textColor = colorScheme.primary;
        break;
    }

    return ElevatedButton(
      onPressed: onPressed,
      clipBehavior: Clip.hardEdge,
      style: buttonStyle.copyWith(
        backgroundColor: backgroundColor,
        side: side,
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        mainAxisSize: isMax ? MainAxisSize.max : MainAxisSize.min,
        children: [
          if (icon != null)
            SvgImageFromAsset(
              icon!,
              height: iconSize ?? UIConstants.defaultIconSize,
              width: iconSize ?? UIConstants.defaultIconSize,
              // color: txtColor ?? textColor,
            ).marginOnly(right: UIConstants.defaultMargin)
          else
            const SizedBox(width: 0, height: 0),
          Flexible(
            child: CommonText.medium(
              label,
              isItalic: isItalic,
              textAlign: TextAlign.center,
              color: txtColor ?? textColor,
              size: textSize??16.0,
            ),
          ),
          if (trailingIcon != null) (trailingIcon ?? Container()).marginOnly(left: 8) else const SizedBox(width: 0, height: 0),
        ],
      ),
    );
  }
}
