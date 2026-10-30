import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../network/response/vehicle_catalog_response.dart';
import '../utils/vehicle_catalog.dart';
import '../utils/vehicle_catalog_cache.dart';
import 'text_field.dart';

/// Shared make/model dropdown + "Other" text fields for customer vehicle forms.
mixin VehicleMakeModelMixin on GetxController {
  final vehicleCatalogMakes = <VehicleCatalogMake>[].obs;
  final selectedVehicleMake = RxnString();
  final selectedVehicleModel = RxnString();
  final vehicleMakeOtherController = TextEditingController();
  final vehicleModelOtherController = TextEditingController();

  List<String> get vehicleMakeDropdownItems => [
        ...VehicleCatalog.makeLabels(vehicleCatalogMakes),
        VehicleCatalog.other,
      ];

  List<String> get vehicleModelDropdownItems => [
        ...VehicleCatalog.modelLabelsForMake(
          vehicleCatalogMakes,
          selectedVehicleMake.value,
        ),
        VehicleCatalog.other,
      ];

  bool get vehicleMakeIsOther => VehicleCatalog.isOther(selectedVehicleMake.value);

  bool get vehicleModelIsOther =>
      !vehicleMakeIsOther && VehicleCatalog.isOther(selectedVehicleModel.value);

  String? get resolvedVehicleMake => VehicleCatalog.resolveValue(
        selected: selectedVehicleMake.value,
        otherText: vehicleMakeOtherController.text,
      );

  String? get resolvedVehicleModel {
    if (vehicleMakeIsOther) {
      return VehicleCatalog.resolveValue(
        selected: VehicleCatalog.other,
        otherText: vehicleModelOtherController.text,
      );
    }
    return VehicleCatalog.resolveValue(
      selected: selectedVehicleModel.value,
      otherText: vehicleModelOtherController.text,
    );
  }

  Future<void> loadVehicleCatalog() async {
    await VehicleCatalogCache.syncFromApi();
    vehicleCatalogMakes.assignAll(VehicleCatalogCache.makes);
  }

  void resetVehicleMakeModelFields() {
    selectedVehicleMake.value = null;
    selectedVehicleModel.value = null;
    vehicleMakeOtherController.clear();
    vehicleModelOtherController.clear();
  }

  void onVehicleMakeChosen(String? value) {
    if (value == null || value.trim().isEmpty) return;
    selectedVehicleMake.value = value.trim();
    selectedVehicleModel.value = null;
    vehicleModelOtherController.clear();
    if (!VehicleCatalog.isOther(value)) {
      vehicleMakeOtherController.clear();
    }
  }

  void onVehicleModelChosen(String? value) {
    if (value == null || value.trim().isEmpty) return;
    selectedVehicleModel.value = value.trim();
    if (!VehicleCatalog.isOther(value)) {
      vehicleModelOtherController.clear();
    }
  }

  void applyStoredVehicleMakeModel({String? make, String? model}) {
    VehicleCatalog.applyStoredMakeModel(
      makes: vehicleCatalogMakes,
      storedMake: make,
      storedModel: model,
      setMake: (v) => selectedVehicleMake.value = v,
      setModel: (v) => selectedVehicleModel.value = v,
      setMakeOther: (v) => vehicleMakeOtherController.text = v,
      setModelOther: (v) => vehicleModelOtherController.text = v,
      clearMakeOther: vehicleMakeOtherController.clear,
      clearModelOther: vehicleModelOtherController.clear,
    );
  }

  void disposeVehicleMakeModelFields() {
    vehicleMakeOtherController.dispose();
    vehicleModelOtherController.dispose();
  }
}

class VehicleMakeModelFields extends StatelessWidget {
  const VehicleMakeModelFields({
    super.key,
    required this.selectedMake,
    required this.selectedModel,
    required this.makeItems,
    required this.modelItems,
    required this.onMakeSave,
    required this.onModelSave,
    required this.makeOtherController,
    required this.modelOtherController,
    required this.fieldRadius,
    required this.inputFill,
    required this.border,
    required this.hint,
    required this.labelColor,
    this.gridGap = 12,
    this.includeValidators = false,
    this.iconColor,
    this.dropdownBgColor,
    this.dropdownItemTextColor,
    this.hPadding,
    this.vPadding,
  });

  final String? selectedMake;
  final String? selectedModel;
  final List<String> makeItems;
  final List<String> modelItems;
  final ValueChanged<String?> onMakeSave;
  final ValueChanged<String?> onModelSave;
  final TextEditingController makeOtherController;
  final TextEditingController modelOtherController;
  final double fieldRadius;
  final Color inputFill;
  final Color border;
  final Color hint;
  final Color labelColor;
  final double gridGap;
  final bool includeValidators;
  final Color? iconColor;
  final Color? dropdownBgColor;
  final Color? dropdownItemTextColor;
  final num? hPadding;
  final num? vPadding;

  Widget _dropdown({
    required String hintText,
    required String? selectedValue,
    required List<String> items,
    required String errorText,
    required ValueChanged<String?> onSave,
    bool isRequired = false,
    String labelText = '',
  }) {
    return CommonDropDownField(
      hintText: hintText,
      labelText: labelText,
      isRequired: isRequired,
      selectedValue: selectedValue,
      items: items,
      errorText: errorText,
      borderRadius: fieldRadius,
      bgColor: inputFill,
      borderColor: border,
      hintColor: hint,
      selectedTextColor: labelColor,
      labelColor: labelColor,
      iconColor: iconColor ?? labelColor,
      dropdownBgColor: dropdownBgColor,
      dropdownItemTextColor: dropdownItemTextColor,
      hPadding: hPadding,
      vPadding: vPadding,
      onSave: onSave,
    );
  }

  @override
  Widget build(BuildContext context) {
    final makeIsOther = VehicleCatalog.isOther(selectedMake);
    final modelIsOther =
        !makeIsOther && VehicleCatalog.isOther(selectedModel);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _dropdown(
                hintText: 'Make (e.g. Toyota)',
                labelText: 'Make',
                isRequired: true,
                selectedValue: selectedMake,
                items: makeItems,
                errorText: 'Please select vehicle make',
                onSave: onMakeSave,
              ),
            ),
            if (!makeIsOther) ...[
              SizedBox(width: gridGap),
              Expanded(
                child: _dropdown(
                  hintText: 'Model (e.g. Camry)',
                  labelText: 'Model',
                  isRequired: true,
                  selectedValue: selectedModel,
                  items: modelItems,
                  errorText: 'Please select vehicle model',
                  onSave: onModelSave,
                ),
              ),
            ],
          ],
        ),
        if (makeIsOther) ...[
          SizedBox(height: gridGap),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: CommonTextField(
                  controller: makeOtherController,
                  labelText: '',
                  hintText: 'Enter your vehicle make (e.g. Rivian)',
                  borderRadius: fieldRadius,
                  bgColor: inputFill,
                  textColor: labelColor,
                  hintColor: hint,
                  borderColor: border,
                  padding: 14,
                  validator: includeValidators
                      ? (value) {
                          if (!VehicleCatalog.isOther(selectedMake)) {
                            return null;
                          }
                          if ((value ?? '').trim().isEmpty) {
                            return 'Please enter vehicle make';
                          }
                          return null;
                        }
                      : null,
                ),
              ),
              SizedBox(width: gridGap),
              Expanded(
                child: CommonTextField(
                  controller: modelOtherController,
                  labelText: '',
                  hintText: 'Enter your vehicle model (e.g. R1T)',
                  borderRadius: fieldRadius,
                  bgColor: inputFill,
                  textColor: labelColor,
                  hintColor: hint,
                  borderColor: border,
                  padding: 14,
                  validator: includeValidators
                      ? (value) {
                          if (!VehicleCatalog.isOther(selectedMake)) {
                            return null;
                          }
                          if ((value ?? '').trim().isEmpty) {
                            return 'Please enter vehicle model';
                          }
                          return null;
                        }
                      : null,
                ),
              ),
            ],
          ),
        ] else if (modelIsOther) ...[
          SizedBox(height: gridGap),
          CommonTextField(
            controller: modelOtherController,
            labelText: '',
            hintText: 'Enter your vehicle model (e.g. R1T)',
            borderRadius: fieldRadius,
            bgColor: inputFill,
            textColor: labelColor,
            hintColor: hint,
            borderColor: border,
            padding: 14,
            validator: includeValidators
                ? (value) {
                    if (!VehicleCatalog.isOther(selectedModel)) {
                      return null;
                    }
                    if ((value ?? '').trim().isEmpty) {
                      return 'Please enter vehicle model';
                    }
                    return null;
                  }
                : null,
          ),
        ],
      ],
    );
  }
}
