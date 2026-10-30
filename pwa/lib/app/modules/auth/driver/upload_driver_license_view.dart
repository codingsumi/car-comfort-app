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
import '../../../widgets/upload_image_slot.dart';
import 'driver_signup_controller.dart';

class UploadDriverLicenseView extends GetView<DriverSignupController> {
  const UploadDriverLicenseView({super.key});

  @override
  Widget build(BuildContext context) {
    const slotGrey = Color(0xFFE6E6E6);

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
                  color: context.colorScheme.scrim.withValues(alpha: 0.2),
                ),
              ),
              SafeArea(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  child: LayoutBuilder(
                    builder: (context, constraints) {
                      return SingleChildScrollView(
                        child: ConstrainedBox(
                          constraints: BoxConstraints(
                            minHeight: constraints.maxHeight,
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
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
                                          borderRadius: BorderRadius.circular(
                                            20,
                                          ),
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
                                  ).paddingOnly(bottom: 28),
                                  CommonText.bold(
                                    'Driver License',
                                    color: context.colorScheme.onPrimary,
                                    size: 16,
                                  ).paddingOnly(top: 32),
                                  const SizedBox(height: 16),
                                  CommonTextField(
                                    controller:
                                        controller.driversLicenseNumberController,
                                    hintText: 'Driver License Number',
                                    keyboardType: TextInputType.text,
                                    inputFormatters: [
                                      FilteringTextInputFormatter.allow(RegExp(r'[a-zA-Z0-9\-.\s/]')),
                                    ],
                                    textColor: context.colorScheme.onPrimary,
                                    cursorColor: context.colorScheme.onPrimary,
                                    hintColor: Colors.white70,
                                    bgColor: Colors.black.withValues(alpha: 0.2),
                                    borderRadius: 20,
                                    padding: 12,
                                  ),
                                  const SizedBox(height: 12),
                                  _DateMaskField(
                                    controller:
                                        controller.driversLicenseIssuedController,
                                    hintText: 'Date Issued (MM/DD/YYYY)',
                                    onCalendarTap: () => controller
                                        .selectDriversLicenseIssuedDate(
                                          context,
                                        ),
                                    emptyMessage: 'Please enter date issued',
                                  ),
                                  const SizedBox(height: 12),
                                  _DateMaskField(
                                    controller: controller
                                        .driversLicenseExpirationController,
                                    hintText: 'Expiration Date (MM/DD/YYYY)',
                                    onCalendarTap: () => controller
                                        .selectDriversLicenseExpirationDate(
                                          context,
                                        ),
                                    emptyMessage: 'Please enter expiration date',
                                  ),
                                  const SizedBox(height: 16),
                                  CommonText.regular(
                                    'Upload front and back photos',
                                    color: context.colorScheme.onPrimary
                                        .withValues(alpha: 0.8),
                                    size: 14,
                                  ),
                                  const SizedBox(height: 12),
                                  Obx(
                                    () => UploadImageSlot(
                                      imagePath:
                                          controller.driverLicenseFrontPath.value,
                                      placeholderLabel: 'Upload Front Image',
                                      slotColor: slotGrey,
                                      onUploadTap: () =>
                                          controller.pickDriverLicenseSide(
                                            context,
                                            isFront: true,
                                          ),
                                    ),
                                  ),
                                  const SizedBox(height: 16),
                                  Obx(
                                    () => UploadImageSlot(
                                      imagePath:
                                          controller.driverLicenseBackPath.value,
                                      placeholderLabel: 'Upload Back Image',
                                      slotColor: slotGrey,
                                      onUploadTap: () =>
                                          controller.pickDriverLicenseSide(
                                            context,
                                            isFront: false,
                                          ),
                                    ),
                                  ),
                                  const SizedBox(height: 24),
                                ],
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  Obx(
                                    () => AppButton(
                                      label: controller.isLoading.value
                                          ? 'Please wait...'
                                          : 'Next',
                                      onPressed: controller.isLoading.value
                                          ? null
                                          : controller.completeDriverLicense,
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
                                          onTap: () =>
                                              openLoginForRole('driver'),
                                        ),
                                      ],
                                    ),
                                  const SizedBox(height: 12),
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    },
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

/// MM/DD/YYYY masked date field with real-time inline validation.
///
/// - Auto-inserts `/` as the user types via [usDateInputFormatters].
/// - Validates month (1–12) and day (1–max for that month) as each segment
///   is completed — invalid entries show a red error line immediately,
///   not just on form submit.
/// - Calendar icon opens the system date picker as a fallback.
class _DateMaskField extends StatefulWidget {
  const _DateMaskField({
    required this.controller,
    required this.hintText,
    required this.onCalendarTap,
    required this.emptyMessage,
  });

  final TextEditingController controller;
  final String hintText;
  final VoidCallback onCalendarTap;
  final String emptyMessage;

  @override
  State<_DateMaskField> createState() => _DateMaskFieldState();
}

class _DateMaskFieldState extends State<_DateMaskField> {
  String? _inlineError;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onChanged);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onChanged);
    super.dispose();
  }

  void _onChanged() {
    final text = widget.controller.text;
    final err = _realtimeValidate(text);
    if (err != _inlineError) {
      setState(() => _inlineError = err);
    }
  }

  /// Returns an error string as soon as enough digits have been typed to
  /// confirm an invalid value, or null when the value is valid/incomplete.
  String? _realtimeValidate(String text) {
    final digits = text.replaceAll('/', '');
    if (digits.isEmpty) return null;

    // Validate month once 2 digits are entered.
    if (digits.length >= 2) {
      final month = int.tryParse(digits.substring(0, 2));
      if (month == null || month < 1 || month > 12) {
        return 'Month must be 01–12';
      }

      // Validate day once 4 digits are entered.
      if (digits.length >= 4) {
        final day = int.tryParse(digits.substring(2, 4));
        final maxDay = _daysInMonth(
          month,
          digits.length == 8
              ? int.tryParse(digits.substring(4, 8))
              : DateTime.now().year, // best-effort until year is typed
        );
        if (day == null || day < 1 || day > maxDay) {
          return 'Day must be 01–$maxDay for this month';
        }
      }
    }

    // Full date entered — run the complete calendar check.
    if (digits.length == 8) {
      if (parseUsDate(text) == null) {
        return 'Invalid date — use MM/DD/YYYY';
      }
    }

    return null;
  }

  /// Returns the maximum valid day for [month] in [year].
  int _daysInMonth(int month, int? year) {
    final y = year ?? DateTime.now().year;
    return DateTime(y, month + 1, 0).day;
  }

  @override
  Widget build(BuildContext context) {
    final onPrimary = context.colorScheme.onPrimary;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        CommonTextField(
          controller: widget.controller,
          hintText: widget.hintText,
          keyboardType: TextInputType.number,
          isReadOnly: true,
          onTap: widget.onCalendarTap,
          inputFormatters: usDateInputFormatters,
          textColor: onPrimary,
          cursorColor: onPrimary,
          hintColor: Colors.white70,
          bgColor: Colors.black.withValues(alpha: 0.2),
          borderRadius: 20,
          padding: 12,
          suffixIcon: _CalendarPickerButton(
            onTap: widget.onCalendarTap,
            color: onPrimary,
          ),
          validator: (value) => validateUsDateField(
            value,
            emptyMessage: widget.emptyMessage,
          ),
        ),
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 180),
          child: _inlineError != null
              ? Padding(
                  key: ValueKey(_inlineError),
                  padding: const EdgeInsets.only(top: 4, left: 16),
                  child: Text(
                    _inlineError!,
                    style: const TextStyle(
                      color: Color(0xFFFF453A),
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                )
              : const SizedBox.shrink(key: ValueKey('none')),
        ),
      ],
    );
  }
}

/// Trailing calendar affordance for the masked date fields. Kept off the field
/// border with right padding and vertically centred so it stays aligned.
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
