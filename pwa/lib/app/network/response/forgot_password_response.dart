class ForgotPasswordResponse {
  ForgotPasswordResponse({
    String? status,
    String? message,
    String? errorType,
    Data? data,
  }) {
    _status = status;
    _message = message;
    _errorType = errorType;
    _data = data;
  }

  ForgotPasswordResponse.fromJson(dynamic json) {
    _status = json['status'];
    _message = json['message'];
    _errorType = json['error_type'];
    _data = json['data'] != null ? Data.fromJson(json['data']) : null;
  }

  String? _status;
  String? _message;
  String? _errorType;
  Data? _data;

  ForgotPasswordResponse copyWith({
    String? status,
    String? message,
    String? errorType,
    Data? data,
  }) => ForgotPasswordResponse(
    status: status ?? _status,
    message: message ?? _message,
    errorType: errorType ?? _errorType,
    data: data ?? _data,
  );

  String? get status => _status;

  String? get message => _message;

  String? get errorType => _errorType;

  Data? get data => _data;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['status'] = _status;
    map['message'] = _message;
    map['error_type'] = _errorType;
    if (_data != null) {
      map['data'] = _data?.toJson();
    }
    return map;
  }
}

class Data {
  Data({num? otp}) {
    _otp = otp;
  }

  Data.fromJson(dynamic json) {
    _otp = json['OTP'];
  }

  num? _otp;

  Data copyWith({num? otp}) => Data(otp: otp ?? _otp);

  num? get otp => _otp;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['OTP'] = _otp;
    return map;
  }
}
