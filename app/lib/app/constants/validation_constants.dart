class ValidationConstants {
  static const String emailPattern =
      r'^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$';

  /// Local phone number length (digits only, excluding country code).
  static const int phoneMaxDigits = 10;

  /// Minimum/maximum characters allowed in a vehicle license plate.
  static const int licensePlateMinLength = 2;
  static const int licensePlateMaxLength = 10;

  /// Maximum characters for a street address search / entry field.
  static const int addressMaxLength = 200;
}
