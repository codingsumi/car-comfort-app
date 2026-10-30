import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../network/response/legal_page_response.dart';
import '../routes/app_pages.dart';
import '../services/legal_pages_cache_service.dart';
import 'web_navigation.dart';

/// Opens a CMS legal page or the support flow based on [slug].
class LegalPagesNavigation {
  LegalPagesNavigation._();

  static const _allowedReturnRoutes = <String>{
    Routes.LOGIN,
    Routes.REGISTER,
    Routes.DRIVERREGISTER,
    Routes.SETTINGS,
    Routes.DRIVER_PROFILE_SETTINGS,
  };

  /// Returns the route data for the active legal document on both Navigator
  /// 1 (mobile) and GetX Router 2 (web/PWA).
  static Map<String, dynamic> currentDocumentRouteData() {
    final data = <String, dynamic>{};

    if (kIsWeb) {
      // Preserve route data across direct PWA links and browser refreshes.
      data.addAll(Uri.base.queryParameters);

      // Router 2 owns the active route on web. Get.arguments/Get.parameters
      // belong to Router 1 and can therefore be empty or stale in the PWA.
      data.addAll(Get.rootDelegate.parameters);
      try {
        final delegateArguments = Get.rootDelegate.arguments<dynamic>();
        if (delegateArguments is Map) {
          for (final entry in delegateArguments.entries) {
            data[entry.key.toString()] = entry.value;
          }
        }
      } catch (_) {
        // No active delegate route during early startup.
      }
      return data;
    }

    data.addAll(Get.parameters);
    final arguments = Get.arguments;
    if (arguments is Map) {
      for (final entry in arguments.entries) {
        data[entry.key.toString()] = entry.value;
      }
    }
    return data;
  }

  static String _documentRoute(Map<String, dynamic> arguments) {
    if (!kIsWeb) return Routes.LEGAL_DOCUMENT;
    return Uri(
      path: Routes.LEGAL_DOCUMENT,
      queryParameters: {
        for (final entry in arguments.entries)
          if (entry.key != 'title' && entry.value != null)
            entry.key: entry.value.toString(),
      },
    ).toString();
  }

  /// Returns from a legal document without sending PWA signup users to their
  /// dashboard. Router 2 can pop normal in-app navigation; [from] is retained
  /// as a safe fallback for restored/direct PWA routes with no stack to pop.
  static void backFromDocument() {
    if (!kIsWeb) {
      Get.back();
      return;
    }
    unawaited(_backFromWebDocument());
  }

  static Future<void> _backFromWebDocument() async {
    if (await Get.rootDelegate.popRoute()) return;

    final from = currentDocumentRouteData()['from']?.toString().trim() ?? '';
    if (_allowedReturnRoutes.contains(from)) {
      offAllNamed(from);
      return;
    }
    goBackToHome();
  }

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
      toNamed(
        Routes.NEED_HELP,
        arguments: {'from': fromRoute ?? Get.currentRoute},
      );
      return;
    }
    final arguments = <String, dynamic>{
      'slug': slug,
      'title': page.displayTitle,
      if (fromRoute != null && fromRoute.trim().isNotEmpty)
        'from': fromRoute.trim(),
      if (audience != null) 'audience': audience.value,
      if (signupConsentSlug != null && signupConsentSlug.isNotEmpty)
        'signupConsentSlug': signupConsentSlug,
    };
    toNamed(_documentRoute(arguments), arguments: arguments);
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
      toNamed(
        Routes.NEED_HELP,
        arguments: {'from': fromRoute ?? Get.currentRoute},
      );
      return;
    }

    final arguments = <String, dynamic>{
      'slug': normalized,
      'title': title ?? _defaultTitleForSlug(normalized),
      if (fromRoute != null && fromRoute.trim().isNotEmpty)
        'from': fromRoute.trim(),
      if (audience != null) 'audience': audience.value,
    };
    toNamed(_documentRoute(arguments), arguments: arguments);
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
    return appTitleForSlug(slug).isNotEmpty ? appTitleForSlug(slug) : 'Legal';
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
