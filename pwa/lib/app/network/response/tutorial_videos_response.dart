class TutorialVideosResponse {
  TutorialVideosResponse({
    this.status,
    this.message,
    this.data,
  });

  factory TutorialVideosResponse.fromJson(dynamic json) {
    if (json is! Map<String, dynamic>) return TutorialVideosResponse();
    return TutorialVideosResponse(
      status: json['status']?.toString(),
      message: json['message']?.toString(),
      data: json['data'] is Map<String, dynamic>
          ? TutorialVideosData.fromJson(json['data'] as Map<String, dynamic>)
          : null,
    );
  }

  final String? status;
  final String? message;
  final TutorialVideosData? data;
}

class TutorialVideosData {
  TutorialVideosData({
    this.items = const [],
    this.categories = const [],
  });

  factory TutorialVideosData.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'];
    final items = <TutorialVideoItem>[];
    if (rawItems is List) {
      for (final item in rawItems) {
        if (item is Map<String, dynamic>) {
          items.add(TutorialVideoItem.fromJson(item));
        }
      }
    }
    final rawCategories = json['categories'];
    final categories = <String>[];
    if (rawCategories is List) {
      for (final c in rawCategories) {
        final s = c?.toString().trim() ?? '';
        if (s.isNotEmpty) categories.add(s);
      }
    }
    return TutorialVideosData(items: items, categories: categories);
  }

  final List<TutorialVideoItem> items;
  final List<String> categories;
}

class TutorialVideoItem {
  TutorialVideoItem({
    required this.id,
    required this.category,
    required this.title,
    this.description,
    this.instructions = const [],
    this.videoUrl,
    this.sortOrder = 100,
    this.isPublished = true,
  });

  factory TutorialVideoItem.fromJson(Map<String, dynamic> json) {
    final rawInstructions = json['instructions'];
    final instructions = <String>[];
    if (rawInstructions is List) {
      for (final item in rawInstructions) {
        final text = item?.toString().trim() ?? '';
        if (text.isNotEmpty) instructions.add(text);
      }
    }
    return TutorialVideoItem(
      id: int.tryParse(json['id']?.toString() ?? '') ?? 0,
      category: json['category']?.toString().trim() ?? 'General',
      title: json['title']?.toString().trim() ?? '',
      description: json['description']?.toString().trim(),
      instructions: instructions,
      videoUrl: json['video_url']?.toString().trim(),
      sortOrder: int.tryParse(json['sort_order']?.toString() ?? '') ?? 100,
      isPublished: json['is_published'] == true,
    );
  }

  final int id;
  final String category;
  final String title;
  final String? description;
  final List<String> instructions;
  final String? videoUrl;
  final int sortOrder;
  final bool isPublished;

  List<String> get learnBullets {
    if (instructions.isNotEmpty) return instructions;
    final message = description?.trim();
    if (message == null || message.isEmpty) return const [];
    return message
        .split(RegExp(r'\r?\n'))
        .map((line) => line.trim())
        .where((line) => line.isNotEmpty)
        .toList();
  }
}
