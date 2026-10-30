class DriverStripeConnectKycResponse {
  DriverStripeConnectKycResponse({
    this.status,
    this.message,
    this.errorType,
    this.data,
  });

  DriverStripeConnectKycResponse.fromJson(dynamic json) {
    status = json['status']?.toString();
    message = json['message']?.toString();
    errorType = json['error_type'];
    data = json['data'] != null
        ? DriverStripeConnectKycData.fromJson(json['data'])
        : null;
  }

  String? status;
  String? message;
  dynamic errorType;
  DriverStripeConnectKycData? data;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['status'] = status;
    map['message'] = message;
    map['error_type'] = errorType;
    if (data != null) {
      map['data'] = data?.toJson();
    }
    return map;
  }
}

class DriverStripeConnectKycData {
  DriverStripeConnectKycData({
    this.accountId,
    this.detailsSubmitted,
    this.chargesEnabled,
    this.payoutsEnabled,
    this.kycComplete,
    this.requirementsDue = const [],
    this.disabledReason,
    this.isConnected,
    this.kycUrl,
    this.kycUrlExpiresAt,
  });

  factory DriverStripeConnectKycData.fromJson(dynamic json) {
    if (json is! Map) {
      return DriverStripeConnectKycData();
    }
    final map = Map<String, dynamic>.from(json);
    return DriverStripeConnectKycData(
      accountId: map['account_id']?.toString(),
      detailsSubmitted: _readBool(map['details_submitted']),
      chargesEnabled: _readBool(map['charges_enabled']),
      payoutsEnabled: _readBool(map['payouts_enabled']),
      kycComplete: _readBool(map['kyc_complete']),
      requirementsDue: _readStringList(map['requirements_due']),
      disabledReason: map['disabled_reason']?.toString(),
      isConnected: _readBool(map['is_connected']),
      kycUrl: map['kyc_url']?.toString().trim(),
      kycUrlExpiresAt: map['kyc_url_expires_at']?.toString(),
    );
  }

  final String? accountId;
  final bool? detailsSubmitted;
  final bool? chargesEnabled;
  final bool? payoutsEnabled;
  final bool? kycComplete;
  final List<String> requirementsDue;
  final String? disabledReason;
  final bool? isConnected;
  final String? kycUrl;
  final String? kycUrlExpiresAt;

  bool get hasKycUrl => kycUrl != null && kycUrl!.isNotEmpty;

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      if (accountId != null) 'account_id': accountId,
      if (detailsSubmitted != null) 'details_submitted': detailsSubmitted,
      if (chargesEnabled != null) 'charges_enabled': chargesEnabled,
      if (payoutsEnabled != null) 'payouts_enabled': payoutsEnabled,
      if (kycComplete != null) 'kyc_complete': kycComplete,
      'requirements_due': requirementsDue,
      if (disabledReason != null) 'disabled_reason': disabledReason,
      if (isConnected != null) 'is_connected': isConnected,
      if (kycUrl != null) 'kyc_url': kycUrl,
      if (kycUrlExpiresAt != null) 'kyc_url_expires_at': kycUrlExpiresAt,
    };
  }

  static bool? _readBool(dynamic value) {
    if (value == null) return null;
    if (value is bool) return value;
    if (value is num) return value != 0;
    final text = value.toString().trim().toLowerCase();
    if (text == 'true' || text == '1') return true;
    if (text == 'false' || text == '0') return false;
    return null;
  }

  static List<String> _readStringList(dynamic value) {
    if (value is! List) return const [];
    return value
        .map((e) => e?.toString().trim() ?? '')
        .where((e) => e.isNotEmpty)
        .toList();
  }
}
