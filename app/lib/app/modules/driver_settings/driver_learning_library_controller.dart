import 'dart:async';

import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../network/repository/auth_repository.dart';
import '../../network/response/tutorial_videos_response.dart';
import '../../utils/app_snackbar.dart';

/// Provider / driver learning library — fetches tutorial videos with
/// [audience: provider] so only provider-specific content is shown.
class DriverLearningLibraryController extends GetxController {
  DriverLearningLibraryController(this._authRepository);

  final AuthRepository _authRepository;

  final isLoading = true.obs;
  final items = <TutorialVideoItem>[].obs;
  final currentPage = 0.obs;
  late final PageController pageController;

  @override
  void onInit() {
    super.onInit();
    pageController = PageController();
    unawaited(loadVideos());
  }

  @override
  void onClose() {
    pageController.dispose();
    super.onClose();
  }

  void onPageChanged(int index) => currentPage.value = index;

  Future<void> loadVideos() async {
    isLoading.value = true;
    final res = await _authRepository.getProviderTutorialVideos();
    res.when(
      success: (data) {
        final loaded = List<TutorialVideoItem>.from(
          data.data?.items ?? const [],
        )..sort((a, b) {
            final order = a.sortOrder.compareTo(b.sortOrder);
            if (order != 0) return order;
            return a.id.compareTo(b.id);
          });
        items.assignAll(loaded);
        if (currentPage.value >= items.length) {
          currentPage.value = 0;
          if (items.isNotEmpty && pageController.hasClients) {
            pageController.jumpToPage(0);
          }
        }
      },
      error: (err) {
        showAppSnackBar(
          title: 'Learning Center',
          message: err.message,
          isError: true,
        );
        items.clear();
      },
    );
    isLoading.value = false;
  }
}
