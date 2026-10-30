import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../network/response/booking_chat_response.dart';
import '../../widgets/blurred_image_screen_header.dart';
import '../../widgets/text.dart';
import 'booking_chat_controller.dart';

class ChatView extends GetView<BookingChatController> {
  const ChatView({super.key});

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
            BlurredImageScreenHeader(
              title: '',
              backgroundFit: BoxFit.fill,
              titleWidget: Obx(() {
                final image = controller.peerImage.value.trim();
                return SizedBox(
                  width: double.infinity,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.start,
                    children: [
                      CircleAvatar(
                        radius: 18,
                        backgroundColor: Colors.white24,
                        backgroundImage: image.isNotEmpty
                            ? NetworkImage(image)
                            : null,
                        child: image.isEmpty
                            ? const Icon(
                                Icons.person_rounded,
                                color: Colors.white,
                              )
                            : null,
                      ),
                      const SizedBox(width: 10),
                      Flexible(
                        child: CommonText.medium(
                          controller.peerName.value,
                          color: Colors.white,
                          size: 18,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ),
            Expanded(
              child: Obx(() {
                if (controller.isLoading.value) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (controller.errorText.value.isNotEmpty) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: CommonText.regular(
                        controller.errorText.value,
                        textAlign: TextAlign.center,
                        color: Colors.red,
                      ),
                    ),
                  );
                }
                if (controller.messages.isEmpty) {
                  return const Center(
                    child: CommonText.regular(
                      'No messages yet.',
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
                    final previous = index > 0
                        ? controller.messages[index - 1]
                        : null;
                    final showDateSeparator =
                        previous == null ||
                        !DateUtils.isSameDay(previous.sentAt, item.sentAt);
                    return Column(
                      children: [
                        if (showDateSeparator) ...[
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
            Obx(
              () => controller.isReadOnly.value
                  ? Container(
                      width: double.infinity,
                      padding: EdgeInsets.fromLTRB(
                        16,
                        12,
                        16,
                        12 + MediaQuery.paddingOf(context).bottom,
                      ),
                      color: Colors.white,
                      child: const CommonText.regular(
                        'Booking completed. Chat transcript is read-only.',
                        textAlign: TextAlign.center,
                        color: Color(0xff777777),
                        size: 13,
                      ),
                    )
                  : AnimatedPadding(
                      duration: const Duration(milliseconds: 180),
                      curve: Curves.easeOut,
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
                                  hintText: 'Type a message ...',
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
            color: isMine ? const Color(0xff2C2C2E) : const Color(0xffEEEEEE),
            borderRadius: BorderRadius.circular(14),
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
