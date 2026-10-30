class CommonResponse {
  CommonResponse({
    this.status,
    this.message,
    this.type,
    this.data,
  });

  CommonResponse.fromJson(dynamic json) {
    status = json['status'];
    message = json['message'];
    type = json['error_type'];
    data = json['data'];
  }

  dynamic status;
  String? message;
  String? type;
  dynamic data;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['status'] = status;
    map['message'] = message;
    map['error_type'] = type;
    map['data'] = data;
    return map;
  }
}
