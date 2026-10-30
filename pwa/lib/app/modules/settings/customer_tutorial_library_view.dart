import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import 'package:get/get.dart';
import 'package:video_player/video_player.dart';

import '../../utils/extensions/extension.dart';
import '../../network/response/tutorial_videos_response.dart';
import '../../widgets/text.dart';
import 'customer_tutorial_library_controller.dart';

class CustomerTutorialLibraryView extends GetView<CustomerTutorialLibraryController> {
  const CustomerTutorialLibraryView({super.key});

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
                          'Tutorial videos will appear here once your admin team publishes them.',
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
                        return _TutorialPagerPage(
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

class _TutorialPagerPage extends StatefulWidget {
  const _TutorialPagerPage({
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
  State<_TutorialPagerPage> createState() => _TutorialPagerPageState();
}

class _TutorialPagerPageState extends State<_TutorialPagerPage> {
  VideoPlayerController? _controller;
  var _hasError = false;
  var _isLoading = true;
  Worker? _pageWorker;

  CustomerTutorialLibraryController get _tutorialController =>
      Get.find<CustomerTutorialLibraryController>();

  List<String> get _learnBullets => widget.item.learnBullets;

  @override
  void initState() {
    super.initState();
    _pageWorker = ever<int>(_tutorialController.currentPage, _onActivePageChanged);
    final isActive = _tutorialController.currentPage.value == widget.index;
    unawaited(_initVideo(playOnReady: isActive));
  }

  void _onActivePageChanged(int page) {
    if (!mounted) return;
    if (page == widget.index) {
      if (_controller?.value.isInitialized == true) {
        unawaited(_controller!.play());
      }
    } else {
      unawaited(_controller?.pause());
    }
  }

  @override
  void dispose() {
    _pageWorker?.dispose();
    unawaited(_controller?.dispose());
    super.dispose();
  }

  Future<void> _initVideo({required bool playOnReady}) async {
    final raw = widget.item.videoUrl?.trim();
    final uri = raw != null && raw.isNotEmpty ? Uri.tryParse(raw) : null;
    if (uri == null || !uri.hasScheme) {
      if (mounted) {
        setState(() {
          _hasError = true;
          _isLoading = false;
        });
      }
      return;
    }

    try {
      final controller = VideoPlayerController.networkUrl(uri);
      _controller = controller;
      await controller.initialize();
      await controller.setLooping(true);
      if (playOnReady) {
        await controller.play();
      }
      if (mounted) setState(() => _isLoading = false);
    } catch (_) {
      await _controller?.dispose();
      _controller = null;
      if (mounted) {
        setState(() {
          _hasError = true;
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _togglePlayback() async {
    final controller = _controller;
    if (controller == null) return;
    if (controller.value.isPlaying) {
      await controller.pause();
    } else {
      await controller.play();
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = context.colorScheme;
    final title = widget.item.title.trim().isNotEmpty
        ? widget.item.title.trim()
        : 'How Car Comfort Works';
    final bullets = _learnBullets;
    final videoHeight = MediaQuery.sizeOf(context).height * 0.5;

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CommonText.bold(
            title,
            color: scheme.onPrimary,
            size: 22,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 10),
          CommonText.regular(
            'Watch this quick tutorial to get started',
            color: Colors.white70,
            size: 14,
            textAlign: TextAlign.center,
          ),
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
            CommonText.bold(
              "You'll Learn:",
              color: scheme.onPrimary,
              size: 16,
            ),
            const SizedBox(height: 12),
            ..._instructionBulletsFrom(widget.primaryRed, bullets),
          ],
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  List<Widget> _instructionBulletsFrom(Color primaryRed, List<String> items) {
    final out = <Widget>[];
    for (var i = 0; i < items.length; i++) {
      if (i > 0) out.add(const SizedBox(height: 10));
      out.add(
        _LearnBullet(
          text: items[i],
          bulletColor: primaryRed,
        ).paddingOnly(left: 8),
      );
    }
    return out;
  }

  Widget _buildVideoArea(BuildContext context, double maxHeight) {
    if (_isLoading) {
      return ColoredBox(
        color: Colors.black26,
        child: Center(
          child: SpinKitThreeBounce(
            color: context.colorScheme.onPrimary,
            size: 24,
          ),
        ),
      );
    }

    if (_hasError || _controller == null || !_controller!.value.isInitialized) {
      return Image.asset(
        widget.workImageAsset,
        fit: BoxFit.cover,
        width: double.infinity,
        height: maxHeight,
        cacheWidth: 800,
        cacheHeight: maxHeight.isFinite ? (maxHeight * 2).ceil() : 600,
      );
    }

    final controller = _controller!;
    return AnimatedBuilder(
      animation: controller,
      builder: (context, child) {
        return ColoredBox(
          color: Colors.black,
          child: Center(
            child: _TutorialInlineVideoPlayer(
              controller: controller,
              isPlaying: controller.value.isPlaying,
              maxHeight: maxHeight,
              onTogglePlayback: _togglePlayback,
            ),
          ),
        );
      },
    );
  }
}

class _TutorialInlineVideoPlayer extends StatefulWidget {
  const _TutorialInlineVideoPlayer({
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
  State<_TutorialInlineVideoPlayer> createState() =>
      _TutorialInlineVideoPlayerState();
}

class _TutorialInlineVideoPlayerState extends State<_TutorialInlineVideoPlayer> {
  bool _showControls = false;
  Timer? _hideControlsTimer;

  @override
  void dispose() {
    _hideControlsTimer?.cancel();
    super.dispose();
  }

  void _revealControls() {
    setState(() => _showControls = true);
    _scheduleHideControls();
  }

  void _scheduleHideControls() {
    _hideControlsTimer?.cancel();
    if (!widget.isPlaying) return;
    _hideControlsTimer = Timer(const Duration(seconds: 2), () {
      if (!mounted) return;
      setState(() => _showControls = false);
    });
  }

  Future<void> _togglePlayback() async {
    await widget.onTogglePlayback();
    if (!mounted) return;
    setState(() => _showControls = true);
    _scheduleHideControls();
  }

  @override
  Widget build(BuildContext context) {
    final maxWidth = MediaQuery.sizeOf(context).width - 48;
    final aspectRatio = widget.controller.value.aspectRatio;
    var width = maxWidth;
    var height = width / aspectRatio;
    if (height > widget.maxHeight) {
      height = widget.maxHeight;
      width = height * aspectRatio;
    }

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: _revealControls,
      child: SizedBox(
        width: width,
        height: height,
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
                      onTap: _togglePlayback,
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Icon(
                          widget.isPlaying
                              ? Icons.pause_rounded
                              : Icons.play_arrow_rounded,
                          size: 36,
                          color: Colors.black87,
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

class _LearnBullet extends StatelessWidget {
  const _LearnBullet({required this.text, required this.bulletColor});

  final String text;
  final Color bulletColor;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              color: bulletColor,
              shape: BoxShape.circle,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: CommonText.regular(
            text,
            color: context.colorScheme.onPrimary,
            size: 14,
          ),
        ),
      ],
    );
  }
}
