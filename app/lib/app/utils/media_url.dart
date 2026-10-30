import 'env_service.dart';

/// Resolves API upload paths to absolute URLs for images and PDFs.
abstract final class MediaUrl {
  static String resolve(String? raw) {
    final trimmed = raw?.trim() ?? '';
    if (trimmed.isEmpty) return '';

    String resolved;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      resolved = trimmed;
    } else {
      var base = EnvService.baseUrl.replaceAll(RegExp(r'/+$'), '');
      base = base.replaceAll(RegExp(r'/api$', caseSensitive: false), '');
      resolved = trimmed.startsWith('/') ? '$base$trimmed' : '$base/$trimmed';
    }

    return rewriteUnreachableHost(resolved);
  }

  /// Rewrites admin-uploaded localhost URLs so physical devices can load media.
  static String rewriteUnreachableHost(String url) {
    final uri = Uri.tryParse(url);
    if (uri == null || !uri.hasScheme) return url;

    final host = uri.host.toLowerCase();
    final unreachable = host == 'localhost' ||
        host == '127.0.0.1' ||
        host == '10.0.2.2';
    if (!unreachable) return url;

    final origin = _apiOrigin();
    if (origin.isEmpty) return url;

    final apiUri = Uri.parse(origin);
    return uri
        .replace(
          scheme: apiUri.scheme,
          host: apiUri.host,
          port: apiUri.hasPort ? apiUri.port : null,
        )
        .toString();
  }

  static String _apiOrigin() {
    final fromSocket = EnvService.socketIoOrigin.trim();
    if (fromSocket.isNotEmpty) return fromSocket;

    var base = EnvService.baseUrl.replaceAll(RegExp(r'/+$'), '');
    base = base.replaceAll(RegExp(r'/api$', caseSensitive: false), '');
    return base;
  }

  /// Extra headers for file downloads (e.g. ngrok interstitial bypass).
  static Map<String, String> downloadHeaders() {
    final base = EnvService.baseUrl.toLowerCase();
    if (base.contains('ngrok')) {
      return const {'ngrok-skip-browser-warning': 'true'};
    }
    return const {};
  }

  static bool isPdf(String url) {
    final path = Uri.tryParse(url)?.path.toLowerCase() ?? url.toLowerCase();
    return path.endsWith('.pdf');
  }
}
