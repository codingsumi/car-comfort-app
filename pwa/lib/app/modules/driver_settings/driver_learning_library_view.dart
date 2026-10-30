import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import 'package:get/get.dart';
import 'package:video_player/video_player.dart';

import '../../network/response/tutorial_videos_response.dart';
import '../../utils/extensions/extension.dart';
import '../../widgets/text.dart';
import 'driver_learning_library_controller.dart';

class DriverLearningLibraryView extends GetView<DriverLearningLibraryController> {
  const DriverLearningLibraryView({super.key});

  static const _workImageAsset = 'assets/images/work_image.png';

  @override
  Widget build(BuildContext context) {
    final scheme = context.colorScheme;
    final primaryRed = scheme.primary;
    final bottomInset = MediaQuery.paddingOf(context).bottom;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(
        systemNavigationBarIconBrightness: Brightness.light,
        systemNavigationBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
        statusBarColor: Colors.transparent,
      ),
      child: Scaffold(
        backgroundColor: scheme.scrim,
        body: SafeArea(
          child: Padding(
            padding: EdgeInsets.fromLTRB(24, 16, 24, bottomInset + 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Align(
                  alignment: Alignment.centerLeft,
                  child: IconButton(
                    onPressed: Get.back,
                    icon: const Icon(
                      Icons.arrow_back_ios_new_rounded,
                      color: Colors.white70,
                      size: 20,
                    ),
                  ),
                ),
                Expanded(
                  child: Obx(() {
                    if (controller.isLoading.value) {
                      return Center(
                        child: SpinKitThreeBounce(
                          color: scheme.onPrimary,
                          size: 28,
                        ),
                      );
                    }

                    final items = controller.items.toList();
                    if (items.isEmpty) {
                      return Center(
                        child: CommonText.regular(
                          'Learning videos will appear here once your admin team publishes them.',
                          color: Colors.white70,
                          size: 14,
                          textAlign: TextAlign.center,
                        ),
                      );
                    }

                    return PageView.builder(
                      controller: controller.pageController,
                      onPageChanged: controller.onPageChanged,
                      itemCount: items.length,
                      itemBuilder: (context, index) {
                        return _DriverLearningPagerPage(
                          key: ValueKey(items[index].id),
                          item: items[index],
                          index: index,
                          primaryRed: primaryRed,
                          workImageAsset: _workImageAsset,
                        );
                      },
                    );
                  }),
                ),
                Obx(() {
                  if (controller.items.length <= 1) {
                    return const SizedBox.shrink();
                  }
                  return Padding(
                    padding: const EdgeInsets.only(top: 8, bottom: 12),
                    child: _PageDots(
                      count: controller.items.length,
                      currentIndex: controller.currentPage.value,
                      activeColor: primaryRed,
                    ),
                  );
                }),
                Obx(() {
                  if (controller.isLoading.value || controller.items.isEmpty) {
                    return const SizedBox.shrink();
                  }
                  return CommonText.medium(
                    'Close',
                    color: Colors.white70,
                    size: 14,
                    textAlign: TextAlign.center,
                    onTap: Get.back,
                  );
                }),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Page dots indicator ───────────────────────────────────────────────────

class _PageDots extends StatelessWidget {
  const _PageDots({
    required this.count,
    required this.currentIndex,
    required this.activeColor,
  });

  final int count;
  final int currentIndex;
  final Color activeColor;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(count, (index) {
        final active = index == currentIndex;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          margin: const EdgeInsets.symmetric(horizontal: 4),
          width: active ? 18 : 8,
          height: 8,
          decoration: BoxDecoration(
            color: active ? activeColor : Colors.white24,
            borderRadius: BorderRadius.circular(8),
          ),
        );
      }),
    );
  }
}

// ─── Individual video page ─────────────────────────────────────────────────

class _DriverLearningPagerPage extends StatefulWidget {
  const _DriverLearningPagerPage({
    super.key,
    required this.item,
    required this.index,
    required this.primaryRed,
    required this.workImageAsset,
  });

  final TutorialVideoItem item;
  final int index;
  final Color primaryRed;
  final String workImageAsset;

  @override
  State<_DriverLearningPagerPage> createState() =>
      _DriverLearningPagerPageState();
}

class _DriverLearningPagerPageState extends State<_DriverLearningPagerPage> {
  VideoPlayerController? _videoController;
  var _hasError = false;
  var _isLoading = true;
  Worker? _pageWorker;

  DriverLearningLibraryController get _learningController =>
      Get.find<DriverLearningLibraryController>();

  List<String> get _learnBullets => widget.item.learnBullets;

  @override
  void initState() {
    super.initState();
    _pageWorker = ever<int>(_learningController.currentPage, _onActivePageChanged);
    final isActive = _learningController.currentPage.value == widget.index;
    unawaited(_initVideo(playOnReady: isActive));
  }

  void _onActivePageChanged(int page) {
    if (!mounted) return;
    if (page == widget.index) {
      if (_videoController?.value.isInitialized == true) {
        unawaited(_videoController!.play());
      }
    } else {
      unawaited(_videoController?.pause());
    }
  }

  @override
  void dispose() {
    _pageWorker?.dispose();
    unawaited(_videoController?.dispose());
    super.dispose();
  }

  Future<void> _initVideo({required bool playOnReady}) async {
    final raw = widget.item.videoUrl?.trim();
    final uri = raw != null && raw.isNotEmpty ? Uri.tryParse(raw) : null;
    if (uri == null || !uri.hasScheme) {
      if (mounted) setState(() { _hasError = true; _isLoading = false; });
      return;
    }
    try {
      final vc = VideoPlayerController.networkUrl(uri);
      _videoController = vc;
      await vc.initialize();
      await vc.setLooping(true);
      if (playOnReady) await vc.play();
      if (mounted) setState(() => _isLoading = false);
    } catch (_) {
      await _videoController?.dispose();
      _videoController = null;
      if (mounted) setState(() { _hasError = true; _isLoading = false; });
    }
  }

  Future<void> _togglePlayback() async {
    final vc = _videoController;
    if (vc == null) return;
    if (vc.value.isPlaying) {
      await vc.pause();
    } else {
      await vc.play();
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = context.colorScheme;
    final title = widget.item.title.trim().isNotEmpty
        ? widget.item.title.trim()
        : 'Provider Learning';
    final bullets = _learnBullets;
    final videoHeight = MediaQuery.sizeOf(context).height * 0.5;

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CommonText.bold(title, color: scheme.onPrimary, size: 22,
              textAlign: TextAlign.center),
          const SizedBox(height: 10),
          CommonText.regular('Watch this quick tutorial to get started',
              color: Colors.white70, size: 14, textAlign: TextAlign.center),
          const SizedBox(height: 20),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: SizedBox(
              height: videoHeight,
              width: double.infinity,
              child: _buildVideoArea(context, videoHeight),
            ),
          ),
          if (bullets.isNotEmpty) ...[
            const SizedBox(height: 24),
            CommonText.bold("You'll Learn:", color: scheme.onPrimary, size: 16),
            const SizedBox(height: 12),
            ..._buildBullets(widget.primaryRed, bullets),
          ],
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  List<Widget> _buildBullets(Color color, List<String> items) {
    final out = <Widget>[];
    for (var i = 0; i < items.length; i++) {
      if (i > 0) out.add(const SizedBox(height: 10));
      out.add(Padding(
        padding: const EdgeInsets.only(left: 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Container(
                width: 8, height: 8,
                decoration: BoxDecoration(color: color, shape: BoxShape.circle),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: CommonText.regular(items[i],
                  color: Get.context!.colorScheme.onPrimary, size: 14),
            ),
          ],
        ),
      ));
    }
    return out;
  }

  Widget _buildVideoArea(BuildContext context, double maxHeight) {
    if (_isLoading) {
      return ColoredBox(
        color: Colors.black26,
        child: Center(
          child: SpinKitThreeBounce(color: context.colorScheme.onPrimary, size: 24),
        ),
      );
    }
    if (_hasError || _videoController == null || !_videoController!.value.isInitialized) {
      return Image.asset(
        widget.workImageAsset,
        fit: BoxFit.cover,
        width: double.infinity,
        height: maxHeight,
        cacheWidth: 800,
        cacheHeight: maxHeight.isFinite ? (maxHeight * 2).ceil() : 600,
      );
    }
    final vc = _videoController!;
    return AnimatedBuilder(
      animation: vc,
      builder: (ctx, _) => ColoredBox(
        color: Colors.black,
        child: Center(
          child: _InlineVideoPlayer(
            controller: vc,
            isPlaying: vc.value.isPlaying,
            maxHeight: maxHeight,
            onTogglePlayback: _togglePlayback,
          ),
        ),
      ),
    );
  }
}

// ─── Inline video player with tap-to-show controls ─────────────────────────

class _InlineVideoPlayer extends StatefulWidget {
  const _InlineVideoPlayer({
    required this.controller,
    required this.isPlaying,
    required this.maxHeight,
    required this.onTogglePlayback,
  });

  final VideoPlayerController controller;
  final bool isPlaying;
  final double maxHeight;
  final Future<void> Function() onTogglePlayback;

  @override
  State<_InlineVideoPlayer> createState() => _InlineVideoPlayerState();
}

class _InlineVideoPlayerState extends State<_InlineVideoPlayer> {
  bool _showControls = false;
  Timer? _hideTimer;

  @override
  void dispose() {
    _hideTimer?.cancel();
    super.dispose();
  }

  void _reveal() {
    setState(() => _showControls = true);
    _scheduleHide();
  }

  void _scheduleHide() {
    _hideTimer?.cancel();
    if (!widget.isPlaying) return;
    _hideTimer = Timer(const Duration(seconds: 2), () {
      if (!mounted) return;
      setState(() => _showControls = false);
    });
  }

  Future<void> _toggle() async {
    await widget.onTogglePlayback();
    if (!mounted) return;
    setState(() => _showControls = true);
    _scheduleHide();
  }

  @override
  Widget build(BuildContext context) {
    final maxWidth = MediaQuery.sizeOf(context).width - 48;
    final aspect = widget.controller.value.aspectRatio;
    var w = maxWidth;
    var h = w / aspect;
    if (h > widget.maxHeight) { h = widget.maxHeight; w = h * aspect; }

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: _reveal,
      child: SizedBox(
        width: w, height: h,
        child: Stack(
          fit: StackFit.expand,
          children: [
            Positioned.fill(child: VideoPlayer(widget.controller)),
            AnimatedOpacity(
              opacity: _showControls ? 1 : 0,
              duration: const Duration(milliseconds: 180),
              child: IgnorePointer(
                ignoring: !_showControls,
                child: Center(
                  child: Material(
                    color: Colors.white.withValues(alpha: 0.95),
                    shape: const CircleBorder(),
                    clipBehavior: Clip.antiAlias,
                    child: InkWell(
                      onTap: _toggle,
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Icon(
                          widget.isPlaying
                              ? Icons.pause_rounded
                              : Icons.play_arrow_rounded,
                          size: 36, color: Colors.black87,
                        ),
                      ),
                    ),
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
