import 'package:get/get.dart';
import 'package:url_launcher/url_launcher.dart';

import '../widgets/document_image_viewer.dart';
import 'app_snackbar.dart';
import 'document_display_name.dart';
import 'media_url.dart';

/// Opens an uploaded driver document (image full-screen or PDF externally).
Future<void> openUploadedDocument(
  String? rawUrl, {
  String? title,
}) async {
  final url = MediaUrl.resolve(rawUrl);
  final displayName = formatDocumentDisplayName(title);

  if (url.isEmpty) {
    showAppSnackBar(
      title: displayName,
      message: 'Document is not available',
      isError: true,
    );
    return;
  }

  if (MediaUrl.isPdf(url)) {
    final uri = Uri.tryParse(url);
    if (uri == null) {
      showAppSnackBar(
        title: displayName,
        message: 'Invalid document link',
        isError: true,
      );
      return;
    }
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened) {
      showAppSnackBar(
        title: displayName,
        message: 'Could not open the PDF',
        isError: true,
      );
    }
    return;
  }

  final context = Get.context;
  if (context == null || !context.mounted) return;

  await DocumentImageViewer.show(
    context,
    imageUrl: url,
    title: displayName,
  );
}
