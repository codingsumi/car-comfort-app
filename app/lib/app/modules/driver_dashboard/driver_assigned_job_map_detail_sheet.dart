import 'dart:async';

import 'package:flutter/material.dart';
import 'package:get/get.dart';

import 'package:car_comfort/app/network/response/booking_list_response.dart' as bl;
import 'package:car_comfort/app/routes/app_pages.dart';
import 'package:car_comfort/app/utils/booking_timer_utils.dart';
import 'package:car_comfort/app/utils/driver_job_duration.dart';
import 'package:car_comfort/app/utils/service_type_label.dart';
import 'package:car_comfort/app/widgets/button.dart';
import 'package:car_comfort/app/widgets/driver_job_map_symbol.dart';
import 'package:car_comfort/app/widgets/image.dart';
import 'package:car_comfort/app/widgets/text.dart';

/// Bottom-sheet shown when the driver taps their own **assigned** booking pin on the map.
///
/// Displays key booking details and a "View Full Details" button that navigates
/// to [Routes.DRIVER_SERVICE_DETAIL].
Future<void> showDriverAssignedJobMapDetailSheet(
  BuildContext context, {
  required bl.Bookings booking,
  String? customerName,
  String? customerAvatarUrl,
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
  final timeOfService = formatProviderTimeOfServiceLabel(
    scheduleType: booking.scheduleType,
    scheduledAtIso: bookingScheduledAtIso(
      scheduledAt: booking.scheduledAt,
      serviceDatetime: booking.serviceDatetime,
    ),
    createdAtIso: booking.createdAt,
  );
  final location = _locationLabel(booking.serviceLocation);
  final statusLabel = _statusLabel(booking.status);
  final id = booking.id ?? 0;
  final displayRef = _bookingDisplayRef(booking.bookingCode, id);

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
              // ── Header row ──────────────────────────────────────────────
              Row(
                children: [
                  DriverJobMapSymbol(
                    serviceType: booking.serviceType,
                    durationLabel: formatJobDurationLabel(minutes),
                    iconSize: 27.5,
                    minWidth: 42,
                    isAssigned: true,
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
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 3,
                              ),
                              decoration: BoxDecoration(
                                color: _statusColor(booking.status)
                                    .withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: CommonText.semiBold(
                                statusLabel,
                                size: 11,
                                color: _statusColor(booking.status),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Flexible(
                              child: CommonText.regular(
                                displayRef,
                                size: 11,
                                color: const Color(0xff6B7280),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
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
              // ── Customer row (if name/avatar available) ─────────────────
              if ((customerName ?? '').trim().isNotEmpty) ...[
                const SizedBox(height: 12),
                _CustomerRow(
                  name: customerName!.trim(),
                  avatarUrl: customerAvatarUrl ?? '',
                ),
              ],
              const SizedBox(height: 14),
              const Divider(height: 1),
              const SizedBox(height: 14),
              // ── Detail rows ──────────────────────────────────────────────
              if (earnings.isNotEmpty) ...[
                _detailRow('Provider earnings', earnings),
                const SizedBox(height: 8),
              ],
              _detailRow('Estimated duration', formatJobDurationLabel(minutes)),
              const SizedBox(height: 8),
              _detailRow('Time of service', timeOfService),
              if (location.isNotEmpty && location != '—') ...[
                const SizedBox(height: 8),
                _detailRow('Service location', location),
              ],
              const SizedBox(height: 16),
              // ── CTA ──────────────────────────────────────────────────────
              AppButton(
                label: 'View Full Details',
                onPressed: id > 0
                    ? () {
                        Get.back<void>();
                        unawaited(
                          (Get.toNamed(
                                Routes.DRIVER_SERVICE_DETAIL,
                                arguments: {
                                  'bookingId': id,
                                  'status': '${booking.status ?? ''}'.trim(),
                                  'bookingCode': id.toString(),
                                  'customerName': customerName ?? '',
                                  'customerAvatarUrl': customerAvatarUrl ?? '',
                                  'amount': earnings,
                                },
                              ) ??
                              Future<void>.value()),
                        );
                      }
                    : null,
                bgColor: const Color(0xff1C2D3A),
                txtColor: Colors.white,
                btnCornerRadius: 12,
                vPadding: 12,
                textSize: 14,
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

String _locationLabel(bl.ServiceLocation? location) {
  if (location == null) return '—';
  final name = (location.name ?? '').trim();
  final address = (location.address ?? '').trim();
  if (name.isNotEmpty && address.isNotEmpty) return '$name\n$address';
  if (name.isNotEmpty) return name;
  if (address.isNotEmpty) return address;
  return '—';
}

String _statusLabel(String? status) {
  final s = (status ?? '').trim().toLowerCase();
  switch (s) {
    case 'confirmed':
      return 'Confirmed';
    case 'in_progress':
    case 'inprogress':
      return 'In Progress';
    case 'pending':
      return 'Pending';
    case 'assigned':
      return 'Assigned';
    default:
      if (s.isEmpty) return 'Booked';
      return '${s[0].toUpperCase()}${s.substring(1)}';
  }
}

Color _statusColor(String? status) {
  final s = (status ?? '').trim().toLowerCase();
  switch (s) {
    case 'in_progress':
    case 'inprogress':
      return const Color(0xff2563EB);
    case 'confirmed':
    case 'assigned':
      return const Color(0xff16A34A);
    default:
      return const Color(0xff6B7280);
  }
}

String _bookingDisplayRef(String? bookingCode, int id) {
  final code = (bookingCode ?? '').trim();
  if (code.isNotEmpty) return code;
  if (id <= 0) return '—';
  return 'CC-${id.toString().padLeft(4, '0')}';
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

class _CustomerRow extends StatelessWidget {
  final String name;
  final String avatarUrl;

  const _CustomerRow({required this.name, required this.avatarUrl});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        ClipOval(
          child: avatarUrl.isEmpty
              ? Container(
                  width: 36,
                  height: 36,
                  color: const Color(0xffE8E8EF),
                  child: const Icon(
                    Icons.person_rounded,
                    color: Colors.grey,
                    size: 20,
                  ),
                )
              : ImageFromNetwork(
                  avatarUrl,
                  width: 36,
                  height: 36,
                  fit: BoxFit.cover,
                  placeholderWidget: Container(
                    width: 36,
                    height: 36,
                    color: const Color(0xffE8E8EF),
                  ),
                ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: CommonText.medium(
            name,
            size: 14,
            maxLines: 1,
          ),
        ),
      ],
    );
  }
}
