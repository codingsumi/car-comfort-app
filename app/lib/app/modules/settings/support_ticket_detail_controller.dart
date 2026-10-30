import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_database/firebase_database.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../constants/service_provider_labels.dart';
import '../../network/repository/support_repository.dart';
import '../../network/response/booking_chat_response.dart';
import '../../network/response/support_ticket_response.dart';
import '../../utils/app_snackbar.dart';
import '../../utils/env_service.dart';
import '../../utils/pref.dart';

class SupportTicketDetailController extends GetxController {
  SupportTicketDetailController() : _repo = Get.find<SupportRepository>();

  final SupportRepository _repo;

  final messageController = TextEditingController();
  final scrollController = ScrollController();

  final ticket = Rxn<SupportTicketSummary>();
  final messages = <BookingChatMessage>[].obs;
  final isLoading = false.obs;
  final isSending = false.obs;
  final errorText = ''.obs;
  final peerName = 'Support'.obs;

  int? ticketId;
  DatabaseReference? _messagesRef;
  DatabaseReference? _presenceRef;
  StreamSubscription<DatabaseEvent>? _messagesSub;

  @override
  void onInit() {
    super.onInit();
    final args = Get.arguments is Map ? Get.arguments as Map : const {};
    ticketId = int.tryParse('${args['ticketId'] ?? args['ticket_id'] ?? ''}');
    unawaited(_bootstrap());
  }

  @override
  void onClose() {
    _messagesSub?.cancel();
    unawaited(_markPresenceInactive());
    messageController.dispose();
    scrollController.dispose();
    super.onClose();
  }

  Future<void> _bootstrap() async {
    await loadTicketMeta();
    await _connectFirebaseChat();
  }

  Future<void> loadTicketMeta() async {
    final id = ticketId;
    if (id == null || id <= 0) {
      errorText.value = 'Ticket not found.';
      return;
    }

    isLoading.value = true;
    errorText.value = '';
    final res = await _repo.getTicket(id);
    res.when(
      success: (SupportTicketDetailApiResponse r) {
        ticket.value = r.ticket;
        peerName.value = 'Support';
        if (r.ticket?.isClosed == true && r.messages.isNotEmpty) {
          messages.assignAll(
            r.messages.map(_bookingMessageFromSupport).toList(),
          );
          _scrollToBottomSoon();
        }
      },
      error: (e) {
        errorText.value = e.errorMessage;
      },
    );
    isLoading.value = false;
  }

  Future<void> _connectFirebaseChat() async {
    final id = ticketId;
    if (id == null || id <= 0) return;
    if (ticket.value?.isClosed == true) return;

    try {
      final databaseUrl = EnvService.firebaseDatabaseUrl.trim();
      final database = databaseUrl.isNotEmpty
          ? FirebaseDatabase.instanceFor(
              app: Firebase.app(),
              databaseURL: databaseUrl,
            )
          : FirebaseDatabase.instance;

      _messagesRef = database.ref('support_chats/$id/messages');
      final currentUserId = Prefs().userId().trim();
      _presenceRef = currentUserId.isEmpty
          ? null
          : database.ref('support_chats/$id/presence/$currentUserId');

      await _markPresenceActive();
      await _messagesSub?.cancel();
      _messagesSub = _messagesRef!.onValue.listen(
        (event) {
          final value = _deepStringMap(event.snapshot.value);
          final parsed = <BookingChatMessage>[];
          if (value is Map<String, dynamic>) {
            for (final entry in value.entries) {
              final raw = entry.value;
              if (raw is Map<String, dynamic>) {
                raw['id'] ??= entry.key;
                parsed.add(BookingChatMessage.fromJson(raw));
              }
            }
          }
          parsed.sort((a, b) => a.timestamp.compareTo(b.timestamp));
          messages.assignAll(parsed);
          _scrollToBottomSoon();
        },
        onError: (Object err) {
          errorText.value = '$err';
        },
      );
    } catch (err) {
      errorText.value = '$err';
    }
  }

  bool get canReply {
    final t = ticket.value;
    if (t == null) return false;
    return !t.isClosed;
  }

  bool get isArchivedOnly => ticket.value?.isClosed == true;

  bool isMine(BookingChatMessage message) {
    return message.senderId == Prefs().userId().toString();
  }

  Future<void> sendMessage() async {
    if (!canReply || isSending.value) return;
    final id = ticketId;
    if (id == null || id <= 0) return;

    final text = messageController.text.trim();
    if (text.isEmpty) return;

    final ref = _messagesRef;
    if (ref == null) {
      showAppSnackBar(
        title: 'Support',
        message: 'Chat is connecting. Please try again.',
        isError: true,
      );
      return;
    }

    final senderId = Prefs().userId().toString();
    final senderName = Prefs().userFullName().trim().isNotEmpty
        ? Prefs().userFullName().trim()
        : (Prefs().isDriverRole
            ? ServiceProviderLabels.supportTicketRole
            : 'Customer');
    final receiverId = 'support';

    final pushRef = ref.push();
    final key = pushRef.key;
    if (key == null || key.isEmpty) return;

    isSending.value = true;
    try {
      final users = {
        'receiverId': receiverId,
        'receiverImage': '',
        'receiverName': 'Support',
        'senderId': senderId,
        'senderImage': Prefs().userImage().trim(),
        'senderName': senderName,
      };
      final timestamp = DateTime.now().millisecondsSinceEpoch;
      final role = Prefs().isDriverRole ? 'driver' : 'customer';

      await pushRef.set({
        'id': key,
        'pushKey': key,
        'msg': text,
        'message': text,
        'type': 'text',
        'timeStamp': timestamp.toString(),
        'timestamp': timestamp,
        'receiverId': receiverId,
        'senderId': senderId,
        'sender_role': role,
        'seen': false,
        'isReply': false,
        'unreadCount': 0,
        'timezone': DateTime.now().timeZoneName,
        'attachment': {'audio': '', 'image': '', 'thumbnail': '', 'video': ''},
        'users': users,
      });
      await ref.parent?.child('users').set(users);
      messageController.clear();
      _scrollToBottomSoon();
      unawaited(_notifyAdminsIfAway(messageId: key, message: text));
    } catch (err) {
      showAppSnackBar(
        title: 'Support',
        message: '$err',
        isError: true,
      );
    } finally {
      isSending.value = false;
    }
  }

  Future<void> _markPresenceActive() async {
    final ref = _presenceRef;
    if (ref == null) return;
    final userId = Prefs().userId().toString();
    final payload = {
      'active': true,
      'userId': userId,
      'updatedAt': ServerValue.timestamp,
    };
    await ref.set(payload);
    try {
      await ref.onDisconnect().update({
        'active': false,
        'userId': userId,
        'updatedAt': ServerValue.timestamp,
      });
    } catch (_) {}
  }

  Future<void> _notifyAdminsIfAway({
    required String messageId,
    required String message,
  }) async {
    final id = ticketId;
    if (id == null || id <= 0) return;
    try {
      await _repo.notifySupportChatMessage(
        ticketId: id,
        messageId: messageId,
        message: message,
      );
    } catch (_) {
      // Chat message was sent; notification failure is non-blocking.
    }
  }

  Future<void> _markPresenceInactive() async {
    final ref = _presenceRef;
    if (ref == null) return;
    try {
      await ref.update({
        'active': false,
        'userId': Prefs().userId().toString(),
        'updatedAt': ServerValue.timestamp,
      });
      await ref.onDisconnect().cancel();
    } catch (_) {}
  }

  void _scrollToBottomSoon() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!scrollController.hasClients) return;
      scrollController.animateTo(
        scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOut,
      );
    });
  }
}

BookingChatMessage _bookingMessageFromSupport(SupportMessage msg) {
  final senderId = '${msg.senderId ?? ''}';
  final isAdmin = msg.senderRole?.toLowerCase() == 'admin';
  final ts = msg.createdAt?.millisecondsSinceEpoch ?? 0;
  return BookingChatMessage(
    id: 'sm_${msg.id ?? ts}',
    message: msg.message ?? '',
    type: 'text',
    timestamp: ts,
    senderId: senderId,
    receiverId: isAdmin ? senderId : 'support',
    senderName: isAdmin ? (msg.senderName ?? 'Support') : 'You',
    receiverName: isAdmin ? 'You' : 'Support',
    seen: true,
  );
}

dynamic _deepStringMap(dynamic value) {
  if (value is Map) {
    return value.map((key, child) => MapEntry('$key', _deepStringMap(child)));
  }
  if (value is List) {
    return value.map(_deepStringMap).toList(growable: false);
  }
  return value;
}
