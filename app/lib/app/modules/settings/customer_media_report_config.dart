class CustomerMediaReportConfig {
  const CustomerMediaReportConfig({
    required this.title,
    required this.introText,
    required this.descriptionHint,
    required this.reportType,
    required this.snackBarTitle,
    required this.descriptionValidationMessage,
  });

  final String title;
  final String introText;
  final String descriptionHint;
  final String reportType;
  final String snackBarTitle;
  final String descriptionValidationMessage;

  static const accidentDamage = CustomerMediaReportConfig(
    title: 'Report accident/damage',
    introText:
        'Upload photos and videos of any accident or damage to your vehicle. Our team will review your report and follow up.',
    descriptionHint: 'Describe what happened, when, and where',
    reportType: 'vehicle_damage',
    snackBarTitle: 'Report accident/damage',
    descriptionValidationMessage:
        'Please describe what happened (at least 10 characters).',
  );

  static const missingItem = CustomerMediaReportConfig(
    title: 'Report missing item',
    introText:
        'Upload photos and videos of items you believe were stolen or missing from your vehicle. Our team will review your report and follow up.',
    descriptionHint:
        'Describe what is missing or stolen, when you noticed, and any details',
    reportType: 'missing_item',
    snackBarTitle: 'Report missing item',
    descriptionValidationMessage:
        'Please describe what is missing (at least 10 characters).',
  );
}
