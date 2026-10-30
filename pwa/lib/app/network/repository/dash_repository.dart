import 'package:dio/dio.dart';

import '../../utils/image_upload_compress.dart';
import '../../network/repository/base_repository.dart';
import '../response/booking_list_response.dart';
import '../response/booking_detail_response.dart';
import '../response/booking_start_response.dart';
import '../response/booking_steps_two_res.dart';
import '../response/common_response.dart';
import 'driver_payment_history_response.dart';
import '../response/driver_stripe_connect_kyc_response.dart';
import '../response/driver_wallet_response.dart';
import '../response/notification_list_response.dart';
import '../response/unassigned_booking_response.dart';
import '../utils/network_result.dart';
import 'endpoint.dart';

class DashRepository extends BaseRepository {
  Future<NetworkResult<BookingListResponse>> getBookings({
    int page = 1,
    String? status,
    double? latitude,
    double? longitude,
  }) async {
    final query = <String, dynamic>{'page': page};
    final s = status?.trim();
    if (s != null && s.isNotEmpty) {
      query['status'] = s;
    }
    if (latitude != null && longitude != null) {
      query['latitude'] = latitude;
      query['longitude'] = longitude;
    }
    return get<BookingListResponse>(
      API.bookingList,
      query: query,
      fromJson: BookingListResponse.fromJson,
    );
  }

  /// Active trip for customer or provider (dashboard restore after relaunch).
  Future<NetworkResult<CommonResponse>> getActiveBooking() async {
    return get<CommonResponse>(
      API.bookingActive,
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<UnassignedBookingResponse>>
  getDriverNearbyUnassignedBookings({
    int page = 1,
    int limit = 10,
    double? latitude,
    double? longitude,
  }) async {
    final query = <String, dynamic>{'page': page, 'limit': limit};
    if (latitude != null &&
        longitude != null &&
        latitude.isFinite &&
        longitude.isFinite) {
      query['latitude'] = latitude;
      query['longitude'] = longitude;
    }
    return get<UnassignedBookingResponse>(
      API.driverBookingsNearbyUnassigned,
      query: query,
      fromJson: UnassignedBookingResponse.fromJson,
    );
  }

  Future<NetworkResult<BookingDetailResponse>> getBookingDetail({
    required int bookingId,
  }) async {
    return get<BookingDetailResponse>(
      API.bookingDetail(bookingId),
      fromJson: BookingDetailResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> acceptBooking({
    required int bookingId,
  }) async {
    return post<CommonResponse>(
      API.bookingAccept(bookingId),
      body: const {},
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> rejectBooking({
    required int bookingId,
  }) async {
    return post<CommonResponse>(
      API.bookingReject(bookingId),
      body: const {},
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> updateBookingTrackingStatus({
    required int bookingId,
    required String trackingStatus,
  }) async {
    return post<CommonResponse>(
      API.bookingTrackingStatus(bookingId),
      body: {'tracking_status': trackingStatus.trim()},
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> patchDriverBookingServiceLocation({
    required int bookingId,
    required String serviceAddress,
    required double serviceLatitude,
    required double serviceLongitude,
    required String reason,
  }) async {
    return patch<CommonResponse>(
      API.driverBookingServiceLocation(bookingId),
      body: {
        'service_address': serviceAddress.trim(),
        'service_latitude': serviceLatitude,
        'service_longitude': serviceLongitude,
        'reason': reason.trim(),
      },
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> verifyBookingPickupOtp({
    required int bookingId,
    required String otp,
  }) async {
    return post<CommonResponse>(
      API.bookingVerifyPickupOtp(bookingId),
      body: {'otp': otp.trim()},
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> markCustomerNoShow({
    required int bookingId,
    String? reason,
  }) async {
    return post<CommonResponse>(
      API.bookingCustomerNoShow(bookingId),
      body: {
        if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim(),
      },
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> uploadBookingServiceImagesBefore({
    required int bookingId,
    required List<String> imagePaths,
  }) {
    return _uploadBookingServiceImages(
      endpoint: API.bookingServiceImagesBefore(bookingId),
      imagePaths: imagePaths,
    );
  }

  Future<NetworkResult<CommonResponse>> uploadBookingServiceImagesAfter({
    required int bookingId,
    required List<String> imagePaths,
  }) {
    return _uploadBookingServiceImages(
      endpoint: API.bookingServiceImagesAfter(bookingId),
      imagePaths: imagePaths,
    );
  }

  Future<NetworkResult<CommonResponse>> _uploadBookingServiceImages({
    required String endpoint,
    required List<String> imagePaths,
  }) async {
    final images = <MultipartFile>[];
    for (final path in imagePaths) {
      final trimmed = path.trim();
      if (trimmed.isEmpty) continue;
      images.add(await multipartFileFromUploadImage(trimmed));
    }

    final formData = FormData.fromMap({
      if (images.isNotEmpty) 'images[]': images,
    });

    return post<CommonResponse>(
      endpoint,
      body: formData,
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<BookingStartResponse>> bookingStart({
    required String serviceType,
    required String address,
    required String latitude,
    required String longitude,
    required String serviceAddress,
    required String serviceLatitude,
    required String serviceLongitude,
  }) async {
    final body = {
      'service_type': serviceType,
      'address': address,
      'latitude': latitude,
      'longitude': longitude,
      'service_address': serviceAddress,
      'service_latitude': serviceLatitude,
      'service_longitude': serviceLongitude,
    };

    return await post<BookingStartResponse>(
      API.bookingStart,
      body: body,
      fromJson: BookingStartResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> registerDevice({
    required String oneSignalId,
    required String platform,
  }) {
    return post<CommonResponse>(
      API.registerDevice,
      body: {'onesignal_id': oneSignalId, 'platform': platform},
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<BookingStepsTwoRes>> bookingStep2({
    required int bookingId,
    int? packageId,
    String? customPackageName,
    String? customPrice,
    required String scheduleType,
    String? scheduledAt,
    String? evChargingAddress,
    double? chargingLatitude,
    double? chargingLongitude,
  }) {
    final body = {
      'package_id': packageId,
      'custom_package_name': customPackageName,
      'custom_price': customPrice,
      'schedule_type': scheduleType,
      'scheduled_at': scheduledAt,
      'ev_charging_address': evChargingAddress,
      'charging_latitude': chargingLatitude,
      'charging_longitude': chargingLongitude,
    };
    return put<BookingStepsTwoRes>(
      API.bookingSteps2(bookingId),
      body: body,
      fromJson: BookingStepsTwoRes.fromJson,
    );
  }

  Future<NetworkResult<NotificationListResponse>> getNotifications({
    int page = 1,
    int limit = 10,
  }) {
    return get<NotificationListResponse>(
      API.notifications,
      query: {'page': page, 'limit': limit},
      fromJson: NotificationListResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> deleteNotification({
    required int notificationId,
  }) {
    return delete<CommonResponse>(
      API.deleteNotification(notificationId),
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> deleteAllNotifications() {
    return delete<CommonResponse>(
      API.deleteAllNotification,
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> updateDriverPresence({
    required double lat,
    required double lng,
  }) {
    return post<CommonResponse>(
      API.driverMePresence,
      body: {'lat': lat, 'lng': lng},
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> sendDriverLocation({
    required int bookingId,
    required int providerId,
    required double lat,
    required double lng,
  }) {
    return post<CommonResponse>(
      API.driverLocation,
      body: {
        'booking_id': bookingId,
        'provider_id': providerId,
        'lat': lat,
        'lng': lng,
      },
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<DriverWalletResponse>> getDriverWallet() {
    return get<DriverWalletResponse>(
      API.driverWallet,
      fromJson: DriverWalletResponse.fromJson,
    );
  }

  Future<NetworkResult<DriverStripeConnectKycResponse>>
  getDriverStripeConnectKyc() {
    return get<DriverStripeConnectKycResponse>(
      API.driverStripeConnectKyc,
      fromJson: DriverStripeConnectKycResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> driverWalletPayout({
    required double amount,
  }) {
    return post<CommonResponse>(
      API.driverWalletPayout,
      body: <String, dynamic>{'amount': amount},
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<DriverPaymentHistoryResponse>> getCustomerBillingHistory({
    int page = 1,
    int limit = 10,
    required String status,
  }) {
    final query = <String, dynamic>{
      'page': page,
      'limit': limit,
      'status': status.trim(),
    };
    return get<DriverPaymentHistoryResponse>(
      API.customerBillingHistory,
      query: query,
      fromJson: DriverPaymentHistoryResponse.fromJson,
    );
  }

  Future<NetworkResult<DriverPaymentHistoryResponse>> getDriverWalletTransactions({
    int page = 1,
    int limit = 10,
    required String status,
  }) {
    final query = <String, dynamic>{
      'page': page,
      'limit': limit,
      'status': status.trim(),
    };
    return get<DriverPaymentHistoryResponse>(
      API.driverWalletTransactions,
      query: query,
      fromJson: DriverPaymentHistoryResponse.fromJson,
    );
  }

  Future<NetworkResult<List<int>>> downloadDriverEarningsStatement({
    String? period,
    String? from,
    String? to,
    int? year,
  }) {
    final query = <String, dynamic>{};
    if (period != null && period.trim().isNotEmpty) {
      query['period'] = period.trim();
    }
    if (from != null && from.trim().isNotEmpty) query['from'] = from.trim();
    if (to != null && to.trim().isNotEmpty) query['to'] = to.trim();
    if (year != null) query['year'] = year;
    return downloadBytes(API.driverWalletEarningsStatement, query: query);
  }

  Future<NetworkResult<List<int>>> downloadBookingInvoice({
    required int bookingId,
  }) {
    return downloadBytes(API.bookingInvoicePdf(bookingId));
  }

  /// Customer raises a dispute on a completed or in-progress booking.
  Future<NetworkResult<CommonResponse>> raiseDispute({
    required int bookingId,
    required String complaint,
  }) async {
    return post<CommonResponse>(
      API.raiseDispute(bookingId),
      body: {'complaint': complaint},
      fromJson: CommonResponse.fromJson,
    );
  }

  /// Customer: fetch latest active or next upcoming scheduled booking.
  Future<NetworkResult<CommonResponse>> fetchCustomerActiveBooking() async {
    return get<CommonResponse>(
      API.customerActiveBooking,
      fromJson: CommonResponse.fromJson,
    );
  }
}
