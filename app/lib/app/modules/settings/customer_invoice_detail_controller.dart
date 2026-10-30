import 'package:get/get.dart';

import '../../network/repository/dash_repository.dart';
import '../../network/response/booking_detail_response.dart';
import '../../utils/booking_invoice_download.dart';
import '../../utils/custom_loader.dart';

class CustomerInvoiceDetailController extends GetxController {
  final DashRepository _dashRepository = DashRepository();

  final Rxn<BookingDetailData> detail = Rxn<BookingDetailData>();
  final RxBool isLoading = false.obs;
  final RxBool isDownloadingInvoice = false.obs;
  final RxString error = ''.obs;
  final RxnString paymentAmountLabel = RxnString();
  final RxnString paymentDateLabel = RxnString();
  final RxnString paymentStatusLabel = RxnString();

  Future<void> load({
    required int bookingId,
    String? paymentAmount,
    String? paymentDateLabel,
    String? paymentStatusLabel,
  }) async {
    paymentAmountLabel.value = paymentAmount?.trim();
    this.paymentDateLabel.value = paymentDateLabel?.trim();
    this.paymentStatusLabel.value = paymentStatusLabel?.trim();

    isLoading.value = true;
    error.value = '';
    try {
      final res = await _dashRepository.getBookingDetail(bookingId: bookingId);
      res.when(
        success: (data) {
          detail.value = data.data;
          if (detail.value == null) {
            error.value = 'Booking details are unavailable.';
          }
        },
        error: (err) {
          error.value = err.message;
        },
      );
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> downloadInvoicePdf({
    required int bookingId,
    String? bookingCode,
  }) async {
    if (isDownloadingInvoice.value) return;
    isDownloadingInvoice.value = true;
    Loader.showLoading();
    try {
      await downloadCustomerBookingInvoice(
        bookingId: bookingId,
        bookingCode: bookingCode,
      );
    } finally {
      Loader.hideLoading();
      isDownloadingInvoice.value = false;
    }
  }
}
