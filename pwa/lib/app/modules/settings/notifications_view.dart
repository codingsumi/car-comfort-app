import 'dart:async';

import 'package:car_comfort/app/utils/extensions/extension.dart';
import 'package:flutter/material.dart';
import 'package:flutter_slidable/flutter_slidable.dart';
import 'package:get/get.dart';

import '../../gen/assets.gen.dart';
import '../../network/response/notification_list_response.dart';
import '../../utils/notification_navigation.dart';
import '../../widgets/button.dart';
import '../../widgets/blurred_image_screen_header.dart';
import '../../widgets/image.dart';
import '../../widgets/text.dart';
import 'settings_controller.dart';

class NotificationsView extends StatefulWidget {
  const NotificationsView({super.key});

  @override
  State<NotificationsView> createState() => _NotificationsViewState();
}

class _NotificationsViewState extends State<NotificationsView> {
  late final SettingsController _controller;

  @override
  void initState() {
    super.initState();
    _controller = Get.find<SettingsController>();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_controller.loadNotifications(refresh: true));
    });
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    return Scaffold(
      backgroundColor: const Color(0xffFAFAFA),
      body: Column(
        children: [
          const _TopHeader(title: 'Notifications'),
          Expanded(
            child: Obx(() {
              if (_controller.notificationsError.value.isNotEmpty) {
                return Center(
                  child: CommonText.regular(
                    _controller.notificationsError.value,
                    size: 13,
                    color: const Color(0xffD32F2F),
                    textAlign: TextAlign.center,
                  ),
                );
              }
              if (_controller.isNotificationsLoading.value &&
                  _controller.notifications.isEmpty) {
                return const Center(child: CircularProgressIndicator());
              }
              if (_controller.notifications.isEmpty) {
                return Center(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          height: 140,
                          width: 140,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(100),
                            border: BoxBorder.all(color: Colors.green),
                            color: Colors.green,
                          ),
                          child: Center(
                            child: SvgImageFromAsset.square(
                              Assets.imagesIcNotificaion,
                              color: context.colorScheme.onPrimary,
                              size: 78,
                            ),
                          ),
                        ),
                        const SizedBox(height: 20),
                        const CommonText.semiBold(
                          "You're All Up To Date",
                          size: 20,
                          color: Color(0xff3A3A3A),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 10),
                        CommonText.regular(
                          'No new notifications - come back soon',
                          size: 14,
                          color: const Color(0xff8B8B8B),
                          textAlign: TextAlign.center,
                        ).paddingOnly(right: 40, left: 40),
                      ],
                    ),
                  ),
                );
              }
              return RefreshIndicator(
                onRefresh: () => _controller.loadNotifications(refresh: true),
                child: NotificationListener<ScrollNotification>(
                  onNotification: (notification) {
                    if (notification.metrics.pixels >=
                        notification.metrics.maxScrollExtent - 120) {
                      unawaited(_controller.loadNotifications());
                    }
                    return false;
                  },
                  child: ListView.builder(
                    padding: EdgeInsets.fromLTRB(
                      16,
                      14,
                      16,
                      8 + 72 + bottomInset,
                    ),
                    itemCount:
                        _controller.notifications.length +
                        (_controller.isNotificationsLoadingMore.value ? 1 : 0),
                    itemBuilder: (context, index) {
                      if (index >= _controller.notifications.length) {
                        return const Padding(
                          padding: EdgeInsets.symmetric(vertical: 12),
                          child: Center(child: CircularProgressIndicator()),
                        );
                      }
                      return _NotificationTile(
                        item: _controller.notifications[index],
                      );
                    },
                  ),
                ),
              );
            }),
          ),
          Obx(() {
            if (_controller.notifications.isEmpty) {
              return const SizedBox.shrink();
            }
            return SafeArea(
              top: false,
              minimum: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: AppButton(
                label: 'Clear All',
                onPressed: _controller.onClearAllNotificationsPressed,
                bgColor: const Color(0xffF2051F),
                btnCornerRadius: 12,
              ),
            );
          }),
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
      topPaddingExtra: 10,
      bottomPadding: 10,
    );
  }
}

class _NotificationTile extends StatefulWidget {
  final NotificationItem item;

  const _NotificationTile({required this.item});

  @override
  State<_NotificationTile> createState() => _NotificationTileState();
}

class _NotificationTileState extends State<_NotificationTile> {
  static const Color _cardBorder = Color(0xffE8E8EF);

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final settings = Get.find<SettingsController>();
    final scheme = context.colorScheme;
    const titleColor = Color(0xff3B3B3B);
    const subtitleColor = Color(0xff8D8D8D);
    final canOpenBooking = item.bookingId != null && item.bookingId! > 0;
    // Every notification can be opened. Linked notifications navigate to the
    // related screen; welcome/general announcements open their full message.
    const canOpen = true;

    final card = Container(
      padding: const EdgeInsets.fromLTRB(12, 16, 16, 12),
      decoration: BoxDecoration(
        color: scheme.onPrimary,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(width: 1, color: _cardBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: const Color(0xffFAFAFA),
              borderRadius: BorderRadius.circular(100),
            ),
            child: const Icon(
              Icons.discount_rounded,
              size: 14,
              color: Color(0xff7B7B7B),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (!item.isRead)
                  CommonText.semiBold(item.title, size: 14, color: titleColor)
                else
                  CommonText.medium(item.title, size: 14, color: titleColor),
                if (item.usDateTimeDisplay.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  CommonText.regular(
                    item.usDateTimeDisplay,
                    size: 10,
                    color: subtitleColor,
                  ),
                ],
                const SizedBox(height: 4),
                CommonText.regular(
                  item.message,
                  size: 10,
                  color: subtitleColor,
                  maxLines: 2,
                ),
              ],
            ),
          ),
          if (canOpen)
            Icon(Icons.chevron_right_rounded, color: subtitleColor, size: 22),
        ],
      ),
    );

    final tileChild = canOpen
        ? Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: () {
                if (item.isSupportTicketNotification &&
                    item.ticketId != null &&
                    item.ticketId! > 0) {
                  NotificationNavigation.openSupportTicketDetail(
                    ticketId: item.ticketId,
                  );
                  return;
                }
                if (item.isCustomerBillingNotification) {
                  // Billing/payment notifications — open invoice detail when
                  // there is a bookingId, otherwise billing history.
                  // Promotional items never reach this branch (canOpen is false).
                  NotificationNavigation.openCustomerInvoiceDetail(
                    bookingId: item.bookingId,
                  );
                  return;
                }
                if (item.isChatMessage && canOpenBooking) {
                  NotificationNavigation.openChat(
                    bookingId: item.bookingId,
                    peerId: item.senderId,
                    peerName: item.senderName,
                    peerImage: item.senderImage,
                  );
                  return;
                }
                if (canOpenBooking) {
                  NotificationNavigation.openBookingServiceDetail(
                    bookingId: item.bookingId,
                    bookingCode: item.bookingCode,
                    serviceType: item.serviceType,
                  );
                  return;
                }
                _showNotificationDetails(context, item);
              },
              child: card,
            ),
          )
        : card;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Slidable(
        key: ValueKey('notification_${item.id}'),
        endActionPane: ActionPane(
          motion: const DrawerMotion(),
          extentRatio: 0.18,
          children: [
            SlidableAction(
              onPressed: (context) {
                unawaited(() async {
                  final ok = await settings.confirmDeleteNotification(item);
                  if (ok) await settings.deleteNotificationItem(item);
                }());
              },
              backgroundColor: Colors.transparent,
              foregroundColor: const Color(0xffF2051F),
              icon: Icons.delete_outline,
            ),
          ],
        ),
        child: tileChild,
      ),
    );
  }

  void _showNotificationDetails(BuildContext context, NotificationItem item) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: CommonText.semiBold(item.title, size: 18),
        content: SingleChildScrollView(
          child: CommonText.regular(item.message, size: 14),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const CommonText.medium('Close', size: 14),
          ),
        ],
      ),
    );
  }
}
