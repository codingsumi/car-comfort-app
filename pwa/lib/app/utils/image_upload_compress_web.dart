import 'package:dio/dio.dart';
import 'package:image_picker/image_picker.dart';

Future<MultipartFile> multipartFileFromUploadImage(String path) async {
  return _multipartFileFromBrowserPath(path, imageOnly: true);
}

Future<MultipartFile> multipartFileFromMediaPath(String path) async {
  return _multipartFileFromBrowserPath(path);
}

Future<MultipartFile> _multipartFileFromBrowserPath(
  String path, {
  bool imageOnly = false,
}) async {
  final trimmed = path.trim();
  if (trimmed.isEmpty) throw StateError('No file was selected.');

  final bytes = await XFile(trimmed).readAsBytes();
  if (bytes.isEmpty) throw StateError('The selected file is empty.');
  if (imageOnly && bytes.length > 15 * 1024 * 1024) {
    throw StateError('The selected image is larger than 15 MB.');
  }

  final type = _browserUploadType(bytes, imageOnly: imageOnly);
  return MultipartFile.fromBytes(
    bytes,
    filename:
        '${imageOnly ? 'image' : 'media'}_${DateTime.now().microsecondsSinceEpoch}.${type.extension}',
    contentType: type.contentType,
  );
}

({String extension, DioMediaType contentType}) _browserUploadType(
  List<int> bytes, {
  required bool imageOnly,
}) {
  bool startsWith(List<int> signature, [int offset = 0]) {
    if (bytes.length < offset + signature.length) return false;
    for (var i = 0; i < signature.length; i++) {
      if (bytes[offset + i] != signature[i]) return false;
    }
    return true;
  }

  if (startsWith(const [0x89, 0x50, 0x4E, 0x47])) {
    return (extension: 'png', contentType: DioMediaType('image', 'png'));
  }
  if (startsWith(const [0x47, 0x49, 0x46, 0x38])) {
    return (extension: 'gif', contentType: DioMediaType('image', 'gif'));
  }
  if (startsWith(const [0x52, 0x49, 0x46, 0x46]) &&
      startsWith(const [0x57, 0x45, 0x42, 0x50], 8)) {
    return (extension: 'webp', contentType: DioMediaType('image', 'webp'));
  }
  if (startsWith(const [0x42, 0x4D])) {
    return (extension: 'bmp', contentType: DioMediaType('image', 'bmp'));
  }
  if (!imageOnly && startsWith(const [0x66, 0x74, 0x79, 0x70], 4)) {
    return (extension: 'mp4', contentType: DioMediaType('video', 'mp4'));
  }
  return (extension: 'jpg', contentType: DioMediaType('image', 'jpeg'));
}
