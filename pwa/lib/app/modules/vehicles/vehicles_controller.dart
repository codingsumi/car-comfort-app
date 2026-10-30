import 'package:car_comfort/app/network/response/vehicle_type_response.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../models/vehicle_model.dart';
import '../../network/repository/vehicle_repository.dart';
import '../../network/utils/network_result.dart';
import 'package:dio/dio.dart' as dio;
import '../../utils/image_upload_compress.dart';
import '../../utils/pref.dart';
import '../../utils/validator.dart';
import '../../utils/vehicle_colors.dart';
import '../../utils/app_snackbar.dart';
import '../../utils/custom_loader.dart';
import '../../utils/vehicle_types_cache.dart';
import '../../utils/vehicle_types.dart';
import '../../widgets/vehicle_make_model_fields.dart';
import '../../widgets/widgets.dart';

class VehiclesController extends GetxController with VehicleMakeModelMixin {
  static const List<String> fuelTypeOptions = ['GAS', 'DIESEL', 'ELECTRIC'];

  final _vehicleRepo = VehicleRepository();
  final myVehicles = <VehicleModel>[].obs;
  final getVehiclesType = <VehicleTypeResponse>[].obs;
  final vehicleList = <VehicleList>[].obs;
  late List<String> typeList = [];
  final isLoadingVehicles = false.obs;
  final isDeleteVehicles = false.obs;
  /// Non-null while a "set default" PATCH is in flight for that vehicle id.
  final settingDefaultVehicleId = Rxn<int>();

  final vehicleNicknameController = TextEditingController();
  final vehiclePlateController = TextEditingController();
  final vehicleBatteryKwhController = TextEditingController();
  final vehicleCustomColorController = TextEditingController();
  final vehicleTypeOtherController = TextEditingController();
  final vehicleNotesController = TextEditingController();

  final years = List.generate(35, (i) => '${DateTime.now().year - i}');
  List<String> get colors => VehicleColors.pickerOptions;
  final types = ['Sedan', 'SUV', 'Truck', 'Coupe', 'Van'];

  final selectedYear = RxnString();
  final selectedColor = RxnString();
  final selectedType = RxnString();
  final selectedFuelType = RxnString();
  final selectedVehiclePhotoPath = RxnString();
  final vehicleFormKey = GlobalKey<FormState>();

  final isEditMode = false.obs;
  VehicleModel? editingVehicle;

  List<String> get vehicleTypeDropdownItems {
    if (typeList.isEmpty) return const [];
    return VehicleTypes.pickerOptionsFrom(typeList);
  }

  bool get vehicleTypeIsOther => VehicleTypes.isOther(selectedType.value);

  String? get resolvedVehicleType => VehicleTypes.resolveForApi(
        selectedPickerValue: selectedType.value,
        customTypeText: vehicleTypeOtherController.text,
      );

  /// Canonical catalog name for API (spacing/casing); custom types pass through.
  String? canonicalVehicleTypeForApi(String? resolvedType) {
    final raw = (resolvedType ?? '').trim();
    if (raw.isEmpty) return null;

    for (final type in typeList) {
      if (type.trim().toLowerCase() == raw.toLowerCase()) {
        return type;
      }
    }

    final collapsed = raw.replaceAll(RegExp(r'\s+'), ' ');
    for (final type in typeList) {
      final catalog = type.trim().replaceAll(RegExp(r'\s+'), ' ');
      if (catalog.toLowerCase() == collapsed.toLowerCase()) {
        return type;
      }
    }

    String normalizeKey(String value) =>
        value.toLowerCase().replaceAll(RegExp(r'[\s-]+'), '');
    final rawKey = normalizeKey(raw);
    for (final type in typeList) {
      if (normalizeKey(type) == rawKey) {
        return type;
      }
    }

    return raw;
  }

  @override
  void onInit() {
    super.onInit();
    if (!Prefs().isCustomerRole) {
      return;
    }
    _loadVehicleTypesFromCache();
    _fetchVehicles();
    getVehicleType(silent: true);
    loadVehicleCatalog();
  }

  @override
  void onClose() {
    disposeVehicleMakeModelFields();
    vehicleNicknameController.dispose();
    vehiclePlateController.dispose();
    vehicleBatteryKwhController.dispose();
    vehicleCustomColorController.dispose();
    vehicleTypeOtherController.dispose();
    vehicleNotesController.dispose();
    super.onClose();
  }

  Future<void> _fetchVehicles() async {
    if (!Prefs().isCustomerRole) {
      return;
    }
    isLoadingVehicles.value = true;
    final res = await _vehicleRepo.getVehicles();
    isLoadingVehicles.value = false;
    res.when(
      success: (data) {
        if (data.isNotEmpty && !data.any((v) => v.isDefault)) {
          myVehicles.value = [
            data.first.copyWith(isDefault: true),
            ...data.skip(1).map((v) => v.copyWith(isDefault: false)),
          ];
        } else {
          myVehicles.value = data;
        }
      },
      error: (e) {
        showAppSnackBar(
          title: 'Error',
          message: e.message.isNotEmpty ? e.message : 'Failed to fetch vehicles',
          isError: true,
        );
      },
    );
  }

  void _applyVehicleTypes(List<VehicleList> list) {
    vehicleList.value = list;
    typeList = VehicleTypesCache.namesFrom(list);
  }

  void _loadVehicleTypesFromCache() {
    final cached = VehicleTypesCache.read();
    if (cached.isNotEmpty) {
      _applyVehicleTypes(cached);
    }
  }

  Future<void> getVehicleType({bool silent = false}) async {
    if (vehicleList.isEmpty) {
      _loadVehicleTypesFromCache();
    }

    final res = await _vehicleRepo.getVehicleType();
    res.when(
      success: (data) {
        final list = data.data;
        if (list != null && list.isNotEmpty) {
          _applyVehicleTypes(list);
          VehicleTypesCache.save(list);
        }
      },
      error: (e) {
        if (vehicleList.isEmpty) {
          _loadVehicleTypesFromCache();
        }
        if (!silent && VehicleTypesCache.read().isEmpty) {
          showAppSnackBar(
            title: 'Error',
            message: e.message.isNotEmpty ? e.message : 'Failed to load vehicle types',
            isError: true,
          );
        }
      },
    );
  }

  Future<void> openAddVehicle() async {
    await loadVehicleCatalog();
    await getVehicleType(silent: true);
    if (typeList.isEmpty) {
      showAppSnackBar(
        title: 'Vehicle types',
        message: 'Could not load vehicle types. Please try again.',
        isError: true,
      );
      return;
    }
    isEditMode.value = false;
    editingVehicle = null;
    resetVehicleMakeModelFields();
    vehicleNicknameController.clear();
    vehiclePlateController.clear();
    vehicleBatteryKwhController.clear();
    vehicleCustomColorController.clear();
    vehicleTypeOtherController.clear();
    vehicleNotesController.clear();
    selectedYear.value = null;
    selectedColor.value = null;
    selectedType.value = null;
    selectedFuelType.value = null;
    selectedVehiclePhotoPath.value = null;
    Get.toNamed('/add-vehicle');
  }

  Future<void> openEditVehicle(VehicleModel vehicle) async {
    await loadVehicleCatalog();
    isEditMode.value = true;
    editingVehicle = vehicle;
    applyStoredVehicleMakeModel(make: vehicle.make, model: vehicle.model);
    vehicleNicknameController.text = vehicle.nickname ?? '';
    vehiclePlateController.text = vehicle.licensePlate ?? '';
    _applyFuelTypeFromVehicle(vehicle);
    if (selectedFuelType.value == 'ELECTRIC') {
      vehicleBatteryKwhController.text = vehicle.batteryCapacityKwh ?? '';
    } else {
      vehicleBatteryKwhController.clear();
    }

    final rawYear = '${vehicle.year ?? ''}'.trim();
    selectedYear.value = years.contains(rawYear) ? rawYear : null;
    final rawColor = '${vehicle.color ?? ''}'.trim();
    selectedColor.value = VehicleColors.pickerValueFromStored(rawColor);
    vehicleCustomColorController.text =
        VehicleColors.customValueFromStored(rawColor) ?? '';
    final rawType = (vehicle.vehicleType ?? '').trim();
    if (rawType.isEmpty) {
      selectedType.value = null;
      vehicleTypeOtherController.clear();
    } else {
      selectedType.value =
          VehicleTypes.pickerValueFromStored(rawType, typeList);
      vehicleTypeOtherController.text =
          VehicleTypes.customValueFromStored(rawType, typeList) ?? '';
    }
    final images = vehicle.images ?? const <Images>[];
    if (images.isNotEmpty) {
      final first = images.first;
      final resolved = (first.url ?? first.imagePath ?? '').trim();
      selectedVehiclePhotoPath.value = resolved.isEmpty ? null : resolved;
    } else {
      selectedVehiclePhotoPath.value = null;
    }
    Get.toNamed('/add-vehicle');
  }

  void _applyFuelTypeFromVehicle(VehicleModel vehicle) {
    final raw = (vehicle.fuelType ?? '').trim().toLowerCase();
    if (raw.isEmpty) {
      selectedFuelType.value = null;
      return;
    }
    for (final o in fuelTypeOptions) {
      if (o.toLowerCase() == raw) {
        selectedFuelType.value = o;
        return;
      }
    }
    if (raw.contains('electric') || raw == 'ev' || raw == 'bev') {
      selectedFuelType.value = 'ELECTRIC';
      return;
    }
    selectedFuelType.value = 'OTHER';
  }

  void onVehicleTypeChosen(String? value) {
    if (value == null || value.trim().isEmpty) return;
    selectedType.value = value.trim();
    if (!VehicleTypes.isOther(value)) {
      vehicleTypeOtherController.clear();
    }
  }

  void onVehicleColorChosen(String? value) {
    if (value == null || value.trim().isEmpty) return;
    selectedColor.value = value.trim();
    if (!VehicleColors.isOther(value)) {
      vehicleCustomColorController.clear();
    }
  }

  String? get resolvedVehicleColor => VehicleColors.resolveForApi(
        selectedPickerValue: selectedColor.value,
        customColorText: vehicleCustomColorController.text,
      );

  void onFuelTypeChosen(String? value) {
    if (value == null || value.trim().isEmpty) return;
    selectedFuelType.value = value.trim();
    if (selectedFuelType.value != 'ELECTRIC') {
      vehicleBatteryKwhController.clear();
    }
  }

  Future<void> pickVehiclePhoto(BuildContext context) async {
    await attachmentDialog(
      context,
      cameraClick: () async {
        final path = await pickPicture(isCamera: true);
        if (path == null || path.trim().isEmpty) return;
        selectedVehiclePhotoPath.value = path.trim();
      },
      galleryClick: () async {
        final path = await pickPicture(isCamera: false);
        if (path == null || path.trim().isEmpty) return;
        selectedVehiclePhotoPath.value = path.trim();
      },
    );
  }

  void saveNewVehicle() async {
    final form = vehicleFormKey.currentState;
    if (form == null || !form.validate()) {
      return;
    }

    if ((selectedVehicleMake.value ?? '').trim().isEmpty) {
      showAppSnackBar(
        title: 'Vehicle',
        message: 'Please select vehicle make.',
        isError: true,
      );
      return;
    }
    if (!vehicleMakeIsOther &&
        (selectedVehicleModel.value ?? '').trim().isEmpty) {
      showAppSnackBar(
        title: 'Vehicle',
        message: 'Please select vehicle model.',
        isError: true,
      );
      return;
    }
    if ((selectedType.value ?? '').trim().isEmpty) {
      showAppSnackBar(
        title: 'Vehicle',
        message: 'Please select vehicle type.',
        isError: true,
      );
      return;
    }

    final y = selectedYear.value ?? '';
    final mk = resolvedVehicleMake;
    final md = resolvedVehicleModel;
    if (mk == null || mk.isEmpty || md == null || md.isEmpty) {
      showAppSnackBar(
        title: 'Vehicle',
        message: 'Please select or enter vehicle make and model.',
        isError: true,
      );
      return;
    }
    final col = resolvedVehicleColor;
    if (col == null || col.isEmpty) {
      showAppSnackBar(
        title: 'Vehicle color',
        message: VehicleColors.isOther(selectedColor.value)
            ? 'Please enter your vehicle color.'
            : 'Please select a vehicle color.',
        isError: true,
      );
      return;
    }
    final type = canonicalVehicleTypeForApi(resolvedVehicleType);
    if (type == null || type.isEmpty) {
      showAppSnackBar(
        title: 'Vehicle type',
        message: VehicleTypes.isOther(selectedType.value)
            ? 'Please enter your vehicle type.'
            : 'Please select a vehicle type.',
        isError: true,
      );
      return;
    }
    final plate = normalizeLicensePlate(vehiclePlateController.text);
    final nick = vehicleNicknameController.text.trim();
    final fuel = selectedFuelType.value?.trim() ?? '';
    final batKwh = vehicleBatteryKwhController.text.trim();

    final formData = dio.FormData.fromMap({
      'vehicle_type': type,
      'make': mk,
      'model': md,
      if (y.isNotEmpty) 'year': y,
      'color': col,
      if (nick.isNotEmpty) 'nickname': nick,
      if (plate.isNotEmpty) 'license_plate': plate,
      if (fuel.isNotEmpty) 'fuel_type': fuel,
      if (fuel == 'ELECTRIC' && batKwh.isNotEmpty) 'battery_capacity_kwh': batKwh,
      if ((selectedVehiclePhotoPath.value ?? '').trim().isNotEmpty &&
          !(selectedVehiclePhotoPath.value ?? '').startsWith('http'))
        'images[]': [
          await multipartFileFromUploadImage(
            selectedVehiclePhotoPath.value!.trim(),
          ),
        ],
    });

    isLoadingVehicles.value = true;

    if (isEditMode.value && editingVehicle != null) {
      final res = await _vehicleRepo.updateVehicle(
        editingVehicle!.id!,
        formData,
      );
      res.when(
        success: (data) {
          final index = myVehicles.indexWhere(
            (v) => v.id == editingVehicle!.id,
          );
          if (index != -1) {
            myVehicles[index] = data;
          }
          Get.back();
        },
        error: (e) {
          showAppSnackBar(
            title: 'Error',
            message: e.message.isNotEmpty ? e.message : 'Failed to update vehicle',
            isError: true,
          );
        },
      );
    } else {
      final res = await _vehicleRepo.addVehicle(formData);
      res.when(
        success: (data) {
          myVehicles.add(data);
          // Pop back to the vehicle list (handles both single and stacked routes).
          if (Get.previousRoute == '/vehicles' || Get.previousRoute.isEmpty) {
            Get.back();
          } else {
            Get.until((route) => route.settings.name == '/vehicles' || route.isFirst);
          }
        },
        error: (e) {
          showAppSnackBar(
            title: 'Error',
            message: e.message.isNotEmpty ? e.message : 'Failed to add vehicle',
            isError: true,
          );
        },
      );
    }
    isLoadingVehicles.value = false;
  }

  Future<void> deleteVehicle() async {
    if (editingVehicle == null || editingVehicle!.id == null) return;
    final id = editingVehicle!.id!;
    isDeleteVehicles.value = true;
    Loader.showLoading();
    final res = await _vehicleRepo.deleteVehicle(id);
    // Hide the loader BEFORE processing the result so its internal
    // Get.back() does not interfere with navigation or snackbars.
    Loader.hideLoading();
    isDeleteVehicles.value = false;
    res.when(
      success: (_) {
        myVehicles.removeWhere((v) => v.id == id);
        Get.back();
      },
      error: (e) {
        showAppSnackBar(
          title: 'Error',
          message: e.message.isNotEmpty ? e.message : 'Failed to delete vehicle',
          isError: true,
        );
      },
    );
  }

  /// Deletes a vehicle from the "My Vehicles" list without navigating back.
  Future<void> setDefaultVehicle(VehicleModel vehicle) async {
    Loader.showLoading();
    final id = vehicle.id;
    if (id == null || vehicle.isDefault) return;
    settingDefaultVehicleId.value = id;
    try {
      final res = await _vehicleRepo.setVehicleDefault(id);
      Loader.hideLoading();
      switch (res) {
        case NetworkSuccess():
          await _fetchVehicles();
          showAppSnackBar(
            title: 'Success',
            message: 'Default vehicle updated',
            isError: false,
          );
        case NetworkError(:final error):
          showAppSnackBar(
            title: 'Error',
            message: error.message.isNotEmpty ? error.message : 'Failed to set default vehicle',
            isError: true,
          );
      }
    } finally {
      Loader.hideLoading();
      settingDefaultVehicleId.value = null;
    }
  }

  Future<void> deleteVehicleFromList(VehicleModel vehicle) async {
    final id = vehicle.id;
    if (id == null) return;
    isDeleteVehicles.value = true;
    final res = await _vehicleRepo.deleteVehicle(id);
    isDeleteVehicles.value = false;
    res.when(
      success: (_) {
        myVehicles.removeWhere((v) => v.id == id);
      },
      error: (e) {
        showAppSnackBar(
          title: 'Error',
          message: e.message.isNotEmpty ? e.message : 'Failed to delete vehicle',
          isError: true,
        );
      },
    );
  }

  void vehicleType() async {
    if (editingVehicle == null || editingVehicle!.id == null) return;
    final id = editingVehicle!.id!;
    isDeleteVehicles.value = true;
    final res = await _vehicleRepo.deleteVehicle(id);
    isDeleteVehicles.value = false;
    res.when(
      success: (_) {
        myVehicles.removeWhere((v) => v.id == id);
        Get.back();
      },
      error: (e) {
        showAppSnackBar(
          title: 'Error',
          message: e.message.isNotEmpty ? e.message : 'Failed to delete vehicle',
          isError: true,
        );
      },
    );
  }
}
