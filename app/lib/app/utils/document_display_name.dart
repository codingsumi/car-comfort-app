/// Human-readable label for driver onboarding / profile documents.
String formatDocumentDisplayName(String? raw) {
  final trimmed = raw?.trim() ?? '';
  if (trimmed.isEmpty) return 'Document';

  final words = trimmed.replaceAll('_', ' ').split(RegExp(r'\s+'));
  return words
      .where((w) => w.isNotEmpty)
      .map((w) {
        final lower = w.toLowerCase();
        if (lower.isEmpty) return w;
        return '${lower[0].toUpperCase()}${lower.substring(1)}';
      })
      .join(' ');
}
