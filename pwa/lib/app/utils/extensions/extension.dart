import 'package:flutter/material.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:fluttertoast/fluttertoast.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';

import '../../theme/theme.dart';
import '../alerts.dart';
import '../pref.dart';

part 'data_type.dart';

extension $StringExtension on String {
  String toFormattedPrice() {
    int number = double.parse(this).toInt();
    if (number > -1000 && number < 1000) return number.toString();
    final String digits = number.abs().toString();
    final StringBuffer result = StringBuffer(number < 0 ? '-' : '');
    final int maxDigitIndex = digits.length - 1;
    for (int i = 0; i <= maxDigitIndex; i += 1) {
      result.write(digits[i]);
      if (i < maxDigitIndex && (maxDigitIndex - i) % 3 == 0) result.write(',');
    }
    return "$result.${(double.parse(this) - number).toStringAsFixed(2).substring(2)}";
  }

  String toDollarPrice() {
    // Remove any non-numeric characters except the decimal point
    String cleaned = replaceAll(RegExp(r'[^0-9.]'), '');

    // Parse the string to a double and format it
    double value = double.tryParse(cleaned) ?? 0.0;
    return '\$${value.toStringAsFixed(2)}';
  }

  String toTitleCase() {
    final String trimmedString = trim();
    if (trimmedString.isEmpty) return this;

    return trimmedString.split(RegExp(r'\s+')).map((word) {
      if (word.isEmpty) return '';

      // Handle hyphenated words
      return word.split('-').map((part) {
        if (part.isEmpty) return '';
        if (part.length == 1) return part.toUpperCase();
        return '${part[0].toUpperCase()}${part.substring(1).toLowerCase()}';
      }).join('-');
    }).join(' ');
  }
}


extension $BuildContextExtension on BuildContext {
  ThemeData get theme => Theme.of(this);

  bool get isDarkMode => theme.brightness == Brightness.dark;

  ColorScheme get colorScheme => isDarkMode ? darkColorScheme : lightColorScheme;

  MediaQueryData get mediaQuery => MediaQuery.of(this);

  EdgeInsets get mediaQueryPadding => MediaQuery.of(this).padding;

  double get height => mediaQuery.size.height;

  double get width => mediaQuery.size.width;

  double get topPadding => mediaQuery.padding.top;

  double get bottomPadding => mediaQuery.padding.bottom;

  double get topInset => mediaQuery.viewInsets.top;

  double get bottomInset => mediaQuery.viewInsets.bottom;

  Object? get args => ModalRoute.of(this)?.settings.arguments;

  // TextDirection get textDirection => Directionality.of(this);

  void hideKeyboard() {
    final currentFocus = FocusScope.of(this);
    if (!currentFocus.hasPrimaryFocus && currentFocus.hasFocus) {
      FocusManager.instance.primaryFocus?.unfocus();
    }
  }
}

extension $NullableStringExtension on String? {
  bool get isNullOrEmpty => this == null || this!.trim().isEmpty;

  int toInt() {
    return this == null ? 0 : int.tryParse(this!) ?? 0;
  }

  double toDouble() {
    return this == null ? 0 : double.tryParse(this!) ?? 0.0;
  }
}

extension $DateTimeExtension on DateTime {
  String toLocalString([String format = "yyyy-MM-dd HH:mm:ss"]) {
    var strDate = DateFormat(format).format(toLocal());
    return strDate;
  }

  String toUtcString([String format = "yyyy-MM-dd HH:mm:ss"]) {
    var strDate = DateFormat(format).format(toUtc());
    return strDate;
  }

  bool get isToday {
    var now = DateTime.now();
    return day == now.day && month == now.month && year == now.year;
  }

  bool isSameDay(DateTime dateTime) {
    return day == dateTime.day && month == dateTime.month && year == dateTime.year;
  }

  String toDisplayDate([String format = "MMM yyyy, hh:mm a"]) {
    var strDate = DateFormat(format).format(toLocal());
    return strDate;
  }
}

NumberFormat formatter = NumberFormat.decimalPatternDigits(
  locale: 'en_us',
  decimalDigits: 2,
);

bool? isResponseBlank(dynamic value) {
  if (value is String) {
    return value.toString().trim().isEmpty;
  }
  if (value is Iterable || value is Map) {
    return value.isEmpty as bool?;
  }
  return false;
}

String convertDate(String inputDate) {
  DateTime date = DateTime.parse(inputDate);
  DateFormat formatter = DateFormat('MM/dd/yy hh:mm a');
  String formattedDate = formatter.format(date);
  return formattedDate;
}

Future<String> getTimeZone() async {
  var timeZone = await FlutterTimezone.getLocalTimezone();
  Prefs().putTimeZoneData(Prefs.timezone, timeZone.identifier);
  log("EXTENSIONS", "TIMEZONE : $timeZone");
  return timeZone.identifier;
}

String getTimeZoneOffset() {
  var val = "";
  var offset = DateTime.now().timeZoneOffset;
  var hours = offset.inHours > 0 ? offset.inHours : 1; // for fixing divide by 0

  if (!offset.isNegative) {
    val = "${offset.inHours.toString().padLeft(2, '0')}:${(offset.inMinutes % (hours * 60)).toString().padLeft(2, '0')}";
  } else {
    val = "${(-offset.inHours).toString().padLeft(2, '0')}:${(offset.inMinutes % (hours * 60)).toString().padLeft(2, '0')}";
  }
  log("EXTENSIONS", "OFFSET -> $val");

  return val;
}

String formatDate(String date, {String? inputFormat = "dd-MM-yyyy", String? outputFormat = "dd MMM, yyyy"}) {
  DateFormat originalFormat = DateFormat(inputFormat);
  DateTime parsedDate = originalFormat.parse(date);
  DateFormat desiredFormat = DateFormat(outputFormat);
  return desiredFormat.format(parsedDate);
}

DateTime getDate(DateTime d) => DateTime(d.year, d.month, d.day);

bool isSameDate(DateTime date1, DateTime date2) {
  if (date2 == date1) {
    return true;
  }
  return date1.month == date2.month && date1.year == date2.year && date1.day == date2.day;
}

Future<void> showToast(String value, {bool isError = false}) {
  return Fluttertoast.showToast(
      msg: value,
      toastLength: Toast.LENGTH_SHORT,
      gravity: ToastGravity.TOP,
      timeInSecForIosWeb: 3,
      backgroundColor: isError ? Get.context?.colorScheme.error : Get.context?.colorScheme.primary,
      textColor: Get.context?.colorScheme.onPrimary,
      fontSize: 14.0);
}

String printDuration(Duration duration) {
  String negativeSign = duration.isNegative ? '-' : '';
  String twoDigits(int n) => n.toString().padLeft(2, "0");
  String twoDigitMinutes = twoDigits(duration.inMinutes.remainder(60).abs());
  String twoDigitSeconds = twoDigits(duration.inSeconds.remainder(60).abs());
  return "$negativeSign${twoDigits(duration.inHours)}:$twoDigitMinutes:$twoDigitSeconds";
}

// Create a number formatter with two decimal places
var numberFormatter = NumberFormat.currency(
  locale: 'en_US',
  symbol: '\$',
  decimalDigits:0,
);
