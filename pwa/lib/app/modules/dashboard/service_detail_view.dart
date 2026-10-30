import 'dart:async';
import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../constants/booking_tracking_status.dart';
import '../../utils/booking_invoice_download.dart';
import '../../utils/custom_loader.dart';
import '../../constants/customer_booking_messages.dart';
import '../../constants/service_provider_labels.dart';
import '../../network/response/booking_detail_response.dart';
import '../../routes/app_pages.dart';
import '../../utils/booking_chat_availability.dart';
import '../../utils/booking_cancellation_display.dart';
import '../../utils/booking_timer_utils.dart';
import '../../utils/booking_travel_distance.dart';
import '../../utils/current_browser_query.dart'
    if (dart.library.html) '../../utils/current_browser_query_web.dart';
import '../../utils/service_type_label.dart' show bookingServiceTypeDisplay;
import '../../widgets/blurred_image_screen_header.dart';
import '../../widgets/button.dart';
import '../../widgets/booking_price_summary_card.dart';
import '../../widgets/booking_route_plan_card.dart';
import '../../widgets/booking_service_images_card.dart';
import '../../widgets/booking_service_notes_card.dart';
import '../../widgets/customer_pickup_otp_banner.dart';
import '../../widgets/cancellation_policy_hint.dart';
import '../../utils/pref.dart';
import '../../widgets/image.dart';
import '../../widgets/text.dart';
import '../../widgets/text_field.dart';
import 'cancel_reason_controller.dart';
import 'dashboard_controller.dart';

Map<String, dynamic> _serviceDetailRouteArguments() {
  final inMemory = Get.arguments is Map
      ? (Get.arguments as Map).cast<dynamic, dynamic>()
      : const <dynamic, dynamic>{};
  return <String, dynamic>{
    // GetX Router can leave Get.parameters empty after browser navigation,
    // and Uri.base can remain fixed to the PWA's initial URL.
    if (kIsWeb) ...currentBrowserQueryParameters(),
    ...Get.parameters,
    ...inMemory.map((key, value) => MapEntry('$key', value)),
  };
}

class ServiceDetailView extends StatefulWidget {
  const ServiceDetailView({super.key});

  @override
  State<ServiceDetailView> createState() => _ServiceDetailViewState();
}

class _ServiceDetailViewState extends State<ServiceDetailView> {
  int? _scheduledBookingId;

  @override
  void initState() {
    super.initState();
    _loadBookingFromCurrentRoute();
    // GetX can build the destination before the browser has committed the new
    // URL. Re-read it after the first frame so PWA query parameters are not
    // permanently missed.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _loadBookingFromCurrentRoute();
      setState(() {});
    });
  }

  void _loadBookingFromCurrentRoute() {
    final dashboard = Get.find<DashboardController>();
    final args = _serviceDetailRouteArguments();
    final rawId = args['bookingId'] ?? args['bookingCode'];
    final id =
        int.tryParse('${rawId ?? ''}') ??
        dashboard.serviceDetailBookingId.value;
    if (id != null && id > 0 && _scheduledBookingId != id) {
      _scheduledBookingId = id;
      dashboard.scheduleServiceDetailLoad(id);
    }
  }

  @override
  void dispose() {
    Get.find<DashboardController>().clearServiceDetailRouteBookingId();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => const _ServiceDetailViewBody();
}

class _ServiceDetailViewBody extends GetView<DashboardController> {
  const _ServiceDetailViewBody();

  static const Color _red = Color(0xffC4101F);
  static const Color _danger = Color(0xffE70B1C);
  static const Color _screenBg = Color(0xffF4F4F4);
  static const Color _labelGrey = Color(0xff8E8E93);
  static const Color _darkCard = Color(0xff2C2C2E);

  /// Same as Cancel Booking button fill.
  static const Color _cancelBannerBg = Color(0xffF5DCDC);
  static const List<BoxShadow> _cardShadow = [
    BoxShadow(color: Color(0x12000000), blurRadius: 14, offset: Offset(0, 4)),
    BoxShadow(color: Color(0x08000000), blurRadius: 4, offset: Offset(0, 1)),
  ];

  static double _scrollBottomPadding(BuildContext context) {
    final media = MediaQuery.of(context);
    final systemBottom = math.max(
      media.viewPadding.bottom,
      media.padding.bottom,
    );
    // Fallback when edge-to-edge reports 0 but the 3-button nav bar still overlaps.
    return systemBottom > 0 ? systemBottom + 24.0 : 72.0;
  }

  @override
  Widget build(BuildContext context) {
    final scrollBottomPadding = _scrollBottomPadding(context);
    final args = _serviceDetailRouteArguments();
    final rawId = args['bookingId'] ?? args['bookingCode'];
    final parsedBookingId =
        int.tryParse('${rawId ?? ''}') ??
        controller.serviceDetailBookingId.value;

    return Scaffold(
      backgroundColor: _screenBg,
      body: Column(
        children: [
          Obx(() {
            final detail = controller.serviceDetail.value;
            final requestedId = parsedBookingId;
            final sharedDetailMatches =
                requestedId == null || detail?.id == requestedId;
            final syncedDetail = sharedDetailMatches
                ? detail
                : controller.serviceDetailByBookingId[requestedId!];
            final menuState = _deriveMoreMenuState(
              args: args,
              parsedBookingId: parsedBookingId,
              syncedDetail: syncedDetail,
            );

            return BlurredImageScreenHeader(
              title: 'Service Details',
              backgroundFit: BoxFit.fill,
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  HeaderCircleIconButton(
                    icon: Icons.notifications_none_rounded,
                    onTap: () => _navigateToRoute(Routes.NOTIFICATIONS),
                  ),
                  if (menuState != null) ...[
                    const SizedBox(width: 8),
                    _buildMoreMenu(context, menuState),
                  ],
                ],
              ),
            );
          }),
          Expanded(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(18, 12, 18, scrollBottomPadding),
              child: Obx(() {
                final detail = controller.serviceDetail.value;
                final requestedId = parsedBookingId;
                final cachedBooking = _cachedBookingItem(requestedId);
                final sharedDetailMatches =
                    requestedId == null || detail?.id == requestedId;
                final syncedDetail = sharedDetailMatches
                    ? detail
                    : controller.serviceDetailByBookingId[requestedId!];
                final detailMatches =
                    requestedId == null || syncedDetail?.id == requestedId;
                final loadingThisBooking =
                    requestedId != null &&
                    controller.isServiceDetailLoading.value &&
                    controller.serviceDetailBookingId.value == requestedId;
                final driverPerson = controller.driverPersonFromBookingDetail(
                  syncedDetail,
                );
                final driverNameFromDetail = controller
                    .bookingDriverNameFromDetail(driverPerson);
                final driverNameFromArgs = '${args['driverName'] ?? ''}'.trim();
                final providerAvatarUrl = () {
                  final fromPerson =
                      (controller.avatarUrlFromDetail(driverPerson) ?? '')
                          .trim();
                  if (fromPerson.isNotEmpty) return fromPerson;
                  final fromDriverDetail =
                      (syncedDetail?.driverDetail?.profilePicture ?? '').trim();
                  if (fromDriverDetail.isNotEmpty) return fromDriverDetail;
                  final fromAssigned =
                      (syncedDetail?.assignedDriver?.profile ?? '').trim();
                  if (fromAssigned.isNotEmpty) return fromAssigned;
                  final fromArgs = '${args['profile_picture'] ?? ''}'.trim();
                  if (fromArgs.isNotEmpty) return fromArgs;
                  return (cachedBooking?.driverAvatarUrl ?? '').trim();
                }();
                final providerDisplayName = () {
                  final fromDetail = driverNameFromDetail.trim();
                  if (fromDetail.isNotEmpty &&
                      fromDetail != ServiceProviderLabels.fallbackName) {
                    return fromDetail;
                  }
                  final assignedName =
                      (syncedDetail?.assignedDriver?.name ?? '').trim();
                  if (assignedName.isNotEmpty) return assignedName;
                  if (driverNameFromArgs.isNotEmpty) return driverNameFromArgs;
                  if (cachedBooking?.isDriverAssigned == true) {
                    return cachedBooking!.title.trim();
                  }
                  return '';
                }();
                final bookingCode = _coalesceText([
                  syncedDetail?.bookingCode,
                  args['bookingCode'],
                  args['bookingId'],
                ]);
                final totalPrice = _coalesceText([
                  syncedDetail?.totalPriceDisplay,
                  syncedDetail?.totalPrice != null
                      ? '\$${syncedDetail!.totalPrice!.toStringAsFixed(2)}'
                      : null,
                  args['amount'],
                  cachedBooking?.amount,
                ]);
                final serviceTypeRaw = _coalesceText([
                  syncedDetail?.serviceTypeLabel,
                  syncedDetail?.serviceType,
                  args['service'],
                  cachedBooking?.serviceTypeSlug,
                  cachedBooking?.service,
                ], 'Service');
                final serviceTypeFormatted = bookingServiceTypeDisplay(
                  serviceTypeRaw,
                );
                final serviceType = serviceTypeFormatted.isEmpty
                    ? 'Service'
                    : serviceTypeFormatted;
                final distanceFallback = _coalesceText([
                  args['distanceLabel'],
                  cachedBooking?.distanceLabel,
                ], '—');
                final pickupAddress = _coalesceText([
                  syncedDetail?.pickupLocation?.address,
                  syncedDetail?.address,
                  args['locationAddress'],
                  cachedBooking?.locationAddress,
                ]);
                final dropoffAddress = _coalesceText([
                  syncedDetail?.dropoffLocation?.address,
                  args['dropoffAddress'],
                  syncedDetail?.pickupLocation?.address,
                  syncedDetail?.address,
                  args['locationAddress'],
                  cachedBooking?.locationAddress,
                ]);
                final serviceNotesCard = BookingServiceNotesCard.fromDetail(
                  syncedDetail,
                  boxShadow: _cardShadow,
                );

                final rawBookingStatus = _rawStatusFromDetailOrArgs(
                  syncedDetail?.status,
                  _coalesceText([
                    args['status'],
                    cachedBooking?.lifecycleStatus,
                    cachedBooking?.status,
                  ], ''),
                );
                final cancellationDetailMessage =
                    bookingCancellationDetailMessage(
                      serviceTypeRaw:
                          syncedDetail?.serviceType ??
                          syncedDetail?.serviceTypeLabel ??
                          args['service'],
                      cancelledBy: syncedDetail?.cancelledBy?.toString(),
                      cancellationReason: syncedDetail?.cancellationReason
                          ?.toString(),
                    );
                final statusLower = rawBookingStatus.toLowerCase();
                final hasDriverAssigned =
                    _isTruthyRouteValue(args['isDriverAssigned']) ||
                    (cachedBooking?.isDriverAssigned == true) ||
                    (syncedDetail?.status?.toLowerCase() == 'assigned') ||
                    (syncedDetail?.driverId != null) ||
                    driverPerson != null ||
                    statusLower == 'completed' ||
                    statusLower == 'in_progress';
                final bookingStatusLabel = rawBookingStatus.isEmpty
                    ? '—'
                    : _formatBookingStatusLabel(rawBookingStatus);
                final cancelledByCustomer =
                    (syncedDetail?.cancelledBy ?? '').trim().toLowerCase() ==
                    'customer';
                final trackingNorm =
                    BookingTrackingStatus.normalizeTrackingCode(
                      syncedDetail?.trackingStatus,
                    );
                final vehicleDelivered =
                    BookingTrackingStatus.isVehicleDelivered(
                      syncedDetail?.trackingStatus,
                    );
                final currentTrackingLabel = trackingNorm.isNotEmpty
                    ? BookingTrackingStatus.customerMessageFor(trackingNorm)
                    : null;
                final currentTrackingColorLower = trackingNorm.isNotEmpty
                    ? trackingNorm.toLowerCase()
                    : null;
                final showCancelBooking =
                    _statusAllowsCancelBooking(statusLower) &&
                    !cancelledByCustomer &&
                    !vehicleDelivered &&
                    !BookingTrackingStatus.isCancellationBlockedAfterOtp(
                      bookingStatus: syncedDetail?.status?.toString(),
                      trackingStatus: syncedDetail?.trackingStatus?.toString(),
                    );
                final isCancelledBooking = _shouldShowCancellationBanner(
                  detailMatches: detailMatches,
                  isLoading: loadingThisBooking,
                  statusLower: statusLower,
                  cancelledAt: syncedDetail?.cancelledAt,
                );
                final apiBookingId = syncedDetail?.id ?? parsedBookingId;
                final showPickupOtpBanner =
                    BookingTrackingStatus.isCustomerPickupOtpSharePhase(
                      syncedDetail?.trackingStatus,
                    );
                final pickupOtpForDisplay = controller
                    .customerPickupOtpForDisplay(
                      bookingId: apiBookingId,
                      detail: syncedDetail,
                    );
                final scheduleType =
                    syncedDetail?.scheduleType?.toString() ??
                    '${args['scheduleType'] ?? cachedBooking?.scheduleType ?? ''}';
                final showScheduledDateTime =
                    (syncedDetail != null ||
                        (cachedBooking?.scheduleLabel ?? '')
                            .trim()
                            .isNotEmpty) &&
                    !isOnDemandScheduleType(scheduleType);
                final scheduledDateTimeLabel = syncedDetail != null
                    ? formatBookingScheduleLine(
                        bookingScheduledAtIso(
                          scheduledAt: syncedDetail.scheduledAt,
                          serviceDatetime: syncedDetail.serviceDatetime,
                        ),
                      )
                    : _coalesceText([
                        args['scheduleLabel'],
                        cachedBooking?.scheduleLabel,
                      ]);

                if (requestedId != null && syncedDetail == null) {
                  final err = controller.serviceDetailError.value.trim();
                  if (loadingThisBooking ||
                      controller.serviceDetailBookingId.value == requestedId) {
                    if (err.isEmpty) {
                      return const Padding(
                        padding: EdgeInsets.symmetric(vertical: 48),
                        child: Center(child: CircularProgressIndicator()),
                      );
                    }
                  }
                  if (err.isNotEmpty && cachedBooking == null) {
                    return _serviceDetailLoadError(
                      bookingId: requestedId,
                      message: err,
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
                      hasDriverAssigned: hasDriverAssigned,
                      providerDisplayName: providerDisplayName,
                      providerAvatarUrl: providerAvatarUrl,
                      scheduleType: syncedDetail?.scheduleType?.toString(),
                      bookingId: bookingCode,
                      totalPrice: totalPrice,
                      serviceType: serviceType,
                      bookingStatusLabel: bookingStatusLabel,
                      statusLower: statusLower,
                      currentTrackingStatusLabel: currentTrackingLabel,
                      currentTrackingStatusLower: currentTrackingColorLower,
                      showCancellationBanner: isCancelledBooking,
                      cancellationNotice: isCancelledBooking
                          ? cancellationDetailMessage
                          : '',
                    ),
                    if (showPickupOtpBanner) ...[
                      const SizedBox(height: 14),
                      CustomerPickupOtpBanner(
                        otp: pickupOtpForDisplay,
                        showWaitingWhenEmpty: true,
                      ),
                    ],
                    const SizedBox(height: 14),
                    _radiusCard(syncedDetail, fallback: distanceFallback),
                    if (showScheduledDateTime) ...[
                      const SizedBox(height: 14),
                      _scheduledDateTimeCard(scheduledDateTimeLabel),
                    ],
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
                        boxShadow: _cardShadow,
                      ),
                    ],
                    // Show the customer's submitted review + any admin response
                    if (syncedDetail != null &&
                        statusLower == 'completed' &&
                        syncedDetail.hasCustomerReviewedDriver &&
                        syncedDetail.assignedDriver?.review != null) ...[
                      const SizedBox(height: 14),
                      _SubmittedReviewCard(
                        review: syncedDetail.assignedDriver!.review!,
                      ),
                    ],
                    if (syncedDetail != null &&
                        statusLower == 'completed' &&
                        detailMatches &&
                        hasDriverAssigned &&
                        apiBookingId != null &&
                        (syncedDetail.canCustomerReviewDriver ||
                            syncedDetail.canCustomerTipDriver)) ...[
                      const SizedBox(height: 14),
                      _postServiceFeedbackCard(
                        canReview: syncedDetail.canCustomerReviewDriver,
                        canTip: syncedDetail.canCustomerTipDriver,
                        onAction: () => controller.openPostServiceFeedback(
                          bookingId: apiBookingId,
                        ),
                      ),
                    ],
                    const SizedBox(height: 18),
                    if (showCancelBooking == true) ...[
                      SizedBox(
                        width: double.infinity,
                        child: AppButton(
                          label: 'Cancel Booking',
                          onPressed: () =>
                              _openCancelBookingSheet(apiBookingId),
                          type: ButtonType.tonal,
                          bgColor: _cancelBannerBg,
                          txtColor: _red,
                          btnCornerRadius: 14,
                          vPadding: 14,
                          textSize: 15,
                        ),
                      ),
                    ],
                    // ── Admin-cancelled-by-support banner ──────────────────
                    if (syncedDetail != null &&
                        (statusLower == 'cancelled' ||
                            statusLower == 'canceled') &&
                        '${syncedDetail.cancelledBy ?? ''}'
                                .trim()
                                .toLowerCase() ==
                            'admin') ...[
                      const SizedBox(height: 14),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 12,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xffFFF3CD),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xffFFC107)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Row(
                              children: [
                                Icon(
                                  Icons.info_outline,
                                  color: Color(0xff856404),
                                  size: 18,
                                ),
                                SizedBox(width: 6),
                                CommonText.medium(
                                  'Cancelled by support team',
                                  size: 13,
                                  color: Color(0xff856404),
                                ),
                              ],
                            ),
                            if ('${syncedDetail.cancellationReason ?? ''}'
                                .trim()
                                .isNotEmpty) ...[
                              const SizedBox(height: 6),
                              CommonText.regular(
                                syncedDetail.cancellationReason.toString(),
                                size: 12,
                                color: const Color(0xff856404),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                    // ── Refund info section ─────────────────────────────────
                    if (syncedDetail != null &&
                        double.tryParse(
                              '${syncedDetail.refundAmount ?? '0'}',
                            ) !=
                            null &&
                        (double.tryParse(
                                  '${syncedDetail.refundAmount ?? '0'}',
                                ) ??
                                0) >
                            0) ...[
                      const SizedBox(height: 14),
                      _refundInfoCard(
                        refundAmount:
                            double.tryParse(
                              '${syncedDetail.refundAmount ?? '0'}',
                            ) ??
                            0,
                        refundStatus: syncedDetail.refundStatus,
                      ),
                    ],
                    // ── Dispute section ─────────────────────────────────────
                    if (syncedDetail != null &&
                        apiBookingId != null &&
                        Prefs().isCustomerRole) ...[
                      const SizedBox(height: 14),
                      _disputeSection(
                        disputeStatus: syncedDetail.disputeStatus,
                      ),
                    ],
                    if (syncedDetail?.priceSummary != null &&
                        (syncedDetail!
                                    .priceSummary!
                                    .applicableCharges
                                    ?.isNotEmpty ==
                                true ||
                            (syncedDetail.priceSummary!.total ?? 0) > 0)) ...[
                      const SizedBox(height: 14),
                      BookingPriceSummaryCard(
                        priceSummary: syncedDetail.priceSummary!,
                        totalLabel: 'Total',
                      ),
                    ],

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
    );
  }

  static const Set<String> _cancelledBookingStatuses = {
    'cancelled',
    'canceled',
  };

  /// Terminal API statuses must never expose a Cancel Booking action.
  static const Set<String> _terminalBookingStatuses = {
    ..._cancelledBookingStatuses,
    'completed',
    'rejected',
    'refunded',
    'failed',
  };

  BookingItem? _cachedBookingItem(int? bookingId) {
    if (bookingId == null || bookingId <= 0) return null;
    for (final item in controller.bookings) {
      if (item.id == bookingId) return item;
    }
    return null;
  }

  Widget _serviceDetailLoadError({
    required int bookingId,
    required String message,
  }) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: _cardShadow,
      ),
      child: Column(
        children: [
          const Icon(Icons.error_outline_rounded, color: _danger, size: 36),
          const SizedBox(height: 12),
          const CommonText.semiBold(
            'Unable to load service details',
            size: 17,
            color: Color(0xff1C1C1E),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 6),
          CommonText.regular(
            message,
            size: 13,
            color: _labelGrey,
            textAlign: TextAlign.center,
            maxLines: 4,
          ),
          const SizedBox(height: 18),
          AppButton(
            label: 'Retry',
            onPressed: () => unawaited(
              controller.fetchServiceDetail(bookingId: bookingId, force: true),
            ),
            bgColor: _danger,
            txtColor: Colors.white,
            btnCornerRadius: 12,
          ),
        ],
      ),
    );
  }

  /// Red "… booking cancelled" banner — only for truly cancelled bookings.
  static bool _shouldShowCancellationBanner({
    required bool detailMatches,
    required bool isLoading,
    required String statusLower,
    dynamic cancelledAt,
  }) {
    if (!detailMatches || isLoading) return false;
    if (statusLower == 'completed') return false;
    if (_cancelledBookingStatuses.contains(statusLower)) return true;
    final cancelledAtText = '${cancelledAt ?? ''}'.trim();
    return cancelledAtText.isNotEmpty;
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

  static bool _statusAllowsCancelBooking(String statusLower) {
    // Never expose a destructive action while the booking state is unknown.
    if (statusLower.isEmpty) return false;
    return !_terminalBookingStatuses.contains(statusLower);
  }

  static bool _isTruthyRouteValue(dynamic value) {
    if (value == true) return true;
    final normalized = '${value ?? ''}'.trim().toLowerCase();
    return normalized == 'true' || normalized == '1' || normalized == 'yes';
  }

  static String _formatBookingStatusLabel(String raw) {
    final normalized = raw.trim().replaceAll('_', ' ');
    if (normalized.isEmpty) return '—';
    return normalized
        .split(RegExp(r'\s+'))
        .where((w) => w.isNotEmpty)
        .map((w) => '${w[0].toUpperCase()}${w.substring(1).toLowerCase()}')
        .join(' ');
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

  _StatusHeroCopy _resolveStatusHeroCopy({
    required String statusLower,
    required bool hasDriverAssigned,
    required String providerDisplayName,
    required String providerAvatarUrl,
    String? scheduleType,
  }) {
    final providerKnown =
        providerDisplayName.trim().isNotEmpty &&
        providerDisplayName.trim() != ServiceProviderLabels.fallbackName;
    final avatarUrl = providerAvatarUrl.trim();

    // For cancelled bookings the assignment section is not relevant — show a
    // neutral headline so the "Driver Not Assigned / Searching" label is hidden.
    if (statusLower == 'cancelled' || statusLower == 'canceled') {
      return _StatusHeroCopy(
        headline: 'Booking Cancelled',
        subtitle: 'This booking has been cancelled. See details below.',
        headlineColor: _danger,
        avatarUrl: '',
      );
    }

    if (statusLower == 'completed' || statusLower == 'vehicle_delivered') {
      return _StatusHeroCopy(
        headline: providerKnown
            ? providerDisplayName.trim()
            : 'Service Completed',
        subtitle: CustomerBookingMessages.serviceCompleted,
        headlineColor: const Color(0xff1B5E20),
        avatarUrl: avatarUrl,
      );
    }

    if (statusLower == 'in_progress') {
      return _StatusHeroCopy(
        headline: providerKnown
            ? providerDisplayName.trim()
            : ServiceProviderLabels.assigned,
        subtitle: CustomerBookingMessages.serviceInProgress,
        headlineColor: _danger,
        avatarUrl: avatarUrl,
      );
    }

    if (hasDriverAssigned || providerKnown) {
      final assignedSubtitle = isOnDemandScheduleType(scheduleType)
          ? CustomerBookingMessages.providerAssignedOnDemand
          : CustomerBookingMessages.providerAssignedScheduled;
      return _StatusHeroCopy(
        headline: providerKnown
            ? providerDisplayName.trim()
            : ServiceProviderLabels.assigned,
        subtitle: assignedSubtitle,
        headlineColor: _danger,
        avatarUrl: avatarUrl,
      );
    }

    return _StatusHeroCopy(
      headline: ServiceProviderLabels.notAssigned,
      subtitle: CustomerBookingMessages.welcomeAfterBooking,
      headlineColor: _danger,
      avatarUrl: '',
    );
  }

  Widget _statusHeroCard({
    required bool hasDriverAssigned,
    required String providerDisplayName,
    required String providerAvatarUrl,
    String? scheduleType,
    required String bookingId,
    required String totalPrice,
    required String serviceType,
    required String bookingStatusLabel,
    required String statusLower,
    String? currentTrackingStatusLabel,
    String? currentTrackingStatusLower,
    required bool showCancellationBanner,
    required String cancellationNotice,
  }) {
    final heroCopy = _resolveStatusHeroCopy(
      statusLower: statusLower,
      hasDriverAssigned: hasDriverAssigned,
      providerDisplayName: providerDisplayName,
      providerAvatarUrl: providerAvatarUrl,
      scheduleType: scheduleType,
    );

    return Container(
      padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: _cardShadow,
      ),
      child: Column(
        children: [
          // Only show the provider avatar when there is meaningful content
          // (i.e. not a cancelled booking with an empty avatarUrl).
          if (heroCopy.avatarUrl.isNotEmpty) ...[
            _profileAvatar(heroCopy.avatarUrl),
            const SizedBox(height: 14),
          ],
          CommonText.semiBold(
            heroCopy.headline,
            size: 17,
            color: heroCopy.headlineColor,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          CommonText.regular(
            heroCopy.subtitle,
            size: 13,
            color: _labelGrey,
            textAlign: TextAlign.center,
          ),
          if (showCancellationBanner) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: _cancelBannerBg,
                borderRadius: BorderRadius.circular(16),
              ),
              child: CommonText.medium(
                cancellationNotice,
                size: 12,
                color: _red,
                textAlign: TextAlign.center,
                maxLines: 8,
              ),
            ),
          ],
          const SizedBox(height: 20),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _metaBlock(
                  label: 'BOOKING ID',
                  value: _formatBookingId(bookingId),
                  alignEnd: false,
                  valueRed: false,
                ),
              ),
              Expanded(
                child: _metaBlock(
                  label: 'TOTAL PRICE',
                  value: totalPrice,
                  alignEnd: true,
                  valueRed: true,
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          const Divider(height: 1, color: Color(0xffECECEC)),
          const SizedBox(height: 16),
          Align(
            alignment: Alignment.centerLeft,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CommonText.medium(
                  'BOOKING STATUS',
                  size: 14,
                  letterSpacing: 0.9,
                  color: _labelGrey,
                ),
                const SizedBox(height: 4),
                CommonText.semiBold(
                  bookingStatusLabel,
                  size: 16,
                  color: _ServiceDetailViewBody._bookingStatusColor(
                    statusLower,
                  ),
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
                  CommonText.medium(
                    'CURRENT STATUS',
                    size: 14,
                    letterSpacing: 0.9,
                    color: _labelGrey,
                  ),
                  const SizedBox(height: 4),
                  CommonText.semiBold(
                    currentTrackingStatusLabel.trim(),
                    size: 16,
                    color: _ServiceDetailViewBody._bookingStatusColor(
                      (currentTrackingStatusLower ?? '').trim().isEmpty
                          ? statusLower
                          : currentTrackingStatusLower!.trim().toLowerCase(),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 16),
          Align(
            alignment: Alignment.centerLeft,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CommonText.medium(
                  'SERVICE TYPE',
                  size: 14,
                  letterSpacing: 0.9,
                  color: _labelGrey,
                ),
                const SizedBox(height: 4),
                CommonText.semiBold(
                  serviceType,
                  size: 16,
                  color: const Color(0xff1C1C1E),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _profileAvatar(String imageUrl) {
    const bg = Color(0xffE8E8EF);
    if (imageUrl.trim().isNotEmpty) {
      return ClipOval(
        child: CachedNetworkImage(
          imageUrl: imageUrl.trim(),
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
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          color: valueRed ? _danger : const Color(0xff1C1C1E),
          textAlign: alignEnd ? TextAlign.right : TextAlign.left,
        ),
      ],
    );
  }

  Widget _scheduledDateTimeCard(String label) {
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: _cardShadow,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: const Color(0xffF2F2F7),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(
              Icons.calendar_today_outlined,
              size: 18,
              color: Color(0xff636366),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const CommonText.semiBold(
                  'Date & Time',
                  size: 17,
                  color: Color(0xff1C1C1E),
                ),
                const SizedBox(height: 6),
                CommonText.regular(label, size: 14, color: _labelGrey),
              ],
            ),
          ),
        ],
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
        return (_red, _red);
      case BookingRouteLegStyle.completed:
        return (const Color(0xff1B5E20), const Color(0xff34B620));
      case BookingRouteLegStyle.upcoming:
        return (_labelGrey, const Color(0xff6D6D70));
    }
  }

  Widget _refundInfoCard({required double refundAmount, String? refundStatus}) {
    final statusNorm = (refundStatus ?? '').trim().toLowerCase();
    final isRefunded = statusNorm == 'refunded';
    final isPending = !isRefunded;
    final bgColor = isRefunded
        ? const Color(0xffE8F5E9)
        : const Color(0xffFFFDE7);
    final borderColor = isRefunded
        ? const Color(0xff4CAF50)
        : const Color(0xffFFC107);
    final textColor = isRefunded
        ? const Color(0xff1B5E20)
        : const Color(0xff856404);
    final icon = isRefunded
        ? Icons.check_circle_outline
        : Icons.hourglass_top_outlined;
    final headline = isRefunded
        ? 'Refund of \$${refundAmount.toStringAsFixed(2)} has been issued'
        : 'Refund of \$${refundAmount.toStringAsFixed(2)} is being processed';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: borderColor),
        boxShadow: _cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: textColor, size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: CommonText.semiBold(
                  headline,
                  size: 14,
                  color: textColor,
                ),
              ),
            ],
          ),
          if (isPending) ...[
            const SizedBox(height: 6),
            CommonText.regular(
              'Estimated 5–10 business days to appear in your account.',
              size: 12,
              color: textColor,
            ),
          ],
        ],
      ),
    );
  }

  Widget _disputeSection({String? disputeStatus}) {
    final disputeNorm = (disputeStatus ?? '').trim().toLowerCase();
    final hasOpenDispute =
        disputeNorm == 'open' || disputeNorm == 'investigating';
    final isResolved = disputeNorm == 'resolved' || disputeNorm == 'closed';

    if (!hasOpenDispute && !isResolved) {
      return const SizedBox.shrink();
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: hasOpenDispute
            ? const Color(0xffFFF3CD)
            : isResolved
            ? const Color(0xffE8F5E9)
            : const Color(0xffF5F5F5),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: hasOpenDispute
              ? const Color(0xffFFC107)
              : isResolved
              ? const Color(0xff4CAF50)
              : const Color(0xffE0E0E0),
        ),
        boxShadow: _cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                hasOpenDispute
                    ? Icons.gavel_outlined
                    : isResolved
                    ? Icons.check_circle_outline
                    : Icons.flag_outlined,
                color: hasOpenDispute
                    ? const Color(0xff856404)
                    : isResolved
                    ? const Color(0xff1B5E20)
                    : _labelGrey,
                size: 20,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: CommonText.semiBold(
                  hasOpenDispute ? 'Under Review' : 'Dispute Resolved',
                  size: 14,
                  color: hasOpenDispute
                      ? const Color(0xff856404)
                      : const Color(0xff1B5E20),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          CommonText.regular(
            hasOpenDispute
                ? 'Your dispute is being reviewed by our support team.'
                : 'Your dispute has been resolved by our support team.',
            size: 12,
            color: _labelGrey,
          ),
        ],
      ),
    );
  }

  _ServiceDetailMenuState? _deriveMoreMenuState({
    required Map args,
    required int? parsedBookingId,
    required BookingDetailData? syncedDetail,
  }) {
    final apiBookingId = syncedDetail?.id ?? parsedBookingId;
    if (apiBookingId == null) return null;

    final hasDriverAssigned =
        (args['isDriverAssigned'] == true) ||
        (syncedDetail?.status?.toLowerCase() == 'assigned') ||
        (syncedDetail?.driverId != null);
    final rawBookingStatus = _rawStatusFromDetailOrArgs(
      syncedDetail?.status,
      args['status'],
    );
    final statusLower = rawBookingStatus.toLowerCase();
    final driverPerson = controller.driverPersonFromBookingDetail(syncedDetail);
    final driverNameFromDetail = controller.bookingDriverNameFromDetail(
      driverPerson,
    );
    final driverNameFromArgs = '${args['driverName'] ?? ''}'.trim();
    final driverAvatarUrl =
        controller.avatarUrlFromDetail(driverPerson) ??
        '${args['profile_picture'] ?? ''}'.trim();
    final driverDisplayName = () {
      final fromDetail = driverNameFromDetail.trim();
      if (fromDetail.isNotEmpty &&
          fromDetail != ServiceProviderLabels.fallbackName) {
        return fromDetail;
      }
      if (driverNameFromArgs.isNotEmpty) return driverNameFromArgs;
      return '';
    }();
    final bookingCode = _coalesceText([
      syncedDetail?.bookingCode,
      args['bookingCode'],
      args['bookingId'],
    ]);

    final showChat = bookingChatVisibleForCustomer(
      statusLower: statusLower,
      hasDriverAssigned: hasDriverAssigned,
    );
    final showDownloadInvoice =
        statusLower == 'completed' &&
        (syncedDetail?.invoice ?? '').trim().isNotEmpty;
    final disputeNorm = (syncedDetail?.disputeStatus ?? '')
        .trim()
        .toLowerCase();
    final showReportIssue =
        Prefs().isCustomerRole &&
        (statusLower == 'completed' || statusLower == 'in_progress') &&
        disputeNorm.isEmpty;

    if (!showChat && !showDownloadInvoice && !showReportIssue) {
      return null;
    }

    return _ServiceDetailMenuState(
      apiBookingId: apiBookingId,
      bookingCode: bookingCode,
      statusLower: statusLower,
      driverId: syncedDetail?.driverId,
      driverDisplayName: driverDisplayName,
      driverAvatarUrl: driverAvatarUrl,
      showChat: showChat,
      showDownloadInvoice: showDownloadInvoice,
      showReportIssue: showReportIssue,
      chatLabel: bookingChatButtonLabel(statusLower, isDriverView: false),
    );
  }

  Widget _buildMoreMenu(BuildContext context, _ServiceDetailMenuState state) {
    return PopupMenuButton<String>(
      tooltip: 'More options',
      position: PopupMenuPosition.under,
      offset: const Offset(0, 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      onSelected: (value) => _onMoreMenuSelected(value, state),
      itemBuilder: (context) => [
        if (state.showChat)
          _moreMenuItem(
            value: 'chat',
            label: state.chatLabel,
            icon: Icons.chat_bubble_outline_rounded,
          ),
        if (state.showDownloadInvoice)
          _moreMenuItem(
            value: 'invoice',
            label: 'Download Invoice',
            icon: Icons.download_outlined,
            iconColor: const Color(0xff2E7D32),
          ),
        if (state.showReportIssue)
          _moreMenuItem(
            value: 'report',
            label: 'Report an Issue',
            icon: Icons.flag_outlined,
            iconColor: const Color(0xff856404),
          ),
      ],
      child: Material(
        color: Colors.white,
        shape: const CircleBorder(),
        clipBehavior: Clip.antiAlias,
        child: SizedBox(
          width: 36,
          height: 36,
          child: Icon(Icons.more_vert_rounded, color: Colors.black87, size: 20),
        ),
      ),
    );
  }

  PopupMenuItem<String> _moreMenuItem({
    required String value,
    required String label,
    required IconData icon,
    Color? iconColor,
  }) {
    return PopupMenuItem<String>(
      value: value,
      child: Row(
        children: [
          Icon(icon, size: 20, color: iconColor ?? const Color(0xff1C1C1E)),
          const SizedBox(width: 12),
          Expanded(
            child: CommonText.regular(
              label,
              size: 14,
              color: const Color(0xff1C1C1E),
            ),
          ),
        ],
      ),
    );
  }

  void _onMoreMenuSelected(String value, _ServiceDetailMenuState state) {
    switch (value) {
      case 'chat':
        final arguments = <String, dynamic>{
          'bookingId': state.apiBookingId,
          'status': state.statusLower,
          'peerId': state.driverId,
          'peerName': state.driverDisplayName,
          'peerImage': state.driverAvatarUrl,
        };
        _navigateToRoute(
          Routes.BOOKING_CHAT,
          arguments: arguments,
          parameters: arguments.map(
            (key, value) => MapEntry(key, value?.toString() ?? ''),
          ),
        );
      case 'invoice':
        unawaited(
          _downloadCustomerInvoice(
            bookingId: state.apiBookingId,
            bookingCode: state.bookingCode,
          ),
        );
      case 'report':
        _openDisputeSheet(state.apiBookingId);
    }
  }

  void _navigateToRoute(
    String route, {
    Map<String, dynamic>? arguments,
    Map<String, String>? parameters,
  }) {
    if (kIsWeb) {
      Get.rootDelegate.toNamed<void>(
        route,
        arguments: arguments,
        parameters: parameters,
      );
      return;
    }
    Get.toNamed<void>(route, arguments: arguments);
  }

  void _openDisputeSheet(int bookingId) {
    Get.bottomSheet<void>(
      _ServiceDisputeSheet(
        onSubmit: (complaint, isSubmitting) => _submitDispute(
          bookingId: bookingId,
          complaint: complaint,
          isSubmitting: isSubmitting,
        ),
      ),
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
    );
  }

  Future<void> _submitDispute({
    required int bookingId,
    required String complaint,
    required RxBool isSubmitting,
  }) async {
    if (complaint.isEmpty) {
      Get.snackbar(
        'Missing Info',
        'Please describe your issue before submitting.',
        snackPosition: SnackPosition.TOP,
        backgroundColor: Colors.red.shade600,
        colorText: Colors.white,
        margin: const EdgeInsets.all(12),
        borderRadius: 12,
      );
      return;
    }

    isSubmitting.value = true;
    try {
      final repo = controller.dashRepository;
      final res = await repo.raiseDispute(
        bookingId: bookingId,
        complaint: complaint,
      );
      res.when(
        success: (_) {
          if (Get.isBottomSheetOpen ?? false) Get.back<void>();
          Get.snackbar(
            'Dispute Submitted',
            'Your issue has been submitted. Our support team will review it shortly.',
            snackPosition: SnackPosition.TOP,
            backgroundColor: const Color(0xff1B5E20),
            colorText: Colors.white,
            duration: const Duration(seconds: 5),
            margin: const EdgeInsets.all(12),
            borderRadius: 12,
          );
          unawaited(
            controller.fetchServiceDetail(bookingId: bookingId, force: true),
          );
        },
        error: (err) {
          Get.snackbar(
            'Submission Failed',
            err.message,
            snackPosition: SnackPosition.TOP,
            backgroundColor: Colors.red.shade600,
            colorText: Colors.white,
            margin: const EdgeInsets.all(12),
            borderRadius: 12,
          );
        },
      );
    } finally {
      isSubmitting.value = false;
    }
  }

  Widget _postServiceFeedbackCard({
    required bool canReview,
    required bool canTip,
    required VoidCallback onAction,
  }) {
    final String title;
    final String subtitle;
    final String buttonLabel;
    if (canReview && canTip) {
      title = 'Rate & tip your service provider';
      subtitle =
          'Share how your service went and optionally leave a tip for your provider.';
      buttonLabel = 'Review & tip';
    } else if (canReview) {
      title = 'Rate your service provider';
      subtitle =
          'Tell us how your service went. Your feedback helps other customers.';
      buttonLabel = 'Leave a review';
    } else {
      title = 'Tip your service provider';
      subtitle = 'Show your appreciation with an optional tip.';
      buttonLabel = 'Add a tip';
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
      decoration: BoxDecoration(
        color: const Color(0xffFFF5F6),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xffF5DCDC)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CommonText.semiBold(title, size: 16, color: const Color(0xff1C1C1E)),
          const SizedBox(height: 6),
          CommonText.regular(subtitle, size: 13, color: _labelGrey),
          const SizedBox(height: 14),
          AppButton(
            label: buttonLabel,
            onPressed: onAction,
            type: ButtonType.primary,
            bgColor: _red,
            txtColor: Colors.white,
            btnCornerRadius: 12,
            vPadding: 12,
            textSize: 14,
          ),
        ],
      ),
    );
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
    const topSegH = 0.0;
    const bottomSegH = 60.0;

    /// Line + dot share the same horizontal axis in [gutterW] so the spine reads centered.
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
    if (t.isEmpty) return ('—', null);
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

  String _coalesceText(List<dynamic> candidates, [String fallback = '—']) {
    for (final c in candidates) {
      final s = '${c ?? ''}'.trim();
      if (s.isNotEmpty) return s;
    }
    return fallback;
  }

  String _formatBookingId(String code) {
    final t = code.trim();
    if (t.isEmpty || t == '—') return '—';
    if (t.startsWith('#')) return t;
    return '#$t';
  }
}

class _StatusHeroCopy {
  const _StatusHeroCopy({
    required this.headline,
    required this.subtitle,
    required this.headlineColor,
    required this.avatarUrl,
  });

  final String headline;
  final String subtitle;
  final Color headlineColor;
  final String avatarUrl;
}

class _ServiceDetailMenuState {
  const _ServiceDetailMenuState({
    required this.apiBookingId,
    required this.bookingCode,
    required this.statusLower,
    required this.driverId,
    required this.driverDisplayName,
    required this.driverAvatarUrl,
    required this.showChat,
    required this.showDownloadInvoice,
    required this.showReportIssue,
    required this.chatLabel,
  });

  final int apiBookingId;
  final String bookingCode;
  final String statusLower;
  final int? driverId;
  final String driverDisplayName;
  final String driverAvatarUrl;
  final bool showChat;
  final bool showDownloadInvoice;
  final bool showReportIssue;
  final String chatLabel;
}

/// Downloads the server-generated invoice PDF to the device (provider-style).
Future<void> _downloadCustomerInvoice({
  required int bookingId,
  String? bookingCode,
}) async {
  Loader.showLoading();
  try {
    await downloadCustomerBookingInvoice(
      bookingId: bookingId,
      bookingCode: bookingCode,
    );
  } finally {
    Loader.hideLoading();
  }
}

class _ServiceDisputeSheet extends StatefulWidget {
  const _ServiceDisputeSheet({required this.onSubmit});

  final Future<void> Function(String complaint, RxBool isSubmitting) onSubmit;

  @override
  State<_ServiceDisputeSheet> createState() => _ServiceDisputeSheetState();
}

class _ServiceDisputeSheetState extends State<_ServiceDisputeSheet> {
  static const Color _submitRed = Color(0xffC4101F);

  final TextEditingController _complaintController = TextEditingController();
  final RxBool _isSubmitting = false.obs;

  @override
  void dispose() {
    _complaintController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final mq = MediaQuery.of(context);
    final bottomInset = mq.viewInsets.bottom;
    final topPadding = mq.padding.top;

    return SafeArea(
      top: true,
      bottom: false,
      child: Wrap(
        children: [
          Container(
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
              bottomInset > 0 ? 18 + topPadding : 18,
              20,
              16 + bottomInset + mq.padding.bottom,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(
                  height: 40,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 52),
                        child: CommonText.bold(
                          'Report an Issue',
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
                            Icons.report_problem_outlined,
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
                  'Describe your issue and our support team will review it.',
                  size: 13,
                  color: Color(0xff8E8E93),
                ),
                const SizedBox(height: 12),
                CommonTextField(
                  controller: _complaintController,
                  hintText: 'Describe your issue…',
                  textColor: scheme.onSurface,
                  labelColor: scheme.onSurface,
                  hintColor: scheme.outlineVariant,
                  cursorColor: _submitRed,
                  maxLines: 7,
                  minLines: 5,
                  keyboardType: TextInputType.multiline,
                  inputAction: TextInputAction.newline,
                  bgColor: Colors.transparent,
                  borderColor: scheme.outlineVariant,
                  padding: 16,
                ),
                const SizedBox(height: 14),
                Obx(
                  () => SizedBox(
                    width: double.infinity,
                    child: AppButton(
                      label: _isSubmitting.value ? 'Submitting…' : 'Submit',
                      onPressed: _isSubmitting.value
                          ? null
                          : () => unawaited(
                              widget.onSubmit(
                                _complaintController.text.trim(),
                                _isSubmitting,
                              ),
                            ),
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
        ],
      ),
    );
  }
}

void _openCancelBookingSheet(int? apiBookingId) {
  final id = apiBookingId;
  if (id == null) return;
  final cancel = Get.find<CancelReasonController>();
  cancel.beginCancelForBooking(id);
  Get.bottomSheet<void>(
    const _ServiceCancelBookingSheet(),
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    ignoreSafeArea: false,
  ).whenComplete(() {
    if (Get.isRegistered<CancelReasonController>()) {
      Get.find<CancelReasonController>().clearExplicitCancelTarget();
    }
  });
}

class _ServiceCancelBookingSheet extends StatelessWidget {
  const _ServiceCancelBookingSheet();

  static const Color _submitRed = Color(0xffC4101F);

  @override
  Widget build(BuildContext context) {
    final cancel = Get.find<CancelReasonController>();
    final scheme = Theme.of(context).colorScheme;
    final mq = MediaQuery.of(context);
    final maxHeight =
        mq.size.height - mq.padding.top - mq.viewInsets.bottom - 8;

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
          padding: EdgeInsets.fromLTRB(20, 18, 20, 16 + mq.padding.bottom),
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
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 52),
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
                  'Are you sure you want to cancel your service please give us a reason.',
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
                          ? 'Submitting…'
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

// ── Submitted review card (shows customer's review + admin response) ──────────

class _SubmittedReviewCard extends StatelessWidget {
  const _SubmittedReviewCard({required this.review});

  final BookingDriverReview review;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xffE5E5EA)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              const Icon(
                Icons.star_rounded,
                color: Color(0xffF2C94C),
                size: 18,
              ),
              const SizedBox(width: 6),
              CommonText.semiBold(
                'Your Review',
                size: 13,
                color: const Color(0xff1C1C1E),
              ),
              const Spacer(),
              // Star rating
              Row(
                children: List.generate(5, (i) {
                  final filled = i < (review.rating ?? 0);
                  return Icon(
                    filled ? Icons.star_rounded : Icons.star_outline_rounded,
                    size: 15,
                    color: filled
                        ? const Color(0xffF2C94C)
                        : const Color(0xffC7C7CC),
                  );
                }),
              ),
            ],
          ),
          if ((review.message ?? '').trim().isNotEmpty) ...[
            const SizedBox(height: 8),
            CommonText.regular(
              review.message!.trim(),
              size: 13,
              color: const Color(0xff3A3A3C),
            ),
          ],
          // Admin response bubble
          if (review.hasAdminResponse) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xffF0F4FF),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xffC7D7F5)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.support_agent_rounded,
                        size: 15,
                        color: Color(0xff2F5CE6),
                      ),
                      const SizedBox(width: 5),
                      CommonText.semiBold(
                        'CarComfort Response',
                        size: 12,
                        color: const Color(0xff2F5CE6),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  CommonText.regular(
                    review.adminResponse!.trim(),
                    size: 13,
                    color: const Color(0xff3A3A3C),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
