import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import 'image.dart';
import 'text.dart';

/// Full-screen swipeable gallery for local files and remote URLs.
class LocalImageGalleryViewer extends StatefulWidget {
  const LocalImageGalleryViewer({
    super.key,
    required this.imagePaths,
    this.initialIndex = 0,
    this.onDeleteAt,
  });

  final List<String> imagePaths;
  final int initialIndex;
  final ValueChanged<int>? onDeleteAt;

  static Future<void> show(
    BuildContext context, {
    required List<String> imagePaths,
    int initialIndex = 0,
    ValueChanged<int>? onDeleteAt,
  }) {
    final paths = imagePaths
        .map((p) => p.trim())
        .where((p) => p.isNotEmpty)
        .toList();
    if (paths.isEmpty) return Future.value();

    final index = initialIndex.clamp(0, paths.length - 1);

    return showDialog<void>(
      context: context,
      barrierColor: Colors.black87,
      useRootNavigator: true,
      builder: (dialogContext) => LocalImageGalleryViewer(
        imagePaths: paths,
        initialIndex: index,
        onDeleteAt: onDeleteAt,
      ),
    );
  }

  @override
  State<LocalImageGalleryViewer> createState() =>
      _LocalImageGalleryViewerState();
}

/// Makes an existing profile-photo widget open in the fullscreen gallery.
/// Supports both remote URLs and local image paths.
class TappableProfilePhoto extends StatelessWidget {
  const TappableProfilePhoto({
    super.key,
    required this.imagePath,
    required this.child,
    this.semanticsLabel = 'View your profile photo',
    this.showZoomBadge = true,
    this.badgeOnLeft = false,
  });

  final String? imagePath;
  final Widget child;
  final String semanticsLabel;
  final bool showZoomBadge;
  final bool badgeOnLeft;

  @override
  Widget build(BuildContext context) {
    final path = (imagePath ?? '').trim();
    if (path.isEmpty) return child;

    return Semantics(
      button: true,
      label: semanticsLabel,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => LocalImageGalleryViewer.show(context, imagePaths: [path]),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            child,
            if (showZoomBadge)
              Positioned(
                left: badgeOnLeft ? 4 : null,
                right: badgeOnLeft ? null : 4,
                bottom: 4,
                child: IgnorePointer(
                  child: Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: const Color(0xff2C2C2E),
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 1.5),
                    ),
                    child: const Icon(
                      Icons.zoom_in_rounded,
                      size: 17,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _LocalImageGalleryViewerState extends State<LocalImageGalleryViewer> {
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

  bool _isRemote(String path) =>
      path.startsWith('http://') ||
      path.startsWith('https://') ||
      path.startsWith('blob:') ||
      path.startsWith('data:');

  Widget _imageAt(String path) {
    if (_isRemote(path)) {
      return CachedNetworkImage(
        imageUrl: path,
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
      );
    }

    return Image.file(
      File(path),
      fit: BoxFit.contain,
      cacheWidth: 1080,
      cacheHeight: 1080,
      errorBuilder: (_, _, _) => const Center(
        child: Icon(
          Icons.broken_image_outlined,
          color: Colors.white54,
          size: 48,
        ),
      ),
    );
  }

  void _deleteCurrent() {
    widget.onDeleteAt?.call(_currentIndex);
  }

  @override
  Widget build(BuildContext context) {
    final paths = widget.imagePaths;
    if (paths.isEmpty) return const SizedBox.shrink();

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
                    physics: paths.length <= 1
                        ? const NeverScrollableScrollPhysics()
                        : const PageScrollPhysics(),
                    itemCount: paths.length,
                    onPageChanged: (index) =>
                        setState(() => _currentIndex = index),
                    itemBuilder: (context, index) {
                      return InteractiveViewer(
                        minScale: 0.5,
                        maxScale: 5,
                        panEnabled: true,
                        scaleEnabled: true,
                        clipBehavior: Clip.none,
                        child: SizedBox(
                          width: constraints.maxWidth,
                          height: constraints.maxHeight,
                          child: _imageAt(paths[index]),
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
              if (widget.onDeleteAt != null)
                Positioned(
                  top: 8,
                  left: 8,
                  child: IconButton(
                    onPressed: _deleteCurrent,
                    icon: const Icon(
                      Icons.delete_outline_rounded,
                      color: Colors.white,
                    ),
                    style: IconButton.styleFrom(
                      backgroundColor: const Color(0xCCF2051F),
                    ),
                  ),
                ),
              if (paths.length > 1)
                Positioned(
                  bottom: 24,
                  left: 0,
                  right: 0,
                  child: Center(
                    child: CommonText.medium(
                      '${_currentIndex + 1} / ${paths.length}',
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

/// Renders a local file path or remote URL as a cover image.
class BookingPhotoImage extends StatelessWidget {
  const BookingPhotoImage({
    super.key,
    required this.path,
    this.fit = BoxFit.cover,
    this.width,
    this.height,
  });

  final String path;
  final BoxFit fit;
  final double? width;
  final double? height;

  bool get _isRemote =>
      path.startsWith('http://') ||
      path.startsWith('https://') ||
      path.startsWith('blob:') ||
      path.startsWith('data:');

  @override
  Widget build(BuildContext context) {
    // Downsample to 2× display size to reduce memory usage
    final cacheW = width != null && width!.isFinite ? (width! * 2).ceil() : 800;
    final cacheH = height != null && height!.isFinite
        ? (height! * 2).ceil()
        : 800;

    if (_isRemote) {
      return Image.network(
        path,
        width: width,
        height: height,
        fit: fit,
        cacheWidth: cacheW,
        cacheHeight: cacheH,
        errorBuilder: (_, _, _) => _placeholder(),
      );
    }

    return Image.file(
      File(path),
      width: width,
      height: height,
      fit: fit,
      cacheWidth: cacheW,
      cacheHeight: cacheH,
      errorBuilder: (_, _, _) => _placeholder(),
    );
  }

  Widget _placeholder() {
    return Container(
      width: width,
      height: height,
      color: Colors.grey.shade200,
      alignment: Alignment.center,
      child: Icon(Icons.image_outlined, color: Colors.grey.shade500),
    );
  }
}
