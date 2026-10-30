import 'dart:io';

import 'package:car_comfort/app/utils/extensions/extension.dart';
import 'package:car_comfort/app/widgets/image.dart';
import 'package:country_code_picker_plus/country_code_picker_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../routes/app_pages.dart';
import '../../utils/validator.dart';
import '../../utils/web_navigation.dart';

import '../../gen/assets.gen.dart';
import '../../theme/design_tokens.dart';
import '../../widgets/button.dart';
import '../../widgets/text.dart';
import '../../widgets/text_field.dart';
import '../driver_dashboard/driver_header_back_button.dart';
import 'settings_controller.dart';

class ProfileSettingsView extends GetView<SettingsController> {
  const ProfileSettingsView({super.key});

  static const Color _fieldRed = Color(0xffF2051F);
  static const Color _screenBg = Color(0xFFF7F7F7);
  static const Color _labelText = Color(0xFF1C1C1C);
  static const Color _fieldBorder = Color(0xFFE3E3E3);

  void _handleBack() {
    if (kIsWeb) {
      // PWA routes use Get's router delegate and may not have a route to pop.
      offAllNamed(Routes.DASHBOARD);
      return;
    }
    Get.back();
  }

  Widget _sectionLabel(String text) {
    // If the label ends with ' *', render the asterisk in brand red
    if (text.endsWith(' *')) {
      final base = text.substring(0, text.length - 2);
      return Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text.rich(
          TextSpan(
            text: base,
            style: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: _labelText,
            ),
            children: const [
              TextSpan(
                text: ' *',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: _fieldRed,
                ),
              ),
            ],
          ),
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: CommonText.medium(text, size: 13, color: _labelText),
    );
  }

  Widget _profilePhotoBlock(SettingsController controller) {
    final isEditing = controller.isProfileHeaderEditing;
    return Center(
      child: Column(
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 92,
                height: 92,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFFEDEDED),
                  border: Border.all(color: const Color(0xFFDCDCDC)),
                ),
                child:
                    controller.profileImagePath != null &&
                        controller.profileImagePath!.isNotEmpty
                    ? ClipOval(
                        child: _profilePhotoImage(controller.profileImagePath!),
                      )
                    : const Icon(
                        Icons.person_rounded,
                        size: 36,
                        color: Color(0xFF9EA4AE),
                      ),
              ),
              if (isEditing)
                Positioned(
                  right: -2,
                  bottom: -2,
                  child: Material(
                    color: _fieldRed,
                    shape: const CircleBorder(),
                    child: InkWell(
                      onTap: () =>
                          controller.openProfilePhotoPicker(Get.context!),
                      customBorder: const CircleBorder(),
                      child: const SizedBox(
                        width: 28,
                        height: 28,
                        child: Icon(
                          Icons.camera_alt_rounded,
                          color: Colors.white,
                          size: 14,
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
          if (isEditing) ...[
            const SizedBox(height: 10),
            const CommonText.regular(
              'Tap to change photo',
              color: Color(0xFF7D7D7D),
              size: 12,
            ),
          ],
        ],
      ),
    );
  }

  Widget _profilePhotoImage(String source) {
    final path = source.trim();
    final placeholder = Container(
      width: 92,
      height: 92,
      color: Colors.white,
      alignment: Alignment.center,
      child: const Icon(Icons.person_rounded, size: 48, color: Colors.grey),
    );

    if (path.startsWith('http://') || path.startsWith('https://')) {
      return ImageFromNetwork(
        path,
        fit: BoxFit.cover,
        width: 92,
        height: 92,
        placeholderWidget: placeholder,
      );
    }

    // Browser gallery/camera pickers expose the selected file as a blob URL.
    // Image.file is unsupported on Flutter Web and produced the red assertion
    // locally and an empty grey preview in release builds.
    if (kIsWeb) {
      final browserUrl = path.startsWith('blob:') || path.startsWith('data:')
          ? path
          : Uri.base.resolve(path).toString();
      return Image.network(
        browserUrl,
        fit: BoxFit.cover,
        width: 92,
        height: 92,
        loadingBuilder: (context, child, progress) =>
            progress == null ? child : placeholder,
        errorBuilder: (_, _, _) => placeholder,
      );
    }

    return Image.file(
      File(path),
      fit: BoxFit.cover,
      width: 92,
      height: 92,
      cacheWidth: 184,
      cacheHeight: 184,
      errorBuilder: (_, _, _) => placeholder,
    );
  }

  Widget _phoneField(SettingsController controller) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _fieldBorder),
      ),
      child: Row(
        children: [
          Obx(
            () => CountryCodePicker(
              mode: CountryCodePickerMode.dialog,
              initialSelection: controller.profileCountrySelection.value,
              enabled: controller.isProfileHeaderEditing,
              showFlag: true,
              showDropDownButton: true,
              flagWidth: 24,
              flagDecoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0xFFD8D8D8), width: 1),
              ),
              padding: const EdgeInsets.only(left: 12),
              textStyle: const TextStyle(
                color: Color(0xff1A1A1A),
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
              iconEnabledColor: Colors.black54,
              icon: const Icon(
                Icons.keyboard_arrow_down_rounded,
                color: Color(0xFF7D7D7D),
                size: 18,
              ),
              dialogBackgroundColor: const Color(0xFF1E1E1E),
              barrierColor: Colors.black54,
              closeIcon: const Icon(Icons.close, color: Colors.white70),
              dialogTextStyle: const TextStyle(
                color: Colors.white,
                fontSize: 15,
              ),
              searchDecoration: InputDecoration(
                hintText: 'Search',
                hintStyle: const TextStyle(color: Colors.white54),
                filled: true,
                fillColor: const Color(0xFF2C2C2C),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Colors.white24),
                ),
              ),
              searchStyle: const TextStyle(color: Colors.white),
              onInit: (c) {
                if (c != null) {
                  controller.profileDialCode.value = c.dialCode;
                }
              },
              onChanged: (c) {
                controller.profileDialCode.value = c.dialCode;
                controller.profileCountrySelection.value = c.code;
              },
            ),
          ),
          Container(width: 1, height: 26, color: const Color(0xFFE3E3E3)),
          Expanded(
            child: TextFormField(
              controller: controller.phoneController,
              keyboardType: TextInputType.phone,
              inputFormatters: phoneInputFormatters,
              textInputAction: TextInputAction.done,
              readOnly: !controller.isProfileHeaderEditing,
              style: const TextStyle(fontSize: 14, color: Color(0xff1A1A1A)),
              decoration:
                  commonFieldDecorationMatchingTextField(
                    Get.context!,
                    hintText: '(1 423) 555-0123',
                  ).copyWith(
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    disabledBorder: InputBorder.none,
                    filled: false,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 8,
                    ),
                  ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoCard() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFEAF3FF),
        borderRadius: BorderRadius.circular(10),
      ),
      child: const Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: EdgeInsets.only(top: 1),
            child: Icon(Icons.info, color: Color(0xFF5A8FD8), size: 16),
          ),
          SizedBox(width: 8),
          Expanded(
            child: CommonText.regular(
              'Your phone number and email are used for account verification and service notifications',
              size: 12,
              color: Color(0xFF5F6B7A),
            ),
          ),
        ],
      ),
    );
  }

  Widget _textField({
    required TextEditingController controller,
    required String label,
    required String hint,
    TextInputAction? textInputAction,
    TextInputType? keyboardType,
    bool readOnly = false,
    Widget? prefixIcon,
    bool isRequired = false,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CommonTextField(
          controller: controller,
          labelText: label,
          isRequired: isRequired,
          inputAction: textInputAction ?? TextInputAction.next,
          keyboardType: TextInputType.text,
          isReadOnly: readOnly,
          hintText: hint,
          prefixIcon: prefixIcon,
          borderRadius: AppRadius.md,
          borderColor: _fieldBorder,
          bgColor: Colors.white,
          textColor: const Color(0xff1A1A1A),
          labelColor: _labelText,
          hintColor: const Color(0xFF9A9A9A),
          cursorColor: _fieldRed,
          padding: 14,
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    final keyboardBottom = MediaQuery.viewInsetsOf(context).bottom;

    return GetBuilder<SettingsController>(
      initState: (_) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (controller.isProfileHeaderEditing) {
            controller.resetProfileHeaderEditing();
          }
        });
      },
      builder: (controller) {
        return Scaffold(
          backgroundColor: _screenBg,
          body: GestureDetector(
            onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
            behavior: HitTestBehavior.translucent,
            child: Column(
              children: [
                ClipRRect(
                  borderRadius: const BorderRadius.vertical(
                    bottom: Radius.circular(18),
                  ),
                  child: SizedBox(
                    height: top + 84,
                    width: double.infinity,
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        Assets.imagesHomeHBg.image(fit: BoxFit.cover),
                        Container(
                          color: context.colorScheme.scrim.withValues(
                            alpha: 0.45,
                          ),
                        ),
                        Padding(
                          padding: EdgeInsets.fromLTRB(12, top + 12, 12, 12),
                          child: Row(
                            children: [
                              DriverHeaderBackButton(onTap: _handleBack),
                              Expanded(
                                child: Center(
                                  child: CommonText.regular(
                                    controller.isProfileHeaderEditing
                                        ? 'Edit Personal Information'
                                        : 'Personal Information',
                                    color: context.colorScheme.onPrimary,
                                    size: 18,
                                  ),
                                ),
                              ),
                              TextButton(
                                onPressed:
                                    controller.toggleProfileHeaderEditing,
                                style: TextButton.styleFrom(
                                  foregroundColor:
                                      context.colorScheme.onPrimary,
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 8,
                                  ),
                                  minimumSize: const Size(0, 0),
                                  tapTargetSize:
                                      MaterialTapTargetSize.shrinkWrap,
                                ),
                                child: CommonText.medium(
                                  controller.isProfileHeaderEditing
                                      ? 'Done'
                                      : 'Edit',
                                  color: context.colorScheme.onPrimary,
                                  size: 14,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                Expanded(
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 900),
                      child: SingleChildScrollView(
                        keyboardDismissBehavior:
                            ScrollViewKeyboardDismissBehavior.onDrag,
                        padding: EdgeInsets.fromLTRB(
                          16,
                          8,
                          16,
                          24 + keyboardBottom,
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            _profilePhotoBlock(controller),
                            const SizedBox(height: 24),
                            _textField(
                              controller: controller.firstNameController,
                              label: 'First Name',
                              hint: 'Enter your first name',
                              textInputAction: TextInputAction.next,
                              readOnly: !controller.isProfileHeaderEditing,
                              isRequired: controller.isProfileHeaderEditing,
                            ),
                            const SizedBox(height: 14),
                            _textField(
                              controller: controller.lastNameController,
                              label: 'Last Name',
                              hint: 'Enter your last name',
                              textInputAction: TextInputAction.next,
                              readOnly: !controller.isProfileHeaderEditing,
                              isRequired: controller.isProfileHeaderEditing,
                            ),
                            const SizedBox(height: 14),
                            _textField(
                              controller: controller.emailController,
                              label: 'Email Address',
                              hint: 'your.email@example.com',
                              keyboardType: TextInputType.emailAddress,
                              textInputAction: TextInputAction.next,
                              readOnly: true,
                              prefixIcon: const Icon(
                                Icons.mail_outline_rounded,
                                color: Color(0xFF8B8B8B),
                                size: 18,
                              ),
                            ),
                            const SizedBox(height: 14),
                            _sectionLabel(
                              controller.isProfileHeaderEditing
                                  ? 'Phone Number *'
                                  : 'Phone Number',
                            ),
                            _phoneField(controller),
                            const SizedBox(height: 14),
                            _infoCard(),
                            if (controller.isProfileHeaderEditing) ...[
                              const SizedBox(height: 24),
                              AppButton(
                                label: controller.isSavingProfile.value
                                    ? 'Saving...'
                                    : controller.isProfileLoading
                                    ? 'Loading...'
                                    : 'Save',
                                onPressed:
                                    controller.isProfileLoading ||
                                        controller.isSavingProfile.value
                                    ? null
                                    : controller.saveCustomerProfile,
                                bgColor: _fieldRed,
                                btnCornerRadius: AppRadius.lg,
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
