import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../gen/assets.gen.dart';
import '../../routes/app_pages.dart';
import '../../widgets/booking_status_chip.dart';
import '../../widgets/button.dart';
import '../../widgets/image.dart';
import '../../widgets/text.dart';
import '../../widgets/widgets.dart';
import 'driver_dashboard_controller.dart';
import '../dashboard/dashboard_controller.dart' show BookingItem;
import '../../utils/extensions/extension.dart';

/// Driver bookings tab — layout aligned with customer [MyBookingsView]; adds **Accept** for confirmed rows.
class DriverBookingsView extends GetView<DriverDashboardController> {
  const DriverBookingsView({super.key});

  static const Color _cardRed = Color(0xffE70B1C);
  static const Color _cardBorder = Color(0xffE8E8EF);
  static const Color _detailsBg = Color(0xffF4F4F6);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xffFAFAFA),
      body: Column(
        children: [
          _BookingsHeader(
            controller: controller,
            onNotifications: () {
              unawaited(
                (Get.toNamed(Routes.DRIVER_NOTIFICATIONS) ?? Future.value())
                    .then((_) => controller.refreshBookings()),
              );
            },
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => controller.refreshBookings(),
              child: Obx(() {
                final isRefreshing = controller.isBookingsRefreshing.value;
                final isLoading = controller.isBookingsLoading.value;
                final isLoadingMore = controller.isBookingsLoadingMore.value;
                final bookings = controller.bookings;
                final bookingCount = bookings.length;
                controller.bookingsInitialLoadDone.value;
                final showFullLoader =
                    !isRefreshing &&
                    isLoading &&
                    bookingCount == 0 &&
                    !controller.bookingsInitialLoadDone.value;
                final listItemCount = bookingCount + (isLoadingMore ? 1 : 0);

                return LayoutBuilder(
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

                    if (bookingCount == 0) {
                      return ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
                        children: [
                          SizedBox(
                            height: constraints.maxHeight,
                            child: Center(
                              child: CommonText.regular(
                                'No bookings found.',
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
                          controller.loadMoreBookings();
                        }
                        return false;
                      },
                      child: ListView.builder(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                        itemCount: listItemCount,
                        itemBuilder: (_, index) {
                          if (index == bookingCount) {
                            return Padding(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              child: Center(child: paginationLoader()),
                            );
                          }
                          final item = bookings[index];
                          return _DriverBookingCard(
                            item: item,
                            showAccept: false,
                            onAccept: () =>
                                controller.acceptDriverBooking(item.id),
                            onViewDetails: () {
                              unawaited(
                                (Get.toNamed(
                                          Routes.DRIVER_SERVICE_DETAIL,
                                          arguments: {
                                            'bookingId': item.id,
                                            'status': item.lifecycleStatus.isNotEmpty
                                                ? item.lifecycleStatus
                                                : item.status,
                                            'bookingCode': item.id.toString(),
                                            'customerName': item.title,
                                            'customerAvatarUrl':
                                                item.driverAvatarUrl,
                                            'amount': item.amount,
                                            'service': item.service,
                                            'serviceType': item.serviceTypeSlug,
                                            'packageName': item.packageName,
                                            'packageId': item.packageId,
                                            'customPackageName': item.customPackageName,
                                            'scheduleType': item.scheduleType,
                                            'serviceDurationMinutes':
                                                item.serviceDurationMinutes,
                                            'vehicleChargeLimit':
                                                item.vehicleChargeLimit,
                                            'currentBatteryCharge':
                                                item.currentBatteryCharge,
                                            'currentBatteryStatus':
                                                item.currentBatteryStatus,
                                            'currentBatteryStatusLabel':
                                                item.currentBatteryStatusLabel,
                                            'distanceLabel': item.distanceLabel,
                                            'locationAddress':
                                                item.locationAddress,
                                            'isDriverAssigned':
                                                item.isDriverAssigned,
                                          },
                                        ) ??
                                        Future.value())
                                    .then((_) => controller.refreshBookings()),
                              );
                            },
                          );
                        },
                      ),
                    );
                  },
                );
              }),
            ),
          ),
        ],
      ),
    );
  }
}

class _BookingsHeader extends StatelessWidget {
  final DriverDashboardController controller;
  final VoidCallback onNotifications;

  const _BookingsHeader({
    required this.controller,
    required this.onNotifications,
  });

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return ClipRRect(
      borderRadius: const BorderRadius.vertical(bottom: Radius.circular(18)),
      child: SizedBox(
        height: top + 84,
        child: Stack(
          fit: StackFit.expand,
          children: [
            Assets.imagesHomeHBg.image(fit: BoxFit.cover),
            Container(color: Colors.black.withValues(alpha: 0.45)),
            Padding(
              padding: EdgeInsets.fromLTRB(20, top + 16, 20, 12),
              child: Row(
                children: [
                  const Expanded(
                    child: CommonText.regular(
                      'My Bookings',
                      color: Colors.white,
                      size: 18,
                    ),
                  ),
                  Obx(
                    () => _HeaderFilterButton(
                      selectedValue: controller.bookingsFilter.value,
                      selectedLabel: controller.bookingsFilterLabel,
                      onSelected: controller.setBookingsFilter,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Material(
                    color: Colors.white,
                    shape: const CircleBorder(),
                    child: InkWell(
                      onTap: onNotifications,
                      customBorder: const CircleBorder(),
                      child: const SizedBox(
                        width: 36,
                        height: 36,
                        child: Icon(
                          Icons.notifications_none_rounded,
                          color: Colors.black87,
                          size: 20,
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
    );
  }
}

class _HeaderFilterButton extends StatelessWidget {
  const _HeaderFilterButton({
    required this.selectedValue,
    required this.selectedLabel,
    required this.onSelected,
  });

  final String selectedValue;
  final String selectedLabel;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      tooltip: 'Filter bookings',
      initialValue: selectedValue,
      onSelected: onSelected,
      itemBuilder: (context) => [
        _item('all', 'All'),
        _item('pending', 'Pending'),
        _item('completed', 'Completed'),
        _item('cancelled', 'Cancelled'),
      ],
      child: Container(
        height: 36,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.filter_list_rounded,
              color: Colors.black87,
              size: 18,
            ),
            const SizedBox(width: 6),
            CommonText.medium(selectedLabel, size: 12, color: Colors.black87),
          ],
        ),
      ),
    );
  }

  PopupMenuItem<String> _item(String value, String label) {
    return PopupMenuItem<String>(
      value: value,
      child: Row(
        children: [
          Icon(
            selectedValue == value
                ? Icons.radio_button_checked
                : Icons.radio_button_unchecked,
            size: 18,
            color: selectedValue == value
                ? DriverBookingsView._cardRed
                : Colors.black54,
          ),
          const SizedBox(width: 10),
          CommonText.regular(label, size: 14),
        ],
      ),
    );
  }
}

class _DriverBookingCard extends StatelessWidget {
  final BookingItem item;
  final bool showAccept;
  final VoidCallback onAccept;
  final VoidCallback onViewDetails;

  const _DriverBookingCard({
    required this.item,
    required this.showAccept,
    required this.onAccept,
    required this.onViewDetails,
  });

  static const double _avatarSize = 52;

  @override
  Widget build(BuildContext context) {
    final scheme = context.colorScheme;
    final rating = item.rating;
    final showRatingBadge =
        item.isDriverAssigned && rating != '—' && rating.isNotEmpty;

    const completedGreen = Color(0xff2E7D32);
    final isServiceCompleted = item.isServiceCompleted;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
      decoration: BoxDecoration(
        color: scheme.onPrimary,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: DriverBookingsView._cardBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: _avatarSize,
                height: _avatarSize,
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Positioned.fill(
                      child: _Avatar(
                        isDriverAssigned: item.isDriverAssigned,
                        avatarUrl: item.driverAvatarUrl,
                      ),
                    ),
                    if (showRatingBadge)
                      Positioned(
                        right: -4,
                        bottom: -2,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 5,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.black,
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(
                              color: scheme.onPrimary,
                              width: 1.5,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.star_rounded,
                                size: 11,
                                color: Color(0xffF6B700),
                              ),
                              const SizedBox(width: 2),
                              Text(
                                rating,
                                style: TextStyle(
                                  color: scheme.onPrimary,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CommonText.semiBold(
                      item.title,
                      size: 16,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    CommonText.regular(
                      item.subtitle,
                      size: 13,
                      color: Colors.grey.shade600,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  // ── Status badge (matches customer booking card) ──────────
                  BookingStatusChip(
                    rawStatus: item.lifecycleStatus.isNotEmpty
                        ? item.lifecycleStatus
                        : item.status,
                    label: item.status,
                  ),
                  const SizedBox(height: 6),
                  const CommonText.regular(
                    'Your payout',
                    size: 11,
                    color: Color(0xff6D6D72),
                  ),
                  const SizedBox(height: 2),
                  CommonText.bold(
                    item.amount,
                    size: item.hasProviderPayout? 17 :12,
                    color: item.hasProviderPayout
                        ? DriverBookingsView._cardRed
                        : Colors.grey.shade600,
                  ),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.black,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.location_on_outlined,
                          size: 14,
                          color: scheme.onPrimary,
                        ),
                        const SizedBox(width: 4),
                        CommonText.regular(
                          item.distanceLabel,
                          size: 11,
                          color: scheme.onPrimary,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: DriverBookingsView._detailsBg,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      Icons.calendar_today_outlined,
                      size: 18,
                      color: Colors.grey.shade700,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: CommonText.regular(
                        item.scheduleLabel,
                        size: 13,
                        color: Colors.grey.shade800,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      Icons.location_on_outlined,
                      size: 18,
                      color: Colors.grey.shade700,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: CommonText.regular(
                        item.locationAddress,
                        size: 13,
                        color: Colors.grey.shade800,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (showAccept) ...[
            const SizedBox(height: 12),
            Obx(() {
              final acceptingId = Get.find<DriverDashboardController>()
                  .acceptingDriverBookingId
                  .value;
              final busy = acceptingId == item.id;
              return SizedBox(
                width: double.infinity,
                child: AppButton(
                  label: busy ? 'Accepting…' : 'Accept booking',
                  onPressed: busy ? null : onAccept,
                  bgColor: const Color(0xff1A1A1A),
                  txtColor: scheme.onPrimary,
                  btnCornerRadius: 10,
                  textSize: 14,
                  vPadding: 11,
                ),
              );
            }),
          ],
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: AppButton(
              label: 'View Service Details',
              onPressed: onViewDetails,
              bgColor: isServiceCompleted
                  ? completedGreen
                  : DriverBookingsView._cardRed,
              txtColor: scheme.onPrimary,
              btnCornerRadius: 10,
              textSize: 14,
              vPadding: 11,
            ),
          ),
        ],
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  final bool isDriverAssigned;
  final String? avatarUrl;

  const _Avatar({required this.isDriverAssigned, required this.avatarUrl});

  @override
  Widget build(BuildContext context) {
    const bg = Color(0xffE8E8EF);
    final url = avatarUrl?.trim() ?? '';

    // For driver-side booking cards, prefer showing the customer profile image
    // whenever API provides one, even if booking assignment flags vary.
    if (url.isNotEmpty) {
      return ClipOval(
        child: CachedNetworkImage(
          imageUrl: url,
          width: _DriverBookingCard._avatarSize,
          height: _DriverBookingCard._avatarSize,
          fit: BoxFit.cover,
          placeholder: (context, _) => IcUserAvatarPlaceholder(
            size: _DriverBookingCard._avatarSize,
            backgroundColor: bg,
          ),
          errorWidget: (context, _, _) => IcUserAvatarPlaceholder(
            size: _DriverBookingCard._avatarSize,
            backgroundColor: bg,
          ),
        ),
      );
    }

    if (!isDriverAssigned) {
      return CircleAvatar(
        radius: _DriverBookingCard._avatarSize / 2,
        backgroundColor: bg,
        child: Icon(
          Icons.person_off_rounded,
          size: 28,
          color: Colors.grey.shade600,
        ),
      );
    }

    return ClipOval(
      child: IcUserAvatarPlaceholder(
        size: _DriverBookingCard._avatarSize,
        backgroundColor: bg,
      ),
    );
  }
}
