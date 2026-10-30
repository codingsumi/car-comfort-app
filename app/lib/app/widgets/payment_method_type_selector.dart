import 'package:flutter/material.dart';

import '../constants/payment_method_category.dart';
import 'text.dart';

/// Horizontal payment-type picker (debit, credit, wallets — no bank).
class PaymentMethodTypeSelector extends StatelessWidget {
  const PaymentMethodTypeSelector({
    super.key,
    required this.selected,
    required this.onSelected,
    this.accentColor = const Color(0xffF2051F),
  });

  final PaymentMethodCategory selected;
  final ValueChanged<PaymentMethodCategory> onSelected;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    final options = PaymentMethodCategory.visibleOptions;

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: options.map((category) {
          final isSelected = category == selected;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: InkWell(
              onTap: () => onSelected(category),
              borderRadius: BorderRadius.circular(12),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: isSelected ? accentColor : Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: isSelected ? accentColor : const Color(0xffE0E0E5),
                  ),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      _iconFor(category),
                      size: 22,
                      color: isSelected ? Colors.white : const Color(0xff4B5563),
                    ),
                    const SizedBox(height: 4),
                    CommonText.medium(
                      category.label,
                      size: 11,
                      color: isSelected ? Colors.white : const Color(0xff4B5563),
                    ),
                  ],
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  IconData _iconFor(PaymentMethodCategory category) {
    switch (category) {
      case PaymentMethodCategory.debit:
        return Icons.account_balance_wallet_outlined;
      case PaymentMethodCategory.credit:
        return Icons.credit_card_rounded;
      case PaymentMethodCategory.applePay:
        return Icons.phone_iphone_rounded;
      case PaymentMethodCategory.paypal:
        return Icons.payments_outlined;
      case PaymentMethodCategory.venmo:
        return Icons.send_rounded;
    }
  }
}
