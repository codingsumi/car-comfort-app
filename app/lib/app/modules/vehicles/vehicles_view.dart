import 'dart:math' as math;

import 'package:car_comfort/app/widgets/image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import 'package:get/get.dart';
import '../../gen/assets.gen.dart';
import '../../utils/extensions/extension.dart';
import '../../widgets/blurred_image_screen_header.dart';
import '../../widgets/local_image_gallery_viewer.dart';
import '../../widgets/text.dart';
import '../../models/vehicle_model.dart';
import 'vehicles_controller.dart';

class VehiclesView extends GetView<VehiclesController> {
  const VehiclesView({super.key});

  /// Space under the last list row so content clears the pinned [_AddVehicleCard]
  /// (dashed card + outer padding). Slightly over-reserved so nothing clips.
  static const double _addVehicleStackReserve = 148;

  @override
  Widget build(BuildContext context) {
    // Inset scroll region above system nav. Prefer viewPadding (edge-to-edge); max with padding for OEM quirks.
    final mq = MediaQuery.of(context);
    final navBarBottom = math.max(mq.viewPadding.bottom, mq.padding.bottom);

    Widget pinnedAddVehicle() {
      return Positioned(
        left: 16,
        right: 16,
        bottom: 0,
        child: Container(
          padding: const EdgeInsets.only(top: 12, bottom: 16),
          color: Colors.white,
          child: _AddVehicleCard(onTap: controller.openAddVehicle),
        ),
      );
    }

    final listBottomPad = 16.0 + _addVehicleStackReserve;

    return Scaffold(
      backgroundColor: Colors.white,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          BlurredImageScreenHeader(
            title: 'My Vehicle',
            backgroundFit: BoxFit.fill,
            showLeading: true,
            onBack: Get.back,
          ),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: navBarBottom),
              child: Obx(() {
                final settingDefaultId =
                    controller.settingDefaultVehicleId.value;
                if (controller.isLoadingVehicles.value &&
                    controller.myVehicles.isEmpty) {
                  return Center(
                    child: SpinKitThreeBounce(
                      color: Get.context?.colorScheme.primary,
                      size: 20,
                    ),
                  );
                }
                if (controller.myVehicles.isEmpty) {
                  return Stack(
                    fit: StackFit.expand,
                    children: [
                      Positioned.fill(
                        bottom: listBottomPad,
                        child: LayoutBuilder(
                          builder: (context, constraints) {
                            return SingleChildScrollView(
                              physics: const AlwaysScrollableScrollPhysics(),
                              padding: const EdgeInsets.symmetric(horizontal: 24),
                              child: ConstrainedBox(
                                constraints: BoxConstraints(
                                  minHeight: constraints.maxHeight,
                                ),
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Container(
                                      width: 120,
                                      height: 120,
                                      decoration: const BoxDecoration(
                                        color: Color(0xffF2F2F7),
                                        shape: BoxShape.circle,
                                      ),
                                      child: Center(
                                        child: SvgImageFromAsset.square(
                                          Assets.imagesIcCar,
                                          size: 56,
                                          color: const Color(0xff667085),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 24),
                                    const CommonText.bold(
                                      'No vehicle yet',
                                      size: 20,
                                      color: Color(0xff1A1A1A),
                                      textAlign: TextAlign.center,
                                    ),
                                    const SizedBox(height: 12),
                                    const CommonText.regular(
                                      'Add your first vehicle to start tracking your data and manage your bookings effortlessly.',
                                      size: 14,
                                      color: Color(0xff5E5E5E),
                                      textAlign: TextAlign.center,
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                      pinnedAddVehicle(),
                    ],
                  );
                }
                return Stack(
                  fit: StackFit.expand,
                  children: [
                    ListView.builder(
                      padding: EdgeInsets.fromLTRB(
                        16,
                        16,
                        16,
                        listBottomPad,
                      ),
                      itemCount: controller.myVehicles.length + 1,
                      itemBuilder: (context, index) {
                        if (index == 0) {
                          return CommonText.bold(
                            'Manage your saved vehicles for faster bookings',
                            size: 14,
                          ).paddingOnly(bottom: 12);
                        }
                        final vehicle = controller.myVehicles[index - 1];
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _VehicleCard(
                            vehicle: vehicle,
                            isSettingDefault:
                                settingDefaultId != null &&
                                settingDefaultId == vehicle.id,
                            onEditTap: () =>
                                controller.openEditVehicle(vehicle),
                            onSetDefault: () =>
                                controller.setDefaultVehicle(vehicle),
                          ),
                        );
                      },
                    ),
                    pinnedAddVehicle(),
                  ],
                );
              }),
            ),
          ),
        ],
      ),
    );
  }
}

class _VehicleCard extends StatelessWidget {
  const _VehicleCard({
    required this.vehicle,
    required this.isSettingDefault,
    required this.onEditTap,
    required this.onSetDefault,
  });

  final VehicleModel vehicle;
  final bool isSettingDefault;
  final VoidCallback onEditTap;
  final VoidCallback onSetDefault;

  static const _primaryRed = Color(0xffF2051F);

  /// Same fill as the vehicle image / car-icon area so "Set Default" matches that block.
  static const _vehicleImageAreaBg = Color(0xffF2F2F7);

  @override
  Widget build(BuildContext context) {
    final nickname = (vehicle.nickname ?? '').toString().trim();
    final make = (vehicle.make ?? '').toString().trim();
    final model = (vehicle.model ?? '').toString().trim();
    final license = (vehicle.licensePlate ?? '').toString().trim();
    final year = (vehicle.year ?? '').toString().trim();
    final color = (vehicle.color ?? '').toString().trim();
    final type = (vehicle.vehicleType ?? '').toString().trim();
    final images = vehicle.images ?? const <Images>[];
    final imagePath = images.isNotEmpty
        ? (images.first.url ?? images.first.imagePath ?? '').trim()
        : '';

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xffE8E8EF)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                if (vehicle.isDefault)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: _primaryRed,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: CommonText.medium(
                      'PRIMARY',
                      size: 11,
                      color: Colors.white,
                    ),
                  )
                else if (vehicle.id != null)
                  Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: isSettingDefault ? null : onSetDefault,
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: _vehicleImageAreaBg,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                            color: context.colorScheme.onSecondaryContainer,
                          ),
                        ),
                        child: CommonText.medium(
                          'SET PRIMARY',
                          size: 11,
                          color: context.colorScheme.onSecondaryContainer,
                        ),
                      ),
                    ),
                  ),
                const Spacer(),
                InkWell(
                  onTap: () => onEditTap(),
                  child: Icon(
                    Icons.edit_outlined,
                    size: 20,
                    color: Colors.grey,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),

            // Image placeholder
            GestureDetector(
              onTap: imagePath.isEmpty
                  ? null
                  : () => LocalImageGalleryViewer.show(
                        context,
                        imagePaths: [imagePath],
                      ),
              child: Container(
                height: 110,
                width: double.infinity,
                decoration: BoxDecoration(
                  color: _vehicleImageAreaBg,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: imagePath.isEmpty
                      ? const Center(
                          child: Icon(
                            Icons.directions_car,
                            size: 36,
                            color: Color(0xff667085),
                          ),
                        )
                      : Stack(
                          children: [
                            ImageFromNetwork(
                              imagePath,
                              fit: BoxFit.contain,
                              width: double.infinity,
                              height: double.infinity,
                              placeholderWidget: const Center(
                                child: Icon(
                                  Icons.directions_car,
                                  size: 36,
                                  color: Color(0xff667085),
                                ),
                              ),
                            ),
                            Positioned(
                              right: 8,
                              bottom: 8,
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.black54,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: const Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      Icons.zoom_in_rounded,
                                      color: Colors.white,
                                      size: 14,
                                    ),
                                    SizedBox(width: 4),
                                    Text(
                                      'Preview',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 11,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                ),
              ),
            ),

            const SizedBox(height: 10),
            CommonText.bold(
              nickname.isEmpty ? 'Vehicle' : nickname,
              size: 14,
              color: const Color(0xff1A1A1A),
            ),
            const SizedBox(height: 10),

            // Info grid
            Row(
              children: [
                Expanded(
                  child: _LabeledValue(label: 'Make', value: make),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _LabeledValue(label: 'Model', value: model),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: _LabeledValue(label: 'License Plate', value: license),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _LabeledValue(label: 'Year', value: year),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: _LabeledValue(label: 'Color', value: color),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _LabeledValue(label: 'Type', value: type),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: _LabeledValue(
                    label: 'Fuel type',
                    value: (vehicle.fuelType ?? '').trim(),
                  ),
                ),
                const SizedBox(width: 12),
                if ((vehicle.fuelType ?? '').trim().toUpperCase() == 'ELECTRIC')
                  Expanded(
                    child: _LabeledValue(
                      label: 'Battery (kWh)',
                      value: (vehicle.batteryCapacityKwh ?? '').trim(),
                    ),
                  )
                else
                  const Expanded(child: SizedBox.shrink()),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _LabeledValue extends StatelessWidget {
  const _LabeledValue({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final displayValue = value.isEmpty ? '—' : value;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        CommonText.regular(
          label,
          size: 11,
          color: Colors.grey.shade600,
          maxLines: 1,
        ),
        const SizedBox(height: 4),
        CommonText.medium(
          displayValue,
          size: 12,
          color: const Color(0xff1A1A1A),
          maxLines: 1,
        ),
      ],
    );
  }
}

class _AddVehicleCard extends StatelessWidget {
  const _AddVehicleCard({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: CustomPaint(
        painter: _DashedRRectPainter(
          color: const Color(0xffE8E8EF),
          dash: 2,
          gap: 0.1,
          radius: 16,
          strokeWidth: 3,
        ),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            color: Colors.white,
          ),
          child: Column(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: const BoxDecoration(
                  color: Color(0xffF2051F),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.add_rounded,
                  color: Colors.white,
                  size: 22,
                ),
              ),
              const SizedBox(height: 10),
              CommonText.medium(
                'Add New Vehicle',
                size: 14,
                color: const Color(0xff1A1A1A),
              ),
              const SizedBox(height: 4),
              CommonText.regular(
                'Save time on future bookings',
                size: 11,
                color: Colors.grey.shade600,
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DashedRRectPainter extends CustomPainter {
  _DashedRRectPainter({
    required this.color,
    required this.dash,
    required this.gap,
    required this.radius,
    required this.strokeWidth,
  });

  final Color color;
  final double dash;
  final double gap;
  final double radius;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final rrect = RRect.fromRectAndRadius(
      Rect.fromLTWH(0, 0, size.width, size.height),
      Radius.circular(radius),
    );
    final path = Path()..addRRect(rrect);
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth;

    for (final metric in path.computeMetrics()) {
      double distance = 0;
      var index = 0;
      while (distance < metric.length) {
        final segmentLength = dash;
        final next = distance + segmentLength;
        final end = mathMin(next, metric.length);
        if (index.isEven) {
          final extract = metric.extractPath(distance, end);
          canvas.drawPath(extract, paint);
        }
        distance = end + gap;
        index++;
      }
    }
  }

  double mathMin(double a, double b) => a < b ? a : b;

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
