import 'dart:async';

import 'package:car_comfort/app/utils/extensions/extension.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../gen/assets.gen.dart';
import '../../routes/app_pages.dart';
import '../../widgets/booking_status_chip.dart';
import '../../widgets/button.dart';
import '../../widgets/image.dart';
import '../../widgets/tappable_profile_avatar.dart';
import '../../widgets/text.dart';
import '../../widgets/widgets.dart';
import 'dashboard_controller.dart';

class MyBookingsView extends GetView<DashboardController> {
  const MyBookingsView({super.key});

  static const Color _cardRed = Color(0xffE70B1C);
  static const Color _cardBorder = Color(0xffE8E8EF);
  static const Color _detailsBg = Color(0xffF4F4F6);

  Widget _buildFilterPill(String filter, String label, String selectedFilter) {
    final isSelected = filter == selectedFilter;
    return InkWell(
      onTap: () => controller.setBookingsFilter(filter),
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? _cardRed : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? Colors.transparent : const Color(0xffE8E8EF),
          ),
        ),
        child: CommonText.medium(
          label,
          color: isSelected ? Colors.white : Colors.black87,
          size: 13,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDesktop = kIsWeb && MediaQuery.sizeOf(context).width >= 900;

    if (isDesktop) {
      return Scaffold(
        backgroundColor: const Color(0xffFAFAFA),
        body: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              const CommonText.bold(
                'My Bookings',
                size: 24,
                color: Colors.black87,
              ),
              const SizedBox(height: 4),
              const CommonText.regular(
                'Manage your upcoming and past service appointments.',
                size: 14,
                color: Colors.black54,
              ),
              const SizedBox(height: 24),
              // Search Input + Inline filter pills
              Row(
                children: [
                  Expanded(
                    child: Obx(() {
                      final selected = controller.bookingsFilter.value;
                      return Row(
                        children: [
                          _buildFilterPill('all', 'All', selected),
                          const SizedBox(width: 10),
                          _buildFilterPill('pending', 'Pending', selected),
                          const SizedBox(width: 10),
                          _buildFilterPill('completed', 'Completed', selected),
                          const SizedBox(width: 10),
                          _buildFilterPill('cancelled', 'Cancelled', selected),
                        ],
                      );
                    }),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              // Bookings List
              Expanded(
                child: RefreshIndicator(
                  onRefresh: () => controller.refreshBookings(),
                  child: Obx(() {
                    final isRefreshing = controller.isBookingsRefreshing.value;
                    final isLoading = controller.isBookingsLoading.value;
                    final isLoadingMore =
                        controller.isBookingsLoadingMore.value;
                    final bookings = controller.bookings;
                    final bookingCount = bookings.length;

                    controller.bookingsInitialLoadDone.value;
                    final showFullLoader =
                        !isRefreshing &&
                        isLoading &&
                        bookingCount == 0 &&
                        !controller.bookingsInitialLoadDone.value;
                    final listItemCount =
                        bookingCount + (isLoadingMore ? 1 : 0);

                    return LayoutBuilder(
                      builder: (context, constraints) {
                        if (showFullLoader) {
                          return const Center(
                            child: CircularProgressIndicator(color: _cardRed),
                          );
                        }

                        if (bookingCount == 0) {
                          return Center(
                            child: CommonText.regular(
                              'No bookings found.',
                              size: 14,
                              color: Colors.grey.shade700,
                            ),
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
                            padding: const EdgeInsets.only(bottom: 24),
                            itemCount: listItemCount,
                            itemBuilder: (_, index) {
                              if (index == bookingCount) {
                                return const Padding(
                                  padding: EdgeInsets.symmetric(vertical: 12),
                                  child: Center(
                                    child: CircularProgressIndicator(
                                      color: _cardRed,
                                    ),
                                  ),
                                );
                              }
                              final item = bookings[index];
                              return _BookingCard(
                                title: item.title,
                                subtitle: item.subtitle,
                                amount: item.amount,
                                bookingCode: item.id.toString(),
                                service: item.service,
                                rating: item.rating,
                                distanceLabel: item.distanceLabel,
                                scheduleLabel: item.scheduleLabel,
                                locationAddress: item.locationAddress,
                                isDriverAssigned: item.isDriverAssigned,
                                isServiceCompleted: item.isServiceCompleted,
                                rawStatus: item.lifecycleStatus,
                                displayStatus: item.status,
                                avatarUrl: item.driverAvatarUrl,
                                onTap: () => _openServiceDetails(item),
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
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xffFAFAFA),
      body: Column(
        children: [
          _BookingsHeader(
            controller: controller,
            onNotifications: () {
              unawaited(
                (Get.toNamed(Routes.NOTIFICATIONS) ?? Future.value()).then(
                  (_) => controller.refreshBookings(),
                ),
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
                // Only full-screen loader on first open — not during pull-to-refresh
                // (RefreshIndicator already shows progress).
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
                          return _BookingCard(
                            title: item.title,
                            subtitle: item.subtitle,
                            amount: item.amount,
                            bookingCode: item.id.toString(),
                            service: item.service,
                            rating: item.rating,
                            distanceLabel: item.distanceLabel,
                            scheduleLabel: item.scheduleLabel,
                            locationAddress: item.locationAddress,
                            isDriverAssigned: item.isDriverAssigned,
                            isServiceCompleted: item.isServiceCompleted,
                            rawStatus: item.lifecycleStatus,
                            displayStatus: item.status,
                            avatarUrl: item.driverAvatarUrl,
                            onTap: () => _openServiceDetails(item),
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

  void _openServiceDetails(BookingItem item) {
    // Start loading before GetX changes the web route. On PWA, the destination
    // widget can be built before its route parameters become readable.
    controller.scheduleServiceDetailLoad(item.id);
    final arguments = <String, dynamic>{
      'bookingId': item.id,
      'status': item.lifecycleStatus.isNotEmpty
          ? item.lifecycleStatus
          : item.status,
      // Keep the screen useful while the full booking-detail request is in
      // flight (or while a transient request error is being retried).
      'amount': item.amount,
      'service': item.serviceTypeSlug.isNotEmpty
          ? item.serviceTypeSlug
          : item.service,
      'distanceLabel': item.distanceLabel,
      'locationAddress': item.locationAddress,
      'isDriverAssigned': item.isDriverAssigned,
      'driverName': item.isDriverAssigned ? item.title : '',
      'profile_picture': item.driverAvatarUrl ?? '',
      'scheduleLabel': item.scheduleLabel,
      'scheduleType': item.scheduleType,
    };
    final parameters = <String, String>{
      'bookingId': '${item.id}',
      'status': '${arguments['status']}',
    };

    // The PWA is hosted by GetX's Router delegate, so use that delegate rather
    // than Navigator 1 navigation. Native apps retain the existing behavior.
    final Future<dynamic> navigation = kIsWeb
        ? Get.rootDelegate.toNamed<void>(
            Routes.SERVICE_DETAIL,
            arguments: arguments,
            parameters: parameters,
          )
        : (Get.toNamed<dynamic>(Routes.SERVICE_DETAIL, arguments: arguments) ??
              Future.value());
    unawaited(navigation.then((_) => controller.refreshBookings()));
  }
}

class _BookingsHeader extends StatelessWidget {
  final DashboardController controller;
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
                ? MyBookingsView._cardRed
                : Colors.black54,
          ),
          const SizedBox(width: 10),
          CommonText.regular(label, size: 14),
        ],
      ),
    );
  }
}

class _BookingCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final String amount;
  final String bookingCode;
  final String service;
  final String rating;
  final String distanceLabel;
  final String scheduleLabel;
  final String locationAddress;
  final bool isDriverAssigned;
  final bool isServiceCompleted;

  /// Raw API lifecycle status (e.g. 'cancelled', 'completed', 'pending').
  final String rawStatus;

  /// Human-readable status label (e.g. 'Cancelled', 'Completed').
  final String displayStatus;
  final String? avatarUrl;
  final VoidCallback onTap;

  const _BookingCard({
    required this.title,
    required this.subtitle,
    required this.amount,
    required this.bookingCode,
    required this.service,
    required this.rating,
    required this.distanceLabel,
    required this.scheduleLabel,
    required this.locationAddress,
    required this.isDriverAssigned,
    required this.isServiceCompleted,
    this.rawStatus = '',
    this.displayStatus = '',
    required this.avatarUrl,
    required this.onTap,
  });

  static const Color _completedGreen = Color(0xff2E7D32);

  static const double _avatarSize = 52;

  @override
  Widget build(BuildContext context) {
    final scheme = context.colorScheme;
    final showRatingBadge =
        isDriverAssigned && rating != '—' && rating.isNotEmpty;
    final isDesktop = kIsWeb && MediaQuery.sizeOf(context).width >= 900;

    final cardBg = Colors.white;

    final borderCol = MyBookingsView._cardBorder;

    final titleCol = Colors.black87;
    final subtitleCol = isDriverAssigned
        ? Colors.grey.shade600
        : MyBookingsView._cardRed;

    final detailsBg = MyBookingsView._detailsBg;

    final detailsTextCol = Colors.grey.shade800;
    final detailsIconCol = Colors.grey.shade700;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: borderCol),
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
                        isDriverAssigned: isDriverAssigned,
                        avatarUrl: avatarUrl,
                        driverName: title,
                        rating: rating,
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
                                style: const TextStyle(
                                  color: Colors.white,
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
                      title,
                      size: 16,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      color: titleCol,
                    ),
                    const SizedBox(height: 4),
                    CommonText.regular(
                      subtitle,
                      size: 13,
                      color: subtitleCol,
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
                  BookingStatusChip(rawStatus: rawStatus, label: displayStatus),
                  const SizedBox(height: 6),
                  CommonText.bold(
                    amount,
                    size: 17,
                    color: MyBookingsView._cardRed,
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
                        const Icon(
                          Icons.location_on_outlined,
                          size: 14,
                          color: Colors.white,
                        ),
                        const SizedBox(width: 4),
                        CommonText.regular(
                          distanceLabel,
                          size: 11,
                          color: Colors.white,
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
              color: detailsBg,
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
                      color: detailsIconCol,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: CommonText.regular(
                        scheduleLabel,
                        size: 13,
                        color: detailsTextCol,
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
                      color: detailsIconCol,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: CommonText.regular(
                        locationAddress,
                        size: 13,
                        color: detailsTextCol,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: AppButton(
              label: 'View Service Details',
              onPressed: onTap,
              bgColor: isServiceCompleted
                  ? _completedGreen
                  : MyBookingsView._cardRed,
              txtColor: Colors.white,
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
  final String driverName;
  final String rating;

  const _Avatar({
    required this.isDriverAssigned,
    required this.avatarUrl,
    required this.driverName,
    required this.rating,
  });

  @override
  Widget build(BuildContext context) {
    final bg = const Color(0xffE8E8EF);

    if (!isDriverAssigned) {
      return CircleAvatar(
        radius: _BookingCard._avatarSize / 2,
        backgroundColor: bg,
        child: const Icon(
          Icons.schedule_outlined,
          size: 28,
          color: Colors.grey,
        ),
      );
    }

    if (avatarUrl != null && avatarUrl!.isNotEmpty) {
      final parsedRating = double.tryParse(rating);
      return TappableProfileAvatar(
        imageUrl: avatarUrl,
        size: _BookingCard._avatarSize,
        backgroundColor: bg,
        previewProviderName: driverName,
        previewRating: parsedRating,
      );
    }

    return ClipOval(
      child: IcUserAvatarPlaceholder(
        size: _BookingCard._avatarSize,
        backgroundColor: bg,
      ),
    );
  }
}

// _StatusChip removed — replaced by the shared BookingStatusChip widget.
