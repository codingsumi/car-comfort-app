import 'dart:async';

import 'package:get/get.dart';
import 'package:video_player/video_player.dart';

import '../../network/repository/auth_repository.dart';
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

  String? _remoteVideoUrl;

  VideoPlayerController? _videoPlayer;
  final hasVideoError = false.obs;

  final videoWidgetToken = 0.obs;
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

      await _videoPlayer!.setLooping(true);
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
    final res = isProviderAudience
        ? await _authRepo.getDriverTutorial()
        : await _authRepo.getTutorial();
    res.when(
      success: (tutorial) {
        final data = tutorial.data;
        final url = data?.videoUrl;
        _remoteVideoUrl = (url != null && url.isNotEmpty) ? url : null;
        final items = data?.instructions ?? const <String>[];
        if (isProviderAudience && items.isEmpty) {
          instructions.assignAll(_providerDefaultInstructions);
        } else {
          instructions.assignAll(items);
        }
      },
      error: (e) {
        showAppSnackBar(
          title: 'Tutorial',
          message: e.errorMessage,
          isError: true,
        );
        _remoteVideoUrl = null;
        if (isProviderAudience) {
          instructions.assignAll(_providerDefaultInstructions);
        } else {
          instructions.clear();
        }
      },
    );
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

  bool get isProviderOnboarding => DriverTutorialNavigation.isProviderOnboardingFlow;

  void exitTutorial() {
    unawaited(_exitTutorial());
  }

  Future<void> _exitTutorial() async {
    await _leaveTutorialScreen();
    if (isEmbeddedInApp) {
      Get.back();
      return;
    }
    if (isProviderOnboarding) {
      await _persistTutorialCompletionAndContinue();
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
    await _leaveTutorialScreen();
    final res = await _authRepo.completeDriverTutorial();
    res.when(
      success: (_) => DriverTutorialNavigation.markCompleted(),
      error: (_) {
        // Still allow onboarding to continue if the API call fails.
        DriverTutorialNavigation.markCompleted();
      },
    );
    Get.offAllNamed(DriverTutorialNavigation.providerNextRoute());
  }

  void continueToApp() => exitTutorial();
}
