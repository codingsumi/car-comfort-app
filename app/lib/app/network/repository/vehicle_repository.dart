import 'package:car_comfort/app/network/response/booking_start_response.dart';
import 'package:car_comfort/app/network/response/booking_review_response.dart';
import 'package:car_comfort/app/network/response/booking_steps_two_res.dart';
import 'package:car_comfort/app/network/response/common_response.dart';
import 'package:car_comfort/app/network/response/packages_response.dart';
import 'package:dio/dio.dart';
import '../../utils/ev_account_card_on_file.dart';
import '../../utils/image_upload_compress.dart';
import '../../models/vehicle_model.dart';
import '../response/cancel_booking_response.dart';
import '../response/confirm_booking_res.dart';
import '../response/vehicle_catalog_response.dart';
import '../response/vehicle_type_response.dart';
import '../utils/network_result.dart';
import 'base_repository.dart';
import 'endpoint.dart';

class VehicleRepository extends BaseRepository {
  Future<NetworkResult<List<VehicleModel>>> getVehicles() async {
    return await get<List<VehicleModel>>(
      API.vehicles,
      fromJson: (json) {
        if (json is Map && json['data'] != null) {
          return (json['data'] as List)
              .map((e) => VehicleModel.fromJson(e))
              .toList();
        } else if (json is List) {
          return json.map((e) => VehicleModel.fromJson(e)).toList();
        }
        return [];
      },
    );
  }

  Future<NetworkResult<VehicleTypeResponse>> getVehicleType() async {
    return get<VehicleTypeResponse>(
      API.vehicleTypes,
      fromJson: VehicleTypeResponse.fromJson,
    );
  }

  Future<NetworkResult<VehicleCatalogResponse>> getVehicleCatalog() async {
    return get<VehicleCatalogResponse>(
      API.vehicleCatalog,
      fromJson: (json) {
        if (json is Map && json['data'] is Map) {
          return VehicleCatalogResponse.fromJson(json['data']);
        }
        if (json is Map<String, dynamic>) {
          return VehicleCatalogResponse.fromJson(json);
        }
        return VehicleCatalogResponse();
      },
    );
  }

  Future<NetworkResult<PackagesResponse>> getPackages({
    required String service,
  }) async {
    return get<PackagesResponse>(
      API.package,
      query: {'service': service},
      fromJson: PackagesResponse.fromJson,
    );
  }

  Future<NetworkResult<VehicleModel>> addVehicle(FormData formData) async {
    return await post<VehicleModel>(
      API.vehicles,
      body: formData,
      fromJson: (json) {
        if (json is Map && json['data'] != null) {
          return VehicleModel.fromJson(json['data']);
        }
        return VehicleModel.fromJson(json);
      },
    );
  }

  Future<NetworkResult<VehicleModel>> updateVehicle(
    int id,
    FormData formData,
  ) async {
    return await put<VehicleModel>(
      '${API.vehicles}/$id',
      body: formData,
      fromJson: (json) {
        if (json is Map && json['data'] != null) {
          return VehicleModel.fromJson(json['data']);
        }
        return VehicleModel.fromJson(json);
      },
    );
  }

  Future<NetworkResult<dynamic>> deleteVehicle(int id) async {
    return await delete<dynamic>(
      '${API.vehicles}/$id',
      fromJson: (json) => json,
    );
  }

  /// PATCH `/api/vehicles/{id}/default` — marks this vehicle as the user's default.
  Future<NetworkResult<dynamic>> setVehicleDefault(int id) async {
    return await patch<dynamic>(
      API.vehicleSetDefault(id),
      fromJson: (json) => json,
    );
  }

  Future<NetworkResult<Map<String, dynamic>>>
  getEvChargingBookingOptions() async {
    return get<Map<String, dynamic>>(
      API.evChargingBookingOptions,
      fromJson: (json) {
        if (json is Map && json['data'] is Map) {
          return Map<String, dynamic>.from(json['data'] as Map);
        }
        if (json is Map<String, dynamic>) return json;
        return <String, dynamic>{};
      },
    );
  }

  Future<NetworkResult<BookingStartResponse>> bookingStart({
    required String serviceType,
    required String address,
    required String latitude,
    required String longitude,
    required String serviceAddress,
    String? serviceLatitude,
    String? serviceLongitude,
    String? serviceLocationName,
    String? chargerType,
    bool? evAccountCardOnFile,
  }) async {
    final body = {
      'service_type': serviceType,
      'address': address,
      'latitude': latitude,
      'longitude': longitude,
      'service_address': serviceAddress,
      if (serviceLatitude != null && serviceLatitude.trim().isNotEmpty)
        'service_latitude': serviceLatitude.trim(),
      if (serviceLongitude != null && serviceLongitude.trim().isNotEmpty)
        'service_longitude': serviceLongitude.trim(),
      if (serviceLocationName != null && serviceLocationName.trim().isNotEmpty)
        'service_location_name': serviceLocationName.trim(),
      if (chargerType != null && chargerType.trim().isNotEmpty)
        'charger_type': chargerType.trim(),
      if (evAccountCardOnFile != null)
        kEvAccountCardOnFileApiField: evAccountCardOnFile,
    };

    return await post<BookingStartResponse>(
      API.bookingStart,
      body: body,
      fromJson: BookingStartResponse.fromJson,
    );
  }

  Future<NetworkResult<BookingStepsTwoRes>> bookingUpdateLocation({
    required int bookingId,
    required String address,
    required String latitude,
    required String longitude,
    required String serviceAddress,
    String? serviceLatitude,
    String? serviceLongitude,
    String? serviceLocationName,
    String? evChargingAddress,
    double? chargingLatitude,
    double? chargingLongitude,
    String? evChargingLocationName,
    String? chargerType,
    bool? evAccountCardOnFile,
  }) {
    final body = {
      'address': address,
      'latitude': latitude,
      'longitude': longitude,
      'service_address': serviceAddress,
      if (serviceLatitude != null && serviceLatitude.trim().isNotEmpty)
        'service_latitude': serviceLatitude.trim(),
      if (serviceLongitude != null && serviceLongitude.trim().isNotEmpty)
        'service_longitude': serviceLongitude.trim(),
      if (serviceLocationName != null && serviceLocationName.trim().isNotEmpty)
        'service_location_name': serviceLocationName.trim(),
      if (evChargingAddress != null && evChargingAddress.trim().isNotEmpty)
        'ev_charging_address': evChargingAddress.trim(),
      if (chargingLatitude != null) 'charging_latitude': chargingLatitude,
      if (chargingLongitude != null) 'charging_longitude': chargingLongitude,
      if (evChargingLocationName != null &&
          evChargingLocationName.trim().isNotEmpty)
        'ev_charging_location_name': evChargingLocationName.trim(),
      if (chargerType != null && chargerType.trim().isNotEmpty)
        'charger_type': chargerType.trim(),
      if (evAccountCardOnFile != null)
        kEvAccountCardOnFileApiField: evAccountCardOnFile,
    };

    return put<BookingStepsTwoRes>(
      API.bookingLocation(bookingId),
      body: body,
      fromJson: BookingStepsTwoRes.fromJson,
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
    String? evChargingLocationName,
    String? serviceLocationName,
    String? chargerType,
    bool? evAccountCardOnFile,
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
      if (evChargingLocationName != null &&
          evChargingLocationName.trim().isNotEmpty)
        'ev_charging_location_name': evChargingLocationName.trim(),
      if (serviceLocationName != null && serviceLocationName.trim().isNotEmpty)
        'service_location_name': serviceLocationName.trim(),
      if (chargerType != null && chargerType.trim().isNotEmpty)
        'charger_type': chargerType.trim(),
      if (evAccountCardOnFile != null)
        kEvAccountCardOnFileApiField: evAccountCardOnFile,
    };
    return put<BookingStepsTwoRes>(
      API.bookingSteps2(bookingId),
      body: body,
      fromJson: BookingStepsTwoRes.fromJson,
    );
  }

  Future<NetworkResult<BookingStepsTwoRes>> bookingStep3({
    required int bookingId,
    required int vehicleId,
    required String? vehicleParkedLocation,
    String? vehicleParkedLocationOther,
    required String? providerParkLocation,
    String? providerParkLocationOther,
    required String? vehicleKeyLocation,
    String? vehicleKeyLocationOther,
    required String? keyReturnLocation,
    String? keyReturnLocationOther,
    String? vehicleChargeLimit,
    String? notes,

    /// Sent as `current_battery_charge` (matches `PUT …/bookings/:id/vehicle`).
    String? currentBatteryCharge,

    /// Sent as `current_battery_status` (preferred for discrete/range options).
    String? currentBatteryStatus,

    /// Sent as `rate_per_kw` (matches API; replaces legacy `per_kwh`).
    String? ratePerKw,
    bool? evAccountCardOnFile,
    List<String> imagePaths = const [],
  }) async {
    final images = <MultipartFile>[];
    for (final path in imagePaths) {
      if (path.trim().isEmpty) continue;
      images.add(await multipartFileFromUploadImage(path));
    }

    final formData = FormData.fromMap({
      'vehicle_id': vehicleId.toString(),
      if (vehicleChargeLimit != null && vehicleChargeLimit.trim().isNotEmpty)
        'vehicle_charge_limit': vehicleChargeLimit.trim(),
      if (vehicleParkedLocation != null &&
          vehicleParkedLocation.trim().isNotEmpty)
        'vehicle_parked_location': vehicleParkedLocation.trim(),
      if (vehicleParkedLocationOther != null &&
          vehicleParkedLocationOther.trim().isNotEmpty)
        'vehicle_parked_location_other': vehicleParkedLocationOther.trim(),
      if (providerParkLocation != null &&
          providerParkLocation.trim().isNotEmpty)
        'provider_park_location': providerParkLocation.trim(),
      if (providerParkLocationOther != null &&
          providerParkLocationOther.trim().isNotEmpty)
        'provider_park_location_other': providerParkLocationOther.trim(),
      if (vehicleKeyLocation != null && vehicleKeyLocation.trim().isNotEmpty)
        'vehicle_key_location': vehicleKeyLocation.trim(),
      if (vehicleKeyLocationOther != null &&
          vehicleKeyLocationOther.trim().isNotEmpty)
        'vehicle_key_location_other': vehicleKeyLocationOther.trim(),
      if (keyReturnLocation != null && keyReturnLocation.trim().isNotEmpty)
        'key_return_location': keyReturnLocation.trim(),
      if (keyReturnLocationOther != null &&
          keyReturnLocationOther.trim().isNotEmpty)
        'key_return_location_other': keyReturnLocationOther.trim(),
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
      if (currentBatteryCharge != null &&
          currentBatteryCharge.trim().isNotEmpty)
        'current_battery_charge': currentBatteryCharge.trim(),
      if (currentBatteryStatus != null &&
          currentBatteryStatus.trim().isNotEmpty)
        'current_battery_status': currentBatteryStatus.trim(),
      if (ratePerKw != null && ratePerKw.trim().isNotEmpty)
        'rate_per_kw': ratePerKw.trim(),
      if (evAccountCardOnFile != null)
        kEvAccountCardOnFileApiField: evAccountCardOnFile,
      if (images.isNotEmpty) 'images[]': images,
    });

    return put<BookingStepsTwoRes>(
      API.bookingSteps3(bookingId),
      body: formData,
      fromJson: BookingStepsTwoRes.fromJson,
    );
  }

  Future<NetworkResult<BookingReviewResponse>> bookingReview({
    required int bookingId,
  }) async {
    return get<BookingReviewResponse>(
      API.bookingSteps4(bookingId),
      fromJson: BookingReviewResponse.fromJson,
    );
  }

  Future<NetworkResult<ConfirmBookingRes>> bookingConfirm({
    required int bookingId,
    required String paymentMethodId,
  }) async {
    final body = {'payment_method_id': paymentMethodId};
    return post<ConfirmBookingRes>(
      API.bookingSteps5(bookingId),
      body: body,
      receiveTimeout: const Duration(seconds: 90),
      fromJson: ConfirmBookingRes.fromJson,
    );
  }

  Future<NetworkResult<CancelBookingResponse>> cancelBooking({
    required int bookingId,
    required String reason,
  }) async {
    return post<CancelBookingResponse>(
      API.cancelBooking(bookingId),
      body: {'reason': reason},
      fromJson: CancelBookingResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> submitBookingReview({
    required int bookingId,
    required int rating,
    required String message,
    required bool isSatisfied,
    List<String> imagePaths = const [],
  }) async {
    final images = <MultipartFile>[];
    for (final path in imagePaths) {
      if (path.trim().isEmpty) continue;
      images.add(await multipartFileFromUploadImage(path));
    }

    final formData = FormData.fromMap({
      'rating': rating.toString(),
      'message': message,
      'is_satisfied': isSatisfied.toString(),
      if (images.isNotEmpty) 'images[]': images,
    });

    return post<CommonResponse>(
      API.reviews(bookingId),
      body: formData,
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> submitBookingTip({
    required int bookingId,
    required double amount,
    String? paymentMethodId,
  }) async {
    final body = <String, dynamic>{
      'amount': amount,
      if (paymentMethodId != null && paymentMethodId.trim().isNotEmpty)
        'payment_method_id': paymentMethodId.trim(),
    };
    return post<CommonResponse>(
      API.bookingTip(bookingId),
      body: body,
      fromJson: CommonResponse.fromJson,
    );
  }
}
