import '../network/repository/dash_repository.dart';
import '../network/utils/network_result.dart';
import 'app_snackbar.dart';
import 'pdf_download_helper.dart';

/// Downloads a completed booking invoice PDF (same flow as provider earnings).
Future<bool> downloadCustomerBookingInvoice({
  required int bookingId,
  String? bookingCode,
}) async {
  if (bookingId <= 0) {
    showAppSnackBar(
      title: 'Download failed',
      message: 'Booking id is missing.',
      isError: true,
    );
    return false;
  }

  final repo = DashRepository();
  final result = await repo.downloadBookingInvoice(bookingId: bookingId);

  switch (result) {
    case NetworkSuccess<List<int>>(:final data):
      final code = (bookingCode ?? '').trim();
      final fileKey = code.isNotEmpty ? code : '$bookingId';
      await saveAndOpenPdfFile(
        bytes: data,
        fileName: 'car-comfort-invoice-$fileKey.pdf',
        shareSubject: 'Car Comfort Service Invoice',
        shareText: 'Car Comfort service invoice for booking #$fileKey.',
      );
      return true;
    case NetworkError<List<int>>(:final error):
      showAppSnackBar(
        title: 'Download failed',
        message: error.message,
        isError: true,
      );
      return false;
  }
}
