import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_database/firebase_database.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../network/repository/notification_repository.dart';
import '../../network/response/booking_chat_response.dart';
import '../../utils/app_snackbar.dart';
import '../../utils/booking_chat_availability.dart';
import '../../utils/env_service.dart';
import '../../utils/pref.dart';

class BookingChatController extends GetxController {
  final messageController = TextEditingController();
  final scrollController = ScrollController();
  final messages = <BookingChatMessage>[].obs;
  final isLoading = false.obs;
  final isSending = false.obs;
  final isReadOnly = false.obs;
  final peerName = 'Chat'.obs;
  final peerImage = ''.obs;
  final errorText = ''.obs;

  int? bookingId;
  String bookingStatus = '';
  String receiverId = '';
  String currentUserName = '';
  String currentUserImage = '';
  DatabaseReference? _messagesRef;
  DatabaseReference? _presenceRef;
  StreamSubscription<DatabaseEvent>? _messagesSub;
  final NotificationRepository _notificationRepository =
      NotificationRepository();

  @override
  void onInit() {
    super.onInit();
    final args = Get.arguments is Map ? Get.arguments as Map : const {};
    bookingId = int.tryParse(
      '${args['bookingId'] ?? args['booking_id'] ?? ''}',
    );
    bookingStatus = '${args['status'] ?? ''}'.toLowerCase().trim();
    receiverId = '${args['peerId'] ?? args['peer_id'] ?? ''}'.trim();
    currentUserName = '${args['currentUserName'] ?? ''}'.trim();
    currentUserImage = '${args['currentUserImage'] ?? ''}'.trim();
    final initialPeer = '${args['peerName'] ?? args['peer_name'] ?? ''}'.trim();
    if (initialPeer.isNotEmpty) peerName.value = initialPeer;
    final initialPeerImage = '${args['peerImage'] ?? args['peer_image'] ?? ''}'
        .trim();
    if (initialPeerImage.isNotEmpty) peerImage.value = initialPeerImage;
    unawaited(loadChat());
  }

  @override
  void onClose() {
    _messagesSub?.cancel();
    unawaited(_markPresenceInactive());
    messageController.dispose();
    scrollController.dispose();
    super.onClose();
  }

  Future<void> loadChat() async {
    final id = bookingId;
    if (id == null || id <= 0) {
      errorText.value = 'Booking id is missing.';
      return;
    }

    isLoading.value = true;
    errorText.value = '';
    try {
      final mode = bookingChatModeForStatus(bookingStatus);
      if (mode == BookingChatMode.hidden) {
        errorText.value = 'Chat is not available for cancelled bookings.';
        return;
      }
      isReadOnly.value = mode == BookingChatMode.readOnly;
      await _loadFirebaseChat(id);
    } catch (err) {
      errorText.value = '$err';
    }
    isLoading.value = false;
  }

  Future<void> _loadFirebaseChat(int id) async {
    final databaseUrl = EnvService.firebaseDatabaseUrl.trim();
    final database = databaseUrl.isNotEmpty
        ? FirebaseDatabase.instanceFor(
            app: Firebase.app(),
            databaseURL: databaseUrl,
          )
        : FirebaseDatabase.instance;
    _messagesRef = database.ref('booking_chats/$id/messages');
    final currentUserId = Prefs().userId().trim();
    _presenceRef = currentUserId.isEmpty
        ? null
        : database.ref('booking_chats/$id/presence/$currentUserId');
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
  }

  Future<void> sendMessage() async {
    if (isReadOnly.value || isSending.value) return;
    final text = messageController.text.trim();
    if (text.isEmpty) return;

    final ref = _messagesRef;
    if (ref == null) {
      showAppSnackBar(
        title: 'Chat unavailable',
        message: 'Please wait for chat to connect.',
        isError: true,
      );
      return;
    }

    final senderId = Prefs().userId().toString();
    final senderName = currentUserName.trim().isNotEmpty
        ? currentUserName.trim()
        : Prefs().userFullName().trim();
    final senderImage = currentUserImage.trim().isNotEmpty
        ? currentUserImage.trim()
        : Prefs().userImage().trim();
    final pushRef = ref.push();
    final key = pushRef.key;
    if (key == null || key.isEmpty) return;

    isSending.value = true;
    try {
      final users = {
        'receiverId': receiverId,
        'receiverImage': peerImage.value,
        'receiverName': peerName.value,
        'senderId': senderId,
        'senderImage': senderImage,
        'senderName': senderName,
      };
      final timestamp = DateTime.now().millisecondsSinceEpoch;
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
        'seen': false,
        'isReply': false,
        'unreadCount': 0,
        'timezone': DateTime.now().timeZoneName,
        'attachment': {'audio': '', 'image': '', 'thumbnail': '', 'video': ''},
        'users': users,
      });
      await _messagesRef?.parent?.child('users').set(users);
      messageController.clear();
      _scrollToBottomSoon();
      unawaited(_notifyReceiverIfAway(messageId: key, message: text));
    } catch (err) {
      showAppSnackBar(title: 'Message failed', message: '$err', isError: true);
    } finally {
      isSending.value = false;
    }
  }

  bool isMine(BookingChatMessage message) {
    return message.senderId == Prefs().userId().toString();
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
    } catch (_) {
      // Presence is best-effort; notification fallback still works.
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

  Future<bool> _isReceiverOnChatPage() async {
    final id = bookingId;
    final receiver = receiverId.trim();
    if (id == null || id <= 0 || receiver.isEmpty) return false;
    try {
      final snapshot = await _messagesRef?.parent
          ?.child('presence/$receiver/active')
          .get();
      return snapshot?.value == true;
    } catch (_) {
      return false;
    }
  }

  Future<void> _notifyReceiverIfAway({
    required String messageId,
    required String message,
  }) async {
    final id = bookingId;
    if (id == null || id <= 0) return;
    if (await _isReceiverOnChatPage()) return;

    try {
      await _notificationRepository.notifyBookingChatMessage(
        bookingId: id,
        messageId: messageId,
        message: message,
      );
    } catch (_) {
      // Sending the chat message succeeded; push notification failure is non-blocking.
    }
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

dynamic _deepStringMap(dynamic value) {
  if (value is Map) {
    return value.map((key, child) => MapEntry('$key', _deepStringMap(child)));
  }
  if (value is List) {
    return value.map(_deepStringMap).toList(growable: false);
  }
  return value;
}
