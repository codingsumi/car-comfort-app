import 'package:country_code_picker_plus/country_code_picker_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';

import '../../constants/ui_constants.dart';
import '../../gen/assets.gen.dart';
import '../../utils/extensions/extension.dart';
import '../../utils/validator.dart';
import '../../widgets/button.dart';
import '../../widgets/text.dart';
import '../../widgets/text_field.dart';
import 'auth_controller.dart';

class ForgotPasswordView extends GetView<AuthController> {
  const ForgotPasswordView({super.key});

  @override
  Widget build(BuildContext context) {
    final borderRadius = UIConstants.defaultMargin;
    final borderSide = BorderSide(
      color: context.colorScheme.onPrimary,
      width: 1.5,
    );
    final keyboardInset = MediaQuery.viewInsetsOf(context).bottom;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(
        systemNavigationBarIconBrightness: Brightness.light,
        systemNavigationBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
        statusBarColor: Colors.transparent,
      ),
      child: Scaffold(
        resizeToAvoidBottomInset: false,
        body: GestureDetector(
          behavior: HitTestBehavior.translucent,
          onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
          child: Stack(
            fit: StackFit.expand,
            children: [
              Positioned.fill(
                child: Assets.imagesSignupBg.image(fit: BoxFit.fill),
                // Image.asset(
                //   'assets/images/signup_bg.png',
                //   fit: BoxFit.fill,
                // ),
              ),
              Positioned.fill(
                child: Container(
                  color: context.colorScheme.scrim.withValues(alpha: 0.34),
                ),
              ),
              SafeArea(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 18),
                  child: Form(
                    key: controller.forgotPasswordFormKey,
                    child: SingleChildScrollView(
                      keyboardDismissBehavior:
                          ScrollViewKeyboardDismissBehavior.onDrag,
                      padding: EdgeInsets.only(bottom: keyboardInset + 20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const SizedBox(height: 12),
                          Align(
                            alignment: Alignment.centerLeft,
                            child: InkWell(
                              onTap: Get.back,
                              borderRadius: BorderRadius.circular(20),
                              child: SizedBox(
                                width: 30,
                                height: 30,
                                child: Assets.imagesBack.image(
                                  width: 30,
                                  height: 30,
                                  fit: BoxFit.contain,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 28),
                          Align(
                            alignment: Alignment.centerLeft,
                            child: CommonText.regular(
                              'Forget Password',
                              color: context.colorScheme.onPrimary,
                              size: 28,
                            ),
                          ),
                          const SizedBox(height: 16),
                          const CommonText.regular(
                            'In order to reset your password you need to enter your registered phone number.',
                            color: Colors.white70,
                            size: 14,
                          ).paddingOnly(bottom: 32),

                          CommonTextField(
                            controller: controller.forgotEmailController,
                            hintText: 'Email Address',
                            keyboardType: TextInputType.emailAddress,
                            validator: (value) =>
                                validateEmail(value, checkEmpty: false),
                            suffixIcon: Padding(
                              padding: const EdgeInsets.only(right: 12),
                              child: Assets.imagesMail.image(
                                width: 16,
                                height: 16,
                                fit: BoxFit.contain,
                              ),
                            ),
                            iconConstraints: const BoxConstraints(
                              minWidth: 36,
                              minHeight: 36,
                            ),
                            borderRadius: borderRadius,
                            borderColor: context.colorScheme.onPrimary,
                          ),
                          const SizedBox(height: 12),
                          const Align(
                            alignment: Alignment.centerLeft,
                            child: CommonText.regular(
                              "If you don't have an email try with phone number",
                              color: Colors.white54,
                              size: 13,
                            ),
                          ),
                          const SizedBox(height: 12),
                          FormField<String>(
                            validator: (_) {
                              final digits = phoneDigitsOnly(
                                controller.forgotPhoneController.text,
                              );
                              if (digits.isEmpty) return null;
                              return validatePhoneNumber(
                                controller.forgotPhoneController.text,
                              );
                            },
                            builder: (field) {
                              return Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Container(
                                    height: 45,
                                    decoration: BoxDecoration(
                                      color: context.colorScheme.scrim
                                          .withValues(alpha: 0.18),
                                      borderRadius: BorderRadius.circular(
                                        borderRadius,
                                      ),
                                      border: Border.fromBorderSide(borderSide),
                                    ),
                                    clipBehavior: Clip.antiAlias,
                                    child: Row(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.center,
                                      children: [
                                        Flexible(
                                          flex: 0,
                                          fit: FlexFit.loose,
                                          child: CountryCodePicker(
                                            mode: CountryCodePickerMode.dialog,
                                            initialSelection: 'US',
                                            showFlag: true,
                                            showDropDownButton: true,
                                            flagWidth: 32,
                                            flagDecoration: BoxDecoration(
                                              shape: BoxShape.circle,
                                              border: Border.all(
                                                color: context
                                                    .colorScheme
                                                    .onPrimary
                                                    .withValues(alpha: 0.65),
                                                width: 1,
                                              ),
                                            ),
                                            padding: const EdgeInsets.only(
                                              left: 12,
                                            ),
                                            textStyle: TextStyle(
                                              color:
                                                  context.colorScheme.onPrimary,
                                              fontSize: 14,
                                              fontWeight: FontWeight.w500,
                                            ),
                                            iconEnabledColor: Colors.white70,
                                            icon: Icon(
                                              Icons.keyboard_arrow_down_rounded,
                                              color:
                                                  context.colorScheme.onPrimary,
                                              size: 22,
                                            ),
                                            dialogBackgroundColor: const Color(
                                              0xFF1E1E1E,
                                            ),
                                            barrierColor: Colors.black54,
                                            closeIcon: const Icon(
                                              Icons.close,
                                              color: Colors.white70,
                                            ),
                                            dialogTextStyle: TextStyle(
                                              color:
                                                  context.colorScheme.onPrimary,
                                              fontSize: 15,
                                            ),
                                            searchDecoration: InputDecoration(
                                              hintText: 'Search',
                                              hintStyle: const TextStyle(
                                                color: Colors.white54,
                                              ),
                                              filled: true,
                                              fillColor: Color(0xFF2C2C2C),
                                              border: OutlineInputBorder(
                                                borderRadius: BorderRadius.all(
                                                  Radius.circular(12),
                                                ),
                                              ),
                                              enabledBorder: OutlineInputBorder(
                                                borderRadius: BorderRadius.all(
                                                  Radius.circular(12),
                                                ),
                                                borderSide: BorderSide(
                                                  color: Colors.white24,
                                                ),
                                              ),
                                              focusedBorder: OutlineInputBorder(
                                                borderRadius: BorderRadius.all(
                                                  Radius.circular(12),
                                                ),
                                                borderSide: BorderSide(
                                                  color: context
                                                      .colorScheme
                                                      .onPrimary,
                                                ),
                                              ),
                                            ),
                                            searchStyle: TextStyle(
                                              color:
                                                  context.colorScheme.onPrimary,
                                            ),
                                            onInit: (c) {
                                              if (c != null) {
                                                controller
                                                        .forgotDialCode
                                                        .value =
                                                    c.dialCode;
                                              }
                                            },
                                            onChanged: (c) =>
                                                controller
                                                        .forgotDialCode
                                                        .value =
                                                    c.dialCode,
                                          ),
                                        ),
                                        Container(
                                          width: 1,
                                          height: 30,
                                          color: context.colorScheme.onPrimary,
                                        ),
                                        Expanded(
                                          child: TextFormField(
                                            controller: controller
                                                .forgotPhoneController,
                                            keyboardType: TextInputType.phone,
                                            inputFormatters: phoneInputFormatters,
                                            textInputAction:
                                                TextInputAction.done,
                                            onChanged: (_) => field.didChange(
                                              controller
                                                  .forgotPhoneController
                                                  .text,
                                            ),
                                            style: context.textTheme.bodyLarge
                                                ?.copyWith(
                                                  color: context
                                                      .colorScheme
                                                      .onPrimary,
                                                  fontWeight: FontWeight.w400,
                                                  fontSize: 14,
                                                ),
                                            decoration: InputDecoration(
                                              hintText: 'Phone Number',
                                              hintStyle: TextStyle(
                                                color: context
                                                    .colorScheme
                                                    .onPrimary
                                                    .withValues(alpha: 0.7),
                                                fontSize: 14,
                                              ),
                                              border: InputBorder.none,
                                              isDense: true,
                                              contentPadding:
                                                  const EdgeInsets.symmetric(
                                                    horizontal: 14,
                                                    vertical: 10,
                                                  ),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  if (field.hasError) ...[
                                    const SizedBox(height: 6),
                                    Padding(
                                      padding: const EdgeInsets.only(left: 12),
                                      child: CommonText.regular(
                                        field.errorText ?? '',
                                        size: 14,
                                        color: context.colorScheme.error,
                                      ),
                                    ),
                                  ],
                                ],
                              );
                            },
                          ).paddingOnly(bottom: 100),

                          Obx(
                            () => AppButton(
                              label: controller.isLoading.value
                                  ? 'Please wait...'
                                  : 'Continue',
                              onPressed: controller.isLoading.value
                                  ? null
                                  : controller.submitForgotPassword,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              Obx(
                () => controller.isLoading.value
                    ? Positioned.fill(
                        child: IgnorePointer(
                          child: Container(
                            color: Colors.black.withValues(alpha: 0.22),
                            alignment: Alignment.center,
                            child: const SizedBox(
                              width: 30,
                              height: 30,
                              child: CircularProgressIndicator(
                                strokeWidth: 3,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ),
                      )
                    : const SizedBox.shrink(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
