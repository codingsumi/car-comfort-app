/// Lightweight public configuration returned by [GET /api/app/status].
/// Values here are set by the admin panel and should never be hard-coded in the app.
class AppConfig {
  const AppConfig({this.referralDiscountPercent = 10});

  /// Default used when the API is unreachable or the field is absent.
  static const AppConfig _defaults = AppConfig(referralDiscountPercent: 10);

  factory AppConfig.fromJson(dynamic json) {
    if (json is! Map) return _defaults;
    final raw = json['referral_discount_percent'];
    final n = raw is num
        ? raw.toInt()
        : int.tryParse(raw?.toString() ?? '') ?? _defaults.referralDiscountPercent;
    return AppConfig(referralDiscountPercent: n.clamp(0, 100));
  }

  /// Referral discount percentage configured in the admin panel (e.g. 10 for 10%).
  final int referralDiscountPercent;

  /// Human-readable string, e.g. "10%".
  String get discountLabel => '$referralDiscountPercent%';
}
