import 'dart:io';

import 'package:car_comfort/app/utils/extensions/extension.dart';
import 'package:country_code_picker_plus/country_code_picker_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';

import '../../../constants/ui_constants.dart';
import '../../../network/response/legal_page_response.dart';
import '../../../gen/assets.gen.dart';
import '../../../routes/app_pages.dart';
import '../../../utils/validator.dart';
import '../../../widgets/button.dart';
import '../../../widgets/image.dart';
import '../../../widgets/text.dart';
import '../../../widgets/text_field.dart';
import '../../../utils/role_switch_signup_flow.dart';
import '../../../utils/pref.dart';
import '../auth_controller.dart';
import '../auth_entry_navigation.dart';
import '../widgets/signup_legal_consent.dart';

class DriverRegisterView extends StatefulWidget {
  const DriverRegisterView({super.key});

  @override
  State<DriverRegisterView> createState() => _DriverRegisterViewState();
}

class _DriverRegisterViewState extends State<DriverRegisterView> {
  late final AuthController controller = Get.find<AuthController>();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (Get.isRegistered<AuthController>()) {
        Get.find<AuthController>().applyLinkedAccountPrefill();
      }
      controller.initProviderSignupLegalConsent();
    });
  }

  @override
  void dispose() {
    controller.resetProviderSignupLegalConsentState();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final borderRadius = UIConstants.defaultMargin;
    final borderSide = BorderSide(
      color: context.colorScheme.onPrimary,
      width: 1.2,
    );

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(
        systemNavigationBarIconBrightness: Brightness.light,
        systemNavigationBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
        statusBarColor: Colors.transparent,
      ),
      child: Scaffold(
        body: GestureDetector(
          behavior: HitTestBehavior.translucent,
          onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
          child: Stack(
            fit: StackFit.expand,
            children: [
              Positioned.fill(
                child: Assets.imagesSignupBg.image(fit: BoxFit.fill),
              ),
              Positioned.fill(
                child: Container(
                  color: context.colorScheme.scrim.withValues(alpha: 0.34),
                ),
              ),
              SafeArea(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  child: SingleChildScrollView(
                    child: Form(
                      key: controller.registerFormKey,
                      autovalidateMode: AutovalidateMode.onUserInteraction,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const SizedBox(height: 8),
                          Stack(
                            alignment: Alignment.center,
                            children: [
                              Align(
                                alignment: Alignment.centerLeft,
                                child: InkWell(
                                  onTap: () =>
                                      RoleSwitchSignupFlow.handleSignupBack(),
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
                                  onTap: () =>
                                      RoleSwitchSignupFlow.cancelProviderSignup(),
                                  borderRadius: BorderRadius.circular(20),
                                  child: CommonText.medium(
                                    'Cancel Signup',
                                    color: Colors.white70,
                                    size: 13,
                                  ),
                                ),
                              ),
                            ],
                          ),

                          CommonText.regular(
                            RoleSwitchSignupFlow.isActive
                                ? 'Welcome back,'
                                : 'Hello there,',
                            color: context.colorScheme.onPrimary.withValues(
                              alpha: 0.72,
                            ),
                            size: 16,
                          ),
                          CommonText.regular(
                            RoleSwitchSignupFlow.isActive
                                ? 'Become a Service Provider'
                                : 'Register Yourself',
                            color: context.colorScheme.onPrimary,
                            size: 29,
                          ).paddingOnly(bottom: 8),
                          if (RoleSwitchSignupFlow.isActive)
                            ...([
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 14,
                                  vertical: 10,
                                ),
                                margin: const EdgeInsets.only(bottom: 14),
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: Colors.white.withValues(alpha: 0.3),
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(
                                      Icons.info_outline,
                                      color: Colors.white70,
                                      size: 18,
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: CommonText.regular(
                                        'Your existing account will be upgraded. '
                                        'You can switch between Customer and Provider using the same login.',
                                        color: Colors.white70,
                                        size: 13,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ]),
                          CommonText.regular(
                            'Profile Photo *',
                            color: context.colorScheme.onPrimary.withValues(
                              alpha: 0.75,
                            ),
                            size: 14,
                          ),
                          const SizedBox(height: 6),
                          _DriverProfilePhotoPicker(controller: controller),
                          const SizedBox(height: 8),
                          CommonText.regular(
                            'Required: use a clear, recent photo of your face. '
                            'The person in this photo must match the person on the driver license you upload.',
                            color: context.colorScheme.onPrimary.withValues(
                              alpha: 0.78,
                            ),
                            size: 12,
                          ),
                          const SizedBox(height: 18),
                          Row(
                            children: [
                              Expanded(
                                child: CommonTextField(
                                  controller: controller.firstNameController,
                                  hintText: 'First Name',
                                  validator: (value) => validatePersonName(
                                    value,
                                    fieldName: 'First name',
                                  ),
                                  textColor: context.colorScheme.onPrimary,
                                  cursorColor: context.colorScheme.onPrimary,
                                  hintColor: Colors.white70,
                                  bgColor: Colors.black.withValues(alpha: 0.2),
                                  borderRadius: 20,
                                  padding: 12,
                                  suffixIcon: Padding(
                                    padding: const EdgeInsets.only(right: 6),
                                    child: SvgImageFromAsset.square(
                                      Assets.imagesIcUser,
                                      color: context.colorScheme.onPrimary,
                                      size: 20,
                                    ).paddingAll(8),
                                  ),
                                  iconConstraints: const BoxConstraints(
                                    minWidth: 36,
                                    minHeight: 36,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: CommonTextField(
                                  controller: controller.lastNameController,
                                  hintText: 'Last Name',
                                  validator: (value) => validatePersonName(
                                    value,
                                    fieldName: 'Last name',
                                  ),
                                  textColor: context.colorScheme.onPrimary,
                                  cursorColor: context.colorScheme.onPrimary,
                                  hintColor: Colors.white70,
                                  bgColor: Colors.black.withValues(alpha: 0.2),
                                  borderRadius: 20,
                                  padding: 12,
                                  suffixIcon: Padding(
                                    padding: const EdgeInsets.only(right: 6),
                                    child: SvgImageFromAsset.square(
                                      Assets.imagesIcUser,
                                      color: context.colorScheme.onPrimary,
                                      size: 20,
                                    ).paddingAll(8),
                                  ),
                                  iconConstraints: const BoxConstraints(
                                    minWidth: 36,
                                    minHeight: 36,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          // Email — read-only when upgrading an existing account
                          CommonTextField(
                            controller: controller.emailController,
                            hintText: 'Email',
                            keyboardType: TextInputType.emailAddress,
                            isReadOnly: RoleSwitchSignupFlow.isActive,
                            validator: (value) =>
                                validateEmail(value, checkEmpty: true),
                            textColor: RoleSwitchSignupFlow.isActive
                                ? context.colorScheme.onPrimary.withValues(
                                    alpha: 0.6,
                                  )
                                : context.colorScheme.onPrimary,
                            cursorColor: context.colorScheme.onPrimary,
                            hintColor: Colors.white70,
                            bgColor: RoleSwitchSignupFlow.isActive
                                ? Colors.black.withValues(alpha: 0.35)
                                : Colors.black.withValues(alpha: 0.2),
                            borderRadius: 20,
                            padding: 12,
                            suffixIcon: Padding(
                              padding: const EdgeInsets.only(right: 10),
                              child: RoleSwitchSignupFlow.isActive
                                  ? Icon(
                                      Icons.lock_outline,
                                      size: 16,
                                      color: context.colorScheme.onPrimary
                                          .withValues(alpha: 0.5),
                                    )
                                  : SvgImageFromAsset.square(
                                      Assets.imagesIcEmail,
                                      size: 12,
                                      color: context.colorScheme.onPrimary,
                                    ),
                            ),
                            iconConstraints: const BoxConstraints(
                              minWidth: 36,
                              minHeight: 36,
                            ),
                          ),
                          const SizedBox(height: 8),
                          FormField<String>(
                            validator: (value) => validatePhoneNumber(
                              value ?? controller.phoneController.text,
                            ),
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
                                            searchDecoration:
                                                const InputDecoration(
                                                  hintText: 'Search',
                                                  hintStyle: TextStyle(
                                                    color: Colors.white54,
                                                  ),
                                                  filled: true,
                                                  fillColor: Color(0xFF2C2C2C),
                                                  border: OutlineInputBorder(
                                                    borderRadius:
                                                        BorderRadius.all(
                                                          Radius.circular(12),
                                                        ),
                                                  ),
                                                  enabledBorder:
                                                      OutlineInputBorder(
                                                        borderRadius:
                                                            BorderRadius.all(
                                                              Radius.circular(
                                                                12,
                                                              ),
                                                            ),
                                                        borderSide: BorderSide(
                                                          color: Colors.white24,
                                                        ),
                                                      ),
                                                ),
                                            searchStyle: TextStyle(
                                              color:
                                                  context.colorScheme.onPrimary,
                                            ),
                                            onInit: (c) {
                                              controller.signupDialCode.value =
                                                  '+1';
                                            },
                                            onChanged: (_) =>
                                                controller
                                                        .signupDialCode
                                                        .value =
                                                    '+1',
                                          ),
                                        ),
                                        Container(
                                          width: 1,
                                          height: 30,
                                          color: context.colorScheme.onPrimary,
                                        ),
                                        Expanded(
                                          child: TextFormField(
                                            controller:
                                                controller.phoneController,
                                            keyboardType: TextInputType.phone,
                                            inputFormatters:
                                                phoneInputFormatters,
                                            textInputAction:
                                                TextInputAction.done,
                                            onChanged: field.didChange,
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
                          ),
                          const SizedBox(height: 8),
                          // Password — hidden when upgrading an existing account
                          if (!RoleSwitchSignupFlow.isActive) ...[
                            Obx(
                              () => CommonTextField(
                                controller: controller.passwordController,
                                hintText: 'Password',
                                obscure: controller.hidePassword.value,
                                validator: (value) =>
                                    validatePassword(value, checkRegex: true),
                                textColor: context.colorScheme.onPrimary,
                                cursorColor: context.colorScheme.onPrimary,
                                hintColor: Colors.white70,
                                bgColor: Colors.black.withValues(alpha: 0.2),
                                borderRadius: 20,
                                padding: 12,
                                suffixIcon: InkWell(
                                  onTap: controller.togglePassword,
                                  child: Padding(
                                    padding: const EdgeInsets.only(right: 12),
                                    child: SvgImageFromAsset.square(
                                      controller.hidePassword.value
                                          ? Assets.imagesIcHide
                                          : Assets.imagesIcShow,
                                      size: 12,
                                      color: context.colorScheme.onPrimary,
                                    ),
                                  ),
                                ),
                                iconConstraints: const BoxConstraints(
                                  minWidth: 36,
                                  minHeight: 36,
                                ),
                              ),
                            ),
                            const SizedBox(height: 8),
                            // Confirm Password — hidden when upgrading (already logged in)
                            Obx(
                              () => CommonTextField(
                                controller:
                                    controller.confirmPasswordController,
                                hintText: 'Confirm Password',
                                obscure: controller.hideConfirmPassword.value,
                                validator: (value) => validateConfirmPassword(
                                  value,
                                  controller.passwordController.text,
                                ),
                                textColor: context.colorScheme.onPrimary,
                                cursorColor: context.colorScheme.onPrimary,
                                hintColor: Colors.white70,
                                bgColor: Colors.black.withValues(alpha: 0.2),
                                borderRadius: 20,
                                padding: 12,
                                suffixIcon: InkWell(
                                  onTap: controller.toggleConfirmPassword,
                                  child: Padding(
                                    padding: const EdgeInsets.only(right: 12),
                                    child: SvgImageFromAsset.square(
                                      controller.hideConfirmPassword.value
                                          ? Assets.imagesIcHide
                                          : Assets.imagesIcShow,
                                      size: 12,
                                      color: context.colorScheme.onPrimary,
                                    ),
                                  ),
                                ),
                                iconConstraints: const BoxConstraints(
                                  minWidth: 36,
                                  minHeight: 36,
                                ),
                              ),
                            ).paddingOnly(bottom: 16),
                          ] else
                            const SizedBox(height: 8),
                          SignupLegalConsent(
                            controller: controller,
                            audience: LegalAudience.provider,
                          ),
                          const SizedBox(height: 12),
                          Obx(
                            () => AppButton(
                              label: controller.isLoading.value
                                  ? 'Please wait...'
                                  : 'Register',
                              onPressed: controller.isLoading.value
                                  ? null
                                  : controller.driverSignUp,
                              bgColor: const Color(0xffF2051F),
                              btnCornerRadius: 14,
                            ),
                          ),
                          const SizedBox(height: 8),
                          if (!RoleSwitchSignupFlow.isActive)
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const CommonText.regular(
                                  'Already a member?',
                                  color: Colors.white70,
                                  size: 14,
                                ),
                                CommonText.medium(
                                  'Login',
                                  color: Colors.white,
                                  size: 14,
                                  onTap: () => openLoginForRole('driver'),
                                ),
                              ],
                            ),
                          const SizedBox(height: 12),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DriverProfilePhotoPicker extends StatelessWidget {
  const _DriverProfilePhotoPicker({required this.controller});

  final AuthController controller;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Obx(
        () => Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: context.colorScheme.onPrimary,
                  width: 2,
                ),
              ),
              child: ClipOval(
                child:
                    (controller.driverProfilePhotoPath.value ?? '').isNotEmpty
                    ? Image.file(
                        File(controller.driverProfilePhotoPath.value ?? ''),
                        fit: BoxFit.cover,
                        cacheWidth: 240,
                        cacheHeight: 240,
                      )
                    : SvgImageFromAsset.square(
                        Assets.imagesIcUser,
                        color: context.colorScheme.onPrimary,
                        size: 20,
                        fit: BoxFit.fill,
                      ).paddingAll(16),
              ),
            ),
            Positioned(
              right: 3,
              bottom: 3,
              child: InkWell(
                onTap: () => controller.pickDriverProfilePhoto(context),
                borderRadius: BorderRadius.circular(20),
                child: Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: const Color(0xff2E2E2E),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: context.colorScheme.onPrimary,
                      width: 1.5,
                    ),
                  ),
                  child: Center(
                    child: Icon(
                      Icons.camera_alt_outlined,
                      color: context.colorScheme.onPrimary,
                      size: 16,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
