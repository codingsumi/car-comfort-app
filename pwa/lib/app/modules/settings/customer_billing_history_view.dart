import 'package:car_comfort/app/utils/extensions/extension.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../gen/assets.gen.dart';
import '../../network/repository/driver_payment_history_response.dart' as dph;
import '../../routes/app_pages.dart';
import '../../widgets/text.dart';
import '../../widgets/widgets.dart';
import 'customer_billing_history_controller.dart';

class CustomerBillingHistoryView extends GetView<CustomerBillingHistoryController> {
  const CustomerBillingHistoryView({super.key});

  static const Color _primaryRed = Color(0xffF2051F);
  static const Color _confirmedGreen = Color(0xff2E7D32);

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
                  Container(
                    color: context.colorScheme.scrim.withValues(alpha: 0.45),
                  ),
                  Padding(
                    padding: EdgeInsets.fromLTRB(12, top + 12, 12, 12),
                    child: Row(
                      children: [
                        InkWell(
                          onTap: Get.back,
                          borderRadius: BorderRadius.circular(20),
                          child: Assets.imagesBack.image(
                            width: 26,
                            height: 26,
                            fit: BoxFit.contain,
                          ),
                        ),
                        Expanded(
                          child: Center(
                            child: CommonText.regular(
                              'Billing History',
                              color: context.colorScheme.onPrimary,
                              size: 18,
                            ),
                          ),
                        ),
                        const SizedBox(width: 26),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Obx(
              () => Row(
                children: [
                  Expanded(
                    child: _TabPill(
                      label: 'Completed',
                      selected: controller.completedSelected.value,
                      onTap: controller.selectCompletedTab,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _TabPill(
                      label: 'Pending',
                      selected: !controller.completedSelected.value,
                      onTap: controller.selectPendingTab,
                    ),
                  ),
                ],
              ),
            ),
          ),
          Expanded(
            child: Obx(() {
              final isRefreshing = controller.isRefreshing.value;
              final isLoading = controller.isLoading.value;
              final isLoadingMore = controller.isLoadingMore.value;
              final items = controller.transactions;
              final itemCount = items.length;
              final showFullLoader =
                  !isRefreshing && isLoading && itemCount == 0;
              final listItemCount = itemCount + (isLoadingMore ? 1 : 0);

              return RefreshIndicator(
                onRefresh: controller.refreshTransactions,
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    if (showFullLoader) {
                      return ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        children: [
                          SizedBox(
                            height: constraints.maxHeight,
                            child: loader(context),
                          ),
                        ],
                      );
                    }

                    if (itemCount == 0) {
                      return ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                        children: [
                          SizedBox(
                            height: constraints.maxHeight,
                            child: Center(
                              child: CommonText.regular(
                                'No billing records yet.',
                                color: const Color(0xff6B7280),
                                size: 14,
                              ),
                            ),
                          ),
                        ],
                      );
                    }

                    return ListView.separated(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                      itemCount: listItemCount,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (context, index) {
                        if (index >= itemCount) {
                          return const Padding(
                            padding: EdgeInsets.symmetric(vertical: 16),
                            child: Center(child: CircularProgressIndicator()),
                          );
                        }
                        final item = items[index];
                        return InkWell(
                          onTap: () => _openInvoiceDetail(item),
                          borderRadius: BorderRadius.circular(12),
                          child: _BillingCard(item: item),
                        );
                      },
                    );
                  },
                ),
              );
            }),
          ),
        ],
      ),
    );
  }

  void _openInvoiceDetail(dph.Transactions item) {
    final bookingId = item.bookingId ?? item.booking?.id;
    if (bookingId == null || bookingId <= 0) return;
    Get.toNamed(
      Routes.CUSTOMER_INVOICE_DETAIL,
      arguments: {
        'bookingId': bookingId,
        'paymentAmount': CustomerBillingHistoryController.formatAmount(
          item.amount,
          item.currency,
        ),
        'paymentDateLabel': CustomerBillingHistoryController.formatDateLabel(
          item.createdAt,
        ),
        'paymentStatusLabel': CustomerBillingHistoryController.statusLabel(
          item.status,
        ),
      },
    );
  }
}

class _TabPill extends StatelessWidget {
  const _TabPill({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: selected ? CustomerBillingHistoryView._primaryRed : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected
                ? CustomerBillingHistoryView._primaryRed
                : const Color(0xffE8E8EF),
          ),
        ),
        alignment: Alignment.center,
        child: CommonText.medium(
          label,
          color: selected ? Colors.white : const Color(0xff1B1B1F),
          size: 14,
        ),
      ),
    );
  }
}

class _BillingCard extends StatelessWidget {
  const _BillingCard({required this.item});

  final dph.Transactions item;

  @override
  Widget build(BuildContext context) {
    final confirmed = CustomerBillingHistoryController.isConfirmedStatus(
      item.status,
    );
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xffE8E8EF)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: CommonText.medium(
                  CustomerBillingHistoryController.transactionTitle(item),
                  size: 15,
                  color: const Color(0xff1B1B1F),
                ),
              ),
              CommonText.bold(
                CustomerBillingHistoryController.formatAmount(
                  item.amount,
                  item.currency,
                ),
                size: 15,
                color: const Color(0xff1B1B1F),
              ),
              const SizedBox(width: 4),
              const Icon(
                Icons.chevron_right_rounded,
                size: 22,
                color: Color(0xff9CA3AF),
              ),
            ],
          ),
          const SizedBox(height: 8),
          CommonText.regular(
            CustomerBillingHistoryController.formatDateLabel(item.createdAt),
            size: 13,
            color: const Color(0xff6B7280),
          ),
          const SizedBox(height: 6),
          CommonText.medium(
            CustomerBillingHistoryController.statusLabel(item.status),
            size: 13,
            color: confirmed
                ? CustomerBillingHistoryView._confirmedGreen
                : const Color(0xffC4101F),
          ),
        ],
      ),
    );
  }
}
