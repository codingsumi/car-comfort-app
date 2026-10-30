import 'booking_review_response.dart' as review;

class ConfirmBookingRes {
  ConfirmBookingRes({this.status, this.message, this.data});

  ConfirmBookingRes.fromJson(dynamic json) {
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
    this.bookingCode,
    this.bookingIdDisplay,
    this.status,
    this.priceSummary,
    this.serviceType,
    this.serviceTypeLabel,
    this.currency,
    this.transaction,
    this.confirmation,
  });

  Data.fromJson(dynamic json) {
    bookingId = json['booking_id'];
    bookingCode = json['booking_code'];
    bookingIdDisplay = json['booking_id_display'];
    status = json['status'];
    priceSummary = json['price_summary'] != null
        ? review.PriceSummary.fromJson(json['price_summary'])
        : null;
    serviceType = json['service_type'];
    serviceTypeLabel = json['service_type_label'];
    currency = json['currency'];
    transaction = json['transaction'] != null
        ? Transaction.fromJson(json['transaction'])
        : null;
    confirmation = json['confirmation'] != null
        ? Confirmation.fromJson(json['confirmation'])
        : null;
  }
  int? bookingId;
  String? bookingCode;
  String? bookingIdDisplay;
  String? status;
  review.PriceSummary? priceSummary;
  String? serviceType;
  String? serviceTypeLabel;
  String? currency;
  Transaction? transaction;
  Confirmation? confirmation;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['booking_id'] = bookingId;
    map['booking_code'] = bookingCode;
    map['booking_id_display'] = bookingIdDisplay;
    map['status'] = status;
    if (priceSummary != null) {
      map['price_summary'] = priceSummary?.toJson();
    }
    map['service_type'] = serviceType;
    map['service_type_label'] = serviceTypeLabel;
    map['currency'] = currency;
    if (transaction != null) {
      map['transaction'] = transaction?.toJson();
    }
    if (confirmation != null) {
      map['confirmation'] = confirmation?.toJson();
    }
    return map;
  }
}

class Confirmation {
  Confirmation({
    this.title,
    this.subtitle,
    this.notificationMessage,
    this.serviceTypeLabel,
    this.bookingIdDisplay,
    this.actions,
  });

  Confirmation.fromJson(dynamic json) {
    title = json['title'];
    subtitle = json['subtitle'];
    notificationMessage = json['notification_message'];
    serviceTypeLabel = json['service_type_label'];
    bookingIdDisplay = json['booking_id_display'];
    actions = json['actions'] != null
        ? Actions.fromJson(json['actions'])
        : null;
  }
  String? title;
  String? subtitle;
  String? notificationMessage;
  String? serviceTypeLabel;
  String? bookingIdDisplay;
  Actions? actions;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['title'] = title;
    map['subtitle'] = subtitle;
    map['notification_message'] = notificationMessage;
    map['service_type_label'] = serviceTypeLabel;
    map['booking_id_display'] = bookingIdDisplay;
    if (actions != null) {
      map['actions'] = actions?.toJson();
    }
    return map;
  }
}

class Actions {
  Actions({this.primary, this.secondary});

  Actions.fromJson(dynamic json) {
    primary = json['primary'] != null
        ? Primary.fromJson(json['primary'])
        : null;
    secondary = json['secondary'] != null
        ? Secondary.fromJson(json['secondary'])
        : null;
  }
  Primary? primary;
  Secondary? secondary;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    if (primary != null) {
      map['primary'] = primary?.toJson();
    }
    if (secondary != null) {
      map['secondary'] = secondary?.toJson();
    }
    return map;
  }
}

class Secondary {
  Secondary({this.label, this.action, this.path});

  Secondary.fromJson(dynamic json) {
    label = json['label'];
    action = json['action'];
    path = json['path'];
  }
  String? label;
  String? action;
  String? path;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['label'] = label;
    map['action'] = action;
    map['path'] = path;
    return map;
  }
}

class Primary {
  Primary({this.label, this.action, this.path});

  Primary.fromJson(dynamic json) {
    label = json['label'];
    action = json['action'];
    path = json['path'];
  }
  String? label;
  String? action;
  String? path;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['label'] = label;
    map['action'] = action;
    map['path'] = path;
    return map;
  }
}

class Transaction {
  Transaction({
    this.id,
    this.transactionCode,
    this.status,
    this.stripePaymentIntentId,
    this.amount,
    this.currency,
  });

  Transaction.fromJson(dynamic json) {
    id = json['id'];
    transactionCode = json['transaction_code'];
    status = json['status'];
    stripePaymentIntentId = json['stripe_payment_intent_id'];
    amount = json['amount'];
    currency = json['currency'];
  }
  int? id;
  String? transactionCode;
  String? status;
  String? stripePaymentIntentId;
  double? amount;
  String? currency;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['id'] = id;
    map['transaction_code'] = transactionCode;
    map['status'] = status;
    map['stripe_payment_intent_id'] = stripePaymentIntentId;
    map['amount'] = amount;
    map['currency'] = currency;
    return map;
  }
}
