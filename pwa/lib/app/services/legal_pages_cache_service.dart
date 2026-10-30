import 'package:get/get.dart';

import '../network/repository/legal_repository.dart';
import '../network/response/legal_page_response.dart';

/// Caches all legal pages from [GET /api/legal-pages] per audience.
class LegalPagesCacheService extends GetxService {
  final Map<String, List<LegalPageData>> _pagesByAudience = {};
  final Map<String, List<LegalPageData>> _signupRequiredByAudience = {};
  final RxList<LegalPageData> menuPages = <LegalPageData>[].obs;
  final RxList<LegalPageData> signupRequiredPages = <LegalPageData>[].obs;

  String? _lastPrefetchedAudience;
  Future<void>? _prefetchOnce;

  LegalRepository get _repo => Get.find<LegalRepository>();

  @override
  void onInit() {
    super.onInit();
    if (!Get.isRegistered<LegalRepository>()) {
      Get.lazyPut<LegalRepository>(() => LegalRepository(), fenix: true);
    }
  }

  List<LegalPageData> pagesFor({LegalAudience? audience}) {
    final key = (audience ?? LegalAudience.forCurrentUser()).value;
    return List<LegalPageData>.from(_pagesByAudience[key] ?? const []);
  }

  List<LegalPageData> signupRequiredFor({LegalAudience? audience}) {
    final key = (audience ?? LegalAudience.forCurrentUser()).value;
    final cached = _signupRequiredByAudience[key];
    if (cached != null && cached.isNotEmpty) {
      return List<LegalPageData>.from(cached);
    }
    return pagesFor(audience: audience)
        .where((p) => p.requiresAgreement)
        .toList();
  }

  void _syncMenuObservable(LegalAudience audience) {
    menuPages.assignAll(pagesFor(audience: audience));
  }

  LegalPageData? dataForSlug(String slug, {LegalAudience? audience}) {
    final normalized = slug.trim().toLowerCase();
    if (normalized.isEmpty) return null;
    for (final page in pagesFor(audience: audience)) {
      if ((page.slug ?? '').trim().toLowerCase() == normalized) {
        return page;
      }
    }
    return null;
  }

  /// Backward-compatible lookup by slug (e.g. `privacy-policy`).
  LegalPageData? dataForPage(String pageQuery, {LegalAudience? audience}) {
    return dataForSlug(pageQuery, audience: audience);
  }

  void storePageData({
    required String pageQuery,
    required LegalAudience audience,
    LegalPageData? data,
  }) {
    if (data == null) return;
    final key = audience.value;
    final list = List<LegalPageData>.from(_pagesByAudience[key] ?? const []);
    final slug = pageQuery.trim().toLowerCase();
    final idx = list.indexWhere(
      (p) => (p.slug ?? '').trim().toLowerCase() == slug,
    );
    if (idx >= 0) {
      list[idx] = data;
    } else {
      list.add(data);
    }
    _pagesByAudience[key] = list;
    if (_lastPrefetchedAudience == key) {
      _syncMenuObservable(audience);
    }
  }

  /// Loads all pages for the active audience (single API call).
  Future<void> ensurePrefetched({LegalAudience? audience}) {
    final target = audience ?? LegalAudience.forCurrentUser();
    if (_lastPrefetchedAudience != target.value) {
      _prefetchOnce = null;
    }
    _lastPrefetchedAudience = target.value;
    _prefetchOnce ??= _loadAll(target);
    return _prefetchOnce!;
  }

  void resetPrefetch() {
    _prefetchOnce = null;
    _lastPrefetchedAudience = null;
    menuPages.clear();
    signupRequiredPages.clear();
    _pagesByAudience.clear();
    _signupRequiredByAudience.clear();
  }

  Future<void> _loadAll(LegalAudience audience) async {
    final res = await _repo.getLegalPages(audience: audience);
    res.when(
      success: (LegalPagesListApiResponse response) {
        _pagesByAudience[audience.value] = List<LegalPageData>.from(
          response.pages,
        );
        _signupRequiredByAudience[audience.value] = List<LegalPageData>.from(
          response.signupRequired,
        );
        _syncMenuObservable(audience);
        if (_lastPrefetchedAudience == audience.value) {
          signupRequiredPages.assignAll(
            _signupRequiredByAudience[audience.value] ?? const [],
          );
        }
      },
      error: (_) async {
        await _loadAllLegacy(audience);
      },
    );
  }

  /// Fallback if list endpoint is unavailable (older API).
  Future<void> _loadAllLegacy(LegalAudience audience) async {
    final slugs = audience == LegalAudience.provider
        ? [
            LegalPageQuery.privacyPolicy,
            LegalPageQuery.termsConditions,
            LegalPageQuery.support,
          ]
        : [
            LegalPageQuery.termsConditions,
            LegalPageQuery.privacyPolicy,
            LegalPageQuery.liabilityWaiver,
            LegalPageQuery.support,
          ];
    final list = <LegalPageData>[];
    for (final slug in slugs) {
      final res = await _repo.getLegalPage(page: slug, audience: audience);
      res.when(
        success: (r) {
          if (r.data != null) list.add(r.data!);
        },
        error: (_) {},
      );
    }
    _pagesByAudience[audience.value] = list;
    _signupRequiredByAudience[audience.value] =
        list.where((p) => p.requiresAgreement).toList();
    _syncMenuObservable(audience);
    if (_lastPrefetchedAudience == audience.value) {
      signupRequiredPages.assignAll(
        _signupRequiredByAudience[audience.value] ?? const [],
      );
    }
  }
}
