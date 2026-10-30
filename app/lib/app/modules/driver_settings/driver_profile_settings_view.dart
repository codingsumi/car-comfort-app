import 'dart:io';

import 'package:car_comfort/app/utils/extensions/extension.dart';
import 'package:car_comfort/app/widgets/image.dart';
import 'package:country_code_picker_plus/country_code_picker_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';

import '../../utils/validator.dart';

import '../../gen/assets.gen.dart';
import '../../routes/app_pages.dart';
import '../../theme/design_tokens.dart';
import '../../widgets/button.dart';
import '../../widgets/text.dart';
import '../driver_dashboard/driver_header_back_button.dart';
import 'driver_settings_controller.dart';

class DriverProfileSettingsView extends GetView<DriverSettingsController> {
  const DriverProfileSettingsView({super.key});

  static const Color _fieldRed = Color(0xffF2051F);

  InputDecoration _fieldDeco(String hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: TextStyle(
        color: Colors.grey.shade600,
        fontSize: 15,
        fontWeight: FontWeight.w400,
      ),
      border: InputBorder.none,
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
    );
  }

  Widget _shadowField({required Widget child}) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: child,
    );
  }

  Widget _profilePhotoBlock() {
    return Center(
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            width: 112,
            height: 112,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.grey.shade300,
              border: Border.all(
                color: Get.context!.colorScheme.scrim,
                width: 3,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.12),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child:
                controller.profileImagePath != null &&
                    controller.profileImagePath!.isNotEmpty
                ? ClipOval(
                    child: controller.profileImagePath!.startsWith('http')
                        ? ImageFromNetwork(
                            controller.profileImagePath!,
                            fit: BoxFit.cover,
                            width: 112,
                            height: 112,
                            placeholderWidget: Container(
                              color: Colors.white,
                              child: const Icon(
                                Icons.person_rounded,
                                size: 112,
                                color: Colors.grey,
                              ),
                            ),
                          )
                        : Image.file(
                            File(controller.profileImagePath!),
                            fit: BoxFit.cover,
                            width: 112,
                            height: 112,
                            cacheWidth: 224,
                            cacheHeight: 224,
                          ),
                  )
                : Icon(
                    Icons.person_rounded,
                    size: 56,
                    color: Colors.grey.shade100,
                  ),
          ),
          Positioned(
            right: 2,
            bottom: 2,
            child: Material(
              color: Colors.black87,
              shape: const CircleBorder(),
              child: InkWell(
                onTap: () => controller.openProfilePhotoPicker(Get.context!),
                customBorder: const CircleBorder(),
                child: const SizedBox(
                  width: 34,
                  height: 34,
                  child: Icon(
                    Icons.camera_alt_rounded,
                    color: Colors.white,
                    size: 18,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    final keyboardBottom = MediaQuery.viewInsetsOf(context).bottom;

    return GetBuilder<DriverSettingsController>(
      builder: (controller) {
        return Scaffold(
          backgroundColor: const Color(0xffFAFAFA),
          body: GestureDetector(
            onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
            behavior: HitTestBehavior.translucent,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
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
                              const DriverHeaderBackButton(),
                              Expanded(
                                child: Center(
                                  child: CommonText.regular(
                                    'Profile Settings',
                                    color: context.colorScheme.onPrimary,
                                    size: 18,
                                  ),
                                ),
                              ),
                              Material(
                                color: context.colorScheme.onPrimary,
                                shape: const CircleBorder(),
                                child: InkWell(
                                  onTap: () =>
                                      Get.toNamed(Routes.DRIVER_NOTIFICATIONS),
                                  customBorder: const CircleBorder(),
                                  child: const SizedBox(
                                    width: 40,
                                    height: 40,
                                    child: Icon(
                                      Icons.notifications_none_rounded,
                                      color: Colors.black87,
                                      size: 22,
                                    ),
                                  ),
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
                  child: SingleChildScrollView(
                    keyboardDismissBehavior:
                        ScrollViewKeyboardDismissBehavior.onDrag,
                    padding: EdgeInsets.only(bottom: 24 + keyboardBottom),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Padding(
                          padding: const EdgeInsets.fromLTRB(20, 24, 20, 16),
                          child: _profilePhotoBlock().paddingOnly(bottom: 48),
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 20),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              _shadowField(
                                child: TextFormField(
                                  controller: controller.firstNameController,
                                  textInputAction: TextInputAction.next,
                                  style: const TextStyle(
                                    fontSize: 16,
                                    color: Color(0xff1A1A1A),
                                  ),
                                  decoration: _fieldDeco('First Name'),
                                ),
                              ),
                              const SizedBox(height: 14),
                              _shadowField(
                                child: TextFormField(
                                  controller: controller.lastNameController,
                                  textInputAction: TextInputAction.next,
                                  style: const TextStyle(
                                    fontSize: 16,
                                    color: Color(0xff1A1A1A),
                                  ),
                                  decoration: _fieldDeco('Last Name'),
                                ),
                              ),
                              const SizedBox(height: 14),
                              _shadowField(
                                child: TextFormField(
                                  controller: controller.emailController,
                                  keyboardType: TextInputType.emailAddress,
                                  textInputAction: TextInputAction.next,
                                  style: const TextStyle(
                                    fontSize: 16,
                                    color: Color(0xff1A1A1A),
                                  ),
                                  decoration: _fieldDeco('Email Address'),
                                ),
                              ),
                              const SizedBox(height: 14),
                              _shadowField(
                                child: Row(
                                  children: [
                                    CountryCodePicker(
                                      mode: CountryCodePickerMode.dialog,
                                      initialSelection: 'US',
                                      showFlag: true,
                                      showDropDownButton: true,
                                      flagWidth: 28,
                                      padding: const EdgeInsets.only(left: 12),
                                      flagDecoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        border: Border.all(
                                          color: Colors.grey.shade400,
                                          width: 1,
                                        ),
                                      ),
                                      textStyle: const TextStyle(
                                        color: Color(0xff1A1A1A),
                                        fontSize: 14,
                                        fontWeight: FontWeight.w500,
                                      ),
                                      iconEnabledColor: Colors.black54,
                                      icon: Icon(
                                        Icons.keyboard_arrow_down_rounded,
                                        color: Colors.grey.shade800,
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
                                        color: context.colorScheme.onPrimary,
                                        fontSize: 15,
                                      ),
                                      searchDecoration: InputDecoration(
                                        hintText: 'Search',
                                        hintStyle: const TextStyle(
                                          color: Colors.white54,
                                        ),
                                        filled: true,
                                        fillColor: const Color(0xFF2C2C2C),
                                        border: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(
                                            12,
                                          ),
                                        ),
                                        enabledBorder: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(
                                            12,
                                          ),
                                          borderSide: const BorderSide(
                                            color: Colors.white24,
                                          ),
                                        ),
                                      ),
                                      searchStyle: TextStyle(
                                        color: context.colorScheme.onPrimary,
                                      ),
                                    ),
                                    Container(
                                      width: 1,
                                      height: 28,
                                      color: Colors.grey.shade300,
                                    ),
                                    Expanded(
                                      child: TextFormField(
                                       // maxLength: 10,
                                        controller: controller.phoneController,
                                        keyboardType: TextInputType.phone,
                                        inputFormatters: phoneInputFormatters,
                                        textInputAction: TextInputAction.done,
                                        style: const TextStyle(
                                          fontSize: 16,
                                          color: Color(0xff1A1A1A),
                                        ),
                                        decoration: _fieldDeco('Phone Number'),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 28),
                              AppButton(
                                label: controller.isSavingProfile.value
                                    ? 'Saving...'
                                    : 'Save Changes',
                                onPressed: controller.isSavingProfile.value
                                    ? null
                                    : controller.saveDriverProfile,
                                bgColor: _fieldRed,
                                btnCornerRadius: AppRadius.lg,
                              ),
                            ],
                          ),
                        ),
                      ],
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
