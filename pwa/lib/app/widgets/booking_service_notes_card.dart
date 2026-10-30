import 'package:flutter/material.dart';

import '../constants/booking_service_notes.dart';
import '../network/response/booking_detail_response.dart';
import '../utils/ev_account_card_on_file.dart';
import 'text.dart';

class BookingServiceNotesCard extends StatelessWidget {
  const BookingServiceNotesCard({
    super.key,
    required this.structuredRows,
    this.additionalNotes,
    this.boxShadow,
  });

  factory BookingServiceNotesCard.fromDetail(
    BookingDetailData? detail, {
    List<BoxShadow>? boxShadow,
  }) {
    final rows = structuredServiceNoteRowsFromDetail(detail);
    return BookingServiceNotesCard(
      structuredRows: rows,
      additionalNotes: sanitizeEvAccountCardOnFileNotes(detail?.notes),
      boxShadow: boxShadow,
    );
  }

  final List<({String question, String answer})> structuredRows;
  final String? additionalNotes;
  final List<BoxShadow>? boxShadow;

  bool get hasContent {
    if (structuredRows.isNotEmpty) return true;
    return (additionalNotes ?? '').trim().isNotEmpty;
  }

  @override
  Widget build(BuildContext context) {
    final sections = <Widget>[];
    for (var i = 0; i < structuredRows.length; i++) {
      final row = structuredRows[i];
      if (i > 0) sections.add(const SizedBox(height: 14));
      sections.add(_section(row.question, row.answer));
    }
    final other = (additionalNotes ?? '').trim();
    if (other.isNotEmpty) {
      if (sections.isNotEmpty) sections.add(const SizedBox(height: 14));
      sections.add(_section('Additional service notes', other));
    }

    return Container(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: boxShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: const Color(0xffF2F2F7),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.notes_rounded,
                  size: 18,
                  color: Color(0xff636366),
                ),
              ),
              const SizedBox(width: 10),
              const CommonText.semiBold(
                'Service Notes',
                size: 17,
                color: Color(0xff1C1C1E),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ...sections,
        ],
      ),
    );
  }

  Widget _section(String title, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        CommonText.semiBold(title, size: 14, color: const Color(0xff636366)),
        const SizedBox(height: 4),
        CommonText.regular(value, size: 15, color: const Color(0xff1C1C1E)),
      ],
    );
  }
}

List<({String question, String answer})> structuredServiceNoteRowsFromDetail(
  BookingDetailData? detail,
) {
  return BookingServiceNotesFormData.rowsFromDetail(
    vehicleParkedLocationLabel: detail?.vehicleParkedLocationLabel,
    vehicleParkedLocation: detail?.vehicleParkedLocation,
    vehicleParkedLocationOther: detail?.vehicleParkedLocationOther,
    providerParkLocationLabel: detail?.providerParkLocationLabel,
    providerParkLocation: detail?.providerParkLocation,
    providerParkLocationOther: detail?.providerParkLocationOther,
    vehicleKeyLocationLabel: detail?.vehicleKeyLocationLabel,
    vehicleKeyLocation: detail?.vehicleKeyLocation,
    vehicleKeyLocationOther: detail?.vehicleKeyLocationOther,
    keyReturnLocationLabel: detail?.keyReturnLocationLabel,
    keyReturnLocation: detail?.keyReturnLocation,
    keyReturnLocationOther: detail?.keyReturnLocationOther,
    parkingInstructions: detail?.parkingInstructions,
  );
}

String serviceNotesSummaryFromDetail(BookingDetailData? detail) {
  final rows = structuredServiceNoteRowsFromDetail(detail);
  if (rows.isEmpty) {
    return (detail?.parkingInstructions ?? '').trim();
  }
  return rows.map((r) => '${r.question} ${r.answer}').join('\n');
}
