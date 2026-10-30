import 'dart:io';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter_html/flutter_html.dart';
import 'package:geolocator/geolocator.dart';
import 'package:get/get.dart';
import 'package:permission_handler/permission_handler.dart';

import 'alerts.dart';
import 'extensions/extension.dart';

/// Shows an actionable prompt when Android's device-wide Location Services
/// switch is off. App permission and device Location Services are separate:
/// opening the app settings page cannot turn GPS/location services back on.
void showLocationServicesSettingsDialog() {
  if (Get.context == null || Get.isDialogOpen == true) return;
  showAlertDialog(
    'Enable Location Services',
    content:
        'To show your current position and use the map, turn on Location '
        'Services for your device.',
    primaryText: 'Turn On Location',
    secondaryText: 'Not Now',
    showSecondary: true,
    canDismiss: true,
    alertType: AlertType.info,
    primaryBtnClr: Get.context?.colorScheme.primary,
    primaryClick: () async {
      Get.back();
      await Geolocator.openLocationSettings();
    },
    secondaryClick: () => Get.back(),
  );
}

/// Shows a dialog telling the user that location permission is permanently
/// denied and offering a button to open the app's system settings page.
///
/// Call this wherever `LocationPermission.deniedForever` (Android) or the
/// iOS equivalent is detected in a **user-triggered** context (recenter
/// button, booking flow, navigation start, etc.).
/// Do NOT call it from background / polling paths.
void showLocationPermissionSettingsDialog() {
  if (Get.context == null) return;
  showAlertDialog(
    'Location Permission Required',
    content:
        'Location access is permanently denied. Please open Settings and '   
        'enable Location for Car Comfort to use map and location features.',
    primaryText: 'Open Settings',
    secondaryText: 'Not Now',
    showSecondary: true,
    canDismiss: true,
    alertType: AlertType.info,
    primaryBtnClr: Get.context?.colorScheme.primary,
    primaryClick: () async {
      Get.back();
      await openAppSettings();
    },
    secondaryClick: () => Get.back(),
  );
}

/// Request app-level permissions.
///
/// [isMediaPerm] is kept for backwards compatibility but no longer requests
/// storage / photo-library permissions on Android 13+ because image_picker
/// 1.1+ uses the Android Photo Picker which needs NO runtime permission for
/// gallery access. Only CAMERA is requested for camera capture flows.
Future<bool> requestPermissions({bool isMediaPerm = false}) async {
  try {
    final list = await permissionList(isMediaPerm: isMediaPerm);
    if (list.isEmpty) return true; // nothing to request
    final Map<Permission, PermissionStatus> statuses = await list.request();
    bool allPermissionsGranted = true;
    statuses.forEach((permission, status) {
      if (status.isPermanentlyDenied) {
        allPermissionsGranted = false;
        showAlertDialog('Permissions Denied',
            content: '',
            contentWidget: Html(data: '''
                            <div style="text-align:center;">
                           <p>Car Comfort needs permission to operate smoothly.</p>
                           <p>
                            Please open <strong>Settings</strong> on your phone.<br>
                            Next select <strong>Apps &gt; Car Comfort</strong>, and enable all permissions.
                            </p>
                            </div>
                          '''),
            primaryText: 'Okay',
            canDismiss: false,
            alertType: AlertType.info,
            showSecondary: false,
            primaryBtnClr: Get.context?.colorScheme.primary,
            primaryClick: () async {
              Get.back();
            },
            secondaryClick: () {
              Get.back();
            });
      } else if (!status.isGranted) {
        allPermissionsGranted = false;
      }
    });
    return allPermissionsGranted;
  } catch (e) {
    e.printError();
    return false;
  }
}

Future<bool> arePermissionsGranted() async {
  final permissions = await permissionList();
  for (final permission in permissions) {
    final status = await permission.status;
    if (!status.isGranted) return false;
  }
  return true;
}

/// Builds the list of permissions to request.
///
/// Gallery / photo-library access is intentionally excluded:
/// - Android 13+ (API 33+): image_picker uses Android Photo Picker — no
///   READ_MEDIA_IMAGES or READ_MEDIA_VIDEO permission is needed.
/// - Android ≤12: READ_EXTERNAL_STORAGE declared in the manifest with
///   maxSdkVersion="32" covers camera-capture temp files; no runtime
///   permission request is needed for gallery via image_picker.
/// - iOS: image_picker handles NSPhotoLibraryUsageDescription via the system
///   picker; no explicit permission_handler call is required.
///
/// Only CAMERA is requested here for in-app camera capture.
Future<List<Permission>> permissionList({bool isMediaPerm = false}) async {
  final androidVersion = await getAndroidVersion();
  final iosVersion = await getIosVersion();

  if (isMediaPerm) {
    // Camera-only — gallery handled by system Photo Picker (no permission needed)
    return <Permission>[Permission.camera];
  }

  return <Permission>[
    Permission.camera,
    if (Platform.isAndroid && androidVersion >= 33) Permission.notification,
    if (Platform.isIOS && iosVersion >= 13) Permission.notification,
  ];
}

/// Returns the appropriate storage permission for the Android version.
/// NOTE: This should NOT be called for gallery/image-picker flows on Android
/// 13+ — the Photo Picker needs no permission. Only use for legacy file
/// operations on Android ≤12.
Future<Permission> getStoragePermission() async {
  if (Platform.isAndroid) {
    final info = await DeviceInfoPlugin().androidInfo;
    // Android 13+ (API 33): use READ_MEDIA_IMAGES only when strictly needed
    // for non-picker file access (e.g. direct file path reads). For gallery
    // selection via image_picker, do NOT call this — Photo Picker handles it.
    return info.version.sdkInt >= 33 ? Permission.photos : Permission.storage;
  }
  return Permission.storage;
}

// Function to get Android version using device_info_plus
Future<int> getAndroidVersion() async {
  if (Platform.isAndroid) {
    DeviceInfoPlugin deviceInfo = DeviceInfoPlugin();
    AndroidDeviceInfo androidInfo = await deviceInfo.androidInfo;
    return androidInfo.version.sdkInt; // Returns Android SDK version
  }
  return 0;
}

Future<int> getIosVersion() async {
  if (Platform.isIOS) {
    DeviceInfoPlugin deviceInfo = DeviceInfoPlugin();
    IosDeviceInfo iosInfo = await deviceInfo.iosInfo;
    return int.parse(iosInfo.systemVersion.split('.')[0]);
  }
  return 0;
}
