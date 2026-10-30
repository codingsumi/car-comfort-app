import 'dart:async';

import 'package:get/get.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../network/repository/legal_repository.dart';
import '../../network/response/legal_page_response.dart';
import '../../services/legal_pages_cache_service.dart';
import '../../utils/app_snackbar.dart';
import '../../utils/legal_pages_navigation.dart';

class NeedHelpController extends GetxController {
  NeedHelpController({LegalAudience? audience})
      : _repo = Get.find<LegalRepository>(),
        audience = audience ?? LegalAudience.forCurrentUser();

  final LegalRepository _repo;
  final LegalAudience audience;

  final isLoading = false.obs;
  final errorMessage = RxnString();
  final htmlContent = ''.obs;
  final supportEmail = RxnString();
  final screenTitle = 'Support'.obs;

  @override
  void onInit() {
    super.onInit();
    unawaited(_hydrate());
  }

  Future<void> _hydrate() async {
    final cache = Get.find<LegalPagesCacheService>();
    if (_applyFromData(cache.dataForSlug(LegalPageQuery.support, audience: audience))) {
      return;
    }

    isLoading.value = true;
    errorMessage.value = null;
    await cache.ensurePrefetched(audience: audience);
    if (_applyFromData(cache.dataForSlug(LegalPageQuery.support, audience: audience))) {
      isLoading.value = false;
      return;
    }

    final res = await _repo.getLegalPage(
      page: LegalPageQuery.support,
      audience: audience,
    );
    res.when(
      success: (LegalPageApiResponse r) {
        final d = r.data;
        cache.storePageData(
          pageQuery: LegalPageQuery.support,
          audience: audience,
          data: d,
        );
        if (!_applyFromData(d)) {
          errorMessage.value =
              'No content is available for this page right now.';
        }
      },
      error: (e) {
        errorMessage.value = e.errorMessage;
        htmlContent.value = '';
      },
    );
    isLoading.value = false;
  }

  bool _applyFromData(LegalPageData? data) {
    if (data == null) return false;

    final html = (data.content ?? '').trim();
    final email = data.supportEmail?.trim() ?? '';
    if (email.isNotEmpty) {
      supportEmail.value = email;
    } else {
      supportEmail.value = null;
    }

    screenTitle.value = data.displayTitle;

    htmlContent.value = html;
    if (html.isEmpty && email.isEmpty) return false;
    errorMessage.value = null;
    return true;
  }

  Future<void> refreshFromNetwork() async {
    isLoading.value = true;
    errorMessage.value = null;
    final cache = Get.find<LegalPagesCacheService>();
    final res = await _repo.getLegalPage(
      page: LegalPageQuery.support,
      audience: audience,
    );
    res.when(
      success: (LegalPageApiResponse r) {
        final d = r.data;
        cache.storePageData(
          pageQuery: LegalPageQuery.support,
          audience: audience,
          data: d,
        );
        if (!_applyFromData(d)) {
          errorMessage.value =
              'No content is available for this page right now.';
        }
      },
      error: (e) {
        errorMessage.value = e.errorMessage;
        htmlContent.value = '';
      },
    );
    isLoading.value = false;
  }

  Future<void> openSupportEmail() async {
    final raw = supportEmail.value?.trim() ?? '';
    if (raw.isEmpty) {
      showAppSnackBar(
        title: 'Support',
        message: 'Support email is not available.',
        isError: true,
      );
      return;
    }
    final uri = Uri.parse('mailto:$raw');
    try {
      final ok = await launchUrl(
        uri,
        mode: LaunchMode.externalApplication,
      );
      if (!ok) {
        showAppSnackBar(
          title: 'Support',
          message: 'Could not open your email app.',
          isError: true,
        );
      }
    } catch (_) {
      showAppSnackBar(
        title: 'Support',
        message: 'Could not open your email app.',
        isError: true,
      );
    }
  }
}
