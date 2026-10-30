const String kEvAccountCardOnFileApiField = 'ev_account_card_on_file';
const String kEvAccountCardOnFileQuestion =
    'Do you have an EV account with a card on file for charging purposes?';

const String _kEvAccountCardOnFileNotePrefix = '[EV_ACCOUNT_CARD_ON_FILE:';

bool? normalizeEvAccountCardOnFileValue(dynamic raw) {
  if (raw == null) return null;
  if (raw is bool) return raw;
  if (raw is num) {
    if (raw == 1) return true;
    if (raw == 0) return false;
    return null;
  }

  final text = raw.toString().trim().toLowerCase();
  if (text.isEmpty) return null;
  if (text == 'true' || text == 'yes' || text == 'y' || text == '1') {
    return true;
  }
  if (text == 'false' || text == 'no' || text == 'n' || text == '0') {
    return false;
  }
  return null;
}

String evAccountCardOnFileAnswerLabel(bool value) => value ? 'Yes' : 'No';

bool? evAccountCardOnFileValueFromNotes(Object? notes) {
  final raw = notes?.toString().trim() ?? '';
  if (raw.isEmpty) return null;
  final lines = raw.split('\n');
  if (lines.isEmpty) return null;
  final firstLine = lines.first.trim();
  if (!firstLine.startsWith(_kEvAccountCardOnFileNotePrefix) ||
      !firstLine.endsWith(']')) {
    return null;
  }
  final rawValue = firstLine
      .substring(_kEvAccountCardOnFileNotePrefix.length, firstLine.length - 1)
      .trim();
  return normalizeEvAccountCardOnFileValue(rawValue);
}

String sanitizeEvAccountCardOnFileNotes(Object? notes) {
  final raw = notes?.toString().trim() ?? '';
  if (raw.isEmpty) return '';
  final lines = raw.split('\n');
  if (lines.isEmpty) return '';
  final firstLine = lines.first.trim();
  if (!firstLine.startsWith(_kEvAccountCardOnFileNotePrefix) ||
      !firstLine.endsWith(']')) {
    return raw;
  }
  return lines.skip(1).join('\n').trim();
}

String buildEvAccountCardOnFileNotes({
  required String notes,
  bool? hasCardOnFile,
}) {
  final cleanedNotes = sanitizeEvAccountCardOnFileNotes(notes);
  final parts = <String>[];
  if (hasCardOnFile != null) {
    parts.add(
      '$_kEvAccountCardOnFileNotePrefix${hasCardOnFile ? 'YES' : 'NO'}]',
    );
  }
  if (cleanedNotes.isNotEmpty) {
    parts.add(cleanedNotes);
  }
  return parts.join('\n').trim();
}

bool? resolveEvAccountCardOnFileValue({dynamic rawValue, Object? notes}) {
  return normalizeEvAccountCardOnFileValue(rawValue) ??
      evAccountCardOnFileValueFromNotes(notes);
}
