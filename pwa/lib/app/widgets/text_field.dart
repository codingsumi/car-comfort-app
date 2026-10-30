import 'dart:math' as math;

import 'package:dropdown_button2/dropdown_button2.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';

import '../constants/ui_constants.dart';
import '../gen/fonts.gen.dart';
import '../utils/extensions/extension.dart';
import '../utils/validator.dart';
import 'text.dart';

/// Shared brand red used for the required-field asterisk.
const _kRequiredAsteriskColor = Color(0xffF2051F);

/// Renders a field label. When [isRequired] is true a red `*` is appended.
/// Public so it can be used for standalone section labels outside the field widgets.
class RequiredFieldLabel extends StatelessWidget {
  const RequiredFieldLabel({
    super.key,
    required this.label,
    required this.color,
    this.isRequired = false,
    this.size = 14,
    this.bold = false,
  });

  final String label;
  final Color color;
  final bool isRequired;
  final double size;
  final bool bold;

  @override
  Widget build(BuildContext context) {
    final weight = bold ? FontWeight.w700 : FontWeight.w500;
    final base = TextStyle(
      fontFamily: FontFamily.inter,
      fontSize: size,
      fontWeight: weight,
      color: color,
    );
    if (!isRequired) return Text(label, style: base);
    return Text.rich(
      TextSpan(
        text: label,
        style: base,
        children: [
          TextSpan(
            text: ' *',
            style: TextStyle(
              fontFamily: FontFamily.inter,
              fontSize: size,
              fontWeight: FontWeight.w600,
              color: _kRequiredAsteriskColor,
            ),
          ),
        ],
      ),
    );
  }
}

// Private alias used by CommonTextField and CommonDropDownField.
typedef _RequiredFieldLabel = RequiredFieldLabel;

class CommonTextField extends StatelessWidget {
  final TextEditingController controller;
  final String hintText;
  final String labelText;
  final TextInputType keyboardType;
  final bool obscure;
  final TextInputAction inputAction;
  final FormFieldValidator<String>? validator;
  final GlobalKey<FormFieldState<String>>? fieldKey;
  final ValueChanged<String>? fieldSubmitted;
  final FocusNode? focus;
  final ValueChanged<String>? onChanged;
  final Widget? prefix;
  final Widget? suffix;
  final Widget? prefixIcon;
  final Widget? suffixIcon;
  final int maxLines;
  final int minLines;
  final List<TextInputFormatter> inputFormatters;
  final bool isReadOnly;
  final TextAlign textAlign;
  final VoidCallback? onTap;
  final BoxConstraints iconConstraints;
  final String obscuringCharacter;
  final Iterable<String>? autofillHints;
  final bool isCanSee;
  final Widget Function(
    BuildContext, {
    required int currentLength,
    required bool isFocused,
    required int? maxLength,
  })?
  buildCounter;
  final TextCapitalization? textCapitalization;
  final bool? autocorrect;
  final bool? enableSuggestions;
  final int? padding;
  final double? borderRadius;

  final Color? bgColor;
  final Color? textColor;
  final Color? labelColor;
  final Color? hintColor;
  final Color? borderColor;
  final Color? cursorColor;
  final bool isRequired;

  const CommonTextField({
    required this.controller,
    this.labelText = "",
    this.isRequired = false,
    this.fieldKey,
    this.keyboardType = TextInputType.text,
    this.obscure = false,
    this.inputAction = TextInputAction.next,
    this.validator,
    this.fieldSubmitted,
    this.focus,
    this.onChanged,
    this.prefix,
    this.suffix,
    this.prefixIcon,
    this.suffixIcon,
    this.inputFormatters = const [],
    this.maxLines = 1,
    this.minLines = 1,
    this.padding = 12,
    this.isReadOnly = false,
    this.hintText = "",
    this.textAlign = TextAlign.start,
    this.onTap,
    this.iconConstraints = const BoxConstraints(maxWidth: 160),
    super.key,
    this.obscuringCharacter = '•',
    this.autofillHints,
    this.isCanSee = false,
    this.buildCounter,
    this.textCapitalization,
    this.autocorrect,
    this.enableSuggestions,
    this.borderColor,
    this.borderRadius,
    this.bgColor,
    this.textColor,
    this.labelColor,
    this.cursorColor,
    this.hintColor,
  });

  /// True for keyboards that should never carry alphabetic-input traits
  /// (autocorrect/suggestions/capitalization), which on iOS can force the OS
  /// to present the alphabetic keyboard instead of the number pad.
  bool get _isNumericKeyboard {
    return keyboardType == TextInputType.number ||
        keyboardType == TextInputType.phone ||
        keyboardType == TextInputType.datetime ||
        keyboardType.index == TextInputType.number.index;
  }

  bool get _effectiveAutocorrect => autocorrect ?? !_isNumericKeyboard;

  bool get _effectiveEnableSuggestions =>
      enableSuggestions ?? !_isNumericKeyboard;

  TextCapitalization get _effectiveTextCapitalization =>
      textCapitalization ??
      (_isNumericKeyboard
          ? TextCapitalization.none
          : TextCapitalization.sentences);

  List<TextInputFormatter> get _effectiveInputFormatters {
    if (keyboardType == TextInputType.phone) {
      final hasPhoneCap = inputFormatters.any(
        (f) => f is PhoneNumberInputFormatter,
      );
      if (hasPhoneCap) return inputFormatters;
      return [...phoneInputFormatters, ...inputFormatters];
    }
    return inputFormatters;
  }

  @override
  Widget build(BuildContext context) {
    var borderStyle = OutlineInputBorder(
      borderRadius: BorderRadius.circular(
        borderRadius ?? UIConstants.defaultMargin,
      ),
      borderSide: BorderSide(
        color: borderColor ?? context.colorScheme.onPrimary,
        width: 1.5,
      ),
    );

    var focusedBorderStyle = OutlineInputBorder(
      borderRadius: BorderRadius.circular(
        borderRadius ?? UIConstants.defaultMargin,
      ),
      borderSide: BorderSide(
        color: borderColor ?? context.colorScheme.onPrimary,
        width: 1.5,
      ),
    );

    var mStyle = context.textTheme.bodyLarge?.copyWith(
      color: context.colorScheme.onPrimary,
      fontWeight: FontWeight.w600,
      fontSize: 14,
    );

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (labelText.isNotEmpty) ...[
          _RequiredFieldLabel(
            label: labelText,
            color: labelColor ?? context.colorScheme.onPrimary,
            isRequired: isRequired,
          ).paddingOnly(bottom: 4),
        ],
        TextFormField(
          onTap: onTap,
          key: fieldKey,
          autocorrect: _effectiveAutocorrect,
          enableSuggestions: _effectiveEnableSuggestions,
          validator: validator,
          obscuringCharacter: obscuringCharacter,
          textInputAction: inputAction,
          onFieldSubmitted: fieldSubmitted,
          controller: controller,
          focusNode: focus,
          obscureText: obscure,
          onChanged: onChanged,
          keyboardType: keyboardType,
          autovalidateMode: AutovalidateMode.disabled,
          textCapitalization: _effectiveTextCapitalization,
          buildCounter: buildCounter,
          style: mStyle?.copyWith(
            color: textColor ?? context.colorScheme.onPrimary,
            fontWeight: FontWeight.normal,
          ),
          textAlign: textAlign,
          maxLines: maxLines,
          minLines: minLines,
          readOnly: isReadOnly,
          cursorColor: cursorColor ?? context.colorScheme.primary,
          inputFormatters: _effectiveInputFormatters,
          autofillHints: autofillHints,
          decoration: InputDecoration(
            floatingLabelStyle: mStyle?.copyWith(
              color: context.colorScheme.primary,
            ),
            labelStyle: mStyle?.copyWith(
              color: context.colorScheme.onPrimary,
              fontWeight: FontWeight.w400,
            ),
            errorStyle: mStyle?.copyWith(
              color: context.colorScheme.error,
              fontWeight: FontWeight.w500,
              fontSize: 14,
            ),
            hintStyle: mStyle?.copyWith(
              color:
                  hintColor ??
                  context.colorScheme.onPrimary.withValues(alpha: 0.7),
              fontWeight: FontWeight.w400,
            ),
            fillColor: bgColor ?? Colors.black.withValues(alpha: 0.18),
            prefixIcon: prefixIcon?.marginOnly(left: 14, right: 8),
            floatingLabelBehavior: FloatingLabelBehavior.auto,
            contentPadding: EdgeInsets.all((padding ?? 16).toDouble()),
            prefixIconConstraints: iconConstraints,
            suffixIconConstraints: iconConstraints,
            focusedErrorBorder: focusedBorderStyle,
            focusedBorder: focusedBorderStyle,
            enabledBorder: borderStyle,
            errorBorder: borderStyle,
            border: borderStyle,
            suffixIcon: suffixIcon,
            hintText: hintText,
            errorMaxLines: 4,
            prefix: prefix,
            suffix: suffix,
            filled: true,
            alignLabelWithHint: true,
          ),
        ),
      ],
    );
  }
}

class CommonDropDownField extends StatelessWidget {
  const CommonDropDownField({
    super.key,
    required this.hintText,
    required this.onSave,
    required this.items,
    this.errorText,
    this.selectedValue,
    this.labelText = '',
    this.isRequired = false,
    this.prefixIcon,
    this.borderRadius,
    this.borderColor,
    this.isBold = false,
    this.bgColor,
    this.hPadding,
    this.vPadding,
    this.padding,
    this.paddingLeft,
    this.paddingRight,
    this.paddingTop,
    this.paddingBottom,
    this.selectedTextColor,
    this.iconColor,
    this.dropdownItemTextColor,
    this.labelColor,
    this.hintColor,
    this.dropdownBgColor,
    this.dropdownBorderColor,
    this.highlightItems = const <String>{},
    this.highlightItemTextColor,
    this.dropdownItemMaxLines = 2,
    this.labelBold = false,
    this.labelSize = 14,
  });

  final String hintText;
  final String labelText;
  final bool isRequired;
  final bool labelBold;
  final double labelSize;
  final String? errorText;
  final String? selectedValue;
  final Function(String?) onSave;
  final List<String> items;
  final Widget? prefixIcon;
  final double? borderRadius;
  final Color? borderColor;
  final bool? isBold;
  final Color? bgColor;
  final num? vPadding;
  final num? hPadding;
  final int? padding;
  /// Per-side insets; each falls back to [hPadding]/[vPadding], then [padding], then 12.
  final num? paddingLeft;
  final num? paddingRight;
  final num? paddingTop;
  final num? paddingBottom;
  final Color? selectedTextColor;
  final Color? iconColor;
  final Color? dropdownItemTextColor;
  final Color? labelColor;
  final Color? hintColor;
  final Color? dropdownBgColor;
  final Color? dropdownBorderColor;
  final Set<String> highlightItems;
  final Color? highlightItemTextColor;
  final int dropdownItemMaxLines;

  @override
  Widget build(BuildContext context) {
    final mStyle = context.textTheme.bodyLarge?.copyWith(
      color: context.colorScheme.onPrimary,
      fontWeight: FontWeight.w600,
      fontSize: 14,
    );

    final borderStyle = OutlineInputBorder(
      borderRadius: BorderRadius.circular(
        borderRadius ?? UIConstants.defaultMargin,
      ),
      borderSide: BorderSide(
        color: borderColor ?? context.colorScheme.onPrimary,
        width: 1.5,
      ),
    );

    final focusedBorderStyle = OutlineInputBorder(
      borderRadius: BorderRadius.circular(
        borderRadius ?? UIConstants.defaultMargin,
      ),
      borderSide: BorderSide(
        color: borderColor ?? context.colorScheme.outline.withValues(alpha: 0.5),
        width: 1.5,
      ),
    );
    const defaultFieldInset = 12.0;
    final baseInset = padding?.toDouble();
    final contentPadding = EdgeInsets.only(
      left: (paddingLeft ?? 0 ?? baseInset ?? defaultFieldInset)
          .toDouble(),
      right: (paddingRight ?? hPadding ?? baseInset ?? defaultFieldInset)
          .toDouble(),
      top: (paddingTop ?? vPadding ?? baseInset ?? defaultFieldInset)
          .toDouble(),
      bottom: (paddingBottom ?? vPadding ?? baseInset ?? defaultFieldInset)
          .toDouble(),
    );

    final effectiveSelected = selectedValue != null && items.contains(selectedValue)
        ? selectedValue
        : null;

    final hintStyle = mStyle?.copyWith(
      color: hintColor ?? context.colorScheme.onPrimary.withValues(alpha: 0.7),
      fontWeight: FontWeight.w400,
    );
    final scaledFontSize = MediaQuery.textScalerOf(context).scale(
      mStyle?.fontSize ?? 14,
    );
    final dropdownItemHeight = math.max(
      64.0,
      scaledFontSize * 1.25 * dropdownItemMaxLines + 12,
    );

    final field = DropdownButtonFormField2<String>(
      isExpanded: true,
      onChanged: (value) => onSave(value),
      value: effectiveSelected,
      alignment: AlignmentDirectional.centerStart,
      hint: hintText.isEmpty
          ? null
          : Text(
              hintText,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: hintStyle,
            ),
      style: mStyle?.copyWith(
        color: selectedTextColor ?? context.colorScheme.onPrimary,
        fontWeight: isBold == true ? FontWeight.w600 : FontWeight.normal,
      ),
      decoration: InputDecoration(
        filled: true,
        errorMaxLines: 4,
        border: borderStyle,
        enabledBorder: borderStyle,
        focusedBorder: focusedBorderStyle,
        focusedErrorBorder: focusedBorderStyle,
        errorBorder: borderStyle,
        fillColor: bgColor ?? Colors.transparent,
        prefixIconColor: context.colorScheme.primary,
        floatingLabelBehavior: FloatingLabelBehavior.never,
        prefixIcon: prefixIcon?.marginOnly(left: 14, right: 0),
        contentPadding: contentPadding,
        floatingLabelStyle: mStyle?.copyWith(
          color: context.colorScheme.primary,
        ),
        errorStyle: context.textTheme.bodyLarge?.copyWith(
          color: context.colorScheme.error,
          fontWeight: FontWeight.w500,
          fontSize: 14,
        ),
      ),
      validator: (errorText == null || errorText!.isEmpty)
          ? null
          : (value) => (value == null || value.isEmpty) ? errorText : null,
      buttonStyleData: const ButtonStyleData(
        padding: EdgeInsets.zero,
      ),
      iconStyleData: IconStyleData(
        icon: Icon(
          Icons.keyboard_arrow_down_sharp,
          color: iconColor ?? context.colorScheme.onSurface,
        ),
      ),
      dropdownStyleData: DropdownStyleData(
        maxHeight: 250,
        decoration: BoxDecoration(
          color: dropdownBgColor ?? context.colorScheme.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: dropdownBorderColor ??
                context.colorScheme.onPrimary.withValues(alpha: 0.2),
          ),
        ),
      ),
      menuItemStyleData: MenuItemStyleData(
        height: dropdownItemHeight,
        padding: const EdgeInsets.symmetric(horizontal: 12),
      ),
      selectedItemBuilder: (context) => items
          .map(
            (item) => Align(
              alignment: Alignment.centerLeft,
              child: Text(
                item,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: mStyle?.copyWith(
                  color: selectedTextColor ?? context.colorScheme.onPrimary,
                  fontWeight: isBold == true ? FontWeight.w600 : FontWeight.normal,
                ),
              ),
            ),
          )
          .toList(),
      items: items
          .map((item) => DropdownMenuItem<String>(
              value: item,
              child: Text(
                item,
                maxLines: dropdownItemMaxLines,
                overflow: TextOverflow.clip,
                style: mStyle?.copyWith(
                  color: highlightItems.contains(item)
                      ? (highlightItemTextColor ?? context.colorScheme.primary)
                      : (dropdownItemTextColor ?? context.colorScheme.onSurface),
                  fontWeight: FontWeight.normal,
                ),
              ),
            ),
          )
          .toList(),
    );

    if (labelText.isEmpty) {
      return field;
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _RequiredFieldLabel(
          label: labelText,
          color: labelColor ?? context.colorScheme.onPrimary,
          isRequired: isRequired,
          bold: labelBold,
          size: labelSize,
        ).paddingOnly(bottom: 4),
        field,
      ],
    );
  }
}

/// Input decoration matching [CommonTextField] for non-dropdown inputs on the same form.
InputDecoration commonFieldDecorationMatchingTextField(
  BuildContext context, {
  String? hintText,
  Widget? suffix,
}) {
  final borderColor = context.colorScheme.outlineVariant;
  final borderStyle = OutlineInputBorder(
    borderRadius: BorderRadius.circular(UIConstants.defaultMargin),
    borderSide: BorderSide(
      color: borderColor,
      width: 1.5,
    ),
  );
  final mStyle = context.textTheme.bodyLarge?.copyWith(
    color: context.colorScheme.onPrimary,
    fontWeight: FontWeight.w600,
    fontSize: 16,
  );
  return InputDecoration(
    filled: true,
    fillColor: Colors.transparent,
    hintText: hintText,
    hintStyle: mStyle?.copyWith(
      color: context.colorScheme.onPrimary.withValues(alpha: 0.7),
      fontWeight: FontWeight.w400,
    ),
    border: borderStyle,
    enabledBorder: borderStyle,
    focusedBorder: borderStyle,
    contentPadding: const EdgeInsets.all(12),
    suffixIcon: suffix,
  );
}

var borderStyle = OutlineInputBorder(
  borderRadius: BorderRadius.circular(UIConstants.defaultMargin),
  borderSide: BorderSide(
    color: Get.context!.colorScheme.outline.withValues(alpha: 0.5),
    width: 2,
  ),
);

var focusedBorderStyle = OutlineInputBorder(
  borderRadius: BorderRadius.circular(UIConstants.defaultMargin),
  borderSide: BorderSide(
    color: Get.context!.colorScheme.primary.withValues(alpha: 0.9),
    width: 2,
  ),
);

var dropDownStyle = DropdownStyleData(
  decoration: BoxDecoration(
    color: Get.context!.colorScheme.onPrimary,
    borderRadius: BorderRadius.circular(UIConstants.defaultMargin),
  ),
);

var dropDownDecoration = InputDecoration(
  filled: true,
  errorMaxLines: 4,
  border: borderStyle,
  enabledBorder: borderStyle,
  focusedBorder: focusedBorderStyle,
  focusedErrorBorder: focusedBorderStyle,
  fillColor: Colors.white,
  prefixIconColor: Get.context!.colorScheme.primary,
  floatingLabelBehavior: FloatingLabelBehavior.never,
  contentPadding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
  floatingLabelStyle: Get.context!.textTheme.bodyLarge?.copyWith(
    color: Get.context!.colorScheme.primary,
    fontWeight: FontWeight.w600,
    fontSize: 14,
  ),
  labelStyle: Get.context!.textTheme.bodyLarge?.copyWith(
    color: Get.context!.colorScheme.outline,
    fontWeight: FontWeight.w400,
    fontSize: 14,
  ),
  errorStyle: Get.context!.textTheme.bodyLarge?.copyWith(
    color: Get.context!.colorScheme.error,
    fontWeight: FontWeight.w500,
    fontSize: 14,
    backgroundColor: Colors.transparent,
  ),
);
