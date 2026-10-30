import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import 'image.dart';
import 'text.dart';

/// Full-screen swipeable gallery for service before/after photos.
class ServiceImageGalleryViewer extends StatefulWidget {
  const ServiceImageGalleryViewer({
    super.key,
    required this.imageUrls,
    this.initialIndex = 0,
  });

  final List<String> imageUrls;
  final int initialIndex;

  static Future<void> show(
    BuildContext context, {
    required List<String> imageUrls,
    int initialIndex = 0,
  }) {
    final urls = imageUrls
        .map((u) => u.trim())
        .where((u) => u.isNotEmpty)
        .toList();
    if (urls.isEmpty) return Future.value();

    final index = initialIndex.clamp(0, urls.length - 1);

    return showDialog<void>(
      context: context,
      barrierColor: Colors.black87,
      builder: (dialogContext) => ServiceImageGalleryViewer(
        imageUrls: urls,
        initialIndex: index,
      ),
    );
  }

  @override
  State<ServiceImageGalleryViewer> createState() =>
      _ServiceImageGalleryViewerState();
}

class _ServiceImageGalleryViewerState extends State<ServiceImageGalleryViewer> {
  late final PageController _pageController;
  late int _currentIndex;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
    _pageController = PageController(initialPage: widget.initialIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final urls = widget.imageUrls;

    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: EdgeInsets.zero,
      child: Material(
        color: Colors.black,
        child: SafeArea(
          child: Stack(
            children: [
              LayoutBuilder(
                builder: (context, constraints) {
                  return PageView.builder(
                    controller: _pageController,
                    physics: urls.length <= 1
                        ? const NeverScrollableScrollPhysics()
                        : const PageScrollPhysics(),
                    itemCount: urls.length,
                    onPageChanged: (index) =>
                        setState(() => _currentIndex = index),
                    itemBuilder: (context, index) {
                      return InteractiveViewer(
                        minScale: 0.5,
                        maxScale: 5,
                        panEnabled: true,
                        scaleEnabled: true,
                        clipBehavior: Clip.none,
                        constrained: false,
                        boundaryMargin: const EdgeInsets.all(120),
                        child: SizedBox(
                          width: constraints.maxWidth,
                          height: constraints.maxHeight,
                          child: CachedNetworkImage(
                            imageUrl: urls[index],
                            fit: BoxFit.contain,
                            cacheManager: CustomCacheManager.instance,
                            placeholder: (_, _) => const Center(
                              child: CircularProgressIndicator(
                                color: Colors.white54,
                                strokeWidth: 2,
                              ),
                            ),
                            errorWidget: (_, _, _) => const Center(
                              child: Icon(
                                Icons.broken_image_outlined,
                                color: Colors.white54,
                                size: 48,
                              ),
                            ),
                          ),
                        ),
                      );
                    },
                  );
                },
              ),
              Positioned(
                top: 8,
                right: 8,
                child: IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded, color: Colors.white),
                  style: IconButton.styleFrom(
                    backgroundColor: const Color(0x99000000),
                  ),
                ),
              ),
              if (urls.length > 1)
                Positioned(
                  bottom: 24,
                  left: 0,
                  right: 0,
                  child: Center(
                    child: CommonText.medium(
                      '${_currentIndex + 1} / ${urls.length}',
                      size: 14,
                      color: Colors.white70,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
