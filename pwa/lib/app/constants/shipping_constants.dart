class ShippingConstants {
  static const List<String> weightValueItems = ["kg", "g"];
  static const List<String> unitItems = ["cm"];
  static const List<String> packagingTypes = ["Box (up to 250g)", "Satchel (up to 500g)", "Unlimited Satchel"];

  static const Map<String, double> packagingWeightLimitsInGrams = {
    'Box (up to 250g)': 250.0,
    'Satchel (up to 500g)': 500.0,
    'Unlimited Satchel': double.infinity,
  };

  static const Map<String, double> unitToGrams = {
    'g': 1.0,
    'kg': 1000.0,
  };

  static const List<String> deliveryInstructions = ["Avoid ringing bell", "Leave at the door", "Avoid calling", "Leave with security", "Other"];

  static const List<String> pickupInstructions = [
    "Call upon arrival",
    "Wait at the gate",
    "Come to the reception",
    "Ask for ID before pickup",
    "Other"
  ];

}
