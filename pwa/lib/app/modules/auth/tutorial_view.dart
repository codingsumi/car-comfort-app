import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import 'package:get/get.dart';
import 'package:video_player/video_player.dart';
import 'dart:async';

import '../../utils/extensions/extension.dart';
import '../../widgets/button.dart';
import '../../widgets/text.dart';
import 'tutorial_controller.dart';

/// Stateless screen: state lives in [TutorialController] (loaded via [TutorialBinding]).
class TutorialView extends GetView<TutorialController> {
  const TutorialView({super.key});

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
            padding: EdgeInsets.fromLTRB(24, 16, 24, bottomInset + 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (controller.isEmbeddedInApp)
                  Align(
                    alignment: Alignment.centerLeft,
                    child: IconButton(
                      onPressed: controller.exitTutorial,
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
                    return SingleChildScrollView(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          CommonText.bold(
                            controller.isProviderAudience
                                ? 'How Car Comfort Works for Service Providers'
                                : 'How Car Comfort Works',
                            color: scheme.onPrimary,
                            size: 22,
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 10),
                          CommonText.regular(
                            controller.isProviderAudience
                                ? 'Watch this tutorial before you start accepting jobs'
                                : 'Watch this quick tutorial to get started',
                            color: Colors.white70,
                            size: 14,
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 20),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: Obx(() {
                              // Subscribe to token bumps when the player is created / ready.
                              final _ = controller.videoWidgetToken.value;
                              if (controller.hasVideoError.value) {
                                return AspectRatio(
                                  aspectRatio: 16 / 10,
                                  child: Image.asset(
                                    _workImageAsset,
                                    fit: BoxFit.cover,
                                    cacheWidth: 800,
                                    cacheHeight: 500,
                                  ),
                                );
                              }
                              final vc = controller.videoPlayer;
                              if (vc == null) {
                                return AspectRatio(
                                  aspectRatio: 16 / 10,
                                  child: ColoredBox(
                                    color: Colors.black26,
                                    child: Center(
                                      child: SpinKitThreeBounce(
                                        color: scheme.onPrimary,
                                        size: 24,
                                      ),
                                    ),
                                  ),
                                );
                              }
                              return AnimatedBuilder(
                                animation: vc,
                                builder: (context, child) {
                                  if (vc.value.hasError) {
                                    return AspectRatio(
                                      aspectRatio: 16 / 10,
                                      child: Image.asset(
                                        _workImageAsset,
                                        fit: BoxFit.cover,
                                        cacheWidth: 800,
                                        cacheHeight: 500,
                                      ),
                                    );
                                  }
                                  if (!vc.value.isInitialized) {
                                    return AspectRatio(
                                      aspectRatio: 16 / 10,
                                      child: ColoredBox(
                                        color: Colors.black26,
                                        child: Center(
                                          child: SpinKitThreeBounce(
                                            color: scheme.onPrimary,
                                            size: 24,
                                          ),
                                        ),
                                      ),
                                    );
                                  }
                                  final playing = vc.value.isPlaying;
                                  return AspectRatio(
                                    aspectRatio: vc.value.aspectRatio,
                                    child: _TutorialInlineVideoPlayer(
                                      controller: vc,
                                      isPlaying: playing,
                                      onTogglePlayback:
                                          controller.toggleInlinePlayback,
                                    ),
                                  );
                                },
                              );
                            }),
                          ),
                          const SizedBox(height: 24),
                          Obx(() {
                            final items = controller.instructions.toList();
                            return Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                CommonText.bold(
                                  "You'll Learn:",
                                  color: scheme.onPrimary,
                                  size: 16,
                                ),
                                const SizedBox(height: 12),
                                ..._instructionBulletsFrom(primaryRed, items),
                              ],
                            );
                          }),
                          const SizedBox(height: 20),
                        ],
                      ),
                    );
                  }),
                ),
                // AppButton(
                //   label: 'Watch Tutorial',
                //   onPressed: controller.watchTutorial,
                //   bgColor: primaryRed,
                //   txtColor: scheme.onPrimary,
                //   btnCornerRadius: 14,
                // ),
                if (controller.isProviderOnboarding) ...[
                  AppButton(
                    label: 'Continue',
                    onPressed: controller.completeProviderOnboardingTutorial,
                    bgColor: primaryRed,
                    txtColor: scheme.onPrimary,
                    btnCornerRadius: 14,
                  ),
                  const SizedBox(height: 14),
                ] else ...[
                  const SizedBox(height: 14),
                  CommonText.medium(
                    controller.isEmbeddedInApp ? 'Close' : 'Skip For Now',
                    color: Colors.white70,
                    size: 14,
                    textAlign: TextAlign.center,
                    onTap: controller.exitTutorial,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _instructionBulletsFrom(
    Color primaryRed,
    List<String> items,
  ) {
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
}

class _TutorialInlineVideoPlayer extends StatefulWidget {
  const _TutorialInlineVideoPlayer({
    required this.controller,
    required this.isPlaying,
    required this.onTogglePlayback,
  });

  final VideoPlayerController controller;
  final bool isPlaying;
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
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: _revealControls,
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
                child: _PlayPauseToggleButton(
                  isPlaying: widget.isPlaying,
                  onPressed: _togglePlayback,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PlayPauseToggleButton extends StatelessWidget {
  const _PlayPauseToggleButton({
    required this.isPlaying,
    required this.onPressed,
  });

  final bool isPlaying;
  final Future<void> Function() onPressed;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.95),
      shape: const CircleBorder(),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () {
          onPressed();
        },
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Icon(
            isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
            size: 36,
            color: Colors.black87,
          ),
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
