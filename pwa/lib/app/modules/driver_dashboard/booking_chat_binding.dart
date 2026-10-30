import 'package:get/get.dart';

import 'booking_chat_controller.dart';

class BookingChatBinding extends Bindings {
  @override
  void dependencies() {
    Get.lazyPut<BookingChatController>(() => BookingChatController());
  }
}
