import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../constants/app_strings.dart';
import '../modules/settings/payment_methods_controller.dart';
import '../utils/validator.dart';
import 'text_field.dart';

/// App-styled card entry (separate fields) for saving a payment method via Stripe.
class PaymentCardFormFields extends StatelessWidget {
  const PaymentCardFormFields({
    super.key,
    required this.controller,
  });

  final PaymentMethodsController controller;

  static const Color _text = Color(0xFF1B1B1F);
  static const Color _hint = Color(0xFF6B7280);
  static const Color _border = Color(0xFFE5E7EB);

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CommonTextField(
          controller: controller.cardNameController,
          labelText: AppStrings.cardName,
          hintText: AppStrings.hintCardName,
          textColor: _text,
          labelColor: _text,
          hintColor: _hint,
          borderColor: _border,
          bgColor: Colors.white,
          borderRadius: 14,
          inputAction: TextInputAction.next,
          autofillHints: const [AutofillHints.creditCardName],
          onChanged: (_) => controller.syncCardFormComplete(),
        ),
        const SizedBox(height: 14),
        CommonTextField(
          controller: controller.cardNumberController,
          labelText: AppStrings.cardNumber,
          hintText: AppStrings.hintCardNumber,
          // Use TextInputType.number (the simplest numeric form) so both iOS
          // and Android always present the numeric keypad without switching to
          // alphabetic. Avoid numberWithOptions which can be misidentified on
          // some platform versions, and omit creditCard autofillHints which
          // causes iOS to present its card-scanner overlay instead of the pad.
          keyboardType: TextInputType.number,
          autocorrect: false,
          enableSuggestions: false,
          textCapitalization: TextCapitalization.none,
          textColor: _text,
          labelColor: _text,
          hintColor: _hint,
          borderColor: _border,
          bgColor: Colors.white,
          borderRadius: 14,
          inputAction: TextInputAction.next,
          inputFormatters: [CardNumberInputFormatter()],
          onChanged: (_) => controller.syncCardFormComplete(),
        ),
        const SizedBox(height: 14),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: CommonTextField(
                controller: controller.cardExpiryController,
                labelText: AppStrings.expiryDate,
                hintText: 'MM/YY',
                keyboardType: TextInputType.number,
                autocorrect: false,
                enableSuggestions: false,
                textCapitalization: TextCapitalization.none,
                textColor: _text,
                labelColor: _text,
                hintColor: _hint,
                borderColor: _border,
                bgColor: Colors.white,
                borderRadius: 14,
                inputAction: TextInputAction.next,
                inputFormatters: [ExpiryDateInputFormatter()],
                onChanged: (_) => controller.syncCardFormComplete(),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: CommonTextField(
                controller: controller.cardCvvController,
                labelText: AppStrings.cvv,
                hintText: AppStrings.hintCvv,
                keyboardType: TextInputType.number,
                obscure: true,
                autocorrect: false,
                enableSuggestions: false,
                textCapitalization: TextCapitalization.none,
                textColor: _text,
                labelColor: _text,
                hintColor: _hint,
                borderColor: _border,
                bgColor: Colors.white,
                borderRadius: 14,
                inputAction: TextInputAction.done,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(4),
                ],
                onChanged: (_) => controller.syncCardFormComplete(),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
