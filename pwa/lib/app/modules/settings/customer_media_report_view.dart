import 'dart:io';
import 'dart:typed_data';

import 'package:car_comfort/app/utils/extensions/extension.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';
import 'package:video_player/video_player.dart';
import 'package:video_thumbnail/video_thumbnail.dart';

import '../../utils/image_upload_compress.dart';
import '../../widgets/blurred_image_screen_header.dart';
import '../../widgets/button.dart';
import '../../widgets/local_image_gallery_viewer.dart';
import '../../widgets/text.dart';
import '../../widgets/text_field.dart';
import 'customer_media_report_controller.dart';

class CustomerMediaReportView extends GetView<CustomerMediaReportController> {
  const CustomerMediaReportView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xffFAFAFA),
      body: Column(
        children: [
          BlurredImageScreenHeader(title: controller.config.title),
          Expanded(
            child: SingleChildScrollView(
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              padding: EdgeInsets.fromLTRB(
                20,
                22,
                20,
                24 + MediaQuery.viewInsetsOf(context).bottom,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  CommonText.regular(
                    controller.config.introText,
                    color: const Color(0xff6E6E78),
                  ),
                  const SizedBox(height: 18),
                  CommonTextField(
                    controller: controller.descriptionController,
                    hintText: controller.config.descriptionHint,
                    labelText: 'Description',
                    textColor: context.colorScheme.onSurface,
                    labelColor: context.colorScheme.onSurface,
                    hintColor: context.colorScheme.outlineVariant,
                    maxLines: 7,
                    minLines: 5,
                    keyboardType: TextInputType.multiline,
                    inputAction: TextInputAction.newline,
                    bgColor: Colors.transparent,
                    borderColor: context.colorScheme.outlineVariant,
                  ),
                  const SizedBox(height: 16),
                  CommonTextField(
                    controller: controller.bookingIdController,
                    hintText: 'Optional — if related to a booking',
                    labelText: 'Booking ID',
                    textColor: context.colorScheme.onSurface,
                    labelColor: context.colorScheme.onSurface,
                    hintColor: context.colorScheme.outlineVariant,
                    keyboardType: TextInputType.number,
                    inputAction: TextInputAction.done,
                    bgColor: Colors.transparent,
                    borderColor: context.colorScheme.outlineVariant,
                  ),
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      const Expanded(
                        child: CommonText.medium(
                          'Photos & videos',
                          size: 15,
                        ),
                      ),
                      Obx(
                        () => CommonText.regular(
                          '${controller.mediaPaths.length}/${CustomerMediaReportController.maxAttachments}',
                          size: 13,
                          color: const Color(0xff8B8B8B),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Obx(
                    () => _MediaGrid(
                      controller: controller,
                      mediaPaths: controller.mediaPaths.toList(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: () => controller.addMedia(context),
                    icon: const Icon(Icons.add_photo_alternate_outlined, size: 18),
                    label: const Text('Add photo or video'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xffE70B1C),
                      side: const BorderSide(color: Color(0xffE8E8EF)),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                  const SizedBox(height: 22),
                  Obx(
                    () => AppButton(
                      label: controller.isSubmitting.value
                          ? 'Submitting...'
                          : 'Submit report',
                      onPressed: controller.isSubmitting.value
                          ? null
                          : controller.submit,
                      btnCornerRadius: 14,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Full-screen video player dialog ──────────────────────────────────────────

class _FullScreenVideoPlayer extends StatefulWidget {
  const _FullScreenVideoPlayer({required this.path});
  final String path;

  static Future<void> show(BuildContext context, String path) =>
      showDialog<void>(
        context: context,
        barrierColor: Colors.black,
        useRootNavigator: true,
        builder: (_) => _FullScreenVideoPlayer(path: path),
      );

  @override
  State<_FullScreenVideoPlayer> createState() => _FullScreenVideoPlayerState();
}

class _FullScreenVideoPlayerState extends State<_FullScreenVideoPlayer> {
  late final VideoPlayerController _vpc;
  bool _initialized = false;
  bool _error = false;

  @override
  void initState() {
    super.initState();
    _vpc = VideoPlayerController.file(File(widget.path))
      ..initialize().then((_) {
          if (!mounted) return;
          setState(() => _initialized = true);
          _vpc.play();
        }).catchError((_) {
          if (!mounted) return;
          setState(() => _error = true);
        });
  }

  @override
  void dispose() {
    _vpc.dispose();
    super.dispose();
  }

  void _togglePlay() {
    setState(() {
      _vpc.value.isPlaying ? _vpc.pause() : _vpc.play();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Stack(
          children: [
            Center(
              child: _error
                  ? const Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.error_outline, color: Colors.white54, size: 48),
                        SizedBox(height: 12),
                        Text('Could not play video',
                            style: TextStyle(color: Colors.white54)),
                      ],
                    )
                  : _initialized
                      ? GestureDetector(
                          onTap: _togglePlay,
                          child: AspectRatio(
                            aspectRatio: _vpc.value.aspectRatio,
                            child: VideoPlayer(_vpc),
                          ),
                        )
                      : const CircularProgressIndicator(
                          color: Colors.white54, strokeWidth: 2),
            ),
            // Play/pause overlay
            if (_initialized)
              Center(
                child: GestureDetector(
                  onTap: _togglePlay,
                  behavior: HitTestBehavior.translucent,
                  child: ValueListenableBuilder<VideoPlayerValue>(
                    valueListenable: _vpc,
                    builder: (_, value, __) => AnimatedOpacity(
                      opacity: value.isPlaying ? 0 : 1,
                      duration: const Duration(milliseconds: 200),
                      child: Container(
                        decoration: const BoxDecoration(
                          color: Colors.black38,
                          shape: BoxShape.circle,
                        ),
                        padding: const EdgeInsets.all(18),
                        child: Icon(
                          value.isPlaying
                              ? Icons.pause_rounded
                              : Icons.play_arrow_rounded,
                          color: Colors.white,
                          size: 48,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            // Progress bar
            if (_initialized)
              Positioned(
                left: 0, right: 0, bottom: 0,
                child: VideoProgressIndicator(
                  _vpc,
                  allowScrubbing: true,
                  colors: const VideoProgressColors(
                    playedColor: Color(0xffE70B1C),
                    bufferedColor: Colors.white24,
                    backgroundColor: Colors.white10,
                  ),
                ),
              ),
            // Close button
            Positioned(
              top: 8, right: 8,
              child: IconButton(
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.close_rounded, color: Colors.white, size: 28),
                style: IconButton.styleFrom(backgroundColor: Colors.black38),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Video thumbnail widget ───────────────────────────────────────────────────

/// Generates and displays the first-frame thumbnail of a local video file.
/// Falls back to a play-icon placeholder if generation fails.
class _VideoThumbnail extends StatefulWidget {
  const _VideoThumbnail({required this.videoPath});
  final String videoPath;

  @override
  State<_VideoThumbnail> createState() => _VideoThumbnailState();
}

class _VideoThumbnailState extends State<_VideoThumbnail> {
  Uint8List? _thumbnail;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _generateThumbnail();
  }

  Future<void> _generateThumbnail() async {
    try {
      final bytes = await VideoThumbnail.thumbnailData(
        video: widget.videoPath,
        imageFormat: ImageFormat.JPEG,
        maxWidth: 400,
        quality: 75,
      );
      if (!mounted) return;
      setState(() {
        _thumbnail = bytes;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      alignment: Alignment.center,
      children: [
        if (_loading)
          const ColoredBox(
            color: Color(0xffECECEC),
            child: Center(
              child: SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Color(0xff6E6E78),
                ),
              ),
            ),
          )
        else if (_thumbnail != null)
          Image.memory(
            _thumbnail!,
            fit: BoxFit.cover,
          )
        else
          const ColoredBox(
            color: Color(0xffECECEC),
            child: Center(
              child: Icon(
                Icons.videocam_rounded,
                color: Color(0xff6E6E78),
                size: 28,
              ),
            ),
          ),
        // Play badge overlay
        Center(
          child: Container(
            decoration: const BoxDecoration(
              color: Colors.black45,
              shape: BoxShape.circle,
            ),
            padding: const EdgeInsets.all(6),
            child: const Icon(
              Icons.play_arrow_rounded,
              color: Colors.white,
              size: 20,
            ),
          ),
        ),
      ],
    );
  }
}

// ── Media grid ────────────────────────────────────────────────────────────────

class _MediaGrid extends StatelessWidget {
  const _MediaGrid({
    required this.controller,
    required this.mediaPaths,
  });

  final CustomerMediaReportController controller;
  final List<String> mediaPaths;

  void _openPreview(BuildContext context, int index) {
    final path = mediaPaths[index];
    if (controller.isVideoPath(path)) {
      _FullScreenVideoPlayer.show(context, path);
    } else {
      // Gather only image paths to keep the swipe gallery photo-only
      final imagePaths = mediaPaths
          .where((p) => isUploadableImagePath(p))
          .toList();
      final imageIndex = imagePaths.indexOf(path);
      LocalImageGalleryViewer.show(
        context,
        imagePaths: imagePaths,
        initialIndex: imageIndex < 0 ? 0 : imageIndex,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (mediaPaths.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xffE8E8EF)),
        ),
        child: const CommonText.regular(
          'No media added yet. Tap below to add photos or videos.',
          size: 13,
          color: Color(0xff8B8B8B),
        ),
      );
    }

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: mediaPaths.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: 8,
        mainAxisSpacing: 8,
      ),
      itemBuilder: (context, index) {
        final path = mediaPaths[index];
        final isVideo = controller.isVideoPath(path);
        final isImage = isUploadableImagePath(path);

        return Stack(
          fit: StackFit.expand,
          children: [
            // Tappable thumbnail — opens full-screen image viewer or video player
            Material(
              color: Colors.transparent,
              borderRadius: BorderRadius.circular(10),
              child: InkWell(
                onTap: () => _openPreview(context, index),
                borderRadius: BorderRadius.circular(10),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: ColoredBox(
                    color: const Color(0xffECECEC),
                    child: isImage
                        ? Image.file(File(path), fit: BoxFit.cover, cacheWidth: 400, cacheHeight: 400)
                        : isVideo
                            ? _VideoThumbnail(videoPath: path)
                            : Stack(
                                alignment: Alignment.center,
                                children: [
                                  const ColoredBox(color: Color(0xffECECEC)),
                                  const Icon(
                                    Icons.insert_drive_file_outlined,
                                    color: Color(0xff6E6E78),
                                    size: 28,
                                  ),
                                ],
                              ),
                  ),
                ),
              ),
            ),
            // Delete button (top-right, above the tap layer)
            Positioned(
              top: 4,
              right: 4,
              child: Material(
                color: Colors.black54,
                shape: const CircleBorder(),
                child: InkWell(
                  onTap: () => controller.removeMediaAt(index),
                  customBorder: const CircleBorder(),
                  child: const Padding(
                    padding: EdgeInsets.all(4),
                    child: Icon(Icons.close, color: Colors.white, size: 14),
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}
