class BookingStartResponse {
  BookingStartResponse({
      this.status, 
      this.message, 
      this.data,});

  BookingStartResponse.fromJson(dynamic json) {
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
      this.bookingCode,});

  Data.fromJson(dynamic json) {
    bookingId = json['booking_id'];
    bookingCode = json['booking_code'];
  }
  int? bookingId;
  String? bookingCode;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['booking_id'] = bookingId;
    map['booking_code'] = bookingCode;
    return map;
  }

}