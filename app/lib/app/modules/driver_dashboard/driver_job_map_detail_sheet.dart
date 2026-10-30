import 'package:flutter/material.dart';
import 'package:get/get.dart';

import 'package:car_comfort/app/network/response/booking_list_response.dart' as bl;
import 'package:car_comfort/app/utils/booking_timer_utils.dart';
import 'package:car_comfort/app/utils/driver_job_duration.dart';
import 'package:car_comfort/app/utils/service_type_label.dart';
import 'package:car_comfort/app/widgets/button.dart';
import 'package:car_comfort/app/widgets/driver_job_map_symbol.dart';
import 'package:car_comfort/app/widgets/text.dart';

Future<void> showDriverJobMapDetailSheet(
  BuildContext context, {
  required bl.Bookings booking,
  required VoidCallback onAccept,
  required VoidCallback onReject,
  bool isAccepting = false,
  bool acceptEnabled = true,
}) {
  final serviceType = bookingServiceTypeDisplay(booking.serviceType);
  final minutes = resolveEstimatedServiceMinutes(
    estimatedCompletionMinutes: booking.estimatedCompletionMinutes,
    serviceDurationMinutes: booking.serviceDurationMinutes,
    serviceType: booking.serviceType,
    packageName: booking.packageName,
  );
  final earnings = formatProviderEarningLabel(
    providerEarning: booking.providerEarning,
    providerEarningDisplay: booking.providerEarningDisplay,
  );
  final scheduleLabel = driverJobScheduleTypeLabel(booking.scheduleType);
  final timeOfService = formatProviderTimeOfServiceLabel(
    scheduleType: booking.scheduleType,
    scheduledAtIso: bookingScheduledAtIso(
      scheduledAt: booking.scheduledAt,
      serviceDatetime: booking.serviceDatetime,
    ),
  );
  final location = _formatDriverJobLocationLabel(booking.serviceLocation);

  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        child: Container(
          padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            boxShadow: const [
              BoxShadow(
                color: Color(0x33000000),
                blurRadius: 16,
                offset: Offset(0, -4),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  DriverJobMapSymbol(
                    serviceType: booking.serviceType,
                    durationLabel: formatJobDurationLabel(minutes),
                    iconSize: 27.5,
                    minWidth: 42,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        CommonText.semiBold(
                          serviceType.isEmpty ? 'Service' : serviceType,
                          size: 17,
                          maxLines: 2,
                        ),
                        const SizedBox(height: 4),
                        CommonText.regular(
                          scheduleLabel,
                          size: 13,
                          color: const Color(0xff6B7280),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => Get.back<void>(),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              _detailRow('Service provider earnings', earnings),
              const SizedBox(height: 8),
              _detailRow(
                'Estimated time to complete',
                formatJobDurationLabel(minutes),
              ),
              const SizedBox(height: 8),
              _detailRow('Time of service', timeOfService),
              if (location.isNotEmpty && location != '—') ...[
                const SizedBox(height: 8),
                _detailRow('Service location', location),
              ],
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: AppButton(
                      label: isAccepting ? 'Accepting…' : 'Accept',
                      onPressed:
                          (isAccepting || !acceptEnabled) ? null : onAccept,
                      bgColor: Colors.black,
                      txtColor: Colors.white,
                      btnCornerRadius: 12,
                      vPadding: 12,
                      textSize: 14,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: AppButton(
                      label: 'Reject',
                      onPressed: isAccepting ? null : onReject,
                      bgColor: const Color(0xffE70B1C),
                      txtColor: Colors.white,
                      btnCornerRadius: 12,
                      vPadding: 12,
                      textSize: 14,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

String _formatDriverJobLocationLabel(bl.ServiceLocation? location) {
  if (location == null) return '—';
  final name = (location.name ?? '').trim();
  final address = (location.address ?? '').trim();
  if (name.isNotEmpty && address.isNotEmpty) return '$name\n$address';
  if (name.isNotEmpty) return name;
  if (address.isNotEmpty) return address;
  return '—';
}

Widget _detailRow(String label, String value) {
  return Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Expanded(
        flex: 5,
        child: CommonText.medium(
          label,
          size: 13,
          color: const Color(0xff6B7280),
        ),
      ),
      Expanded(
        flex: 6,
        child: CommonText.semiBold(
          value,
          size: 13,
          textAlign: TextAlign.right,
          maxLines: 3,
        ),
      ),
    ],
  );
}
