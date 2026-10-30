import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../gen/assets.gen.dart';
import '../../routes/app_pages.dart';
import '../../utils/app_snackbar.dart';
import '../../utils/extensions/extension.dart';
import '../../utils/stripe_client_config.dart';
import '../../widgets/button.dart';
import '../../widgets/payment_method_add_panel.dart';
import '../../widgets/text.dart';
import '../settings/payment_methods_controller.dart';
import 'driver_header_back_button.dart';

class DriverPaymentMethodView extends StatefulWidget {
  const DriverPaymentMethodView({super.key});

  @override
  State<DriverPaymentMethodView> createState() => _DriverPaymentMethodViewState();
}

class _DriverPaymentMethodViewState extends State<DriverPaymentMethodView> {
  static const Color _accent = Color(0xffF2051F);
  late final PaymentMethodsController controller;

  @override
  void initState() {
    super.initState();
    controller = Get.find<PaymentMethodsController>();
  }

  Future<void> _openAddPaymentSheet(BuildContext context) async {
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
        accentColor: _accent,
      );
      controller.resetCardFormState();
    } finally {
      controller.closeAddPaymentPanel();
    }
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;

    return Scaffold(
      backgroundColor: const Color(0xffFAFAFA),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ClipRRect(
            borderRadius: const BorderRadius.vertical(bottom: Radius.circular(18)),
            child: SizedBox(
              height: top + 84,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Assets.imagesHomeHBg.image(fit: BoxFit.cover),
                  Container(color: Colors.black.withValues(alpha: 0.45)),
                  Padding(
                    padding: EdgeInsets.fromLTRB(12, top + 12, 12, 12),
                    child: Row(
                      children: [
                        const DriverHeaderBackButton(),
                        const Expanded(
                          child: Center(
                            child: CommonText.regular(
                              'Payment Methods',
                              color: Colors.white,
                              size: 18,
                            ),
                          ),
                        ),
                        Material(
                          color: Colors.white,
                          shape: const CircleBorder(),
                          child: InkWell(
                            onTap: () => Get.toNamed(Routes.DRIVER_NOTIFICATIONS),
                            customBorder: const CircleBorder(),
                            child: const SizedBox(
                              width: 40,
                              height: 40,
                              child: Icon(
                                Icons.notifications_none_rounded,
                                color: Colors.black87,
                                size: 22,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          Expanded(
            child: Obx(() {
              final isLoading = controller.isLoading.value;
              final canOpenAddPanel = controller.canOpenAddPaymentPanel;
              final cardItems = controller.cards.toList();

              return ListView(
                padding: const EdgeInsets.fromLTRB(14, 16, 14, 10),
                children: [
                  CommonText.regular(
                    'Saved payment methods',
                    color: context.colorScheme.onSurfaceVariant,
                    size: 12,
                  ),
                  const SizedBox(height: 6),
                  const CommonText.regular(
                    'Add debit, credit, or Apple Pay.',
                    size: 13,
                    color: Color(0xff667085),
                  ),
                  const SizedBox(height: 10),
                  AppButton(
                    label: 'Add payment method',
                    onPressed: canOpenAddPanel
                        ? () => _openAddPaymentSheet(context)
                        : null,
                    bgColor: _accent,
                    btnCornerRadius: 12,
                  ),
                  const SizedBox(height: 10),
                  AppButton(
                    label: isLoading ? 'Refreshing...' : 'Refresh',
                    onPressed: isLoading ? null : controller.loadCards,
                    bgColor: const Color(0xff232323),
                    btnCornerRadius: 12,
                  ),
                  const SizedBox(height: 12),
                  if (cardItems.isEmpty && !isLoading)
                    const CommonText.regular(
                      'No payment methods found',
                      size: 13,
                      color: Color(0xff4C4C4C),
                    ),
                  ...cardItems.map(
                    (card) => _PaymentTile(
                      title: card.title,
                      subtitle: card.type == 'card' &&
                              card.expMonth != null &&
                              card.expYear != null
                          ? 'Exp ${card.expMonth}/${card.expYear}'
                          : null,
                      leading: paymentMethodBrandLeading(card),
                      selected: card.isDefault,
                      onTap: () => controller.setDefaultCard(card.id),
                      onDeleteTap: () => controller.removeCard(card.id),
                    ),
                  ),
                ],
              );
            }),
          ),
        ],
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

  const _PaymentTile({
    required this.title,
    this.subtitle,
    required this.leading,
    required this.selected,
    required this.onTap,
    required this.onDeleteTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: context.colorScheme.onPrimary,
        border: Border.all(width: 1, color: const Color(0xffE8E8EF)),
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
              icon: const Icon(Icons.delete_outline, size: 18),
            ),
            _RadioDot(selected: selected),
          ],
        ),
        dense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
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
      width: 22,
      height: 22,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: Colors.black87, width: 2),
        color: selected ? Colors.black87 : Colors.transparent,
      ),
      child: selected
          ? const Center(
              child: Icon(Icons.circle, size: 10, color: Colors.white),
            )
          : null,
    );
  }
}
