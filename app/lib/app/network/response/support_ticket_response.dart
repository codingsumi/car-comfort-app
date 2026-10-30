import 'package:intl/intl.dart';

class SupportTicketListApiResponse {
  SupportTicketListApiResponse({
    this.status,
    this.message,
    this.tickets = const [],
  });

  SupportTicketListApiResponse.fromJson(dynamic json) {
    status = json['status'];
    message = json['message']?.toString();
    final data = json['data'];
    if (data is List) {
      tickets = data
          .whereType<Map>()
          .map((e) => SupportTicketSummary.fromJson(e))
          .toList();
    } else {
      tickets = const [];
    }
  }

  dynamic status;
  String? message;
  List<SupportTicketSummary> tickets = const [];

  bool get isSuccess =>
      status == true || status == 'success' || status == 1;
}

class SupportTicketDetailApiResponse {
  SupportTicketDetailApiResponse({
    this.status,
    this.message,
    this.ticket,
    this.messages = const [],
  });

  SupportTicketDetailApiResponse.fromJson(dynamic json) {
    status = json['status'];
    message = json['message']?.toString();
    final data = json['data'];
    if (data is Map<String, dynamic>) {
      final ticketRaw = data['ticket'];
      if (ticketRaw is Map<String, dynamic>) {
        ticket = SupportTicketSummary.fromJson(ticketRaw);
      }
      final raw = data['messages'];
      if (raw is List) {
        messages = raw
            .whereType<Map>()
            .map((e) => SupportMessage.fromJson(e))
            .toList();
      }
    }
  }

  dynamic status;
  String? message;
  SupportTicketSummary? ticket;
  List<SupportMessage> messages = const [];

  bool get isSuccess =>
      status == true || status == 'success' || status == 1;
}

class SupportTicketCreateApiResponse {
  SupportTicketCreateApiResponse({this.status, this.message, this.ticket});

  SupportTicketCreateApiResponse.fromJson(dynamic json) {
    status = json['status'];
    message = json['message']?.toString();
    final data = json['data'];
    if (data is Map<String, dynamic>) {
      ticket = SupportTicketSummary.fromJson(data);
    }
  }

  dynamic status;
  String? message;
  SupportTicketSummary? ticket;

  bool get isSuccess =>
      status == true || status == 'success' || status == 1;
}

class SupportMessageReplyApiResponse {
  SupportMessageReplyApiResponse({this.status, this.message, this.data});

  SupportMessageReplyApiResponse.fromJson(dynamic json) {
    status = json['status'];
    message = json['message']?.toString();
    final raw = json['data'];
    if (raw is Map<String, dynamic>) {
      data = SupportMessage.fromJson(raw);
    }
  }

  dynamic status;
  String? message;
  SupportMessage? data;

  bool get isSuccess =>
      status == true || status == 'success' || status == 1;
}

class SupportTicketSummary {
  SupportTicketSummary({
    this.id,
    this.ticketNumber,
    this.subject,
    this.status,
    this.priority,
    this.lastMessagePreview,
    this.createdAt,
    this.updatedAt,
    this.lastMessageAt,
  });

  factory SupportTicketSummary.fromJson(Map<dynamic, dynamic> json) {
    return SupportTicketSummary(
      id: _int(json['id']),
      ticketNumber: json['ticket_number']?.toString(),
      subject: json['subject']?.toString(),
      status: json['status']?.toString(),
      priority: json['priority']?.toString(),
      lastMessagePreview: json['last_message_preview']?.toString(),
      createdAt: _date(json['created_at']),
      updatedAt: _date(json['updated_at']),
      lastMessageAt: _date(json['last_message_at']),
    );
  }

  final int? id;
  final String? ticketNumber;
  final String? subject;
  final String? status;
  final String? priority;
  final String? lastMessagePreview;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final DateTime? lastMessageAt;

  String get statusLabel => _formatStatus(status);

  String get updatedDisplay {
    final d = lastMessageAt ?? updatedAt ?? createdAt;
    if (d == null) return '';
    return DateFormat('MM/dd/yyyy, h:mm a', 'en_US').format(d.toLocal());
  }

  bool get isClosed {
    final s = status?.trim().toLowerCase() ?? '';
    return s == 'closed' || s == 'resolved';
  }

  static String _formatStatus(String? raw) {
    final s = raw?.trim().toLowerCase() ?? '';
    if (s.isEmpty) return 'Open';
    return s
        .split('_')
        .map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}')
        .join(' ');
  }

  static int? _int(dynamic v) {
    if (v == null) return null;
    if (v is int) return v;
    return int.tryParse('$v');
  }

  static DateTime? _date(dynamic v) {
    if (v == null) return null;
    if (v is DateTime) return v;
    return DateTime.tryParse(v.toString());
  }
}

class SupportMessage {
  SupportMessage({
    this.id,
    this.ticketId,
    this.senderId,
    this.senderRole,
    this.message,
    this.createdAt,
    this.senderName,
  });

  factory SupportMessage.fromJson(Map<dynamic, dynamic> json) {
    final sender = json['sender'];
    String? name;
    if (sender is Map) {
      name = sender['name']?.toString();
    }
    return SupportMessage(
      id: SupportTicketSummary._int(json['id']),
      ticketId: SupportTicketSummary._int(json['ticket_id']),
      senderId: SupportTicketSummary._int(json['sender_id']),
      senderRole: json['sender_role']?.toString(),
      message: json['message']?.toString(),
      createdAt: SupportTicketSummary._date(json['created_at']),
      senderName: name,
    );
  }

  final int? id;
  final int? ticketId;
  final int? senderId;
  final String? senderRole;
  final String? message;
  final DateTime? createdAt;
  final String? senderName;

  bool isFromAdmin(String? myUserId) {
    final role = senderRole?.trim().toLowerCase() ?? '';
    if (role == 'admin') return true;
    if (myUserId == null || myUserId.isEmpty) return false;
    return senderId != null && '$senderId' != myUserId.trim();
  }
}
