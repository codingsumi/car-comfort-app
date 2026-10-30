import 'dart:async';

import 'package:get/get.dart';

import '../../network/repository/legal_repository.dart';
import '../../network/response/legal_page_response.dart';
import '../../services/legal_pages_cache_service.dart';
import '../../utils/legal_pages_navigation.dart';

class LegalPageController extends GetxController {
  LegalPageController({
    required this.pageQuery,
    required this.fallbackTitle,
    LegalAudience? audience,
  }) : audience = audience ?? LegalAudience.forCurrentUser();

  final LegalRepository _repo = Get.find<LegalRepository>();
  final String pageQuery;
  final String fallbackTitle;
  final LegalAudience audience;

  final isLoading = false.obs;
  final errorMessage = RxnString();
  final htmlContent = ''.obs;
  final screenTitle = ''.obs;

  @override
  void onInit() {
    super.onInit();
    screenTitle.value = fallbackTitle;
    final cache = Get.find<LegalPagesCacheService>();
    if (_applyFromData(cache.dataForSlug(pageQuery, audience: audience))) {
      return;
    }
    isLoading.value = true;
    unawaited(_hydrateFromCacheOrNetwork());
  }

  Future<void> _hydrateFromCacheOrNetwork() async {
    final cache = Get.find<LegalPagesCacheService>();
    await cache.ensurePrefetched(audience: audience);
    if (!_applyFromData(cache.dataForSlug(pageQuery, audience: audience))) {
      isLoading.value = false;
      return;
    }
    await fetch();
  }

  bool _applyFromData(LegalPageData? data) {
    if (data == null) return false;
    final html = (data.content ?? '').trim();
    if (html.isEmpty) return false;
    htmlContent.value = html;
    screenTitle.value = data.displayTitle;
    errorMessage.value = null;
    return true;
  }

  /// Pull-to-refresh: reload list then apply current slug.
  Future<void> fetch() async {
    isLoading.value = true;
    errorMessage.value = null;
    final cache = Get.find<LegalPagesCacheService>();
    cache.resetPrefetch();
    await cache.ensurePrefetched(audience: audience);
    if (_applyFromData(cache.dataForSlug(pageQuery, audience: audience))) {
      isLoading.value = false;
      return;
    }

    final res = await _repo.getLegalPage(page: pageQuery, audience: audience);
    res.when(
      success: (LegalPageApiResponse response) {
        final data = response.data;
        if (data != null) {
          Get.find<LegalPagesCacheService>().storePageData(
            pageQuery: pageQuery,
            audience: audience,
            data: data,
          );
        }
        if (!_applyFromData(data)) {
          htmlContent.value = '';
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
}
