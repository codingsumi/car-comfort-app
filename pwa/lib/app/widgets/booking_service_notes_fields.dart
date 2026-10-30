import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../constants/booking_service_notes.dart';
import '../modules/service_booking/service_booking_controller.dart';
import '../widgets/text.dart';
import '../widgets/text_field.dart';

/// Structured service notes on the vehicle booking step.
class BookingServiceNotesFields extends StatelessWidget {
  const BookingServiceNotesFields({
    super.key,
    required this.controller,
    this.additionalNotesHint =
        'Any other instructions our service provider should know.',
  });

  final ServiceBookingController controller;
  final String additionalNotesHint;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final fieldBg = Colors.transparent;
    final fieldBorder = scheme.outlineVariant;

    return Obx(() {
      controller.reviewRevision.value;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              CommonText.extraBold('Service Notes', size: 18),
              const SizedBox(width: 4),
              const Text(
                ' * Required fields',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w400,
                  color: Color(0xffF2051F),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          CommonText.bold(
            BookingServiceNotes.serviceNotesIntro,
            size: 13,
            color: Colors.grey.shade700,
          ),
          const SizedBox(height: 16),
          _dropdown(
            context,
            label: 'Where is the vehicle parked?',
            value: controller.selectedVehicleParkedLocation.value,
            items: BookingServiceNotes.vehicleParkedOptions,
            onSave: (v) => controller.selectedVehicleParkedLocation.value = v,
            fieldBg: fieldBg,
            fieldBorder: fieldBorder,
            scheme: scheme,
          ),
          if (BookingServiceNotes.isOtherSelection(
            controller.selectedVehicleParkedLocation.value,
          )) ...[
            const SizedBox(height: 12),
            _otherField(
              controller: controller.vehicleParkedLocationOtherController,
              scheme: scheme,
              fieldBg: fieldBg,
              fieldBorder: fieldBorder,
            ),
          ],
          const SizedBox(height: 16),
          _dropdown(
            context,
            label: 'Where should our service provider park?',
            value: controller.selectedProviderParkLocation.value,
            items: BookingServiceNotes.providerParkOptions,
            onSave: (v) => controller.selectedProviderParkLocation.value = v,
            fieldBg: fieldBg,
            fieldBorder: fieldBorder,
            scheme: scheme,
          ),
          if (BookingServiceNotes.isOtherSelection(
            controller.selectedProviderParkLocation.value,
          )) ...[
            const SizedBox(height: 12),
            _otherField(
              controller: controller.providerParkLocationOtherController,
              scheme: scheme,
              fieldBg: fieldBg,
              fieldBorder: fieldBorder,
            ),
          ],
          const SizedBox(height: 16),
          _dropdown(
            context,
            label: 'Where is the key?',
            value: controller.selectedVehicleKeyLocation.value,
            items: BookingServiceNotes.vehicleKeyOptions,
            onSave: (v) => controller.selectedVehicleKeyLocation.value = v,
            fieldBg: fieldBg,
            fieldBorder: fieldBorder,
            scheme: scheme,
          ),
          if (BookingServiceNotes.isOtherSelection(
            controller.selectedVehicleKeyLocation.value,
          )) ...[
            const SizedBox(height: 12),
            _otherField(
              controller: controller.vehicleKeyLocationOtherController,
              scheme: scheme,
              fieldBg: fieldBg,
              fieldBorder: fieldBorder,
            ),
          ],
          const SizedBox(height: 16),
          _dropdown(
            context,
            label: 'Where should our provider leave the key?',
            value: controller.selectedKeyReturnLocation.value,
            items: BookingServiceNotes.keyReturnOptions,
            onSave: (v) => controller.selectedKeyReturnLocation.value = v,
            fieldBg: fieldBg,
            fieldBorder: fieldBorder,
            scheme: scheme,
          ),
          if (BookingServiceNotes.isOtherSelection(
            controller.selectedKeyReturnLocation.value,
          )) ...[
            const SizedBox(height: 12),
            _otherField(
              controller: controller.keyReturnLocationOtherController,
              scheme: scheme,
              fieldBg: fieldBg,
              fieldBorder: fieldBorder,
            ),
          ],
          const SizedBox(height: 16),
          CommonTextField(
            controller: controller.otherNotesVehicleController,
            hintText: additionalNotesHint,
            maxLines: 4,
            minLines: 3,
            labelText: 'Additional service notes (optional)',
            labelColor: scheme.onSurface,
            textColor: scheme.onSurface,
            hintColor: fieldBorder,
            inputAction: TextInputAction.newline,
            bgColor: fieldBg,
            keyboardType: TextInputType.multiline,
            borderColor: fieldBorder,
          ),
        ],
      );
    });
  }

  Widget _dropdown(
    BuildContext context, {
    required String label,
    required String? value,
    required List<String> items,
    required ValueChanged<String?> onSave,
    required Color fieldBg,
    required Color fieldBorder,
    required ColorScheme scheme,
  }) {
    return CommonDropDownField(
      hintText: 'Select an option',
      labelText: label,
      isRequired: true,
      selectedValue: value,
      items: items,
      errorText: 'Please select an option',
      selectedTextColor: scheme.onSurface,
      labelColor: scheme.onSurface,
      hintColor: fieldBorder,
      bgColor: fieldBg,
      borderColor: fieldBorder,
      onSave: onSave,
    );
  }

  Widget _otherField({
    required TextEditingController controller,
    required ColorScheme scheme,
    required Color fieldBg,
    required Color fieldBorder,
  }) {
    return CommonTextField(
      controller: controller,
      hintText: 'Please specify',
      labelText: 'Other details',
      labelColor: scheme.onSurface,
      textColor: scheme.onSurface,
      hintColor: fieldBorder,
      bgColor: fieldBg,
      borderColor: fieldBorder,
      validator: (v) {
        if ((v ?? '').trim().isEmpty) return 'Please specify';
        return null;
      },
    );
  }
}
