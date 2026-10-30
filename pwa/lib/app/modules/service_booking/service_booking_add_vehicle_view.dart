import 'package:car_comfort/app/utils/extensions/extension.dart';
import 'package:car_comfort/app/utils/validator.dart';
import 'package:car_comfort/app/utils/vehicle_colors.dart';
import 'package:car_comfort/app/widgets/text.dart';
import 'package:car_comfort/app/widgets/text_field.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../routes/app_pages.dart';
import '../../widgets/blurred_image_screen_header.dart';
import '../../widgets/vehicle_make_model_fields.dart';
import '../../widgets/button.dart';
import 'service_booking_controller.dart';

class ServiceBookingAddVehicleView extends GetView<ServiceBookingController> {
  const ServiceBookingAddVehicleView({super.key});

  static const Color _inputFill = Colors.white;
  static const Color _labelColor = Color(0xff1C1C1E);
  static const double _fieldRadius = 10;
  static const double _gridGap = 12;

  Color _fieldBorder(BuildContext context) =>
      const Color(0xffC7C7CC);

  Color _hintColor(BuildContext context) =>
      context.colorScheme.outlineVariant;

  @override
  Widget build(BuildContext context) {
    const red = ServiceBookingController.brandRed;
    final hint = _hintColor(context);
    final border = _fieldBorder(context);

    return Scaffold(
      backgroundColor: Colors.white,
      body: Column(
        children: [
          BlurredImageScreenHeader(
            title: 'Add New Vehicle',
            backgroundFit: BoxFit.fill,
            trailing: HeaderCircleIconButton(
              icon: Icons.notifications_none_rounded,
              onTap: () => Get.toNamed(Routes.NOTIFICATIONS),
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Obx(
                () {
                  final y = controller.selectedYear.value;
                  final c = controller.selectedColor.value;
                  final t = controller.selectedType.value;
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const CommonText.bold(
                        'Vehicle Information',
                        size: 16,
                        color: _labelColor,
                      ),
                      const SizedBox(height: 12),
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
                      ),
                      const SizedBox(height: _gridGap),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Expanded(
                            child: CommonDropDownField(
                              hintText: 'Select Vehicle Year',
                              selectedValue: y,
                              items: controller.years,
                              errorText: 'Please select year',
                              borderRadius: _fieldRadius,
                              bgColor: _inputFill,
                              borderColor: border,
                              hintColor: hint,
                              selectedTextColor: _labelColor,
                              onSave: (v) => controller.selectedYear.value = v,
                            ),
                          ),
                          const SizedBox(width: _gridGap),
                          Expanded(
                            child: CommonDropDownField(
                              hintText: 'Select Vehicle Color',
                              selectedValue: c,
                              items: controller.colors,
                              errorText: 'Please select color',
                              borderRadius: _fieldRadius,
                              bgColor: _inputFill,
                              borderColor: border,
                              hintColor: hint,
                              selectedTextColor: _labelColor,
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
                          hintText: 'Enter vehicle color',
                          borderRadius: _fieldRadius,
                          bgColor: _inputFill,
                          textColor: _labelColor,
                          hintColor: hint,
                          borderColor: border,
                          padding: 14,
                        ),
                      ],
                      const SizedBox(height: _gridGap),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Expanded(
                            child: CommonDropDownField(
                              hintText: 'Select Vehicle Type',
                              selectedValue: t,
                              items: controller.types,
                              errorText: 'Please select vehicle type',
                              borderRadius: _fieldRadius,
                              bgColor: _inputFill,
                              borderColor: border,
                              hintColor: hint,
                              selectedTextColor: _labelColor,
                              onSave: (v) => controller.selectedType.value = v,
                            ),
                          ),
                          const SizedBox(width: _gridGap),
                          Expanded(
                            child: CommonTextField(
                              controller: controller.vehicleNicknameController,
                              labelText: '',
                              hintText: 'Vehicle Nickname',
                              borderRadius: _fieldRadius,
                              bgColor: _inputFill,
                              textColor: _labelColor,
                              hintColor: hint,
                              borderColor: border,
                              padding: 14,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      const CommonText.bold(
                        'Input Vehicle License Plate',
                        size: 14,
                        color: _labelColor,
                      ),
                      const SizedBox(height: 8),
                      CommonTextField(
                        controller: controller.vehiclePlateController,
                        labelText: '',
                        hintText: 'ABC 1234',
                        borderRadius: _fieldRadius,
                        bgColor: _inputFill,
                        textColor: _labelColor,
                        hintColor: hint,
                        borderColor: border,
                        textCapitalization: TextCapitalization.characters,
                        inputFormatters: licensePlateInputFormatters,
                      ),
                      const SizedBox(height: 20),
                      const CommonText.bold(
                        'Vehicle Notes (Optional)',
                        size: 14,
                        color: _labelColor,
                      ),
                      const SizedBox(height: 8),
                      CommonTextField(
                        controller: controller.vehicleNotesController,
                        labelText: '',
                        hintText:
                            'Leave any specific instructions our service provider should need to find your vehicle, where they should leave your vehicle, or anything you think they should know.',
                        maxLines: 7,
                        minLines: 5,
                        keyboardType: TextInputType.multiline,
                        inputAction: TextInputAction.newline,
                        borderRadius: _fieldRadius,
                        bgColor: _inputFill,
                        textColor: _labelColor,
                        hintColor: hint,
                        borderColor: border,
                      ),
                    ],
                  );
                },
              ),
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(
              20,
              0,
              20,
              16 + MediaQuery.paddingOf(context).bottom,
            ),
            child: SizedBox(
              width: double.infinity,
              child: AppButton(
                label: 'Save Vehicle',
                onPressed: controller.saveNewVehicle,
                type: ButtonType.primary,
                bgColor: red,
                txtColor: Colors.white,
                btnCornerRadius: 30,
                vPadding: 16,
                textSize: 16,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
