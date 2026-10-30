import '../response/common_response.dart';
import '../utils/network_result.dart';
import 'base_repository.dart';
import 'endpoint.dart';

class NotificationRepository extends BaseRepository {
  Future<NetworkResult<CommonResponse>> registerDevice({
    required String oneSignalId,
    required String platform,
    String? deviceModel,
    String? appVersion,
  }) {
    return post<CommonResponse>(
      API.registerDevice,
      body: {
        'onesignal_id': oneSignalId,
        'platform': platform,
        if (deviceModel != null && deviceModel.isNotEmpty)
          'device_model': deviceModel,
        if (appVersion != null && appVersion.isNotEmpty)
          'app_version': appVersion,
      },
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> notifyBookingChatMessage({
    required int bookingId,
    required String messageId,
    required String message,
  }) {
    return post<CommonResponse>(
      API.bookingChatNotify(bookingId),
      body: {'message_id': messageId, 'message': message},
      fromJson: CommonResponse.fromJson,
    );
  }
}
