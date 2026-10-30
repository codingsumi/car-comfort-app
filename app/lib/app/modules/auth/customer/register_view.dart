import 'package:car_comfort/app/utils/extensions/extension.dart';
import 'package:country_code_picker_plus/country_code_picker_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';

import '../../../constants/ui_constants.dart';
import '../../../gen/assets.gen.dart';
import '../../../network/response/legal_page_response.dart';
import '../../../routes/app_pages.dart';
import '../../../utils/validator.dart';
import '../../../widgets/button.dart';
import '../../../widgets/image.dart';
import '../../../widgets/text.dart';
import '../../../widgets/text_field.dart';
import '../../../utils/role_switch_signup_flow.dart';
import '../auth_controller.dart';
import '../auth_entry_navigation.dart';
import '../widgets/signup_legal_consent.dart';

class RegisterView extends StatefulWidget {
  const RegisterView({super.key});

  @override
  State<RegisterView> createState() => _RegisterViewState();
}

class _RegisterViewState extends State<RegisterView> {
  late final AuthController controller = Get.find<AuthController>();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (Get.isRegistered<AuthController>()) {
        Get.find<AuthController>().applyLinkedAccountPrefill();
      }
      controller.initCustomerSignupLegalConsent();
    });
  }

  @override
  void dispose() {
    controller.resetCustomerSignupLegalConsentState();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final borderRadius = UIConstants.defaultMargin;
    final borderSide = BorderSide(
      color: context.colorScheme.onPrimary,
      width: 1.5,
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
                        children: [
                          const SizedBox(height: 58),
                          Assets.launcherLogo.image(
                            width: 132,
                            fit: BoxFit.contain,
                          ),
                          const SizedBox(height: 8),
                          CommonText.medium(
                            'Car Comfort',
                            color: context.colorScheme.onPrimary,
                            size: 13,
                          ),
                          Row(
                            children: [
                              InkWell(
                                onTap: () =>
                                    RoleSwitchSignupFlow.handleSignupBack(),
                                borderRadius: BorderRadius.circular(20),
                                child: Container(
                                  width: 30,
                                  height: 30,
                                  alignment: Alignment.center,
                                  child: Assets.imagesBack.image(
                                    width: 30,
                                    height: 30,
                                    fit: BoxFit.contain,
                                  ),
                                ),
                              ),
                            ],
                          ).paddingOnly(bottom: 42),
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
                                  bgColor: context.colorScheme.scrim.withValues(
                                    alpha: 0.2,
                                  ),
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
                          CommonTextField(
                            controller: controller.emailController,
                            hintText: 'Email',
                            keyboardType: TextInputType.emailAddress,
                            validator: (value) =>
                                validateEmail(value, checkEmpty: true),
                            textColor: context.colorScheme.onPrimary,
                            cursorColor: context.colorScheme.onPrimary,
                            hintColor: Colors.white70,
                            bgColor: context.colorScheme.scrim.withValues(
                              alpha: 0.2,
                            ),
                            borderRadius: 20,
                            padding: 12,
                            suffixIcon: Padding(
                              padding: const EdgeInsets.only(right: 6),
                              child: SvgImageFromAsset.square(
                                Assets.imagesIcEmail,
                                color: context.colorScheme.onPrimary,
                                size: 20,
                              ).paddingAll(8),
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
                              bgColor: context.colorScheme.scrim.withValues(
                                alpha: 0.2,
                              ),
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
                          Obx(
                            () => CommonTextField(
                              controller: controller.confirmPasswordController,
                              hintText: 'Confirm Password',
                              obscure: controller.hideConfirmPassword.value,
                              validator: (value) => validateConfirmPassword(
                                value,
                                controller.passwordController.text,
                              ),
                              textColor: context.colorScheme.onPrimary,
                              cursorColor: context.colorScheme.onPrimary,
                              hintColor: Colors.white70,
                              bgColor: context.colorScheme.scrim.withValues(
                                alpha: 0.2,
                              ),
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
                          ),
                          const SizedBox(height: 8),
                          CommonTextField(
                            controller: controller.referralCodeController,
                            hintText: 'Add your referral code',
                            textColor: context.colorScheme.onPrimary,
                            cursorColor: context.colorScheme.onPrimary,
                            hintColor: Colors.white70,
                            bgColor: context.colorScheme.scrim.withValues(
                              alpha: 0.2,
                            ),
                            borderRadius: 20,
                            padding: 12,
                            suffixIcon: Padding(
                              padding: const EdgeInsets.only(right: 6),
                              child: SvgImageFromAsset.square(
                                Assets.imagesIcEmail,
                                color: context.colorScheme.onPrimary,
                                size: 20,
                              ).paddingAll(8),
                            ),
                            iconConstraints: const BoxConstraints(
                              minWidth: 36,
                              minHeight: 36,
                            ),
                          ).paddingOnly(bottom: 48),
                          SignupLegalConsent(
                            controller: controller,
                            audience: LegalAudience.customer,
                          ),
                          const SizedBox(height: 8),
                          Obx(
                            () => AppButton(
                              label: controller.isLoading.value
                                  ? 'Please wait...'
                                  : 'Sign Up',
                              onPressed: controller.isLoading.value
                                  ? null
                                  : controller.signUp,
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
                                  color: context.colorScheme.onPrimary,
                                  size: 14,
                                  onTap: () => openLoginForRole('customer'),
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
