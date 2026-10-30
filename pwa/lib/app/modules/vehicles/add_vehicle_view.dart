import 'package:car_comfort/app/widgets/button.dart';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';
import '../../utils/extensions/extension.dart';
import '../../utils/validator.dart';
import '../../utils/vehicle_colors.dart';
import '../../utils/alerts.dart';
import '../../utils/vehicle_types.dart';
import '../../widgets/vehicle_make_model_fields.dart';
import '../../widgets/text.dart';
import '../../widgets/blurred_image_screen_header.dart';
import '../../widgets/text_field.dart';
import '../../widgets/text_field.dart' show RequiredFieldLabel;
import 'vehicles_controller.dart';
import 'dart:math' as math;

class AddVehicleView extends GetView<VehiclesController> {
  const AddVehicleView({super.key});

  static const Color _inputFill = Colors.white;
  static const Color _labelColor = Color(0xff1C1C1E);
  static const double _fieldRadius = 10;
  static const double _gridGap = 12;

  Color _fieldBorder(BuildContext context) => const Color(0xffC7C7CC);

  Color _hintColor(BuildContext context) => context.colorScheme.outlineVariant;

  @override
  Widget build(BuildContext context) {
    final hint = _hintColor(context);
    final border = _fieldBorder(context);

    return Scaffold(
      backgroundColor: Colors.white,
      body: GestureDetector(
        behavior: HitTestBehavior.translucent,
        onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
        child: Column(
          children: [
            BlurredImageScreenHeader(
              title: controller.isEditMode.value
                  ? 'Edit Vehicle'
                  : 'Add New Vehicle',
              backgroundFit: BoxFit.fill,
              showLeading: true,
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
                child: Obx(() {
                  final y = controller.selectedYear.value;
                  final c = controller.selectedColor.value;
                  final fuel = controller.selectedFuelType.value;
                  final vehicleType = controller.selectedType.value;
                  return Form(
                    key: controller.vehicleFormKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Photo picker block (optional)
                        _VehiclePhotoPickerPlaceholder(
                          onTap: () => controller.pickVehiclePhoto(context),
                          imagePath: controller.selectedVehiclePhotoPath.value,
                        ),
                        const SizedBox(height: 18),

                        // Select Vehicle Type
                        RequiredFieldLabel(
                          label: 'Select Vehicle Type',
                          color: _labelColor,
                          isRequired: true,
                          bold: true,
                        ).paddingOnly(bottom: 8),
                        CommonDropDownField(
                          hintText: 'Select vehicle type (e.g. Sedan, SUV)',
                          selectedValue: vehicleType,
                          items: controller.vehicleTypeDropdownItems,
                          errorText: 'Please select vehicle type',
                          borderRadius: _fieldRadius,
                          bgColor: _inputFill,
                          borderColor: border,
                          hintColor: hint,
                          selectedTextColor: _labelColor,
                          onSave: controller.onVehicleTypeChosen,
                        ),
                        if (VehicleTypes.isOther(vehicleType)) ...[
                          const SizedBox(height: _gridGap),
                          CommonTextField(
                            controller: controller.vehicleTypeOtherController,
                            labelText: '',
                            hintText:
                                'Enter your vehicle type (e.g. Convertible)',
                            borderRadius: _fieldRadius,
                            bgColor: _inputFill,
                            textColor: _labelColor,
                            hintColor: hint,
                            borderColor: border,
                            padding: 14,
                            validator: (value) {
                              if (!VehicleTypes.isOther(
                                controller.selectedType.value,
                              )) {
                                return null;
                              }
                              if ((value ?? '').trim().isEmpty) {
                                return 'Please enter your vehicle type';
                              }
                              return null;
                            },
                          ),
                        ],

                        const SizedBox(height: 18),

                        const CommonText.bold(
                          'Vehicle Information',
                          size: 14,
                          color: _labelColor,
                        ),
                        const SizedBox(height: 12),

                        // Make / Model
                        VehicleMakeModelFields(
                          selectedMake: controller.selectedVehicleMake.value,
                          selectedModel: controller.selectedVehicleModel.value,
                          makeItems: controller.vehicleMakeDropdownItems,
                          modelItems: controller.vehicleModelDropdownItems,
                          onMakeSave: controller.onVehicleMakeChosen,
                          onModelSave: controller.onVehicleModelChosen,
                          makeOtherController:
                              controller.vehicleMakeOtherController,
                          modelOtherController:
                              controller.vehicleModelOtherController,
                          fieldRadius: _fieldRadius,
                          inputFill: _inputFill,
                          border: border,
                          hint: hint,
                          labelColor: _labelColor,
                          gridGap: _gridGap,
                          includeValidators: true,
                        ),

                        const SizedBox(height: _gridGap),

                        // Year / Color
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            Expanded(
                              child: CommonDropDownField(
                                hintText: 'Year',
                                labelText: 'Year',
                                isRequired: true,
                                selectedValue: y,
                                items: controller.years,
                                errorText: 'Please select year',
                                borderRadius: _fieldRadius,
                                bgColor: _inputFill,
                                borderColor: border,
                                hintColor: hint,
                                selectedTextColor: _labelColor,
                                labelColor: _labelColor,
                                onSave: (v) =>
                                    controller.selectedYear.value = v,
                              ),
                            ),
                            const SizedBox(width: _gridGap),
                            Expanded(
                              child: CommonDropDownField(
                                hintText: 'Color',
                                labelText: 'Color',
                                isRequired: true,
                                selectedValue: c,
                                items: controller.colors,
                                errorText: 'Please select color',
                                borderRadius: _fieldRadius,
                                bgColor: _inputFill,
                                borderColor: border,
                                hintColor: hint,
                                selectedTextColor: _labelColor,
                                labelColor: _labelColor,
                                onSave: controller.onVehicleColorChosen,
                              ),
                            ),
                          ],
                        ),
                        if (VehicleColors.isOther(c)) ...[
                          const SizedBox(height: _gridGap),
                          CommonTextField(
                            controller: controller.vehicleCustomColorController,
                            labelText: '',
                            hintText:
                                'Enter your vehicle color (e.g. Matte Gray)',
                            borderRadius: _fieldRadius,
                            bgColor: _inputFill,
                            textColor: _labelColor,
                            hintColor: hint,
                            borderColor: border,
                            padding: 14,
                            validator: (value) {
                              if (!VehicleColors.isOther(
                                controller.selectedColor.value,
                              )) {
                                return null;
                              }
                              if ((value ?? '').trim().isEmpty) {
                                return 'Please enter your vehicle color';
                              }
                              return null;
                            },
                          ),
                        ],

                        const SizedBox(height: _gridGap),

                        // Nickname
                        RequiredFieldLabel(
                          label: 'Nickname',
                          color: _labelColor,
                          isRequired: true,
                          bold: true,
                        ).paddingOnly(bottom: 8),
                        CommonTextField(
                          controller: controller.vehicleNicknameController,
                          labelText: '',
                          hintText:
                              'Enter a nickname for your vehicle (e.g. Daily Driver)',
                          borderRadius: _fieldRadius,
                          bgColor: _inputFill,
                          textColor: _labelColor,
                          hintColor: hint,
                          borderColor: border,
                          padding: 14,
                          validator: (value) {
                            if ((value ?? '').trim().isEmpty) {
                              return 'Please enter vehicle nickname';
                            }
                            return null;
                          },
                        ),

                        const SizedBox(height: _gridGap + 4),

                        // License plate
                        RequiredFieldLabel(
                          label: 'License Plate',
                          color: _labelColor,
                          isRequired: true,
                          bold: true,
                        ),
                        const SizedBox(height: 8),
                        CommonTextField(
                          controller: controller.vehiclePlateController,
                          labelText: '',
                          hintText: 'Enter license plate (e.g. ABC 1234)',
                          borderRadius: _fieldRadius,
                          bgColor: _inputFill,
                          textColor: _labelColor,
                          hintColor: hint,
                          borderColor: border,
                          textCapitalization: TextCapitalization.characters,
                          inputFormatters: licensePlateInputFormatters,
                          validator: validateLicensePlate,
                        ),

                        const SizedBox(height: _gridGap + 4),
                        RequiredFieldLabel(
                          label: 'Fuel Type',
                          color: _labelColor,
                          isRequired: true,
                          bold: true,
                        ),
                        const SizedBox(height: 8),
                        CommonDropDownField(
                          hintText:
                              'Select fuel type (Gas, Diesel, or Electric)',
                          labelText: '',
                          selectedValue: fuel,
                          items: VehiclesController.fuelTypeOptions,
                          errorText: 'Please select fuel type',
                          borderRadius: _fieldRadius,
                          bgColor: _inputFill,
                          borderColor: border,
                          hintColor: hint,
                          labelColor: _labelColor,
                          selectedTextColor: _labelColor,
                          onSave: controller.onFuelTypeChosen,
                        ),
                      ],
                    ),
                  );
                }),
              ),
            ),
            Obx(
              () => Padding(
                padding: EdgeInsets.fromLTRB(
                  20,
                  0,
                  20,
                  16 + MediaQuery.paddingOf(context).bottom,
                ),
                child: Column(
                  children: [
                    SizedBox(
                      width: double.infinity,
                      child: AppButton(
                        label: controller.isLoadingVehicles.value
                            ? 'Loading...'
                            : 'Save Vehicle',
                        onPressed: controller.isLoadingVehicles.value
                            ? null
                            : controller.saveNewVehicle,
                        bgColor: Color(0xffF2051F),
                        btnCornerRadius: 28,
                      ),
                    ).paddingOnly(bottom: 12),

                    if (controller.isEditMode.value) ...[
                      SizedBox(
                        width: double.infinity,
                        child: AppButton(
                          type: ButtonType.outline,
                          label: 'Delete Vehicle',
                          onPressed: controller.isDeleteVehicles.value
                              ? null
                              : () {
                                  showAlertDialog(
                                    'Delete Vehicle',
                                    content:
                                        'Are you sure you want to delete vehicle?',
                                    primaryText: 'Delete',
                                    secondaryText: 'Cancel',
                                    canDismiss: true,
                                    primaryClick: () async {
                                      Get.back(); // close confirmation dialog
                                      await controller.deleteVehicle();
                                      Get.back();
                                    },
                                    secondaryClick: () => Get.back(),
                                  );
                                },
                          // bgColor: Color(0xffF2051F),
                          btnCornerRadius: 28,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _VehiclePhotoPickerPlaceholder extends StatelessWidget {
  const _VehiclePhotoPickerPlaceholder({required this.onTap, this.imagePath});

  final VoidCallback onTap;
  final String? imagePath;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Column(
        children: [
          CustomPaint(
            painter: _DashedRRectPainter(
              color: const Color(0xffCFCFD4),
              dash: 3,
              gap: 1.3,
              radius: 16,
              strokeWidth: 2,
            ),
            child: Container(
              height: 108,
              width: double.infinity,
              margin: const EdgeInsets.symmetric(horizontal: 0),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Padding(
                padding: EdgeInsets.symmetric(
                  horizontal: ((imagePath ?? '').trim().isNotEmpty) ? 0 : 18,
                ),
                child: Builder(
                  builder: (context) {
                    final path = (imagePath ?? '').trim();
                    final hasImage = path.isNotEmpty;
                    if (!hasImage) {
                      return Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 48,
                            height: 48,
                            decoration: const BoxDecoration(
                              color: Color(0xFFFFE6E7),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.camera_alt,
                              color: Color(0xffF2051F),
                              size: 24,
                            ),
                          ).paddingOnly(bottom: 4),
                          CommonText.medium(
                            'Tap to add a photo of your vehicle',
                            size: 13,
                            color: const Color(0xff5B5B5B),
                          ),
                          const SizedBox(height: 6),
                          CommonText.regular(
                            'Optional',
                            size: 12,
                            color: const Color(0xff667085),
                          ),
                        ],
                      );
                    }
                    return ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: path.startsWith('http')
                          ? Image.network(
                              path,
                              fit: BoxFit.cover,
                              width: double.infinity,
                              height: double.infinity,
                              cacheWidth: 800,
                              cacheHeight: 800,
                            )
                          : Image.file(
                              File(path),
                              fit: BoxFit.cover,
                              width: double.infinity,
                              height: double.infinity,
                              cacheWidth: 800,
                              cacheHeight: 800,
                            ),
                    );
                  },
                ),
              ),
            ),
          ),
        ],
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
        final end = math.min(next, metric.length);
        if (index.isEven) {
          final extract = metric.extractPath(distance, end);
          canvas.drawPath(extract, paint);
        }
        distance = end + gap;
        index++;
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
