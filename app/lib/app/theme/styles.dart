import 'package:flutter/material.dart';

import '../constants/ui_constants.dart';
import '../gen/fonts.gen.dart';
import '../utils/extensions/extension.dart';

final TextStyle style = TextStyle(
  fontFamily: FontFamily.inter,
);

TextTheme textTheme = TextTheme(
  displayLarge: style.copyWith(
    fontSize: 57,
    fontWeight: FontWeight.w400,
  ),
  displayMedium: style.copyWith(
    fontSize: 45,
    fontWeight: FontWeight.w400,
  ),
  displaySmall: style.copyWith(
    fontSize: 36,
    fontWeight: FontWeight.w400,
  ),
  headlineLarge: style.copyWith(
    fontSize: 32,
    fontWeight: FontWeight.w400,
  ),
  headlineMedium: style.copyWith(
    fontSize: 28,
    fontWeight: FontWeight.w400,
  ),
  headlineSmall: style.copyWith(
    fontSize: 24,
    fontWeight: FontWeight.w400,
  ),
  titleLarge: style.copyWith(
    fontSize: 22,
    fontWeight: FontWeight.w400,
  ),
  titleMedium: style.copyWith(
    fontSize: 16,
    fontWeight: FontWeight.w500,
  ),
  titleSmall: style.copyWith(
    fontSize: 14,
    fontWeight: FontWeight.w500,
  ),
  bodyLarge: style.copyWith(
    fontSize: 16,
    fontWeight: FontWeight.w400,
  ),
  bodyMedium: style.copyWith(
    fontSize: 14,
    fontWeight: FontWeight.w400,
  ),
  bodySmall: style.copyWith(
    fontSize: 12,
    fontWeight: FontWeight.w400,
  ),
  labelLarge: style.copyWith(
    fontSize: 14,
    fontWeight: FontWeight.w500,
  ),
  labelMedium: style.copyWith(
    fontSize: 12,
    fontWeight: FontWeight.w500,
  ),
  labelSmall: style.copyWith(
    fontSize: 11,
    fontWeight: FontWeight.w500,
  ),
);

ButtonStyle outlineIconButtonStyle(BuildContext context) {
  return ButtonStyle(
    backgroundColor: WidgetStateProperty.all(context.colorScheme.primaryContainer.withValues(alpha: 0.4)),
    iconColor: WidgetStateProperty.all(context.colorScheme.primary),
    shape: WidgetStateProperty.all(
      RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(UIConstants.defaultRadius),
        side: BorderSide(color: context.colorScheme.primary, width: 2),
      ),
    ),
    padding: WidgetStateProperty.all(const EdgeInsets.all(12)),
  );
}

ButtonStyle filledIconButtonStyle(BuildContext context) {
  return ButtonStyle(
    backgroundColor: WidgetStateProperty.all(context.colorScheme.primary),
    iconColor: WidgetStateProperty.all(context.colorScheme.onPrimary),
    shape: WidgetStateProperty.all(
      RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(UIConstants.defaultRadius),
      ),
    ),
    padding: WidgetStateProperty.all(const EdgeInsets.all(12)),
  );
}

ButtonStyle crossIconButtonStyle(BuildContext context) {
  return ButtonStyle(
    backgroundColor: WidgetStateProperty.all(context.colorScheme.primaryContainer.withValues(alpha: 0.4)),
    iconColor: WidgetStateProperty.all(context.colorScheme.primary),
    minimumSize: WidgetStateProperty.all(const Size(14, 14)),
    shape: WidgetStateProperty.all(
      RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(UIConstants.defaultRadius),
        side: BorderSide(color: context.colorScheme.primary, width: 2),
      ),
    ),
    padding: WidgetStateProperty.all(const EdgeInsets.all(6)),
  );
}
