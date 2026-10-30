class DefaultApiError {
  DefaultApiError({
    this.status,
    this.type,
    this.message,
    this.data,
  });

  DefaultApiError.fromJson(dynamic json) {
    status = json['status']?.toString();
    type = json['error_type']?.toString();
    data = json['data'];
    message = _resolveMessage(json);
  }

  String? status;
  String? type;
  String? message;
  dynamic data;

  String _resolveMessage(dynamic json) {
    final directMessage = json['message'];
    if (directMessage is String && directMessage.trim().isNotEmpty) {
      return directMessage;
    }

    final resolvedFromData = _extractFromDynamic(json['data']);
    if (resolvedFromData != null && resolvedFromData.trim().isNotEmpty) {
      return resolvedFromData;
    }
    return 'Something went wrong. Please try again.';
  }

  String? _extractFromDynamic(dynamic value) {
    if (value == null) return null;
    if (value is String && value.trim().isNotEmpty) return value;
    if (value is List) {
      for (final item in value) {
        final candidate = _extractFromDynamic(item);
        if (candidate != null && candidate.trim().isNotEmpty) return candidate;
      }
      return null;
    }
    if (value is Map) {
      for (final key in ['message', 'error', 'detail']) {
        final candidate = _extractFromDynamic(value[key]);
        if (candidate != null && candidate.trim().isNotEmpty) return candidate;
      }
      for (final entry in value.entries) {
        final candidate = _extractFromDynamic(entry.value);
        if (candidate != null && candidate.trim().isNotEmpty) return candidate;
      }
    }
    return null;
  }

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['status'] = status;
    map['error_type'] = type;
    map['message'] = message;
    map['data'] = data;
    return map;
  }
}
