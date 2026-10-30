import 'package:dio/dio.dart';

import '../../utils/image_upload_compress.dart'
    if (dart.library.html) '../../utils/image_upload_compress_web.dart';

import 'package:car_comfort/app/network/response/forgot_password_response.dart';
import 'package:car_comfort/app/network/response/login_response.dart';
import 'package:car_comfort/app/network/response/profile_response.dart';
import 'package:car_comfort/app/network/response/register_response.dart';
import 'package:car_comfort/app/network/response/tutorial_response.dart';
import 'package:car_comfort/app/network/response/tutorial_videos_response.dart';
import '../../network/response/common_response.dart';
import '../utils/network_result.dart';
import 'base_repository.dart';
import 'endpoint.dart';

class AuthRepository extends BaseRepository {
  Future<NetworkResult<LoginResponse>> login({
    required String email,
    String? password,
    String authType = 'normal',
    String? socialType,
    String? socialId,
    String? socialToken,
    String? role,
    double? latitude,
    double? longitude,
  }) async {
    final body = <String, dynamic>{
      if (email.isNotEmpty) "email": email.trim(),
      "auth_type": authType,
      if (latitude != null) "latitude": latitude,
      if (longitude != null) "longitude": longitude,
    };

    if (authType == 'social') {
      body["social_type"] = socialType;
      body["social_id"] = socialId;
      body["social_token"] = socialToken;
    } else {
      body["password"] = password;
      final normalizedRole = role?.trim().toLowerCase();
      if (normalizedRole == 'customer' || normalizedRole == 'driver') {
        body["role"] = normalizedRole;
      }
    }

    return post<LoginResponse>(
      API.login,
      body: body,
      fromJson: LoginResponse.fromJson,
    );
  }

  Future<NetworkResult<ForgotPasswordResponse>> forgotPassword({
    required String email,
  }) async {
    final body = {"email": email.trim()};
    return post<ForgotPasswordResponse>(
      API.forgotPassword,
      body: body,
      fromJson: ForgotPasswordResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> verifyOtp({required String otp}) async {
    final parsedOtp = int.tryParse(otp.trim());
    final body = {"otp": parsedOtp ?? otp.trim()};
    return post<CommonResponse>(
      API.verifyOtp,
      body: body,
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> verifyResetOtp({
    required String email,
    required String otp,
  }) async {
    final body = {"email": email.trim(), "otp": otp.trim()};
    return post<CommonResponse>(
      API.verifyResetOtp,
      body: body,
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> resendOtp() async {
    return post<CommonResponse>(
      API.resendOtp,
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> resendOtpEmail({
    required String email,
  }) async {
    final body = {"email": email.trim()};
    return post<CommonResponse>(
      API.resendOtpEmail,
      body: body,
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> verifyOtpEmail({
    required String email,
    required String otp,
  }) async {
    final body = {"email": email.trim(), "otp": otp.trim()};
    return post<CommonResponse>(
      API.verifyOtpEmail,
      body: body,
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<RegisterResponse>> customerRegister({
    required String firstName,
    required String lastName,
    required String email,
    required String phone,
    required String countryCode,
    required String password,
    required String role,
    required bool agreedToTerms,
    String? referralCode,
    String? profilePicturePath,
  }) async {
    final body = <String, dynamic>{
      "first_name": firstName,
      "last_name": lastName,
      "email": email,
      "phone": phone,
      "country_code": countryCode,
      "password": password,
      "role": role,
      "agreed_to_terms": agreedToTerms,
    };
    final code = referralCode?.trim();
    if (code != null && code.isNotEmpty) {
      body["referral_code"] = code;
    }
    final photoPath = profilePicturePath?.trim();
    if (photoPath != null && photoPath.isNotEmpty) {
      body["profile"] = await multipartFileFromUploadImage(photoPath);
      return post<RegisterResponse>(
        API.customerRegister,
        body: FormData.fromMap(body),
        fromJson: RegisterResponse.fromJson,
      );
    }
    return post<RegisterResponse>(
      API.customerRegister,
      body: body,
      fromJson: RegisterResponse.fromJson,
    );
  }

  /// Single Identity Model: link a provider profile to the currently authenticated
  /// user account without requiring a separate registration or password.
  Future<NetworkResult<RegisterResponse>> addDriverProfile({
    required bool agreedToTerms,
    String? profilePicturePath,
  }) async {
    final body = <String, dynamic>{
      'agreed_to_terms': agreedToTerms,
    };
    final photoPath = profilePicturePath?.trim();
    if (photoPath != null && photoPath.isNotEmpty) {
      body['profile_picture'] = await multipartFileFromUploadImage(photoPath);
      return post<RegisterResponse>(
        API.addDriverProfile,
        body: FormData.fromMap(body),
        fromJson: RegisterResponse.fromJson,
      );
    }
    return post<RegisterResponse>(
      API.addDriverProfile,
      body: body,
      fromJson: RegisterResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> resetPassword({
    required String resetToken,
    required String newPassword,
    required String confirmPassword,
  }) {
    final body = {
      'reset_token': resetToken,
      'new_password': newPassword,
      'confirm_password': confirmPassword,
    };
    return post<CommonResponse>(
      API.resetPassword,
      body: body,
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<LoginResponse>> switchRole({
    required String role,
    double? latitude,
    double? longitude,
  }) async {
    final body = <String, dynamic>{
      'role': role.trim().toLowerCase(),
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
    };
    return post<LoginResponse>(
      API.switchRole,
      body: body,
      fromJson: LoginResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> getAvailableRoles() {
    return get<CommonResponse>(
      API.availableRoles,
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> logout() {
    return post<CommonResponse>(API.logout, fromJson: CommonResponse.fromJson);
  }

  Future<NetworkResult<CommonResponse>> submitAccountDeletionRequest({
    required String reason,
  }) {
    return post<CommonResponse>(
      API.accountDeletionRequest,
      body: {'reason': reason.trim()},
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<TutorialResponse>> getTutorial() async {
    return get<TutorialResponse>(
      API.tutorial,
      fromJson: TutorialResponse.fromJson,
    );
  }

  Future<NetworkResult<TutorialResponse>> getDriverTutorial() async {
    return get<TutorialResponse>(
      API.driverTutorial,
      fromJson: TutorialResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> completeDriverTutorial() async {
    return post<CommonResponse>(
      API.driverTutorialComplete,
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<TutorialVideosResponse>> getCustomerTutorialVideos() async {
    return get<TutorialVideosResponse>(
      API.tutorialVideos,
      query: const {'audience': 'customer'},
      fromJson: TutorialVideosResponse.fromJson,
    );
  }

  Future<NetworkResult<TutorialVideosResponse>> getProviderTutorialVideos() async {
    return get<TutorialVideosResponse>(
      API.tutorialVideos,
      query: const {'audience': 'provider'},
      fromJson: TutorialVideosResponse.fromJson,
    );
  }

  Future<NetworkResult<ProfileResponse>> getDriverMe() async {
    return get<ProfileResponse>(
      API.driverMe,
      fromJson: ProfileResponse.fromJson,
    );
  }

  Future<NetworkResult<ProfileResponse>> getCustomerMe() async {
    return get<ProfileResponse>(
      API.customerMe,
      fromJson: ProfileResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> updateCustomerProfile({
    required String firstName,
    required String lastName,
    required String phone,
    String? profilePicturePath,
  }) async {
    final body = <String, dynamic>{
      "first_name": firstName.trim(),
      "last_name": lastName.trim(),
      "phone": phone.trim(),
    };
    if (profilePicturePath != null && profilePicturePath.trim().isNotEmpty) {
      body["profile"] = await multipartFileFromUploadImage(profilePicturePath.trim());
    }
    return patch<CommonResponse>(
      API.customerMe,
      body: FormData.fromMap(body),
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> updateDriverProfile({
    required String firstName,
    required String lastName,
    required String phone,
    String? profilePicturePath,
  }) async {
    final body = <String, dynamic>{
      "first_name": firstName.trim(),
      "last_name": lastName.trim(),
      "phone": phone.trim(),
    };
    if (profilePicturePath != null && profilePicturePath.trim().isNotEmpty) {
      body["profile"] = await multipartFileFromUploadImage(profilePicturePath.trim());
    }
    return patch<CommonResponse>(
      API.driverMe,
      body: FormData.fromMap(body),
      fromJson: CommonResponse.fromJson,
    );
  }
}
