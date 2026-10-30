import 'package:get/get.dart';

import '../../network/repository/legal_repository.dart';
import '../../network/response/legal_page_response.dart';
import 'legal_page_controller.dart';

void _registerLegalRepository() {
  if (!Get.isRegistered<LegalRepository>()) {
    Get.lazyPut<LegalRepository>(() => LegalRepository(), fenix: true);
  }
}

LegalAudience? _audienceFromArguments() {
  final args = Get.arguments;
  if (args is! Map) return null;
  final raw = args['audience']?.toString().trim().toLowerCase();
  if (raw == LegalAudience.provider.value) return LegalAudience.provider;
  if (raw == LegalAudience.customer.value) return LegalAudience.customer;
  return null;
}

class LegalDocumentBinding extends Bindings {
  @override
  void dependencies() {
    _registerLegalRepository();
    final args = Get.arguments;
    final slug = args is Map ? args['slug']?.toString().trim() ?? '' : '';
    final title = args is Map ? args['title']?.toString() ?? 'Legal' : 'Legal';
    Get.lazyPut<LegalPageController>(
      () => LegalPageController(
        pageQuery: slug.isNotEmpty ? slug : LegalPageQuery.privacyPolicy,
        fallbackTitle: title,
        audience: _audienceFromArguments(),
      ),
    );
  }
}

class PrivacyPolicyLegalBinding extends Bindings {
  @override
  void dependencies() {
    _registerLegalRepository();
    Get.lazyPut<LegalPageController>(
      () => LegalPageController(
        pageQuery: LegalPageQuery.privacyPolicy,
        fallbackTitle: 'Privacy Policy',
        audience: LegalAudience.customer,
      ),
    );
  }
}

class TermsConditionsLegalBinding extends Bindings {
  @override
  void dependencies() {
    _registerLegalRepository();
    Get.lazyPut<LegalPageController>(
      () => LegalPageController(
        pageQuery: LegalPageQuery.termsConditions,
        fallbackTitle: 'Terms & Conditions',
        audience: LegalAudience.customer,
      ),
    );
  }
}
