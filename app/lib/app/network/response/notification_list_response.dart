import 'package:intl/intl.dart';

class NotificationListResponse {
  NotificationListResponse({
    this.message,
    required this.items,
    this.currentPage,
    this.totalPages,
    this.total,
    this.limit,
  });

  final String? message;
  final List<NotificationItem> items;
  final int? currentPage;
  final int? totalPages;
  final int? total;
  final int? limit;

  factory NotificationListResponse.fromJson(dynamic json) {
    final root = (json is Map<String, dynamic>) ? json : <String, dynamic>{};
    final data = root['data'];

    final pagingRoot = (data is Map<String, dynamic>) ? data : root;
    final listRaw = _extractList(data) ?? _extractList(root) ?? const [];

    return NotificationListResponse(
      message: (root['message'] ?? '').toString(),
      items: listRaw
          .whereType<Map<String, dynamic>>()
          .map(NotificationItem.fromJson)
          .toList(),
      currentPage: _toInt(pagingRoot['current_page'] ?? pagingRoot['page']),
      totalPages: _toInt(pagingRoot['last_page'] ?? pagingRoot['total_pages']),
      total: _toInt(pagingRoot['total']),
      limit: _toInt(pagingRoot['per_page'] ?? pagingRoot['limit']),
    );
  }

  static List<dynamic>? _extractList(dynamic value) {
    if (value is List) return value;
    if (value is! Map<String, dynamic>) return null;
    final candidates = [
      value['notifications'],
      value['items'],
      value['data'],
      value['results'],
    ];
    for (final c in candidates) {
      if (c is List) return c;
    }
    return null;
  }

  static int? _toInt(dynamic value) {
    if (value is int) return value;
    return int.tryParse('${value ?? ''}');
  }
}

class NotificationItem {
  NotificationItem({
    required this.id,
    required this.title,
    required this.message,
    required this.createdAt,
    required this.isRead,
    this.bookingId,
    this.bookingCode,
    this.serviceType,
    this.kind,
    this.senderId,
    this.senderName,
    this.senderImage,
    this.receiverId,
    this.ticketId,
  });

  final String id;
  final String title;
  final String message;
  final DateTime? createdAt;
  final bool isRead;

  /// From top-level `booking_id` or `data.booking_id` (in-app list + deep link).
  final int? bookingId;
  final String? bookingCode;
  final String? serviceType;
  final String? kind;
  final String? senderId;
  final String? senderName;
  final String? senderImage;
  final String? receiverId;
  final int? ticketId;

  bool get isChatMessage => kind?.trim().toUpperCase() == 'CHAT_MESSAGE';
  bool get isSupportTicketNotification {
    final value = kind?.trim().toUpperCase();
    return value == 'SUPPORT_TICKET_REPLY' ||
        value == 'SUPPORT_TICKET_RESOLVED' ||
        value == 'SUPPORT_TICKET_MESSAGE' ||
        value == 'SUPPORT_TICKET_CREATED';
  }
  bool get isDriverProfileApprovalStatus {
    final value = kind?.trim().toUpperCase();
    return value == 'DRIVER_PROFILE_APPROVED' ||
        value == 'DRIVER_PROFILE_REJECTED';
  }

  bool get isDriverWalletNotification {
    final value = kind?.trim().toUpperCase();
    return value == 'PAYOUT_INITIATED' ||
        value == 'PAYOUT_COMPLETED' ||
        value == 'PAYOUT_FAILED' ||
        value == 'EARNINGS_RELEASED';
  }

  /// Driver received a tip or review/rating from a customer.
  bool get isTipOrReviewNotification {
    final value = kind?.trim().toUpperCase();
    return value == 'CUSTOMER_TIP_RECEIVED' || value == 'CUSTOMER_REVIEW_RECEIVED';
  }

  /// Customer billing / invoice notification (BOOKING_CONFIRMED,
  /// payment-tagged kinds, etc.). Promotional announcements are intentionally
  /// excluded — they are not billing events.
  bool get isCustomerBillingNotification {
    final value = kind?.trim().toUpperCase();
    return value == 'BOOKING_CONFIRMED' ||
        value == 'BOOKING_PAYMENT_FAILED' ||
        value == 'BOOKING_PAYMENT_CAPTURED' ||
        value == 'INVOICE_READY' ||
        value == 'INVOICE_PAID' ||
        value == 'PAYMENT_RECEIVED' ||
        value == 'PAYMENT_FAILED' ||
        value == 'REFUND_ISSUED';
  }

  /// Broadcast announcement from admin — no deep-link navigation.
  bool get isPromotionalNotification {
    final value = kind?.trim().toUpperCase();
    return value == 'PROMOTIONAL' ||
        value == 'REFERRAL_REWARD' ||
        value == 'WELCOME';
  }

  /// US-style: month/day/year then 12-hour time, e.g. `05/14/2026, 3:45 PM`.
  String get usDateTimeDisplay {
    final d = createdAt;
    if (d == null) return '';
    return DateFormat('MM/dd/yyyy, h:mm a', 'en_US').format(d.toLocal());
  }

  factory NotificationItem.fromJson(Map<String, dynamic> json) {
    final title = _pickText([
      json['title'],
      json['subject'],
      json['heading'],
      json['type'],
    ]);
    final message = _pickText([
      json['message'],
      json['body'],
      json['description'],
      json['text'],
    ]);
    final data = json['data'];
    final dataMap = data is Map<String, dynamic> ? data : null;
    final kindRaw = _pickText([
      dataMap?['kind'],
      json['notification_type'],
      json['type'],
    ]);
    return NotificationItem(
      id: '${json['id'] ?? json['notification_id'] ?? ''}',
      title: title.isEmpty ? 'Notification' : title,
      message: message.isEmpty ? '-' : message,
      createdAt: _parseDate(
        json['created_at'] ?? json['createdAt'] ?? json['time'],
      ),
      isRead: _toBool(json['is_read'] ?? json['read'] ?? json['seen']),
      bookingId: _parseBookingId(json, dataMap),
      bookingCode: _parseBookingCode(dataMap),
      serviceType: _parseServiceType(dataMap),
      kind: kindRaw.isEmpty ? null : kindRaw,
      senderId: _parseString(dataMap, 'sender_id'),
      senderName: _parseString(dataMap, 'sender_name'),
      senderImage: _parseString(dataMap, 'sender_image'),
      receiverId: _parseString(dataMap, 'receiver_id'),
      ticketId: _parseTicketId(json, dataMap),
    );
  }

  static String? _parseString(Map<String, dynamic>? dataMap, String key) {
    if (dataMap == null) return null;
    final value = dataMap[key]?.toString().trim() ?? '';
    return value.isEmpty ? null : value;
  }

  static int? _parseTicketId(
    Map<String, dynamic> json,
    Map<String, dynamic>? dataMap,
  ) {
    final top = json['ticket_id'];
    if (top != null) {
      final n = int.tryParse('$top');
      if (n != null && n > 0) return n;
    }
    if (dataMap != null) {
      final n = int.tryParse('${dataMap['ticket_id'] ?? ''}');
      if (n != null && n > 0) return n;
    }
    return null;
  }

  static int? _parseBookingId(
    Map<String, dynamic> json,
    Map<String, dynamic>? dataMap,
  ) {
    final top = json['booking_id'];
    if (top != null) {
      final n = int.tryParse('$top');
      if (n != null && n > 0) return n;
    }
    if (dataMap != null) {
      final n = int.tryParse('${dataMap['booking_id'] ?? ''}');
      if (n != null && n > 0) return n;
    }
    return null;
  }

  static String? _parseBookingCode(Map<String, dynamic>? dataMap) {
    if (dataMap == null) return null;
    final c = dataMap['booking_code']?.toString().trim() ?? '';
    return c.isEmpty ? null : c;
  }

  static String? _parseServiceType(Map<String, dynamic>? dataMap) {
    if (dataMap == null) return null;
    final s = dataMap['service_type']?.toString().trim() ?? '';
    return s.isEmpty ? null : s;
  }

  static String _pickText(List<dynamic> candidates) {
    for (final c in candidates) {
      final t = '${c ?? ''}'.trim();
      if (t.isNotEmpty) return t;
    }
    return '';
  }

  static DateTime? _parseDate(dynamic value) {
    final raw = '${value ?? ''}'.trim();
    if (raw.isEmpty) return null;
    return DateTime.tryParse(raw);
  }

  static bool _toBool(dynamic value) {
    if (value is bool) return value;
    if (value is num) return value != 0;
    final raw = '${value ?? ''}'.trim().toLowerCase();
    return raw == 'true' || raw == '1' || raw == 'yes';
  }
}
