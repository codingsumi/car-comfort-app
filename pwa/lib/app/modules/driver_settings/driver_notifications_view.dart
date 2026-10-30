import 'dart:async';

import 'package:car_comfort/app/utils/extensions/extension.dart';
import 'package:car_comfort/app/widgets/image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_slidable/flutter_slidable.dart';
import 'package:get/get.dart';

import '../../gen/assets.gen.dart';
import '../../network/response/notification_list_response.dart';
import '../../utils/notification_navigation.dart';
import '../../widgets/text.dart';
import '../driver_dashboard/driver_header_back_button.dart';
import 'driver_settings_controller.dart';

class DriverNotificationsView extends StatefulWidget {
  const DriverNotificationsView({super.key});

  @override
  State<DriverNotificationsView> createState() =>
      _DriverNotificationsViewState();
}

class _DriverNotificationsViewState extends State<DriverNotificationsView> {
  late final DriverSettingsController _controller;

  @override
  void initState() {
    super.initState();
    _controller = Get.find<DriverSettingsController>();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_controller.loadNotifications(refresh: true));
    });
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    final bottomInset = MediaQuery.paddingOf(context).bottom;

    return Scaffold(
      backgroundColor: const Color(0xffFAFAFA),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ClipRRect(
            borderRadius: const BorderRadius.vertical(
              bottom: Radius.circular(18),
            ),
            child: SizedBox(
              height: top + 84,
              width: double.infinity,
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
                        const SizedBox(width: 10),
                        const Expanded(
                          child: Align(
                            alignment: Alignment.centerLeft,
                            child: CommonText.regular(
                              'Notifications',
                              color: Colors.white,
                              size: 18,
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
              if (_controller.isNotificationsLoading.value) {
                return const Center(child: CircularProgressIndicator());
              }
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
                    padding: EdgeInsets.fromLTRB(16, 14, 16, 16 + bottomInset),
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
                      final item = _controller.notifications[index];
                      return _DriverNotificationTile(item: item);
                    },
                  ),
                ),
              );
            }),
          ),
        ],
      ),
    );
  }
}

class _DriverNotificationTile extends StatefulWidget {
  const _DriverNotificationTile({required this.item});

  final NotificationItem item;

  @override
  State<_DriverNotificationTile> createState() =>
      _DriverNotificationTileState();
}

class _DriverNotificationTileState extends State<_DriverNotificationTile> {
  static const Color _cardBorder = Color(0xffE8E8EF);

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final driverSettings = Get.find<DriverSettingsController>();
    final scheme = context.colorScheme;
    const titleColor = Color(0xff3A3A3A);
    const subtitleColor = Color(0xff8B8B8B);
    final canOpenBooking = item.bookingId != null && item.bookingId! > 0;
    final canOpenSupport =
        item.isSupportTicketNotification &&
        item.ticketId != null &&
        item.ticketId! > 0;
    final canOpen = canOpenBooking ||
        canOpenSupport ||
        item.isDriverProfileApprovalStatus ||
        item.isDriverWalletNotification;

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
              Icons.notifications_active_outlined,
              size: 16,
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
                  size: 11,
                  color: subtitleColor,
                  maxLines: 3,
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
                if (item.isDriverProfileApprovalStatus) {
                  NotificationNavigation.openDriverProfileApprovalStatus(
                    item.kind,
                  );
                  return;
                }
                if (item.isDriverWalletNotification) {
                  NotificationNavigation.openDriverWallet();
                  return;
                }
                if (item.isSupportTicketNotification) {
                  NotificationNavigation.openSupportTicketDetail(
                    ticketId: item.ticketId,
                  );
                  return;
                }
                if (item.isChatMessage) {
                  NotificationNavigation.openChat(
                    bookingId: item.bookingId,
                    peerId: item.senderId,
                    peerName: item.senderName,
                    peerImage: item.senderImage,
                  );
                  return;
                }
                NotificationNavigation.openBookingServiceDetail(
                  bookingId: item.bookingId,
                  bookingCode: item.bookingCode,
                  serviceType: item.serviceType,
                );
              },
              child: card,
            ),
          )
        : card;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Slidable(
        key: ValueKey('driver_notification_${item.id}'),
        endActionPane: ActionPane(
          motion: const DrawerMotion(),
          extentRatio: 0.18,
          children: [
            SlidableAction(
              onPressed: (context) {
                unawaited(() async {
                  final ok = await driverSettings.confirmDeleteNotification(
                    item,
                  );
                  if (ok) await driverSettings.deleteNotificationItem(item);
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
}
