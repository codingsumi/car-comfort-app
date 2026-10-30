import 'package:get/get.dart';

import '../../network/repository/legal_repository.dart';
import '../../network/response/legal_page_response.dart';
import '../../utils/legal_pages_navigation.dart';
import 'legal_page_controller.dart';

void _registerLegalRepository() {
  if (!Get.isRegistered<LegalRepository>()) {
    Get.lazyPut<LegalRepository>(() => LegalRepository(), fenix: true);
  }
}

LegalAudience? _audienceFromArguments() {
  final args = LegalPagesNavigation.currentDocumentRouteData();
  final raw = args['audience']?.toString().trim().toLowerCase();
  if (raw == LegalAudience.provider.value) return LegalAudience.provider;
  if (raw == LegalAudience.customer.value) return LegalAudience.customer;
  return null;
}

class LegalDocumentBinding extends Bindings {
  static String controllerTagForSlug(String slug) {
    final normalized = slug.trim().toLowerCase();
    final resolvedSlug = normalized.isEmpty
        ? LegalPageQuery.privacyPolicy
        : normalized;
    return 'legal-document:$resolvedSlug';
  }

  static String controllerTagForArguments() {
    final args = LegalPagesNavigation.currentDocumentRouteData();
    final slug = args['slug']?.toString() ?? '';
    return controllerTagForSlug(slug);
  }

  @override
  void dependencies() {
    _registerLegalRepository();
    final args = LegalPagesNavigation.currentDocumentRouteData();
    final slug = args['slug']?.toString().trim() ?? '';
    final pageQuery = slug.isEmpty ? LegalPageQuery.privacyPolicy : slug;
    final routeTitle = args['title']?.toString().trim() ?? '';
    final slugTitle = LegalPagesNavigation.appTitleForSlug(pageQuery);
    final title = routeTitle.isNotEmpty
        ? routeTitle
        : slugTitle.isNotEmpty
        ? slugTitle
        : 'Legal';
    Get.lazyPut<LegalPageController>(
      () => LegalPageController(
        pageQuery: pageQuery,
        fallbackTitle: title,
        audience: _audienceFromArguments(),
      ),
      tag: controllerTagForSlug(pageQuery),
    );
  }
}

class PrivacyPolicyLegalBinding extends Bindings {
  static const controllerTag = 'privacy-policy';

  @override
  void dependencies() {
    _registerLegalRepository();
    Get.lazyPut<LegalPageController>(
      () => LegalPageController(
        pageQuery: LegalPageQuery.privacyPolicy,
        fallbackTitle: 'Privacy Policy',
        audience: LegalAudience.customer,
      ),
      tag: controllerTag,
    );
  }
}

class TermsConditionsLegalBinding extends Bindings {
  static const controllerTag = 'terms-conditions';

  @override
  void dependencies() {
    _registerLegalRepository();
    Get.lazyPut<LegalPageController>(
      () => LegalPageController(
        pageQuery: LegalPageQuery.termsConditions,
        fallbackTitle: 'Terms & Conditions',
        audience: LegalAudience.customer,
      ),
      tag: controllerTag,
    );
  }
}
