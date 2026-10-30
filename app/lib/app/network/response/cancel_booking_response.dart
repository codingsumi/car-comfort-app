class CancelBookingResponse {
  CancelBookingResponse({
      this.status, 
      this.message, 
      this.data,});

  CancelBookingResponse.fromJson(dynamic json) {
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
      this.cancelledAt, 
      this.cancellationFee, 
      this.refundAmount, 
      this.paidAmount, 
      this.refundStatus, 
      this.policy, 
      this.policyMessage,});

  Data.fromJson(dynamic json) {
    bookingId = _parseInt(json['booking_id']);
    status = json['status']?.toString();
    cancelledAt = json['cancelled_at']?.toString();
    cancellationFee = _parseInt(json['cancellation_fee']);
    refundAmount = _parseDouble(json['refund_amount']);
    paidAmount = _parseDouble(json['paid_amount']);
    refundStatus = json['refund_status']?.toString();
    policy = json['policy']?.toString();
    policyMessage = json['policy_message']?.toString();
  }
  int? bookingId;
  String? status;
  String? cancelledAt;
  int? cancellationFee;
  double? refundAmount;
  double? paidAmount;
  String? refundStatus;
  String? policy;
  String? policyMessage;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['booking_id'] = bookingId;
    map['status'] = status;
    map['cancelled_at'] = cancelledAt;
    map['cancellation_fee'] = cancellationFee;
    map['refund_amount'] = refundAmount;
    map['paid_amount'] = paidAmount;
    map['refund_status'] = refundStatus;
    map['policy'] = policy;
    map['policy_message'] = policyMessage;
    return map;
  }

}

int? _parseInt(dynamic value) {
  if (value == null) return null;
  if (value is int) return value;
  if (value is num) return value.round();
  return int.tryParse(value.toString().trim());
}

double? _parseDouble(dynamic value) {
  if (value == null) return null;
  if (value is double) return value;
  if (value is int) return value.toDouble();
  if (value is num) return value.toDouble();
  return double.tryParse(value.toString().trim());
}