import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';

import '../../../gen/assets.gen.dart';
import '../../../utils/extensions/extension.dart';
import '../../../utils/validator.dart';
import '../../../widgets/button.dart';
import '../../../widgets/text.dart';
import '../../../widgets/text_field.dart';
import 'driver_signup_controller.dart';

/// Driver onboarding — insurance details form (step 5).
class UploadInsuranceInformationView extends StatelessWidget {
  const UploadInsuranceInformationView({super.key});

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
        // Keyboard inset is applied only inside [_InsuranceScrollForm] so the
        // backdrop and header are not relayouted on every keyboard frame.
        resizeToAvoidBottomInset: false,
        body: GestureDetector(
          behavior: HitTestBehavior.translucent,
          onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
          child: Stack(
            fit: StackFit.expand,
            children: const [
              RepaintBoundary(child: _InsuranceSignupBackdrop()),
              SafeArea(child: _InsuranceScrollForm()),
            ],
          ),
        ),
      ),
    );
  }
}

/// Static background — does not read [MediaQuery.viewInsets], so it is not
/// rebuilt while the keyboard animates.
class _InsuranceSignupBackdrop extends StatelessWidget {
  const _InsuranceSignupBackdrop();

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        Positioned.fill(
          child: Assets.imagesSignupBg.image(
            fit: BoxFit.cover,
            filterQuality: FilterQuality.medium,
          ),
        ),
        Positioned.fill(
          child: ColoredBox(
            color: context.colorScheme.scrim.withValues(alpha: 0.2),
          ),
        ),
      ],
    );
  }
}

/// Scroll container that is the only subtree depending on keyboard insets.
class _InsuranceScrollForm extends StatefulWidget {
  const _InsuranceScrollForm();

  @override
  State<_InsuranceScrollForm> createState() => _InsuranceScrollFormState();
}

class _InsuranceScrollFormState extends State<_InsuranceScrollForm> {
  late final Widget _form = _InsuranceInformationForm(
    controller: Get.find<DriverSignupController>(),
  );

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: EdgeInsets.fromLTRB(14, 0, 14, 12 + bottomInset),
      // Same instance across keyboard frames — form fields are not rebuilt
      // while the keyboard animates.
      child: _form,
    );
  }
}

class _InsuranceInformationForm extends StatelessWidget {
  const _InsuranceInformationForm({required this.controller});

  final DriverSignupController controller;

  static const _coverageTypes = [
    'Liability',
    'Comprehensive',
    'Collision',
    'Full coverage',
    'Third-party',
    'Other',
  ];

  static const _fieldBgColor = Color.fromRGBO(0, 0, 0, 0.2);

  @override
  Widget build(BuildContext context) {
    final onPrimary = context.colorScheme.onPrimary;
    final scrim = context.colorScheme.scrim;

    return Form(
      key: controller.insuranceFormKey,
      autovalidateMode: AutovalidateMode.onUserInteraction,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 8),
          _InsuranceFormHeader(onPrimary: onPrimary),
          const SizedBox(height: 48),
          CommonText.bold(
            'Insurance Provider name',
            color: onPrimary,
            size: 16,
          ),
          const SizedBox(height: 8),
          CommonTextField(
            controller: controller.insuranceProviderController,
            hintText: 'Input',
            keyboardType: TextInputType.text,
            textColor: onPrimary,
            cursorColor: onPrimary,
            hintColor: Colors.white70,
            bgColor: _fieldBgColor,
            borderRadius: 20,
            padding: 12,
            validator: (v) => (v == null || v.trim().isEmpty)
                ? 'Please enter provider name'
                : null,
          ),
          const SizedBox(height: 16),
          CommonText.bold(
            'Insurance Policy Number',
            color: onPrimary,
            size: 14,
          ),
          const SizedBox(height: 8),
          CommonTextField(
            controller: controller.insurancePolicyNumberController,
            hintText: 'ABC1234',
            keyboardType: TextInputType.visiblePassword,
            textColor: onPrimary,
            cursorColor: onPrimary,
            hintColor: Colors.white70,
            bgColor: _fieldBgColor,
            borderRadius: 20,
            padding: 12,
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'[a-zA-Z0-9]')),
            ],
            validator: (v) {
              if (v == null || v.trim().isEmpty) return 'Please enter policy number';
              if (!RegExp(r'^[a-zA-Z0-9]+$').hasMatch(v.trim())) {
                return 'Policy number must contain only letters and numbers';
              }
              return null;
            },
          ),
          const SizedBox(height: 16),
          CommonText.bold(
            'Insurance Expiration Date',
            color: onPrimary,
            size: 14,
          ),
          const SizedBox(height: 8),
          CommonTextField(
            controller: controller.insuranceExpirationController,
            hintText: 'Expiration Date (MM/DD/YYYY)',
            keyboardType: TextInputType.number,
            isReadOnly: true,
            onTap: () => controller.selectInsuranceExpirationDate(context),
            inputFormatters: usDateInputFormatters,
            textColor: onPrimary,
            cursorColor: onPrimary,
            hintColor: Colors.white70,
            bgColor: _fieldBgColor,
            borderRadius: 20,
            padding: 12,
            suffixIcon: _CalendarPickerButton(
              onTap: () => controller.selectInsuranceExpirationDate(context),
              color: onPrimary,
            ),
            validator: validateFutureUsDateField,
          ),
          const SizedBox(height: 16),
          CommonText.bold(
            'Coverage Type',
            color: onPrimary,
            size: 14,
          ),
          const SizedBox(height: 8),
          Obx(
            () => CommonDropDownField(
              hintText: 'Select coverage type',
              selectedValue: controller.selectedCoverageType.value,
              items: _coverageTypes,
              onSave: (v) => controller.selectedCoverageType.value = v,
              errorText: 'Please select coverage type',
              borderRadius: 20,
              borderColor: onPrimary,
              bgColor: scrim.withValues(alpha: 0.2),
              selectedTextColor: onPrimary,
              iconColor: onPrimary,
              dropdownItemTextColor: scrim,
              hPadding: 12,
              vPadding: 12,
            ),
          ),
          const SizedBox(height: 32),
          Obx(
            () => AppButton(
              label: controller.isLoading.value
                  ? 'Please wait...'
                  : 'Save Insurance',
              onPressed: (controller.isLoading.value ||
                      !controller.isInsuranceFormValid.value)
                  ? null
                  : controller.saveInsuranceInformation,
              bgColor: (controller.isLoading.value ||
                      !controller.isInsuranceFormValid.value)
                  ? const Color(0xffF2051F).withValues(alpha: 0.5)
                  : const Color(0xffF2051F),
              btnCornerRadius: 14,
            ),
          ),
          const SizedBox(height: 12),
        ],
      ),
    );
  }
}

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

class _InsuranceFormHeader extends StatelessWidget {
  const _InsuranceFormHeader({required this.onPrimary});

  final Color onPrimary;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
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
          ],
        ),
        const SizedBox(height: 28),
        CommonText.bold(
          'Upload Insurance Information',
          color: onPrimary,
          size: 18,
        ),
      ],
    );
  }
}
