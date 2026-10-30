import 'dart:async';
import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';

import '../../constants/booking_tracking_status.dart';
import '../../network/response/booking_detail_response.dart';
import '../../routes/app_pages.dart';
import '../../utils/app_snackbar.dart';
import '../../utils/booking_timer_utils.dart';
import '../../utils/booking_travel_distance.dart';
import '../../utils/driver_service_details_display.dart';
import '../../widgets/driver_service_details_card.dart';
import '../../utils/extensions/extension.dart';
import '../../widgets/blurred_image_screen_header.dart';
import '../../widgets/booking_route_plan_card.dart';
import '../../widgets/booking_service_images_card.dart';
import '../../widgets/booking_service_notes_card.dart';
import '../../widgets/booking_timer_banner.dart';
import '../../widgets/button.dart';
import '../../widgets/driver_contact_action_card.dart';
import '../../widgets/image.dart';
import '../../widgets/text.dart';
import '../../widgets/widgets.dart';
import '../dashboard/dashboard_booking_timer.dart';
import 'driver_dashboard_controller.dart';

class CarDetailsView extends StatefulWidget {
  const CarDetailsView({super.key});

  @override
  State<CarDetailsView> createState() => _CarDetailsViewState();
}

class _CarDetailsViewState extends State<CarDetailsView> {
  static const Color _danger = Color(0xffE70B1C);
  static const Color _screenBg = Color(0xffF4F4F4);
  static const Color _labelGrey = Color(0xff8E8E93);
  static const Color _darkCard = Color(0xff2C2C2E);
  static const List<BoxShadow> _cardShadow = [
    BoxShadow(color: Color(0x12000000), blurRadius: 14, offset: Offset(0, 4)),
    BoxShadow(color: Color(0x08000000), blurRadius: 4, offset: Offset(0, 1)),
  ];

  final List<String> _beforeServicePhotos = <String>[];
  final List<String> _afterServicePhotos = <String>[];
  final TextEditingController _securityPinController = TextEditingController();
  final FocusNode _securityPinFocusNode = FocusNode();
  int? _requestedBookingId;
  bool _startingService = false;
  bool _finalizingDelivery = false;
  bool _pickupPinVerified = false;
  bool _verifyingPickupPin = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadBookingDetailIfNeeded();
    });
  }

  void _loadBookingDetailIfNeeded() {
    if (!mounted) return;
    final controller = Get.find<DriverDashboardController>();
    final args = (Get.arguments is Map)
        ? Map<String, dynamic>.from(Get.arguments as Map)
        : <String, dynamic>{};
    final argBookingId = int.tryParse('${args['bookingId'] ?? ''}');
    final bookingId =
        argBookingId ??
        controller.activeDriverBookingId.value ??
        controller.serviceDetailBookingId.value;
    if ((bookingId ?? 0) > 0 && _requestedBookingId != bookingId) {
      _requestedBookingId = bookingId;
      unawaited(
        controller.fetchServiceDetail(bookingId: bookingId!, force: true),
      );
    }
  }

  @override
  void dispose() {
    _securityPinFocusNode.dispose();
    _securityPinController.dispose();
    if (Get.isRegistered<DriverDashboardController>()) {
      Get.find<DriverDashboardController>().refreshDriverHomeTripPanelFromDetail();
    }
    super.dispose();
  }

  void _dismissSecurityPinKeyboard() {
    _securityPinFocusNode.unfocus();
    if (mounted) {
      context.hideKeyboard();
    }
  }

  void _onSecurityPinChanged(String value) {
    if (_pickupPinVerified) return;
    if (value.length == 4) {
      _dismissSecurityPinKeyboard();
      unawaited(_verifyPickupPinIfReady());
    }
  }

  int? _resolveBookingId(DriverDashboardController controller) {
    final args = (Get.arguments is Map)
        ? Map<String, dynamic>.from(Get.arguments as Map)
        : <String, dynamic>{};
    final argBookingId = int.tryParse('${args['bookingId'] ?? ''}');
    return argBookingId ??
        controller.activeDriverBookingId.value ??
        controller.serviceDetailBookingId.value ??
        controller.serviceDetail.value?.id;
  }

  void _syncPickupPinVerifiedFromTracking(String? trackingStatus) {
    final verified = BookingTrackingStatus.isPickupOtpVerified(trackingStatus);
    if (verified == _pickupPinVerified) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      setState(() => _pickupPinVerified = verified);
    });
  }

  Future<void> _verifyPickupPinIfReady() async {
    if (_pickupPinVerified || _verifyingPickupPin) return;
    final pin = _securityPinController.text.trim();
    if (pin.length != 4) return;

    final controller = Get.find<DriverDashboardController>();
    final bookingId = _resolveBookingId(controller);
    if (bookingId == null || bookingId <= 0) return;

    setState(() => _verifyingPickupPin = true);
    final ok = await controller.verifyDriverPickupPin(
      bookingId: bookingId,
      pickupOtp: pin,
    );
    if (!mounted) return;
    setState(() {
      _verifyingPickupPin = false;
      if (ok) _pickupPinVerified = true;
    });
  }

  Future<void> _openPhotoSourcePicker({required bool afterService}) async {
    if (!afterService && !_pickupPinVerified) {
      showAppSnackBar(
        title: 'Security PIN required',
        message:
            'Enter and verify the customer security PIN before taking photos.',
        isError: true,
      );
      return;
    }
    await attachmentDialog(
      context,
      cameraClick: () async {
        await _addSinglePhoto(isCamera: true, afterService: afterService);
      },
      galleryClick: () async {
        await _addGalleryPhotos(afterService: afterService);
      },
    );
  }

  Future<void> _addSinglePhoto({
    required bool isCamera,
    required bool afterService,
  }) async {
    final path = await pickPicture(isCamera: isCamera);
    if (path == null || path.isEmpty) return;
    setState(() {
      if (Get.isDialogOpen == true) Get.back();
      if (afterService) {
        _afterServicePhotos.add(path);
      } else {
        _beforeServicePhotos.add(path);
      }
    });
  }

  Future<void> _addGalleryPhotos({required bool afterService}) async {
    final paths = await pickMultiImages();
    if (paths == null || paths.isEmpty) return;
    setState(() {
      if (afterService) {
        _afterServicePhotos.addAll(paths);
      } else {
        _beforeServicePhotos.addAll(paths);
      }
    });
  }

  void _removePhotoAt(int index, {required bool afterService}) {
    final list = afterService ? _afterServicePhotos : _beforeServicePhotos;
    if (index < 0 || index >= list.length) return;
    setState(() {
      list.removeAt(index);
    });
  }

  String _coalesceText(List<dynamic> values, {String fallback = '—'}) {
    for (final v in values) {
      final t = '${v ?? ''}'.trim();
      if (t.isNotEmpty) return t;
    }
    return fallback;
  }

  bool _isAfterServiceBackLocked(
    DriverDashboardController controller,
    Map<String, dynamic> args,
  ) {
    if (BookingTrackingStatus.isVehicleDelivered(
      controller.serviceDetail.value?.trackingStatus,
    )) {
      return false;
    }
    if (args['showAfterServicePhotos'] == true) return true;
    return controller.isDriverAfterServiceDeliveryLocked;
  }

  void _showAfterServiceBackBlockedMessage() {
    showAppSnackBar(
      title: 'Complete delivery',
      message:
          'Add after-service photos (optional), then tap Complete delivery to finish this booking.',
    );
  }

  String _formatBookingId(String code) {
    final t = code.trim();
    if (t.isEmpty || t == '—') return '—';
    if (t.startsWith('#')) return t;
    return '#$t';
  }

  String _formatBookingStatusLabel(String raw) {
    final normalized = raw.trim().replaceAll('_', ' ');
    if (normalized.isEmpty) return '—';
    return normalized
        .split(RegExp(r'\s+'))
        .where((w) => w.isNotEmpty)
        .map((w) => '${w[0].toUpperCase()}${w.substring(1).toLowerCase()}')
        .join(' ');
  }

  Color _bookingStatusColor(String statusLower) {
    if (statusLower == 'cancelled' || statusLower == 'canceled') {
      return _danger;
    }
    if (statusLower == 'completed' || statusLower == 'vehicle_delivered') {
      return const Color(0xff1B5E20);
    }
    return const Color(0xff1C1C1E);
  }

  String _vehicleDisplayName(Vehicle? vehicle) {
    if (vehicle == null) return '—';
    final nickname = (vehicle.nickname ?? '').trim();
    if (nickname.isNotEmpty) return nickname;
    final parts = <String>[
      if (vehicle.year != null) '${vehicle.year}',
      if ((vehicle.make ?? '').trim().isNotEmpty) vehicle.make!.trim(),
      if ((vehicle.model ?? '').trim().isNotEmpty) vehicle.model!.trim(),
    ];
    return parts.isEmpty ? '—' : parts.join(' ');
  }

  Widget _uploadTile({
    required VoidCallback? onTap,
    required String label,
    bool enabled = true,
  }) {
    return Opacity(
      opacity: enabled ? 1 : 0.45,
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 18),
          decoration: BoxDecoration(
            color: const Color(0xffF2F2F7),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xffE8E8EF)),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                enabled ? Icons.add_a_photo_outlined : Icons.lock_outline_rounded,
                size: 22,
                color: const Color(0xff636366),
              ),
              const SizedBox(height: 6),
              CommonText.medium(
                enabled ? 'Upload photos' : 'Verify PIN to upload',
                size: 14,
                color: const Color(0xff636366),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _photoThumbnails({
    required List<String> paths,
    required void Function(int index) onRemove,
  }) {
    if (paths.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Wrap(
        spacing: 10,
        runSpacing: 10,
        children: List.generate(paths.length, (index) {
          return Stack(
            clipBehavior: Clip.none,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Image.file(
                  File(paths[index]),
                  width: 72,
                  height: 72,
                  fit: BoxFit.cover,
                  cacheWidth: 144,
                  cacheHeight: 144,
                ),
              ),
              Positioned(
                top: -6,
                right: -6,
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: () => onRemove(index),
                    customBorder: const CircleBorder(),
                    child: Container(
                      width: 20,
                      height: 20,
                      decoration: const BoxDecoration(
                        color: _danger,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.close,
                        size: 12,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          );
        }),
      ),
    );
  }

  Widget _sectionCard({
    required String title,
    required IconData icon,
    required List<Widget> children,
  }) {
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
                child: Icon(icon, size: 18, color: const Color(0xff636366)),
              ),
              const SizedBox(width: 10),
              CommonText.semiBold(title, size: 17, color: const Color(0xff1C1C1E)),
            ],
          ),
          const SizedBox(height: 16),
          ...children,
        ],
      ),
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 4,
            child: CommonText.medium(label, size: 13, color: _labelGrey),
          ),
          Expanded(
            flex: 6,
            child: CommonText.semiBold(
              value,
              size: 13,
              textAlign: TextAlign.right,
              maxLines: 4,
            ),
          ),
        ],
      ),
    );
  }

  Widget _statusHeroCard({
    required String customerName,
    required String customerAvatarUrl,
    required String bookingId,
    required String bookingStatusLabel,
    required String statusLower,
    String? currentTrackingStatusLabel,
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
          ClipOval(
            child: customerAvatarUrl.isNotEmpty
                ? CachedNetworkImage(
                    imageUrl: customerAvatarUrl,
                    width: 60,
                    height: 60,
                    fit: BoxFit.cover,
                    placeholder: (_, _) => const IcUserAvatarPlaceholder(
                      size: 60,
                      backgroundColor: Color(0xffE8E8EF),
                    ),
                    errorWidget: (_, _, _) => const IcUserAvatarPlaceholder(
                      size: 60,
                      backgroundColor: Color(0xffE8E8EF),
                    ),
                  )
                : const IcUserAvatarPlaceholder(
                    size: 60,
                    backgroundColor: Color(0xffE8E8EF),
                  ),
          ),
          const SizedBox(height: 14),
          CommonText.semiBold(
            customerName,
            size: 17,
            color: const Color(0xff1C1C1E),
            maxLines: 2,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 20),
          Align(
            alignment: Alignment.centerLeft,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const CommonText.regular(
                  'BOOKING ID',
                  size: 12,
                  letterSpacing: 0.9,
                  color: _labelGrey,
                ),
                const SizedBox(height: 4),
                CommonText.semiBold(
                  _formatBookingId(bookingId),
                  size: 14,
                  color: const Color(0xff1C1C1E),
                ),
              ],
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
                    color: _bookingStatusColor(statusLower),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _radiusCard(BookingDetailData? detail) {
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
              border: Border.all(color: Colors.white38),
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
          BookingEstimatedRadiusText(detail: detail, fallback: '—'),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final controller = Get.find<DriverDashboardController>();
    final args = (Get.arguments is Map)
        ? Map<String, dynamic>.from(Get.arguments as Map)
        : <String, dynamic>{};
    final argBookingId = int.tryParse('${args['bookingId'] ?? ''}');
    final bookingId =
        argBookingId ??
        controller.activeDriverBookingId.value ??
        controller.serviceDetailBookingId.value;

    return Obx(() {
      final lockAfterServiceBack = _isAfterServiceBackLocked(controller, args);

      return PopScope(
        canPop: !lockAfterServiceBack,
        onPopInvokedWithResult: (didPop, result) {
          if (!didPop && lockAfterServiceBack) {
            _showAfterServiceBackBlockedMessage();
          }
        },
        child: Scaffold(
          backgroundColor: _screenBg,
          resizeToAvoidBottomInset: true,
          body: Column(
            children: [
              BlurredImageScreenHeader(
                title: 'Service Details',
                backgroundFit: BoxFit.fill,
                onBack: lockAfterServiceBack
                    ? _showAfterServiceBackBlockedMessage
                    : () => Get.back<void>(),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Obx(() {
                      final isRefreshing = controller.isServiceDetailLoading.value;
                      return HeaderCircleIconButton(
                        icon: Icons.refresh_rounded,
                        onTap: isRefreshing || bookingId == null
                            ? () {}
                            : () => unawaited(
                                controller.fetchServiceDetail(
                                  bookingId: bookingId,
                                  force: true,
                                ),
                              ),
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
                child: Obx(() {
                  final detail = controller.serviceDetail.value;
                  final bookingId = controller.activeDriverBookingId.value ??
                      controller.serviceDetailBookingId.value;
                  final serviceDetail = mergeDriverServiceDetailForDisplay(
                    apiDetail: detail,
                    bookingId: bookingId,
                    loadedBookingId: controller.serviceDetailBookingId.value,
                    routeArgs: Map<String, dynamic>.from(args),
                  );
                  final vehicle = detail?.vehicle;
                  final serviceNotesCard = BookingServiceNotesCard.fromDetail(
                    detail,
                    boxShadow: _cardShadow,
                  );
                  final pickupAddress = _coalesceText([
                    detail?.pickupLocation?.address,
                    detail?.address,
                  ]);
                  final dropoffAddress = _coalesceText([
                    detail?.dropoffLocation?.address,
                    detail?.pickupLocation?.address,
                    detail?.address,
                  ]);
                  final trackingNorm =
                      BookingTrackingStatus.normalizeTrackingCode(
                        detail?.trackingStatus,
                      );
                  final trackingLabel = trackingNorm.isNotEmpty
                      ? BookingTrackingStatus.customerMessageFor(trackingNorm)
                      : null;
                  final statusLower =
                      (detail?.status?.toString() ?? '').toLowerCase();
                  final bookingStatusLabel = _formatBookingStatusLabel(
                    detail?.status?.toString() ?? '',
                  );
                  final customer = detail?.customerDetail;
                  final customerName = _coalesceText([
                    customer?.name,
                    controller.activeDriverCustomerName.value,
                  ], fallback: 'Customer');
                  final customerAvatar = _coalesceText([
                    customer?.profilePicture,
                    controller.activeDriverCustomerAvatarUrl.value,
                  ], fallback: '');
                  final timeOfService = formatProviderTimeOfServiceLabel(
                    scheduleType: serviceDetail.scheduleType,
                    scheduledAtIso: bookingScheduledAtIso(
                      scheduledAt: serviceDetail.scheduledAt,
                      serviceDatetime: serviceDetail.serviceDatetime,
                    ),
                  );
                  final estimatedDuration =
                      driverActiveServiceDurationCompact(serviceDetail);
                  final earningsLabel = resolveDriverServiceProviderEarningsLabel(
                    detail: serviceDetail,
                  );
                  final ts = trackingNorm;
                  final fromArgs = args['showAfterServicePhotos'] == true;
                  final delivered = BookingTrackingStatus.isVehicleDelivered(
                    detail?.trackingStatus,
                  );
                  final showAfterFlow =
                      fromArgs ||
                      ts == BookingTrackingStatus.driverReachedCustomerReturn ||
                      ts == BookingTrackingStatus.afterImagesUploaded;
                  final showAfterEditable = showAfterFlow && !delivered;
                  // Hide the before-service upload once images have already been
                  // uploaded (tracking status at or past BEFORE_IMAGES_UPLOADED).
                  // Without this guard the 'Start Service' button stays visible
                  // and the provider can upload before-service photos twice.
                  final pastBeforeImages = BookingTrackingStatus.isAtOrPastTracking(
                    ts,
                    BookingTrackingStatus.beforeImagesUploaded,
                  );
                  final showBeforeFlow = !delivered && !showAfterFlow && !pastBeforeImages;
                  _syncPickupPinVerifiedFromTracking(trackingNorm);

                  return SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(18, 12, 18, 24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (controller.isServiceDetailLoading.value)
                          const Padding(
                            padding: EdgeInsets.only(bottom: 12),
                            child: LinearProgressIndicator(minHeight: 2),
                          ),
                        _statusHeroCard(
                          customerName: customerName,
                          customerAvatarUrl: customerAvatar,
                          bookingId: _coalesceText([
                            detail?.bookingCode,
                            detail?.id?.toString(),
                          ]),
                          bookingStatusLabel: bookingStatusLabel,
                          statusLower: statusLower,
                          currentTrackingStatusLabel: trackingLabel,
                        ),
                        const SizedBox(height: 14),
                        DriverServiceDetailsCard(
                          detail: serviceDetail,
                          timeOfService: timeOfService,
                          providerEarnings: earningsLabel,
                          estimatedDuration: estimatedDuration,
                          boxShadow: _cardShadow,
                        ),
                        const SizedBox(height: 14),
                        _radiusCard(detail),
                        const SizedBox(height: 14),
                        BookingRoutePlanCard(
                          detail: detail,
                          pickupAddress: pickupAddress,
                          dropoffAddress: dropoffAddress,
                          trackingNorm: trackingNorm,
                          cardShadow: _cardShadow,
                        ),
                        if (serviceNotesCard.hasContent) ...[
                          const SizedBox(height: 14),
                          serviceNotesCard,
                        ],
                        if (detail?.serviceImages?.hasAny == true) ...[
                          const SizedBox(height: 14),
                          BookingServiceImagesCard(
                            serviceImages: detail!.serviceImages!,
                            title: 'Vehicle Photos',
                            customerSectionTitle: 'Uploaded during booking',
                            showBeforeSection: false,
                            showAfterSection: false,
                            boxShadow: _cardShadow,
                          ),
                        ],
                        const SizedBox(height: 14),
                        _sectionCard(
                          title: 'Vehicle Information',
                          icon: Icons.directions_car_outlined,
                          children: [
                            _detailRow('Type', _coalesceText([vehicle?.vehicleType])),
                            _detailRow('Vehicle', _vehicleDisplayName(vehicle)),
                            _detailRow('Color', _coalesceText([vehicle?.color])),
                            _detailRow(
                              'License',
                              _coalesceText([vehicle?.licensePlate]),
                            ),
                            _detailRow('Make', _coalesceText([vehicle?.make])),
                            _detailRow('Model', _coalesceText([vehicle?.model])),
                          ],
                        ),
                        if (showBeforeFlow) ...[
                          const SizedBox(height: 14),
                          Row(
                            children: [
                              Expanded(
                                child: DriverContactActionCard(
                                  title: 'Call customer',
                                  icon: Icons.call_outlined,
                                  onTap: () => unawaited(
                                    controller.launchDriverCustomerPhoneCall(),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: DriverContactActionCard(
                                  title: 'Message customer',
                                  icon: Icons.forum_outlined,
                                  onTap: controller.openActiveDriverBookingChat,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),
                          _sectionCard(
                            title: 'Security PIN',
                            icon: Icons.lock_outline_rounded,
                            children: [
                              CommonText.regular(
                                _pickupPinVerified
                                    ? 'PIN verified. You can now upload before-service photos.'
                                    : 'Enter the 4-digit PIN shared by the customer to unlock photo upload.',
                                size: 13,
                                color: _pickupPinVerified
                                    ? const Color(0xff34B620)
                                    : _labelGrey,
                              ),
                              const SizedBox(height: 12),
                              Container(
                                decoration: BoxDecoration(
                                  color: const Color(0xffF2F2F7),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: const Color(0xffE8E8EF),
                                  ),
                                ),
                                child: TextField(
                                  controller: _securityPinController,
                                  focusNode: _securityPinFocusNode,
                                  readOnly: _pickupPinVerified || _verifyingPickupPin,
                                  keyboardType: TextInputType.number,
                                  textInputAction: TextInputAction.done,
                                  onChanged: _onSecurityPinChanged,
                                  onSubmitted: (_) => _dismissSecurityPinKeyboard(),
                                  inputFormatters: [
                                    FilteringTextInputFormatter.digitsOnly,
                                    LengthLimitingTextInputFormatter(4),
                                  ],
                                  style: const TextStyle(
                                    fontSize: 18,
                                    color: Color(0xff1C1C1E),
                                    fontWeight: FontWeight.w600,
                                    letterSpacing: 6,
                                  ),
                                  textAlign: TextAlign.center,
                                  decoration: InputDecoration(
                                    border: InputBorder.none,
                                    hintText: _pickupPinVerified ? 'Verified' : '••••',
                                    hintStyle: const TextStyle(
                                      color: Color(0xffC7C7CC),
                                      fontSize: 18,
                                      letterSpacing: 6,
                                    ),
                                    contentPadding: const EdgeInsets.symmetric(
                                      horizontal: 12,
                                      vertical: 14,
                                    ),
                                    counterText: '',
                                    suffixIcon: _pickupPinVerified
                                        ? const Icon(
                                            Icons.check_circle_rounded,
                                            color: Color(0xff34B620),
                                          )
                                        : (_verifyingPickupPin
                                            ? const Padding(
                                                padding: EdgeInsets.all(12),
                                                child: SizedBox(
                                                  width: 18,
                                                  height: 18,
                                                  child: CircularProgressIndicator(
                                                    strokeWidth: 2,
                                                  ),
                                                ),
                                              )
                                            : null),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),
                          _sectionCard(
                            title: 'Before Service Photos',
                            icon: Icons.photo_camera_outlined,
                            children: [
                              CommonText.regular(
                                _pickupPinVerified
                                    ? 'Please upload at least 4 exterior photos and 10 interior photos before service.'
                                    : 'Verify the customer security PIN above before taking or uploading photos.',
                                size: 13,
                                color: _labelGrey,
                              ),
                              const SizedBox(height: 12),
                              _uploadTile(
                                label: 'Before service',
                                enabled: _pickupPinVerified,
                                onTap: () => _openPhotoSourcePicker(
                                  afterService: false,
                                ),
                              ),
                              _photoThumbnails(
                                paths: _beforeServicePhotos,
                                onRemove: (i) =>
                                    _removePhotoAt(i, afterService: false),
                              ),
                            ],
                          ),
                        ],
                        if (showAfterEditable) ...[
                          const SizedBox(height: 14),
                          _sectionCard(
                            title: 'After Service Photos',
                            icon: Icons.photo_library_outlined,
                            children: [
                              const CommonText.regular(
                                'Please upload at least 4 exterior photos and 10 interior photos after service.',
                                size: 13,
                                color: _labelGrey,
                              ),
                              const SizedBox(height: 12),
                              _uploadTile(
                                label: 'After service',
                                onTap: () => _openPhotoSourcePicker(
                                  afterService: true,
                                ),
                              ),
                              _photoThumbnails(
                                paths: _afterServicePhotos,
                                onRemove: (i) =>
                                    _removePhotoAt(i, afterService: true),
                              ),
                            ],
                          ),
                        ],
                        if (delivered && showAfterFlow) ...[
                          const SizedBox(height: 14),
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: const Color(0xffE8F5E9),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: const CommonText.medium(
                              'Delivery has been recorded for this booking.',
                              size: 14,
                              color: Color(0xff1B5E20),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ],
                        if (controller.serviceDetailError.value.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          CommonText.regular(
                            controller.serviceDetailError.value,
                            size: 12,
                            color: _danger,
                            textAlign: TextAlign.center,
                          ),
                        ],
                        const SizedBox(height: 80),
                      ],
                    ),
                  );
                }),
              ),
            ],
          ),
          bottomNavigationBar: Obx(() {
            final detail = controller.serviceDetail.value;
            final ts = BookingTrackingStatus.normalizeTrackingCode(
              detail?.trackingStatus,
            );
            final fromArgs = args['showAfterServicePhotos'] == true;
            final delivered = BookingTrackingStatus.isVehicleDelivered(
              detail?.trackingStatus,
            );
            final showAfterFlow =
                fromArgs ||
                ts == BookingTrackingStatus.driverReachedCustomerReturn ||
                ts == BookingTrackingStatus.afterImagesUploaded;
            final showAfterEditable = showAfterFlow && !delivered;
            final pastBeforeImages2 = BookingTrackingStatus.isAtOrPastTracking(
              ts,
              BookingTrackingStatus.beforeImagesUploaded,
            );
            final showBeforeFlow = !delivered && !showAfterFlow && !pastBeforeImages2;

            if (!showBeforeFlow && !showAfterEditable) {
              return const SizedBox.shrink();
            }

            return ColoredBox(
              color: _screenBg,
              child: SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (showBeforeFlow &&
                        controller.isBookingArrivalWaitTimerActive) ...[
                      ObxBookingTimerBanner(
                        phase: controller.bookingTimerPhase.value ??
                            'arrival_countdown',
                        tick: controller.bookingTimerTick,
                        remainingSeconds:
                            controller.bookingTimerRemainingSeconds,
                      ),
                      const SizedBox(height: 12),
                    ],
                    if (showBeforeFlow && controller.canMarkCustomerNoShow) ...[
                      Obx(() {
                        final loading = controller.isMarkingCustomerNoShow.value;
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: AppButton(
                            label: loading
                                ? 'Recording no show…'
                                : 'No show · No call',
                            onPressed: loading
                                ? null
                                : () => controller.markCustomerNoShowAsDriver(
                                    bookingId: detail?.id,
                                  ),
                            type: loading
                                ? ButtonType.disabled
                                : ButtonType.primary,
                            bgColor: const Color(0xff1C1C1E),
                            txtColor: Colors.white,
                            btnCornerRadius: 14,
                            vPadding: 12,
                          ),
                        );
                      }),
                    ],
                    if (showBeforeFlow)
                      AppButton(
                        label: _startingService
                            ? 'Please wait...'
                            : 'Start Service',
                        onPressed: _startingService || bookingId == null
                            ? null
                            : () async {
                                _dismissSecurityPinKeyboard();
                                if (_beforeServicePhotos.isEmpty) {
                                  showAppSnackBar(
                                    title: 'Before service photos',
                                    message:
                                        'Please upload at least 4 exterior photos and 10 interior photos before service.',
                                    isError: true,
                                  );
                                  return;
                                }
                                if (!_pickupPinVerified) {
                                  showAppSnackBar(
                                    title: 'Security PIN',
                                    message:
                                        'Verify the customer security PIN before starting service.',
                                    isError: true,
                                  );
                                  return;
                                }
                                final pin = _securityPinController.text.trim();
                                if (pin.length != 4) {
                                  showAppSnackBar(
                                    title: 'Security PIN',
                                    message:
                                        'Please enter the 4 digit security PIN.',
                                    isError: true,
                                  );
                                  return;
                                }
                                setState(() => _startingService = true);
                                final id = bookingId;
                                final ok = await controller
                                    .startDriverServiceFromCarDetails(
                                  bookingId: id,
                                  beforeImagePaths: _beforeServicePhotos,
                                  pickupOtp: _securityPinController.text,
                                );
                                if (!context.mounted) return;
                                setState(() => _startingService = false);
                                if (!ok) {
                                  showAppSnackBar(
                                    title: 'Start service',
                                    message:
                                        'Could not start service. Try again.',
                                    isError: true,
                                  );
                                  return;
                                }
                                if (Get.currentRoute == Routes.DRIVER_CAR_DETAILS &&
                                    Get.key.currentState?.canPop() == true) {
                                  Get.back();
                                } else {
                                  Get.until(
                                    (route) =>
                                        route.settings.name ==
                                        Routes.DRIVER_DASHBOARD,
                                  );
                                }
                              },
                        bgColor: _danger,
                        btnCornerRadius: 14,
                        vPadding: 14,
                        textSize: 15,
                      ),
                    if (showAfterEditable)
                      AppButton(
                        label: _finalizingDelivery
                            ? 'Please wait...'
                            : 'Complete delivery',
                        onPressed: _finalizingDelivery || bookingId == null
                            ? null
                            : () async {
                                // Fix: block completion if no after-service photos uploaded
                                if (_afterServicePhotos.isEmpty) {
                                  showAppSnackBar(
                                    title: 'Photos required',
                                    message:
                                        'Please upload at least 4 exterior photos and 10 interior photos after service.',
                                    isError: true,
                                  );
                                  return;
                                }
                                setState(() => _finalizingDelivery = true);
                                final id = bookingId;
                                final ok = await controller
                                    .finalizeDriverDeliveryFromCarDetails(
                                  bookingId: id,
                                  hasAfterServicePhotos:
                                      _afterServicePhotos.isNotEmpty,
                                  afterImagePaths: _afterServicePhotos,
                                );
                                if (!context.mounted) return;
                                setState(() => _finalizingDelivery = false);
                                if (!ok) {
                                  showAppSnackBar(
                                    title: 'Delivery',
                                    message:
                                        'Could not complete delivery. Try again.',
                                    isError: true,
                                  );
                                  return;
                                }
                                showAppSnackBar(
                                  title: 'Delivery',
                                  message: 'Delivery completed.',
                                );
                                Get.until(
                                  (route) =>
                                      route.settings.name ==
                                      Routes.DRIVER_DASHBOARD,
                                );
                              },
                        bgColor: _danger,
                        btnCornerRadius: 14,
                        vPadding: 14,
                        textSize: 15,
                      ),
                  ],
                ),
              ),
            ),
            );
          }),
        ),
      );
    });
  }
}
