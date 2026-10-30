/// Vehicle type presets for add/edit vehicle flows (API list + Other).
class VehicleTypes {
  VehicleTypes._();

  static const String other = 'Other';

  static bool isOther(String? value) =>
      value != null && value.trim().toLowerCase() == other.toLowerCase();

  static List<String> pickerOptionsFrom(List<String> types) {
    final presets = types
        .map((t) => t.trim())
        .where((t) => t.isNotEmpty && !isOther(t))
        .toList();
    return [...presets, other];
  }

  static String? pickerValueFromStored(String? stored, List<String> knownTypes) {
    final raw = (stored ?? '').trim();
    if (raw.isEmpty) return null;

    for (final type in knownTypes) {
      if (type.trim().toLowerCase() == raw.toLowerCase()) {
        return type;
      }
    }
    return other;
  }

  static String? customValueFromStored(String? stored, List<String> knownTypes) {
    final raw = (stored ?? '').trim();
    if (raw.isEmpty) return null;

    for (final type in knownTypes) {
      if (type.trim().toLowerCase() == raw.toLowerCase()) {
        return null;
      }
    }
    return raw;
  }

  static String? resolveForApi({
    required String? selectedPickerValue,
    required String? customTypeText,
  }) {
    final selected = (selectedPickerValue ?? '').trim();
    if (selected.isEmpty) return null;
    if (isOther(selected)) {
      final custom = (customTypeText ?? '').trim();
      return custom.isEmpty ? null : custom;
    }
    return selected;
  }
}
