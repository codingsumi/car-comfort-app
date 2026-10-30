import 'dart:async';

import 'package:get/get.dart';

import '../../network/repository/support_repository.dart';
import '../../network/response/support_ticket_response.dart';
class SupportTicketsController extends GetxController {
  SupportTicketsController() : _repo = Get.find<SupportRepository>();

  final SupportRepository _repo;

  final tickets = <SupportTicketSummary>[].obs;
  final isLoading = false.obs;
  final errorMessage = RxnString();

  @override
  void onInit() {
    super.onInit();
    unawaited(loadTickets(refresh: true));
  }

  Future<void> loadTickets({bool refresh = false}) async {
    if (isLoading.value && !refresh) return;
    isLoading.value = true;
    if (refresh) errorMessage.value = null;

    final res = await _repo.listMyTickets();
    res.when(
      success: (SupportTicketListApiResponse r) {
        tickets.assignAll(r.tickets);
        if (tickets.isEmpty && (r.message?.isNotEmpty ?? false)) {
          errorMessage.value = null;
        }
      },
      error: (e) {
        errorMessage.value = e.errorMessage;
        if (refresh) tickets.clear();
      },
    );
    isLoading.value = false;
  }

  Future<void> refreshTickets() => loadTickets(refresh: true);

  void onTicketCreated(SupportTicketSummary ticket) {
    final id = ticket.id;
    if (id == null) {
      unawaited(refreshTickets());
      return;
    }
    final existing = tickets.indexWhere((t) => t.id == id);
    if (existing >= 0) {
      tickets[existing] = ticket;
    } else {
      tickets.insert(0, ticket);
    }
  }
}
