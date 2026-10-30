import 'dart:async';
import 'dart:ui';

import 'package:adaptive_theme/adaptive_theme.dart';
import 'package:car_comfort/app/network/utils/api_handler.dart';
import 'package:country_code_picker_plus/country_code_picker_plus.dart';
import 'package:car_comfort/app/network/utils/dio_client.dart';
import 'package:car_comfort/app/network/utils/log_util.dart';
import 'package:car_comfort/app/utils/network_monitor_service.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_web_plugins/url_strategy.dart';
import 'package:get/get_core/src/get_main.dart';
import 'package:get/get_instance/src/extension_instance.dart';
import 'package:get/get_navigation/src/extension_navigation.dart';
import 'package:get/get_navigation/src/nav2/get_nav_config.dart';
import 'package:get/get_navigation/src/nav2/get_router_delegate.dart';
import 'package:get/get_navigation/src/root/get_material_app.dart';
import 'package:get/get_navigation/src/routes/get_route.dart';
import 'package:get/get_navigation/src/routes/transitions_type.dart';
import 'package:get/get_utils/src/extensions/dynamic_extensions.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart';
import 'package:toastification/toastification.dart';

import 'app/constants/api_constants.dart';
import 'app/gen/fonts.gen.dart';
import 'app/routes/app_pages.dart';
import 'app/theme/styles.dart';
import 'app/theme/theme.dart';
import 'app/services/booking_live_socket_service.dart';
import 'app/services/customer_dashboard_socket_service.dart';
import 'app/services/driver_mapbox_navigation_service.dart';
import 'app/services/driver_dashboard_socket_service.dart';
import 'app/services/legal_pages_cache_service.dart';
import 'app/services/app_config_service.dart';
import 'app/services/maintenance_service.dart';
import 'app/services/onesignal_service.dart';
import 'app/services/stripe_kyc_deep_link_service.dart';
import 'app/utils/env_service.dart';
import 'app/utils/stripe_client_config.dart';
import 'app/utils/extensions/extension.dart';
import 'app/utils/my_custom_scroll_behaviour.dart';
import 'app/utils/pref.dart';
import 'app/utils/secure_prefs.dart';
import 'app/modules/dashboard/dashboard_controller.dart';
import 'firebase_options.dart';

/// Fires [DashboardController.onMapResumed] / [DriverDashboardController.onMapResumed]
/// whenever a route is popped (i.e. user returns to the home map from any pushed screen).
class _MapRouteObserver extends NavigatorObserver {
  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) {
    final prev = previousRoute?.settings.name ?? '';
    if (prev == '/dashboard' || prev == '/driver-dashboard') {
      _triggerMapResume();
    }
  }

  void _triggerMapResume() {
    // Try driver controller first, fall back to customer dashboard.
    if (Get.isRegistered<DashboardController>()) {
      unawaited(Get.find<DashboardController>().onMapResumed());
    }
  }
}

ThemeData getTheme(ColorScheme colorScheme) => ThemeData(
  useMaterial3: true,
  brightness: colorScheme.brightness,
  colorScheme: colorScheme,
  // iOS: statusBarBrightness.dark => light (white) status bar icons.
  appBarTheme: const AppBarTheme(
    systemOverlayStyle: SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      statusBarBrightness: Brightness.dark,
    ),
  ),
  textSelectionTheme: TextSelectionThemeData(
    selectionColor: colorScheme.brightness == Brightness.dark
        ? colorScheme.tertiary.withValues(alpha: 0.35)
        : colorScheme.primary.withValues(alpha: 0.24),
    selectionHandleColor: colorScheme.primary,
  ),
  textTheme: textTheme.apply(
    bodyColor: colorScheme.onSurface,
    displayColor: colorScheme.onSurface,
  ),
  navigationBarTheme: NavigationBarThemeData(
    labelBehavior: NavigationDestinationLabelBehavior.onlyShowSelected,
    labelTextStyle: WidgetStateProperty.resolveWith((states) {
      if (states.contains(WidgetState.selected)) {
        return textTheme.titleLarge?.copyWith(
          fontFamily: FontFamily.inter,
          fontSize: 13,
          fontWeight: FontWeight.w700,
          color: colorScheme.tertiary,
        );
      } else {
        return textTheme.titleLarge?.copyWith(
          fontFamily: FontFamily.inter,
          fontSize: 0,
          fontWeight: FontWeight.w600,
          color: colorScheme.onSurface,
        );
      }
    }),
    iconTheme: WidgetStateProperty.resolveWith((state) {
      if (state.contains(WidgetState.selected)) {
        return IconThemeData(color: colorScheme.tertiary);
      } else {
        return IconThemeData(
          color: colorScheme.onSurface.withValues(alpha: 0.4),
        );
      }
    }),
    indicatorColor: colorScheme.secondary,
    backgroundColor: colorScheme.primary,
    elevation: 0,
  ),
  navigationRailTheme: NavigationRailThemeData(
    selectedLabelTextStyle: textTheme.titleLarge?.copyWith(
      fontFamily: FontFamily.inter,
      fontSize: 14,
      fontWeight: FontWeight.w700,
      color: colorScheme.tertiary,
    ),
    unselectedLabelTextStyle: textTheme.titleLarge?.copyWith(
      fontFamily: FontFamily.inter,
      fontSize: 14,
      fontWeight: FontWeight.w600,
      color: colorScheme.onSurface.withValues(alpha: 0.55),
    ),
    selectedIconTheme: IconThemeData(color: colorScheme.tertiary),
    unselectedIconTheme: IconThemeData(
      color: colorScheme.onSurface.withValues(alpha: 0.4),
    ),
    indicatorColor: colorScheme.secondary,
    useIndicator: true,
    indicatorShape: const RoundedSuperellipseBorder(),
    backgroundColor: colorScheme.primary,
    elevation: 0,
  ),
  floatingActionButtonTheme: FloatingActionButtonThemeData(
    backgroundColor: colorScheme.secondary,
    foregroundColor: colorScheme.tertiary,
    elevation: 2,
  ),
  scaffoldBackgroundColor: colorScheme.surface,
  canvasColor: colorScheme.surfaceContainerHighest,
);

void main() {
  runZonedGuarded(() async {
    await _startup();
  }, _handleUncaughtZoneError);
}

void _handleUncaughtZoneError(Object error, StackTrace stack) {
  debugPrint('MAIN uncaught error: $error\n$stack');
  if (kReleaseMode && !kIsWeb) {
    FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
  }
}

Future<void> _startup() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Edge-to-edge: let the system draw behind status + nav bars.
  // SystemUiMode.edgeToEdge replaces the deprecated manual/SystemUiOverlay approach.
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      statusBarBrightness: Brightness.dark,
      systemNavigationBarColor: Colors.transparent,
      systemNavigationBarDividerColor: Colors.transparent,
      systemNavigationBarIconBrightness: Brightness.dark,
      systemNavigationBarContrastEnforced: false,
    ),
  );

  FlutterError.onError = (errorDetails) {
    debugPrint('FlutterError: ${errorDetails.exceptionAsString()}');
    errorDetails.stack?.printError();
    if (kReleaseMode && !kIsWeb) {
      FirebaseCrashlytics.instance.recordFlutterFatalError(errorDetails);
    }
  };

  PlatformDispatcher.instance.onError = (error, stack) {
    debugPrint('PlatformDispatcher error: $error\n$stack');
    if (kReleaseMode && !kIsWeb) {
      FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
    }
    return true;
  };

  try {
    // Firebase Crashlytics and the current Firebase options are mobile-only.
    // Web authentication uses the app API directly, so do not block startup
    // while web Firebase configuration is pending.
    if (!kIsWeb) {
      await Firebase.initializeApp(
        options: DefaultFirebaseOptions.currentPlatform,
      );
      await FirebaseCrashlytics.instance.setCrashlyticsCollectionEnabled(
        kReleaseMode,
      );
    }
    await EnvService.init();
    await Prefs().init();
    // On iOS, Keychain survives uninstall. Detect a fresh install via a
    // GetStorage flag (which IS wiped on uninstall) and clear Keychain before
    // reading the token, so reinstalled users always land on the login screen.
    await SecurePrefs.instance.clearKeychainIfFreshInstall();
    // Migrate any sensitive values from plain GetStorage to flutter_secure_storage
    // and warm the in-memory token + remembered-password caches.
    final prefs = Prefs();
    await SecurePrefs.instance.migrateFromGetStorage(
      legacyToken: prefs.getData(Prefs.userToken),
      legacyPassword: prefs.getRememberData(Prefs.rememberedPassword),
      clearLegacyToken: () async => prefs.putData(Prefs.userToken, ''),
      clearLegacyPassword: () async {
        await prefs.clearRememberMe();
      },
    );
    // Warm the in-memory caches so synchronous token() / getRememberData() callers work.
    await prefs.tokenAsync();
    await prefs.rememberedPasswordAsync();

    // Initialize Google Sign-In singleton
    await GoogleSignIn.instance.initialize(
      clientId: kIsWeb
          ? '846539386538-93rbe9hnt8487qq6o1nraqrsph4ss95b.apps.googleusercontent.com'
          : null,
    );
  } catch (e, stackTrace) {
    debugPrint('Startup failed before runApp: $e\n$stackTrace');
    runApp(_StartupErrorApp(message: e.toString()));
    return;
  }

  _registerCoreServices();
  if (!kIsWeb) {
    MapboxOptions.setAccessToken(EnvService.mapboxAccessToken);
  }

  if (kIsWeb) {
    setUrlStrategy(PathUrlStrategy());
  }
  final savedThemeMode = await AdaptiveTheme.getThemeMode();

  runApp(
    ToastificationWrapper(
      child: AdaptiveTheme(
        light: getTheme(lightColorScheme),
        dark: getTheme(darkColorScheme),
        initial: savedThemeMode ?? AdaptiveThemeMode.light,
        builder: (light, dark) =>
            Builder(builder: (context) => app(context, light, dark)),
      ),
    ),
  );

  unawaited(_postStartupInit());
}

void _registerCoreServices() {
  Get
    ..put(NetworkMonitorService(), permanent: true)
    ..put(ApiHandler(), tag: 'handler', permanent: true)
    ..put(DioClient().getClient(), tag: 'dio_client', permanent: true)
    ..put(LegalPagesCacheService(), permanent: true)
    ..put(AppConfigService(), permanent: true)
    ..put(MaintenanceService(), permanent: true)
    ..put(BookingLiveSocketService(), permanent: true)
    ..put(DriverDashboardSocketService(), permanent: true)
    ..put(CustomerDashboardSocketService(), permanent: true)
    ..put(DriverMapboxNavigationService(), permanent: true);
}

Future<void> _postStartupInit() async {
  // Fetch public app config (referral discount %, etc.) early so UI has it ready.
  unawaited(
    AppConfigService.to.fetchConfig().catchError((Object e) {
      debugPrint('AppConfigService.fetchConfig failed: $e');
    }),
  );

  unawaited(
    getTimeZone().catchError((Object e, StackTrace st) {
      debugPrint('getTimeZone failed: $e\n$st');
      return '';
    }),
  );

  try {
    await StripeClientConfig.ensurePublishableKeySynced();
    final stripeKey = ApiConstants.stripePublishableKey.trim();
    if (stripeKey.isEmpty) return;
    if (!stripeKey.startsWith('pk_')) {
      throw Exception(
        'Invalid Stripe publishable key. Expected a key that starts with pk_.',
      );
    }
  } catch (e, stackTrace) {
    debugPrint('Stripe initialization failed: $e\n$stackTrace');
  }

  // OneSignal after network stack + Get services: reduces iOS -1005 "connection lost"
  // during cold start when CFNetwork races with first subscription sync to api.onesignal.com.
  if (!kIsWeb) {
    await Future<void>.delayed(const Duration(milliseconds: 450));

    try {
      await OneSignalService.initialize();
    } catch (e, st) {
      debugPrint('OneSignal initialization failed: $e\n$st');
    }

    unawaited(Get.put(StripeKycDeepLinkService(), permanent: true).init());
  }
}

class _StartupErrorApp extends StatelessWidget {
  const _StartupErrorApp({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Car Comfort could not start',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 12),
                Text(message),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

GetMaterialApp app(BuildContext context, ThemeData light, ThemeData dark) {
  if (kIsWeb) {
    var route = AppPages.INITIAL;
    return GetMaterialApp.router(
      transitionDuration: const Duration(milliseconds: 350),
      scrollBehavior: MyCustomScrollBehavior(),
      defaultTransition: Transition.cupertino,
      debugShowCheckedModeBanner: false,
      localizationsDelegates: const [
        CountryLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [Locale('en')],
      locale: const Locale('en'),
      builder: (context, child) => _dismissKeyboardWrapper(context, child),
      routerDelegate: Get.createDelegate(
        preventDuplicateHandlingMode:
            PreventDuplicateHandlingMode.PopUntilOriginalRoute,
      ),
      //  routeInformationParser: GetInformationParser(initialRoute: AppPages.INITIAL),
      routeInformationParser: CustomRouteInformationParser(
        initialRoute: route,
        routes: AppPages.routes,
      ),
      getPages: AppPages.routes,
      title: 'Car Comfort',
      darkTheme: light,
      theme: light,
    );
  } else {
    return GetMaterialApp(
      builder: (context, child) => AnnotatedRegion<SystemUiOverlayStyle>(
        value: const SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.light,
          statusBarBrightness: Brightness.dark,
          // Transparent nav bar required for edge-to-edge on Android 15+
          systemNavigationBarColor: Colors.transparent,
          systemNavigationBarDividerColor: Colors.transparent,
          systemNavigationBarIconBrightness: Brightness.dark,
          systemNavigationBarContrastEnforced: false,
        ),
        child: child ?? const SizedBox.shrink(),
      ),
      transitionDuration: const Duration(milliseconds: 350),
      defaultTransition: Transition.cupertino,
      debugShowCheckedModeBanner: false,
      localizationsDelegates: const [
        CountryLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [Locale('en')],
      locale: const Locale('en'),
      // builder: (context, child) => _dismissKeyboardWrapper(context, child),
      initialRoute: AppPages.INITIAL,
      getPages: AppPages.routes,
      navigatorObservers: [_MapRouteObserver()],
      title: 'Car Comfort',
      darkTheme: light,
      theme: light,
    );
  }
}

Widget _dismissKeyboardWrapper(BuildContext context, Widget? child) {
  return GestureDetector(
    behavior: HitTestBehavior.translucent,
    onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
    child: child ?? const SizedBox.shrink(),
  );
}

// Custom route information parser for web
class CustomRouteInformationParser
    extends RouteInformationParser<GetNavConfig> {
  final String initialRoute;
  final List<GetPage> routes; // optional: used to validate known routes

  // These are the only routes a signed-out visitor can open directly. Every
  // other browser URL is an authenticated app surface and must start at login.
  static const _publicRoutes = <String>{
    Routes.SPLASH,
    Routes.MAINTENANCE,
    Routes.ONBOARDING,
    Routes.LOGIN,
    Routes.REGISTER,
    Routes.DRIVERREGISTER,
    Routes.DRIVER_TSHIRT_SIZE,
    Routes.UPLOAD_DRIVER_LICENSE,
    Routes.ADD_VEHICLE_INFORMATION,
    Routes.UPLOAD_VEHICLE_REGISTRATION_PHOTO,
    Routes.BACKGROUND_CHECK,
    Routes.DRIVER_OTP,
    Routes.APPROVAL_PROCESS_REVIEW,
    Routes.APPROVE_COMPLETE,
    Routes.WELCOME,
    Routes.WELCOME_TO_CAR_COMFORT,
    Routes.TUTORIAL,
    Routes.CAMERA_ACCESS,
    Routes.LOCATION_ACCESS,
    Routes.OTP,
    Routes.FORGOT_PASSWORD,
    Routes.RESET_PASSWORD,
  };

  CustomRouteInformationParser({
    required this.initialRoute,
    required this.routes,
  }) {
    Get.log('CustomRouteInformationParser is created !$routes');
  }

  bool _isKnownRoute(String location) {
    final uri = Uri.tryParse(location);
    final path = uri?.path ?? location;
    return routes.any((p) => p.name == path);
  }

  @override
  SynchronousFuture<GetNavConfig> parseRouteInformation(
    RouteInformation routeInformation,
  ) {
    final uri = routeInformation.uri;
    var location = uri.toString();
    var pathOnly = uri.path;

    Alert.log(runtimeType.toString(), 'Parsing route: $location');

    // Redirect empty or root to initialRoute
    if (location.isEmpty ||
        location == '/' ||
        pathOnly.isEmpty ||
        pathOnly == '/') {
      Alert.log(
        runtimeType.toString(),
        "Root/empty route detected, redirecting to initial route: $initialRoute",
      );
      location = initialRoute;
      pathOnly = initialRoute;
    } else if (!_isKnownRoute(location)) {
      // Only fall back if the path portion is not known
      Alert.log(
        runtimeType.toString(),
        "Unknown route '$location', redirecting to initial route: $initialRoute",
      );
      location = initialRoute;
      pathOnly = initialRoute;
    } else if (_requiresLogin(pathOnly)) {
      Alert.log(
        runtimeType.toString(),
        "Signed-out user requested '$location', redirecting to login.",
      );
      location = '${Routes.LOGIN}?role=customer';
      pathOnly = Routes.LOGIN;
    }
    // Else: location is kept as-is (including query params) so GetX can parse them

    Get.log('CustomRouteInformationParser: route location: $location');

    // Match the complete location. GetX extracts both the route path and query
    // parameters here; matching only `pathOnly` silently drops PWA route data.
    final matchResult = Get.routeTree.matchRoute(location);

    return SynchronousFuture(
      GetNavConfig(
        currentTreeBranch: matchResult.treeBranch,
        location: location,
        state: routeInformation.state,
      ),
    );
  }

  @override
  RouteInformation restoreRouteInformation(GetNavConfig configuration) {
    return RouteInformation(
      uri: Uri.tryParse(configuration.locationString),
      state: configuration.state,
    );
  }

  bool _requiresLogin(String path) {
    final prefs = Prefs();
    final hasDriverSession =
        kIsWeb && prefs.getData(Prefs.role).trim().toLowerCase() == 'driver';
    return hasDriverSession ||
        (!_publicRoutes.contains(path) && prefs.token().trim().isEmpty);
  }
}
