import 'package:flutter/material.dart';

import '../network/response/booking_detail_response.dart';
import 'text.dart';

/// Displays the customer's vehicle details on the invoice / service detail page.
class CustomerVehicleDetailsCard extends StatelessWidget {
  const CustomerVehicleDetailsCard({
    super.key,
    required this.detail,
    this.boxShadow = const [],
  });

  final BookingDetailData? detail;
  final List<BoxShadow> boxShadow;

  static const Color _labelGrey = Color(0xff8E8E93);

  @override
  Widget build(BuildContext context) {
    final v = detail?.vehicle;
    if (v == null) return const SizedBox.shrink();

    final yearMakeModel = [
      if (v.year != null && '${v.year}'.trim().isNotEmpty) '${v.year}',
      if ((v.make ?? '').trim().isNotEmpty) v.make!.trim(),
      if ((v.model ?? '').trim().isNotEmpty) v.model!.trim(),
    ].join(' ').trim();

    if (yearMakeModel.isEmpty &&
        (v.color ?? '').trim().isEmpty &&
        (v.vehicleType ?? '').trim().isEmpty &&
        (v.licensePlate ?? '').trim().isEmpty) {
      return const SizedBox.shrink();
    }

    final rows = <_VehicleRow>[];

    if (yearMakeModel.isNotEmpty) {
      rows.add(_VehicleRow(label: 'Vehicle', value: yearMakeModel));
    }
    if ((v.vehicleType ?? '').trim().isNotEmpty) {
      rows.add(_VehicleRow(label: 'Type', value: v.vehicleType!.trim()));
    }
    if ((v.color ?? '').trim().isNotEmpty) {
      rows.add(_VehicleRow(label: 'Color', value: v.color!.trim()));
    }
    if ((v.licensePlate ?? '').trim().isNotEmpty) {
      rows.add(_VehicleRow(label: 'License plate', value: v.licensePlate!.trim()));
    }

    if (rows.isEmpty) return const SizedBox.shrink();

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
                  Icons.directions_car_outlined,
                  size: 18,
                  color: Color(0xff636366),
                ),
              ),
              const SizedBox(width: 10),
              const CommonText.semiBold(
                'Vehicle details',
                size: 17,
                color: Color(0xff1C1C1E),
              ),
            ],
          ),
          const SizedBox(height: 16),
          for (var i = 0; i < rows.length; i++) ...[
            if (i > 0) ...[
              const SizedBox(height: 10),
              const Divider(height: 1, color: Color(0xffF0F0F0)),
              const SizedBox(height: 10),
            ],
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 110,
                  child: CommonText.medium(
                    rows[i].label,
                    size: 13,
                    color: _labelGrey,
                  ),
                ),
                Expanded(
                  child: CommonText.semiBold(
                    rows[i].value,
                    size: 13,
                    color: const Color(0xff1C1C1E),
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _VehicleRow {
  const _VehicleRow({required this.label, required this.value});
  final String label;
  final String value;
}
