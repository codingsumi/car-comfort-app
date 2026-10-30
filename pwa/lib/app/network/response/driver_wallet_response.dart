class DriverWalletResponse {
  DriverWalletResponse({this.status, this.message, this.errorType, this.data});

  DriverWalletResponse.fromJson(dynamic json) {
    status = json['status'];
    message = json['message'];
    errorType = json['error_type'];
    data = json['data'] != null ? Data.fromJson(json['data']) : null;
  }
  String? status;
  String? message;
  dynamic errorType;
  Data? data;

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

class Data {
  Data({
    this.providerId,
    this.walletAmount,
    this.availableForPayout,
    this.pendingStripeSettlement,
    this.internalAvailableForPayout,
    this.totalBalance,
    this.currency,
  });

  Data.fromJson(dynamic json) {
    providerId = _toInt(json['provider_id']);
    walletAmount = _toDouble(json['wallet_amount']);
    availableForPayout = _toDouble(json['available_for_payout']);
    pendingStripeSettlement = _toDouble(json['pending_stripe_settlement']);
    internalAvailableForPayout = _toDouble(json['internal_available_for_payout']);
    totalBalance = _toDouble(json['total_balance']);
    currency = json['currency']?.toString();
  }
  int? providerId;
  double? walletAmount;
  double? availableForPayout;
  double? pendingStripeSettlement;
  double? internalAvailableForPayout;
  double? totalBalance;
  String? currency;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['provider_id'] = providerId;
    map['wallet_amount'] = walletAmount;
    map['available_for_payout'] = availableForPayout;
    map['pending_stripe_settlement'] = pendingStripeSettlement;
    map['internal_available_for_payout'] = internalAvailableForPayout;
    map['total_balance'] = totalBalance;
    map['currency'] = currency;
    return map;
  }

  static int? _toInt(dynamic value) {
    if (value == null) return null;
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value.toString());
  }

  static double? _toDouble(dynamic value) {
    if (value == null) return null;
    if (value is double) return value;
    if (value is int) return value.toDouble();
    if (value is num) return value.toDouble();
    return double.tryParse(value.toString());
  }
}
