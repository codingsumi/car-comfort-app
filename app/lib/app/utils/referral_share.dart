import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';

/// Referral code sharing via [share_plus] (system app chooser / bottom sheet).
class ReferralShare {
  ReferralShare._();

  static const String _appName = 'Car Comfort';
  static const MethodChannel _androidShareChannel =
      MethodChannel('io.carcomfort.app/share');

  /// Google Play install link (matches `applicationId` in Android build).
  static const String _playStoreUrl =
      'https://play.google.com/store/apps/details?id=io.carcomfort.app';

  /// App Store listing URL — update with real App Store numeric ID once published.
  /// e.g. 'https://apps.apple.com/app/id1234567890'
  /// Leave empty until the app is live so the share message stays clean.
  static const String _appStoreUrl =
      'https://apps.apple.com/app/car-comfort/id6746705432'; // TODO: replace with real App Store ID

  /// Builds the share message.
  ///
  /// [discountLabel] should be the admin-configured value, e.g. "10%".
  /// Defaults to "10%" when not provided.
  static String messageForCode(
    String referralCode, {
    String discountLabel = '20%',
  }) {
    final code = referralCode.trim();
    final installLinks = StringBuffer(
      'Download the CarComfort app:\n'
      'Android: $_playStoreUrl',
    );
    if (_appStoreUrl.isNotEmpty) {
      installLinks.write('\niOS: $_appStoreUrl');
    }
    return 'Refer your friends and family to CarComfort. '
        'After they install the app and book their first service, '
        "you'll both receive $discountLabel off our valet EV charging and car wash services.\n\n"
        'Use my referral code: $code\n\n'
        '${installLinks.toString().trimRight()}';
  }

  /// Opens the platform share sheet so the user can pick WhatsApp, Messages, etc.
  ///
  /// Pass [discountLabel] (e.g. "10%") so the share text always reflects the
  /// current admin-configured discount percentage.
  static Future<void> shareReferralCode(
    String referralCode, {
    String discountLabel = '10%',
  }) async {
    final text = messageForCode(referralCode.trim(), discountLabel: discountLabel);
    if (text.isEmpty) return;

    // Ensure the activity is ready after navigation / button tap.
    await SchedulerBinding.instance.endOfFrame;

    final subject = Platform.isIOS
        ? '$_appName referral — $discountLabel off'
        : null;

    try {
      final result = await SharePlus.instance.share(
        ShareParams(
          text: text,
          subject: subject,
          title: 'Share referral code',
        ),
      );

      if (result.status == ShareResultStatus.unavailable && Platform.isAndroid) {
        await _openAndroidShareChooser(text);
      }
    } on PlatformException catch (e, stack) {
      if (kDebugMode) {
        debugPrint('share_plus failed, trying native chooser: ${e.message}\n$stack');
      }
      if (Platform.isAndroid) {
        await _openAndroidShareChooser(text);
        return;
      }
      rethrow;
    }
  }

  static Future<void> _openAndroidShareChooser(String text) async {
    await _androidShareChannel.invokeMethod<void>(
      'shareText',
      <String, String>{
        'text': text,
        'title': 'Share referral code',
      },
    );
  }
}
