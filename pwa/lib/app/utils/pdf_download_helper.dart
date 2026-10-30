import 'dart:io';

import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:flutter/foundation.dart' show defaultTargetPlatform, TargetPlatform;

/// Opens a saved PDF on device, falling back to the system share sheet.
Future<void> openDownloadedPdfFile({
  required String path,
  required String shareSubject,
  required String shareText,
}) async {
  final opened = await OpenFilex.open(path);
  if (opened.type != ResultType.done) {
    await SharePlus.instance.share(
      ShareParams(
        files: [XFile(path)],
        subject: shareSubject,
        text: shareText,
      ),
    );
  }
}

/// Returns the best directory for saving a PDF that will be immediately
/// opened or shared via [open_filex] / [share_plus].
///
/// On Android, [getApplicationDocumentsDirectory] resolves to
/// `…/app_flutter/` which is NOT covered by the standard FileProvider
/// path types (`<files-path>`, `<cache-path>`, etc.).  Using the cache
/// directory avoids the `IllegalArgumentException: Failed to find
/// configured root` crash when FileProvider tries to create a content URI.
Future<Directory> _pdfSaveDirectory() async {
  if (defaultTargetPlatform == TargetPlatform.android) {
    return getTemporaryDirectory(); // → …/cache/  ✓ covered by <cache-path>
  }
  return getApplicationDocumentsDirectory();
}

/// Persists [bytes] under [fileName] in the appropriate directory and opens it.
Future<String> saveAndOpenPdfFile({
  required List<int> bytes,
  required String fileName,
  required String shareSubject,
  required String shareText,
}) async {
  final safeName = fileName.trim().isEmpty ? 'document.pdf' : fileName.trim();
  final dir = await _pdfSaveDirectory();
  final path = '${dir.path}/$safeName';
  final file = File(path);
  await file.writeAsBytes(bytes, flush: true);
  await openDownloadedPdfFile(
    path: path,
    shareSubject: shareSubject,
    shareText: shareText,
  );
  return path;
}
