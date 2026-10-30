import 'package:car_comfort/app/utils/extensions/extension.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../constants/app_strings.dart';
import '../../routes/app_pages.dart';
import '../../utils/alerts.dart';
import '../../utils/app_snackbar.dart';
import '../../utils/stripe_client_config.dart';
import '../../utils/web_navigation.dart';
import '../../widgets/button.dart';
import '../../widgets/blurred_image_screen_header.dart';
import '../../widgets/payment_method_add_panel.dart';
import '../../widgets/text.dart';
import 'payment_methods_controller.dart';

class PaymentMethodView extends StatefulWidget {
  const PaymentMethodView({super.key});

  @override
  State<PaymentMethodView> createState() => _PaymentMethodViewState();
}

class _PaymentMethodViewState extends State<PaymentMethodView> {
  static const Color _addPaymentButtonColor = Color(0xffF2051F);
  late final PaymentMethodsController controller;
  late final bool _returnOnSelect;

  @override
  void initState() {
    super.initState();
    controller = Get.find<PaymentMethodsController>();
    final args = Get.arguments;
    _returnOnSelect =
        args is Map && (args['returnOnSelect'] == true || args['selectMode'] == true);
  }

  Future<void> _openAddCardSheet(BuildContext context) async {
    if (!controller.tryOpenAddPaymentPanel()) return;
    try {
      if (!mounted) return;
      final publishableKey =
          await StripeClientConfig.ensurePublishableKeySynced();
      if (!mounted) return;
      if (publishableKey.isEmpty) {
        showAppSnackBar(
          title: 'Stripe',
          message:
              'Stripe is not configured. Set keys in admin Settings → Payments → Stripe.',
          isError: true,
        );
        return;
      }

      controller.resetCardFormState();
      await showPaymentMethodAddBottomSheet(
        context: context,
        controller: controller,
        accentColor: _addPaymentButtonColor,
      );
      controller.resetCardFormState();
    } finally {
      controller.closeAddPaymentPanel();
    }
  }

  void _confirmDeleteCard(String cardId) {
    showAlertDialog(
      AppStrings.alertTitleDeleteCard,
      content: AppStrings.alertContentDeleteCard,
      primaryText: 'Delete',
      secondaryText: 'Cancel',
      primaryBtnClr: _addPaymentButtonColor,
      primaryBtnTextClr: Colors.white,
      primaryClick: () async {
        Get.back();
        await controller.removeCard(cardId);
      },
      secondaryClick: () => Get.back(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xffFAFAFA),
      body: Column(
        children: [
          const _TopHeader(title: 'Payment Methods'),
          Expanded(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 1120),
                child: Obx(() {
              final isLoading = controller.isLoading.value;
              final canOpenAddPanel = controller.canOpenAddPaymentPanel;
              final cardItems = controller.cards.toList();

              return RefreshIndicator(
                onRefresh: () => controller.loadCards(showLoader: false),
                color: _addPaymentButtonColor,
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(14, 16, 14, 10),
                  children: [
                    CommonText.regular(
                      'Saved payment methods',
                      color: context.colorScheme.onSurfaceVariant,
                      size: 12,
                    ),
                    const SizedBox(height: 6),
                    const CommonText.regular(
                      'Add debit, credit, or Apple Pay. Bank transfer is not supported.',
                      size: 13,
                      color: Color(0xff667085),
                    ),
                    const SizedBox(height: 10),
                    AppButton(
                      label: 'Add payment method',
                      onPressed: canOpenAddPanel
                          ? () => _openAddCardSheet(context)
                          : null,
                      bgColor: _addPaymentButtonColor,
                      btnCornerRadius: 12,
                    ),
                    const SizedBox(height: 12),
                    if (cardItems.isEmpty && !isLoading)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 18,
                          vertical: 22,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: const Color(0xffE8E8EF)),
                        ),
                        child: const CommonText.regular(
                          'No payment methods found',
                          size: 13,
                          color: Color(0xff4C4C4C),
                        ),
                      ),
                    ...cardItems.map(
                      (card) => _PaymentTile(
                        title: card.title,
                        subtitle: card.expMonth != null && card.expYear != null
                            ? 'Exp ${card.expMonth}/${card.expYear}'
                            : null,
                        leading: paymentMethodBrandLeading(card),
                        selected: card.isDefault,
                        onTap: () async {
                          await controller.setDefaultCard(card.id);
                          if (_returnOnSelect && mounted) {
                            Get.back(result: true);
                          }
                        },
                        onDeleteTap: () => _confirmDeleteCard(card.id),
                        deleteIconColor: _addPaymentButtonColor,
                      ),
                    ),
                  ],
                ),
              );
                }),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TopHeader extends StatelessWidget {
  final String title;

  const _TopHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return BlurredImageScreenHeader(
      title: title,
      titleSize: 18,
      bottomRadius: 16,
      trailing: HeaderCircleIconButton(
        icon: Icons.notifications_none_rounded,
        onTap: () => toNamed(Routes.NOTIFICATIONS),
        size: 32,
        iconSize: 18,
      ),
    );
  }
}

class _PaymentTile extends StatelessWidget {
  final String title;
  final String? subtitle;
  final Widget leading;
  final bool selected;
  final VoidCallback onTap;
  final VoidCallback onDeleteTap;
  final Color deleteIconColor;

  const _PaymentTile({
    required this.title,
    this.subtitle,
    required this.leading,
    required this.selected,
    required this.onTap,
    required this.onDeleteTap,
    this.deleteIconColor = const Color(0xffF2051F),
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: context.colorScheme.onPrimary,
        border: Border.all(width: 1, color: Color(0xffE8E8EF)),
        borderRadius: BorderRadius.circular(12),
      ),
      child: ListTile(
        onTap: onTap,
        leading: SizedBox(width: 34, child: Center(child: leading)),
        title: CommonText.medium(
          title,
          size: 13,
          color: const Color(0xff4C4C4C),
        ),
        subtitle: subtitle == null
            ? null
            : CommonText.regular(
                subtitle!,
                size: 11,
                color: const Color(0xff7A7A7A),
              ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              onPressed: onDeleteTap,
              icon: Icon(
                Icons.delete_outline,
                size: 18,
                color: deleteIconColor,
              ),
            ),
            _RadioDot(selected: selected),
          ],
        ),
        dense: true,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 12,
        ),
      ),
    );
  }
}

class _RadioDot extends StatelessWidget {
  final bool selected;

  const _RadioDot({required this.selected});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 14,
      height: 14,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: const Color(0xff303135), width: 1.2),
      ),
      child: selected
          ? const Center(
              child: Icon(Icons.circle, size: 6, color: Color(0xff303135)),
            )
          : null,
    );
  }
}
