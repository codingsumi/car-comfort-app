import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../gen/assets.gen.dart';
import '../../network/response/booking_chat_response.dart';
import '../../widgets/text.dart';
import '../driver_dashboard/driver_header_back_button.dart';
import 'support_ticket_detail_controller.dart';

class SupportTicketDetailView extends GetView<SupportTicketDetailController> {
  const SupportTicketDetailView({super.key});

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    return Scaffold(
      backgroundColor: const Color(0xffFAFAFA),
      body: Listener(
        behavior: HitTestBehavior.translucent,
        onPointerDown: (_) => FocusManager.instance.primaryFocus?.unfocus(),
        child: Column(
          children: [
            Obx(() {
              final t = controller.ticket.value;
              return _Header(
                title: t?.subject ?? 'Support',
                subtitle: t?.ticketNumber,
                statusLabel: t?.statusLabel,
                onBack: () => Get.back(result: true),
              );
            }),
            Expanded(
              child: Obx(() {
                if (controller.isLoading.value && controller.messages.isEmpty) {
                  return const Center(
                    child: SizedBox(
                      width: 28,
                      height: 28,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  );
                }
                if (controller.errorText.value.isNotEmpty &&
                    controller.messages.isEmpty) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          CommonText.regular(
                            controller.errorText.value,
                            textAlign: TextAlign.center,
                            color: Colors.red.shade700,
                          ),
                          const SizedBox(height: 12),
                          TextButton(
                            onPressed: controller.loadTicketMeta,
                            child: const CommonText.medium('Retry', size: 14),
                          ),
                        ],
                      ),
                    ),
                  );
                }
                if (controller.messages.isEmpty) {
                  return Center(
                    child: CommonText.regular(
                      'Start the conversation with support.',
                      color: Color(0xff777777),
                    ),
                  );
                }

                return ListView.builder(
                  controller: controller.scrollController,
                  padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
                  itemCount: controller.messages.length,
                  itemBuilder: (context, index) {
                    final item = controller.messages[index];
                    final previous =
                        index > 0 ? controller.messages[index - 1] : null;
                    final showDate = previous == null ||
                        !DateUtils.isSameDay(previous.sentAt, item.sentAt);
                    return Column(
                      children: [
                        if (showDate) ...[
                          _DaySeparator(date: item.sentAt),
                          const SizedBox(height: 10),
                        ],
                        _ChatBubble(
                          message: item,
                          isMine: controller.isMine(item),
                        ),
                        const SizedBox(height: 8),
                      ],
                    );
                  },
                );
              }),
            ),
            Obx(() {
              if (!controller.canReply) {
                return Container(
                  width: double.infinity,
                  padding: EdgeInsets.fromLTRB(
                    16,
                    12,
                    16,
                    12 + MediaQuery.paddingOf(context).bottom,
                  ),
                  color: Colors.white,
                  child: const CommonText.regular(
                    'This ticket is resolved. Chat is read-only. Start a new ticket if you need more help.',
                    textAlign: TextAlign.center,
                    color: Color(0xff777777),
                    size: 13,
                  ),
                );
              }
              return AnimatedPadding(
                duration: const Duration(milliseconds: 180),
                padding: EdgeInsets.only(
                  left: 14,
                  right: 14,
                  bottom: bottomInset > 0
                      ? 8
                      : 12 + MediaQuery.paddingOf(context).bottom,
                ),
                child: Container(
                  height: 50,
                  padding: const EdgeInsets.only(left: 14, right: 6),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(25),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x12000000),
                        blurRadius: 12,
                        offset: Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: controller.messageController,
                          textInputAction: TextInputAction.send,
                          onSubmitted: (_) => controller.sendMessage(),
                          decoration: const InputDecoration(
                            hintText: 'Type a message...',
                            border: InputBorder.none,
                            isDense: true,
                          ),
                        ),
                      ),
                      InkWell(
                        onTap: controller.sendMessage,
                        borderRadius: BorderRadius.circular(22),
                        child: Container(
                          width: 40,
                          height: 40,
                          decoration: const BoxDecoration(
                            color: Color(0xffE70B1C),
                            shape: BoxShape.circle,
                          ),
                          child: controller.isSending.value
                              ? const Padding(
                                  padding: EdgeInsets.all(10),
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : const Icon(
                                  Icons.send_rounded,
                                  color: Colors.white,
                                  size: 19,
                                ),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.title,
    required this.onBack,
    this.subtitle,
    this.statusLabel,
  });

  final String title;
  final String? subtitle;
  final String? statusLabel;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return ClipRRect(
      borderRadius: const BorderRadius.vertical(bottom: Radius.circular(20)),
      child: SizedBox(
        height: top + (subtitle != null && subtitle!.isNotEmpty ? 78 : 66),
        child: Stack(
          fit: StackFit.expand,
          children: [
            Assets.imagesHomeHBg.image(fit: BoxFit.cover),
            Container(color: Colors.black.withValues(alpha: 0.45)),
            Padding(
              padding: EdgeInsets.fromLTRB(14, top + 12, 14, 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  DriverHeaderBackButton(onTap: onBack),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        CommonText.regular(
                          title,
                          color: Colors.white,
                          size: 15,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (subtitle != null && subtitle!.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          CommonText.regular(
                            subtitle!,
                            color: Colors.white70,
                            size: 11,
                          ),
                        ],
                        if (statusLabel != null && statusLabel!.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          CommonText.regular(
                            statusLabel!,
                            color: Colors.white60,
                            size: 10,
                          ),
                        ],
                      ],
                    ),
                  ),
                  const Icon(
                    Icons.support_agent_rounded,
                    color: Colors.white70,
                    size: 28,
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

class _ChatBubble extends StatelessWidget {
  const _ChatBubble({required this.message, required this.isMine});

  final BookingChatMessage message;
  final bool isMine;

  @override
  Widget build(BuildContext context) {
    final timeText = MaterialLocalizations.of(
      context,
    ).formatTimeOfDay(TimeOfDay.fromDateTime(message.sentAt));

    return Align(
      alignment: isMine ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * 0.74,
        ),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: isMine ? const Color(0xffE70B1C) : Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: isMine ? null : Border.all(color: const Color(0xffE8E8EF)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Flexible(
                child: CommonText.regular(
                  message.message,
                  size: 13,
                  color: isMine ? Colors.white : const Color(0xff4D4D4D),
                ),
              ),
              const SizedBox(width: 8),
              CommonText.regular(
                timeText,
                size: 10,
                color: isMine ? Colors.white54 : const Color(0xff9A9A9A),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DaySeparator extends StatelessWidget {
  const _DaySeparator({required this.date});

  final DateTime date;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final yesterday = DateTime(now.year, now.month, now.day - 1);
    final dayOnly = DateTime(date.year, date.month, date.day);
    final label = DateUtils.isSameDay(date, now)
        ? 'Today'
        : DateUtils.isSameDay(dayOnly, yesterday)
        ? 'Yesterday'
        : '${date.day}/${date.month}/${date.year}';

    return Center(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: const Color(0xffE6E6E6),
          borderRadius: BorderRadius.circular(10),
        ),
        child: CommonText.regular(
          label,
          size: 12,
          color: const Color(0xff777777),
        ),
      ),
    );
  }
}
