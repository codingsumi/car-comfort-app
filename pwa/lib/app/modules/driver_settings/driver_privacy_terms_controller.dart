import 'dart:async';

import 'package:get/get.dart';

import '../../network/repository/legal_repository.dart';
import '../../network/response/legal_page_response.dart';
import '../../services/legal_pages_cache_service.dart';
import '../../utils/legal_pages_navigation.dart';

class DriverPrivacyTermsController extends GetxController {
  DriverPrivacyTermsController() : _repo = Get.find<LegalRepository>();

  final LegalRepository _repo;
  static const _audience = LegalAudience.provider;

  final isLoading = false.obs;
  final errorMessage = RxnString();

  final termsSectionTitle = 'Terms & Conditions'.obs;
  final privacySectionTitle = 'Privacy Policy'.obs;
  final termsHtml = ''.obs;
  final privacyHtml = ''.obs;

  @override
  void onInit() {
    super.onInit();
    final cache = Get.find<LegalPagesCacheService>();
    if (_applyFromCache(cache)) {
      return;
    }
    isLoading.value = true;
    unawaited(_hydrateFromCacheOrNetwork());
  }

  Future<void> _hydrateFromCacheOrNetwork() async {
    final cache = Get.find<LegalPagesCacheService>();
    await cache.ensurePrefetched(audience: _audience);
    if (_applyFromCache(cache)) {
      isLoading.value = false;
      return;
    }
    await fetchBoth();
  }

  bool _applyFromCache(LegalPagesCacheService cache) {
    var any = false;
    final td = cache.dataForPage(
      LegalPageQuery.termsConditions,
      audience: _audience,
    );
    if (td != null) {
      final h = (td.content ?? '').trim();
      if (h.isNotEmpty) {
        termsHtml.value = h;
        termsSectionTitle.value = td.displayTitle;
        any = true;
      }
    }
    final pd = cache.dataForPage(
      LegalPageQuery.privacyPolicy,
      audience: _audience,
    );
    if (pd != null) {
      final h = (pd.content ?? '').trim();
      if (h.isNotEmpty) {
        privacyHtml.value = h;
        privacySectionTitle.value = pd.displayTitle;
        any = true;
      }
    }
    if (!any) return false;
    _reconcileErrors();
    return true;
  }

  void _reconcileErrors() {
    if (termsHtml.value.isEmpty && privacyHtml.value.isEmpty) {
      errorMessage.value =
          'No content is available for these pages right now.';
    } else {
      errorMessage.value = null;
    }
  }

  /// Pull-to-refresh: network load for both sections.
  Future<void> fetchBoth() async {
    isLoading.value = true;
    errorMessage.value = null;

    final termsRes = await _repo.getLegalPage(
      page: LegalPageQuery.termsConditions,
      audience: _audience,
    );
    final privacyRes = await _repo.getLegalPage(
      page: LegalPageQuery.privacyPolicy,
      audience: _audience,
    );

    var termsErr = '';
    var privacyErr = '';

    final cache = Get.find<LegalPagesCacheService>();

    termsRes.when(
      success: (LegalPageApiResponse r) {
        final d = r.data;
        cache.storePageData(
          pageQuery: LegalPageQuery.termsConditions,
          audience: _audience,
          data: d,
        );
        termsHtml.value = (d?.content ?? '').trim();
        if (d != null) termsSectionTitle.value = d.displayTitle;
      },
      error: (e) {
        termsErr = e.errorMessage;
        termsHtml.value = '';
      },
    );

    privacyRes.when(
      success: (LegalPageApiResponse r) {
        final d = r.data;
        cache.storePageData(
          pageQuery: LegalPageQuery.privacyPolicy,
          audience: _audience,
          data: d,
        );
        privacyHtml.value = (d?.content ?? '').trim();
        if (d != null) privacySectionTitle.value = d.displayTitle;
      },
      error: (e) {
        privacyErr = e.errorMessage;
        privacyHtml.value = '';
      },
    );

    if (termsHtml.value.isEmpty && privacyHtml.value.isEmpty) {
      if (termsErr.isNotEmpty && privacyErr.isNotEmpty) {
        errorMessage.value = termsErr;
      } else if (termsErr.isNotEmpty) {
        errorMessage.value = termsErr;
      } else if (privacyErr.isNotEmpty) {
        errorMessage.value = privacyErr;
      } else {
        errorMessage.value =
            'No content is available for these pages right now.';
      }
    } else {
      errorMessage.value = null;
    }

    isLoading.value = false;
  }
}
