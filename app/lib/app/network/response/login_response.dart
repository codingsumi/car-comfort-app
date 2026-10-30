class LoginResponse {
  LoginResponse({
    String? status,
    String? message,
    Data? data,}){
    _status = status;
    _message = message;
    _data = data;
  }

  LoginResponse.fromJson(dynamic json) {
    _status = json['status'];
    _message = json['message'];
    _data = json['data'] != null ? Data.fromJson(json['data']) : null;
  }
  String? _status;
  String? _message;
  Data? _data;
  LoginResponse copyWith({  String? status,
    String? message,
    Data? data,
  }) => LoginResponse(  status: status ?? _status,
    message: message ?? _message,
    data: data ?? _data,
  );
  String? get status => _status;
  String? get message => _message;
  Data? get data => _data;

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

class Data {
  Data({
    String? token,
    User? user,}){
    _token = token;
    _user = user;
  }

  Data.fromJson(dynamic json) {
    _token = json['token'];
    _user = json['user'] != null ? User.fromJson(json['user']) : null;
  }
  String? _token;
  User? _user;
  Data copyWith({
    String? token,
    User? user,
  }) => Data(
    token: token ?? _token,
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
    String? email,
    String? phone,
    String? role,
    bool? isVerified,}){
    _id = id;
    _name = name;
    _email = email;
    _phone = phone;
    _role = role;
    _isVerified = isVerified;
  }

  User.fromJson(dynamic json) {
    _id = json['id'];
    _name = json['name'];
    _email = json['email'];
    _phone = json['phone'];
    _role = json['role'];
    _isVerified = json['is_verified'];
  }
  num? _id;
  String? _name;
  String? _email;
  String? _phone;
  String? _role;
  bool? _isVerified;
  User copyWith({  num? id,
    String? name,
    String? email,
    String? phone,
    String? role,
    bool? isVerified,
  }) => User(  id: id ?? _id,
    name: name ?? _name,
    email: email ?? _email,
    phone: phone ?? _phone,
    role: role ?? _role,
    isVerified: isVerified ?? _isVerified,
  );
  num? get id => _id;
  String? get name => _name;
  String? get email => _email;
  String? get phone => _phone;
  String? get role => _role;
  bool? get isVerified => _isVerified;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['id'] = _id;
    map['name'] = _name;
    map['email'] = _email;
    map['phone'] = _phone;
    map['role'] = _role;
    map['is_verified'] = _isVerified;
    return map;
  }

}