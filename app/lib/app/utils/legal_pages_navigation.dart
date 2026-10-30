import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../network/response/legal_page_response.dart';
import '../routes/app_pages.dart';
import '../services/legal_pages_cache_service.dart';

/// Opens a CMS legal page or the support flow based on [slug].
class LegalPagesNavigation {
  LegalPagesNavigation._();

  static IconData iconForSlug(String? slug) {
    switch (slug?.trim().toLowerCase()) {
      case LegalPageQuery.privacyPolicy:
        return Icons.description_outlined;
      case LegalPageQuery.termsConditions:
        return Icons.article_outlined;
      case LegalPageQuery.liabilityWaiver:
        return Icons.gavel_outlined;
      case LegalPageQuery.support:
        return Icons.headset_mic_outlined;
      default:
        return Icons.article_outlined;
    }
  }

  static void open(
    LegalPageData page, {
    String? fromRoute,
    LegalAudience? audience,
    String? signupConsentSlug,
  }) {
    final slug = page.slug?.trim() ?? '';
    if (slug.isEmpty) return;

    if (slug == LegalPageQuery.support) {
      Get.toNamed(
        Routes.NEED_HELP,
        arguments: {'from': fromRoute ?? Get.currentRoute},
      );
      return;
    }

    Get.toNamed(
      Routes.LEGAL_DOCUMENT,
      arguments: {
        'slug': slug,
        'title': page.displayTitle,
        if (audience != null) 'audience': audience.value,
        if (signupConsentSlug != null && signupConsentSlug.isNotEmpty)
          'signupConsentSlug': signupConsentSlug,
      },
    );
  }

  static void openBySlug(
    String slug, {
    String? title,
    LegalAudience? audience,
    String? fromRoute,
  }) {
    final normalized = slug.trim();
    if (normalized.isEmpty) return;

    final cache = Get.find<LegalPagesCacheService>();
    final resolved = cache.dataForSlug(normalized, audience: audience);
    if (resolved != null) {
      open(resolved, fromRoute: fromRoute, audience: audience);
      return;
    }

    if (normalized == LegalPageQuery.support) {
      Get.toNamed(
        Routes.NEED_HELP,
        arguments: {'from': fromRoute ?? Get.currentRoute},
      );
      return;
    }

    Get.toNamed(
      Routes.LEGAL_DOCUMENT,
      arguments: {
        'slug': normalized,
        'title': title ?? _defaultTitleForSlug(normalized),
        if (audience != null) 'audience': audience.value,
      },
    );
  }

  static String appTitleForSlug(String? slug) {
    switch (slug?.trim().toLowerCase()) {
      case LegalPageQuery.privacyPolicy:
        return 'Privacy Policy';
      case LegalPageQuery.termsConditions:
        return 'Terms & Conditions';
      case LegalPageQuery.liabilityWaiver:
        return 'Waiver';
      case LegalPageQuery.support:
        return 'Support';
      default:
        return '';
    }
  }

  static String _defaultTitleForSlug(String slug) {
    return appTitleForSlug(slug).isNotEmpty
        ? appTitleForSlug(slug)
        : 'Legal';
  }

  /// User-facing label: same names for customer and provider apps.
  static String sanitizeCmsTitle(String? raw, {String? slug}) {
    final fromSlug = appTitleForSlug(slug);
    if (fromSlug.isNotEmpty) return fromSlug;

    var text = (raw ?? '').trim();
    if (text.isEmpty) return slug?.trim() ?? 'Legal';

    final pipe = text.indexOf('|');
    if (pipe > 0) {
      text = text.substring(0, pipe).trim();
    }

    final providerPrefix = RegExp(r'^provider\s+', caseSensitive: false);
    text = text.replaceFirst(providerPrefix, '').trim();

    return text.isEmpty ? (slug?.trim() ?? 'Legal') : text;
  }
}

extension LegalPageDataDisplay on LegalPageData {
  String get displayTitle {
    return LegalPagesNavigation.sanitizeCmsTitle(
      title ?? metaTitle,
      slug: slug,
    );
  }
}
