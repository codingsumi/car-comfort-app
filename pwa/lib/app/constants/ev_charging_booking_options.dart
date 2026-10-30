class EvBatteryStatusOption {
  const EvBatteryStatusOption({
    required this.value,
    required this.label,
    required this.pricingPercent,
  });

  final String value;
  final String label;
  final int pricingPercent;
}

class EvChargingBookingOptions {
  EvChargingBookingOptions._();

  /// Exact customer-facing battery status dropdown labels (order preserved).
  static const batteryStatusLabelsExact = <String>[
    '0-5%',
    '6%',
    '7%',
    '8%',
    '9%',
    '10%',
    '11%',
    '12%',
    '13%',
    '14%',
    '15%',
    '16%',
    '17%',
    '18%',
    '19%',
    '20%',
    '21-25%',
    '25-30%',
    '30-40%',
    '40-50%',
    '50%',
    'Above',
  ];

  static const batteryStatusOptions = <EvBatteryStatusOption>[
    EvBatteryStatusOption(value: '0_5', label: '0-5%', pricingPercent: 3),
    EvBatteryStatusOption(value: '6', label: '6%', pricingPercent: 6),
    EvBatteryStatusOption(value: '7', label: '7%', pricingPercent: 7),
    EvBatteryStatusOption(value: '8', label: '8%', pricingPercent: 8),
    EvBatteryStatusOption(value: '9', label: '9%', pricingPercent: 9),
    EvBatteryStatusOption(value: '10', label: '10%', pricingPercent: 10),
    EvBatteryStatusOption(value: '11', label: '11%', pricingPercent: 11),
    EvBatteryStatusOption(value: '12', label: '12%', pricingPercent: 12),
    EvBatteryStatusOption(value: '13', label: '13%', pricingPercent: 13),
    EvBatteryStatusOption(value: '14', label: '14%', pricingPercent: 14),
    EvBatteryStatusOption(value: '15', label: '15%', pricingPercent: 15),
    EvBatteryStatusOption(value: '16', label: '16%', pricingPercent: 16),
    EvBatteryStatusOption(value: '17', label: '17%', pricingPercent: 17),
    EvBatteryStatusOption(value: '18', label: '18%', pricingPercent: 18),
    EvBatteryStatusOption(value: '19', label: '19%', pricingPercent: 19),
    EvBatteryStatusOption(value: '20', label: '20%', pricingPercent: 20),
    EvBatteryStatusOption(value: '21_25', label: '21-25%', pricingPercent: 23),
    EvBatteryStatusOption(value: '25_30', label: '25-30%', pricingPercent: 28),
    EvBatteryStatusOption(value: '30_40', label: '30-40%', pricingPercent: 35),
    EvBatteryStatusOption(value: '40_50', label: '40-50%', pricingPercent: 45),
    EvBatteryStatusOption(value: '50', label: '50%', pricingPercent: 50),
    EvBatteryStatusOption(value: 'above', label: 'Above', pricingPercent: 75),
  ];

  static const Map<String, String> _legacyValueAliases = {
    '50_plus': 'above',
  };

  static const Map<String, String> _legacyLabelAliases = {
    '50% or above': 'above',
  };

  static final Map<String, EvBatteryStatusOption> _byLabel = {
    for (final option in batteryStatusOptions) option.label: option,
    ...{
      for (final entry in _legacyLabelAliases.entries)
        entry.key: batteryStatusOptions.firstWhere(
          (option) => option.value == entry.value,
        ),
    },
  };

  static final Map<String, EvBatteryStatusOption> _byValue = {
    for (final option in batteryStatusOptions) option.value: option,
    ...{
      for (final entry in _legacyValueAliases.entries)
        entry.key: batteryStatusOptions.firstWhere(
          (option) => option.value == entry.value,
        ),
    },
  };

  /// Default selected battery status in the EV vehicle step.
  static const defaultBatteryStatusLabel = '0-5%';

  static List<String> defaultBatteryStatusLabels() =>
      List<String>.from(batteryStatusLabelsExact);

  static List<String> vehicleChargeLimitLabels() {
    return List<String>.generate(
      11,
      (index) => '${50 + (index * 5)}%',
      growable: false,
    );
  }

  static EvBatteryStatusOption? optionForLabel(String? label) {
    final key = (label ?? '').trim();
    if (key.isEmpty) return null;
    return _byLabel[key];
  }

  static EvBatteryStatusOption? optionForValue(String? value) {
    final key = (value ?? '').trim();
    if (key.isEmpty) return null;
    final normalized = _legacyValueAliases[key] ?? key;
    return _byValue[normalized] ?? _byValue[key];
  }

  static bool isAboveBatteryBucket(String? label) =>
      optionForLabel(label)?.value == 'above';

  static String resolveDefaultBatteryStatusLabel({
    Map<String, dynamic>? apiData,
  }) {
    final fromApi = apiData?['default_battery_status'];
    if (fromApi is Map) {
      final label = fromApi['label']?.toString().trim();
      if (label != null && label.isNotEmpty && optionForLabel(label) != null) {
        return label;
      }
    }
    return defaultBatteryStatusLabel;
  }

  static List<String> parseBatteryStatusLabels(dynamic raw) {
    if (raw is List) {
      final labels = raw
          .map((item) {
            if (item is String) return item.trim();
            if (item is Map) {
              return item['label']?.toString().trim() ?? '';
            }
            return '';
          })
          .where((label) => label.isNotEmpty)
          .toList(growable: false);
      if (labels.isNotEmpty) return labels;
    }
    return defaultBatteryStatusLabels();
  }

  static List<String> parseVehicleChargeLimitLabels(dynamic raw) {
    if (raw is List) {
      final labels = raw
          .map((item) {
            if (item is String) return item.trim();
            if (item is Map) {
              final label = item['label']?.toString().trim();
              if (label != null && label.isNotEmpty) return label;
              final value = item['value'];
              if (value != null) return '$value%';
            }
            return '';
          })
          .where((label) => label.isNotEmpty)
          .toList(growable: false);
      if (labels.isNotEmpty) return labels;
    }
    return vehicleChargeLimitLabels();
  }
}
