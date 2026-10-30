import 'package:dio/dio.dart';

import '../../utils/image_upload_compress.dart';
import '../../network/response/common_response.dart';
import '../utils/network_result.dart';
import 'base_repository.dart';
import 'endpoint.dart';

class DriverSignupRepository extends BaseRepository {
  Future<NetworkResult<CommonResponse>> submitStep2({
    required String tshirtSize,
    required String address,
    required String dateOfBirth,
    required String socialSecurityNumber,
  }) {
    final body = {
      "tshirt_size": tshirtSize,
      "address": address,
      "date_of_birth": dateOfBirth,
      "social_security_number": socialSecurityNumber,
    };
    return post<CommonResponse>(
      API.driverStep2,
      body: body,
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> submitStep3({
    required String licenseNumber,
    required String issuedDate,
    required String expirationDate,
  }) {
    final body = {
      "drivers_license_number": licenseNumber,
      "drivers_license_issued_date": issuedDate,
      "drivers_license_expiration_date": expirationDate,
    };
    return post<CommonResponse>(
      API.driverStep3,
      body: body,
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> uploadDriverLicense({
    required String frontPath,
    required String backPath,
  }) async {
    final formData = FormData.fromMap({
      "drivers_license_front": await multipartFileFromUploadImage(frontPath),
      "drivers_license_back": await multipartFileFromUploadImage(backPath),
    });
    return post<CommonResponse>(
      API.driverDocuments,
      body: formData,
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> submitStep4({
    required String make,
    required String model,
    required String year,
    required String color,
    required String vehicleType,
    required String licensePlate,
    String? fuelType,
    String? batteryCapacityKwh,
  }) {
    final body = {
      "vehicle_make": make,
      "vehicle_model": model,
      "vehicle_year": int.tryParse(year.trim()) ?? year.trim(),
      "vehicle_color": color,
      "vehicle_type": vehicleType,
      "vehicle_license_plate": licensePlate,
      if (fuelType != null && fuelType.trim().isNotEmpty)
        "fuel_type": fuelType.trim(),
      if (batteryCapacityKwh != null && batteryCapacityKwh.trim().isNotEmpty)
        "battery_capacity_kwh": batteryCapacityKwh.trim(),
    };
    return post<CommonResponse>(
      API.driverStep4,
      body: body,
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> submitBackgroundCheckStep({
    required bool backgroundCheckConsent,
  }) {
    return post<CommonResponse>(
      API.driverStep5,
      body: {
        'background_check_consent': backgroundCheckConsent,
      },
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> uploadSignedBackgroundCheckForm({
    required String signedFormPath,
  }) async {
    final formData = FormData.fromMap({
      'background_check_signed_form': await MultipartFile.fromFile(signedFormPath),
    });
    return post<CommonResponse>(
      API.driverDocuments,
      body: formData,
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> submitInsuranceInformation({
    required String insuranceProvider,
    required String policyNumber,
    required String expirationDate,
    required String coverageType,
  }) {
    return post<CommonResponse>(
      API.driverStep6,
      body: {
        'insurance_provider': insuranceProvider,
        'policy_number': policyNumber,
        'expiration_date': expirationDate,
        'coverage_type': coverageType,
      },
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> uploadInsuranceCard({
    required String frontPath,
    required String backPath,
  }) async {
    final formData = FormData.fromMap({
      if (frontPath.isNotEmpty)
        'insurance_card_front': await multipartFileFromUploadImage(frontPath),
      if (backPath.isNotEmpty)
        'insurance_card_back': await multipartFileFromUploadImage(backPath),
    });
    return post<CommonResponse>(
      API.driverDocuments,
      body: formData,
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> requestVerificationOtp() {
    return post<CommonResponse>(
      API.driverRequestVerificationOtp,
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> verifyDriverOtp({
    required String otp,
  }) {
    return post<CommonResponse>(
      API.driverVerifyOtp,
      body: {"otp": otp.trim()},
      fromJson: CommonResponse.fromJson,
    );
  }
}
