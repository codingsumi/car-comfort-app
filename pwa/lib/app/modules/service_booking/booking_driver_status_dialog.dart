import 'package:car_comfort/app/widgets/text.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../dashboard/dashboard_controller.dart';
import 'service_booking_controller.dart';

/// Post-booking sheet: service provider popup — minimal design.
void showBookingDriverStatusDialog(ServiceBookingController controller) {
  final dashboard = Get.isRegistered<DashboardController>()
      ? Get.find<DashboardController>()
      : null;
  final imageUrl = (dashboard?.customerSocketDriverAvatarUrl.value ?? '').trim();

  Get.dialog<void>(
    _BookingDriverStatusDialog(
      driverName: 'Dummy driver',
      rating: 4.8,
      imageUrl: imageUrl,
    ),
    barrierDismissible: true,
    barrierColor: Colors.black54,
  );
}

class _BookingDriverStatusDialog extends StatelessWidget {
  const _BookingDriverStatusDialog({
    required this.driverName,
    required this.rating,
    this.imageUrl = '',
  });

  final String driverName;
  final double rating;
  final String imageUrl;

  @override
  Widget build(BuildContext context) {
    return Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 24),
      backgroundColor: Colors.transparent,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 400),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Heading
                  const SizedBox(height: 4),
                  const CommonText.bold(
                    'Service Provider',
                    size: 22,
                    color: Colors.black,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 20),

                  // Zoomable profile image
                  ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: Container(
                      width: double.infinity,
                      height: 220,
                      color: const Color(0xffEEF0F5),
                      child: InteractiveViewer(
                        minScale: 0.8,
                        maxScale: 5.0,
                        child: imageUrl.isNotEmpty
                            ? Image.network(
                                imageUrl,
                                width: double.infinity,
                                height: 220,
                                fit: BoxFit.cover,
                                cacheWidth: 800,
                                cacheHeight: 440,
                                errorBuilder: (_, __, ___) =>
                                    _imagePlaceholder(),
                              )
                            : _imagePlaceholder(),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Provider name
                  CommonText.bold(
                    driverName,
                    size: 20,
                    color: Colors.black,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),

                  // Rating
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(
                        Icons.star_rounded,
                        color: Color(0xff3478F6),
                        size: 26,
                      ),
                      const SizedBox(width: 6),
                      CommonText.semiBold(
                        rating.toStringAsFixed(1),
                        size: 18,
                        color: Colors.black,
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // Close button
            Positioned(
              top: 10,
              right: 10,
              child: GestureDetector(
                onTap: () => Get.back<void>(),
                child: const Icon(
                  Icons.close_rounded,
                  size: 26,
                  color: Colors.black87,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _imagePlaceholder() {
    return Container(
      width: double.infinity,
      height: 220,
      color: const Color(0xffEEF0F5),
      alignment: Alignment.center,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.person_rounded,
            size: 72,
            color: Colors.grey.shade400,
          ),
          const SizedBox(height: 8),
          Text(
            'Image',
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey.shade500,
            ),
          ),
        ],
      ),
    );
  }
}
