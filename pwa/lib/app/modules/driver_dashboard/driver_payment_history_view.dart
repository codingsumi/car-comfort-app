import 'package:car_comfort/app/utils/extensions/extension.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../gen/assets.gen.dart';
import '../../network/repository/driver_payment_history_response.dart' as dph;
import '../../widgets/text.dart';
import '../../widgets/widgets.dart';
import 'driver_header_back_button.dart';
import 'driver_payment_history_controller.dart';

class DriverPaymentHistoryView extends GetView<DriverPaymentHistoryController> {
  const DriverPaymentHistoryView({super.key});

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
                        const DriverHeaderBackButton(),
                        Expanded(
                          child: Center(
                            child: CommonText.regular(
                              'Payment History',
                              color: context.colorScheme.onPrimary,
                              size: 18,
                            ),
                          ),
                        ),
                        const SizedBox(width: 40),
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
                      selectedColor: _primaryRed,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _TabPill(
                      label: 'Pending',
                      selected: !controller.completedSelected.value,
                      onTap: controller.selectPendingTab,
                      selectedColor: _primaryRed,
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
                                controller.completedSelected.value
                                    ? 'No completed earnings or withdrawals yet.'
                                    : 'No pending earnings or withdrawals.',
                                size: 14,
                                color: Colors.grey.shade700,
                              ),
                            ),
                          ),
                        ],
                      );
                    }

                    return NotificationListener<ScrollNotification>(
                      onNotification: (ScrollNotification n) {
                        if (n.metrics.axis != Axis.vertical) return false;
                        if (n is! ScrollUpdateNotification &&
                            n is! ScrollEndNotification) {
                          return false;
                        }
                        final m = n.metrics;
                        if (!m.hasPixels) return false;
                        if (m.pixels >= m.maxScrollExtent - 200) {
                          controller.loadMoreTransactions();
                        }
                        return false;
                      },
                      child: ListView.builder(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                        itemCount: listItemCount,
                        itemBuilder: (context, index) {
                          if (index == itemCount) {
                            return Padding(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              child: Center(child: paginationLoader()),
                            );
                          }
                          return _HistoryCard(transaction: items[index]);
                        },
                      ),
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
}

class _TabPill extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final Color selectedColor;

  const _TabPill({
    required this.label,
    required this.selected,
    required this.onTap,
    required this.selectedColor,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? selectedColor : const Color(0xffE8E8EF),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Center(
            child: CommonText.semiBold(
              label,
              size: 15,
              color: selected ? Colors.white : const Color(0xff6F7D8F),
            ),
          ),
        ),
      ),
    );
  }
}

class _HistoryCard extends StatelessWidget {
  final dph.Transactions transaction;

  const _HistoryCard({required this.transaction});

  @override
  Widget build(BuildContext context) {
    final status = transaction.status;
    final isConfirmed =
        DriverPaymentHistoryController.isConfirmedStatus(status);
    final badgeColor = isConfirmed
        ? DriverPaymentHistoryView._confirmedGreen
        : const Color(0xffED8F00);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xffF2F2F7),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xffE8E8EF)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const CircleAvatar(
            radius: 22,
            backgroundColor: Color(0xffD9D9D9),
            child: Icon(Icons.person_rounded, color: Colors.white, size: 24),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CommonText.bold(
                  DriverPaymentHistoryController.transactionTitle(transaction),
                  size: 16,
                ),
                const SizedBox(height: 4),
                CommonText.regular(
                  DriverPaymentHistoryController.formatDateLabel(
                    transaction.createdAt,
                  ),
                  size: 13,
                  color: const Color(0xff6F7D8F),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              CommonText.bold(
                DriverPaymentHistoryController.formatAmount(
                  transaction.amount,
                  transaction.currency,
                ),
                size: 17,
              ),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: badgeColor,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: CommonText.regular(
                  DriverPaymentHistoryController.displayStatusLabel(transaction),
                  size: 11,
                  color: Colors.white,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
