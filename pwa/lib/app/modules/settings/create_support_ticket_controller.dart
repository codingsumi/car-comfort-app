import 'dart:async';

import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../network/repository/support_repository.dart';
import '../../network/response/support_ticket_response.dart';
import '../../routes/app_pages.dart';
import '../../utils/app_snackbar.dart';
import '../../utils/custom_loader.dart';

class CreateSupportTicketController extends GetxController {
  CreateSupportTicketController() : _repo = Get.find<SupportRepository>();

  final SupportRepository _repo;

  final subjectController = TextEditingController();
  final messageController = TextEditingController();
  final isSubmitting = false.obs;

  @override
  void onClose() {
    subjectController.dispose();
    messageController.dispose();
    super.onClose();
  }

  Future<void> submit() async {
    final subject = subjectController.text.trim();
    final message = messageController.text.trim();
    if (subject.isEmpty) {
      showAppSnackBar(
        title: 'Support',
        message: 'Please enter a subject.',
        isError: true,
      );
      return;
    }
    if (message.isEmpty) {
      showAppSnackBar(
        title: 'Support',
        message: 'Please describe your issue.',
        isError: true,
      );
      return;
    }

    isSubmitting.value = true;
    Loader.showLoading();
    final res = await _repo.createTicket(subject: subject, message: message);
    Loader.hideLoading();
    isSubmitting.value = false;

    res.when(
      success: (SupportTicketCreateApiResponse r) {
        final ticket = r.ticket;
        if (ticket?.id == null) {
          showAppSnackBar(title: 'Support', message: 'Ticket created.');
          Get.back(result: true);
          return;
        }
        showAppSnackBar(
          title: 'Support',
          message: r.message ?? 'Your ticket has been submitted.',
        );
        Get.offNamed(
          Routes.SUPPORT_TICKET_DETAIL,
          arguments: {'ticketId': ticket!.id},
        );
      },
      error: (e) {
        showAppSnackBar(
          title: 'Support',
          message: e.errorMessage,
          isError: true,
        );
      },
    );
  }
}
