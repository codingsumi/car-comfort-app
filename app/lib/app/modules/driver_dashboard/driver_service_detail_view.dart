import 'dart:async';
import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../constants/booking_tracking_status.dart';
import '../../constants/provider_accept_messages.dart';
import '../../widgets/booking_route_plan_card.dart';
import '../../widgets/booking_service_images_card.dart';
import '../../widgets/booking_service_notes_card.dart';
import '../../network/response/booking_detail_response.dart';
import '../../routes/app_pages.dart';
import '../../utils/app_snackbar.dart';
import '../../utils/booking_chat_availability.dart';
import '../../utils/booking_cancellation_display.dart';
import '../../utils/booking_timer_utils.dart';
import '../../utils/driver_service_details_display.dart';
import '../../widgets/driver_service_details_card.dart';
import '../../utils/booking_travel_distance.dart';
import '../../widgets/blurred_image_screen_header.dart';
import '../../widgets/booking_timer_banner.dart';
import '../../widgets/button.dart';
import '../dashboard/dashboard_booking_timer.dart';
import '../../widgets/cancellation_policy_hint.dart';
import '../../widgets/image.dart';
import '../../widgets/text.dart';
import '../../widgets/text_field.dart';
import '../dashboard/cancel_reason_controller.dart';
import 'driver_dashboard_controller.dart';

class DriverServiceDetailView extends StatefulWidget {
  const DriverServiceDetailView({super.key});

  @override
  State<DriverServiceDetailView> createState() => _DriverServiceDetailViewState();
}

class _DriverServiceDetailViewState extends State<DriverServiceDetailView> {
  @override
  void initState() {
    super.initState();
    final args = (Get.arguments is Map) ? Get.arguments as Map : const {};
    final rawId = args['bookingId'] ?? args['bookingCode'];
    final id = int.tryParse('${rawId ?? ''}');
    if (id != null && id > 0) {
      Get.find<DriverDashboardController>().scheduleServiceDetailLoad(id);
    }
  }

  @override
  void dispose() {
    Get.find<DriverDashboardController>().clearServiceDetailRouteBookingId();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => const _DriverServiceDetailViewBody();
}

class _DriverServiceDetailViewBody extends GetView<DriverDashboardController> {
  const _DriverServiceDetailViewBody();

  static const Color _danger = Color(0xffE70B1C);
  static const Color _screenBg = Color(0xffF4F4F4);
  static const Color _labelGrey = Color(0xff8E8E93);
  static const Color _darkCard = Color(0xff2C2C2E);
  static const Color _cancelBannerBg = Color(0xffF5DCDC);
  static const List<BoxShadow> _cardShadow = [
    BoxShadow(color: Color(0x12000000), blurRadius: 14, offset: Offset(0, 4)),
    BoxShadow(color: Color(0x08000000), blurRadius: 4, offset: Offset(0, 1)),
  ];

  @override
  Widget build(BuildContext context) {
    final args = (Get.arguments is Map) ? Get.arguments as Map : const {};
    final rawId = args['bookingId'] ?? args['bookingCode'];
    final parsedBookingId = int.tryParse('${rawId ?? ''}');

    // Lock back navigation when the driver is in the after-service (drop-off)
    // phase. Navigating away here could confuse the trip state; the driver
    // must complete or deliver the vehicle from CarDetailsView.
    return Obx(() {
      final locked = controller.isDriverAfterServiceDeliveryLocked;

      void _onBackBlocked() {
        showAppSnackBar(
          title: 'Complete delivery',
          message:
              'Add after-service photos (optional), then tap '
              '"Complete delivery" to finish this booking.',
        );
        // Re-open CarDetailsView if the driver somehow escaped it.
        unawaited(controller.ensureDriverAfterServiceCarDetailsOpen());
      }

      return PopScope(
        canPop: !locked,
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop && locked) _onBackBlocked();
        },
        child: Scaffold(
      backgroundColor: _screenBg,
      body: Column(
        children: [
          BlurredImageScreenHeader(
            title: 'Service Details',
            backgroundFit: BoxFit.fill,
            onBack: locked ? _onBackBlocked : () => Get.back<void>(),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Obx(() {
                  final bookingId = parsedBookingId;
                  final isRefreshing = bookingId != null &&
                      controller.isServiceDetailLoadingFor(bookingId);
                  return HeaderCircleIconButton(
                    icon: Icons.refresh_rounded,
                    onTap: () {
                      if (isRefreshing || bookingId == null) return;
                      unawaited(
                        controller.fetchServiceDetail(
                          bookingId: bookingId,
                          force: true,
                        ),
                      );
                    },
                  );
                }),
                const SizedBox(width: 8),
                HeaderCircleIconButton(
                  icon: Icons.notifications_none_rounded,
                  onTap: () => Get.toNamed(Routes.DRIVER_NOTIFICATIONS),
                ),
              ],
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(18, 12, 18, 0),
              child: Obx(() {
                final requestedId = parsedBookingId;
                final activeDetail = controller.serviceDetail.value;
                final cachedDetail = requestedId == null
                    ? null
                    : controller.serviceDetailByBookingId[requestedId];
                final detail = activeDetail?.id == requestedId
                    ? activeDetail
                    : cachedDetail;
                final loadingThisBooking = requestedId != null &&
                    controller.isServiceDetailLoadingFor(requestedId);
                final syncedDetail = mergeDriverServiceDetailForDisplay(
                  apiDetail: detail,
                  bookingId: requestedId,
                  loadedBookingId: detail?.id,
                  routeArgs: Map<String, dynamic>.from(args),
                );
                final detailMatches = detail != null &&
                    requestedId != null &&
                    detail.id == requestedId;
                final bookingCode = _coalesceText([
                  syncedDetail?.bookingCode,
                  args['bookingCode'],
                  args['bookingId'],
                ]);
                final driverEarning = syncedDetail?.driverEarning;
                final distanceFallback = _coalesceText([
                  args['distanceLabel'],
                ], '-');
                final pickupAddress = _coalesceText([
                  syncedDetail?.pickupLocation?.address,
                  syncedDetail?.address,
                  args['locationAddress'],
                ]);
                final dropoffAddress = _coalesceText([
                  syncedDetail?.dropoffLocation?.address,
                  args['dropoffAddress'],
                  syncedDetail?.pickupLocation?.address,
                  syncedDetail?.address,
                  args['locationAddress'],
                ]);
                final serviceNotesCard = BookingServiceNotesCard.fromDetail(
                  syncedDetail,
                  boxShadow: _cardShadow,
                );
                final rawBookingStatus = _rawStatusFromDetailOrArgs(
                  syncedDetail?.status,
                  args['status'],
                );
                final statusLower = rawBookingStatus.toLowerCase();
                final bookingStatusLabel = rawBookingStatus.isEmpty
                    ? '-'
                    : _formatBookingStatusLabel(rawBookingStatus);
                final trackingNorm =
                    BookingTrackingStatus.normalizeTrackingCode(
                      syncedDetail?.trackingStatus,
                    );
                final currentTrackingLabel = trackingNorm.isNotEmpty
                    ? BookingTrackingStatus.customerMessageFor(trackingNorm)
                    : null;
                final currentTrackingColorLower = trackingNorm.isNotEmpty
                    ? trackingNorm.toLowerCase()
                    : null;
                final vehicleDelivered =
                    BookingTrackingStatus.isVehicleDelivered(
                      syncedDetail?.trackingStatus,
                    );
                final apiBookingId = syncedDetail?.id ?? parsedBookingId;
                // Use rawBookingStatus (which already falls back to
                // args['status']) so the Cancel button is correctly hidden
                // even before the API detail has finished loading.
                final showCancelBooking =
                    apiBookingId != null &&
                    BookingTrackingStatus.canDriverCancelBooking(
                      bookingStatus: rawBookingStatus.isNotEmpty
                          ? rawBookingStatus
                          : syncedDetail?.status?.toString(),
                      trackingStatus: syncedDetail?.trackingStatus?.toString(),
                    ) &&
                    !vehicleDelivered;
                final isCancelledBooking = _shouldShowCancellationBanner(
                  detailMatches: detailMatches,
                  isLoading: loadingThisBooking,
                  statusLower: statusLower,
                  cancelledAt: syncedDetail?.cancelledAt,
                );
                final cancellationDetailMessage =
                    bookingCancellationDetailMessage(
                  serviceTypeRaw: syncedDetail?.serviceType ??
                      syncedDetail?.serviceTypeLabel ??
                      args['service'],
                  cancelledBy: syncedDetail?.cancelledBy?.toString(),
                  cancellationReason:
                      syncedDetail?.cancellationReason?.toString(),
                );
                final timeOfServiceLabel = formatProviderTimeOfServiceLabel(
                  scheduleType: syncedDetail?.scheduleType,
                  scheduledAtIso: bookingScheduledAtIso(
                    scheduledAt: syncedDetail?.scheduledAt,
                    serviceDatetime: syncedDetail?.serviceDatetime,
                  ),
                );
                final estimatedDurationLabel =
                    driverActiveServiceDurationCompact(syncedDetail);
                final providerEarningsLabel = resolveDriverServiceProviderEarningsLabel(
                  detail: syncedDetail,
                );
                final showProviderAcceptFooter =
                    syncedDetail != null &&
                    !isCancelledBooking &&
                    BookingTrackingStatus.canDriverStartTripFromBooking(
                      bookingStatus: syncedDetail.status?.toString(),
                      trackingStatus: syncedDetail.trackingStatus?.toString(),
                    );
                final providerAcceptFooter =
                    ProviderAcceptMessages.footerNoteForScheduleType(
                  syncedDetail?.scheduleType,
                );

                final customerNameFromArgs = '${args['customerName'] ?? ''}'
                    .trim();
                final customerNameFromApi =
                    syncedDetail?.customerDetail?.name?.trim() ?? '';
                final customerName = customerNameFromApi.isNotEmpty
                    ? customerNameFromApi
                    : customerNameFromArgs.isNotEmpty
                    ? customerNameFromArgs
                    : 'Customer';
                final customerAvatarFromApi =
                    syncedDetail?.customerDetail?.profilePicture?.trim() ?? '';
                final customerAvatarFromArgs =
                    '${args['customerAvatarUrl'] ?? ''}'.trim();
                final customerAvatarUrl = customerAvatarFromApi.isNotEmpty
                    ? customerAvatarFromApi
                    : customerAvatarFromArgs;

                // The global active detail can be replaced by a background
                // driver refresh. This route reads its per-booking cache and
                // only waits for its own in-flight request.
                final hasMatchingData = detail != null &&
                    requestedId != null &&
                    detail.id == requestedId;
                final err = requestedId == null
                    ? controller.serviceDetailError.value.trim()
                    : controller.serviceDetailErrorFor(requestedId).trim();

                if (!hasMatchingData &&
                    err.isEmpty &&
                    loadingThisBooking) {
                  return const Padding(
                    padding: EdgeInsets.symmetric(vertical: 80),
                    child: Center(child: CircularProgressIndicator()),
                  );
                }

                if (requestedId != null && syncedDetail == null) {
                  if (loadingThisBooking && err.isEmpty) {
                    return const Padding(
                      padding: EdgeInsets.symmetric(vertical: 48),
                      child: Center(child: CircularProgressIndicator()),
                    );
                  }
                }

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (loadingThisBooking)
                      const Padding(
                        padding: EdgeInsets.only(bottom: 12),
                        child: LinearProgressIndicator(minHeight: 2),
                      ),
                    _statusHeroCard(
                      customerName: customerName,
                      customerAvatarUrl: customerAvatarUrl,
                      bookingId: bookingCode,
                      bookingStatusLabel: bookingStatusLabel,
                      statusLower: statusLower,
                      currentTrackingStatusLabel: currentTrackingLabel,
                      currentTrackingStatusLower: currentTrackingColorLower,
                      showCancellationBanner: isCancelledBooking,
                      cancellationNotice: isCancelledBooking
                          ? cancellationDetailMessage
                          : '',
                    ),
                    const SizedBox(height: 14),
                    DriverServiceDetailsCard(
                      detail: syncedDetail,
                      timeOfService: timeOfServiceLabel,
                      providerEarnings: providerEarningsLabel,
                      estimatedDuration: estimatedDurationLabel,
                      boxShadow: _cardShadow,
                    ),
                    if (showProviderAcceptFooter) ...[
                      const SizedBox(height: 14),
                      _providerAcceptFooterCard(providerAcceptFooter),
                    ],
                    const SizedBox(height: 14),
                    _radiusCard(syncedDetail, fallback: distanceFallback),
                    const SizedBox(height: 14),
                    BookingRoutePlanCard(
                      detail: syncedDetail,
                      pickupAddress: pickupAddress,
                      dropoffAddress: dropoffAddress,
                      trackingNorm: trackingNorm,
                      cardShadow: _cardShadow,
                    ),
                    if (serviceNotesCard.hasContent) ...[
                      const SizedBox(height: 14),
                      serviceNotesCard,
                    ],
                    if (syncedDetail?.serviceImages?.hasAny == true) ...[
                      const SizedBox(height: 14),
                      BookingServiceImagesCard(
                        serviceImages: syncedDetail!.serviceImages!,
                        title: 'Vehicle Photos',
                        customerSectionTitle: 'Uploaded during booking',
                        boxShadow: _cardShadow,
                      ),
                    ],
                    // ── Driver earning breakdown (tip + base) ──
                    if (driverEarning != null &&
                        syncedDetail != null &&
                        (driverEarning.amount > 0 || driverEarning.tipAmount != null)) ...[
                      const SizedBox(height: 14),
                      _DriverEarningCard(
                        earning: driverEarning,
                        boxShadow: _cardShadow,
                      ),
                    ],
                    // ── Customer review / rating received ──
                    if (syncedDetail?.assignedDriver?.review != null) ...[
                      const SizedBox(height: 14),
                      _CustomerReviewCard(
                        review: syncedDetail!.assignedDriver!.review!,
                        boxShadow: _cardShadow,
                      ),
                    ],
                    if (parsedBookingId != null &&
                        bookingChatVisibleForDriver(statusLower)) ...[
                      const SizedBox(height: 14),
                      AppButton(
                        label: bookingChatButtonLabel(
                          statusLower,
                          isDriverView: true,
                        ),
                        onPressed: () => Get.toNamed(
                          Routes.DRIVER_CHAT,
                          arguments: {
                            'bookingId': parsedBookingId,
                            'status': statusLower,
                            'peerId':
                                syncedDetail?.customerDetail?.id ??
                                syncedDetail?.customerId,
                            'peerName': customerName,
                            'peerImage': customerAvatarUrl,
                          },
                        ),
                        type: ButtonType.tonal,
                        bgColor: const Color(0xffF5DCDC),
                        txtColor: _danger,
                        btnCornerRadius: 14,
                        vPadding: 14,
                        textSize: 15,
                      ),
                    ],
                    if (showCancelBooking) ...[
                      const SizedBox(height: 12),
                      AppButton(
                        label: 'Cancel Booking',
                        onPressed: () => _openDriverCancelBookingSheet(
                          apiBookingId,
                        ),
                        type: ButtonType.tonal,
                        bgColor: _cancelBannerBg,
                        txtColor: _danger,
                        btnCornerRadius: 14,
                        vPadding: 14,
                        textSize: 15,
                      ),
                    ],
                    const SizedBox(height: 8),
                    if (controller.serviceDetailError.value.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      CommonText.regular(
                        controller.serviceDetailError.value,
                        size: 12,
                        color: Colors.red.shade400,
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ],
                );
              }),
            ),
          ),
        ],
      ),
      bottomNavigationBar: Obx(() {
        controller.bookingTimerTick.value;
        final detail = controller.serviceDetail.value;
        final rawBookingStatus = _rawStatusFromDetailOrArgs(
          detail?.status,
          args['status'],
        );
        // Hide Start when already in return/drop-off phase — prevents the
        // action from resetting an in-progress return flow.
        final tracking =
            BookingTrackingStatus.normalizeTrackingCode(detail?.trackingStatus);
        final isInReturnPhase = tracking ==
                BookingTrackingStatus.driverReturningToCustomer ||
            tracking == BookingTrackingStatus.driverReachedCustomerReturn ||
            tracking == BookingTrackingStatus.afterImagesUploaded;
        if (!BookingTrackingStatus.canDriverStartTripFromBooking(
          bookingStatus: rawBookingStatus,
          trackingStatus: detail?.trackingStatus,
        ) ||
            !controller.canDriverStartOnDemandAcceptPhase ||
            isInReturnPhase) {
          return const SizedBox.shrink();
        }
        final apiBookingId = detail?.id ?? parsedBookingId;
        final customerNameFromArgs = '${args['customerName'] ?? ''}'.trim();
        final customerNameFromApi = detail?.customerDetail?.name?.trim() ?? '';
        final customerName = customerNameFromApi.isNotEmpty
            ? customerNameFromApi
            : customerNameFromArgs.isNotEmpty
            ? customerNameFromArgs
            : 'Customer';
        final customerAvatarFromApi =
            detail?.customerDetail?.profilePicture?.trim() ?? '';
        final customerAvatarFromArgs = '${args['customerAvatarUrl'] ?? ''}'
            .trim();
        final customerAvatarUrl = customerAvatarFromApi.isNotEmpty
            ? customerAvatarFromApi
            : customerAvatarFromArgs;
        final pickupAddress = _coalesceText([
          detail?.pickupLocation?.address,
          detail?.address,
          args['locationAddress'],
        ]);
        return Wrap(
          children: [
            SafeArea(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (controller.isDriverOnDemandAcceptCountdownVisible) ...[
                    BookingTimerBanner(
                      phase: controller.bookingTimerPhase.value ??
                          'accept_countdown',
                      remainingSeconds:
                          controller.driverAcceptCountdownRemainingSeconds(),
                    ),
                    const SizedBox(height: 12),
                  ],
                  AppButton(
                    label: 'Start',
                    onPressed: () {
                  if ((apiBookingId ?? 0) > 0) {
                    controller.setActiveDriverBookingContext(
                      bookingId: apiBookingId!,
                      customerName: customerName,
                      customerAvatarUrl: customerAvatarUrl,
                      pickupLat:
                          detail?.pickupLocation?.latitude ?? detail?.latitude,
                      pickupLng:
                          detail?.pickupLocation?.longitude ??
                          detail?.longitude,
                      pickupAddress: pickupAddress,
                    );
                  }
                  final scheduleType = detail?.scheduleType?.toString();
                  if (isScheduledScheduleType(scheduleType)) {
                    unawaited(() async {
                      await controller.startActiveDriverService();
                      Get.back<void>();
                    }());
                  } else {
                    controller.showAcceptedServicePanelOnDriverHome();
                    Get.back<void>();
                  }
                },
                type: ButtonType.primary,
                bgColor: _danger,
                txtColor: Colors.white,
                btnCornerRadius: 14,
                    vPadding: 14,
                    textSize: 15,
                  ),
                ],
              ).marginAll(16),
            ),
          ],
        );
      }),
        ), // Scaffold
      );
    }); // PopScope + Obx
  }

  static String _rawStatusFromDetailOrArgs(
    String? detailStatus,
    dynamic argsStatus,
  ) {
    final fromDetail = detailStatus?.trim() ?? '';
    if (fromDetail.isNotEmpty) return fromDetail;
    if (argsStatus == null) return '';
    return argsStatus.toString().trim();
  }

  static String _formatBookingStatusLabel(String raw) {
    final normalized = raw.trim().replaceAll('_', ' ');
    if (normalized.isEmpty) return '-';
    return normalized
        .split(RegExp(r'\s+'))
        .where((w) => w.isNotEmpty)
        .map((w) => '${w[0].toUpperCase()}${w.substring(1).toLowerCase()}')
        .join(' ');
  }

  static bool _shouldShowCancellationBanner({
    required bool detailMatches,
    required bool isLoading,
    required String statusLower,
    dynamic cancelledAt,
  }) {
    if (!detailMatches || isLoading) return false;
    if (statusLower == 'completed') return false;
    if (statusLower == 'cancelled' || statusLower == 'canceled') return true;
    final cancelledAtText = '${cancelledAt ?? ''}'.trim();
    return cancelledAtText.isNotEmpty;
  }

  static Color _bookingStatusColor(String statusLower) {
    if (statusLower == 'cancelled' || statusLower == 'canceled') {
      return _danger;
    }
    if (statusLower == 'completed') {
      return const Color(0xff1B5E20);
    }
    if (statusLower == 'vehicle_delivered') {
      return const Color(0xff1B5E20);
    }
    if (statusLower == 'draft') {
      return const Color(0xffC2410C);
    }
    return const Color(0xff1C1C1E);
  }

  Widget _statusHeroCard({
    required String customerName,
    required String customerAvatarUrl,
    required String bookingId,
    required String bookingStatusLabel,
    required String statusLower,
    String? currentTrackingStatusLabel,
    String? currentTrackingStatusLower,
    bool showCancellationBanner = false,
    String cancellationNotice = '',
  }) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: _cardShadow,
      ),
      child: Column(
        children: [
          _personAvatar(imageUrl: customerAvatarUrl),
          const SizedBox(height: 14),
          CommonText.semiBold(
            customerName,
            size: 17,
            color: const Color(0xff1C1C1E),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
          ),
          if (showCancellationBanner && cancellationNotice.trim().isNotEmpty) ...[
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: _cancelBannerBg,
                borderRadius: BorderRadius.circular(16),
              ),
              child: CommonText.medium(
                cancellationNotice.trim(),
                size: 12,
                color: _danger,
                textAlign: TextAlign.center,
                maxLines: 8,
              ),
            ),
          ],
          const SizedBox(height: 20),
          Align(
            alignment: Alignment.centerLeft,
            child: _metaBlock(
              label: 'BOOKING ID',
              value: _formatBookingId(bookingId),
              alignEnd: false,
              valueRed: false,
            ),
          ),
          const SizedBox(height: 18),
          const Divider(height: 1, color: Color(0xffECECEC)),
          const SizedBox(height: 16),
          Align(
            alignment: Alignment.centerLeft,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const CommonText.medium(
                  'BOOKING STATUS',
                  size: 14,
                  letterSpacing: 0.9,
                  color: _labelGrey,
                ),
                const SizedBox(height: 4),
                CommonText.semiBold(
                  bookingStatusLabel,
                  size: 16,
                  color: _bookingStatusColor(statusLower),
                ),
              ],
            ),
          ),
          if (currentTrackingStatusLabel != null &&
              currentTrackingStatusLabel.trim().isNotEmpty) ...[
            const SizedBox(height: 16),
            Align(
              alignment: Alignment.centerLeft,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const CommonText.medium(
                    'CURRENT STATUS',
                    size: 14,
                    letterSpacing: 0.9,
                    color: _labelGrey,
                  ),
                  const SizedBox(height: 4),
                  CommonText.semiBold(
                    currentTrackingStatusLabel.trim(),
                    size: 16,
                    color: _bookingStatusColor(
                      (currentTrackingStatusLower ?? '').trim().isEmpty
                          ? statusLower
                          : currentTrackingStatusLower!.trim().toLowerCase(),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _personAvatar({required String imageUrl}) {
    const bg = Color(0xffE8E8EF);
    if (imageUrl.isNotEmpty) {
      return ClipOval(
        child: CachedNetworkImage(
          imageUrl: imageUrl,
          width: 60,
          height: 60,
          fit: BoxFit.cover,
          placeholder: (_, _) =>
              const IcUserAvatarPlaceholder(size: 60, backgroundColor: bg),
          errorWidget: (_, _, _) =>
              const IcUserAvatarPlaceholder(size: 60, backgroundColor: bg),
        ),
      );
    }
    return const ClipOval(
      child: IcUserAvatarPlaceholder(size: 60, backgroundColor: bg),
    );
  }

  Widget _metaBlock({
    required String label,
    required String value,
    required bool alignEnd,
    required bool valueRed,
  }) {
    return Column(
      crossAxisAlignment: alignEnd
          ? CrossAxisAlignment.end
          : CrossAxisAlignment.start,
      children: [
        CommonText.regular(
          label,
          size: 12,
          letterSpacing: 0.9,
          color: _labelGrey,
          textAlign: alignEnd ? TextAlign.right : TextAlign.left,
        ),
        const SizedBox(height: 4),
        CommonText.semiBold(
          value,
          size: 14,
          color: valueRed ? _danger : const Color(0xff1C1C1E),
          textAlign: alignEnd ? TextAlign.right : TextAlign.left,
        ),
      ],
    );
  }

  Widget _providerAcceptFooterCard(String message) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      decoration: BoxDecoration(
        color: const Color(0xffF8F8FA),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xffE8E8EF)),
      ),
      child: CommonText.regular(
        message,
        size: 13,
        color: const Color(0xff3A3A3C),
      ),
    );
  }

  Widget _radiusCard(BookingDetailData? detail, {required String fallback}) {
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
      decoration: BoxDecoration(
        color: _darkCard,
        borderRadius: BorderRadius.circular(18),
        boxShadow: _cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              border: Border.all(color: Colors.white38, width: 1),
              borderRadius: BorderRadius.circular(6),
            ),
            child: const Icon(
              Icons.location_on_outlined,
              color: Colors.white70,
              size: 16,
            ),
          ),
          const SizedBox(height: 12),
          const CommonText.regular(
            'ESTIMATED RADIUS',
            size: 11,
            letterSpacing: 1.0,
            color: Colors.white70,
          ),
          const SizedBox(height: 6),
          BookingEstimatedRadiusText(detail: detail, fallback: fallback),
        ],
      ),
    );
  }

  static (Color labelColor, Color dotColor) _routeLegPalette(
    BookingRouteLegStyle style,
  ) {
    switch (style) {
      case BookingRouteLegStyle.active:
        return (_danger, _danger);
      case BookingRouteLegStyle.completed:
        return (const Color(0xff1B5E20), const Color(0xff34B620));
      case BookingRouteLegStyle.upcoming:
        return (_labelGrey, const Color(0xff6D6D70));
    }
  }

  Widget _routePlanCard({
    required String pickupAddress,
    required String serviceLocationAddress,
    required String dropoffAddress,
    required String trackingNorm,
  }) {
    final pickup = _splitRouteLines(pickupAddress);
    final drop = _splitRouteLines(dropoffAddress);
    final service = _splitRouteLines(serviceLocationAddress);

    final useMiddleLeg =
        _meaningfullyDifferent(serviceLocationAddress, pickupAddress) &&
        _meaningfullyDifferent(serviceLocationAddress, dropoffAddress);

    final dropLabel = BookingTrackingStatus.routePlanDropoffLabel(trackingNorm);

    final legs = <_RouteLeg>[];
    void addLeg(_RouteLeg leg) => legs.add(leg);

    final plannedLegCount = 1 + (useMiddleLeg ? 1 : 0) + 1;
    var idx = 0;
    {
      final style = BookingTrackingStatus.routeLegStyle(
        legIndex: idx,
        legCount: plannedLegCount,
        trackingNorm: trackingNorm,
      );
      final c = _routeLegPalette(style);
      addLeg(
        _RouteLeg(
          label: 'PICKUP',
          labelColor: c.$1,
          dotColor: c.$2,
          title: pickup.$1,
          subtitle: pickup.$2,
        ),
      );
      idx++;
    }
    if (useMiddleLeg) {
      final style = BookingTrackingStatus.routeLegStyle(
        legIndex: idx,
        legCount: plannedLegCount,
        trackingNorm: trackingNorm,
      );
      final c = _routeLegPalette(style);
      addLeg(
        _RouteLeg(
          label: 'SERVICE LOCATION',
          labelColor: c.$1,
          dotColor: c.$2,
          title: service.$1,
          subtitle: service.$2,
        ),
      );
      idx++;
    }
    {
      final style = BookingTrackingStatus.routeLegStyle(
        legIndex: idx,
        legCount: plannedLegCount,
        trackingNorm: trackingNorm,
      );
      final c = _routeLegPalette(style);
      addLeg(
        _RouteLeg(
          label: dropLabel,
          labelColor: c.$1,
          dotColor: c.$2,
          title: drop.$1,
          subtitle: drop.$2,
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: _cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: const Color(0xffF2F2F7),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.route_rounded,
                  size: 18,
                  color: Color(0xff636366),
                ),
              ),
              const SizedBox(width: 10),
              const CommonText.semiBold(
                'Route Plan',
                size: 17,
                color: Color(0xff1C1C1E),
              ),
            ],
          ),
          const SizedBox(height: 18),
          _routeTimeline(legs),
        ],
      ),
    );
  }

  Widget _routeTimeline(List<_RouteLeg> legs) {
    return Column(
      children: [
        for (var i = 0; i < legs.length; i++)
          _routeLegRow(
            leg: legs[i],
            isFirst: i == 0,
            isLast: i == legs.length - 1,
          ),
      ],
    );
  }

  Widget _routeLegRow({
    required _RouteLeg leg,
    required bool isFirst,
    required bool isLast,
  }) {
    const lineColor = Color(0xffD1D1D6);
    const gutterW = 24.0;
    const dotSize = 10.0;
    const lineW = 2.0;
    const topSegH = 12.0;
    const bottomSegH = 60.0;

    Widget centeredLine(double h) {
      return SizedBox(
        width: gutterW,
        height: h,
        child: Center(
          child: SizedBox(
            width: lineW,
            height: h,
            child: const DecoratedBox(
              decoration: BoxDecoration(color: lineColor),
            ),
          ),
        ),
      );
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: gutterW,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              if (!isFirst) centeredLine(topSegH),
              Container(
                width: dotSize,
                height: dotSize,
                decoration: BoxDecoration(
                  color: leg.dotColor,
                  shape: BoxShape.circle,
                ),
              ),
              if (!isLast) centeredLine(bottomSegH),
            ],
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Padding(
            padding: EdgeInsets.only(bottom: isLast ? 0 : 8),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CommonText.semiBold(
                  leg.label,
                  size: 11,
                  letterSpacing: 0.6,
                  color: leg.labelColor,
                ),
                const SizedBox(height: 4),
                CommonText.semiBold(
                  leg.title,
                  size: 15,
                  color: const Color(0xff1C1C1E),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                if (leg.subtitle != null &&
                    leg.subtitle!.trim().isNotEmpty) ...[
                  const SizedBox(height: 2),
                  CommonText.regular(
                    leg.subtitle!.trim(),
                    size: 13,
                    color: _labelGrey,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }

  (String, String?) _splitRouteLines(String raw) {
    final t = raw.trim();
    if (t.isEmpty) return ('-', null);
    final nl = t.split(RegExp(r'\r?\n'));
    if (nl.length >= 2) {
      return (nl.first.trim(), nl.sublist(1).join('\n').trim());
    }
    final idx = t.indexOf(',');
    if (idx > 0 && idx < t.length - 2) {
      return (t.substring(0, idx).trim(), t.substring(idx + 1).trim());
    }
    return (t, null);
  }

  bool _meaningfullyDifferent(String a, String b) {
    final x = a.trim().toLowerCase();
    final y = b.trim().toLowerCase();
    if (x.isEmpty) return false;
    return x != y;
  }

  String _coalesceText(List<dynamic> candidates, [String fallback = '-']) {
    for (final c in candidates) {
      final s = '${c ?? ''}'.trim();
      if (s.isNotEmpty) return s;
    }
    return fallback;
  }

  String _formatBookingId(String code) {
    final t = code.trim();
    if (t.isEmpty || t == '-') return '-';
    if (t.startsWith('#')) return t;
    return '#$t';
  }
}

void _openDriverCancelBookingSheet(int? apiBookingId) {
  final id = apiBookingId;
  if (id == null) return;
  final cancel = Get.find<CancelReasonController>();
  cancel.beginCancelForBooking(id);
  Get.bottomSheet<void>(
    const _DriverCancelBookingSheet(),
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    ignoreSafeArea: false,
  ).whenComplete(() {
    if (Get.isRegistered<CancelReasonController>()) {
      Get.find<CancelReasonController>().clearExplicitCancelTarget();
    }
  });
}

class _DriverCancelBookingSheet extends StatelessWidget {
  const _DriverCancelBookingSheet();

  static const Color _submitRed = Color(0xffC4101F);

  @override
  Widget build(BuildContext context) {
    final cancel = Get.find<CancelReasonController>();
    final scheme = Theme.of(context).colorScheme;
    final mq = MediaQuery.of(context);
    final maxHeight = mq.size.height - mq.padding.top - mq.viewInsets.bottom - 8;

    return SafeArea(
      top: true,
      bottom: false,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: math.max(220, maxHeight)),
        child: Container(
          width: double.infinity,
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            boxShadow: [
              BoxShadow(
                color: Color(0x33000000),
                blurRadius: 16,
                offset: Offset(0, -4),
              ),
            ],
          ),
          padding: EdgeInsets.fromLTRB(
            20,
            18,
            20,
            16 + mq.padding.bottom,
          ),
          child: SingleChildScrollView(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(
                  height: 40,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 52),
                        child: CommonText.bold(
                          'Cancel This Booking',
                          size: 16,
                          color: Color(0xff1C1C1E),
                          textAlign: TextAlign.center,
                          maxLines: 2,
                        ),
                      ),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Icon(
                            Icons.warning_amber_rounded,
                            size: 32,
                            color: Colors.black87,
                          ),
                          Material(
                            color: const Color(0xff2C2C2E),
                            shape: const CircleBorder(),
                            clipBehavior: Clip.antiAlias,
                            child: InkWell(
                              customBorder: const CircleBorder(),
                              onTap: () => Get.back<void>(),
                              child: const Padding(
                                padding: EdgeInsets.all(8),
                                child: Icon(
                                  Icons.close_rounded,
                                  color: Colors.white,
                                  size: 18,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 10),
                const CommonText.regular(
                  'Are you sure you want to cancel this service? Please give us a reason.',
                  size: 13,
                  color: Color(0xff8E8E93),
                ),
                const SizedBox(height: 12),
                const CancellationPolicyHint(dense: true),
                const SizedBox(height: 12),
                CommonTextField(
                  controller: cancel.reasonController,
                  hintText: 'Enter Details',
                  textColor: scheme.onSurface,
                  labelColor: scheme.onSurface,
                  hintColor: scheme.outlineVariant,
                  maxLines: 7,
                  minLines: 5,
                  keyboardType: TextInputType.multiline,
                  inputAction: TextInputAction.newline,
                  bgColor: Colors.transparent,
                  borderColor: scheme.outlineVariant,
                ),
                const SizedBox(height: 14),
                Obx(
                  () => SizedBox(
                    width: double.infinity,
                    child: AppButton(
                      label: cancel.isSubmitting.value
                          ? 'Submitting...'
                          : 'Submit',
                      onPressed: cancel.isSubmitting.value
                          ? null
                          : () => unawaited(cancel.submit()),
                      type: ButtonType.primary,
                      bgColor: _submitRed,
                      txtColor: Colors.white,
                      btnCornerRadius: 14,
                      vPadding: 14,
                      textSize: 15,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _RouteLeg {
  _RouteLeg({
    required this.label,
    required this.labelColor,
    required this.dotColor,
    required this.title,
    this.subtitle,
  });

  final String label;
  final Color labelColor;
  final Color dotColor;
  final String title;
  final String? subtitle;
}

/// Compact card showing driver earning breakdown (base pay + tip + total).
class _DriverEarningCard extends StatelessWidget {
  const _DriverEarningCard({
    required this.earning,
    this.boxShadow,
  });

  final DriverEarningSummary earning;
  final List<BoxShadow>? boxShadow;

  static const Color _label = Color(0xff8E8E93);
  static const Color _value = Color(0xff1C1C1E);
  static const Color _totalColor = Color(0xff1B5E20);

  @override
  Widget build(BuildContext context) {
    final hasTip = earning.tipAmount != null && earning.tipAmount! > 0;
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: boxShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const CommonText.semiBold(
            'Your Earnings',
            size: 14,
            color: Color(0xff1C1C1E),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              CommonText.regular(
                earning.payoutLabel ?? 'Service pay',
                size: 13,
                color: _label,
              ),
              CommonText.regular(
                earning.amountDisplay,
                size: 13,
                color: _value,
              ),
            ],
          ),
          if (hasTip) ...[
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const CommonText.medium(
                  'Customer tip 🎉',
                  size: 13,
                  color: Color(0xff2E7D32),
                ),
                CommonText.medium(
                  '\$${earning.tipAmount!.toStringAsFixed(2)}',
                  size: 13,
                  color: const Color(0xff2E7D32),
                ),
              ],
            ),
          ],
          const Divider(height: 20, color: Color(0xffECECEC)),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const CommonText.semiBold(
                'Total',
                size: 14,
                color: _value,
              ),
              CommonText.semiBold(
                earning.totalPayoutDisplay,
                size: 14,
                color: _totalColor,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Shows the customer's rating + review message for a completed booking.
class _CustomerReviewCard extends StatelessWidget {
  const _CustomerReviewCard({
    required this.review,
    this.boxShadow,
  });

  final BookingDriverReview review;
  final List<BoxShadow>? boxShadow;

  @override
  Widget build(BuildContext context) {
    final rating = review.rating ?? 0;
    final message = (review.message ?? '').trim();
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: boxShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const CommonText.semiBold(
            'Customer Rating',
            size: 14,
            color: Color(0xff1C1C1E),
          ),
          const SizedBox(height: 10),
          Row(
            children: List.generate(5, (i) {
              return Icon(
                i < rating ? Icons.star_rounded : Icons.star_outline_rounded,
                color: const Color(0xffFFA000),
                size: 22,
              );
            }),
          ),
          if (message.isNotEmpty) ...[
            const SizedBox(height: 10),
            CommonText.regular(
              message,
              size: 13,
              color: const Color(0xff3A3A3A),
              maxLines: 6,
            ),
          ],
        ],
      ),
    );
  }
}
