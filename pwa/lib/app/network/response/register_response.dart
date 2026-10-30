class RegisterResponse {
  RegisterResponse({
      String? status,
      String? message,
      RegisterData? data,}){
    _status = status;
    _message = message;
    _data = data;
}

  RegisterResponse.fromJson(dynamic json) {
    _status = json['status'];
    _message = json['message'];
    _data = json['data'] != null ? RegisterData.fromJson(json['data']) : null;
  }
  String? _status;
  String? _message;
  RegisterData? _data;
RegisterResponse copyWith({  String? status,
  String? message,
  RegisterData? data,
}) => RegisterResponse(  status: status ?? _status,
  message: message ?? _message,
  data: data ?? _data,
);
  String? get status => _status;
  String? get message => _message;
  RegisterData? get data => _data;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['status'] = _status;
    map['message'] = _message;
    if (_data != null) {
      map['data'] = _data?.toJson();
    }
    return map;
  }

}

class RegisterData {
  RegisterData({
      String? token,
      User? user,}){
    _token = token;
    _user = user;
}

  RegisterData.fromJson(dynamic json) {
    _token = json['token'];
    _user = json['user'] != null ? User.fromJson(json['user']) : null;
  }
  String? _token;
  User? _user;
RegisterData copyWith({  String? token,
  User? user,
}) => RegisterData(  token: token ?? _token,
  user: user ?? _user,
);
  String? get token => _token;
  User? get user => _user;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['token'] = _token;
    if (_user != null) {
      map['user'] = _user?.toJson();
    }
    return map;
  }
}

class User {
  User({
      num? id,
      String? name,
      String? firstName,
      String? lastName,
      String? email,
      String? phone,
      String? role,
      bool? isVerified,
      bool? agreedToTerms,
      bool? otpSent,}){
    _id = id;
    _name = name;
    _firstName = firstName;
    _lastName = lastName;
    _email = email;
    _phone = phone;
    _role = role;
    _isVerified = isVerified;
    _agreedToTerms = agreedToTerms;
    _otpSent = otpSent;
}

  User.fromJson(dynamic json) {
    _id = json['id'];
    _name = json['name'];
    _firstName = json['first_name'];
    _lastName = json['last_name'];
    _email = json['email'];
    _phone = json['phone'];
    _role = json['role'];
    _isVerified = json['is_verified'];
    _agreedToTerms = json['agreed_to_terms'];
    _otpSent = json['otp_sent'];
  }
  num? _id;
  String? _name;
  String? _firstName;
  String? _lastName;
  String? _email;
  String? _phone;
  String? _role;
  bool? _isVerified;
  bool? _agreedToTerms;
  bool? _otpSent;
User copyWith({
  num? id,
  String? name,
  String? firstName,
  String? lastName,
  String? email,
  String? phone,
  String? role,
  bool? isVerified,
  bool? agreedToTerms,
  bool? otpSent,
}) => User(
  id: id ?? _id,
  name: name ?? _name,
  firstName: firstName ?? _firstName,
  lastName: lastName ?? _lastName,
  email: email ?? _email,
  phone: phone ?? _phone,
  role: role ?? _role,
  isVerified: isVerified ?? _isVerified,
  agreedToTerms: agreedToTerms ?? _agreedToTerms,
  otpSent: otpSent ?? _otpSent,
);
  num? get id => _id;
  String? get name => _name;
  String? get firstName => _firstName;
  String? get lastName => _lastName;
  String? get email => _email;
  String? get phone => _phone;
  String? get role => _role;
  bool? get isVerified => _isVerified;
  bool? get agreedToTerms => _agreedToTerms;
  bool? get otpSent => _otpSent;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['id'] = _id;
    map['name'] = _name;
    map['first_name'] = _firstName;
    map['last_name'] = _lastName;
    map['email'] = _email;
    map['phone'] = _phone;
    map['role'] = _role;
    map['is_verified'] = _isVerified;
    map['agreed_to_terms'] = _agreedToTerms;
    map['otp_sent'] = _otpSent;
    return map;
  }

}