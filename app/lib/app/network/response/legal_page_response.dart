import '../../utils/pref.dart';

class LegalPageApiResponse {
  LegalPageApiResponse({this.data});

  factory LegalPageApiResponse.fromJson(dynamic json) {
    if (json is! Map<String, dynamic>) {
      return LegalPageApiResponse();
    }
    return LegalPageApiResponse(
      data: json['data'] is Map<String, dynamic>
          ? LegalPageData.fromJson(json['data'] as Map<String, dynamic>)
          : null,
    );
  }

  final LegalPageData? data;
}

class LegalPagesListApiResponse {
  LegalPagesListApiResponse({
    this.audience,
    this.pages = const [],
    this.signupRequired = const [],
    this.signupRequiredSlugs = const [],
  });

  factory LegalPagesListApiResponse.fromJson(dynamic json) {
    if (json is! Map<String, dynamic>) {
      return LegalPagesListApiResponse();
    }

    final payload = json['data'] is Map<String, dynamic>
        ? json['data'] as Map<String, dynamic>
        : json;

    final rawPages = payload['legal_pages'];
    final list = <LegalPageData>[];
    if (rawPages is List) {
      for (final item in rawPages) {
        if (item is Map<String, dynamic>) {
          list.add(LegalPageData.fromJson(item));
        }
      }
    }

    final rawSignup = payload['signup_required'];
    final signupList = <LegalPageData>[];
    if (rawSignup is List) {
      for (final item in rawSignup) {
        if (item is Map<String, dynamic>) {
          signupList.add(LegalPageData.fromJson(item));
        }
      }
    }

    final rawSlugs = payload['signup_required_slugs'];
    final slugList = <String>[];
    if (rawSlugs is List) {
      for (final item in rawSlugs) {
        final s = item?.toString().trim() ?? '';
        if (s.isNotEmpty) slugList.add(s);
      }
    }

    final signupRequired = signupList.isNotEmpty
        ? signupList
        : list.where((p) => p.requiresAgreement).toList();

    return LegalPagesListApiResponse(
      audience: payload['audience']?.toString(),
      pages: list,
      signupRequired: signupRequired,
      signupRequiredSlugs: slugList,
    );
  }

  final String? audience;
  final List<LegalPageData> pages;
  final List<LegalPageData> signupRequired;
  final List<String> signupRequiredSlugs;
}

class LegalPageData {
  LegalPageData({
    this.title,
    this.slug,
    this.content,
    this.supportEmail,
    this.metaTitle,
    this.metaDescription,
    this.pdfUrl,
    this.sortOrder = 100,
    this.requiresAgreement = false,
    this.showInMenu = true,
  });

  factory LegalPageData.fromJson(Map<String, dynamic> json) {
    String? fromDescriptionJson;
    String? supportEmail;
    String? pdfUrl;
    final desc = json['description_json'];
    if (desc is Map<String, dynamic>) {
      fromDescriptionJson = desc['html']?.toString();
      final rawPdf = desc['pdf_url']?.toString().trim();
      if (rawPdf != null && rawPdf.isNotEmpty) pdfUrl = rawPdf;
      final rawMail = desc['support_email']?.toString().trim();
      supportEmail =
          (rawMail != null && rawMail.isNotEmpty) ? rawMail : null;
    }

    final topLevel = json['content']?.toString();
    final merged = _firstNonEmpty([fromDescriptionJson, topLevel]);

    return LegalPageData(
      title: json['title']?.toString(),
      slug: json['slug']?.toString(),
      content: merged,
      supportEmail: supportEmail,
      metaTitle: json['meta_title']?.toString(),
      metaDescription: json['meta_description']?.toString(),
      pdfUrl: pdfUrl,
      sortOrder: _parseInt(json['sort_order'], fallback: 100),
      requiresAgreement: json['requires_agreement'] == true,
      showInMenu: json['show_in_menu'] != false,
    );
  }

  static int _parseInt(dynamic value, {required int fallback}) {
    if (value is int) return value;
    return int.tryParse(value?.toString() ?? '') ?? fallback;
  }

  static String? _firstNonEmpty(List<String?> candidates) {
    for (final s in candidates) {
      final t = s?.trim() ?? '';
      if (t.isNotEmpty) return t;
    }
    return null;
  }

  final String? title;
  final String? slug;

  /// HTML body: prefers `description_json.html`, then top-level `content`.
  final String? content;

  /// From `description_json.support_email` (e.g. support page).
  final String? supportEmail;
  final String? metaTitle;
  final String? metaDescription;

  /// Downloadable blank form PDF (admin: description_json.pdf_url).
  final String? pdfUrl;
  final int sortOrder;
  final bool requiresAgreement;
  final bool showInMenu;
}

/// `page` query values for [API.legalPage].
abstract final class LegalPageQuery {
  static const privacyPolicy = 'privacy-policy';
  static const termsConditions = 'terms-conditions';
  static const support = 'support';
  static const providerNda = 'provider-nda';
  static const independentContractorAgreement = 'independent-contractor-agreement';
  static const contractorLiabilityWaiver = 'contractor-liability-waiver';
  static const vehicleUserAgreement = 'vehicle-user-agreement';
  static const backgroundCheckAuthorization = 'background-check-authorization';
  static const liabilityWaiver = 'liability-waiver';
}

/// Default customer signup documents when the list API is unavailable.
abstract final class CustomerSignupLegalFallback {
  static const slugs = [
    LegalPageQuery.termsConditions,
    LegalPageQuery.privacyPolicy,
    LegalPageQuery.liabilityWaiver,
  ];

  static List<LegalPageData> placeholderPages() {
    const titles = {
      LegalPageQuery.termsConditions: 'Terms & Conditions',
      LegalPageQuery.privacyPolicy: 'Privacy Policy',
      LegalPageQuery.liabilityWaiver: 'Waiver',
    };
    return slugs
        .map(
          (slug) => LegalPageData(
            slug: slug,
            title: titles[slug],
            requiresAgreement: true,
            showInMenu: true,
          ),
        )
        .toList();
  }
}

/// Default provider signup documents when the list API is unavailable.
abstract final class ProviderSignupLegalFallback {
  static const slugs = [
    LegalPageQuery.providerNda,
    LegalPageQuery.independentContractorAgreement,
    LegalPageQuery.privacyPolicy,
    LegalPageQuery.contractorLiabilityWaiver,
    LegalPageQuery.vehicleUserAgreement,
    LegalPageQuery.termsConditions,
  ];

  static List<LegalPageData> placeholderPages() {
    const titles = {
      LegalPageQuery.providerNda: 'Service Provider NDA',
      LegalPageQuery.independentContractorAgreement: 'Independent Contractor Agreement',
      LegalPageQuery.privacyPolicy: 'Privacy Policy',
      LegalPageQuery.contractorLiabilityWaiver: 'Independent Contractor Liability Waiver',
      LegalPageQuery.vehicleUserAgreement: 'Vehicle User Agreement',
      LegalPageQuery.termsConditions: 'Service Provider Terms and Conditions',
    };
    return slugs
        .map(
          (slug) => LegalPageData(
            slug: slug,
            title: titles[slug],
            requiresAgreement: true,
            showInMenu: true,
          ),
        )
        .toList();
  }
}

/// API `audience` query: customer app vs provider (driver) app.
enum LegalAudience {
  customer('customer'),
  provider('provider');

  const LegalAudience(this.value);
  final String value;

  static LegalAudience forCurrentUser() {
    return Prefs().isDriverRole
        ? LegalAudience.provider
        : LegalAudience.customer;
  }
}
