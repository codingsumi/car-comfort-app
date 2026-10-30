import 'package:flutter/material.dart';
import 'package:flutter/widgets.dart';
import 'package:google_sign_in_web/web_only.dart' as google_web;

Widget googleSignInWebButton() {
  return Container(
    decoration: BoxDecoration(borderRadius: BorderRadius.circular(100)),
    clipBehavior: Clip.hardEdge,
    child: google_web.renderButton(
      configuration: google_web.GSIButtonConfiguration(
        type: google_web.GSIButtonType.standard,
        theme: google_web.GSIButtonTheme.outline,
        size: google_web.GSIButtonSize.large,
        text: google_web.GSIButtonText.continueWith,
        shape: google_web.GSIButtonShape.rectangular,
        logoAlignment: google_web.GSIButtonLogoAlignment.center,
        minimumWidth: 600,
        locale: 'en',
      ),
    ),
  );
}
