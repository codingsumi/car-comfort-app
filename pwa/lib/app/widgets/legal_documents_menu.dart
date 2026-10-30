import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../network/response/legal_page_response.dart';
import '../theme/design_tokens.dart';
import '../utils/extensions/extension.dart';
import '../utils/legal_pages_navigation.dart';
import 'text.dart';

/// One expandable Settings entry containing the role-specific legal pages.
class LegalDocumentsMenu extends StatelessWidget {
  const LegalDocumentsMenu({
    super.key,
    required this.audience,
    required this.fromRoute,
  });

  final LegalAudience audience;
  final String fromRoute;

  static const _customerEntries = <_LegalMenuEntry>[
    _LegalMenuEntry(LegalPageQuery.liabilityWaiver, 'Waiver'),
    _LegalMenuEntry(LegalPageQuery.privacyPolicy, 'Privacy Policy'),
    _LegalMenuEntry(LegalPageQuery.termsConditions, 'Terms & Conditions'),
  ];

  static const _providerEntries = <_LegalMenuEntry>[
    _LegalMenuEntry(LegalPageQuery.contractorLiabilityWaiver, 'Waiver'),
    _LegalMenuEntry(LegalPageQuery.providerNda, 'Service Provider NDA'),
    _LegalMenuEntry(
      LegalPageQuery.independentContractorAgreement,
      'Independent Contractor Agreement',
    ),
    _LegalMenuEntry(LegalPageQuery.privacyPolicy, 'Privacy Policy'),
    _LegalMenuEntry(
      LegalPageQuery.vehicleUserAgreement,
      'Vehicle User Agreement',
    ),
    _LegalMenuEntry(LegalPageQuery.termsConditions, 'Terms & Conditions'),
  ];

  List<_LegalMenuEntry> get _entries =>
      audience == LegalAudience.provider ? _providerEntries : _customerEntries;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: AppSpacing.md - 2),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          key: ValueKey('legal-documents-${audience.value}'),
          tilePadding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: 2,
          ),
          childrenPadding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
          backgroundColor: context.colorScheme.onPrimary,
          collapsedBackgroundColor: context.colorScheme.onPrimary,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: Color(0xffE8E8EF)),
          ),
          collapsedShape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: Color(0xffE8E8EF)),
          ),
          leading: const Icon(
            Icons.folder_copy_outlined,
            color: Color(0xffE70B1C),
            size: 18,
          ),
          title: const CommonText.medium('Legal Documents', size: 15),
          children: [
            for (final entry in _entries)
              _LegalDocumentSubmenuItem(
                entry: entry,
                audience: audience,
                fromRoute: fromRoute,
              ),
          ],
        ),
      ),
    );
  }
}

class _LegalDocumentSubmenuItem extends StatelessWidget {
  const _LegalDocumentSubmenuItem({
    required this.entry,
    required this.audience,
    required this.fromRoute,
  });

  final _LegalMenuEntry entry;
  final LegalAudience audience;
  final String fromRoute;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Divider(
          height: 2,
          color: Colors.grey.shade300,
        ).paddingOnly(left: 34, right: 8),
        ListTile(
          dense: true,
          visualDensity: const VisualDensity(vertical: -1),
          contentPadding: const EdgeInsets.only(left: 34, right: 8),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          leading: Icon(
            LegalPagesNavigation.iconForSlug(entry.slug),
            color: const Color(0xffE70B1C),
            size: 17,
          ),
          title: CommonText.regular(entry.label, size: 14),
          trailing: const Icon(Icons.chevron_right_rounded, size: 17),
          onTap: () => LegalPagesNavigation.openBySlug(
            entry.slug,
            title: entry.label,
            audience: audience,
            fromRoute: fromRoute,
          ),
        ),
      ],
    );
  }
}

class _LegalMenuEntry {
  const _LegalMenuEntry(this.slug, this.label);

  final String slug;
  final String label;
}
