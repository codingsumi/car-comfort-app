import 'package:car_comfort/app/utils/extensions/extension.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';

import '../../../gen/assets.gen.dart';
import '../../../utils/role_switch_signup_flow.dart';
import '../../../utils/validator.dart';
import '../auth_entry_navigation.dart';
import '../../../widgets/button.dart';
import '../../../widgets/text.dart';
import '../../../widgets/text_field.dart';
import 'driver_signup_controller.dart';

class DriverTShirtSizeView extends GetView<DriverSignupController> {
  const DriverTShirtSizeView({super.key});

  static const _tShirtSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];

  @override
  Widget build(BuildContext context) {
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
                  child: Form(
                    key: controller.driverTshirtFormKey,
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
                                onTap: () => Get.back(),
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
                                onTap: () => RoleSwitchSignupFlow.cancelProviderSignup(),
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
                          'Hello there,',
                          color: context.colorScheme.onPrimary.withValues(
                            alpha: 0.72,
                          ),
                          size: 16,
                        ),
                        CommonText.regular(
                          'Personal Information',
                          color: context.colorScheme.onPrimary,
                          size: 29,
                        ).paddingOnly(bottom: 8),
                        Expanded(
                          child: LayoutBuilder(
                            builder: (context, constraints) {
                              return SingleChildScrollView(
                                child: ConstrainedBox(
                                  constraints: BoxConstraints(
                                    minHeight: constraints.maxHeight,
                                  ),
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    mainAxisSize: MainAxisSize.min,
                                    crossAxisAlignment:
                                        CrossAxisAlignment.stretch,
                                    children: [
                                      Obx(
                                        () => CommonDropDownField(
                                          hintText: 'T-Shirt Size',
                                          selectedValue: controller
                                              .selectedTShirtSize
                                              .value,
                                          items: _tShirtSizes,
                                          onSave: (v) =>
                                              controller
                                                      .selectedTShirtSize
                                                      .value =
                                                  v,
                                          errorText:
                                              'Please select a T-shirt size',
                                          borderRadius: 20,
                                          borderColor:
                                              context.colorScheme.onPrimary,
                                          bgColor: Colors.black.withValues(
                                            alpha: 0.2,
                                          ),
                                          selectedTextColor:
                                              context.colorScheme.onPrimary,
                                          iconColor:
                                              context.colorScheme.onPrimary,
                                          dropdownItemTextColor:
                                              context.colorScheme.scrim,
                                          hPadding: 12,
                                          vPadding: 12,
                                        ),
                                      ),
                                      const SizedBox(height: 12),
                                      CommonTextField(
                                        controller: controller.dateOfBirthController,
                                        hintText: 'Date of Birth (MM/DD/YYYY)',
                                        keyboardType: TextInputType.number,
                                        isReadOnly: true,
                                        onTap: () => controller
                                            .selectDateOfBirth(context),
                                        inputFormatters: usDateInputFormatters,
                                        textColor: context.colorScheme.onPrimary,
                                        cursorColor: context.colorScheme.onPrimary,
                                        hintColor: Colors.white70,
                                        bgColor: Colors.black.withValues(alpha: 0.2),
                                        borderRadius: 20,
                                        padding: 12,
                                        validator: (value) => validateUsDateField(
                                          value,
                                          emptyMessage:
                                              'Date of birth is required',
                                        ),
                                        suffixIcon: _CalendarPickerButton(
                                          onTap: () => controller
                                              .selectDateOfBirth(context),
                                          color: context.colorScheme.onPrimary,
                                        ),
                                      ),
                                      const SizedBox(height: 12),
                                      _DriverAddressSearchField(
                                        controller: controller,
                                      ),
                                      const SizedBox(height: 12),
                                      CommonTextField(
                                        controller:
                                            controller.socialSecurityNumberController,
                                        hintText: 'Social Security #',
                                        keyboardType: TextInputType.number,
                                        obscure: true,
                                        inputFormatters: [
                                          FilteringTextInputFormatter.digitsOnly,
                                          LengthLimitingTextInputFormatter(9),
                                        ],
                                        textColor: context.colorScheme.onPrimary,
                                        cursorColor: context.colorScheme.onPrimary,
                                        hintColor: Colors.white70,
                                        bgColor: Colors.black.withValues(alpha: 0.2),
                                        borderRadius: 20,
                                        padding: 12,
                                        validator: (value) {
                                          final digits = (value ?? '')
                                              .replaceAll(RegExp(r'\D'), '');
                                          if (digits.isEmpty) {
                                            return 'Social Security number is required';
                                          }
                                          if (digits.length != 9) {
                                            return 'Social Security number must be 9 digits';
                                          }
                                          return null;
                                        },
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                        Obx(
                          () => AppButton(
                            label: controller.isLoading.value
                                ? 'Please wait...'
                                : 'Continue',
                            onPressed: controller.isLoading.value
                                ? null
                                : controller.submitDriverTShirtSize,
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
                                'Already a member? ',
                                color: Colors.white70,
                                size: 14,
                              ),
                              CommonText.medium(
                                'Login',
                                color: context.colorScheme.onPrimary,
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
            ],
          ),
        ),
      ),
    );
  }
}

class _DriverAddressSearchField extends StatelessWidget {
  const _DriverAddressSearchField({required this.controller});

  final DriverSignupController controller;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CommonTextField(
          controller: controller.addressController,
          hintText: 'Search address',
          keyboardType: TextInputType.streetAddress,
          textCapitalization: TextCapitalization.words,
          inputFormatters: addressInputFormatters,
          textColor: context.colorScheme.onPrimary,
          cursorColor: context.colorScheme.onPrimary,
          hintColor: Colors.white70,
          bgColor: Colors.black.withValues(alpha: 0.2),
          borderRadius: 20,
          padding: 12,
          onChanged: controller.onAddressChanged,
          validator: validateAddress,
          suffixIcon: Obx(() {
            if (controller.isSearchingAddress.value) {
              return const Padding(
                padding: EdgeInsets.all(12),
                child: SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white70,
                  ),
                ),
              );
            }
            if (controller.hasAddressText.value) {
              return IconButton(
                icon: Icon(
                  Icons.close_rounded,
                  color: context.colorScheme.onPrimary.withValues(alpha: 0.8),
                  size: 20,
                ),
                onPressed: controller.clearAddressSearch,
              );
            }
            return Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Icon(
                Icons.search_rounded,
                color: context.colorScheme.onPrimary.withValues(alpha: 0.8),
                size: 22,
              ),
            );
          }),
          iconConstraints: const BoxConstraints(
            minWidth: 36,
            minHeight: 36,
          ),
        ),
        Obx(() {
          final suggestions = controller.addressSuggestions;
          final showList = suggestions.isNotEmpty;
          final hasError =
              controller.addressSearchError.value?.trim().isNotEmpty == true;
          if (!showList && !hasError) return const SizedBox.shrink();

          return Container(
            margin: const EdgeInsets.only(top: 8),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.35),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: context.colorScheme.onPrimary.withValues(alpha: 0.25),
              ),
            ),
            child: hasError
                ? Padding(
                    padding: const EdgeInsets.all(12),
                    child: CommonText.regular(
                      'Could not load address suggestions right now.',
                      color: context.colorScheme.error,
                      size: 12,
                    ),
                  )
                : ConstrainedBox(
                    constraints: const BoxConstraints(maxHeight: 220),
                    child: ListView.builder(
                      padding: EdgeInsets.zero,
                      shrinkWrap: true,
                      itemCount: suggestions.length,
                      itemBuilder: (_, index) {
                        final place = suggestions[index];
                        return InkWell(
                          onTap: () =>
                              controller.selectAddressSuggestion(place),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 10,
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Icon(
                                  Icons.location_on_outlined,
                                  size: 18,
                                  color: context.colorScheme.onPrimary
                                      .withValues(alpha: 0.75),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: CommonText.regular(
                                    place.address,
                                    size: 13,
                                    color: context.colorScheme.onPrimary,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
          );
        }),
      ],
    );
  }
}

/// Trailing calendar affordance for the masked Date of Birth field. Padding
/// keeps the icon off the field border and vertically centred.
class _CalendarPickerButton extends StatelessWidget {
  const _CalendarPickerButton({
    required this.onTap,
    required this.color,
  });

  final VoidCallback onTap;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.only(left: 8, right: 14),
        child: Icon(
          Icons.calendar_today_outlined,
          color: color,
          size: 18,
        ),
      ),
    );
  }
}
