class DriverPaymentHistoryResponse {
  DriverPaymentHistoryResponse({
      this.status, 
      this.message, 
      this.errorType, 
      this.data,});

  DriverPaymentHistoryResponse.fromJson(dynamic json) {
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
      this.transactions, 
      this.pagination,});

  Data.fromJson(dynamic json) {
    if (json['transactions'] != null) {
      transactions = [];
      json['transactions'].forEach((v) {
        transactions?.add(Transactions.fromJson(v));
      });
    }
    pagination = json['pagination'] != null ? Pagination.fromJson(json['pagination']) : null;
  }
  List<Transactions>? transactions;
  Pagination? pagination;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    if (transactions != null) {
      map['transactions'] = transactions?.map((v) => v.toJson()).toList();
    }
    if (pagination != null) {
      map['pagination'] = pagination?.toJson();
    }
    return map;
  }

}

class Pagination {
  Pagination({
      this.total, 
      this.page, 
      this.limit, 
      this.totalPages,});

  Pagination.fromJson(dynamic json) {
    total = json['total'];
    page = json['page'];
    limit = json['limit'];
    totalPages = json['total_pages'];
  }
  int? total;
  int? page;
  int? limit;
  int? totalPages;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['total'] = total;
    map['page'] = page;
    map['limit'] = limit;
    map['total_pages'] = totalPages;
    return map;
  }

}

class Transactions {
  Transactions({
      this.id, 
      this.type, 
      this.status, 
      this.transactionType, 
      this.amount, 
      this.currency, 
      this.description,
      this.displayTitle,
      this.bookingId, 
      this.providerPayoutId, 
      this.balanceAfter, 
      this.createdAt, 
      this.booking, 
      this.payout,});

  Transactions.fromJson(dynamic json) {
    id = _toInt(json['id']);
    type = json['type']?.toString();
    status = json['status']?.toString();
    transactionType = json['transaction_type']?.toString();
    transactionCode = json['transaction_code']?.toString();
    amount = _toDouble(json['amount']);
    currency = json['currency']?.toString();
    description = json['description']?.toString();
    displayTitle = json['display_title']?.toString();
    bookingId = _toInt(json['booking_id']);
    providerPayoutId = json['provider_payout_id'];
    balanceAfter = _toDouble(json['balance_after']);
    createdAt = json['created_at']?.toString();
    booking = json['booking'] != null ? Booking.fromJson(json['booking']) : null;
    payout = json['payout'];
  }
  int? id;
  String? type;
  String? status;
  String? transactionType;
  String? transactionCode;
  double? amount;
  String? currency;
  String? description;
  String? displayTitle;
  int? bookingId;
  dynamic providerPayoutId;
  double? balanceAfter;
  String? createdAt;
  Booking? booking;
  dynamic payout;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['id'] = id;
    map['type'] = type;
    map['status'] = status;
    map['transaction_type'] = transactionType;
    map['transaction_code'] = transactionCode;
    map['amount'] = amount;
    map['currency'] = currency;
    map['description'] = description;
    map['display_title'] = displayTitle;
    map['booking_id'] = bookingId;
    map['provider_payout_id'] = providerPayoutId;
    map['balance_after'] = balanceAfter;
    map['created_at'] = createdAt;
    if (booking != null) {
      map['booking'] = booking?.toJson();
    }
    map['payout'] = payout;
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

class Booking {
  Booking({
      this.id, 
      this.bookingCode, 
      this.status,});

  Booking.fromJson(dynamic json) {
    id = json['id'];
    bookingCode = json['booking_code'];
    status = json['status'];
  }
  int? id;
  String? bookingCode;
  String? status;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['id'] = id;
    map['booking_code'] = bookingCode;
    map['status'] = status;
    return map;
  }

}