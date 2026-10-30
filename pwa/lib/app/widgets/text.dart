import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../gen/fonts.gen.dart';
import '../utils/extensions/extension.dart';

enum TextType {
  extraBold,
  bold,
  semiBold,
  medium,
  regular,
  light,
}

class CommonText extends StatelessWidget {
  final String text;
  final double size;
  final Color? color;
  final int? maxLines;
  final bool isItalic;
  final bool isUnderLine;
  final VoidCallback? onTap;
  final TextAlign? textAlign;
  final double? letterSpacing;
  final TextType? type;
  final bool? isTitle;
  final TextOverflow? overflow;

  const CommonText.extraBold(
    this.text, {
    this.size = 14,
    this.color,
    this.textAlign,
    this.overflow,
    this.maxLines,
    this.isItalic = false,
    this.letterSpacing,
    this.onTap,
    this.type = TextType.extraBold,
    this.isUnderLine = false,
    this.isTitle = false,
    super.key,
  });

  const CommonText.bold(
    this.text, {
    this.size = 14,
    this.color,
    this.textAlign,
    this.overflow,
    this.maxLines,
    this.isItalic = false,
    this.letterSpacing,
    this.onTap,
    this.type = TextType.bold,
    this.isUnderLine = false,
    this.isTitle = false,
    super.key,
  });

  const CommonText.semiBold(
    this.text, {
    this.size = 14,
    this.color,
    this.textAlign,
    this.overflow,
    this.maxLines,
    this.isItalic = false,
    this.letterSpacing,
    this.onTap,
    this.type = TextType.semiBold,
    this.isUnderLine = false,
    this.isTitle = false,
    super.key,
  });

  const CommonText.medium(
    this.text, {
    this.size = 14,
    this.color,
    this.textAlign,
    this.overflow,
    this.maxLines,
    this.isItalic = false,
    this.letterSpacing,
    this.onTap,
    this.type = TextType.medium,
    this.isUnderLine = false,
    this.isTitle = false,
    super.key,
  });

  const CommonText.regular(
    this.text, {
    this.size = 14,
    this.color,
    this.textAlign,
    this.overflow,
    this.maxLines,
    this.isItalic = false,
    this.letterSpacing,
    this.onTap,
    this.type = TextType.regular,
    this.isUnderLine = false,
    this.isTitle = false,
    super.key,
  });

  const CommonText.light(
    this.text, {
    this.size = 14,
    this.color,
    this.textAlign,
    this.overflow,
    this.maxLines,
    this.isItalic = false,
    this.letterSpacing,
    this.onTap,
    this.type = TextType.light,
    this.isUnderLine = false,
    this.isTitle = false,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    var font = TextStyle(fontFamily: FontFamily.inter);
    TextStyle mStyle = switch (type) {
      TextType.extraBold => font.copyWith(
          color: color ?? context.colorScheme.onSurface,
          fontSize: size,
          fontStyle: isItalic ? FontStyle.italic : null,
          fontWeight: FontWeight.w700,
          letterSpacing: letterSpacing,
          decoration: isUnderLine ? TextDecoration.underline : null,
          decorationThickness: 1,
          decorationColor: color ?? context.colorScheme.tertiary,
        ),
      TextType.bold => font.copyWith(
          color: color ?? context.colorScheme.onSurface,
          fontSize: size,
          fontStyle: isItalic ? FontStyle.italic : null,
          fontWeight: FontWeight.w600,
          letterSpacing: letterSpacing,
          decoration: isUnderLine ? TextDecoration.underline : null,
          decorationThickness: 1,
          decorationColor: color ?? context.colorScheme.tertiary,
        ),
      TextType.semiBold => font.copyWith(
          color: color ?? context.colorScheme.onSurface,
          fontSize: size,
          fontStyle: isItalic ? FontStyle.italic : null,
          fontWeight: FontWeight.w500,
          letterSpacing: letterSpacing,
          decoration: isUnderLine ? TextDecoration.underline : null,
          decorationThickness: 1,
          decorationColor: color ?? context.colorScheme.tertiary,
        ),
      TextType.medium => font.copyWith(
          color: color ?? context.colorScheme.onSurface,
          fontSize: size,
          fontStyle: isItalic ? FontStyle.italic : null,
          fontWeight: FontWeight.w500,
          letterSpacing: letterSpacing,
          decoration: isUnderLine ? TextDecoration.underline : null,
          decorationThickness: 1,
          decorationColor: color ?? context.colorScheme.tertiary,
        ),
      TextType.regular => font.copyWith(
          color: color ?? context.colorScheme.onSurface,
          fontSize: size,
          fontStyle: isItalic ? FontStyle.italic : null,
          fontWeight: FontWeight.w400,
          letterSpacing: letterSpacing,
          decoration: isUnderLine ? TextDecoration.underline : null,
          decorationThickness: 1,
          decorationColor: color ?? context.colorScheme.tertiary,
        ),
      TextType.light => font.copyWith(
          color: color ?? context.colorScheme.onSurface,
          fontSize: size,
          fontWeight: FontWeight.w200,
          fontStyle: isItalic ? FontStyle.italic : null,
          letterSpacing: letterSpacing,
          decoration: isUnderLine ? TextDecoration.underline : null,
          decorationThickness: 1,
          decorationColor: color ?? context.colorScheme.tertiary,
        ),
      _ => font.copyWith(
          color: color ?? context.colorScheme.onSurface,
          fontSize: size,
          fontStyle: isItalic ? FontStyle.italic : null,
          fontWeight: FontWeight.w400,
          letterSpacing: letterSpacing,
          decoration: isUnderLine ? TextDecoration.underline : null,
          decorationThickness: 1,
          decorationColor: color ?? context.colorScheme.tertiary,
        ),
    };

    return InkWell(
      borderRadius: const BorderRadius.all(Radius.circular(4)),
      onTap: onTap,
      child: Text(
        text,
        textAlign: textAlign,
        overflow: overflow,
        maxLines: maxLines,
        softWrap: true,
        style: mStyle,
      ).paddingSymmetric(
        horizontal: onTap != null ? 12 : 0,
        vertical: onTap != null ? 4 : 0,
      ),
    );
  }
}
