import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../gen/assets.gen.dart';
import '../../routes/app_pages.dart';
import '../../widgets/text.dart';
import '../driver_dashboard/driver_header_back_button.dart';
import '../../network/response/support_ticket_response.dart';
import 'support_tickets_controller.dart';

class SupportTicketsListView extends GetView<SupportTicketsController> {
  const SupportTicketsListView({super.key});

  static const Color _subtitleGrey = Color(0xff8B8B8B);
  static const Color _border = Color(0xffE8E8EF);

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    return Scaffold(
      backgroundColor: const Color(0xffFAFAFA),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Get.toNamed(Routes.CREATE_SUPPORT_TICKET),
        backgroundColor: const Color(0xffE70B1C),
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: const CommonText.medium('New ticket', size: 14, color: Colors.white),
      ),
      body: Column(
        children: [
          _Header(onBack: () => Get.back()),
          Expanded(
            child: Obx(() {
              if (controller.isLoading.value && controller.tickets.isEmpty) {
                return const Center(
                  child: SizedBox(
                    width: 28,
                    height: 28,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                );
              }

              final err = controller.errorMessage.value;
              if (err != null && err.isNotEmpty && controller.tickets.isEmpty) {
                return ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(24),
                  children: [
                    CommonText.regular(
                      err,
                      size: 14,
                      color: Colors.red.shade700,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    Center(
                      child: TextButton(
                        onPressed: controller.refreshTickets,
                        child: const CommonText.medium('Try again', size: 14),
                      ),
                    ),
                  ],
                );
              }

              if (controller.tickets.isEmpty) {
                return RefreshIndicator(
                  onRefresh: controller.refreshTickets,
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: EdgeInsets.fromLTRB(24, 48, 24, 80 + bottomInset),
                    children: const [
                      Icon(
                        Icons.confirmation_number_outlined,
                        size: 56,
                        color: _subtitleGrey,
                      ),
                      SizedBox(height: 16),
                      CommonText.semiBold(
                        'No support tickets yet',
                        size: 16,
                        textAlign: TextAlign.center,
                        color: Color(0xff3A3A3A),
                      ),
                      SizedBox(height: 8),
                      CommonText.regular(
                        'Tap New ticket to contact our support team.',
                        size: 13,
                        textAlign: TextAlign.center,
                        color: _subtitleGrey,
                      ),
                    ],
                  ),
                );
              }

              return RefreshIndicator(
                onRefresh: controller.refreshTickets,
                child: ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: EdgeInsets.fromLTRB(16, 12, 16, 88 + bottomInset),
                  itemCount: controller.tickets.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    final item = controller.tickets[index];
                    return _TicketTile(
                      ticket: item,
                      onTap: () {
                        final id = item.id;
                        if (id == null) return;
                        Get.toNamed(
                          Routes.SUPPORT_TICKET_DETAIL,
                          arguments: {'ticketId': id},
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
}

class _Header extends StatelessWidget {
  const _Header({required this.onBack});

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return ClipRRect(
      borderRadius: const BorderRadius.vertical(bottom: Radius.circular(20)),
      child: SizedBox(
        height: top + 66,
        child: Stack(
          fit: StackFit.expand,
          children: [
            Assets.imagesHomeHBg.image(fit: BoxFit.cover),
            Container(color: Colors.black.withValues(alpha: 0.45)),
            Padding(
              padding: EdgeInsets.fromLTRB(14, top + 12, 14, 8),
              child: Row(
                children: [
                  DriverHeaderBackButton(onTap: onBack),
                  const SizedBox(width: 10),
                  const Expanded(
                    child: CommonText.regular(
                      'My support tickets',
                      color: Colors.white,
                      size: 16,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TicketTile extends StatelessWidget {
  const _TicketTile({required this.ticket, required this.onTap});

  final SupportTicketSummary ticket;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final preview = (ticket.lastMessagePreview ?? '').trim();
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: SupportTicketsListView._border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: CommonText.semiBold(
                      ticket.subject ?? 'Support ticket',
                      size: 14,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  _StatusChip(label: ticket.statusLabel),
                ],
              ),
              if (ticket.ticketNumber != null &&
                  ticket.ticketNumber!.isNotEmpty) ...[
                const SizedBox(height: 4),
                CommonText.regular(
                  ticket.ticketNumber!,
                  size: 11,
                  color: SupportTicketsListView._subtitleGrey,
                ),
              ],
              if (preview.isNotEmpty) ...[
                const SizedBox(height: 8),
                CommonText.regular(
                  preview,
                  size: 12,
                  color: SupportTicketsListView._subtitleGrey,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
              if (ticket.updatedDisplay.isNotEmpty) ...[
                const SizedBox(height: 6),
                CommonText.regular(
                  ticket.updatedDisplay,
                  size: 10,
                  color: SupportTicketsListView._subtitleGrey,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xffF5F5F8),
        borderRadius: BorderRadius.circular(8),
      ),
      child: CommonText.medium(label, size: 10, color: const Color(0xff5E5E5E)),
    );
  }
}
