import 'dart:async';

import 'package:get_storage/get_storage.dart';
import 'secure_prefs.dart';

class Prefs {
  static const String sharedPref = 'stock';
  static const String rememberPref = 'remember_prefs';

  static const String timezone = 'timezone';
  static const String username = 'username';
  static const String rememberMe = 'remember_me';
  static const String rememberedEmail = 'remembered_email';
  static const String rememberedPassword = 'remembered_password';
  static const String rememberedRole = 'remembered_role';
  static const String lastActiveRole = 'last_active_role';
  /// Set when customer switches to unapproved driver — back returns to customer dashboard.
  static const String roleSwitchPendingCustomerReturn =
      'role_switch_pending_customer_return';
  static const String userToken = 'token';
  static const String oneSignToken = 'one_signal_token';
  static const String email = 'email';
  static const String image = 'image';
  static const String phone = 'phone';
  static const String profileCountryIso = 'profile_country_iso';
  static const String dob = 'dob';
  static const String firstName = 'first_name';
  static const String lastName = 'last_name';
  static const String bio = 'bio';
  static const String role = 'role';
  static const String roleId = 'role_id';
  static const String id = 'id';
  static const String menuRes = 'menu_list';
  static const String productOrdering = 'product_ordering';
  static const String shippingMethodsList = 'shipping_methods_list';
  static const String wishListData = 'wish_list';
  static const String isShippingAddress = 'is_shipping_address';
  static const String isCollectionAddress = 'is_collection_address';
  static const String isNumberVerified = 'is_number_verified';
  static const String isOnboarding = 'is_onboarding';
  static const String isKYC = 'is_kyc';
  static const String driverCompletedSteps = 'driver_completed_steps';
  static const String driverCurrentStep = 'driver_current_step';
  static const String driverApprovalStatus = 'driver_approval_status';
  static const String driverOnboardingComplete = 'driver_onboarding_complete';
  static const String driverTutorialCompleted = 'driver_tutorial_completed';
  static const String driverBackgroundCheckFormDownloaded =
      'driver_background_check_form_downloaded';
  static const String activeDriverServiceBookingId =
      'active_driver_service_booking_id';
  static const String activeDriverServiceStarted =
      'active_driver_service_started';
  static const String driverServiceEnRouteStartedAt =
      'driver_service_en_route_started_at';
  static const String driverVehicleBeingServicedStartedAt =
      'driver_vehicle_being_serviced_started_at';
  /// Provider accepted but may not have tapped Start yet.
  static const String activeDriverAssignedBookingId =
      'active_driver_assigned_booking_id';

  /// Customer: active live trip / post-booking map session.
  static const String activeCustomerLiveBookingId =
      'active_customer_live_booking_id';
  static const String activeCustomerLiveTrackingStarted =
      'active_customer_live_tracking_started';
  static const String activeCustomerPostBookingStage =
      'active_customer_post_booking_stage';
  static const String activeCustomerTrackingCode =
      'active_customer_tracking_code';
  static const String activeCustomerPostBookingStartedAtMs =
      'active_customer_post_booking_started_at_ms';
  static const String activeCustomerSocketDriverName =
      'active_customer_socket_driver_name';
  static const String activeCustomerSocketDriverAvatar =
      'active_customer_socket_driver_avatar';
  static const String activeCustomerPickupOtp = 'active_customer_pickup_otp';
  static const String activeCustomerPickupOtpBookingId =
      'active_customer_pickup_otp_booking_id';

  static const String servicesList = 'services_list';
  static const String lastServicesSync = 'last_services_sync';
  static const String vehicleTypesList = 'vehicle_types_list';
  static const String lastVehicleTypesSync = 'last_vehicle_types_sync';

  final GetStorage _rememberPrefs = GetStorage(rememberPref);
  final GetStorage _prefs = GetStorage(sharedPref);

  Future<void> init() async {
    await GetStorage.init(sharedPref);
    await GetStorage.init(rememberPref);
    // Also initialize the default "GetStorage" box — it's used by
    // SecurePrefs._flagBox for the iOS fresh-install flag. Without
    // this explicit init, lazy-initialisation fails on some platforms
    // during hot-restart, causing the flag read to return null and
    // making the app wipe the Keychain (and thus the user's session)
    // on every hot restart.
    await GetStorage.init();
  }

  Future<void> clear() async {
    await _prefs.erase();
    await SecurePrefs.instance.deleteToken();
    _cachedToken = '';
  }

  Future<void> removeData(String key) async {
    await _prefs.remove(key);
  }

  /// Write a value. Sensitive keys (token) are routed to secure storage.
  void putData(String key, String value) {
    if (key == userToken) {
      // Update the in-memory cache immediately so that synchronous token()
      // callers (AuthInterceptor, BaseRepository) see the new value right away,
      // without needing to await tokenAsync().
      _cachedToken = value;
      // Persist to secure storage (fire-and-forget); also clear any legacy plain-text copy.
      SecurePrefs.instance.writeToken(value);
      _prefs.remove(key); // ensure no plain-text copy lingers
      return;
    }
    _prefs.write(key, value);
  }

  void putBool(String key, bool value) {
    _prefs.write(key, value);
  }

  void putTimeZoneData(String key, String value) {
    _rememberPrefs.write(key, value);
  }

  void putRememberData(String key, String value) {
    if (key == rememberedPassword) {
      // Route to secure storage; remove any plain-text copy.
      SecurePrefs.instance.writeRememberedPassword(value);
      _rememberPrefs.remove(key);
      return;
    }
    _rememberPrefs.write(key, value);
  }

  void putRememberBool(String key, bool value) {
    _rememberPrefs.write(key, value);
  }

  Future<void> removeRememberData(String key) async {
    await _rememberPrefs.remove(key);
  }

  String getTimeZoneData(String key) => _rememberPrefs.read(key) ?? '';

  String getRememberData(String key) {
    if (key == rememberedPassword) {
      // Return in-memory cached value; call [rememberedPasswordAsync] for fresh read.
      return _cachedRememberedPassword;
    }
    return _rememberPrefs.read(key) ?? '';
  }

  static String _cachedRememberedPassword = '';

  Future<String> rememberedPasswordAsync() async {
    final p = await SecurePrefs.instance.readRememberedPassword();
    _cachedRememberedPassword = p;
    return p;
  }

  bool getRememberBool(String key) => _rememberPrefs.read(key) ?? false;

  Future<void> clearRememberMe() async {
    await _rememberPrefs.remove(rememberMe);
    await _rememberPrefs.remove(rememberedEmail);
    await _rememberPrefs.remove(rememberedRole);
    await SecurePrefs.instance.deleteRememberedPassword();
    _cachedRememberedPassword = '';
  }

  /// Read a value. For [userToken], reads from secure storage synchronously via
  /// a cached value — use [tokenAsync()] when an async read is acceptable.
  String getData(String key) {
    if (key == userToken) {
      // Synchronous access isn't possible with flutter_secure_storage.
      // Return the in-memory cached value (populated by tokenAsync on startup).
      return _cachedToken;
    }
    return _prefs.read(key) ?? '';
  }

  // In-memory token cache — updated by [tokenAsync] and [putData].
  static String _cachedToken = '';

  /// Async token read — use this in startup code or when accuracy is critical.
  Future<String> tokenAsync() async {
    final t = await SecurePrefs.instance.readToken();
    _cachedToken = t;
    return t;
  }

  bool getBool(String key) => _prefs.read(key) ?? false;

  String token() => _cachedToken;

  String? oneSignalToken() {
    return getData(oneSignToken);
  }

  String userFirstName() => getData(firstName);

  String userLastName() => getData(lastName);

  String userFullName() => "${getData(firstName)} ${getData(lastName)}";

  String userId() => getData(id);

  String userEmail() => getData(email);

  String userImage() => getData(image);

  String userRole() => getData(role).trim().toLowerCase();

  /// Logged-in customer (end user) — vehicles + full booking list APIs apply.
  bool get isCustomerRole => userRole() == 'customer';

  /// Logged-in driver — use driver booking list (e.g. confirmed only), not customer vehicles list.
  bool get isDriverRole => userRole() == 'driver';

  String driverApprovalStatusValue() =>
      getData(driverApprovalStatus).trim().toLowerCase();

  bool get isDriverApproved => driverApprovalStatusValue() == 'approved';

  void putServicesList(String value) => putData(servicesList, value);
  String getServicesList() => getData(servicesList);

  void putLastServicesSync(int timestamp) =>
      _prefs.write(lastServicesSync, timestamp);
  int getLastServicesSync() => _prefs.read(lastServicesSync) ?? 0;

  void putVehicleTypesList(String value) => putData(vehicleTypesList, value);
  String getVehicleTypesList() => getData(vehicleTypesList);

  void putLastVehicleTypesSync(int timestamp) =>
      _prefs.write(lastVehicleTypesSync, timestamp);
  int getLastVehicleTypesSync() => _prefs.read(lastVehicleTypesSync) ?? 0;
}
