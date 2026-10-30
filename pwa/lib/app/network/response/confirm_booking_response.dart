class ConfirmBookingResponse {
  ConfirmBookingResponse({
      this.status, 
      this.message, 
      this.data,});

  ConfirmBookingResponse.fromJson(dynamic json) {
    status = json['status'];
    message = json['message'];
    data = json['data'] != null ? Data.fromJson(json['data']) : null;
  }
  String? status;
  String? message;
  Data? data;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['status'] = status;
    map['message'] = message;
    if (data != null) {
      map['data'] = data?.toJson();
    }
    return map;
  }

}

class Data {
  Data({
      this.bookingId, 
      this.status, 
      this.pricing, 
      this.transaction,});

  Data.fromJson(dynamic json) {
    bookingId = json['booking_id'];
    status = json['status'];
    pricing = json['pricing'] != null ? Pricing.fromJson(json['pricing']) : null;
    transaction = json['transaction'] != null ? Transaction.fromJson(json['transaction']) : null;
  }
  int? bookingId;
  String? status;
  Pricing? pricing;
  Transaction? transaction;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['booking_id'] = bookingId;
    map['status'] = status;
    if (pricing != null) {
      map['pricing'] = pricing?.toJson();
    }
    if (transaction != null) {
      map['transaction'] = transaction?.toJson();
    }
    return map;
  }

  Object? operator [](String other) {}

}

class Transaction {
  Transaction({
      this.id, 
      this.transactionCode, 
      this.status, 
      this.stripePaymentIntentId,});

  Transaction.fromJson(dynamic json) {
    id = json['id'];
    transactionCode = json['transaction_code'];
    status = json['status'];
    stripePaymentIntentId = json['stripe_payment_intent_id'];
  }
  int? id;
  String? transactionCode;
  String? status;
  String? stripePaymentIntentId;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['id'] = id;
    map['transaction_code'] = transactionCode;
    map['status'] = status;
    map['stripe_payment_intent_id'] = stripePaymentIntentId;
    return map;
  }

}

class Pricing {
  Pricing({
      this.basePrice, 
      this.addonPrice, 
      this.serviceFee, 
      this.totalPrice,});

  Pricing.fromJson(dynamic json) {
    basePrice = json['base_price'];
    addonPrice = json['addon_price'];
    serviceFee = json['service_fee'];
    totalPrice = json['total_price'];
  }
  int? basePrice;
  int? addonPrice;
  double? serviceFee;
  double? totalPrice;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['base_price'] = basePrice;
    map['addon_price'] = addonPrice;
    map['service_fee'] = serviceFee;
    map['total_price'] = totalPrice;
    return map;
  }

}