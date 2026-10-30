import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../utils/document_display_name.dart';
import 'image.dart';

/// Full-screen image viewer with pinch-to-zoom and pan (driver documents, etc.).
class DocumentImageViewer extends StatefulWidget {
  const DocumentImageViewer({
    super.key,
    required this.imageUrl,
    this.title,
  });

  final String imageUrl;
  final String? title;

  static Future<void> show(
    BuildContext context, {
    required String imageUrl,
    String? title,
  }) {
    final url = imageUrl.trim();
    if (url.isEmpty) return Future.value();

    return Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        fullscreenDialog: true,
        builder: (_) => DocumentImageViewer(
          imageUrl: url,
          title: formatDocumentDisplayName(title),
        ),
      ),
    );
  }

  @override
  State<DocumentImageViewer> createState() => _DocumentImageViewerState();
}

class _DocumentImageViewerState extends State<DocumentImageViewer> {
  final TransformationController _transformController =
      TransformationController();

  TapDownDetails? _doubleTapDetails;

  @override
  void dispose() {
    _transformController.dispose();
    super.dispose();
  }

  void _onDoubleTapDown(TapDownDetails details) {
    _doubleTapDetails = details;
  }

  void _onDoubleTap() {
    final details = _doubleTapDetails;
    if (details == null) return;

    final current = _transformController.value;
    final isZoomedIn = current.getMaxScaleOnAxis() > 1.05;

    if (isZoomedIn) {
      _transformController.value = Matrix4.identity();
      return;
    }

    final position = details.localPosition;
    const scale = 2.5;
    _transformController.value = Matrix4.identity()
      ..translate(-position.dx * (scale - 1), -position.dy * (scale - 1))
      ..scale(scale);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        iconTheme: const IconThemeData(color: Colors.white),
        title: Text(
          formatDocumentDisplayName(widget.title),
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
        ),
        elevation: 0,
      ),
      body: LayoutBuilder(
        builder: (context, constraints) {
          return Stack(
            children: [
              Positioned.fill(
                child: GestureDetector(
                  onDoubleTapDown: _onDoubleTapDown,
                  onDoubleTap: _onDoubleTap,
                  child: InteractiveViewer(
                    transformationController: _transformController,
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
                        imageUrl: widget.imageUrl,
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
                  ),
                ),
              ),
              Positioned(
                left: 0,
                right: 0,
                bottom: 16,
                child: SafeArea(
                   child:  Text(
                    'Pinch to zoom · Double-tap to zoom · Drag to pan',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.55),
                      fontSize: 12,
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
