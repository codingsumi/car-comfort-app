class BookingChatUser {
  BookingChatUser({this.id, this.name, this.image, this.role});

  BookingChatUser.fromJson(dynamic json) {
    if (json is! Map) return;
    id = json['id']?.toString();
    name = json['name']?.toString();
    image = json['image']?.toString();
    role = json['role']?.toString();
  }

  String? id;
  String? name;
  String? image;
  String? role;
}

class BookingChatSessionResponse {
  BookingChatSessionResponse.fromJson(dynamic json) {
    final data = json is Map ? json['data'] : null;
    if (data is! Map) return;
    bookingId = int.tryParse('${data['booking_id'] ?? ''}');
    status = data['status']?.toString();
    firebaseToken = data['firebase_token']?.toString();
    databaseUrl = data['database_url']?.toString();
    rtdbPath = data['rtdb_path']?.toString();
    messagesPath = data['messages_path']?.toString();
    receiverId = data['receiver_id']?.toString();
    currentUser = BookingChatUser.fromJson(data['current_user']);
    peer = BookingChatUser.fromJson(data['peer']);
  }

  int? bookingId;
  String? status;
  String? firebaseToken;
  String? databaseUrl;
  String? rtdbPath;
  String? messagesPath;
  String? receiverId;
  BookingChatUser? currentUser;
  BookingChatUser? peer;
}

class BookingChatTranscriptResponse {
  BookingChatTranscriptResponse.fromJson(dynamic json) {
    final data = json is Map ? json['data'] : null;
    if (data is! Map) return;
    bookingId = int.tryParse('${data['booking_id'] ?? ''}');
    status = data['status']?.toString();
    messageCount = int.tryParse('${data['message_count'] ?? ''}');
    capturedAt = data['captured_at']?.toString();
    source = data['source']?.toString();
    final rawMessages = data['messages'];
    if (rawMessages is List) {
      messages = rawMessages
          .whereType<Map>()
          .map((e) => BookingChatMessage.fromJson(Map<String, dynamic>.from(e)))
          .toList(growable: false);
    } else {
      messages = const <BookingChatMessage>[];
    }
  }

  int? bookingId;
  String? status;
  int? messageCount;
  String? capturedAt;
  String? source;
  List<BookingChatMessage> messages = const <BookingChatMessage>[];
}

class BookingChatMessage {
  BookingChatMessage({
    required this.id,
    required this.message,
    required this.type,
    required this.timestamp,
    required this.senderId,
    required this.receiverId,
    this.senderName,
    this.receiverName,
    this.senderImage,
    this.receiverImage,
    this.seen = false,
  });

  factory BookingChatMessage.fromJson(Map<String, dynamic> json) {
    final users = json['users'] is Map
        ? Map<String, dynamic>.from(json['users'] as Map)
        : <String, dynamic>{};
    return BookingChatMessage(
      id: json['id']?.toString() ?? json['pushKey']?.toString() ?? '',
      message: (json['message'] ?? json['msg'])?.toString() ?? '',
      type: json['type']?.toString() ?? 'text',
      timestamp: _asInt(json['timestamp'] ?? json['timeStamp']),
      senderId:
          users['senderId']?.toString() ?? json['senderId']?.toString() ?? '',
      receiverId:
          users['receiverId']?.toString() ??
          json['receiverId']?.toString() ??
          '',
      senderName: users['senderName']?.toString(),
      receiverName: users['receiverName']?.toString(),
      senderImage: users['senderImage']?.toString(),
      receiverImage: users['receiverImage']?.toString(),
      seen: json['seen'] == true,
    );
  }

  final String id;
  final String message;
  final String type;
  final int timestamp;
  final String senderId;
  final String receiverId;
  final String? senderName;
  final String? receiverName;
  final String? senderImage;
  final String? receiverImage;
  final bool seen;

  DateTime get sentAt {
    if (timestamp > 9999999999) {
      return DateTime.fromMillisecondsSinceEpoch(timestamp);
    }
    return DateTime.fromMillisecondsSinceEpoch(timestamp * 1000);
  }
}

int _asInt(dynamic value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse('${value ?? ''}') ?? 0;
}
