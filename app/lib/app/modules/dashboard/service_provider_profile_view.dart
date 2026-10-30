import 'dart:async';

import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../constants/booking_tracking_status.dart';
import '../../constants/service_provider_labels.dart';
import '../../network/response/booking_detail_response.dart';
import '../../network/repository/payment_repository.dart';
import '../../network/repository/vehicle_repository.dart';
import '../../routes/app_pages.dart';
import '../../utils/app_snackbar.dart';
import '../../utils/custom_loader.dart';
import '../../utils/ev_account_card_on_file.dart';
import '../../utils/service_type_label.dart' show bookingServiceTypeDisplay;
import '../../widgets/blurred_image_screen_header.dart';
import '../../widgets/booking_service_notes_card.dart';
import '../../widgets/button.dart';
import '../../widgets/customer_booking_invoice_body.dart';
import '../../widgets/image.dart';
import '../../widgets/text.dart';
import '../../widgets/text_field.dart';
import '../../widgets/tappable_profile_avatar.dart';
import 'dashboard_controller.dart';

class ServiceProviderProfileView extends StatefulWidget {
  const ServiceProviderProfileView({super.key});

  @override
  State<ServiceProviderProfileView> createState() =>
      _ServiceProviderProfileViewState();
}

class _ServiceProviderProfileViewState
    extends State<ServiceProviderProfileView> {
  final _vehicleRepo = VehicleRepository();
  final _paymentRepo = PaymentRepository();
  final _reviewController = TextEditingController();
  final _tipController = TextEditingController();
  int _starCount = 0;
  bool _isSubmittingReview = false;
  bool _isSubmittingTip = false;

  int? _resolveRouteBookingId(DashboardController dashboard) {
    final args = (Get.arguments is Map) ? Get.arguments as Map : const {};
    final rawId =
        args['bookingId'] ??
        dashboard.postBookingApiId.value ??
        dashboard.serviceDetailBookingId.value;
    if (rawId is int && rawId > 0) return rawId;
    return int.tryParse('$rawId');
  }

  @override
  void initState() {
    super.initState();
    final dashboard = Get.find<DashboardController>();
    final bookingId = _resolveRouteBookingId(dashboard);
    if (bookingId != null && bookingId > 0) {
      dashboard.prepareServiceDetailScreen(bookingId);
      unawaited(
        dashboard.fetchServiceDetail(bookingId: bookingId, force: true),
      );
    }
  }

  @override
  void dispose() {
    _reviewController.dispose();
    _tipController.dispose();
    super.dispose();
  }

  static const Color _red = Color(0xffC4101F);
  static const Color _cardBg = Color(0xffF2F2F7);
  static const Color _darkPill = Color(0xff2C2C2E);
  static const Color _inspectionDetailCardBg = Color(0xffF5F5F5);
  static const Color _inspectionDetailText = Color(0xff333333);
  static const Color _labelGrey = Color(0xff8E8E93);
  static const List<BoxShadow> _cardShadow = [
    BoxShadow(color: Color(0x12000000), blurRadius: 14, offset: Offset(0, 4)),
    BoxShadow(color: Color(0x08000000), blurRadius: 4, offset: Offset(0, 1)),
  ];

  bool get _isSubmitting => _isSubmittingReview || _isSubmittingTip;

  String _primarySubmitLabel({
    required bool feedbackOnly,
    required bool canReview,
    required bool canTip,
  }) {
    if (_isSubmitting) return 'Submitting...';
    if (!feedbackOnly) {
      if (canReview && canTip) return 'Complete service';
      if (canReview) return 'Submit review & complete';
      if (canTip) return 'Complete (tip optional)';
      return 'Complete service';
    }
    if (canReview && canTip) return 'Submit review & tip';
    if (canReview) return 'Submit review';
    if (canTip) return 'Add tip (optional)';
    return 'Done';
  }

  @override
  Widget build(BuildContext context) {
    final args = Get.arguments;
    final inspectionMode = args is Map && args['inspectionMode'] == true;
    final feedbackOnly = args is Map && args['feedbackOnly'] == true;
    final fullInspection = inspectionMode && !feedbackOnly;
    final dashboard = Get.find<DashboardController>();

    return Scaffold(
      backgroundColor: Colors.white,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          BlurredImageScreenHeader(
            title: 'Service Details',
            backgroundFit: BoxFit.fill,
            trailing: HeaderCircleIconButton(
              icon: Icons.notifications_none_rounded,
              onTap: () => Get.toNamed(Routes.NOTIFICATIONS),
            ),
          ),
          Expanded(
            child: Obx(() {
              final requestedId = _resolveRouteBookingId(dashboard);
              final rawDetail = dashboard.serviceDetail.value;
              final detail = requestedId != null && rawDetail?.id == requestedId
                  ? rawDetail
                  : null;
              final loading =
                  requestedId != null &&
                  dashboard.isServiceDetailLoading.value &&
                  dashboard.serviceDetailBookingId.value == requestedId;
              final error = dashboard.serviceDetailError.value.trim();

              if (requestedId != null && detail == null && error.isEmpty) {
                return const Padding(
                  padding: EdgeInsets.symmetric(vertical: 48),
                  child: Center(child: CircularProgressIndicator()),
                );
              }

              return SingleChildScrollView(
                child: SafeArea(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (loading)
                        const Padding(
                          padding: EdgeInsets.only(bottom: 12),
                          child: LinearProgressIndicator(minHeight: 2),
                        ),
                      if (error.isNotEmpty) ...[
                        CommonText.regular(
                          error,
                          size: 12,
                          color: Colors.red.shade400,
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 12),
                      ],
                      if (!fullInspection) ...[
                        _providerHeader(detail, dashboard),
                        const SizedBox(height: 14),
                      ],
                      if (fullInspection) ...[
                        _inspectionMapPreviewCard(),
                        const SizedBox(height: 10),
                      ],
                      if (detail != null && fullInspection) ...[
                        CustomerBookingInvoiceBody(
                          detail: detail,
                          loading: loading,
                          showProviderHeader: true,
                        ),
                      ] else if (detail != null) ...[
                        if (!inspectionMode) ...[
                          _serviceSummaryCard(detail, dashboard),
                          const SizedBox(height: 14),
                        ],
                        if (!feedbackOnly) ...[
                          _noteCard(detail),
                          const SizedBox(height: 14),
                          _bookingStatusCard(detail),
                          const SizedBox(height: 12),
                        ],
                      ] else if (!loading) ...[
                        _noteCard(null),
                        const SizedBox(height: 14),
                      ],
                      if (!feedbackOnly && !fullInspection) ...[
                        _contactRow(dashboard),
                        const SizedBox(height: 20),
                        if (detail?.serviceImages?.beforeUrls.isNotEmpty ==
                            true) ...[
                          _picturesSection(
                            'Before Pictures:',
                            detail!.serviceImages!.beforeUrls,
                          ),
                          const SizedBox(height: 6),
                        ],
                        if (detail?.serviceImages?.afterUrls.isNotEmpty == true)
                          _picturesSection(
                            'After Pictures:',
                            detail!.serviceImages!.afterUrls,
                          ),
                        if (detail != null &&
                            detail.serviceImages?.hasAny != true) ...[
                          _emptyPhotosPlaceholder(),
                          const SizedBox(height: 6),
                        ],
                      ],
                      if (feedbackOnly &&
                          detail != null &&
                          !loading &&
                          !detail.canCustomerReviewDriver &&
                          !detail.canCustomerTipDriver) ...[
                        const SizedBox(height: 12),
                        _feedbackAlreadyCompleteCard(detail),
                      ],
                      if (inspectionMode &&
                          detail != null &&
                          (detail.canCustomerReviewDriver ||
                              detail.canCustomerTipDriver)) ...[
                        const SizedBox(height: 8),
                        _InspectionRatingSection(
                          reviewController: _reviewController,
                          tipController: _tipController,
                          starCount: _starCount,
                          showReview: detail.canCustomerReviewDriver,
                          showTip: detail.canCustomerTipDriver,
                          onStarChanged: (count) {
                            if (!mounted) return;
                            setState(() => _starCount = count);
                          },
                        ),
                      ],
                      if (inspectionMode &&
                          detail != null &&
                          (detail.canCustomerReviewDriver ||
                              detail.canCustomerTipDriver)) ...[
                        const SizedBox(height: 16),
                        SizedBox(
                          width: double.infinity,
                          child: AppButton(
                            label: _primarySubmitLabel(
                              feedbackOnly: feedbackOnly,
                              canReview: detail.canCustomerReviewDriver,
                              canTip: detail.canCustomerTipDriver,
                            ),
                            onPressed: _isSubmitting
                                ? null
                                : () => unawaited(
                                    _handlePrimarySubmit(
                                      context,
                                      feedbackOnly: feedbackOnly,
                                      canReview: detail.canCustomerReviewDriver,
                                      canTip: detail.canCustomerTipDriver,
                                    ),
                                  ),
                            type: ButtonType.primary,
                            bgColor: _red,
                            txtColor: Colors.white,
                            btnCornerRadius: 12,
                            vPadding: 13,
                            textSize: 14,
                          ),
                        ),
                      ],
                    ],
                  ).marginSymmetric(horizontal: 16, vertical: 8),
                ),
              );
            }),
          ),
        ],
      ),
    );
  }

  Widget _providerHeader(BookingDetailData? detail, DashboardController dash) {
    final driverPerson = dash.driverPersonFromBookingDetail(detail);
    final name = detail != null
        ? dash.bookingDriverNameFromDetail(driverPerson)
        : ServiceProviderLabels.fallbackName;
    final avatarUrl =
        (detail != null ? dash.avatarUrlFromDetail(driverPerson) : null)
            ?.trim() ??
        '';
    final displayName = name.trim().isEmpty
        ? ServiceProviderLabels.fallbackName
        : name.trim();

    return Container(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: _cardShadow,
      ),
      child: Column(
        children: [
          TappableProfileAvatar(
            imageUrl: avatarUrl,
            size: 72,
            previewProviderName: displayName,
          ),
          const SizedBox(height: 6),
          const CommonText.regular(
            'Tap photo to enlarge',
            size: 11,
            color: _labelGrey,
            textAlign: TextAlign.center,
          ),
          CommonText.semiBold(
            displayName,
            size: 17,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),
          const CommonText.regular(
            ServiceProviderLabels.fallbackNameYour,
            size: 13,
            color: _labelGrey,
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _serviceSummaryCard(
    BookingDetailData detail,
    DashboardController dash,
  ) {
    final serviceType = bookingServiceTypeDisplay(
      detail.serviceType ?? detail.serviceTypeLabel ?? '',
    );
    final rows = <(String, String)>[
      ('Services Type:', serviceType.isEmpty ? '—' : serviceType),
      ('Date & Time:', _formatBookingDateTime(detail)),
      (
        'Booking ID:',
        _coalesceText([detail.bookingCode, detail.id?.toString()], '—'),
      ),
    ];
    return _keyValueCard(rows);
  }

  Widget _bookingStatusCard(BookingDetailData detail) {
    final tracking = BookingTrackingStatus.normalizeTrackingCode(
      detail.trackingStatus,
    );
    final trackingLabel = tracking.isNotEmpty
        ? BookingTrackingStatus.customerMessageFor(tracking)
        : '—';
    final status = _titleize('${detail.status ?? ''}');
    return _keyValueCard([
      ('Booking Status:', status.isEmpty ? '—' : status),
      ('Current Status:', trackingLabel),
    ]);
  }

  Widget _keyValueCard(List<(String label, String value)> rows) {
    const dividerColor = Color(0xffE0E0E0);
    return Container(
      decoration: BoxDecoration(
        color: _inspectionDetailCardBg,
        borderRadius: BorderRadius.circular(12),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          for (var i = 0; i < rows.length; i++) ...[
            if (i > 0)
              const Divider(height: 1, thickness: 1, color: dividerColor),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: CommonText.medium(
                      rows[i].$1,
                      size: 13,
                      color: _inspectionDetailText,
                    ),
                  ),
                  Flexible(
                    child: CommonText.regular(
                      rows[i].$2,
                      size: 13,
                      color: Colors.grey.shade700,
                      textAlign: TextAlign.right,
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

  Widget _emptyPhotosPlaceholder() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
      decoration: BoxDecoration(
        color: _cardBg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: CommonText.regular(
        'Service photos will appear here once uploaded.',
        size: 12,
        color: Colors.grey.shade600,
        textAlign: TextAlign.center,
      ),
    );
  }

  String _coalesceText(List<dynamic> candidates, [String fallback = '—']) {
    for (final c in candidates) {
      final s = '${c ?? ''}'.trim();
      if (s.isNotEmpty) return s;
    }
    return fallback;
  }

  String _formatBookingDateTime(BookingDetailData detail) {
    for (final raw in [
      detail.scheduledAt,
      detail.serviceDatetime,
      detail.createdAt,
    ]) {
      final s = '${raw ?? ''}'.trim();
      if (s.isEmpty) continue;
      final dt = DateTime.tryParse(s);
      if (dt == null) return s;
      final local = dt.toLocal();
      const months = [
        'JAN',
        'FEB',
        'MAR',
        'APR',
        'MAY',
        'JUN',
        'JUL',
        'AUG',
        'SEP',
        'OCT',
        'NOV',
        'DEC',
      ];
      final mon = months[local.month - 1];
      final day = local.day.toString();
      final year = local.year.toString();
      final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
      final minute = local.minute.toString().padLeft(2, '0');
      final ap = local.hour >= 12 ? 'PM' : 'AM';
      return '$mon, $day,$year,$hour:$minute $ap';
    }
    return '—';
  }

  String _titleize(String input) {
    final clean = input.trim().replaceAll('_', ' ');
    if (clean.isEmpty) return '';
    return clean
        .split(RegExp(r'\s+'))
        .where((w) => w.isNotEmpty)
        .map((w) => '${w[0].toUpperCase()}${w.substring(1).toLowerCase()}')
        .join(' ');
  }

  /// Map-style preview + EV / home pins (inspection mode only).
  Widget _inspectionMapPreviewCard() {
    const radius = 16.0;
    const height = 172.0;
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: SizedBox(
        height: height,
        width: double.infinity,
        child: Stack(
          fit: StackFit.expand,
          children: [
            const CustomPaint(painter: _InspectionMapSketchPainter()),
            Positioned(
              left: 16,
              top: 16,
              child: _inspectionMapPin(icon: Icons.electric_bolt_rounded),
            ),
            Positioned(
              right: 16,
              top: 16,
              child: _inspectionMapPin(icon: Icons.home_rounded),
            ),
          ],
        ),
      ),
    );
  }

  Widget _inspectionMapPin({required IconData icon}) {
    return Container(
      width: 36,
      height: 36,
      decoration: const BoxDecoration(
        color: Colors.black,
        shape: BoxShape.circle,
      ),
      alignment: Alignment.center,
      child: Icon(icon, color: Colors.white, size: 18),
    );
  }

  Widget _noteCard(BookingDetailData? detail) {
    final card = BookingServiceNotesCard.fromDetail(detail);
    if (card.hasContent) {
      return card;
    }
    final notes = _coalesceText([
      sanitizeEvAccountCardOnFileNotes(detail?.notes),
    ], '');
    final parking = _coalesceText([detail?.parkingInstructions], '');
    final body = notes.isNotEmpty
        ? notes
        : (parking.isNotEmpty
              ? parking
              : 'No additional notes for this booking.');
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: _cardBg,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const CommonText.medium(
            'Notes',
            size: 13,
            color: Colors.black87,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          CommonText.regular(
            body,
            size: 12,
            color: Colors.grey.shade700,
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _contactRow(DashboardController dashboard) {
    return Row(
      children: [
        Expanded(
          child: _contactTile(
            'Phone Call',
            Icons.phone_outlined,
            onTap: () => unawaited(dashboard.launchCustomerDriverPhoneCall()),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _contactTile(
            'Messages',
            Icons.chat_bubble_outline_rounded,
            onTap: dashboard.openActiveCustomerBookingChat,
          ),
        ),
      ],
    );
  }

  Widget _contactTile(
    String label,
    IconData icon, {
    required VoidCallback onTap,
  }) {
    return Material(
      color: _darkPill,
      borderRadius: BorderRadius.circular(16),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: SizedBox(
          height: 84,
          child: Stack(
            children: [
              Positioned(
                left: 14,
                top: 14,
                child: CommonText.medium(label, size: 13, color: Colors.white),
              ),
              Positioned(
                right: 10,
                bottom: 8,
                child: Icon(
                  icon,
                  size: 32,
                  color: Colors.white.withValues(alpha: 0.85),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _picturesSection(String title, List<String> imageUrls) {
    if (imageUrls.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        CommonText.bold(title, size: 15).marginOnly(bottom: 8),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: imageUrls.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            crossAxisSpacing: 8,
            mainAxisSpacing: 8,
            childAspectRatio: 1,
          ),
          itemBuilder: (_, i) {
            final url = imageUrls[i];
            return GestureDetector(
              onTap: () => _openServiceImagePreview(url),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: ColoredBox(
                  color: _cardBg,
                  child: ImageFromNetwork(
                    url,
                    width: double.infinity,
                    height: double.infinity,
                    fit: BoxFit.cover,
                    placeholderWidget: const Center(
                      child: Icon(
                        Icons.image_outlined,
                        color: Color(0xffC7C7CC),
                        size: 28,
                      ),
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ],
    );
  }

  void _openServiceImagePreview(String imageUrl) {
    final url = imageUrl.trim();
    if (url.isEmpty) return;
    Get.dialog<void>(
      Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.all(20),
        child: Stack(
          alignment: Alignment.topRight,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: InteractiveViewer(
                minScale: 0.8,
                maxScale: 4,
                child: ImageFromNetwork(
                  url,
                  width: Get.width - 40,
                  height: Get.height * 0.65,
                  fit: BoxFit.contain,
                ),
              ),
            ),
            IconButton(
              onPressed: () => Get.back<void>(),
              icon: const Icon(Icons.close_rounded, color: Colors.white),
              style: IconButton.styleFrom(
                backgroundColor: const Color(0x99000000),
              ),
            ),
          ],
        ),
      ),
      barrierDismissible: true,
    );
  }

  Widget _feedbackAlreadyCompleteCard(BookingDetailData detail) {
    final reviewed = detail.hasCustomerReviewedDriver;
    final tipped = detail.hasCustomerTippedDriver;
    final submittedReview = detail.assignedDriver?.review;
    final message = reviewed && tipped
        ? 'You have already submitted your review and tip for this booking.'
        : reviewed
        ? 'You have already submitted your review for this booking.'
        : tipped
        ? 'You have already sent a tip for this booking.'
        : 'There is nothing left to submit for this booking.';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Confirmation card
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xffEEF7EE),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xffC8E6C9)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const CommonText.semiBold(
                'All set',
                size: 16,
                color: Color(0xff1C1C1E),
              ),
              const SizedBox(height: 6),
              CommonText.regular(message, size: 13, color: Colors.grey),
              const SizedBox(height: 14),
              AppButton(
                label: 'Back to booking',
                onPressed: () => Get.back<void>(),
                type: ButtonType.primary,
                bgColor: _red,
                txtColor: Colors.white,
                btnCornerRadius: 12,
                vPadding: 12,
                textSize: 14,
              ),
            ],
          ),
        ),
        // Submitted review + admin response
        if (reviewed && submittedReview != null) ...[
          const SizedBox(height: 12),
          _ReviewSummaryCard(review: submittedReview),
        ],
      ],
    );
  }

  Future<void> _handlePrimarySubmit(
    BuildContext context, {
    required bool feedbackOnly,
    required bool canReview,
    required bool canTip,
  }) async {
    if (feedbackOnly) {
      await _submitFeedbackOnly(context, canReview: canReview, canTip: canTip);
      return;
    }
    await _completeInspectionFlow(context);
  }

  bool _isReviewFormComplete() => _starCount > 0;

  bool _hasTipAmount() => _parseOptionalTipAmount() != null;

  Future<void> _submitFeedbackOnly(
    BuildContext context, {
    required bool canReview,
    required bool canTip,
  }) async {
    final dashboard = Get.find<DashboardController>();
    final bookingId = dashboard.postBookingApiId.value;
    if (bookingId == null) return;

    final reviewReady = canReview && _isReviewFormComplete();
    final tipReady = canTip && _hasTipAmount();
    final tipOnlyMode = !canReview && canTip;

    if (!reviewReady && !tipReady) {
      if (canReview && canTip) {
        showAppSnackBar(
          title: 'Review & tip',
          message:
              'Submit your review, enter a tip, or do one now and complete the other later from booking details.',
          isError: true,
        );
      } else if (canReview) {
        showAppSnackBar(
          title: 'Review',
          message: 'Please select a rating.',
          isError: true,
        );
      } else if (canTip) {
        // Tip is optional — allow proceeding without entering an amount
        // Do not block; fall through so user can skip tip
      }
      // Only block if there's nothing to submit at all
      if (!canTip) return;
    }

    var submitted = false;

    if (reviewReady) {
      final reviewOk = await _submitInspectionReview();
      if (!reviewOk || !mounted) return;
      submitted = true;
      await dashboard.fetchServiceDetail(bookingId: bookingId, force: true);
    }

    if (!mounted) return;

    final tipStillAllowed =
        dashboard.serviceDetail.value?.canCustomerTipDriver ?? false;
    if (tipReady && tipStillAllowed) {
      final tipOk = await _submitOptionalTip(
        bookingId: bookingId,
        tipRequired: false,
      );
      if (!tipOk || !mounted) return;
      submitted = true;
      await dashboard.fetchServiceDetail(bookingId: bookingId, force: true);
    }

    // If tip was skipped (optional), treat as done and close
    final tipSkipped = tipOnlyMode && !tipReady && !submitted;

    if (!mounted || (!submitted && !tipSkipped)) return;

    if (!context.mounted) return;
    final detail = dashboard.serviceDetail.value;
    final reviewPending = detail?.canCustomerReviewDriver ?? false;
    final tipPending = detail?.canCustomerTipDriver ?? false;

    if (reviewPending && !tipPending) {
      showAppSnackBar(
        title: 'Review submitted',
        message: 'You can add an optional tip anytime from Service Details.',
      );
    } else if (!reviewPending &&
        dashboard.postBookingStage.value == PostBookingStage.carBackHome) {
      dashboard.finishCustomerPostDeliveryInspection(bookingId: bookingId);
    } else if (tipPending && !reviewPending) {
      showAppSnackBar(
        title: 'Tip sent',
        message: 'You can still leave a review from Service Details.',
      );
    }

    Get.back<void>();
  }

  Future<bool> _submitInspectionReview() async {
    final dashboard = Get.find<DashboardController>();
    final bookingId = dashboard.postBookingApiId.value;

    if (bookingId == null) {
      showAppSnackBar(
        title: 'Review',
        message: 'Booking id not found. Please try again.',
        isError: true,
      );
      return false;
    }
    if (_starCount <= 0) {
      showAppSnackBar(
        title: 'Review',
        message: 'Please select a rating.',
        isError: true,
      );
      return false;
    }

    final message = _reviewController.text.trim();

    _isSubmittingReview = true;
    Loader.showLoading();
    try {
      final result = await _vehicleRepo.submitBookingReview(
        bookingId: bookingId,
        rating: _starCount,
        message: message,
        isSatisfied: _starCount >= 4,
      );

      var ok = false;
      result.when(
        success: (res) {
          ok = true;
          showAppSnackBar(
            title: 'Review',
            message: (res.message ?? 'Review submitted successfully').trim(),
          );
          unawaited(
            dashboard.fetchServiceDetail(bookingId: bookingId, force: true),
          );
        },
        error: (err) {
          showAppSnackBar(
            title: 'Review failed',
            message: err.message,
            isError: true,
          );
        },
      );
      return ok;
    } finally {
      Loader.hideLoading();
      _isSubmittingReview = false;
      if (mounted) setState(() {});
    }
  }

  double? _parseOptionalTipAmount() {
    final raw = _tipController.text.trim().replaceAll(RegExp(r'[$,\s]'), '');
    if (raw.isEmpty) return null;
    final amount = double.tryParse(raw);
    if (amount == null || amount < 1 || amount > 500) return null;
    return double.parse(amount.toStringAsFixed(2));
  }

  Future<String?> _resolveDefaultPaymentMethodId() async {
    final result = await _paymentRepo.listCards();
    var defaultId = '';
    result.when(
      success: (res) {
        final data = res.data;
        if (data is Map) {
          final fromRoot = data['default_payment_method_id'];
          if (fromRoot != null && '$fromRoot'.trim().isNotEmpty) {
            defaultId = '$fromRoot'.trim();
            return;
          }
          final cards = data['cards'];
          if (cards is List) {
            for (final item in cards) {
              if (item is! Map) continue;
              if (item['is_default'] == true) {
                defaultId = '${item['id'] ?? ''}'.trim();
                break;
              }
            }
          }
        }
      },
      error: (_) {},
    );
    return defaultId.isEmpty ? null : defaultId;
  }

  Future<bool> _submitOptionalTip({
    required int bookingId,
    bool tipRequired = false,
  }) async {
    final amount = _parseOptionalTipAmount();
    if (amount == null) {
      final raw = _tipController.text.trim();
      if (raw.isEmpty) {
        if (tipRequired) {
          showAppSnackBar(
            title: 'Tip',
            message: 'Please enter a tip amount.',
            isError: true,
          );
          return false;
        }
        return true;
      }
      showAppSnackBar(
        title: 'Tip',
        message: 'Enter a tip between \$1 and \$500, or leave blank.',
        isError: true,
      );
      return false;
    }

    final paymentMethodId = await _resolveDefaultPaymentMethodId();
    if (paymentMethodId == null) {
      showAppSnackBar(
        title: 'Tip',
        message: 'Add a payment card in Settings before sending a tip.',
        isError: true,
      );
      return false;
    }

    _isSubmittingTip = true;
    if (mounted) setState(() {});
    Loader.showLoading();
    try {
      final result = await _vehicleRepo.submitBookingTip(
        bookingId: bookingId,
        amount: amount,
        paymentMethodId: paymentMethodId,
      );
      var ok = false;
      result.when(
        success: (res) {
          ok = true;
          showAppSnackBar(
            title: 'Tip',
            message: (res.message ?? 'Thank you for your tip!').trim(),
          );
        },
        error: (err) {
          showAppSnackBar(
            title: 'Tip failed',
            message: err.message,
            isError: true,
          );
        },
      );
      return ok;
    } finally {
      Loader.hideLoading();
      _isSubmittingTip = false;
      if (mounted) setState(() {});
    }
  }

  Future<void> _completeInspectionFlow(BuildContext context) async {
    final dashboard = Get.find<DashboardController>();
    final bookingId = dashboard.postBookingApiId.value;
    final detail = dashboard.serviceDetail.value;
    final needReview = detail?.canCustomerReviewDriver ?? true;
    var submittedReview = false;
    var submittedTip = false;

    if (needReview) {
      final reviewOk = await _submitInspectionReview();
      if (!reviewOk || !mounted) return;
      submittedReview = true;
    }

    if (bookingId != null) {
      final canTipNow =
          dashboard.serviceDetail.value?.canCustomerTipDriver ?? true;
      if (canTipNow && _hasTipAmount()) {
        final tipOk = await _submitOptionalTip(bookingId: bookingId);
        if (!tipOk || !mounted) return;
        submittedTip = true;
        await dashboard.fetchServiceDetail(bookingId: bookingId, force: true);
      }
    }

    if (bookingId != null) {
      await dashboard.fetchServiceDetail(bookingId: bookingId, force: true);
      if (!(dashboard.serviceDetail.value?.canCustomerReviewDriver ?? true)) {
        dashboard.finishCustomerPostDeliveryInspection(bookingId: bookingId);
      }
    }

    if (!context.mounted) return;
    _showCompletionSheet(
      context,
      inspectionMode: true,
      submittedReview: submittedReview,
      submittedTip: submittedTip,
    );
  }

  ({String title, String subtitle}) _completionSheetCopy({
    required bool submittedReview,
    required bool submittedTip,
  }) {
    if (submittedTip && submittedReview) {
      return (
        title: 'All set',
        subtitle: 'Thank you for your review and tip.\nGo back to home',
      );
    }
    if (submittedTip) {
      return (
        title: 'Payment complete',
        subtitle: 'Your tip payment was successful.\nGo back to home',
      );
    }
    if (submittedReview) {
      return (
        title: 'Service complete',
        subtitle: 'Thank you for your review.\nGo back to home',
      );
    }
    return (
      title: 'Service complete',
      subtitle: 'Your service has been completed.\nGo back to home',
    );
  }

  void _showCompletionSheet(
    BuildContext context, {
    required bool inspectionMode,
    bool submittedReview = false,
    bool submittedTip = false,
  }) {
    final copy = _completionSheetCopy(
      submittedReview: submittedReview,
      submittedTip: submittedTip,
    );
    showModalBottomSheet(
      context: context,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      isDismissible: false,
      enableDrag: false,
      builder: (_) => Container(
        margin: const EdgeInsets.fromLTRB(8, 0, 8, 10),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          border: Border(top: BorderSide(color: _red, width: 3)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 82,
              height: 82,
              decoration: const BoxDecoration(
                color: Color(0xff34B620),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.check_rounded,
                color: Colors.white,
                size: 44,
              ),
            ),
            const SizedBox(height: 12),
            CommonText.bold(copy.title, size: 18, textAlign: TextAlign.center),
            const SizedBox(height: 6),
            CommonText.regular(
              copy.subtitle,
              size: 12,
              color: Colors.grey.shade700,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 14),
            SafeArea(
              child: AppButton(
                label: 'Go Home',
                onPressed: () async {
                  if (!context.mounted) return;
                  Navigator.of(context).pop();
                  final dashboard = Get.find<DashboardController>();
                  dashboard.clearPostBookingJourney();
                  dashboard.homeNavIndex.value = 0;
                  Get.offNamedUntil(Routes.DASHBOARD, (route) => false);
                },
                type: ButtonType.primary,
                bgColor: _red,
                txtColor: Colors.white,
                btnCornerRadius: 14,
                vPadding: 13,
                textSize: 16,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InspectionRatingSection extends StatefulWidget {
  const _InspectionRatingSection({
    required this.reviewController,
    required this.tipController,
    required this.starCount,
    required this.showReview,
    required this.showTip,
    required this.onStarChanged,
  });

  final TextEditingController reviewController;
  final TextEditingController tipController;
  final int starCount;
  final bool showReview;
  final bool showTip;
  final ValueChanged<int> onStarChanged;

  @override
  State<_InspectionRatingSection> createState() =>
      _InspectionRatingSectionState();
}

class _InspectionRatingSectionState extends State<_InspectionRatingSection> {
  static const Color _reviewFill = Color(0xffF2F2F7);

  @override
  Widget build(BuildContext context) {
    final muted = Colors.grey.shade700;
    final labelColor = Colors.grey.shade800;

    final title = widget.showReview && widget.showTip
        ? 'Rate Your Service Provider'
        : widget.showReview
        ? 'Rate Your Service Provider'
        : 'Tip Your Service Provider';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Center(
          child: CommonText.bold(
            title,
            size: 15,
            color: Colors.black87,
            textAlign: TextAlign.center,
          ),
        ),
        if (widget.showReview) ...[
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(5, (i) {
              final selected = i < widget.starCount;
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: InkWell(
                  onTap: () => widget.onStarChanged(i + 1),
                  customBorder: const CircleBorder(),
                  child: Icon(
                    Icons.star_rounded,
                    size: 32,
                    color: selected
                        ? const Color(0xffFFB800)
                        : const Color(0xffE7E7EC),
                  ),
                ),
              );
            }),
          ),
          const SizedBox(height: 20),
          CommonTextField(
            controller: widget.reviewController,
            labelColor: labelColor,
            labelText: 'Review Message (Optional)',
            hintText: 'Enter review message here',
            maxLines: 5,
            minLines: 4,
            keyboardType: TextInputType.multiline,
            inputAction: TextInputAction.newline,
            borderRadius: 12,
            bgColor: _reviewFill,
            borderColor: const Color(0xffE0E0E0),
            textColor: Colors.black87,
            hintColor: Colors.grey.shade500,
            padding: 14,
          ),
        ],
        if (widget.showTip) ...[
          SizedBox(height: widget.showReview ? 18 : 12),
          CommonTextField(
            controller: widget.tipController,
            labelText: widget.showReview ? 'Add Tip (Optional)' : 'Tip Amount',
            labelColor: labelColor,
            hintText: 'Enter Your Tip Here',
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputAction: TextInputAction.done,
            bgColor: Colors.transparent,
            borderColor: Colors.grey.shade300,
            textColor: Colors.black87,
            hintColor: Colors.grey.shade500,
            padding: 14,
            suffixIcon: Icon(
              Icons.attach_money_rounded,
              color: muted,
              size: 24,
            ),
            iconConstraints: const BoxConstraints(
              minWidth: 44,
              maxWidth: 44,
              minHeight: 40,
              maxHeight: 40,
            ),
          ),
        ],
      ],
    );
  }
}

/// Light “street map” sketch for the inspection map preview (no tiles / API).
class _InspectionMapSketchPainter extends CustomPainter {
  const _InspectionMapSketchPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final base = Paint()..color = const Color(0xffE8E5DE);
    canvas.drawRect(Offset.zero & size, base);

    final major = Paint()
      ..color = const Color(0xffD4D0C8)
      ..strokeWidth = 4
      ..strokeCap = StrokeCap.round;
    final minor = Paint()
      ..color = const Color(0xffCEC9BF)
      ..strokeWidth = 2.2
      ..strokeCap = StrokeCap.round;

    canvas.drawLine(
      Offset(0, size.height * 0.32),
      Offset(size.width, size.height * 0.38),
      major,
    );
    canvas.drawLine(
      Offset(size.width * 0.15, 0),
      Offset(size.width * 0.22, size.height),
      minor,
    );
    canvas.drawLine(
      Offset(size.width * 0.55, 0),
      Offset(size.width * 0.48, size.height),
      minor,
    );
    canvas.drawLine(
      Offset(0, size.height * 0.62),
      Offset(size.width, size.height * 0.58),
      major,
    );
    canvas.drawLine(
      Offset(size.width * 0.78, 0),
      Offset(size.width * 0.72, size.height),
      minor,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// ── Submitted review summary card ─────────────────────────────────────────────

class _ReviewSummaryCard extends StatelessWidget {
  const _ReviewSummaryCard({required this.review});

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
