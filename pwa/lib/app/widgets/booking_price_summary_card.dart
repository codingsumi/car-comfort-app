import 'package:flutter/material.dart';

import '../network/response/booking_detail_response.dart';
import '../network/response/booking_review_response.dart';
import 'text.dart';

/// Line-item price breakdown for booking detail (customer).
class BookingPriceSummaryCard extends StatelessWidget {
  const BookingPriceSummaryCard({
    super.key,
    required this.priceSummary,
    this.totalLabel = 'Total',
  });

  final PriceSummary priceSummary;
  final String totalLabel;

  static const Color _labelGrey = Color(0xff8E8E93);
  static const Color _brandRed = Color(0xffC4101F);
  static const List<BoxShadow> _cardShadow = [
    BoxShadow(color: Color(0x12000000), blurRadius: 14, offset: Offset(0, 4)),
    BoxShadow(color: Color(0x08000000), blurRadius: 4, offset: Offset(0, 1)),
  ];

  @override
  Widget build(BuildContext context) {
    final lines = (priceSummary.applicableCharges ?? const <Lines>[])
        .where((line) {
          final amount = line.amount ?? 0;
          final key = (line.key ?? '').trim().toLowerCase();
          final hasValueText = (line.valueText ?? '').trim().isNotEmpty;
          if (amount == 0 &&
              key != 'discount_promotion' &&
              key != 'customer_preferred_package' &&
              key != 'package' &&
              key != 'ev_service_fee' &&
              key != 'estimated_car_wash_fee' &&
              key != 'estimated_charging_cost' &&
              !hasValueText) {
            return false;
          }
          return true;
        })
        .toList();
    if (lines.isEmpty && (priceSummary.total ?? 0) <= 0) {
      return const SizedBox.shrink();
    }

    final title = (priceSummary.title ?? 'Price Summary').trim();
    final total = priceSummary.total ?? 0;

    return Container(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: _cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CommonText.semiBold(
            title,
            size: 16,
            color: const Color(0xff1C1C1E),
          ),
          const SizedBox(height: 14),
          ...lines.expand((line) {
            final label = _bookingPriceSummaryDisplayLabel(line);
            if (label.isEmpty) return <Widget>[];
            final amount = line.amount ?? 0;
            final key = (line.key ?? '').trim().toLowerCase();
            final customValue = (line.valueText ?? '').trim();
            final valueText = _bookingPriceSummaryLineValue(
              key: key,
              customValue: customValue,
              amount: amount,
            );
            final isPackageLine =
                key == 'customer_preferred_package' || key == 'package';
            final isSubtotalLine = key == 'subtotal';
            final rawSectionTitle = (line.sectionTitle ?? '').trim();
            final sectionTitle = _remapPriceSummarySectionTitle(rawSectionTitle);
            final widgets = <Widget>[];

            if (sectionTitle.isNotEmpty) {
              widgets.add(
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: CommonText.regular(
                    sectionTitle,
                    size: 14,
                    color: _brandRed,
                    maxLines: 2,
                  ),
                ),
              );
            }

            final highlight = !isPackageLine &&
                sectionTitle.isEmpty &&
                (key.contains('basic') || key.contains('car_comfort'));
            final labelStyle = isSubtotalLine ? CommonText.semiBold : CommonText.regular;
            widgets.add(
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: labelStyle(
                        label,
                        size: 14,
                        color: highlight ? _brandRed : const Color(0xff1C1C1E),
                        maxLines: 3,
                      ),
                    ),
                    const SizedBox(width: 12),
                    labelStyle(
                      valueText,
                      size: 14,
                      color: const Color(0xff1C1C1E),
                    ),
                  ],
                ),
              ),
            );

            if (isSubtotalLine) {
              widgets.add(
                const Padding(
                  padding: EdgeInsets.only(bottom: 10),
                  child: Divider(height: 1, color: Color(0xffECECEC)),
                ),
              );
            }
            return widgets;
          }),
          const Divider(height: 1, color: Color(0xffECECEC)),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              CommonText.semiBold(totalLabel, size: 15, color: const Color(0xff1C1C1E)),
              CommonText.semiBold(
                '\$${total.toStringAsFixed(2)}',
                size: 15,
                color: _brandRed,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

String _bookingPriceSummaryDisplayLabel(Lines line) {
  final key = (line.key ?? '').trim().toLowerCase();
  if (key == 'discount_promotion') {
    // Use the label from the API (e.g. "Promo: Summer Sale") if provided,
    // otherwise fall back to the generic label.
    final apiLabel = (line.label ?? '').trim();
    if (apiLabel.isNotEmpty && !apiLabel.toLowerCase().startsWith('discount and')) {
      return apiLabel;
    }
    return 'Discount and savings';
  }
  if (key == 'tax') return 'Taxes';

  var label = (line.label ?? '').trim();
  if (label.isEmpty) return label;

  label = label.replaceAll(
    RegExp(r'\s*\([^)]*paid at[^)]*\)', caseSensitive: false),
    '',
  );

  final lower = label.toLowerCase();
  if (lower.startsWith('discount and promotion')) {
    return 'Discount and savings';
  }
  if (lower.startsWith('taxes (')) {
    return 'Taxes';
  }
  return label;
}

String _bookingPriceSummaryLineValue({
  required String key,
  required String customValue,
  required double amount,
}) {
  if (key == 'estimated_car_wash_fee' || key == 'estimated_charging_cost') {
    return '\$0.00';
  }
  if (customValue.isNotEmpty) {
    var value = customValue.replaceFirst(
      RegExp(r'\s+held$', caseSensitive: false),
      '',
    );
    value = value.replaceAll(
      RegExp(r'\s*\([^)]*paid at[^)]*\)', caseSensitive: false),
      '',
    );
    if (value == r'$0' || value == '0') return '\$0.00';
    return value;
  }
  if (amount < 0) {
    return '-\$${amount.abs().toStringAsFixed(2)}';
  }
  return '\$${amount.toStringAsFixed(2)}';
}

/// Driver payout summary for a booking.
class DriverEarningCard extends StatelessWidget {
  const DriverEarningCard({super.key, required this.earning});

  final DriverEarningSummary earning;

  static const List<BoxShadow> _cardShadow = [
    BoxShadow(color: Color(0x12000000), blurRadius: 14, offset: Offset(0, 4)),
    BoxShadow(color: Color(0x08000000), blurRadius: 4, offset: Offset(0, 1)),
  ];

  @override
  Widget build(BuildContext context) {
    final title = earning.isAdjustedPayout ? 'Adjusted Earnings' : 'Your Earnings';

    return Container(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: _cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CommonText.semiBold(
            title,
            size: 16,
            color: const Color(0xff1C1C1E),
          ),
          if (earning.note != null && earning.note!.trim().isNotEmpty) ...[
            const SizedBox(height: 8),
            CommonText.regular(
              earning.note!.trim(),
              size: 12,
              color: const Color(0xff8E8E93),
            ),
          ],
          const SizedBox(height: 14),
          if (earning.plannedServicePayout != null &&
              earning.plannedServicePayout! > earning.amount) ...[
            _earningRow(
              'Planned service payout',
              earning.plannedServicePayout!,
              muted: true,
            ),
            const SizedBox(height: 8),
          ],
          _earningRow(earning.primaryPayoutLabel, earning.amount),
          if (earning.tipAmount != null && earning.tipAmount! > 0) ...[
            const SizedBox(height: 8),
            _earningRow('Customer tip', earning.tipAmount!),
          ],
          const Divider(height: 20, color: Color(0xffECECEC)),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const CommonText.semiBold('Total', size: 15, color: Color(0xff1C1C1E)),
              CommonText.semiBold(
                earning.totalPayoutDisplay,
                size: 15,
                color: const Color(0xff1B5E20),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _earningRow(String label, double amount, {bool muted = false}) {
    final valueColor = muted ? const Color(0xffB0B0B5) : const Color(0xff1C1C1E);
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        CommonText.regular(label, size: 14, color: const Color(0xff8E8E93)),
        Text(
          '\$${amount.toStringAsFixed(2)}',
          style: TextStyle(
            fontSize: 14,
            color: valueColor,
            decoration: muted ? TextDecoration.lineThrough : null,
            decorationColor: valueColor,
          ),
        ),
      ],
    );
  }
}

/// Remaps known API section title strings to the preferred display text.
String _remapPriceSummarySectionTitle(String title) {
  final lower = title.toLowerCase();
  if (lower == 'customer preferred package' ||
      lower == 'customer preferred') {
    return 'Custom Package';
  }
  return title;
}
