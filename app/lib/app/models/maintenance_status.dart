class MaintenanceStatus {
  const MaintenanceStatus({
    required this.enabled,
    this.message,
    this.expectedReturn,
  });

  factory MaintenanceStatus.fromJson(dynamic json) {
    if (json is! Map) {
      return const MaintenanceStatus(enabled: false);
    }
    final enabled = json['enabled'] == true || json['enabled'] == 'true';
    final message = json['message']?.toString().trim();
    final expectedReturn = json['expected_return']?.toString().trim();
    return MaintenanceStatus(
      enabled: enabled,
      message: message != null && message.isNotEmpty ? message : null,
      expectedReturn:
          expectedReturn != null && expectedReturn.isNotEmpty ? expectedReturn : null,
    );
  }

  final bool enabled;
  final String? message;
  final String? expectedReturn;

  String get displayMessage =>
      message?.trim().isNotEmpty == true
          ? message!.trim()
          : 'We are currently performing scheduled maintenance. Please check back soon.';
}
