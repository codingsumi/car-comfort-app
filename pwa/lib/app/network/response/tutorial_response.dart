class TutorialResponse {
  TutorialResponse({
    this.status,
    this.message,
    this.errorType,
    this.data,
  });

  factory TutorialResponse.fromJson(dynamic json) {
    if (json is! Map<String, dynamic>) {
      return TutorialResponse();
    }
    return TutorialResponse(
      status: json['status']?.toString(),
      message: json['message']?.toString(),
      errorType: json['error_type'],
      data: json['data'] is Map<String, dynamic>
          ? TutorialData.fromJson(json['data'] as Map<String, dynamic>)
          : null,
    );
  }

  final String? status;
  final String? message;
  final dynamic errorType;
  final TutorialData? data;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['status'] = status;
    map['message'] = message;
    map['error_type'] = errorType;
    if (data != null) {
      map['data'] = data!.toJson();
    }
    return map;
  }
}

class TutorialData {
  TutorialData({
    this.videoUrl,
    this.instructions = const [],
  });

  factory TutorialData.fromJson(Map<String, dynamic> json) {
    final raw = json['instructions'];
    final list = <String>[];
    if (raw is List) {
      for (final e in raw) {
        final s = e?.toString().trim() ?? '';
        if (s.isNotEmpty) list.add(s);
      }
    }
    final url = json['video_url']?.toString().trim();
    return TutorialData(
      videoUrl: (url != null && url.isNotEmpty) ? url : null,
      instructions: list,
    );
  }

  final String? videoUrl;
  final List<String> instructions;

  Map<String, dynamic> toJson() {
    return {
      'video_url': videoUrl,
      'instructions': instructions,
    };
  }
}
