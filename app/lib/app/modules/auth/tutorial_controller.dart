import 'dart:async';

import 'package:get/get.dart';
import 'package:video_player/video_player.dart';

import '../../network/repository/auth_repository.dart';
import '../../network/response/tutorial_videos_response.dart';
import '../../routes/app_pages.dart';
import '../../utils/app_snackbar.dart';
import '../../utils/driver_tutorial_navigation.dart';

class TutorialController extends GetxController {
  TutorialController(this._authRepo);

  final AuthRepository _authRepo;

  static const _providerDefaultInstructions = <String>[
    'How to view and accept jobs on your home map',
    'Taking before and after photos and verifying the customer PIN',
    'Using navigation to reach pickup and drop-off locations',
    'Completing services and tracking your earnings',
    'Staying available to receive new job requests',
  ];

  final isLoading = true.obs;

  final instructions = <String>[].obs;
  final tutorialTitle = 'How Car Comfort Works'.obs;
  final tutorialSubtitle = 'Watch this quick tutorial to get started'.obs;

  String? _remoteVideoUrl;

  VideoPlayerController? _videoPlayer;
  final hasVideoError = false.obs;

  final videoWidgetToken = 0.obs;
  final requiredVideoProgress = 0.0.obs;
  final hasWatchedRequiredVideo = false.obs;
  final isCompletingProviderTutorial = false.obs;
  bool _disposed = false;

  VideoPlayerController? get videoPlayer => _videoPlayer;

  @override
  void onInit() {
    super.onInit();
    loadTutorial();
  }

  @override
  void onClose() {
    _disposed = true;
    unawaited(_stopAndDisposeVideo());
    super.onClose();
  }

  Future<void> _stopAndDisposeVideo() async {
    final player = _videoPlayer;
    _videoPlayer = null;
    if (player == null) return;
    try {
      if (player.value.isInitialized && player.value.isPlaying) {
        await player.pause();
      }
    } catch (_) {}
    try {
      await player.dispose();
    } catch (_) {}
    if (!_disposed) {
      videoWidgetToken.value++;
    }
  }

  Future<void> _disposeVideo() => _stopAndDisposeVideo();

  static const Duration _initTimeout = Duration(seconds: 30);

  Future<void> _initInlineVideo() async {
    await _disposeVideo();
    if (_disposed) return;
    hasVideoError.value = false;

    final raw = _remoteVideoUrl?.trim();
    final uri = raw != null && raw.isNotEmpty ? Uri.tryParse(raw) : null;
    if (uri == null || !uri.hasScheme) {
      if (!_disposed) {
        hasVideoError.value = true;
        videoWidgetToken.value++;
      }
      return;
    }

    try {
      _videoPlayer = VideoPlayerController.networkUrl(uri);
      videoWidgetToken.value++;

      await _videoPlayer!.initialize().timeout(_initTimeout);
      if (_disposed) {
        await _videoPlayer?.dispose();
        _videoPlayer = null;
        return;
      }

      if (_videoPlayer!.value.hasError) {
        await _videoPlayer!.dispose();
        _videoPlayer = null;
        if (!_disposed) {
          hasVideoError.value = true;
          videoWidgetToken.value++;
        }
        return;
      }

      await _videoPlayer!.setLooping(!isProviderOnboarding);
      if (isProviderOnboarding) {
        _videoPlayer!.addListener(_trackRequiredVideoProgress);
      }
      await _videoPlayer!.play();
      if (!_disposed) videoWidgetToken.value++;
    } on TimeoutException {
      await _videoPlayer?.dispose();
      _videoPlayer = null;
      if (!_disposed) {
        hasVideoError.value = true;
        videoWidgetToken.value++;
      }
    } catch (_) {
      await _videoPlayer?.dispose();
      _videoPlayer = null;
      if (!_disposed) {
        hasVideoError.value = true;
        videoWidgetToken.value++;
      }
    }
  }

  bool get isProviderAudience {
    if (isProviderOnboarding) return true;
    final args = Get.arguments;
    if (args is Map && args['audience']?.toString() == 'provider') {
      return true;
    }
    return false;
  }

  Future<void> loadTutorial() async {
    isLoading.value = true;
    if (isProviderOnboarding) {
      requiredVideoProgress.value = 0;
      hasWatchedRequiredVideo.value = false;
    }
    if (isProviderAudience) {
      final res = await _authRepo.getDriverTutorial();
      res.when(
        success: (tutorial) {
          final data = tutorial.data;
          _remoteVideoUrl = data?.videoUrl?.trim();
          tutorialTitle.value = 'How Car Comfort Works for Service Providers';
          tutorialSubtitle.value =
              'Watch this tutorial before you start accepting jobs';
          final items = data?.instructions ?? const <String>[];
          instructions.assignAll(
            items.isEmpty ? _providerDefaultInstructions : items,
          );
        },
        error: (e) {
          showAppSnackBar(
            title: 'Tutorial',
            message: e.errorMessage,
            isError: true,
          );
          _remoteVideoUrl = null;
          tutorialTitle.value = 'How Car Comfort Works for Service Providers';
          tutorialSubtitle.value =
              'Watch this tutorial before you start accepting jobs';
          instructions.assignAll(_providerDefaultInstructions);
        },
      );
    } else {
      final res = await _authRepo.getCustomerTutorialVideos();
      res.when(
        success: (response) {
          final items = List<TutorialVideoItem>.from(
            response.data?.items ?? const [],
          )..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
          final item = items.isNotEmpty ? items.first : null;
          _remoteVideoUrl = item?.videoUrl?.trim();
          tutorialTitle.value = item?.title?.trim().isNotEmpty == true
              ? item!.title.trim()
              : 'How Car Comfort Works';
          tutorialSubtitle.value = item?.description?.trim().isNotEmpty == true
              ? item!.description!.trim()
              : 'Watch this quick tutorial to get started';
          instructions.assignAll(item?.instructions ?? const <String>[]);
        },
        error: (e) {
          showAppSnackBar(
            title: 'Tutorial',
            message: e.errorMessage,
            isError: true,
          );
          _remoteVideoUrl = null;
          instructions.clear();
        },
      );
    }
    isLoading.value = false;
    await _initInlineVideo();
  }

  Future<void> toggleInlinePlayback() async {
    final v = _videoPlayer;
    if (v == null || !v.value.isInitialized || _disposed) return;
    if (v.value.isPlaying) {
      await v.pause();
    } else {
      await v.play();
    }
  }

  bool get isEmbeddedInApp {
    final args = Get.arguments;
    if (args is! Map) return false;
    final from = args['from']?.toString().trim() ?? '';
    return from.isNotEmpty;
  }

  bool get isProviderOnboarding =>
      DriverTutorialNavigation.isProviderOnboardingFlow;

  void _trackRequiredVideoProgress() {
    if (!isProviderOnboarding || _disposed) return;
    final player = _videoPlayer;
    if (player == null || !player.value.isInitialized) return;
    final durationMs = player.value.duration.inMilliseconds;
    if (durationMs <= 0) return;
    final positionMs = player.value.position.inMilliseconds.clamp(
      0,
      durationMs,
    );
    requiredVideoProgress.value = (positionMs / durationMs).clamp(0.0, 1.0);
    if (positionMs >= durationMs - 500) {
      requiredVideoProgress.value = 1;
      hasWatchedRequiredVideo.value = true;
    }
  }

  void retryTutorial() {
    if (isLoading.value || isCompletingProviderTutorial.value) return;
    unawaited(loadTutorial());
  }

  void exitTutorial() {
    unawaited(_exitTutorial());
  }

  Future<void> _exitTutorial() async {
    if (isProviderOnboarding && !hasWatchedRequiredVideo.value) {
      showAppSnackBar(
        title: 'Tutorial required',
        message: 'Please watch the complete tutorial before continuing.',
        isError: true,
      );
      return;
    }
    if (isProviderOnboarding) {
      await _persistTutorialCompletionAndContinue();
      return;
    }
    await _leaveTutorialScreen();
    if (isEmbeddedInApp) {
      Get.back();
      return;
    }
    Get.offAllNamed(Routes.CAMERA_ACCESS);
  }

  void completeProviderOnboardingTutorial() {
    unawaited(_persistTutorialCompletionAndContinue());
  }

  Future<void> _leaveTutorialScreen() async {
    _disposed = true;
    await _stopAndDisposeVideo();
  }

  Future<void> _persistTutorialCompletionAndContinue() async {
    if (!hasWatchedRequiredVideo.value) {
      showAppSnackBar(
        title: 'Tutorial required',
        message: 'Please watch the complete tutorial before continuing.',
        isError: true,
      );
      return;
    }
    if (isCompletingProviderTutorial.value) return;
    isCompletingProviderTutorial.value = true;

    final res = await _authRepo.completeDriverTutorial();
    var completed = false;
    res.when(
      success: (_) {
        DriverTutorialNavigation.markCompleted();
        completed = true;
      },
      error: (error) {
        showAppSnackBar(
          title: 'Tutorial completion failed',
          message: error.message,
          isError: true,
        );
      },
    );
    isCompletingProviderTutorial.value = false;
    if (!completed) return;

    await _leaveTutorialScreen();
    Get.offAllNamed(DriverTutorialNavigation.providerNextRoute());
  }

  void continueToApp() => exitTutorial();
}
