/// Structured booking service notes — mirrors backend `bookingServiceNotes.js`.
class BookingServiceNotes {
  BookingServiceNotes._();

  static const serviceNotesIntro =
      'To ensure a seamless service experience, kindly provide us with accurate information regarding your vehicle and parking details.';

  static const otherLabel = 'Others';

  static const vehicleParkedOptions = [
    'My garage',
    'My driveway',
    'Parking lot',
    'Street parking',
    'Apt building parking garage',
    otherLabel,
  ];

  static const providerParkOptions = [
    'My parking spot',
    'Guest parking',
    'Street parking',
    'My driveway',
    'Paid parking',
    otherLabel,
  ];

  static const vehicleKeyOptions = [
    'Key will be handed in person',
    'Key is left in the vehicle',
    'Key will be shared electronically',
    'Key is left in the mailbox',
    'Key is with apartment concierge',
    otherLabel,
  ];

  static const keyReturnOptions = [
    'Hand key back to customer',
    'Leave keys/key fob in vehicle',
    'Dropped off in mailbox',
    'Dropped off with apartment concierge',
    otherLabel,
  ];

  static const Map<String, String> _vehicleParkedValues = {
    'My garage': 'my_garage',
    'My driveway': 'my_driveway',
    'Parking lot': 'parking_lot',
    'Street parking': 'street_parking',
    'Apt building parking garage': 'apt_building_parking_garage',
    otherLabel: 'other',
  };

  static const Map<String, String> _providerParkValues = {
    'My parking spot': 'my_parking_spot',
    'Guest parking': 'guest_parking',
    'Street parking': 'street_parking',
    'My driveway': 'my_driveway',
    'Paid parking': 'paid_parking',
    otherLabel: 'other',
  };

  static const Map<String, String> _vehicleKeyValues = {
    'Key will be handed in person': 'handed_in_person',
    'Key is left in the vehicle': 'left_in_vehicle',
    'Key will be shared electronically': 'shared_electronically',
    'Key is left in the mailbox': 'left_in_mailbox',
    'Key is with apartment concierge': 'apartment_concierge',
    otherLabel: 'other',
  };

  static const Map<String, String> _keyReturnValues = {
    'Hand key back to customer': 'hand_back_to_customer',
    'Leave keys/key fob in vehicle': 'leave_in_vehicle',
    'Dropped off in mailbox': 'mailbox',
    'Dropped off with apartment concierge': 'apartment_concierge',
    otherLabel: 'other',
  };

  static String? apiValueForVehicleParked(String? label) =>
      _vehicleParkedValues[label?.trim()];
  static String? apiValueForProviderPark(String? label) =>
      _providerParkValues[label?.trim()];
  static String? apiValueForVehicleKey(String? label) =>
      _vehicleKeyValues[label?.trim()];
  static String? apiValueForKeyReturn(String? label) =>
      _keyReturnValues[label?.trim()];

  static String? labelForVehicleParked(String? value, {String? other}) =>
      _labelFor(value, _vehicleParkedValues, other);
  static String? labelForProviderPark(String? value, {String? other}) =>
      _labelFor(value, _providerParkValues, other);
  static String? labelForVehicleKey(String? value, {String? other}) =>
      _labelFor(value, _vehicleKeyValues, other);
  static String? labelForKeyReturn(String? value, {String? other}) =>
      _labelFor(value, _keyReturnValues, other);

  static String? _labelFor(
    String? value,
    Map<String, String> reverse,
    String? other,
  ) {
    final v = (value ?? '').trim().toLowerCase();
    if (v.isEmpty) return null;
    if (v == 'other') {
      final t = (other ?? '').trim();
      return t.isNotEmpty ? t : otherLabel;
    }
    for (final entry in reverse.entries) {
      if (entry.value == v) return entry.key;
    }
    return value;
  }

  static bool isOtherSelection(String? label) => label?.trim() == otherLabel;
}

class BookingServiceNotesFormData {
  const BookingServiceNotesFormData({
    this.vehicleParkedLocation,
    this.vehicleParkedLocationOther,
    this.providerParkLocation,
    this.providerParkLocationOther,
    this.vehicleKeyLocation,
    this.vehicleKeyLocationOther,
    this.keyReturnLocation,
    this.keyReturnLocationOther,
    this.additionalNotes,
  });

  final String? vehicleParkedLocation;
  final String? vehicleParkedLocationOther;
  final String? providerParkLocation;
  final String? providerParkLocationOther;
  final String? vehicleKeyLocation;
  final String? vehicleKeyLocationOther;
  final String? keyReturnLocation;
  final String? keyReturnLocationOther;
  final String? additionalNotes;

  bool get isComplete {
    bool ok(String? v, String? other) {
      if (v == null || v.trim().isEmpty) return false;
      if (BookingServiceNotes.isOtherSelection(v)) {
        return (other ?? '').trim().isNotEmpty;
      }
      return true;
    }

    return ok(vehicleParkedLocation, vehicleParkedLocationOther) &&
        ok(providerParkLocation, providerParkLocationOther) &&
        ok(vehicleKeyLocation, vehicleKeyLocationOther) &&
        ok(keyReturnLocation, keyReturnLocationOther);
  }

  List<({String question, String answer})> get displayRows {
    final rows = <({String question, String answer})>[];
    void add(String q, String? label) {
      final a = (label ?? '').trim();
      if (a.isNotEmpty) rows.add((question: q, answer: a));
    }

    add(
      'Where is the vehicle parked?',
      vehicleParkedLocationOther?.trim().isNotEmpty == true &&
              BookingServiceNotes.isOtherSelection(vehicleParkedLocation)
          ? vehicleParkedLocationOther
          : vehicleParkedLocation,
    );
    add(
      'Where should our service provider park?',
      providerParkLocationOther?.trim().isNotEmpty == true &&
              BookingServiceNotes.isOtherSelection(providerParkLocation)
          ? providerParkLocationOther
          : providerParkLocation,
    );
    add(
      'Where is the key?',
      vehicleKeyLocationOther?.trim().isNotEmpty == true &&
              BookingServiceNotes.isOtherSelection(vehicleKeyLocation)
          ? vehicleKeyLocationOther
          : vehicleKeyLocation,
    );
    add(
      'Where should our provider leave the key?',
      keyReturnLocationOther?.trim().isNotEmpty == true &&
              BookingServiceNotes.isOtherSelection(keyReturnLocation)
          ? keyReturnLocationOther
          : keyReturnLocation,
    );
    return rows;
  }

  static List<({String question, String answer})> rowsFromDetail({
    String? vehicleParkedLocationLabel,
    String? vehicleParkedLocation,
    String? vehicleParkedLocationOther,
    String? providerParkLocationLabel,
    String? providerParkLocation,
    String? providerParkLocationOther,
    String? vehicleKeyLocationLabel,
    String? vehicleKeyLocation,
    String? vehicleKeyLocationOther,
    String? keyReturnLocationLabel,
    String? keyReturnLocation,
    String? keyReturnLocationOther,
    String? parkingInstructions,
  }) {
    String? pick(
      String? label,
      String? api,
      String? other,
      String? Function(String?, {String? other}) fn,
    ) {
      final fromLabel = label?.trim();
      if (fromLabel != null && fromLabel.isNotEmpty) return fromLabel;
      return fn(api, other: other);
    }

    final rows = <({String question, String answer})>[];
    void add(String q, String? a) {
      final t = (a ?? '').trim();
      if (t.isNotEmpty) rows.add((question: q, answer: t));
    }

    add(
      'Where is the vehicle parked?',
      pick(
        vehicleParkedLocationLabel,
        vehicleParkedLocation,
        vehicleParkedLocationOther,
        BookingServiceNotes.labelForVehicleParked,
      ),
    );
    add(
      'Where should our service provider park?',
      pick(
        providerParkLocationLabel,
        providerParkLocation,
        providerParkLocationOther,
        BookingServiceNotes.labelForProviderPark,
      ),
    );
    add(
      'Where is the key?',
      pick(
        vehicleKeyLocationLabel,
        vehicleKeyLocation,
        vehicleKeyLocationOther,
        BookingServiceNotes.labelForVehicleKey,
      ),
    );
    add(
      'Where should our provider leave the key?',
      pick(
        keyReturnLocationLabel,
        keyReturnLocation,
        keyReturnLocationOther,
        BookingServiceNotes.labelForKeyReturn,
      ),
    );

    if (rows.isEmpty) {
      final legacy = parkingInstructions?.trim() ?? '';
      if (legacy.isNotEmpty) {
        rows.add((question: 'Service notes', answer: legacy));
      }
    }
    return rows;
  }
}
