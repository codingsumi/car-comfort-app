import 'package:dio/dio.dart';

import '../../utils/image_upload_compress.dart';
import '../../utils/pref.dart';
import '../response/common_response.dart';
import '../response/support_ticket_response.dart';
import '../utils/network_result.dart';
import 'base_repository.dart';
import 'endpoint.dart';

class SupportRepository extends BaseRepository {
  String get _ticketsBase =>
      Prefs().isDriverRole ? API.driverSupportTickets : API.customerSupportTickets;

  String _ticketPath(int ticketId) =>
      Prefs().isDriverRole
          ? API.driverSupportTicket(ticketId)
          : API.customerSupportTicket(ticketId);

  String _messagesPath(int ticketId) =>
      Prefs().isDriverRole
          ? API.driverSupportTicketMessages(ticketId)
          : API.customerSupportTicketMessages(ticketId);

  Future<NetworkResult<SupportTicketListApiResponse>> listMyTickets({
    int limit = 20,
  }) {
    return get<SupportTicketListApiResponse>(
      _ticketsBase,
      query: {'limit': limit},
      fromJson: SupportTicketListApiResponse.fromJson,
    );
  }

  Future<NetworkResult<SupportTicketDetailApiResponse>> getTicket(int ticketId) {
    return get<SupportTicketDetailApiResponse>(
      _ticketPath(ticketId),
      fromJson: SupportTicketDetailApiResponse.fromJson,
    );
  }

  Future<NetworkResult<SupportTicketCreateApiResponse>> createTicket({
    required String subject,
    required String message,
  }) {
    return post<SupportTicketCreateApiResponse>(
      _ticketsBase,
      body: {'subject': subject, 'message': message},
      fromJson: SupportTicketCreateApiResponse.fromJson,
    );
  }

  String _chatNotifyPath(int ticketId) => Prefs().isDriverRole
      ? API.driverSupportTicketChatNotify(ticketId)
      : API.customerSupportTicketChatNotify(ticketId);

  Future<NetworkResult<CommonResponse>> notifySupportChatMessage({
    required int ticketId,
    required String messageId,
    required String message,
  }) {
    return post<CommonResponse>(
      _chatNotifyPath(ticketId),
      body: {'message_id': messageId, 'message': message},
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<SupportMessageReplyApiResponse>> replyToTicket({
    required int ticketId,
    required String message,
  }) {
    return post<SupportMessageReplyApiResponse>(
      _messagesPath(ticketId),
      body: {'message': message},
      fromJson: SupportMessageReplyApiResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> submitMediaReport({
    required String reportType,
    required String description,
    required List<String> mediaPaths,
    int? bookingId,
    String priority = 'high',
  }) async {
    final path =
        Prefs().isDriverRole ? API.driverReports : API.customerReports;

    final attachments = <MultipartFile>[];
    for (final mediaPath in mediaPaths) {
      final trimmed = mediaPath.trim();
      if (trimmed.isEmpty) continue;
      attachments.add(await multipartFileFromMediaPath(trimmed));
    }

    final formData = FormData.fromMap({
      'report_type': reportType,
      'description': description,
      'priority': priority,
      if (bookingId != null && bookingId > 0) 'booking_id': bookingId,
      if (attachments.isNotEmpty) 'attachments[]': attachments,
    });

    return post<CommonResponse>(
      path,
      body: formData,
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> submitAccidentDamageReport({
    required String description,
    required List<String> mediaPaths,
    int? bookingId,
  }) {
    return submitMediaReport(
      reportType: 'vehicle_damage',
      description: description,
      mediaPaths: mediaPaths,
      bookingId: bookingId,
    );
  }

  Future<NetworkResult<CommonResponse>> submitReport({
    required String reportType,
    required String description,
    int? bookingId,
    String priority = 'medium',
  }) {
    final path =
        Prefs().isDriverRole ? API.driverReports : API.customerReports;
    return post<CommonResponse>(
      path,
      body: {
        'report_type': reportType,
        'description': description,
        if (bookingId != null && bookingId > 0) 'booking_id': bookingId,
        'priority': priority,
      },
      fromJson: CommonResponse.fromJson,
    );
  }
}
