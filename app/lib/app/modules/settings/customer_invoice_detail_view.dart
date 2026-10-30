import 'dart:async';

import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../widgets/blurred_image_screen_header.dart';
import '../../widgets/customer_booking_invoice_body.dart';
import '../../widgets/text.dart';
import '../dashboard/dashboard_controller.dart';
import 'customer_invoice_detail_controller.dart';

class CustomerInvoiceDetailView extends StatefulWidget {
  const CustomerInvoiceDetailView({super.key});

  @override
  State<CustomerInvoiceDetailView> createState() =>
      _CustomerInvoiceDetailViewState();
}

class _CustomerInvoiceDetailViewState extends State<CustomerInvoiceDetailView> {
  @override
  void initState() {
    super.initState();
    final args = (Get.arguments is Map) ? Get.arguments as Map : const {};
    final bookingId = int.tryParse(
      '${args['bookingId'] ?? args['booking_id'] ?? ''}',
    );
    if (bookingId != null && bookingId > 0) {
      final c = Get.find<CustomerInvoiceDetailController>();
      c.load(
        bookingId: bookingId,
        paymentAmount: args['paymentAmount']?.toString(),
        paymentDateLabel: args['paymentDateLabel']?.toString(),
        paymentStatusLabel: args['paymentStatusLabel']?.toString(),
      );
      if (Get.isRegistered<DashboardController>()) {
        Get.find<DashboardController>().scheduleServiceDetailLoad(bookingId);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
  final controller = Get.find<CustomerInvoiceDetailController>();

    return Scaffold(
      backgroundColor: const Color(0xffF4F4F4),
      body: Column(
        children: [
          BlurredImageScreenHeader(
            title: 'Service invoice',
            backgroundFit: BoxFit.fill,
            trailing: Obx(() {
              final detail = controller.detail.value;
              final downloading = controller.isDownloadingInvoice.value;
              final bookingId = detail?.id;
              return HeaderCircleIconButton(
                icon: downloading
                    ? Icons.hourglass_top_rounded
                    : Icons.download_outlined,
                onTap: () {
                  if (downloading || bookingId == null || bookingId <= 0) {
                    return;
                  }
                  unawaited(
                    controller.downloadInvoicePdf(
                      bookingId: bookingId,
                      bookingCode: detail?.bookingCode,
                    ),
                  );
                },
              );
            }),
          ),
          Expanded(
            child: Obx(() {
              final detail = controller.detail.value;
              final loading = controller.isLoading.value;
              final error = controller.error.value.trim();

              if (loading && detail == null && error.isEmpty) {
                return const Center(child: CircularProgressIndicator());
              }

              return SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(18, 12, 18, 32),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    CustomerBookingInvoiceBody(
                      detail: detail,
                      loading: loading,
                      showPaymentBanner: true,
                      paymentAmountLabel: controller.paymentAmountLabel.value,
                      paymentDateLabel: controller.paymentDateLabel.value,
                      paymentStatusLabel: controller.paymentStatusLabel.value,
                      showProviderHeader: true,
                    ),
                    if (error.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      CommonText.regular(
                        error,
                        size: 12,
                        color: Colors.red.shade400,
                        textAlign: TextAlign.center,
                      ),
                    ],
                    if (detail?.id != null &&
                        (detail?.invoice ?? '').trim().isNotEmpty) ...[
                      const SizedBox(height: 16),
                      Obx(() {
                        final downloading =
                            controller.isDownloadingInvoice.value;
                        return SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            onPressed: downloading
                                ? null
                                : () => unawaited(
                                      controller.downloadInvoicePdf(
                                        bookingId: detail!.id!,
                                        bookingCode: detail.bookingCode,
                                      ),
                                    ),
                            icon: Icon(
                              downloading
                                  ? Icons.hourglass_top_rounded
                                  : Icons.download_outlined,
                            ),
                            label: Text(
                              downloading
                                  ? 'Preparing invoice…'
                                  : 'Download Invoice (PDF)',
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xff2E7D32),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                            ),
                          ),
                        );
                      }),
                    ],
                  ],
                ),
              );
            }),
          ),
        ],
      ),
    );
  }
}
