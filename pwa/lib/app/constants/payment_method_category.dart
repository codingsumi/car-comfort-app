import 'package:flutter/foundation.dart';

/// Checkout / wallet options shown in the payment method picker (bank excluded).
enum PaymentMethodCategory {
  debit,
  credit,
  applePay,
  paypal,
  venmo;

  String get apiCategory {
    switch (this) {
      case PaymentMethodCategory.debit:
        return 'debit';
      case PaymentMethodCategory.credit:
        return 'credit';
      case PaymentMethodCategory.applePay:
        return !kIsWeb && defaultTargetPlatform == TargetPlatform.android
            ? 'google_pay'
            : 'apple_pay';
      case PaymentMethodCategory.paypal:
        return 'paypal';
      case PaymentMethodCategory.venmo:
        return 'venmo';
    }
  }

  String get label {
    switch (this) {
      case PaymentMethodCategory.debit:
        return 'Debit';
      case PaymentMethodCategory.credit:
        return 'Credit';
      case PaymentMethodCategory.applePay:
        return !kIsWeb && defaultTargetPlatform == TargetPlatform.android
            ? 'Google Pay'
            : 'Apple Pay';
      case PaymentMethodCategory.paypal:
        return 'PayPal';
      case PaymentMethodCategory.venmo:
        return 'Venmo';
    }
  }

  bool get usesCardForm =>
      this == PaymentMethodCategory.debit || this == PaymentMethodCategory.credit;

  bool get usesPaymentSheet => !usesCardForm;

  /// Wallet types hidden until Stripe/backend support is enabled for them.
  static const Set<PaymentMethodCategory> _hiddenOptions = {
    PaymentMethodCategory.paypal,
    PaymentMethodCategory.venmo,
  };

  static List<PaymentMethodCategory> get visibleOptions {
    return PaymentMethodCategory.values.where((category) {
      if (_hiddenOptions.contains(category)) return false;
      // Apple Pay / Google Pay use the native Stripe PaymentSheet and are not
      // part of the initial browser payment flow.
      if (kIsWeb && category == PaymentMethodCategory.applePay) return false;
      return true;
    }).toList();
  }
}
