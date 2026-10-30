/// Standard vehicle color presets for add/edit vehicle flows.
class VehicleColors {
  VehicleColors._();

  static const String other = 'Other';

  static const List<String> presets = [
    'Black',
    'White',
    'Silver',
    'Gray',
    'Charcoal',
    'Pearl White',
    'Red',
    'Burgundy',
    'Maroon',
    'Blue',
    'Navy',
    'Light Blue',
    'Teal',
    'Green',
    'Yellow',
    'Gold',
    'Orange',
    'Brown',
    'Beige',
    'Tan',
    'Champagne',
    'Purple',
    'Pink',
    'Bronze',
    'Copper',
    'Cream',
    'Ivory',
    'Gunmetal',
    'Lime Green',
    'Midnight Blue',
  ];

  static final List<String> pickerOptions = [...presets, other];

  static bool isOther(String? value) =>
      value != null && value.trim().toLowerCase() == other.toLowerCase();

  static bool isPreset(String? value) {
    final normalized = _normalize(value);
    if (normalized.isEmpty) return false;
    if (normalized == 'grey') return true;
    return presets.any((c) => _normalize(c) == normalized);
  }

  static String _normalize(String? value) => (value ?? '').trim().toLowerCase();

  /// Dropdown selection when loading a stored vehicle color.
  static String? pickerValueFromStored(String? stored) {
    final raw = (stored ?? '').trim();
    if (raw.isEmpty) return null;
    if (isPreset(raw)) {
      if (_normalize(raw) == 'grey') return 'Gray';
      for (final preset in presets) {
        if (_normalize(preset) == _normalize(raw)) return preset;
      }
    }
    return other;
  }

  /// Custom color text when stored value is not a preset.
  static String? customValueFromStored(String? stored) {
    final raw = (stored ?? '').trim();
    if (raw.isEmpty || isPreset(raw)) return null;
    return raw;
  }

  static String? resolveForApi({
    required String? selectedPickerValue,
    required String? customColorText,
  }) {
    final selected = (selectedPickerValue ?? '').trim();
    if (selected.isEmpty) return null;
    if (isOther(selected)) {
      final custom = (customColorText ?? '').trim();
      return custom.isEmpty ? null : custom;
    }
    return selected;
  }
}
