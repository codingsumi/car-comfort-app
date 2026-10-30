import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../constants/payment_method_category.dart';
import '../gen/assets.gen.dart';
import '../modules/settings/payment_methods_controller.dart';
import 'image.dart';
import 'payment_card_form_fields.dart';
import 'payment_method_type_selector.dart';
import 'web_stripe_card_field.dart'
    if (dart.library.html) 'web_stripe_card_field_web.dart';
import 'text.dart';

Widget paymentMethodBrandLeading(PaymentCardItem card) {
  final type = card.type.trim().toLowerCase();
  final wallet = (card.walletType ?? '').trim().toLowerCase();

  if (type == 'paypal') {
    return Container(
      width: 34,
      height: 22,
      decoration: BoxDecoration(
        color: const Color(0xff009CDE),
        borderRadius: BorderRadius.circular(4),
      ),
      alignment: Alignment.center,
      child: const CommonText.bold('PP', size: 8, color: Colors.white),
    );
  }
  if (type == 'link') {
    return const Icon(Icons.link_rounded, size: 22, color: Color(0xff635BFF));
  }
  if (wallet == 'apple_pay') {
    return const Icon(Icons.apple, size: 22, color: Colors.black87);
  }
  if (wallet == 'google_pay') {
    return const Icon(Icons.account_balance_wallet_outlined, size: 22);
  }

  final brand = card.brand.toLowerCase().trim();
  if (brand == 'visa') {
    return SvgImageFromAsset.square(
      Assets.imagesIcVisa,
      size: 20,
      fit: BoxFit.contain,
      matchTextDirection: false,
    );
  }
  if (brand == 'discover') {
    return SvgImageFromAsset.square(
      Assets.imagesIcDiscover,
      size: 20,
      fit: BoxFit.contain,
      matchTextDirection: false,
    );
  }
  if (brand == 'american express' || brand == 'amex' || brand == 'american') {
    return SvgImageFromAsset.square(
      Assets.imagesIcAmerican,
      size: 20,
      fit: BoxFit.contain,
      matchTextDirection: false,
    );
  }
  return SvgImageFromAsset.square(
    Assets.imagesIcMaster,
    size: 20,
    fit: BoxFit.contain,
    matchTextDirection: false,
  );
}

String paymentMethodSheetTitle(PaymentMethodCategory category) {
  if (category.usesCardForm) {
    return category == PaymentMethodCategory.debit
        ? 'Add debit card'
        : 'Add credit card';
  }
  return 'Add ${category.label}';
}

String paymentMethodSheetSubtitle(PaymentMethodCategory category) {
  if (category.usesCardForm) {
    return 'Enter your ${category.label.toLowerCase()} card details to save a payment method.';
  }
  if (category == PaymentMethodCategory.venmo) {
    return 'Continue with Venmo through Stripe. Venmo must be enabled on your Stripe account.';
  }
  if (category == PaymentMethodCategory.paypal) {
    return 'You will sign in to PayPal to save your account for checkout.';
  }
  return 'Use ${category.label} to save a payment method for faster checkout.';
}

/// Presents the add-payment panel in a bottom sheet that stays within the
/// visible area when the keyboard opens (top safe area is preserved).
Future<void> showPaymentMethodAddBottomSheet({
  required BuildContext context,
  required PaymentMethodsController controller,
  required Color accentColor,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    builder: (sheetContext) {
      final media = MediaQuery.of(sheetContext);
      final bottomInset = media.viewInsets.bottom;
      // Keep the sheet inside the area above the keyboard and below the status bar.
      final maxHeight = media.size.height - media.padding.top - bottomInset;

      return Padding(
        padding: EdgeInsets.only(bottom: bottomInset),
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: maxHeight),
          child: Container(
            decoration: const BoxDecoration(
              color: Color(0xffFAFAFA),
              borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
            ),
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(18, 14, 18, 18),
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              child: PaymentMethodAddPanel(
                controller: controller,
                accentColor: accentColor,
                onClose: () {
                  FocusManager.instance.primaryFocus?.unfocus();
                  Navigator.of(sheetContext).pop();
                },
                onSave: () async {
                  final didSave =
                      await controller.addPaymentMethodForSelectedCategory();
                  if (didSave && sheetContext.mounted) {
                    Navigator.of(sheetContext).pop();
                  }
                },
              ),
            ),
          ),
        ),
      );
    },
  );
}

/// Shared add-payment panel (type tabs + card form or wallet sheet button).
class PaymentMethodAddPanel extends StatelessWidget {
  const PaymentMethodAddPanel({
    super.key,
    required this.controller,
    required this.accentColor,
    required this.onSave,
    this.onClose,
  });

  final PaymentMethodsController controller;
  final Color accentColor;
  final Future<void> Function() onSave;
  final VoidCallback? onClose;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final category = controller.selectedCategory.value;
      final loading = controller.isActionLoading.value;

      return Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Expanded(
                child: CommonText.medium(
                  'Payment method',
                  size: 16,
                  color: Color(0xff1B1B1F),
                ),
              ),
              if (onClose != null)
                IconButton(
                  onPressed: onClose,
                  icon: const Icon(Icons.close_rounded),
                  color: const Color(0xff6B7280),
                  iconSize: 22,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(
                    minWidth: 36,
                    minHeight: 36,
                  ),
                  tooltip: 'Close',
                ),
            ],
          ),
          const SizedBox(height: 12),
          PaymentMethodTypeSelector(
            selected: category,
            onSelected: (value) => controller.selectedCategory.value = value,
            accentColor: accentColor,
          ),
          const SizedBox(height: 16),
          CommonText.medium(
            paymentMethodSheetTitle(category),
            size: 17,
            color: const Color(0xff1B1B1F),
          ),
          const SizedBox(height: 6),
          CommonText.regular(
            paymentMethodSheetSubtitle(category),
            size: 13,
            color: const Color(0xff6B7280),
          ),
          const SizedBox(height: 16),
          if (category.usesCardForm) ...[
            if (kIsWeb)
              WebStripeCardField(controller: controller)
            else
              PaymentCardFormFields(controller: controller),
            const SizedBox(height: 18),
            _SaveButton(
              label: loading ? 'Please wait...' : 'Save card',
              enabled: !loading && (kIsWeb || controller.isCardComplete.value),
              accentColor: accentColor,
              onPressed: loading ? null : onSave,
            ),
          ] else ...[
            _SaveButton(
              label: loading ? 'Please wait...' : 'Continue with ${category.label}',
              enabled: !loading,
              accentColor: accentColor,
              onPressed: loading ? null : onSave,
            ),
          ],
        ],
      );
    });
  }
}

class _SaveButton extends StatelessWidget {
  const _SaveButton({
    required this.label,
    required this.enabled,
    required this.accentColor,
    required this.onPressed,
  });

  final String label;
  final bool enabled;
  final Color accentColor;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: enabled ? onPressed : null,
        style: ElevatedButton.styleFrom(
          backgroundColor: accentColor,
          disabledBackgroundColor: accentColor.withValues(alpha: 0.45),
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
        child: Text(label),
      ),
    );
  }
}
