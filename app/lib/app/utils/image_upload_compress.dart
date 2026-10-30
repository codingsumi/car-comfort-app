import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:path_provider/path_provider.dart';

/// Server-side upload cap (must match backend multer limits).
class ImageUploadLimits {
  static const int maxBytes = 15 * 1024 * 1024;
  static const int maxEdgePx = 2400;
  static const int defaultQuality = 85;

  /// Provider photos are used for identity verification in the admin panel.
  /// Keep substantially more source detail than ordinary booking thumbnails.
  static const int profileMaxEdgePx = 4096;
  static const int profileQuality = 96;
}

bool isUploadableImagePath(String path) {
  final lower = path.trim().toLowerCase();
  return lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.png') ||
      lower.endsWith('.bmp') ||
      lower.endsWith('.webp') ||
      lower.endsWith('.heic') ||
      lower.endsWith('.heif');
}

/// Copies picker output into app temp storage with a `.jpg` extension when needed.
///
/// iOS camera captures often use ephemeral temp files that disappear before
/// crop/compress; pass [bytes] from [XFile.readAsBytes] right after pick.
Future<String> stabilizePickedImagePath(
  String sourcePath, {
  bool forceCopy = false,
  List<int>? bytes,
}) async {
  if (kIsWeb) return sourcePath;

  final trimmed = sourcePath.trim();
  if (trimmed.isEmpty) return trimmed;

  final dir = await getTemporaryDirectory();
  final destPath =
      '${dir.path}/picked_${DateTime.now().millisecondsSinceEpoch}.jpg';

  if (bytes != null && bytes.isNotEmpty) {
    await File(destPath).writeAsBytes(bytes, flush: true);
    return destPath;
  }

  final source = File(trimmed);
  if (!await source.exists()) return trimmed;

  if (!forceCopy && isUploadableImagePath(trimmed)) {
    return trimmed;
  }

  await source.copy(destPath);
  return destPath;
}

Future<String> persistProcessedImageBytes(
  List<int> bytes, {
  String prefix = 'pick',
}) async {
  if (kIsWeb) {
    throw UnsupportedError('persistProcessedImageBytes is mobile-only');
  }

  final dir = await getApplicationDocumentsDirectory();
  final folder = Directory('${dir.path}/picked_images');
  if (!await folder.exists()) {
    await folder.create(recursive: true);
  }
  final destPath =
      '${folder.path}/${prefix}_${DateTime.now().millisecondsSinceEpoch}.jpg';
  await File(destPath).writeAsBytes(bytes, flush: true);
  return destPath;
}

Future<String> persistProcessedImageFile(
  String sourcePath, {
  String prefix = 'pick',
}) async {
  if (kIsWeb) return sourcePath;

  final file = File(sourcePath.trim());
  if (!await file.exists()) return sourcePath;
  final bytes = await file.readAsBytes();
  if (bytes.isEmpty) return sourcePath;
  return persistProcessedImageBytes(bytes, prefix: prefix);
}

Future<String> persistCameraCapture(XFile picFile) async {
  if (kIsWeb) return picFile.path;

  final filePath = picFile.path.trim();

  // First attempt — read bytes directly.
  var bytes = await picFile.readAsBytes();

  // Some Android devices (especially with custom camera apps) write the file
  // asynchronously after returning to the app. Retry with a short delay.
  if (bytes.isEmpty) {
    await Future<void>.delayed(const Duration(milliseconds: 350));
    bytes = await picFile.readAsBytes();
  }

  if (bytes.isEmpty && filePath.isNotEmpty) {
    final source = File(filePath);
    if (await source.exists()) {
      bytes = await source.readAsBytes();
    }
  }

  // Second retry after a longer delay (slow camera writes on older hardware).
  if (bytes.isEmpty) {
    await Future<void>.delayed(const Duration(milliseconds: 600));
    bytes = await picFile.readAsBytes();
    if (bytes.isEmpty && filePath.isNotEmpty) {
      final source = File(filePath);
      if (await source.exists()) bytes = await source.readAsBytes();
    }
  }

  if (bytes.isEmpty) {
    throw StateError('Camera capture returned no image data');
  }

  return persistProcessedImageBytes(bytes, prefix: 'camera');
}

Future<String?> existingImagePathOrNull(String? path) async {
  if (kIsWeb) return path;
  final trimmed = path?.trim() ?? '';
  if (trimmed.isEmpty) return null;
  if (await File(trimmed).exists()) return trimmed;
  return null;
}

Future<String> compressImageForUpload(String sourcePath) async {
  if (kIsWeb) return sourcePath;

  final trimmed = sourcePath.trim();
  if (trimmed.isEmpty || !isUploadableImagePath(trimmed)) {
    return trimmed;
  }

  final sourceFile = File(trimmed);
  if (!await sourceFile.exists()) return trimmed;

  final dir = await getTemporaryDirectory();
  final targetPath =
      '${dir.path}/upload_${DateTime.now().millisecondsSinceEpoch}.jpg';

  var quality = ImageUploadLimits.defaultQuality;
  var edge = ImageUploadLimits.maxEdgePx;
  XFile? compressed;

  for (var attempt = 0; attempt < 4; attempt++) {
    compressed = await FlutterImageCompress.compressAndGetFile(
      trimmed,
      targetPath,
      quality: quality,
      minWidth: edge,
      minHeight: edge,
      format: CompressFormat.jpeg,
      keepExif: false,
    );
    if (compressed == null) break;

    final outFile = File(compressed.path);
    if (!await outFile.exists()) break;

    final size = await outFile.length();
    if (size <= ImageUploadLimits.maxBytes) {
      return compressed.path;
    }

    quality = (quality - 15).clamp(40, 85);
    edge = (edge * 0.85).round().clamp(1280, ImageUploadLimits.maxEdgePx);
  }

  final result = compressed?.path ?? trimmed;
  if (await File(result).exists()) return result;
  if (await sourceFile.exists()) return trimmed;
  return result;
}

/// Prepares an identity/profile photo without altering uploadable source files.
///
/// Profile photos can be downloaded by administrators to compare against a
/// provider's driver license, so the regular 2400 px / quality-85 upload preset
/// is intentionally not used here. Original bytes are preserved under the
/// backend limit; only oversized files use the high-quality JPEG fallback.
Future<String> compressProfileImageForUpload(String sourcePath) async {
  if (kIsWeb) return sourcePath;

  final trimmed = sourcePath.trim();
  if (trimmed.isEmpty || !isUploadableImagePath(trimmed)) {
    return trimmed;
  }

  final sourceFile = File(trimmed);
  if (!await sourceFile.exists()) return trimmed;

  // Preserve the provider's original bytes, dimensions, aspect ratio, and
  // image format whenever the file already satisfies the server limit.
  if (await sourceFile.length() <= ImageUploadLimits.maxBytes) {
    return trimmed;
  }

  final dir = await getTemporaryDirectory();
  var quality = ImageUploadLimits.profileQuality;
  var edge = ImageUploadLimits.profileMaxEdgePx;
  XFile? compressed;

  for (var attempt = 0; attempt < 5; attempt++) {
    final targetPath =
        '${dir.path}/profile_upload_${DateTime.now().microsecondsSinceEpoch}_$attempt.jpg';
    compressed = await FlutterImageCompress.compressAndGetFile(
      trimmed,
      targetPath,
      quality: quality,
      minWidth: edge,
      minHeight: edge,
      format: CompressFormat.jpeg,
      keepExif: false,
    );
    if (compressed == null) break;

    final outFile = File(compressed.path);
    if (!await outFile.exists()) break;
    if (await outFile.length() <= ImageUploadLimits.maxBytes) {
      return compressed.path;
    }

    quality = (quality - 6).clamp(72, ImageUploadLimits.profileQuality);
    edge = (edge * 0.9).round().clamp(
      ImageUploadLimits.maxEdgePx,
      ImageUploadLimits.profileMaxEdgePx,
    );
  }

  final result = compressed?.path ?? trimmed;
  if (await File(result).exists()) return result;
  return trimmed;
}

Future<List<String>> compressImagePathsForUpload(List<String> paths) async {
  final out = <String>[];
  for (final path in paths) {
    final trimmed = path.trim();
    if (trimmed.isEmpty) continue;
    out.add(await compressImageForUpload(trimmed));
  }
  return out;
}

Future<MultipartFile> multipartFileFromUploadImage(String path) async {
  final prepared = await compressImageForUpload(path);
  return MultipartFile.fromFile(prepared);
}

Future<MultipartFile> multipartFileFromProfileImage(String path) async {
  final prepared = await compressProfileImageForUpload(path);
  return MultipartFile.fromFile(prepared);
}

Future<MultipartFile> multipartFileFromMediaPath(String path) async {
  final trimmed = path.trim();
  if (isUploadableImagePath(trimmed)) {
    return multipartFileFromUploadImage(trimmed);
  }
  return MultipartFile.fromFile(trimmed);
}
