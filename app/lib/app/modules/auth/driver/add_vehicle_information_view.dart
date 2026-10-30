import 'package:car_comfort/app/utils/extensions/extension.dart';
import 'package:car_comfort/app/utils/validator.dart';
import 'package:car_comfort/app/utils/vehicle_colors.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';

import '../../../gen/assets.gen.dart';
import '../../../widgets/button.dart';
import '../../../widgets/text.dart';
import '../../../widgets/text_field.dart';
import '../../../widgets/vehicle_make_model_fields.dart';
import '../../../routes/app_pages.dart';
import '../../../utils/role_switch_signup_flow.dart';
import 'driver_signup_controller.dart';

/// Driver onboarding — vehicle details form (step 4).
class AddVehicleInformationView extends StatelessWidget {
  const AddVehicleInformationView({super.key});

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(
        systemNavigationBarIconBrightness: Brightness.light,
        systemNavigationBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
        statusBarColor: Colors.transparent,
      ),
      child: PopScope(
        // Always allow the back gesture/button; handle navigation ourselves
        // so it works whether the screen is a root or has a stack behind it.
        canPop: false,
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop) _goBack();
        },
        child: Scaffold(
          resizeToAvoidBottomInset: true,
          body: GestureDetector(
            behavior: HitTestBehavior.translucent,
            onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
            child: Stack(
              fit: StackFit.expand,
              children: const [
                RepaintBoundary(child: _VehicleSignupBackdrop()),
                SafeArea(child: _VehicleScrollForm()),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Navigates back to the driver licence screen.
/// Uses [Get.offAllNamed] so it works even when the Add Vehicle screen is
/// the root of the navigation stack (e.g. cold-start resume at step 3).
void _goBack() {
  if (Get.currentRoute == Routes.ADD_VEHICLE_INFORMATION) {
    Get.offAllNamed(Routes.UPLOAD_DRIVER_LICENSE);
  }
}

class _VehicleSignupBackdrop extends StatelessWidget {
  const _VehicleSignupBackdrop();

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        Positioned.fill(
          child: Assets.imagesSignupBg.image(
            fit: BoxFit.cover,
            filterQuality: FilterQuality.medium,
          ),
        ),
        Positioned.fill(
          child: ColoredBox(
            color: context.colorScheme.scrim.withValues(alpha: 0.2),
          ),
        ),
      ],
    );
  }
}

class _VehicleScrollForm extends StatefulWidget {
  const _VehicleScrollForm();

  @override
  State<_VehicleScrollForm> createState() => _VehicleScrollFormState();
}

class _VehicleScrollFormState extends State<_VehicleScrollForm> {
  late final Widget _form = _VehicleInformationForm(
    controller: Get.find<DriverSignupController>(),
  );

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: EdgeInsets.fromLTRB(14, 0, 14, 24 + bottomInset),
      child: _form,
    );
  }
}

class _VehicleInformationForm extends StatelessWidget {
  const _VehicleInformationForm({required this.controller});

  final DriverSignupController controller;

  static const _fieldBgColor = Color(0xFF2C2C2E);
  static const _dropdownMenuBgColor = Color(0xFFF2F2F7);
  static const double _fieldRadius = 20;
  static const double _gridGap = 10;

  @override
  Widget build(BuildContext context) {
    final onPrimary = context.colorScheme.onPrimary;
    final scrim = context.colorScheme.scrim;

    return Form(
      key: controller.vehicleFormKey,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 8),
          _VehicleFormHeader(onPrimary: onPrimary),
          const SizedBox(height: 48),
          CommonText.bold(
            'Select Vehicle Type',
            color: onPrimary,
            size: 14,
          ),
          const SizedBox(height: 8),
          Obx(
            () => CommonDropDownField(
              hintText: 'Select vehicle type (e.g. Sedan, SUV)',
              selectedValue: controller.selectedVehicleType.value,
              items: controller.vehicleTypeDropdownItems,
              onSave: controller.onVehicleTypeChosen,
              errorText: 'Please select vehicle type',
              borderRadius: _fieldRadius,
              borderColor: onPrimary,
              bgColor: _fieldBgColor,
              dropdownBgColor: _dropdownMenuBgColor,
              dropdownItemTextColor: scrim,
              selectedTextColor: onPrimary,
              iconColor: onPrimary,
              hPadding: 12,
              vPadding: 12,
            ),
          ),
          Obx(() {
            if (!controller.vehicleTypeIsOther) {
              return const SizedBox.shrink();
            }
            return Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: _gridGap),
                CommonTextField(
                  controller: controller.vehicleTypeOtherController,
                  hintText: 'Enter your vehicle type (e.g. Convertible)',
                  keyboardType: TextInputType.text,
                  textColor: onPrimary,
                  cursorColor: onPrimary,
                  hintColor: Colors.white70,
                  bgColor: _fieldBgColor,
                  borderRadius: _fieldRadius,
                  padding: 12,
                  validator: (v) {
                    if (!controller.vehicleTypeIsOther) return null;
                    if ((v ?? '').trim().isEmpty) {
                      return 'Please enter your vehicle type';
                    }
                    return null;
                  },
                ),
              ],
            );
          }),
          const SizedBox(height: 18),
          CommonText.bold(
            'Vehicle Information',
            color: onPrimary,
            size: 16,
          ),
          const SizedBox(height: 12),
          Obx(
            () => VehicleMakeModelFields(
              selectedMake: controller.selectedVehicleMake.value,
              selectedModel: controller.selectedVehicleModel.value,
              makeItems: controller.vehicleMakeDropdownItems,
              modelItems: controller.vehicleModelDropdownItems,
              onMakeSave: controller.onVehicleMakeChosen,
              onModelSave: controller.onVehicleModelChosen,
              makeOtherController: controller.vehicleMakeOtherController,
              modelOtherController: controller.vehicleModelOtherController,
              fieldRadius: _fieldRadius,
              inputFill: _fieldBgColor,
              border: onPrimary,
              hint: Colors.white70,
              labelColor: onPrimary,
              gridGap: _gridGap,
              includeValidators: true,
              iconColor: onPrimary,
              dropdownBgColor: _dropdownMenuBgColor,
              dropdownItemTextColor: scrim,
              hPadding: 12,
              vPadding: 12,
            ),
          ),
          const SizedBox(height: _gridGap),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Obx(
                  () => CommonDropDownField(
                    hintText: 'Select manufacturing year',
                    selectedValue: controller.selectedVehicleYear.value,
                    items: controller.vehicleYears,
                    onSave: (v) => controller.selectedVehicleYear.value = v,
                    errorText: 'Please select year',
                    borderRadius: _fieldRadius,
                    borderColor: onPrimary,
                    bgColor: _fieldBgColor,
                    dropdownBgColor: _dropdownMenuBgColor,
                    dropdownItemTextColor: scrim,
                    selectedTextColor: onPrimary,
                    iconColor: onPrimary,
                    hPadding: 12,
                    vPadding: 12,
                  ),
                ),
              ),
              const SizedBox(width: _gridGap),
              Expanded(
                child: Obx(
                  () => CommonDropDownField(
                    hintText: 'Select vehicle color',
                    selectedValue: controller.selectedVehicleColor.value,
                    items: controller.vehicleColorOptions,
                    onSave: controller.onVehicleColorChosen,
                    errorText: 'Please select color',
                    borderRadius: _fieldRadius,
                    borderColor: onPrimary,
                    bgColor: _fieldBgColor,
                    dropdownBgColor: _dropdownMenuBgColor,
                    dropdownItemTextColor: scrim,
                    selectedTextColor: onPrimary,
                    iconColor: onPrimary,
                    hPadding: 12,
                    vPadding: 12,
                  ),
                ),
              ),
            ],
          ),
          Obx(() {
            if (!VehicleColors.isOther(controller.selectedVehicleColor.value)) {
              return const SizedBox.shrink();
            }
            return Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: _gridGap),
                CommonTextField(
                  controller: controller.vehicleCustomColorController,
                  hintText: 'Enter your vehicle color (e.g. Matte Gray)',
                  keyboardType: TextInputType.text,
                  textColor: onPrimary,
                  cursorColor: onPrimary,
                  hintColor: Colors.white70,
                  bgColor: _fieldBgColor,
                  borderRadius: _fieldRadius,
                  padding: 12,
                  validator: (v) {
                    if (!VehicleColors.isOther(
                      controller.selectedVehicleColor.value,
                    )) {
                      return null;
                    }
                    if (v == null || v.trim().isEmpty) {
                      return 'Please enter your vehicle color';
                    }
                    return null;
                  },
                ),
              ],
            );
          }),
          const SizedBox(height: 18),
          CommonText.bold(
            'Input Vehicle License Plate',
            color: onPrimary,
            size: 16,
          ),
          const SizedBox(height: 12),
          CommonTextField(
            controller: controller.vehicleLicensePlateController,
            hintText: 'Enter license plate number (e.g. ABC 1234)',
            keyboardType: TextInputType.text,
            textCapitalization: TextCapitalization.characters,
            textColor: onPrimary,
            cursorColor: onPrimary,
            hintColor: Colors.white70,
            bgColor: _fieldBgColor,
            borderRadius: _fieldRadius,
            padding: 12,
            inputFormatters: licensePlateInputFormatters,
            validator: validateLicensePlate,
          ),
          const SizedBox(height: 18),
          CommonText.bold(
            'Fuel type',
            color: onPrimary,
            size: 14,
          ),
          const SizedBox(height: 8),
          Obx(
            () => CommonDropDownField(
              hintText: 'Select fuel type (Gas, Diesel, or Electric)',
              selectedValue: controller.selectedFuelType.value,
              items: DriverSignupController.fuelTypeOptions,
              onSave: controller.onFuelTypeChosen,
              errorText: 'Please select fuel type',
              borderRadius: _fieldRadius,
              borderColor: onPrimary,
              bgColor: _fieldBgColor,
              dropdownBgColor: _dropdownMenuBgColor,
              dropdownItemTextColor: scrim,
              selectedTextColor: onPrimary,
              iconColor: onPrimary,
              hPadding: 12,
              vPadding: 12,
            ),
          ),
          const SizedBox(height: 32),
          Obx(
            () => AppButton(
              label: controller.isLoading.value
                  ? 'Please wait...'
                  : 'Save Vehicle',
              onPressed: controller.isLoading.value
                  ? null
                  : controller.saveVehicleInformation,
              bgColor: const Color(0xffF2051F),
              btnCornerRadius: 14,
            ),
          ),
          const SizedBox(height: 12),
        ],
      ),
    );
  }
}

class _VehicleFormHeader extends StatelessWidget {
  const _VehicleFormHeader({required this.onPrimary});

  final Color onPrimary;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Stack(
          alignment: Alignment.center,
          children: [
            Align(
              alignment: Alignment.centerLeft,
              child: InkWell(
                onTap: _goBack,
                borderRadius: BorderRadius.circular(20),
                child: Assets.imagesBack.image(
                  width: 26,
                  height: 26,
                  fit: BoxFit.contain,
                ),
              ),
            ),
            Assets.launcherLogo.image(
              width: 120,
              fit: BoxFit.contain,
            ),
            Align(
              alignment: Alignment.centerRight,
              child: InkWell(
                onTap: () => RoleSwitchSignupFlow.cancelProviderSignup(),
                borderRadius: BorderRadius.circular(20),
                child: CommonText.medium(
                  'Cancel Signup',
                  color: onPrimary.withValues(alpha: 0.75),
                  size: 13,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 28),
        CommonText.medium(
          'Add Vehicle Information',
          color: onPrimary,
          size: 18,
        ),
      ],
    );
  }
}
