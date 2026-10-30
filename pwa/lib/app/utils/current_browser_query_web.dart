import 'dart:html' as html;

/// Reads the browser's live URL instead of `Uri.base`, which can retain the
/// URL that originally bootstrapped a Flutter single-page application.
Map<String, String> currentBrowserQueryParameters() {
  final uri = Uri.tryParse(html.window.location.href);
  if (uri == null) return const <String, String>{};
  if (uri.queryParameters.isNotEmpty) return uri.queryParameters;

  // Also support hash-based deployments: /#/service-detail?bookingId=123.
  final fragment = uri.fragment.trim();
  if (!fragment.contains('?')) return const <String, String>{};
  final fragmentUri = Uri.tryParse(
    fragment.startsWith('/') ? fragment : '/$fragment',
  );
  return fragmentUri?.queryParameters ?? const <String, String>{};
}
