import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';

import '../constants/app_strings.dart';
import '../constants/validation_constants.dart';

/// Digits-only; blocks typing/paste beyond [ValidationConstants.phoneMaxDigits].
class PhoneNumberInputFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final digits = phoneDigitsOnly(newValue.text);
    if (digits.isEmpty) {
      return const TextEditingValue(
        text: '',
        selection: TextSelection.collapsed(offset: 0),
      );
    }
    final limited = digits.length > ValidationConstants.phoneMaxDigits
        ? digits.substring(0, ValidationConstants.phoneMaxDigits)
        : digits;
    return TextEditingValue(
      text: limited,
      selection: TextSelection.collapsed(offset: limited.length),
    );
  }
}

/// Use on every local phone number field (no validation errors — input is capped).
final List<TextInputFormatter> phoneInputFormatters = [
  PhoneNumberInputFormatter(),
];

String phoneDigitsOnly(String? value) =>
    (value ?? '').replaceAll(RegExp(r'\D'), '');

/// Keeps at most [ValidationConstants.phoneMaxDigits] trailing digits (local part).
String normalizePhoneLocalDigits(String raw) {
  final digits = phoneDigitsOnly(raw);
  if (digits.length <= ValidationConstants.phoneMaxDigits) return digits;
  return digits.substring(digits.length - ValidationConstants.phoneMaxDigits);
}

String? validatePhoneNumber(String? value, {bool allowEmpty = false}) {
  final digits = phoneDigitsOnly(value);
  if (digits.isEmpty) {
    return allowEmpty ? null : 'Please enter phone number';
  }
  if (digits.length != ValidationConstants.phoneMaxDigits) {
    return 'Phone number must be ${ValidationConstants.phoneMaxDigits} digits';
  }
  return null;
}

String? validateAustralianPhoneNumber(String? value) =>
    validatePhoneNumber(value);

String? validatePassword(
  String? value, {
  bool checkRegex = false,
  String errMsg = "Please enter password",
}) {
  final passwordRegex = RegExp(
    r'^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#\$&*~%^()_+=\[\]\-{}|\\:;\"<>,.?/]).{8,}$',
  );

  if (value == null || value.isEmpty) {
    return errMsg;
  } /*else if (value.length < 8) {
    return "Password must be at least 8 characters long";
  } */ else if (checkRegex) {
    if (!passwordRegex.hasMatch(value)) {
      return "Please include a capital letter, number and symbol in your password";
    }
  } else {
    return null;
  }
  return null;
}

String? validateConfirmPassword(String? value, String password) {
  if (value == null || value.isEmpty) {
    return "Enter repeat password";
  } else if (value != password) {
    return "Both passwords should be matched";
  } else {
    return null;
  }
}

String? validateEmail(String? value, {bool checkEmpty = false}) {
  if (value == null || value.trim().isEmpty) {
    return checkEmpty ? "Please enter a valid email address" : null;
  } else if (!RegExp(ValidationConstants.emailPattern).hasMatch(value.trim())) {
    return "Please enter a valid email address";
  }
  return null;
}

String? validateCardNumber(String? value) {
  if (value == null) {
    return null;
  } else if (value.isEmpty) {
    return "Please enter card number";
  } else {
    var number = value.replaceAll(" ", "");
    if (number.length < 12 || number.length > 20) {
      return "Please enter valid card number";
    } else {
      return null;
    }
  }
}

String? validateCvv(String? value) {
  if (value == null) {
    return null;
  } else if (value.isEmpty) {
    return "Please enter CVV";
  } else if (value.length < 3 || value.length > 4) {
    return "Please enter valid CVV";
  } else {
    return null;
  }
}

String? validateCardExpiry(String? value) {
  if (value == null || value.isEmpty) {
    return "Please enter expiry date";
  }

  if (RegExp(r'^(0[1-9]|1[0-2])\/$').hasMatch(value)) {
    return 'Please enter the full expiry date (MM/yy)';
  }

  final parts = value.split('/');
  final month = int.parse(parts[0]);
  final year = int.parse('20${parts[1]}');

  final now = DateTime.now();
  final lastDateOfMonth = DateTime(year, month + 1, 0);

  if (lastDateOfMonth.isBefore(now)) {
    return AppStrings.cardExpired;
  }

  return null; // Valid
}

String? validateUsername(String? value) {
  if (value == null || value.trim().isEmpty) {
    return "Please enter user name";
  }

  final usernameRegExp = RegExp(
    r'^(?!.*__)(?!.*_$)[a-zA-Z0-9]+(?:_[a-zA-Z0-9]+)*$',
  );

  if (!usernameRegExp.hasMatch(value.trim())) {
    return 'Username must be 3–20 characters and can only contain letters, numbers, and underscores (no special characters).';
  }

  if (value.trim().length < 3 || value.trim().length > 20) {
    return 'Username must be 3–20 characters long';
  }

  return null; // valid
}

String? validateName(String? value, String? error, {String? name = "Name"}) {
  if (value == null || value.trim().isEmpty) {
    return error ?? "Please enter a $name";
  }

  if (RegExp(r'[^a-zA-Z0-9\s]').hasMatch(value)) {
    return '$name must not contain special characters';
  }

  if (!RegExp(r'[a-zA-Z]').hasMatch(value)) {
    return '$name must contain at least one letter';
  }

  return null;
}

/// Validates a person's first or last name during account registration.
/// Names must contain meaningful letters but may include spaces, apostrophes,
/// and hyphens so common real-world names are not rejected.
String? validatePersonName(String? value, {required String fieldName}) {
  final normalized = (value ?? '').trim().replaceAll(RegExp(r'\s+'), ' ');
  if (normalized.isEmpty) {
    return 'Please enter ${fieldName.toLowerCase()}';
  }
  if (normalized.length < 2) {
    return '$fieldName must be at least 2 characters';
  }
  if (normalized.length > 50) {
    return '$fieldName must be 50 characters or fewer';
  }

  final validCharacters = RegExp(r"^[\p{L}\p{M}' -]+$", unicode: true);
  if (!validCharacters.hasMatch(normalized)) {
    return '$fieldName can only contain letters, spaces, apostrophes, and hyphens';
  }

  final letterCount = RegExp(
    r'\p{L}',
    unicode: true,
  ).allMatches(normalized).length;
  if (letterCount < 2) {
    return '$fieldName must contain at least 2 letters';
  }
  return null;
}

/// Blocks any character that is not a letter, digit, space or hyphen while
/// typing a vehicle license plate, and caps the length. This prevents junk
/// input such as `&@@@@@@` from ever reaching the controller or backend.
final List<TextInputFormatter> licensePlateInputFormatters = [
  FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9 -]')),
  LengthLimitingTextInputFormatter(ValidationConstants.licensePlateMaxLength),
];

/// Normalizes a license plate for storage/submission: trims, uppercases and
/// collapses repeated internal whitespace to a single space.
String normalizeLicensePlate(String? value) {
  return (value ?? '').trim().toUpperCase().replaceAll(RegExp(r'\s+'), ' ');
}

String? validateLicensePlate(String? value, {bool allowEmpty = false}) {
  final plate = normalizeLicensePlate(value);
  if (plate.isEmpty) {
    return allowEmpty ? null : 'Please enter license plate';
  }
  if (plate.length < ValidationConstants.licensePlateMinLength) {
    return 'License plate must be at least '
        '${ValidationConstants.licensePlateMinLength} characters';
  }
  // Must start with a letter/number; remaining chars may include space/hyphen.
  final validPlate = RegExp(
    '^[A-Z0-9][A-Z0-9 -]{0,'
    '${ValidationConstants.licensePlateMaxLength - 1}'
    r'}$',
  );
  if (!validPlate.hasMatch(plate)) {
    return 'Use letters and numbers only (e.g. ABC 1234)';
  }
  return null;
}

String? validateAddress(String? value) {
  final address = normalizeAddress(value);
  if (address.isEmpty) {
    return 'Please enter address';
  }

  final validCharacters = RegExp(r"^[a-zA-Z0-9\s,'\-./#&()]+$");

  if (!validCharacters.hasMatch(address)) {
    return 'Address must not contain special characters';
  }

  if (address.length > ValidationConstants.addressMaxLength) {
    return 'Address must be at most ${ValidationConstants.addressMaxLength} characters';
  }

  return null;
}

/// Blocks characters that are not valid in a street address while typing.
final List<TextInputFormatter> addressInputFormatters = [
  FilteringTextInputFormatter.allow(RegExp(r"[a-zA-Z0-9\s,'\-./#&()]")),
  LengthLimitingTextInputFormatter(ValidationConstants.addressMaxLength),
];

/// Trims and collapses repeated internal whitespace in an address string.
String normalizeAddress(String? value) {
  return (value ?? '').trim().replaceAll(RegExp(r'\s+'), ' ');
}

String? validateFiled(String? value, String? error) {
  if (value == null) {
    return null;
  } else if (value.trim().isEmpty) {
    return error ?? AppStrings.requiredField;
  } else {
    return null;
  }
}

String? validateCharacterLength(
  String? value,
  int length, {
  bool checkExact = false,
}) {
  if (value == null) {
    return null;
  } else if (value.trim().isEmpty) {
    return "This field is empty";
  } else if (checkExact) {
    return "It should be $length character";
  } else if (checkExact == false && value.length < length) {
    return "It should be more then $length character";
  }
  return null;
}

String? validateAmount(String? value, {String name = "Amount"}) {
  final amount = double.tryParse(value ?? "");
  if (value == null) {
    return null;
  } else if (value.trim().isEmpty) {
    return "Please enter $name";
  } else if (amount == null || amount == 0) {
    return '${name.capitalizeFirst} must be greater than 0';
  } else {
    return null;
  }
}

const int _packagePriceMaxIntegerDigits = 7;
const int _packagePriceMaxDecimalPlaces = 2;

/// Sanitizes currency input while typing: digits + one decimal, strips leading
/// zeros, and caps decimal places. When [allowTrailingDot] is true, values like
/// `9.` are preserved so the user can keep typing cents.
String sanitizePackagePriceInput(String input, {bool allowTrailingDot = true}) {
  var text = input.replaceAll(RegExp(r'[^0-9.]'), '');
  if (text.isEmpty) return '';

  if (text.startsWith('.')) {
    text = '0$text';
  }

  final firstDot = text.indexOf('.');
  var intPart = firstDot == -1 ? text : text.substring(0, firstDot);
  var fracPart = firstDot == -1 ? '' : text.substring(firstDot + 1);

  if (intPart.length > 1) {
    intPart = intPart.replaceFirst(RegExp(r'^0+'), '');
    if (intPart.isEmpty) intPart = '0';
  }
  if (intPart.length > _packagePriceMaxIntegerDigits) {
    intPart = intPart.substring(0, _packagePriceMaxIntegerDigits);
  }
  if (fracPart.length > _packagePriceMaxDecimalPlaces) {
    fracPart = fracPart.substring(0, _packagePriceMaxDecimalPlaces);
  }

  if (firstDot == -1) return intPart;
  if (allowTrailingDot && fracPart.isEmpty) return '$intPart.';
  return fracPart.isEmpty ? intPart : '$intPart.$fracPart';
}

/// Returns a normalized positive price string, or null when invalid.
String? normalizePackagePrice(String? value) {
  final raw = (value ?? '').trim();
  if (raw.isEmpty) return null;

  final sanitized = sanitizePackagePriceInput(raw, allowTrailingDot: false);
  if (sanitized.isEmpty || sanitized.endsWith('.')) return null;
  if (sanitized.split('.').length > 2) return null;

  final price = double.tryParse(sanitized);
  if (price == null || price <= 0) return null;
  return sanitized;
}

bool isValidPackagePrice(String? value) => normalizePackagePrice(value) != null;

String? validatePackagePrice(String? value) {
  final raw = (value ?? '').trim();
  if (raw.isEmpty) return 'Please enter a package price';
  if (!isValidPackagePrice(raw)) return 'Invalid Format';
  return null;
}

final List<TextInputFormatter> packagePriceInputFormatters = [
  PackagePriceInputFormatter(),
  LengthLimitingTextInputFormatter(10),
];

/// Currency input formatter for package/custom price fields.
class PackagePriceInputFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final sanitized = sanitizePackagePriceInput(newValue.text);
    if (sanitized == newValue.text) return newValue;
    return TextEditingValue(
      text: sanitized,
      selection: TextSelection.collapsed(offset: sanitized.length),
    );
  }
}

/// Opens the platform date picker in calendar-only mode so the built-in
/// "Enter Date" field cannot accept unmasked junk input.
Future<DateTime?> showCalendarOnlyDatePicker(
  BuildContext context, {
  required DateTime initialDate,
  required DateTime firstDate,
  required DateTime lastDate,
}) {
  return showDatePicker(
    context: context,
    initialDate: initialDate,
    firstDate: firstDate,
    lastDate: lastDate,
    initialEntryMode: DatePickerEntryMode.calendarOnly,
  );
}

/// Maximum length of a masked `MM/DD/YYYY` field (8 digits + 2 slashes).
const int usDateFieldMaxLength = 10;

/// Blocks non-digits while typing and auto-inserts `/` for `MM/DD/YYYY`.
final List<TextInputFormatter> usDateInputFormatters = [
  FilteringTextInputFormatter.digitsOnly,
  DateInputFormatter(),
  LengthLimitingTextInputFormatter(usDateFieldMaxLength),
];

/// Masks typed digits into a `MM/DD/YYYY` calendar date as the user types.
class DateInputFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    var digits = newValue.text.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.length > 8) {
      digits = digits.substring(0, 8);
    }

    // Reject an edit as soon as it makes a completed month or day segment
    // impossible. This keeps invalid values out of the controller, rather
    // than waiting until form submission to report them.
    if (!_isValidUsDatePrefix(digits)) return oldValue;

    final buffer = StringBuffer();
    for (var i = 0; i < digits.length; i++) {
      buffer.write(digits[i]);
      // Insert separators after MM (index 1) and DD (index 3).
      if ((i == 1 || i == 3) && i != digits.length - 1) {
        buffer.write('/');
      }
    }

    final text = buffer.toString();
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}

bool _isValidUsDatePrefix(String digits) {
  if (digits.length < 2) return true;

  final month = int.tryParse(digits.substring(0, 2));
  if (month == null || month < 1 || month > 12) return false;
  if (digits.length < 4) return true;

  final day = int.tryParse(digits.substring(2, 4));
  if (day == null || day < 1 || day > 31) return false;

  // Without a complete year, February 29 remains a valid possible date.
  final year = digits.length == 8 ? int.tryParse(digits.substring(4, 8)) : 2000;
  final maxDay = DateTime(year ?? 2000, month + 1, 0).day;
  if (day > maxDay) return false;

  // Once the year is complete, reject dates such as 02/29/2025 too.
  final formatted =
      '${month.toString().padLeft(2, '0')}/'
      '${day.toString().padLeft(2, '0')}/$year';
  return digits.length < 8 || parseUsDate(formatted) != null;
}

String? validateUsDateField(
  String? value, {
  bool allowEmpty = false,
  String emptyMessage = 'Please enter a date',
  String invalidMessage = 'Please enter a valid date (MM/DD/YYYY)',
}) {
  final raw = (value ?? '').trim();
  if (raw.isEmpty) {
    return allowEmpty ? null : emptyMessage;
  }
  if (parseUsDate(raw) == null) return invalidMessage;
  return null;
}

String? validateFutureUsDateField(
  String? value, {
  String emptyMessage = 'Please enter expiration date',
  String invalidMessage = 'Please enter a valid date (MM/DD/YYYY)',
  String expiredMessage = 'Expiration date must be in the future',
}) {
  final formatError = validateUsDateField(
    value,
    emptyMessage: emptyMessage,
    invalidMessage: invalidMessage,
  );
  if (formatError != null) return formatError;

  final date = parseUsDate(value)!;
  final today = DateTime.now();
  final startOfToday = DateTime(today.year, today.month, today.day);
  if (!date.isAfter(startOfToday)) return expiredMessage;
  return null;
}

/// Parses a `MM/DD/YYYY` string into a [DateTime], or null when invalid.
DateTime? parseUsDate(String? value) {
  final raw = (value ?? '').trim();
  final match = RegExp(r'^(\d{2})/(\d{2})/(\d{4})$').firstMatch(raw);
  if (match == null) return null;
  final month = int.parse(match.group(1)!);
  final day = int.parse(match.group(2)!);
  final year = int.parse(match.group(3)!);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  final date = DateTime(year, month, day);
  // Reject rolled-over dates like 02/31/2024 -> 03/02/2024.
  if (date.year != year || date.month != month || date.day != day) return null;
  return date;
}

/// Formats a [DateTime] as `MM/DD/YYYY` for display in a date field.
String formatUsDate(DateTime date) {
  final mm = date.month.toString().padLeft(2, '0');
  final dd = date.day.toString().padLeft(2, '0');
  final yyyy = date.year.toString().padLeft(4, '0');
  return '$mm/$dd/$yyyy';
}

/// Converts a `MM/DD/YYYY` string to the `YYYY-MM-DD` format the API expects,
/// or null when the input is not a valid calendar date.
String? usDateToIso(String? value) {
  final date = parseUsDate(value);
  if (date == null) return null;
  final mm = date.month.toString().padLeft(2, '0');
  final dd = date.day.toString().padLeft(2, '0');
  final yyyy = date.year.toString().padLeft(4, '0');
  return '$yyyy-$mm-$dd';
}

class ExpiryDateInputFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    String text = newValue.text.replaceAll(RegExp(r'[^0-9]'), '');

    // Handle backspace: if the text length is less than before, do not modify the text.
    if (newValue.text.length < oldValue.text.length) {
      return newValue;
    }

    // Limit the length of the text to 4 characters
    if (text.length > 4) {
      text = text.substring(0, 4);
    }

    // Format as MM/YY after two characters
    if (text.length >= 2) {
      text = '${text.substring(0, 2)}/${text.substring(2)}';
    }

    // Ensure the cursor is always at the end
    return newValue.copyWith(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}

class CardNumberInputFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    String text = newValue.text.replaceAll(RegExp(r'[^0-9]'), '');

    if (text.length > 16) {
      text = text.substring(0, 16);
    }

    final buffer = StringBuffer();
    for (int i = 0; i < text.length; i++) {
      buffer.write(text[i]);
      final nonZeroIndex = i + 1;
      if (nonZeroIndex % 4 == 0 && nonZeroIndex != text.length) {
        buffer.write('  '); // Add space
      }
    }

    final formattedText = buffer.toString();

    return newValue.copyWith(
      text: formattedText,
      selection: TextSelection.collapsed(offset: formattedText.length),
    );
  }
}

class CustomInputFormatter extends TextInputFormatter {
  final TextEditingController padController;

  CustomInputFormatter({required this.padController});

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    String value = newValue.text;

    // Prevent the input 0 as first number
    if ((value.length == 1 &&
            int.tryParse(value) != null &&
            int.parse(value) < 1) &&
        (padController.text.isEmpty || padController.text == "0")) {
      return oldValue;
    }

    // Clean input to remove commas
    var amountText = value.replaceAll(",", "");

    // Prevent input more than 7 digits
    if (amountText.length > 7) {
      return oldValue;
    }

    // Prevent input more than two digits after the decimal
    if (amountText.contains(".")) {
      var last = amountText.split(".").last;
      if (last.length == 3) {
        return oldValue;
      }
    }

    // Prevent more than two dots
    if (value.contains("..")) {
      value = value.replaceAll("..", ".");
    }

    // Return the new formatted text
    return TextEditingValue(
      text: value,
      selection: TextSelection.collapsed(offset: value.length),
    );
  }
}

class MaxValueInputFormatter extends TextInputFormatter {
  final double max;

  MaxValueInputFormatter(this.max);

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    try {
      final double value = double.parse(newValue.text);
      if (value > max) {
        return oldValue;
      }
    } catch (e) {
      // ignore parsing error (e.g. empty string)
    }
    return newValue;
  }
}
