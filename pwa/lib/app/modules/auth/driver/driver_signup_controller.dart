import 'dart:async';
import 'dart:io';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:get/get.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:share_plus/share_plus.dart';
import 'package:uuid/uuid.dart';

import '../../../network/repository/auth_repository.dart';
import '../../../utils/vehicle_colors.dart';
import '../../../utils/vehicle_types.dart';
import '../../../utils/vehicle_types_cache.dart';
import '../../../widgets/vehicle_make_model_fields.dart';
import '../../service_booking/models/mapbox_place_model.dart';
import '../../service_booking/services/mapbox_search_service.dart';
import '../../../network/response/common_response.dart';
import '../../../network/utils/log_util.dart';
import '../../../network/utils/network_result.dart';
import '../../../network/repository/legal_repository.dart';
import '../../../network/response/legal_page_response.dart';
import '../../../network/response/profile_response.dart';
import '../../../network/repository/driver_signup_repository.dart';
import '../../../routes/app_pages.dart';
import '../../../utils/app_snackbar.dart';
import '../../dashboard/dashboard_controller.dart';
import '../../../utils/driver_onboarding_progress.dart';
import '../../../utils/driver_tutorial_navigation.dart';
import '../../../utils/media_url.dart';
import '../../../utils/pref.dart';
import '../../../utils/validator.dart';
import '../../../widgets/widgets.dart';

class DriverSignupController extends GetxController with VehicleMakeModelMixin {
  DriverSignupController(this._repository, this._authRepository);

  final DriverSignupRepository _repository;
  final AuthRepository _authRepository;
  final MapboxSearchService _placesSearch = MapboxSearchService();
  static const _uuid = Uuid();

  static const List<String> fuelTypeOptions = ['GAS', 'DIESEL', 'ELECTRIC'];

  static const List<String> _fallbackVehicleTypeNames = [
    'Sedan',
    'SUV',
    'Hatchback',
    'Coupe',
    'Wagon',
    'Van',
    'Truck',
    'Motorcycle',
  ];

  final driverTshirtFormKey = GlobalKey<FormState>();
  final vehicleFormKey = GlobalKey<FormState>();
  final insuranceFormKey = GlobalKey<FormState>();

  final dateOfBirthController = TextEditingController();
  final socialSecurityNumberController = TextEditingController();
  final driversLicenseNumberController = TextEditingController();
  final driversLicenseIssuedController = TextEditingController();
  final driversLicenseExpirationController = TextEditingController();

  final emailController = TextEditingController();
  final addressController = TextEditingController();
  final addressSuggestions = <MapboxPlaceModel>[].obs;
  final isSearchingAddress = false.obs;
  final addressSearchError = RxnString();
  final hasAddressText = false.obs;

  final selectedTShirtSize = RxnString();
  final selectedVehicleYear = RxnString();
  final selectedVehicleColor = RxnString();
  final selectedVehicleType = RxnString();
  final selectedFuelType = RxnString();
  final selectedCoverageType = RxnString();

  final vehicleCustomColorController = TextEditingController();
  final vehicleTypeOtherController = TextEditingController();
  final vehicleBatteryKwhController = TextEditingController();
  final vehicleLicensePlateController = TextEditingController();

  final insuranceProviderController = TextEditingController();
  final insurancePolicyNumberController = TextEditingController();
  final insuranceExpirationController = TextEditingController();

  /// Tracks whether all insurance form fields are valid — used to enable/disable Save.
  final isInsuranceFormValid = false.obs;

  final driverLicenseFrontPath = RxnString();
  final driverLicenseBackPath = RxnString();
  final insuranceCardFrontPath = RxnString();
  final insuranceCardBackPath = RxnString();
  final vehicleRegistrationFrontPath = RxnString();
  final vehicleRegistrationBackPath = RxnString();

  final backgroundCheckLegalLoading = true.obs;
  final backgroundCheckPdfUrl = RxnString();
  final backgroundCheckFormDownloaded = false.obs;
  final backgroundCheckDownloading = false.obs;
  final backgroundCheckSavedPath = RxnString();
  static const _backgroundCheckFileName =
      'CarComfort_background_check_authorization.pdf';
  final signedFormPath = RxnString();
  final signedFormName = RxnString();

  final isLoading = false.obs;

  Timer? _addressSearchDebounce;
  String? _addressSessionToken;
  bool _backgroundCheckLegalLoaded = false;

  final vehicleYears = List<String>.generate(
    35,
    (i) => '${DateTime.now().year - i}',
  );

  List<String> _vehicleTypeNames = List<String>.from(_fallbackVehicleTypeNames);

  List<String> get vehicleTypeDropdownItems =>
      VehicleTypes.pickerOptionsFrom(_vehicleTypeNames);

  bool get vehicleTypeIsOther =>
      VehicleTypes.isOther(selectedVehicleType.value);

  List<String> get vehicleColorOptions => VehicleColors.pickerOptions;

  @override
  void onInit() {
    super.onInit();
    addressController.addListener(_syncAddressTextState);
    _syncAddressTextState();
    unawaited(loadVehicleCatalog());
    unawaited(_loadVehicleTypes());
    // Insurance form real-time validity tracking.
    insuranceProviderController.addListener(_refreshInsuranceFormValidity);
    insurancePolicyNumberController.addListener(_refreshInsuranceFormValidity);
    insuranceExpirationController.addListener(_refreshInsuranceFormValidity);
    ever(selectedCoverageType, (_) => _refreshInsuranceFormValidity());
  }

  void _refreshInsuranceFormValidity() {
    final provider = insuranceProviderController.text.trim();
    final policyNum = insurancePolicyNumberController.text.trim();
    final expiry = insuranceExpirationController.text.trim();
    final coverage = selectedCoverageType.value;
    final policyAlphanumeric = RegExp(r'^[a-zA-Z0-9]+$').hasMatch(policyNum);
    isInsuranceFormValid.value =
        provider.isNotEmpty &&
        policyNum.isNotEmpty &&
        policyAlphanumeric &&
        validateFutureUsDateField(expiry) == null &&
        coverage != null &&
        coverage.isNotEmpty;
  }

  Future<void> _loadVehicleTypes() async {
    final cached = VehicleTypesCache.read();
    if (cached.isNotEmpty) {
      _vehicleTypeNames = VehicleTypesCache.namesFrom(cached);
    }
    await VehicleTypesCache.syncFromApi();
    final refreshed = VehicleTypesCache.read();
    if (refreshed.isNotEmpty) {
      _vehicleTypeNames = VehicleTypesCache.namesFrom(refreshed);
    }
  }

  void onVehicleTypeChosen(String? value) {
    if (value == null || value.trim().isEmpty) return;
    selectedVehicleType.value = value.trim();
    if (!VehicleTypes.isOther(value)) {
      vehicleTypeOtherController.clear();
    }
  }

  void onVehicleColorChosen(String? value) {
    selectedVehicleColor.value = value;
    if (!VehicleColors.isOther(value)) {
      vehicleCustomColorController.clear();
    }
  }

  void onFuelTypeChosen(String? value) {
    selectedFuelType.value = value;
    if (value != 'ELECTRIC') {
      vehicleBatteryKwhController.clear();
    }
  }

  void _syncAddressTextState() {
    hasAddressText.value = addressController.text.trim().isNotEmpty;
  }

  void _renewAddressSessionToken() {
    _addressSessionToken = _uuid.v4();
  }

  void onAddressChanged(String value) {
    _addressSearchDebounce?.cancel();
    final query = value.trim();
    if (query.isEmpty) {
      addressSuggestions.clear();
      addressSearchError.value = null;
      _addressSessionToken = null;
      return;
    }
    if (_addressSessionToken == null) {
      _renewAddressSessionToken();
    }
    if (query.length < 3) {
      addressSuggestions.clear();
      addressSearchError.value = null;
      return;
    }

    _addressSearchDebounce = Timer(const Duration(milliseconds: 350), () async {
      isSearchingAddress.value = true;
      addressSearchError.value = null;
      try {
        double? latitude;
        double? longitude;
        try {
          final permission = await Geolocator.checkPermission();
          if (permission == LocationPermission.always ||
              permission == LocationPermission.whileInUse) {
            final position = await Geolocator.getCurrentPosition(
              locationSettings: const LocationSettings(
                accuracy: LocationAccuracy.medium,
                timeLimit: Duration(seconds: 4),
              ),
            );
            latitude = position.latitude;
            longitude = position.longitude;
          }
        } catch (_) {}

        final suggestions = await _placesSearch.searchGoogleAddressSuggestions(
          query: query,
          latitude: latitude,
          longitude: longitude,
          limit: 5,
          sessionToken: _addressSessionToken,
        );
        addressSuggestions.assignAll(suggestions);
      } catch (e) {
        addressSuggestions.clear();
        addressSearchError.value = '$e';
      } finally {
        isSearchingAddress.value = false;
      }
    });
  }

  Future<void> selectAddressSuggestion(MapboxPlaceModel place) async {
    var resolvedAddress = place.address.trim();
    final placeId = place.placeId?.trim();
    if (placeId != null && placeId.isNotEmpty) {
      try {
        final resolved = await _placesSearch.fetchGooglePlaceAddress(
          placeId: placeId,
          sessionToken: _addressSessionToken,
        );
        if (resolved != null && resolved.address.trim().isNotEmpty) {
          resolvedAddress = resolved.address.trim();
        }
      } catch (_) {}
    }

    addressController.text = resolvedAddress;
    addressController.selection = TextSelection.fromPosition(
      TextPosition(offset: addressController.text.length),
    );
    addressSuggestions.clear();
    addressSearchError.value = null;
    _addressSessionToken = null;
    _syncAddressTextState();
  }

  void clearAddressSearch() {
    addressController.clear();
    addressSuggestions.clear();
    addressSearchError.value = null;
    _addressSessionToken = null;
    _syncAddressTextState();
  }

  /// Guards the OTP screen on mount: re-routes to the correct onboarding step
  /// if this screen is reached incorrectly (e.g. via direct navigation).
  void enforceDriverOnboardingRoute() {
    if (isLoading.value) return;
    final prefs = Prefs();
    final onboardingComplete = prefs.getBool(Prefs.driverOnboardingComplete);
    if (onboardingComplete) {
      final isApproved = prefs.isDriverApproved;
      Get.offAllNamed(
        isApproved ? Routes.DRIVER_DASHBOARD : Routes.APPROVAL_PROCESS_REVIEW,
      );
      return;
    }
    final savedStep =
        int.tryParse(prefs.getData(Prefs.driverCurrentStep).trim()) ?? 0;
    final completedSteps =
        int.tryParse(prefs.getData(Prefs.driverCompletedSteps).trim()) ?? 0;
    final allFormsComplete =
        savedStep > kDriverOnboardingTotalSteps ||
        completedSteps >= kDriverOnboardingTotalSteps;

    if (allFormsComplete) {
      // All forms done but onboarding flag not set — send to OTP/approval.
      Get.offAllNamed(
        driverRouteWhenOnboardingIncomplete(
          savedStep: savedStep,
          onboardingComplete: false,
          isApproved: prefs.isDriverApproved,
          completedSteps: completedSteps,
        ),
      );
      return;
    }

    // Some forms still incomplete — send back to the correct step.
    Get.offAllNamed(
      driverOnboardingRouteFromPrefs(
        savedStep: savedStep,
        onboardingComplete: false,
        isApproved: prefs.isDriverApproved,
      ),
    );
  }

  LegalRepository get _legalRepository => Get.find<LegalRepository>();

  void _markBackgroundCheckFormDownloaded() {
    backgroundCheckFormDownloaded.value = true;
    Prefs().putBool(Prefs.driverBackgroundCheckFormDownloaded, true);
  }

  Future<void> loadBackgroundCheckLegalPage({bool force = false}) async {
    if (_backgroundCheckLegalLoaded && !force) return;
    if (force) _backgroundCheckLegalLoaded = false;
    backgroundCheckFormDownloaded.value = Prefs().getBool(
      Prefs.driverBackgroundCheckFormDownloaded,
    );
    backgroundCheckLegalLoading.value = true;
    try {
      if (!Get.isRegistered<LegalRepository>()) {
        Get.lazyPut<LegalRepository>(() => LegalRepository(), fenix: true);
      }
      final res = await _legalRepository.getLegalPage(
        page: LegalPageQuery.backgroundCheckAuthorization,
        audience: LegalAudience.provider,
      );
      res.when(
        success: (response) {
          final data = response.data;
          final pdf = data?.pdfUrl?.trim();
          backgroundCheckPdfUrl.value = (pdf != null && pdf.isNotEmpty)
              ? pdf
              : "https://www.rd.usda.gov/sites/default/files/pdf-sample_0.pdf";
        },
        error: (_) {
          backgroundCheckPdfUrl.value = null;
        },
      );
    } finally {
      backgroundCheckLegalLoading.value = false;
      _backgroundCheckLegalLoaded = true;
    }
  }

  Future<Directory> _resolveBackgroundCheckSaveDir() async {
    if (Platform.isAndroid) {
      final androidInfo = await DeviceInfoPlugin().androidInfo;
      if (androidInfo.version.sdkInt < 33) {
        final status = await Permission.storage.request();
        if (!status.isGranted) {
          throw Exception('Storage permission is required to save the PDF.');
        }
      }

      final downloads = await getDownloadsDirectory();
      if (downloads != null) {
        if (!await downloads.exists()) {
          await downloads.create(recursive: true);
        }
        return downloads;
      }

      final external = await getExternalStorageDirectory();
      if (external != null) return external;
    }

    return getApplicationDocumentsDirectory();
  }

  Future<void> _writePdfFromUrl(String url, String savePath) async {
    final dio = Dio(
      BaseOptions(
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 120),
        sendTimeout: const Duration(seconds: 15),
      ),
    );
    final response = await dio.get<List<int>>(
      url,
      options: Options(
        headers: MediaUrl.downloadHeaders(),
        responseType: ResponseType.bytes,
        followRedirects: true,
        validateStatus: (code) => code != null && code >= 200 && code < 400,
      ),
    );

    final bytes = response.data;
    if (bytes == null || bytes.isEmpty) {
      throw Exception('Download returned an empty file.');
    }
    if (bytes.length < 4 || String.fromCharCodes(bytes.take(4)) != '%PDF') {
      throw Exception('Downloaded file is not a valid PDF.');
    }

    final file = File(savePath);
    await file.parent.create(recursive: true);
    await file.writeAsBytes(bytes, flush: true);
    if (!await file.exists() || await file.length() == 0) {
      throw Exception('Could not save the PDF on this device.');
    }
  }

  Future<String> _downloadBackgroundCheckPdfToDevice(String resolvedUrl) async {
    Object? lastError;

    // Try Downloads directory first (public, visible to user)
    final downloads = await getDownloadsDirectory();
    if (downloads != null) {
      final savePath = '${downloads.path}/$_backgroundCheckFileName';
      try {
        await _writePdfFromUrl(resolvedUrl, savePath);
        debugPrint('Saved to Downloads: $savePath');
        return savePath;
      } catch (e) {
        lastError = e;
        debugPrint('Failed to save to Downloads: $e');
      }
    }

    // Fallback to cache (always writable, shareable via FileProvider)
    if (Platform.isAndroid) {
      final cacheDir = await getTemporaryDirectory();
      final savePath = '${cacheDir.path}/$_backgroundCheckFileName';
      try {
        await _writePdfFromUrl(resolvedUrl, savePath);
        debugPrint('Saved to cache: $savePath');
        return savePath;
      } catch (e) {
        lastError = e;
        debugPrint('Failed to save to cache: $e');
      }
    }

    // Last resort: app documents directory (private)
    final appDir = await getApplicationDocumentsDirectory();
    final savePath = '${appDir.path}/$_backgroundCheckFileName';
    try {
      await _writePdfFromUrl(resolvedUrl, savePath);
      return savePath;
    } catch (e) {
      throw lastError ?? Exception('Could not save the PDF on this device.');
    }
  }

  Future<void> _notifyBackgroundCheckFormSaved(String path) async {
    _markBackgroundCheckFormDownloaded();
    backgroundCheckSavedPath.value = path;

    // Try to open the PDF so user can view it, then save from there
    try {
      final result = await OpenFilex.open(path);
      if (result.type != ResultType.done) {
        // If file can't be opened (e.g., no PDF viewer), share it
        debugPrint('Failed to open PDF, trying to share: $result');
        await SharePlus.instance.share(
          ShareParams(
            files: [XFile(path)],
            subject: 'Background Check Authorization Form',
            text: 'Please download, complete and sign this form.',
          ),
        );
      }
    } catch (e) {
      debugPrint('Failed to open PDF: $e');
      // Fallback: share the file so user can save it to their Gallery
      try {
        await SharePlus.instance.share(
          ShareParams(
            files: [XFile(path)],
            subject: 'Background Check Authorization Form',
            text: 'Please download, complete and sign this form.',
          ),
        );
      } catch (shareError) {
        debugPrint('Failed to share PDF: $shareError');
      }
    }

    _success('Form downloaded successfully. Open to view and save.');
  }

  Future<void> downloadBackgroundCheckForm() async {
    final url = backgroundCheckPdfUrl.value?.trim();
    if (url == null || url.isEmpty) {
      _error(
        'Download is not available yet. Ask your admin to upload the PDF in Legal Pages.',
      );
      return;
    }
    final resolved = MediaUrl.resolve(url);
    if (resolved.isEmpty) {
      _error('Invalid download link for the background check form.');
      return;
    }

    if (backgroundCheckDownloading.value) return;
    backgroundCheckDownloading.value = true;
    try {
      final savePath = await _downloadBackgroundCheckPdfToDevice(resolved);
      _notifyBackgroundCheckFormSaved(savePath);
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      if (status != null) {
        _error('Could not download the form (server error $status).');
      } else {
        _error('Could not download the form. Check your internet connection.');
      }
    } catch (e) {
      final message = e.toString().replaceFirst('Exception: ', '').trim();
      _error(
        message.isEmpty
            ? 'Could not download the form. Check your connection and try again.'
            : message,
      );
    } finally {
      backgroundCheckDownloading.value = false;
    }
  }

  Future<void> pickSignedBackgroundCheckForm() async {
    if (!backgroundCheckFormDownloaded.value) {
      _error(
        'Download the authorization form first, then upload the signed PDF.',
      );
      return;
    }
    final result = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf'],
      withData: false,
    );
    if (result == null || result.files.isEmpty) return;
    final file = result.files.first;
    final path = file.path;
    if (path == null || path.isEmpty) return;
    signedFormPath.value = path;
    signedFormName.value = file.name;
  }

  Future<void> continueBackgroundCheck() async {
    if (!backgroundCheckFormDownloaded.value) {
      _error('Download the authorization form before continuing.');
      return;
    }
    final signedPath = signedFormPath.value?.trim();
    if (signedPath == null || signedPath.isEmpty) {
      _error(
        'Upload the signed PDF (download the form, complete and sign it, then attach it)',
      );
      return;
    }

    await _guardApi(
      task: () async {
        final upload = await _repository.uploadSignedBackgroundCheckForm(
          signedFormPath: signedPath,
        );
        if (upload is NetworkError<CommonResponse>) {
          return upload;
        }
        return _repository.submitBackgroundCheckStep(
          backgroundCheckConsent: true,
        );
      },
      onSuccess: (_) async {
        final profile = await _syncDriverProgressFromProfile();
        if (profile?.data?.driverProfile?.isCompleted == true) {
          DriverTutorialNavigation.routeOrProceed(Routes.DRIVER_DASHBOARD);
          return;
        }
        final otpResult = await _repository.requestVerificationOtp();
        otpResult.when(
          success: (_) {
            // Replace the entire onboarding stack — driver cannot go back.
            Get.offAllNamed(Routes.DRIVER_OTP);
          },
          error: (err) => _error(err.message),
        );
      },
      failureTitle: 'Background Check Failed',
    );
  }

  Future<void> selectInsuranceExpirationDate(BuildContext context) async {
    final now = DateTime.now();
    await _pickDate(
      context,
      controller: insuranceExpirationController,
      initialDate: parseUsDate(insuranceExpirationController.text) ?? now,
      firstDate: now,
      lastDate: DateTime(now.year + 15, 12, 31),
      formatValue: formatUsDate,
    );
  }

  Future<void> pickDriverLicenseSide(
    BuildContext context, {
    required bool isFront,
  }) async {
    await attachmentDialog(
      context,
      cameraClick: () async {
        final path = await pickPicture(isCamera: true, crop: true);
        _applyPath(
          path,
          isFront: isFront,
          front: driverLicenseFrontPath,
          back: driverLicenseBackPath,
        );
      },
      galleryClick: () async {
        final path = await pickPicture(crop: true);
        _applyPath(
          path,
          isFront: isFront,
          front: driverLicenseFrontPath,
          back: driverLicenseBackPath,
        );
      },
    );
  }

  Future<void> pickInsuranceCardSide(
    BuildContext context, {
    required bool isFront,
  }) async {
    await attachmentDialog(
      context,
      cameraClick: () async {
        final path = await pickPicture(isCamera: true, crop: true);
        _applyPath(
          path,
          isFront: isFront,
          front: insuranceCardFrontPath,
          back: insuranceCardBackPath,
        );
      },
      galleryClick: () async {
        final path = await pickPicture(crop: true);
        _applyPath(
          path,
          isFront: isFront,
          front: insuranceCardFrontPath,
          back: insuranceCardBackPath,
        );
      },
    );
  }

  Future<void> pickVehicleRegistrationSide(
    BuildContext context, {
    required bool isFront,
  }) async {
    await attachmentDialog(
      context,
      cameraClick: () async {
        final path = await pickPicture(isCamera: true, crop: true);
        _applyPath(
          path,
          isFront: isFront,
          front: vehicleRegistrationFrontPath,
          back: vehicleRegistrationBackPath,
        );
      },
      galleryClick: () async {
        final path = await pickPicture(crop: true);
        _applyPath(
          path,
          isFront: isFront,
          front: vehicleRegistrationFrontPath,
          back: vehicleRegistrationBackPath,
        );
      },
    );
  }

  void _applyPath(
    String? path, {
    required bool isFront,
    required RxnString front,
    required RxnString back,
  }) {
    if (path == null || path.isEmpty) return;
    Alert.log('Apply image path', path);
    if (isFront) {
      front.value = path;
    } else {
      back.value = path;
    }
  }

  Future<void> selectDateOfBirth(BuildContext context) async {
    await _pickDate(
      context,
      controller: dateOfBirthController,
      initialDate:
          parseUsDate(dateOfBirthController.text) ??
          DateTime(DateTime.now().year - 25),
      firstDate: DateTime(1940),
      lastDate: DateTime.now().subtract(const Duration(days: 365 * 18)),
      formatValue: formatUsDate,
    );
  }

  Future<void> selectDriversLicenseIssuedDate(BuildContext context) async {
    final now = DateTime.now();
    await _pickDate(
      context,
      controller: driversLicenseIssuedController,
      initialDate: parseUsDate(driversLicenseIssuedController.text) ?? now,
      firstDate: DateTime(1990),
      lastDate: now,
      formatValue: formatUsDate,
    );
  }

  Future<void> selectDriversLicenseExpirationDate(BuildContext context) async {
    final now = DateTime.now();
    final fallback = now.add(const Duration(days: 365));
    await _pickDate(
      context,
      controller: driversLicenseExpirationController,
      initialDate:
          parseUsDate(driversLicenseExpirationController.text) ?? fallback,
      firstDate: now,
      lastDate: DateTime(now.year + 20),
      formatValue: formatUsDate,
    );
  }

  Future<void> _pickDate(
    BuildContext context, {
    required TextEditingController controller,
    required DateTime initialDate,
    required DateTime firstDate,
    required DateTime lastDate,
    String Function(DateTime)? formatValue,
  }) async {
    FocusManager.instance.primaryFocus?.unfocus();
    // Guard against a seeded initialDate falling outside the allowed range.
    var seededInitial = initialDate;
    if (seededInitial.isBefore(firstDate)) seededInitial = firstDate;
    if (seededInitial.isAfter(lastDate)) seededInitial = lastDate;
    final picked = await showCalendarOnlyDatePicker(
      context,
      initialDate: seededInitial,
      firstDate: firstDate,
      lastDate: lastDate,
    );
    if (picked == null) return;
    controller.text = formatValue != null
        ? formatValue(picked)
        : '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
  }

  Future<void> submitDriverTShirtSize() async {
    final form = driverTshirtFormKey.currentState;
    if (form == null || !form.validate()) return;
    final tshirt = selectedTShirtSize.value;
    if (tshirt == null || tshirt.isEmpty) {
      _error('Please select a T-shirt size');
      return;
    }
    final address = normalizeAddress(addressController.text);
    final addressError = validateAddress(address);
    if (addressError != null) {
      _error(addressError);
      return;
    }
    final dobRaw = dateOfBirthController.text.trim();
    if (dobRaw.isEmpty) {
      _error('Please select your date of birth');
      return;
    }
    final dobDate = parseUsDate(dobRaw);
    if (dobDate == null) {
      _error('Please enter a valid date of birth (MM/DD/YYYY)');
      return;
    }
    final today = DateTime.now();
    final eighteenYearsAgo = DateTime(today.year - 18, today.month, today.day);
    if (dobDate.isAfter(eighteenYearsAgo)) {
      _error('You must be at least 18 years old');
      return;
    }
    final dob = usDateToIso(dobRaw)!;
    final ssn = socialSecurityNumberController.text.replaceAll(
      RegExp(r'\D'),
      '',
    );
    if (ssn.length != 9) {
      _error('Social Security number must be 9 digits');
      return;
    }

    await _guardApi(
      task: () => _repository.submitStep2(
        tshirtSize: tshirt,
        address: address,
        dateOfBirth: dob,
        socialSecurityNumber: ssn,
      ),
      onSuccess: (_) async {
        final profile = await _syncDriverProgressFromProfile();
        // Use the fresh API profile to determine the correct next step so
        // we never re-open a screen the driver has already completed.
        if (profile != null) {
          final nextRoute = driverOnboardingRouteForProfile(
            profile: profile,
            isApproved: Prefs().isDriverApproved,
          );
          // Only navigate forward — never back to personal info itself.
          if (nextRoute != Routes.DRIVER_TSHIRT_SIZE) {
            Get.toNamed(nextRoute);
            return;
          }
        }
        // Fallback: advance to license screen (the natural next step).
        Get.toNamed(Routes.UPLOAD_DRIVER_LICENSE);
      },
      failureTitle: 'Personal Info Failed',
    );
  }

  Future<void> completeDriverLicense() async {
    final front = driverLicenseFrontPath.value ?? '';
    final back = driverLicenseBackPath.value ?? '';
    if (front.isEmpty || back.isEmpty) {
      _error('Please upload the front and back of your driver license');
      return;
    }
    final licenseNumber = driversLicenseNumberController.text.trim();
    if (licenseNumber.isEmpty) {
      _error('Please enter your driver license number');
      return;
    }
    if (licenseNumber.length < 4 ||
        !RegExp(r'^[A-Za-z0-9][A-Za-z0-9\-./ ]+$').hasMatch(licenseNumber)) {
      _error('Please enter a valid driver license number');
      return;
    }
    final issuedRaw = driversLicenseIssuedController.text.trim();
    final expirationRaw = driversLicenseExpirationController.text.trim();
    if (issuedRaw.isEmpty || expirationRaw.isEmpty) {
      _error('Please enter license issued and expiration dates');
      return;
    }

    final issuedDate = parseUsDate(issuedRaw);
    if (issuedDate == null) {
      _error('Please enter a valid date issued (MM/DD/YYYY)');
      return;
    }
    final expirationDate = parseUsDate(expirationRaw);
    if (expirationDate == null) {
      _error('Please enter a valid expiration date (MM/DD/YYYY)');
      return;
    }

    final today = DateTime.now();
    final todayDate = DateTime(today.year, today.month, today.day);
    if (issuedDate.isAfter(todayDate)) {
      _error('Date issued cannot be in the future');
      return;
    }
    if (!expirationDate.isAfter(issuedDate)) {
      _error('Expiration date must be after the date issued');
      return;
    }

    final issued = usDateToIso(issuedRaw)!;
    final expiration = usDateToIso(expirationRaw)!;

    await _guardApi(
      task: () async {
        final upload = await _repository.uploadDriverLicense(
          frontPath: front,
          backPath: back,
        );
        if (upload is NetworkError<CommonResponse>) {
          return upload;
        }
        return _repository.submitStep3(
          licenseNumber: licenseNumber,
          issuedDate: issued,
          expirationDate: expiration,
        );
      },
      onSuccess: (_) async {
        final profile = await _syncDriverProgressFromProfile();

        // If the dashboard is already active the driver is a returning /
        // already-onboarded user renewing an expired license. In that case we
        // always go back to the dashboard regardless of what `is_completed`
        // returns, because the backend may mark the profile as incomplete
        // while the new license is under compliance review.
        final dashboardActive = Get.isRegistered<DashboardController>();

        if (dashboardActive ||
            profile?.data?.driverProfile?.isCompleted == true) {
          if (dashboardActive) {
            // Await so the reactive license-expiry flags are cleared before
            // the dashboard re-appears (banner disappears immediately).
            await Get.find<DashboardController>()
                .refreshDriverLicenseCompliance();
          }
          if (Get.currentRoute == Routes.UPLOAD_DRIVER_LICENSE) {
            Get.back<void>();
          } else {
            DriverTutorialNavigation.routeOrProceed(Routes.DRIVER_DASHBOARD);
          }
          showAppSnackBar(
            title: 'License updated',
            message:
                'Your driver license was updated. Your account can accept new service requests once compliance is verified.',
          );
          return;
        }
        // Use the refreshed profile to decide the next step so we
        // never loop back to the license screen if it is already done.
        if (profile != null) {
          final nextRoute = driverOnboardingRouteForProfile(
            profile: profile,
            isApproved: Prefs().isDriverApproved,
          );
          // Only navigate forward — never back to the license screen.
          if (nextRoute != Routes.UPLOAD_DRIVER_LICENSE) {
            Get.toNamed(nextRoute);
            return;
          }
        }
        // Fallback: advance to vehicle information (the natural next step).
        Get.toNamed(Routes.ADD_VEHICLE_INFORMATION);
      },
      failureTitle: 'License Upload Failed',
    );
  }

  Future<void> saveVehicleInformation() async {
    final form = vehicleFormKey.currentState;
    if (form == null || !form.validate()) return;
    final year = selectedVehicleYear.value;
    final color = VehicleColors.resolveForApi(
      selectedPickerValue: selectedVehicleColor.value,
      customColorText: vehicleCustomColorController.text,
    );
    final type = VehicleTypes.resolveForApi(
      selectedPickerValue: selectedVehicleType.value,
      customTypeText: vehicleTypeOtherController.text,
    );
    final make = resolvedVehicleMake;
    final model = resolvedVehicleModel;
    final fuel = (selectedFuelType.value ?? '').trim();

    if (year == null ||
        color == null ||
        type == null ||
        make == null ||
        make.isEmpty ||
        model == null ||
        model.isEmpty) {
      _error('Please complete all vehicle information fields');
      return;
    }
    if (fuel.isEmpty) {
      _error('Please select fuel type');
      return;
    }
    if (fuel == 'ELECTRIC') {
      final kwh = vehicleBatteryKwhController.text.trim().replaceAll(',', '.');
      final parsed = double.tryParse(kwh);
      if (kwh.isEmpty || parsed == null || parsed <= 0) {
        _error('Please enter a valid battery capacity (kWh)');
        return;
      }
    }

    await _guardApi(
      task: () => _repository.submitStep4(
        make: make,
        model: model,
        year: year,
        color: color,
        vehicleType: type,
        licensePlate: normalizeLicensePlate(vehicleLicensePlateController.text),
        fuelType: fuel,
        batteryCapacityKwh: fuel == 'ELECTRIC'
            ? vehicleBatteryKwhController.text.trim().replaceAll(',', '.')
            : null,
      ),
      onSuccess: (_) async {
        await _syncDriverProgressFromProfile();
        // Insurance steps were removed from the signup flow; go straight to
        // the background check (step 5).
        Get.toNamed(Routes.BACKGROUND_CHECK);
      },
      failureTitle: 'Vehicle Save Failed',
    );
  }

  Future<ProfileResponse?> _syncDriverProgressFromProfile() async {
    final meResult = await _authRepository.getDriverMe();
    ProfileResponse? latestProfile;
    meResult.when(
      success: (res) {
        latestProfile = res;
        persistDriverOnboardingPrefs(res);
      },
      error: (_) {},
    );
    return latestProfile;
  }

  Future<void> saveInsuranceInformation() async {
    final form = insuranceFormKey.currentState;
    if (form == null || !form.validate()) return;

    final provider = insuranceProviderController.text.trim();
    final policyNum = insurancePolicyNumberController.text.trim();
    final expiry = insuranceExpirationController.text.trim();
    final coverage = selectedCoverageType.value;

    if (provider.isEmpty) {
      _error('Please enter insurance provider name');
      return;
    }
    if (policyNum.isEmpty) {
      _error('Please enter policy number');
      return;
    }
    if (!RegExp(r'^[a-zA-Z0-9]+$').hasMatch(policyNum)) {
      _error('Policy number must contain only letters and numbers');
      return;
    }
    final expiryError = validateFutureUsDateField(expiry);
    if (expiryError != null) {
      _error(expiryError);
      return;
    }
    if (coverage == null || coverage.isEmpty) {
      _error('Please select coverage type');
      return;
    }

    final expiryIso = usDateToIso(expiry)!;

    await _guardApi(
      task: () => _repository.submitInsuranceInformation(
        insuranceProvider: provider,
        policyNumber: policyNum,
        expirationDate: expiryIso,
        coverageType: coverage,
      ),
      onSuccess: (_) async {
        await _syncDriverProgressFromProfile();
        Get.toNamed(Routes.UPLOAD_INSURANCE_CARD);
      },
      failureTitle: 'Insurance Save Failed',
    );
  }

  Future<void> completeInsuranceCardUpload() async {
    final front = insuranceCardFrontPath.value ?? '';
    final back = insuranceCardBackPath.value ?? '';

    if (front.isEmpty || back.isEmpty) {
      _error('Please upload the front and back of your insurance card');
      return;
    }

    await _guardApi(
      task: () =>
          _repository.uploadInsuranceCard(frontPath: front, backPath: back),
      onSuccess: (_) async {
        await _syncDriverProgressFromProfile();
        Get.toNamed(Routes.BACKGROUND_CHECK);
      },
      failureTitle: 'Insurance Card Upload Failed',
    );
  }

  Future<void> completeVehicleRegistrationUpload() async {
    final front = vehicleRegistrationFrontPath.value ?? '';
    if (front.isEmpty) {
      _error('Please upload your vehicle registration photo');
      return;
    }
    Get.offNamed(Routes.BACKGROUND_CHECK);
  }

  Future<bool> onOtpResendTap() async {
    if (isLoading.value) return false;
    isLoading.value = true;
    final result = await _repository.requestVerificationOtp();
    isLoading.value = false;
    var succeeded = false;
    result.when(
      success: (res) {
        succeeded = true;
        _success(res.message ?? 'OTP resent');
      },
      error: (err) {
        showAppSnackBar(
          title: 'Resend OTP Failed',
          message: err.message,
          isError: true,
        );
      },
    );
    return succeeded;
  }

  Future<void> verifyDriverOtp(String otp) async {
    final trimmed = otp.trim();
    if (trimmed.length != 6) {
      _error('Please enter the 6-digit code');
      return;
    }
    await _guardApi(
      task: () => _repository.verifyDriverOtp(otp: trimmed),
      onSuccess: (_) async {
        await _syncDriverProgressFromProfile();
        // Onboarding complete — tutorial before approval screen.
        DriverTutorialNavigation.routeOrProceed(Routes.APPROVAL_PROCESS_REVIEW);
      },
      failureTitle: 'OTP Verification Failed',
    );
  }

  Future<void> _guardApi({
    required Future<dynamic> Function() task,
    required void Function(dynamic res) onSuccess,
    required String failureTitle,
  }) async {
    if (isLoading.value) return;
    isLoading.value = true;
    final result = await task();
    isLoading.value = false;
    result.when(
      success: onSuccess,
      error: (err) => showAppSnackBar(
        title: failureTitle,
        message: err.message,
        isError: true,
      ),
    );
  }

  void _error(String message) {
    showAppSnackBar(title: 'Validation', message: message, isError: true);
  }

  void _success(String message) {
    showAppSnackBar(title: 'Success', message: message);
  }

  @override
  void onClose() {
    _addressSearchDebounce?.cancel();
    addressController.removeListener(_syncAddressTextState);
    dateOfBirthController.dispose();
    socialSecurityNumberController.dispose();
    driversLicenseNumberController.dispose();
    driversLicenseIssuedController.dispose();
    driversLicenseExpirationController.dispose();
    emailController.dispose();
    addressController.dispose();
    disposeVehicleMakeModelFields();
    vehicleCustomColorController.dispose();
    vehicleTypeOtherController.dispose();
    vehicleBatteryKwhController.dispose();
    vehicleLicensePlateController.dispose();
    insuranceProviderController.removeListener(_refreshInsuranceFormValidity);
    insurancePolicyNumberController.removeListener(
      _refreshInsuranceFormValidity,
    );
    insuranceExpirationController.removeListener(_refreshInsuranceFormValidity);
    insuranceProviderController.dispose();
    insurancePolicyNumberController.dispose();
    insuranceExpirationController.dispose();
    super.onClose();
  }
}
