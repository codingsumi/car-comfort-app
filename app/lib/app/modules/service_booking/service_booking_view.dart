import 'dart:async';

import 'package:car_comfort/app/constants/ui_constants.dart';
import 'package:car_comfort/app/utils/extensions/extension.dart';
import 'package:car_comfort/app/utils/validator.dart';
import 'package:car_comfort/app/widgets/text_field.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../widgets/payment_method_add_panel.dart';
import '../../routes/app_pages.dart';
import '../../utils/ev_account_card_on_file.dart';
import '../settings/payment_methods_binding.dart';
import '../settings/payment_methods_controller.dart';
import '../../widgets/blurred_image_screen_header.dart';
import '../../widgets/local_image_gallery_viewer.dart';
import '../../widgets/booking_service_notes_fields.dart';
import '../../widgets/button.dart';
import '../../widgets/text.dart';
import 'service_booking_controller.dart';
import 'service_booking_flow_widgets.dart';

class ServiceBookingView extends GetView<ServiceBookingController> {
  const ServiceBookingView({super.key});

  static const String _showAllCarWashLocationsLabel = 'See More';
  static const Color _red = ServiceBookingController.brandRed;
  static const Color _ctaRed = Color(0xffF2051F);
  static const Color _linkBlue = Color(0xff007AFF);
  static const Color _infoBg = Color(0xffE8F4FC);

  static const Color _bookingFieldBg = Colors.transparent;
  static const Color _locationSelectedBorder = Color(0xff34C759);
  static const Color _locationSelectedBg = Color(0xffF0FDF4);

  Color _bookingFieldBorder(BuildContext context) =>
      context.colorScheme.outlineVariant;

  Color _fieldBorderColor(BuildContext context, {required bool selected}) =>
      selected ? _locationSelectedBorder : _bookingFieldBorder(context);

  Widget _locationSelectedBanner(String message) {
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Row(
        children: [
          const Icon(
            Icons.check_circle_rounded,
            size: 14,
            color: _locationSelectedBorder,
          ),
          const SizedBox(width: 6),
          Expanded(
            child: CommonText.regular(
              message,
              size: 12,
              color: _locationSelectedBorder,
            ),
          ),
        ],
      ),
    );
  }

  Widget? _locationFieldSuffix({
    required bool isSelected,
    required bool isSearching,
    VoidCallback? onClear,
    bool showSearchWhenEmpty = true,
  }) {
    if (isSearching) {
      return const Padding(
        padding: EdgeInsets.all(12),
        child: SizedBox(
          width: 18,
          height: 18,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      );
    }
    if (isSelected) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Padding(
            padding: EdgeInsets.only(right: 4),
            child: Icon(
              Icons.check_circle_rounded,
              color: _locationSelectedBorder,
              size: 20,
            ),
          ),
          if (onClear != null)
            IconButton(
              icon: Icon(
                Icons.close_rounded,
                color: Colors.grey.shade600,
                size: 20,
              ),
              onPressed: onClear,
            ),
        ],
      );
    }
    if (onClear != null) {
      return IconButton(
        icon: Icon(Icons.close_rounded, color: Colors.grey.shade600, size: 20),
        onPressed: onClear,
      );
    }
    if (showSearchWhenEmpty) {
      return Icon(
        Icons.search_rounded,
        color: Colors.grey.shade600,
      ).marginOnly(right: 12);
    }
    return null;
  }

  Widget _customerLocationField(
    BuildContext context, {
    String labelText = 'Customer Location',
    Color? labelColor,
  }) {
    return Obx(() {
      final selected = controller.isPickupGpsSelected;
      final searching = controller.isSearchingNearbyPlaces.value;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CommonTextField(
            controller: controller.customerLocationController,
            labelText: labelText,
            labelColor: labelColor ?? context.colorScheme.onSurfaceVariant,
            textColor: context.colorScheme.onSurface,
            hintColor: _bookingFieldBorder(context),
            hintText: 'Get My Location',
            isReadOnly: true,
            bgColor: selected ? _locationSelectedBg : _bookingFieldBg,
            borderColor: _fieldBorderColor(context, selected: selected),
            onTap: controller.fillCustomerLocationPlaceholder,
            suffixIcon: selected
                ? _locationFieldSuffix(
                    isSelected: true,
                    isSearching: false,
                    onClear: controller.clearCustomerPickupLocation,
                    showSearchWhenEmpty: false,
                  )
                : IconButton(
                    icon: searching
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Icon(
                            Icons.my_location_outlined,
                            color: Colors.grey.shade600,
                          ),
                    onPressed: controller.fillCustomerLocationPlaceholder,
                  ),
          ),
          if (selected) _locationSelectedBanner('Your location is set'),
        ],
      );
    });
  }

  Widget _manualAddressInput(BuildContext context) {
    return Obx(() {
      final selected = controller.isPickupManualSelected;
      final searching = controller.isSearchingManualAddress.value;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CommonTextField(
            controller: controller.manualAddressController,
            textColor: context.colorScheme.onSurface,
            hintColor: _bookingFieldBorder(context),
            hintText: 'Enter customer/vehicle pickup address',
            bgColor: selected ? _locationSelectedBg : _bookingFieldBg,
            borderColor: _fieldBorderColor(context, selected: selected),
            keyboardType: TextInputType.streetAddress,
            textCapitalization: TextCapitalization.words,
            inputFormatters: addressInputFormatters,
            onChanged: controller.onManualAddressChanged,
            suffixIcon: _locationFieldSuffix(
              isSelected: selected,
              isSearching: searching,
              onClear: (selected || controller.hasManualAddressText.value)
                  ? controller.clearManualPickupAddress
                  : null,
              showSearchWhenEmpty: !controller.hasManualAddressText.value,
            ),
          ),
          if (selected)
            _locationSelectedBanner('Pickup address selected')
          else if (controller.hasManualAddressText.value)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: CommonText.regular(
                'Choose an address from the suggestions below',
                size: 12,
                color: Colors.grey.shade600,
              ),
            ),
          Obx(() {
            final suggestions = controller.manualAddressSuggestions;
            final showList = suggestions.isNotEmpty;
            final hasError =
                controller.manualAddressError.value?.trim().isNotEmpty == true;
            if (!showList && !hasError) return const SizedBox.shrink();

            return Container(
              margin: const EdgeInsets.only(top: 8),
              decoration: BoxDecoration(
                color: context.colorScheme.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: context.colorScheme.onPrimary.withValues(alpha: 0.2),
                ),
              ),
              child: hasError
                  ? Padding(
                      padding: const EdgeInsets.all(12),
                      child: CommonText.regular(
                        'Could not load address suggestions right now.',
                        color: Colors.red.shade600,
                        size: 12,
                      ),
                    )
                  : ConstrainedBox(
                      constraints: const BoxConstraints(maxHeight: 300),
                      child: ListView.builder(
                        padding: EdgeInsets.zero,
                        shrinkWrap: true,
                        itemCount: suggestions.length,
                        itemBuilder: (_, index) {
                          final place = suggestions[index];
                          return InkWell(
                            onTap: () =>
                                controller.selectManualAddressSuggestion(place),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 14,
                                vertical: 7,
                              ),
                              child: CommonText.regular(
                                place.address,
                                size: 13,
                                color: context.colorScheme.onSurface,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
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
    });
  }

  Widget _serviceLocationManualInput(BuildContext context) {
    return Obx(() {
      final selected = controller.isServiceLocationManualSelected;
      final searching = controller.isSearchingServiceLocation.value;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CommonTextField(
            controller: controller.serviceLocationController,
            textColor: context.colorScheme.onSurface,
            hintColor: _bookingFieldBorder(context),
            hintText: 'Enter service location',
            labelText: "Can't Find Service Location? Enter It Here",
            labelColor: context.colorScheme.secondary,
            bgColor: selected ? _locationSelectedBg : _bookingFieldBg,
            borderColor: _fieldBorderColor(context, selected: selected),
            keyboardType: TextInputType.streetAddress,
            textCapitalization: TextCapitalization.words,
            inputFormatters: addressInputFormatters,
            onChanged: controller.onServiceLocationChanged,
            suffixIcon: _locationFieldSuffix(
              isSelected: selected,
              isSearching: searching,
              onClear: (selected || controller.hasServiceLocationText.value)
                  ? controller.clearServiceLocationSelection
                  : null,
              showSearchWhenEmpty: !controller.hasServiceLocationText.value,
            ),
          ),
          if (selected)
            _locationSelectedBanner('Service location selected')
          else if (controller.hasServiceLocationText.value)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: CommonText.regular(
                'Choose a location from the suggestions below',
                size: 12,
                color: Colors.grey.shade600,
              ),
            ),
          Obx(() {
            final suggestions = controller.serviceLocationSuggestions;
            final showList = suggestions.isNotEmpty;
            final hasError =
                controller.serviceLocationError.value?.trim().isNotEmpty ==
                true;
            if (!showList && !hasError) return const SizedBox.shrink();

            return Container(
              margin: const EdgeInsets.only(top: 8),
              decoration: BoxDecoration(
                color: context.colorScheme.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: context.colorScheme.onPrimary.withValues(alpha: 0.2),
                ),
              ),
              child: hasError
                  ? Padding(
                      padding: const EdgeInsets.all(12),
                      child: CommonText.regular(
                        'Could not load address suggestions right now.',
                        color: Colors.red.shade600,
                        size: 12,
                      ),
                    )
                  : ConstrainedBox(
                      constraints: const BoxConstraints(maxHeight: 300),
                      child: ListView.builder(
                        padding: EdgeInsets.zero,
                        shrinkWrap: true,
                        itemCount: suggestions.length,
                        itemBuilder: (_, index) {
                          final place = suggestions[index];
                          return InkWell(
                            onTap: () => controller
                                .selectServiceLocationSuggestion(place),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 14,
                                vertical: 7,
                              ),
                              child: CommonText.regular(
                                place.address,
                                size: 13,
                                color: context.colorScheme.onSurface,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
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
    });
  }

  Widget _evChargingLocationManualInput(BuildContext context) {
    return Obx(() {
      final selected = controller.isEvChargingLocationManualSelected;
      final searching = controller.isSearchingEvChargingLocation.value;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CommonTextField(
            controller: controller.evChargingLocationController,
            textColor: context.colorScheme.onSurface,
            hintColor: _bookingFieldBorder(context),
            hintText: 'Enter charging location',
            labelText: "Can't Find Charging Location? Enter It Here",
            labelColor: context.colorScheme.secondary,
            bgColor: selected ? _locationSelectedBg : _bookingFieldBg,
            borderColor: _fieldBorderColor(context, selected: selected),
            keyboardType: TextInputType.streetAddress,
            textCapitalization: TextCapitalization.words,
            inputFormatters: addressInputFormatters,
            onChanged: controller.onEvChargingLocationChanged,
            suffixIcon: _locationFieldSuffix(
              isSelected: selected,
              isSearching: searching,
              onClear: (selected || controller.hasEvChargingLocationText.value)
                  ? controller.clearEvChargingLocationSelection
                  : null,
              showSearchWhenEmpty: !controller.hasEvChargingLocationText.value,
            ),
          ),
          if (selected)
            _locationSelectedBanner('Charging location selected')
          else if (controller.hasEvChargingLocationText.value)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: CommonText.regular(
                'Choose a charging location from the suggestions below',
                size: 12,
                color: Colors.grey.shade600,
              ),
            ),
          Obx(() {
            final suggestions = controller.evChargingLocationSuggestions;
            final showList = suggestions.isNotEmpty;
            final hasError =
                controller.evChargingLocationError.value?.trim().isNotEmpty ==
                true;
            if (!showList && !hasError) return const SizedBox.shrink();

            return Container(
              margin: const EdgeInsets.only(top: 8),
              decoration: BoxDecoration(
                color: context.colorScheme.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: context.colorScheme.onPrimary.withValues(alpha: 0.2),
                ),
              ),
              child: hasError
                  ? Padding(
                      padding: const EdgeInsets.all(12),
                      child: CommonText.regular(
                        'Could not load location suggestions right now.',
                        color: Colors.red.shade600,
                        size: 12,
                      ),
                    )
                  : ConstrainedBox(
                      constraints: const BoxConstraints(maxHeight: 300),
                      child: ListView.builder(
                        padding: EdgeInsets.zero,
                        shrinkWrap: true,
                        itemCount: suggestions.length,
                        itemBuilder: (_, index) {
                          final place = suggestions[index];
                          return InkWell(
                            onTap: () => controller
                                .selectEvChargingLocationSuggestion(place),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 14,
                                vertical: 7,
                              ),
                              child: CommonText.regular(
                                place.address,
                                size: 13,
                                color: context.colorScheme.onSurface,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
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
    });
  }

  bool get _ev => controller.isEvChargingFlow;

  bool get _combined => controller.isCombinedServiceFlow;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Obx(() {
            return Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                BlurredImageScreenHeader(
                  title: controller.appBarTitle,
                  onBack: controller.goBack,
                  backgroundFit: BoxFit.fill,
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
                  child: ServiceBookingStepper(
                    currentStep: controller.stepperVisualStep,
                    stepCount: ServiceBookingController.stepperSlotCount,
                    labels: controller.stepperLabels,
                  ),
                ),
              ],
            );
          }),
          Expanded(
            child: Obx(
              () => IndexedStack(
                index: controller.currentStep.value,
                children: _combined
                    ? [
                        _combinedLocationStep(context),
                        _carWashServiceStep(context),
                        _evChargingStep(context),
                        _carWashVehicleStep(context),
                        _combinedReviewStep(context),
                      ]
                    : _ev
                    ? [
                        _evLocationStep(context),
                        _evChargingStep(context),
                        _evVehicleStep(context),
                        _evReviewStep(context),
                      ]
                    : [
                        _carWashLocationStep(context),
                        _carWashServiceStep(context),
                        _carWashVehicleStep(context),
                        _carWashReviewStep(context),
                      ],
              ),
            ),
          ),
          _bottomBar(context),
        ],
      ),
    );
  }

  // —— Combined Step 0 ——
  Widget _combinedLocationStep(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CommonText.extraBold('Location Details', size: 22),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xffFFEBEE),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.local_car_wash_rounded, color: _red, size: 20),
                const SizedBox(width: 6),
                Icon(Icons.bolt_rounded, color: _red, size: 20),
                const SizedBox(width: 8),
                CommonText.semiBold('Combo', size: 13, color: _red),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _customerLocationField(context),
          const SizedBox(height: 16),
          Center(
            child: CommonText.regular(
              'Or Enter Address Manually',
              size: 13,
              color: Colors.grey.shade500,
            ),
          ),
          const SizedBox(height: 16),
          _manualAddressInput(context),
          const SizedBox(height: 20),
          _carWashLocationDropdown(context),
          const SizedBox(height: 20),
          _serviceLocationManualInput(context),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: _infoBg,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.info_outline_rounded, color: _linkBlue, size: 22),
                const SizedBox(width: 10),
                Expanded(
                  child: CommonText.regular(
                    "Your service provider will visit the selected charging station first, then head to the car wash location, before heading towards  the drop off location",
                    size: 13,
                    color: Colors.grey.shade800,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // —— EV Step 0 ——
  Widget _evLocationStep(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CommonText.extraBold('Location Details', size: 22),
          const SizedBox(height: 12),
          _customerLocationField(context),
          const SizedBox(height: 16),
          Center(
            child: CommonText.regular(
              'Or Enter Address Manually',
              size: 13,
              color: Colors.grey.shade500,
            ),
          ),
          const SizedBox(height: 16),
          _manualAddressInput(context),
          const SizedBox(height: 20),
          CommonText.regular(
            'Select Charging Type',
            size: 13,
            color: Colors.grey.shade600,
          ),
          const SizedBox(height: 8),
          Obx(
            () => CommonDropDownField(
              hintText: 'Select',
              selectedValue: controller.selectedChargingType.value,
              onSave: controller.setSelectedChargingType,
              items: controller.chargingTypeOptions,
              selectedTextColor: context.colorScheme.onSurface,
              hintColor: _bookingFieldBorder(context),
              errorText: 'Please select charging type',
              bgColor: _bookingFieldBg,
              borderColor: _bookingFieldBorder(context),
            ),
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: _infoBg,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.bolt_rounded, color: _linkBlue, size: 22),
                const SizedBox(width: 10),
                Expanded(
                  child: CommonText.regular(
                    "We'll show you available charging stations near your location",
                    size: 13,
                    color: Colors.grey.shade800,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _evAccountCardOnFileSection(context),
        ],
      ),
    );
  }

  /// EV charging form (no outer scroll). Used by [_evChargingStep].
  Widget _evChargingStepBody(
    BuildContext context, {
    bool hideScheduling = false,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CommonText.extraBold('Charging Details', size: 22),
        const SizedBox(height: 4),
        CommonText.regular(
          'Select from the list of fast charging stations nearby',
          size: 13,
          color: Colors.grey.shade700,
        ),
        const SizedBox(height: 4),
        if (controller.isCombinedServiceFlow) ...[
          _evAccountCardOnFileSection(context),
          const SizedBox(height: 16),
        ],
        Obx(() {
          final labels = controller.evStations.map((e) => e.menuLabel).toList();
          if (labels.isEmpty) return const SizedBox.shrink();
          final idx = controller.selectedEvStationIndex.value.clamp(
            0,
            labels.length - 1,
          );
          final sel = labels[idx];
          final dropdownSelected =
              controller.isEvChargingLocationDropdownSelected;
          return CommonDropDownField(
            labelText: 'Select Charging Location',
            hintText: 'Select Charging Location',
            selectedValue: sel,
            selectedTextColor: context.colorScheme.onSurface,
            hintColor: _bookingFieldBorder(context),
            items: labels,
            errorText: 'Please select a charging station',
            bgColor: dropdownSelected ? _locationSelectedBg : _bookingFieldBg,
            borderColor: _fieldBorderColor(context, selected: dropdownSelected),
            onSave: (v) {
              if (v == null) return;
              controller.setSelectedEvStation(v, userSelected: true);
            },
          );
        }),
        Obx(() {
          if (!controller.isEvChargingLocationDropdownSelected) {
            return const SizedBox.shrink();
          }
          return _locationSelectedBanner('Charging location selected');
        }),
        const SizedBox(height: 16),
        Obx(() {
          if (controller.evStations.isEmpty) {
            return (controller.nearbySearchError.value ?? '').isEmpty
                ? const SizedBox.shrink()
                : CommonText.regular(
                    controller.nearbySearchError.value!,
                    size: 12,
                    color: context.colorScheme.error,
                  );
          }
          final st = controller.selectedEvStation;
          return Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xffF2F2F7),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CommonText.bold(st.shortName, size: 16),
                const SizedBox(height: 6),
                CommonText.regular(
                  st.milesAwayLine,
                  size: 14,
                  color: Colors.grey.shade700,
                ),
                const Divider(thickness: 1.5),
                CommonText.regular(
                  st.address,
                  size: 14,
                  color: Colors.grey.shade700,
                ),
                if (st.latitude != null && st.longitude != null) ...[
                  const SizedBox(height: 6),
                  CommonText.regular(
                    'Lat: ${st.latitude!.toStringAsFixed(6)} | Lng: ${st.longitude!.toStringAsFixed(6)}',
                    size: 12,
                    color: Colors.grey.shade600,
                  ),
                ],
                const SizedBox(height: 12),
                CommonText.regular(
                  'Available Chargers: ${st.availableChargers}',
                  size: 13,
                  color: Colors.grey.shade800,
                ),
                const SizedBox(height: 6),
                CommonText.regular(
                  'Charging Speed: ${st.maxKw}',
                  size: 13,
                  color: Colors.grey.shade800,
                ),
                const SizedBox(height: 12),
                Obx(() {
                  final url = controller.selectedEvChargingWebsiteUrl.value;
                  final hasUrl = (url ?? '').trim().isNotEmpty;
                  if (!hasUrl) {
                    final idx = controller.selectedEvStationIndex.value;
                    final hasPlaceId =
                        idx >= 0 &&
                        idx < controller.evChargingPlaces.length &&
                        (controller.evChargingPlaces[idx].placeId ?? '')
                            .trim()
                            .isNotEmpty;
                    if (hasPlaceId) {
                      WidgetsBinding.instance.addPostFrameCallback((_) {
                        unawaited(
                          controller.ensureSelectedEvChargingWebsiteLoaded(),
                        );
                      });
                    }
                    return const SizedBox.shrink();
                  }
                  return CommonText.semiBold(
                    'View pricing & details (website)',
                    size: 14,
                    color: _linkBlue,
                    onTap: () async {
                      final uri = Uri.parse(url!.trim());
                      if (await canLaunchUrl(uri)) {
                        await launchUrl(
                          uri,
                          mode: LaunchMode.externalApplication,
                        );
                      } else {
                        debugPrint('Could not launch $url');
                      }
                    },
                    isUnderLine: true,
                  );
                }),
              ],
            ),
          );
        }),
        const SizedBox(height: 20),
        _evChargingLocationManualInput(context),
        if (!hideScheduling) ...[
          const SizedBox(height: 20),
          CommonText.semiBold('When would you like this service?'),
          const SizedBox(height: 4),
          Obx(
            () => Column(
              children: [
                RadioListTile<String>(
                  contentPadding: EdgeInsets.zero,
                  title: CommonText.medium('As Soon As Possible', size: 13),
                  value: ServiceBookingController.scheduleTypeAsap,
                  visualDensity: const VisualDensity(
                    horizontal: -4.0,
                    vertical: -4.0,
                  ),
                  dense: true,
                  groupValue: controller.selectedScheduleType.value,
                  fillColor: WidgetStateProperty.resolveWith(
                    (s) => s.contains(WidgetState.selected) ? _red : null,
                  ),
                  onChanged: (v) {
                    if (v != null) controller.setScheduleType(v);
                  },
                ),
                RadioListTile<String>(
                  contentPadding: EdgeInsets.zero,
                  title: CommonText.medium('Schedule', size: 13),
                  value: ServiceBookingController.scheduleTypeScheduled,
                  visualDensity: const VisualDensity(
                    horizontal: -4.0,
                    vertical: -4.0,
                  ),
                  dense: true,
                  groupValue: controller.selectedScheduleType.value,
                  fillColor: WidgetStateProperty.resolveWith(
                    (s) => s.contains(WidgetState.selected) ? _red : null,
                  ),
                  onChanged: (v) {
                    if (v != null) controller.setScheduleType(v);
                  },
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: CommonText.regular(
              'On-demand pricing is applied automatically when you book within 24 hours or on the same day as your service.',
              size: 12,
              color: Colors.grey.shade600,
            ),
          ),
          Obx(() {
            if (!controller.isScheduleScheduled) {
              return const SizedBox.shrink();
            }
            return Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  CommonText.regular(
                    'Select Date and Time',
                    size: 13,
                    color: Colors.grey.shade600,
                  ),
                  const SizedBox(height: 8),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            CommonText.regular(
                              'Date',
                              size: 13,
                              color: Colors.grey.shade600,
                            ),
                            const SizedBox(height: 8),
                            _scheduledServiceDateField(context),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            CommonText.regular(
                              'Time',
                              size: 13,
                              color: Colors.grey.shade600,
                            ),
                            const SizedBox(height: 8),
                            _dropdownShell(
                              context,
                              valueText: Obx(() {
                                final t = controller.scheduledServiceTime.value;
                                final s = t == null
                                    ? 'Select'
                                    : t.format(context);
                                return CommonText.regular(
                                  s,
                                  size: 16,
                                  color: Colors.black87,
                                );
                              }),
                              onTap: () async {
                                final picked = await showTimePicker(
                                  context: context,
                                  initialTime:
                                      controller.scheduledServiceTime.value ??
                                      TimeOfDay.now(),
                                  // Force 12-hour AM/PM format regardless of device locale.
                                  builder: (context, child) => MediaQuery(
                                    data: MediaQuery.of(
                                      context,
                                    ).copyWith(alwaysUse24HourFormat: false),
                                    child: child!,
                                  ),
                                );
                                if (picked != null) {
                                  controller.setScheduledServiceTime(picked);
                                }
                              },
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          }),
        ],
        const SizedBox(height: 20),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: _infoBg,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.bolt_rounded, color: _linkBlue, size: 22),
              const SizedBox(width: 10),
              Expanded(
                child: CommonText.regular(
                  'Typical charging time: 30-45 minutes depending on battery level',
                  size: 13,
                  color: Colors.grey.shade800,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _evAccountCardOnFileSection(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CommonText.medium(
          kEvAccountCardOnFileQuestion,
          size: 13,
          color: context.colorScheme.onSurface,
        ),
        const SizedBox(height: 12),
        Obx(() {
          final selected = controller.evAccountCardOnFile.value;
          return Column(
            children: [
              _evAccountCardOnFileOption(
                context,
                label: 'YES',
                selected: selected == true,
                activeColor: const Color(0xff2E7D32),
                activeBg: const Color(0xffE8F5E9),
                icon: Icons.check_circle_rounded,
                subtitle:
                    'The service provider will know a charging card is already on file.',
                onTap: () => controller.setEvAccountCardOnFile(true),
              ),
              const SizedBox(height: 12),
              _evAccountCardOnFileOption(
                context,
                label: 'NO',
                selected: selected == false,
                activeColor: const Color(0xffE65100),
                activeBg: const Color(0xfffff3e0),
                icon: Icons.credit_card_off_rounded,
                subtitle:
                    'The service provider will know they may need to pay for charging with their debit card.',
                onTap: () => controller.setEvAccountCardOnFile(false),
              ),
            ],
          );
        }),
      ],
    );
  }

  Widget _evAccountCardOnFileOption(
    BuildContext context, {
    required String label,
    required bool selected,
    required Color activeColor,
    required Color activeBg,
    required IconData icon,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: selected ? activeBg : context.colorScheme.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? activeColor : _bookingFieldBorder(context),
          ),
        ),
        child: CheckboxListTile(
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 12,
            vertical: 2,
          ),
          value: selected,
          onChanged: (_) => onTap(),
          activeColor: activeColor,
          checkColor: Colors.white,
          title: CommonText.medium(
            label,
            size: 13,
            color: selected ? activeColor : context.colorScheme.onSurface,
          ),
          subtitle: selected
              ? Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: CommonText.regular(
                    subtitle,
                    size: 11,
                    color: activeColor,
                  ),
                )
              : null,
          secondary: selected ? Icon(icon, color: activeColor, size: 22) : null,
          controlAffinity: ListTileControlAffinity.trailing,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
    );
  }

  // —— EV Step 1 ——
  Widget _evChargingStep(BuildContext context, {bool hideScheduling = false}) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
      child: _evChargingStepBody(context, hideScheduling: hideScheduling),
    );
  }

  Future<void> _pickScheduledServiceDate(BuildContext context) async {
    final today = DateUtils.dateOnly(DateTime.now());
    final lastSelectable = today.add(const Duration(days: 365));
    final stored = controller.scheduledServiceDate.value;
    var initial = today;
    if (stored != null) {
      final day = DateUtils.dateOnly(stored);
      if (!day.isBefore(today)) initial = day;
    }
    final picked = await showCalendarOnlyDatePicker(
      context,
      initialDate: initial,
      firstDate: today,
      lastDate: lastSelectable,
    );
    if (picked != null) {
      controller.setScheduledServiceDate(DateUtils.dateOnly(picked));
    }
  }

  Widget _scheduledServiceDateField(BuildContext context) {
    return CommonTextField(
      controller: controller.scheduledServiceDateController,
      hintText: 'MM/DD/YYYY',
      keyboardType: TextInputType.number,
      isReadOnly: true,
      onTap: () => _pickScheduledServiceDate(context),
      inputFormatters: usDateInputFormatters,
      textColor: context.colorScheme.onSurface,
      hintColor: _bookingFieldBorder(context),
      bgColor: _bookingFieldBg,
      borderColor: _bookingFieldBorder(context),
      suffixIcon: IconButton(
        icon: Icon(Icons.calendar_today_outlined, color: Colors.grey.shade600),
        onPressed: () => _pickScheduledServiceDate(context),
      ),
    );
  }

  Widget _dropdownShell(
    BuildContext context, {
    required Widget valueText,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(UIConstants.defaultMargin),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(UIConstants.defaultMargin),
        child: InputDecorator(
          decoration: commonFieldDecorationMatchingTextField(context),
          child: Row(
            children: [
              Expanded(child: DefaultTextStyle.merge(child: valueText)),
              Icon(
                Icons.keyboard_arrow_down_rounded,
                color: Colors.grey.shade600,
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Vehicle step: pick, preview, and delete photos before continuing.
  Widget _vehiclePhotoUpload(BuildContext context, {required Widget label}) {
    return Obx(() {
      final paths = controller.vehiclePhotoPaths.toList(growable: false);
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          label,
          const SizedBox(height: 8),
          if (paths.isEmpty)
            Material(
              color: Colors.transparent,
              borderRadius: BorderRadius.circular(14),
              child: InkWell(
                onTap: () => controller.pickVehiclePhoto(context),
                borderRadius: BorderRadius.circular(14),
                child: CustomPaint(
                  painter: _DashedRRectPainter(
                    color: const Color(0xffD2D2D7),
                    dash: 4,
                    gap: 3,
                    radius: 14,
                    strokeWidth: 1.2,
                  ),
                  child: SizedBox(
                    height: 120,
                    width: double.infinity,
                    child: _vehiclePhotoPlaceholder(),
                  ),
                ),
              ),
            )
          else
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                ...List.generate(paths.length, (index) {
                  return _vehiclePhotoThumbnail(
                    context,
                    path: paths[index],
                    index: index,
                  );
                }),
                _vehiclePhotoAddTile(context),
              ],
            ),
          if (paths.isNotEmpty) ...[
            const SizedBox(height: 8),
            CommonText.regular(
              'Tap a photo to view full size. Use × to remove.',
              size: 12,
              color: Colors.grey.shade600,
            ),
          ],
        ],
      );
    });
  }

  Widget _vehiclePhotoAddTile(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => controller.pickVehiclePhoto(context),
        borderRadius: BorderRadius.circular(12),
        child: CustomPaint(
          painter: _DashedRRectPainter(
            color: const Color(0xffD2D2D7),
            dash: 4,
            gap: 3,
            radius: 12,
            strokeWidth: 1.2,
          ),
          child: SizedBox(
            width: 88,
            height: 88,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.add_a_photo_outlined, color: _red, size: 24),
                const SizedBox(height: 4),
                CommonText.medium('Add', size: 12, color: _red),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _vehiclePhotoThumbnail(
    BuildContext context, {
    required String path,
    required int index,
  }) {
    return SizedBox(
      width: 88,
      height: 88,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () =>
                  _openVehiclePhotosPreview(context, initialIndex: index),
              borderRadius: BorderRadius.circular(12),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: BookingPhotoImage(
                  path: path,
                  width: 88,
                  height: 88,
                  fit: BoxFit.cover,
                ),
              ),
            ),
          ),
          Positioned(
            top: -6,
            right: -6,
            child: Material(
              color: _red,
              elevation: 2,
              shape: const CircleBorder(),
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: () => controller.removeVehiclePhotoAt(index),
                customBorder: const CircleBorder(),
                child: const SizedBox(
                  width: 24,
                  height: 24,
                  child: Icon(Icons.close, color: Colors.white, size: 14),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _openVehiclePhotosPreview(
    BuildContext context, {
    int initialIndex = 0,
  }) async {
    if (controller.vehiclePhotoPaths.isEmpty) return;

    await showDialog<void>(
      context: context,
      barrierColor: Colors.black87,
      useRootNavigator: true,
      builder: (dialogContext) {
        return Obx(() {
          final paths = controller.vehiclePhotoPaths.toList(growable: false);
          if (paths.isEmpty) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (Navigator.of(dialogContext).canPop()) {
                Navigator.of(dialogContext).pop();
              }
            });
            return const SizedBox.shrink();
          }

          final safeIndex = initialIndex.clamp(0, paths.length - 1);
          return LocalImageGalleryViewer(
            key: ValueKey('vehicle_photos_${paths.length}_$safeIndex'),
            imagePaths: paths,
            initialIndex: safeIndex,
            onDeleteAt: controller.removeVehiclePhotoAt,
          );
        });
      },
    );
  }

  Widget _reviewVehiclePhotosInline(
    BuildContext context, {
    required List<String> images,
    required VoidCallback onEdit,
  }) {
    if (images.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: CommonText.regular(
                'Vehicle Photo',
                size: 14,
                color: Colors.grey.shade700,
              ),
            ),
            TextButton(
              onPressed: onEdit,
              style: TextButton.styleFrom(
                padding: EdgeInsets.zero,
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: const CommonText.semiBold('Edit', size: 13, color: _red),
            ),
          ],
        ),
        const SizedBox(height: 8),
        SizedBox(
          height: 88,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: images.length,
            separatorBuilder: (_, _) => const SizedBox(width: 12),
            itemBuilder: (context, index) {
              return Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () => _showBookingImagesPreview(
                    context,
                    images,
                    initialIndex: index,
                  ),
                  borderRadius: BorderRadius.circular(12),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: BookingPhotoImage(
                      path: images[index],
                      width: 88,
                      height: 88,
                      fit: BoxFit.cover,
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        if (images.length > 1) ...[
          const SizedBox(height: 8),
          CommonText.regular(
            'Tap a photo to view full size.',
            size: 12,
            color: Colors.grey.shade600,
          ),
        ],
      ],
    );
  }

  Widget _vehiclePhotoPlaceholder() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: const BoxDecoration(
            color: Color(0xFFFFE6EA),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.camera_alt_rounded, size: 22, color: _red),
        ),
        const SizedBox(height: 6),
        CommonText.medium('Add Vehicle Photo', size: 16),
        const SizedBox(height: 4),
      ],
    );
  }

  // —— EV Step 2 ——
  Widget _evVehicleStep(BuildContext context) {
    const hint =
        'Please leave any special driving instruction for our service provider or things they should be aware of while picking up or servicing your vehicle.';

    return Obx(() {
      final autoValidate = controller.vehicleStepAutoValidate.value;
      return SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        child: Form(
          key: controller.vehicleStepFormKey,
          autovalidateMode: autoValidate
              ? AutovalidateMode.onUserInteraction
              : AutovalidateMode.disabled,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              CommonText.extraBold('Vehicle Details', size: 22),
              const SizedBox(height: 8),
              Obx(() {
                if (controller.myVehicles.isEmpty) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      CommonText.regular(
                        'Select Your Vehicle',
                        size: 13,
                        color: context.colorScheme.onSurface,
                      ),
                      const SizedBox(height: 6),
                      _dropdownShell(
                        context,
                        valueText: const CommonText.regular(
                          ServiceBookingController.addNewVehicleOptionLabel,
                          size: 16,
                          color: _ctaRed,
                        ),
                        onTap: () => unawaited(
                          controller.onVehicleChosen(
                            ServiceBookingController.addNewVehicleOptionLabel,
                          ),
                        ),
                      ),
                    ],
                  );
                }
                return CommonDropDownField(
                  key: ValueKey(
                    'ev_vehicle_${controller.vehicleDropdownRenderVersion.value}_${controller.selectedVehicle.value ?? ''}',
                  ),
                  hintText: 'Select',
                  labelText: 'Select Your Vehicle',
                  selectedTextColor: context.colorScheme.onSurface,
                  labelColor: context.colorScheme.onSurface,
                  hintColor: _bookingFieldBorder(context),
                  selectedValue: controller.selectedVehicle.value,
                  items: controller.evVehicleOptions,
                  errorText: 'Please select a vehicle',
                  bgColor: _bookingFieldBg,
                  borderColor: _bookingFieldBorder(context),
                  highlightItems: const {
                    ServiceBookingController.addNewVehicleOptionLabel,
                  },
                  highlightItemTextColor: _ctaRed,
                  onSave: controller.onVehicleChosen,
                );
              }),
              const SizedBox(height: 20),
              Obx(
                () => CommonDropDownField(
                  hintText: 'Select',
                  labelText: 'Current battery status',
                  isRequired: true,
                  selectedValue: controller.selectedEvBatteryStatus.value,
                  items: controller.evBatteryStatusOptions.toList(),
                  errorText: 'Please select current battery status',
                  selectedTextColor: context.colorScheme.onSurface,
                  labelColor: context.colorScheme.onSurface,
                  hintColor: _bookingFieldBorder(context),
                  bgColor: _bookingFieldBg,
                  borderColor: _bookingFieldBorder(context),
                  onSave: controller.onEvBatteryStatusChosen,
                ),
              ),
              const SizedBox(height: 20),
              Obx(
                () => CommonDropDownField(
                  hintText: 'Select',
                  labelText: 'Select Vehicle Charge Limit',
                  isRequired: true,
                  selectedValue: controller.selectedEvChargeLimit.value,
                  items: controller.evChargeLimitOptions.toList(),
                  errorText: 'Please select charge limit',
                  selectedTextColor: context.colorScheme.onSurface,
                  labelColor: context.colorScheme.onSurface,
                  hintColor: _bookingFieldBorder(context),
                  bgColor: _bookingFieldBg,
                  borderColor: _bookingFieldBorder(context),
                  onSave: (v) => controller.selectedEvChargeLimit.value = v,
                ),
              ),
              // Cross-field validation: battery must be < charge limit
              Obx(() {
                final err = controller.evBatteryChargeLimitConflictError;
                if (err == null) return const SizedBox.shrink();
                return Container(
                  margin: const EdgeInsets.only(top: 8),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xffFFF0F0),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xffF2051F)),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(
                        Icons.warning_amber_rounded,
                        size: 16,
                        color: Color(0xffC62828),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: CommonText.regular(
                          err,
                          size: 12,
                          color: const Color(0xffC62828),
                        ),
                      ),
                    ],
                  ),
                );
              }),
              const SizedBox(height: 20),
              BookingServiceNotesFields(controller: controller),
              const SizedBox(height: 20),
              _vehiclePhotoUpload(
                context,
                label: CommonText.semiBold(
                  'Vehicle Photo',
                  color: context.colorScheme.onSurface,
                ),
              ),
            ],
          ),
        ),
      );
    });
  }

  // —— EV Step 3 ——
  Widget _evReviewStep(BuildContext context) {
    return Obx(() {
      controller.reviewRevision.value;
      controller.vehiclePhotoPaths.length;
      controller.selectedEvStationIndex.value;
      controller.selectedEvStationAddress.value;
      controller.selectedScheduleType.value;
      controller.scheduledServiceDate.value;
      controller.scheduledServiceTime.value;
      controller.selectedVehicle.value;
      controller.selectedEvChargeLimit.value;
      controller.evVehicleType.value;
      controller.selectedVehicleParkedLocation.value;
      controller.selectedProviderParkLocation.value;
      controller.selectedVehicleKeyLocation.value;
      controller.selectedKeyReturnLocation.value;
      final vehicleImages = controller.reviewVehicleImageUrls;
      final st = controller.selectedEvStation;
      return SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _reviewCard(
              title: 'Pick-up/drop off and service location',
              onEdit: () => controller.currentStep.value = 0,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _reviewRow(
                    icon: Icons.location_on_rounded,
                    text: controller.reviewApiAddress,
                  ),
                  const SizedBox(height: 12),
                  _reviewRow(
                    icon: Icons.ev_station_outlined,
                    text: controller.reviewEvChargingServiceLocationLine,
                    iconColor: _red,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _reviewCard(
              title: 'Charging Details',
              onEdit: () => controller.currentStep.value = 1,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _kvRowReview('Distance', st.reviewDistance),
                  const SizedBox(height: 10),
                  _kvRowReview(
                    'Service Location',
                    controller.reviewEvChargingServiceLocationLine,
                  ),
                  const SizedBox(height: 10),
                  _kvRowReview('Date', controller.evReviewDateLine),
                  const SizedBox(height: 10),
                  _kvRowReview('Time', controller.evReviewTimeLine),
                  const SizedBox(height: 10),
                  _kvRowReview(
                    'Estimated duration of service',
                    controller.reviewEstimatedEvChargingDurationLine,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _reviewCard(
              title: 'Vehicle Information',
              onEdit: () => controller.currentStep.value = 2,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _kvRowReview('Type', controller.evVehicleType.value ?? '—'),
                  const SizedBox(height: 10),
                  _kvRowReview('Vehicle', controller.reviewApiVehicleLine),
                  const SizedBox(height: 10),
                  _kvRowReview('Color', controller.reviewApiVehicleColor),
                  const SizedBox(height: 10),
                  _kvRowReview('License', controller.reviewApiVehicleLicense),
                  const SizedBox(height: 10),
                  _kvRowReview(
                    'Current battery status',
                    controller.reviewBatteryCapacityPercentDisplay,
                  ),
                  const SizedBox(height: 10),
                  _kvRowReview(
                    'Charge limit',
                    controller.selectedEvChargeLimit.value ?? '—',
                  ),
                  if (vehicleImages.isNotEmpty) ...[
                    const SizedBox(height: 14),
                    _reviewVehiclePhotosInline(
                      context,
                      images: vehicleImages,
                      onEdit: () => controller.currentStep.value = 2,
                    ),
                  ] else ...[
                    const SizedBox(height: 10),
                    _kvRowReview('Vehicle Photo', 'No photo uploaded'),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),
            _reviewCard(
              title: 'Service Notes',
              onEdit: () => controller.currentStep.value = 2,
              child: _categorizedNotes(
                controller: controller,
                pickupNotes: controller.reviewServiceNotesSummary,
                otherNotes: controller.reviewOtherNotes,
              ),
            ),
            const SizedBox(height: 20),
            _carComfortPriceSummary(context),
            const SizedBox(height: 20),
            _paymentMethodSection(context),
            SizedBox(height: 24 + MediaQuery.paddingOf(context).bottom),
          ],
        ),
      );
    });
  }

  // —— Combined Step 4 ——
  Widget _combinedReviewStep(BuildContext context) {
    return Obx(() {
      controller.reviewRevision.value;
      controller.vehiclePhotoPaths.length;
      controller.selectedEvStationIndex.value;
      controller.selectedEvStationAddress.value;
      controller.selectedScheduleType.value;
      controller.scheduledServiceDate.value;
      controller.scheduledServiceTime.value;
      controller.selectedVehicle.value;
      controller.selectedCarWash.value;
      controller.selectedCarWashAddress.value;
      controller.selectedComfortPackage.value;
      final st = controller.selectedEvStation;
      final vehicleImages = controller.reviewVehicleImageUrls;
      return SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _reviewCard(
              title: 'Pick-up/drop off and service location',
              onEdit: () => controller.currentStep.value = 0,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _reviewRow(
                    icon: Icons.location_on_rounded,
                    text: controller.reviewApiAddress,
                  ),
                  const SizedBox(height: 12),
                  _reviewRow(
                    icon: Icons.storefront_outlined,
                    text: controller.reviewCarWashServiceLocationLine,
                    iconColor: _red,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _reviewCard(
              title: 'Charging Details',
              onEdit: () => controller.currentStep.value = 2,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _kvRowReview('Distance', st.reviewDistance),
                  const SizedBox(height: 10),
                  _kvRowReview(
                    'Service Location',
                    controller.reviewCombinedChargingServiceLocation,
                  ),
                  const SizedBox(height: 10),
                  _kvRowReview('Date', controller.evReviewDateLine),
                  const SizedBox(height: 10),
                  _kvRowReview('Time', controller.evReviewTimeLine),
                  const SizedBox(height: 10),
                  _kvRowReview(
                    'Estimated duration of service',
                    controller.reviewEstimatedEvChargingDurationLine,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _reviewCard(
              title: 'Washing Details',
              onEdit: () => controller.currentStep.value = 1,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _kvRowReview(
                    'Station',
                    controller.reviewCombinedWashingStationLine,
                  ),
                  const SizedBox(height: 10),
                  _reviewPackageDetailsRow(context),
                  const SizedBox(height: 10),
                  _kvRowReview(
                    'Service Location',
                    controller.reviewCombinedWashServiceLocation,
                  ),
                  const SizedBox(height: 10),
                  _kvRowReview('Date', controller.reviewApiDateLine),
                  const SizedBox(height: 10),
                  _kvRowReview('Time', controller.reviewApiTimeLine),
                  const SizedBox(height: 10),
                  _kvRowReview(
                    'Estimated duration of service',
                    controller.reviewEstimatedServiceDurationLine,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _reviewCard(
              title: 'Vehicle Information',
              onEdit: () => controller.currentStep.value = 3,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _kvRowReview(
                    'Type',
                    controller.reviewCarWashVehicleTypeDisplay,
                  ),
                  const SizedBox(height: 10),
                  _kvRowReview('Vehicle', controller.reviewApiVehicleLine),
                  const SizedBox(height: 10),
                  _kvRowReview('Color', controller.reviewApiVehicleColor),
                  const SizedBox(height: 10),
                  _kvRowReview('License', controller.reviewApiVehicleLicense),
                  const SizedBox(height: 10),
                  _kvRowReview(
                    'Current battery status',
                    controller.reviewBatteryCapacityPercentDisplay,
                  ),
                  const SizedBox(height: 10),
                  _kvRowReview(
                    'Charge limit',
                    controller.selectedEvChargeLimit.value ?? '—',
                  ),
                  if (vehicleImages.isNotEmpty) ...[
                    const SizedBox(height: 14),
                    _reviewVehiclePhotosInline(
                      context,
                      images: vehicleImages,
                      onEdit: () => controller.currentStep.value = 3,
                    ),
                  ] else ...[
                    const SizedBox(height: 10),
                    _kvRowReview('Vehicle Photo', 'No photo uploaded'),
                  ],
                ],
              ),
            ),
            if (controller.hasReviewServiceNotes) ...[
              const SizedBox(height: 16),
              _reviewCard(
                title: 'Service Notes',
                onEdit: () => controller.currentStep.value = 3,
                child: _categorizedNotes(
                  controller: controller,
                  pickupNotes: controller.reviewCombinedPickupNote,
                  otherNotes: controller.reviewCombinedOtherNotes,
                ),
              ),
            ],
            const SizedBox(height: 20),
            _carComfortPriceSummary(context),
            const SizedBox(height: 20),
            _paymentMethodSection(context),
            SizedBox(height: 24 + MediaQuery.paddingOf(context).bottom),
          ],
        ),
      );
    });
  }

  Widget _reviewCard({
    required String title,
    VoidCallback? onEdit,
    required Widget child,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: Colors.grey.shade300),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: CommonText.bold(
                  title,
                  size: 16,
                  color: Colors.black,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              // const Spacer(),
              if (onEdit != null)
                TextButton(
                  onPressed: onEdit,
                  style: TextButton.styleFrom(
                    padding: EdgeInsets.zero,
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: CommonText.semiBold('Edit', size: 14, color: _red),
                ),
            ],
          ),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }

  Widget _categorizedNotes({
    required ServiceBookingController controller,
    required String pickupNotes,
    required String otherNotes,
  }) {
    final structured = controller.serviceNotesFormData.displayRows;
    final apiStructured = controller.reviewApiServiceNoteRows;
    final noteRows = structured.isNotEmpty ? structured : apiStructured;
    final sections = <Widget>[];

    if (noteRows.isNotEmpty) {
      for (var i = 0; i < noteRows.length; i++) {
        final row = noteRows[i];
        if (i > 0) sections.add(const SizedBox(height: 12));
        sections.add(_noteSection(row.question, row.answer));
      }
    } else {
      final pickup = pickupNotes.trim();
      if (pickup.isNotEmpty) {
        sections.add(_noteSection('Service notes', pickup));
      }
    }

    final other = otherNotes.trim();
    if (other.isNotEmpty) {
      if (sections.isNotEmpty) sections.add(const SizedBox(height: 12));
      sections.add(_noteSection('Additional service notes', other));
    }

    if (sections.isEmpty) {
      return CommonText.regular('—', size: 14, color: Colors.grey.shade700);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: sections,
    );
  }

  Widget _noteSection(String title, String value) {
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(
            text: '$title: ',
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          TextSpan(text: value),
        ],
      ),
      style: TextStyle(fontSize: 14, color: Colors.grey.shade800, height: 1.35),
    );
  }

  /// Review rows: label left (grey), value right (bold) — matches confirm-booking design.
  /// Long or multiline values (e.g. service location) stack label above a left-aligned value.
  Widget _reviewPackageDetailsRow(BuildContext context) {
    // Membership / Preferred Package gets its own green banner.
    if (controller.hasMembershipWash.value) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: const Color(0xffE8F5E9),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xff4CAF50)),
        ),
        child: Row(
          children: [
            const Icon(
              Icons.card_membership_rounded,
              color: Color(0xff2E7D32),
              size: 18,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  CommonText.semiBold(
                    ServiceBookingController.membershipPackageName,
                    size: 13,
                    color: const Color(0xff1B5E20),
                  ),
                  const SizedBox(height: 2),
                  CommonText.regular(
                    'Car wash: \$0.00 (membership)  •  Only the CarComfort service fee applies.',
                    size: 12,
                    color: const Color(0xff2E7D32),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    // No-membership selection shows an orange banner.
    if (controller.noMembershipWash.value) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: const Color(0xfffff3e0),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xffFF9800)),
        ),
        child: Row(
          children: [
            const Icon(
              Icons.no_cell_rounded,
              color: Color(0xffE65100),
              size: 18,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: CommonText.semiBold(
                'No Membership',
                size: 13,
                color: const Color(0xffE65100),
              ),
            ),
          ],
        ),
      );
    }

    final isCarComfort = controller.reviewIsCarComfortPackage;
    final isCustom = controller.reviewIsCustomPackage;
    final packageName = controller.reviewSelectedPackageName;

    if (!isCarComfort && !isCustom) {
      return _kvRowReview('Package', packageName);
    }

    // Card heading reflects the selected service type
    final String title;
    if (controller.isCombinedServiceFlow) {
      title = 'Combo';
    } else {
      title = 'Car Wash';
    }
    final detail = isCarComfort
        ? packageName
        : '(Custom Package: $packageName)';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xffFFF6F6),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: _red.withValues(alpha: 0.28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CommonText.semiBold(title, size: 14, color: _red),
          const SizedBox(height: 4),
          CommonText.bold(detail, size: 14, color: Colors.black, maxLines: 3),
        ],
      ),
    );
  }

  Widget _kvRowReview(String label, String value, {bool stacked = false}) {
    final useStacked = stacked || value.contains('\n') || value.length > 32;
    if (useStacked) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CommonText.regular(label, size: 14, color: Colors.grey.shade700),
          const SizedBox(height: 4),
          CommonText.bold(
            value,
            size: 14,
            color: Colors.black,
            textAlign: TextAlign.left,
            maxLines: 6,
          ),
        ],
      );
    }
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // flex 3:2 — label gets 60 % so long labels like
        // "Estimated duration of service" fit without wrapping.
        Expanded(
          flex: 3,
          child: CommonText.regular(
            label,
            size: 14,
            color: Colors.grey.shade700,
          ),
        ),
        Expanded(
          flex: 2,
          child: CommonText.bold(
            value,
            size: 14,
            color: Colors.black,
            textAlign: TextAlign.right,
            maxLines: 2,
          ),
        ),
      ],
    );
  }

  // —— Car wash steps (unchanged structure) ——
  Widget _carWashLocationStep(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CommonText.extraBold('Location Details', size: 22),
          const SizedBox(height: 20),
          _customerLocationField(
            context,
            labelColor: context.colorScheme.secondary,
          ),
          const SizedBox(height: 16),
          Center(
            child: CommonText.medium(
              'Or Enter Address Manually',
              color: context.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 16),
          _manualAddressInput(context),
          const SizedBox(height: 20),
          _carWashLocationDropdown(context),
          const SizedBox(height: 20),
          _serviceLocationManualInput(context),
        ],
      ),
    );
  }

  /// Car wash service form (no outer scroll). Used by [_carWashServiceStep].
  Widget _carWashServiceStepBody(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _carWashMembershipOptions(context),
        const SizedBox(height: 16),
        CommonText.extraBold('Custom Package', size: 14),
        const SizedBox(height: 14),
        Obx(() {
          if (controller.hasMembershipWash.value) {
            return const SizedBox.shrink();
          }
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _selectedCarWashWebsiteSection(context),
              const SizedBox(height: 16),
            ],
          );
        }),
        // —— Package selection (hidden when membership is active) ——
        Obx(() {
          if (controller.hasMembershipWash.value) {
            // Show a confirmation banner instead of the package picker.
            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xffE8F5E9),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xff4CAF50), width: 1),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.check_circle_rounded,
                    color: Color(0xff2E7D32),
                    size: 20,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        CommonText.semiBold(
                          'Custom Package selected',
                          size: 13,
                          color: const Color(0xff1B5E20),
                        ),
                        const SizedBox(height: 2),
                        CommonText.regular(
                          'Car wash: \$0.00  •  You pay only for the CarComfort service.',
                          size: 12,
                          color: const Color(0xff2E7D32),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          }

          final hasApiPackages = controller.comfortPackages.isNotEmpty;
          if (!hasApiPackages) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                CommonTextField(
                  controller: controller.packageNameController,
                  hintText: 'Package name',
                  labelText: 'Package Name',
                  isRequired: true,
                  labelColor: context.colorScheme.secondary,
                  hintColor: _bookingFieldBorder(context),
                  bgColor: _bookingFieldBg,
                  textColor: context.colorScheme.scrim,
                  borderColor: _bookingFieldBorder(context),
                ),
                const SizedBox(height: 20),
                CommonTextField(
                  labelText: 'Package Price',
                  isRequired: true,
                  labelColor: context.colorScheme.secondary,
                  hintColor: _bookingFieldBorder(context),
                  controller: controller.packagePriceController,
                  hintText: r'$9.99',
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  inputFormatters: packagePriceInputFormatters,
                  bgColor: _bookingFieldBg,
                  textColor: context.colorScheme.scrim,
                  borderColor: _bookingFieldBorder(context),
                  validator: validatePackagePrice,
                ),
              ],
            );
          }

          final packageSelected = controller.isCarComfortPackageSelected;
          final dropdown = CommonDropDownField(
            labelText: 'CarComfort Packages',
            labelBold: true,
            labelSize: 16,
            labelColor: context.colorScheme.onSurface,
            selectedTextColor: context.colorScheme.onSurface,
            hintColor: _bookingFieldBorder(context),
            hintText: 'Choose a package',
            selectedValue: controller.selectedComfortPackage.value,
            items: controller.comfortPackages,
            errorText: 'Please select a package',
            bgColor: _bookingFieldBg,
            borderColor: _bookingFieldBorder(context),
            onSave: controller.setComfortPackageFromDropdown,
          );

          if (packageSelected) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                dropdown,
                const SizedBox(height: 10),
                // ── Green confirmation banner (Step 2 selected state) ────────────
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xffE8F5E9),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: const Color(0xff4CAF50),
                      width: 1,
                    ),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.check_circle_rounded,
                        color: Color(0xff2E7D32),
                        size: 18,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: CommonText.medium(
                          'Package selected — ready to proceed',
                          size: 13,
                          color: const Color(0xff1B5E20),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 6),
                CommonText.regular(
                  'Changed your mind? You can enter your own package below.',
                  size: 12,
                  color: Colors.grey.shade700,
                ),
                const SizedBox(height: 4),
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton(
                    style: TextButton.styleFrom(
                      padding: EdgeInsets.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    onPressed: controller.clearComfortPackageSelection,
                    child: CommonText.semiBold(
                      'Enter package name & price manually',
                      size: 14,
                      color: _linkBlue,
                    ),
                  ),
                ),
              ],
            );
          }

          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              CommonTextField(
                controller: controller.packageNameController,
                hintText: 'Package name',
                labelText: 'Package Name',
                isRequired: true,
                labelColor: context.colorScheme.secondary,
                hintColor: _bookingFieldBorder(context),
                bgColor: _bookingFieldBg,
                textColor: context.colorScheme.scrim,
                borderColor: _bookingFieldBorder(context),
              ),
              const SizedBox(height: 20),
              CommonTextField(
                labelText: 'Package Price',
                isRequired: true,
                labelColor: context.colorScheme.secondary,
                hintColor: _bookingFieldBorder(context),
                controller: controller.packagePriceController,
                hintText: r'$9.99',
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                inputFormatters: packagePriceInputFormatters,
                bgColor: _bookingFieldBg,
                textColor: context.colorScheme.scrim,
                borderColor: _bookingFieldBorder(context),
                validator: validatePackagePrice,
              ),
              const SizedBox(height: 20),
              Center(
                child: CommonText.semiBold(
                  'Or',
                  color: context.colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 16),
              dropdown,
            ],
          );
        }),
        const SizedBox(height: 20),
        CommonText.semiBold('When would you like this service?'),
        Obx(
          () => Column(
            children: [
              RadioListTile<String>(
                contentPadding: EdgeInsets.zero,
                title: const CommonText.medium('As Soon As Possible'),
                visualDensity: const VisualDensity(
                  horizontal: -4.0,
                  vertical: -4.0,
                ),
                dense: true,
                value: ServiceBookingController.scheduleTypeAsap,
                groupValue: controller.selectedScheduleType.value,
                fillColor: WidgetStateProperty.resolveWith(
                  (s) => s.contains(WidgetState.selected) ? _red : null,
                ),
                onChanged: (v) {
                  if (v != null) controller.setScheduleType(v);
                },
              ),
              RadioListTile<String>(
                contentPadding: EdgeInsets.zero,
                title: const CommonText.medium('Schedule'),
                visualDensity: const VisualDensity(
                  horizontal: -4.0,
                  vertical: -4.0,
                ),
                dense: true,
                value: ServiceBookingController.scheduleTypeScheduled,
                groupValue: controller.selectedScheduleType.value,
                fillColor: WidgetStateProperty.resolveWith(
                  (s) => s.contains(WidgetState.selected) ? _red : null,
                ),
                onChanged: (v) {
                  if (v != null) controller.setScheduleType(v);
                },
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 4),
          child: CommonText.regular(
            'On-demand pricing is applied automatically when you book within 24 hours or on the same day as your service.',
            size: 12,
            color: Colors.grey.shade600,
          ),
        ),
        Obx(() {
          if (!controller.isScheduleScheduled) return const SizedBox.shrink();
          return Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                CommonText.regular(
                  'Select Date and Time',
                  size: 13,
                  color: Colors.grey.shade600,
                ),
                const SizedBox(height: 8),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          CommonText.regular(
                            'Date',
                            size: 13,
                            color: Colors.grey.shade600,
                          ),
                          const SizedBox(height: 8),
                          _scheduledServiceDateField(context),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          CommonText.regular(
                            'Time',
                            size: 13,
                            color: Colors.grey.shade600,
                          ),
                          const SizedBox(height: 8),
                          _dropdownShell(
                            context,
                            valueText: Obx(() {
                              final t = controller.scheduledServiceTime.value;
                              final s = t == null
                                  ? 'Select'
                                  : t.format(context);
                              return CommonText.regular(
                                s,
                                size: 16,
                                color: Colors.black87,
                              );
                            }),
                            onTap: () async {
                              final picked = await showTimePicker(
                                context: context,
                                initialTime:
                                    controller.scheduledServiceTime.value ??
                                    TimeOfDay.now(),
                                // Force 12-hour AM/PM format regardless of device locale.
                                builder: (context, child) => MediaQuery(
                                  data: MediaQuery.of(
                                    context,
                                  ).copyWith(alwaysUse24HourFormat: false),
                                  child: child!,
                                ),
                              );
                              if (picked != null) {
                                controller.setScheduledServiceTime(picked);
                              }
                            },
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          );
        }),
        const SizedBox(height: 20),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: _infoBg,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.schedule_rounded, color: _linkBlue, size: 22),
              const SizedBox(width: 10),
              Expanded(
                child: CommonText.regular(
                  'Service typically takes 45-60 minutes to complete',
                  size: 13,
                  color: Colors.grey.shade800,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _carWashMembershipOptions(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Obx(() {
          final hasMembership = controller.hasMembershipWash.value;
          return GestureDetector(
            onTap: () => controller.toggleMembershipWash(!hasMembership),
            child: Container(
              margin: const EdgeInsets.only(bottom: 4),
              decoration: BoxDecoration(
                color: hasMembership
                    ? const Color(0xffE8F5E9)
                    : context.colorScheme.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: hasMembership
                      ? const Color(0xff4CAF50)
                      : _bookingFieldBorder(context),
                ),
              ),
              child: CheckboxListTile(
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 2,
                ),
                value: hasMembership,
                onChanged: controller.toggleMembershipWash,
                activeColor: const Color(0xff2E7D32),
                checkColor: Colors.white,
                title: CommonText.medium(
                  'I have a car wash membership at my local car wash',
                  size: 13,
                  color: hasMembership
                      ? const Color(0xff1B5E20)
                      : context.colorScheme.onSurface,
                ),
                subtitle: hasMembership
                    ? Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: CommonText.regular(
                          'Car wash cost will be \$0 - only the CarComfort service fee applies.',
                          size: 11,
                          color: const Color(0xff2E7D32),
                        ),
                      )
                    : null,
                secondary: hasMembership
                    ? const Icon(
                        Icons.card_membership_rounded,
                        color: Color(0xff2E7D32),
                        size: 22,
                      )
                    : null,
                controlAffinity: ListTileControlAffinity.trailing,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          );
        }),
        const SizedBox(height: 12),
        Obx(() {
          final noMembership = controller.noMembershipWash.value;
          return Container(
            margin: const EdgeInsets.only(bottom: 4),
            decoration: BoxDecoration(
              color: noMembership
                  ? const Color(0xfffff3e0)
                  : context.colorScheme.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: noMembership
                    ? const Color(0xffFF9800)
                    : _bookingFieldBorder(context),
              ),
            ),
            child: CheckboxListTile(
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 12,
                vertical: 2,
              ),
              value: noMembership,
              onChanged: controller.toggleNoMembership,
              activeColor: const Color(0xffE65100),
              title: CommonText.medium(
                "I don't have a car wash membership",
                size: 13,
                color: noMembership
                    ? const Color(0xffE65100)
                    : context.colorScheme.onSurface,
              ),
              controlAffinity: ListTileControlAffinity.trailing,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          );
        }),
      ],
    );
  }

  Widget _selectedCarWashWebsiteSection(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CommonText.extraBold(
          'Tap Car Wash Website Link to select package and price',
          size: 22,
        ),
        const SizedBox(height: 8),
        Obx(() {
          final url = (controller.selectedCarWashWebsiteUrl.value ?? '').trim();
          final hasUrl = url.isNotEmpty;
          if (!hasUrl) {
            final hasPlaceId = (controller.selectedCarWashPlaceId.value ?? '')
                .trim()
                .isNotEmpty;
            if (hasPlaceId) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                unawaited(controller.ensureSelectedCarWashWebsiteLoaded());
              });
            }
            return const SizedBox.shrink();
          }
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              CommonText.semiBold(
                url,
                size: 14,
                color: _linkBlue,
                onTap: () async {
                  final uri = Uri.parse(url);
                  if (await canLaunchUrl(uri)) {
                    await launchUrl(uri, mode: LaunchMode.externalApplication);
                  } else {
                    debugPrint('Could not launch $url');
                  }
                },
                isUnderLine: true,
              ),
              const SizedBox(height: 20),
            ],
          );
        }),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: _infoBg,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(
                Icons.info_outline_rounded,
                color: _linkBlue,
                size: 22,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: CommonText.regular(
                  'Please tap the selected car wash website link listed above if provided, then choose your preferred car wash package and price from the site. Next, copy and paste that information into the app. If no link is provided, search for the car wash website in your browser and choose your preferred package and price or select from one of CarComfort packages listed below',
                  size: 13,
                  color: Colors.grey.shade800,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _carWashServiceStep(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
      child: _carWashServiceStepBody(context),
    );
  }

  Widget _carWashVehicleStep(BuildContext context) {
    const hint =
        'Leave any specific instructions our driver should need to find your vehicle, where they should leave your vehicle, or anything you think they should know.';

    return Obx(() {
      final autoValidate = controller.vehicleStepAutoValidate.value;
      return SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        child: Form(
          key: controller.vehicleStepFormKey,
          autovalidateMode: autoValidate
              ? AutovalidateMode.onUserInteraction
              : AutovalidateMode.disabled,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              CommonText.extraBold('Vehicle Details', size: 22),
              const SizedBox(height: 8),
              Obx(() {
                if (controller.myVehicles.isEmpty) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      CommonText.regular(
                        'Select Your Vehicle',
                        size: 13,
                        color: context.colorScheme.onSurface,
                      ),
                      const SizedBox(height: 6),
                      _dropdownShell(
                        context,
                        valueText: const CommonText.regular(
                          ServiceBookingController.addNewVehicleOptionLabel,
                          size: 16,
                          color: _ctaRed,
                        ),
                        onTap: () => unawaited(
                          controller.onVehicleChosen(
                            ServiceBookingController.addNewVehicleOptionLabel,
                          ),
                        ),
                      ),
                    ],
                  );
                }
                return CommonDropDownField(
                  key: ValueKey(
                    'car_vehicle_${controller.vehicleDropdownRenderVersion.value}_${controller.selectedVehicle.value ?? ''}',
                  ),
                  hintText: 'Select',
                  labelText: 'Select Your Vehicle',
                  labelColor: context.colorScheme.onSurface,
                  selectedValue: controller.selectedVehicle.value,
                  selectedTextColor: context.colorScheme.onSurface,
                  hintColor: _bookingFieldBorder(context),
                  items: controller.activeVehicleOptions,
                  errorText: 'Please select a vehicle',
                  bgColor: _bookingFieldBg,
                  borderColor: _bookingFieldBorder(context),
                  highlightItems: const {
                    ServiceBookingController.addNewVehicleOptionLabel,
                  },
                  highlightItemTextColor: _ctaRed,
                  onSave: controller.onVehicleChosen,
                );
              }),
              if (_combined) ...[
                const SizedBox(height: 20),
                Obx(
                  () => CommonDropDownField(
                    hintText: 'Select',
                    labelText: 'Current battery status',
                    isRequired: true,
                    selectedValue: controller.selectedEvBatteryStatus.value,
                    items: controller.evBatteryStatusOptions.toList(),
                    errorText: 'Please select current battery status',
                    selectedTextColor: context.colorScheme.onSurface,
                    labelColor: context.colorScheme.onSurface,
                    hintColor: _bookingFieldBorder(context),
                    bgColor: _bookingFieldBg,
                    borderColor: _bookingFieldBorder(context),
                    onSave: controller.onEvBatteryStatusChosen,
                  ),
                ),
                const SizedBox(height: 20),
                Obx(
                  () => CommonDropDownField(
                    hintText: 'Select',
                    labelText: 'Select Vehicle Charge Limit',
                    isRequired: true,
                    selectedValue: controller.selectedEvChargeLimit.value,
                    items: controller.evChargeLimitOptions.toList(),
                    errorText: 'Please select charge limit',
                    selectedTextColor: context.colorScheme.onSurface,
                    labelColor: context.colorScheme.onSurface,
                    hintColor: _bookingFieldBorder(context),
                    bgColor: _bookingFieldBg,
                    borderColor: _bookingFieldBorder(context),
                    onSave: (v) => controller.selectedEvChargeLimit.value = v,
                  ),
                ),
                // Cross-field validation: battery must be < charge limit
                Obx(() {
                  final err = controller.evBatteryChargeLimitConflictError;
                  if (err == null) return const SizedBox.shrink();
                  return Container(
                    margin: const EdgeInsets.only(top: 8),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 10,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xffFFF0F0),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xffF2051F)),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(
                          Icons.warning_amber_rounded,
                          size: 16,
                          color: Color(0xffC62828),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: CommonText.regular(
                            err,
                            size: 12,
                            color: const Color(0xffC62828),
                          ),
                        ),
                      ],
                    ),
                  );
                }),
              ],
              const SizedBox(height: 20),
              BookingServiceNotesFields(controller: controller),
              const SizedBox(height: 20),
              _vehiclePhotoUpload(
                context,
                label: CommonText.semiBold(
                  'Vehicle Photo',
                  color: context.colorScheme.onSurface,
                ),
              ),
            ],
          ),
        ),
      );
    });
  }

  Widget _carWashReviewStep(BuildContext context) {
    return Obx(() {
      controller.reviewRevision.value;
      controller.vehiclePhotoPaths.length;
      controller.selectedScheduleType.value;
      controller.subtotal.value;
      controller.serviceFee.value;
      controller.selectedCarWash.value;
      controller.selectedCarWashAddress.value;
      controller.selectedComfortPackage.value;
      controller.selectedVehicle.value;
      final vehicleImages = controller.reviewVehicleImageUrls;
      return SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _reviewCard(
              title: 'Pick-up/drop off and service location',
              onEdit: () => controller.currentStep.value = 0,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _reviewRow(
                    icon: Icons.location_on_rounded,
                    text: controller.reviewApiAddress,
                  ),
                  const SizedBox(height: 12),
                  _reviewRow(
                    icon: Icons.storefront_outlined,
                    text: controller.reviewCarWashServiceLocationLine,
                    iconColor: _red,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _reviewCard(
              title: 'Service Details',
              onEdit: () => controller.currentStep.value = 1,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _reviewPackageDetailsRow(context),
                  const SizedBox(height: 10),
                  _kvRowReview('Date', controller.reviewApiDateLine),
                  const SizedBox(height: 10),
                  _kvRowReview('Time', controller.reviewApiTimeLine),
                  const SizedBox(height: 10),
                  _kvRowReview(
                    'Estimated duration of service',
                    controller.reviewEstimatedServiceDurationLine,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _reviewCard(
              title: 'Vehicle Information',
              onEdit: () => controller.currentStep.value = 2,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _kvRowReview(
                    'Type',
                    controller.reviewCarWashVehicleTypeDisplay,
                  ),
                  const SizedBox(height: 10),
                  _kvRowReview('Vehicle', controller.reviewApiVehicleLine),
                  const SizedBox(height: 10),
                  _kvRowReview('Color', controller.reviewApiVehicleColor),
                  const SizedBox(height: 10),
                  _kvRowReview('License', controller.reviewApiVehicleLicense),
                  if (vehicleImages.isNotEmpty) ...[
                    const SizedBox(height: 14),
                    _reviewVehiclePhotosInline(
                      context,
                      images: vehicleImages,
                      onEdit: () => controller.currentStep.value = 2,
                    ),
                  ] else ...[
                    const SizedBox(height: 10),
                    _kvRowReview('Vehicle Photo', 'No photo uploaded'),
                  ],
                ],
              ),
            ),
            if (controller.hasReviewServiceNotes) ...[
              const SizedBox(height: 16),
              _reviewCard(
                title: 'Service Notes',
                onEdit: () => controller.currentStep.value = 2,
                child: _categorizedNotes(
                  controller: controller,
                  pickupNotes: controller.reviewPickupNotes,
                  otherNotes: controller.reviewOtherNotes,
                ),
              ),
            ],
            const SizedBox(height: 20),
            _carComfortPriceSummary(context),
            const SizedBox(height: 20),
            _paymentMethodSection(context),
            SizedBox(height: 24 + MediaQuery.paddingOf(context).bottom),
          ],
        ),
      );
    });
  }

  Widget _reviewRow({
    required IconData icon,
    required String text,
    Color? iconColor,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: iconColor ?? _red, size: 22),
        const SizedBox(width: 10),
        Expanded(child: CommonText.regular(text, size: 14)),
      ],
    );
  }

  Widget _priceRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        CommonText.regular(label, size: 14, color: Colors.grey.shade700),
        CommonText.bold(value, size: 14),
      ],
    );
  }

  /// CarComfort-style price breakdown (underlined title, line items, estimated total).
  Widget _carComfortPriceSummary(BuildContext context) {
    return Obx(() {
      controller.reviewRevision.value;
      final lines = controller.reviewPriceSummaryDisplayLines;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            controller.reviewPriceSummaryTitle,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              decoration: TextDecoration.underline,
              color: Colors.black,
              height: 1.3,
            ),
          ),
          const SizedBox(height: 14),
          ...lines.expand((line) {
            if (line.isSectionHeader) {
              return [
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: CommonText.regular(
                    line.label,
                    size: 14,
                    color: line.labelColor ?? ServiceBookingController.brandRed,
                    maxLines: 2,
                  ),
                ),
              ];
            }

            final labelStyle = line.isSubtotal
                ? CommonText.semiBold
                : CommonText.regular;
            final widgets = <Widget>[
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: labelStyle(
                        line.label,
                        size: 14,
                        color: line.labelColor ?? Colors.black87,
                        maxLines: 3,
                      ),
                    ),
                    const SizedBox(width: 12),
                    labelStyle(line.valueText, size: 14, color: Colors.black87),
                  ],
                ),
              ),
            ];

            if (line.isSubtotal) {
              widgets.add(
                const Padding(
                  padding: EdgeInsets.only(bottom: 10),
                  child: Divider(height: 1, color: Color(0xffECECEC)),
                ),
              );
            }

            return widgets;
          }),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              CommonText.bold(
                controller.reviewPriceSummaryTotalLabel,
                size: 14,
                color: Colors.black,
              ),
              CommonText.bold(
                controller.reviewPriceSummaryTotalDisplay,
                size: 14,
                color: Colors.black,
              ),
            ],
          ),
        ],
      );
    });
  }

  Future<void> _showBookingImagesPreview(
    BuildContext context,
    List<String> images, {
    int initialIndex = 0,
  }) async {
    await LocalImageGalleryViewer.show(
      context,
      imagePaths: images,
      initialIndex: initialIndex,
    );
  }

  PaymentMethodsController _ensurePaymentMethodsController() {
    if (!Get.isRegistered<PaymentMethodsController>()) {
      PaymentMethodsBinding().dependencies();
    }
    final c = Get.find<PaymentMethodsController>();
    if (!c.hasLoadedCardsAtLeastOnce && !c.isLoading.value) {
      c.loadCards(showLoader: false);
    }
    return c;
  }

  Widget _paymentMethodSection(BuildContext context) {
    final pm = _ensurePaymentMethodsController();
    return Obx(() {
      final cards = pm.cards;
      final PaymentCardItem? selected = cards.isEmpty
          ? null
          : (cards.firstWhereOrNull((e) => e.isDefault) ?? cards.first);

      final title = selected?.title ?? 'No payment method added';

      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CommonText.bold('Payment Method', size: 16),
          const SizedBox(height: 12),
          if (cards.isEmpty)
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xffFFF6F7),
                border: Border.all(color: const Color(0xffF0C6CB)),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    alignment: Alignment.center,
                    child: const Icon(
                      Icons.credit_card_rounded,
                      size: 20,
                      color: _red,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: CommonText.medium(
                      'Add a payment method to continue',
                      size: 14,
                      color: Colors.black87,
                    ),
                  ),
                  AppButton(
                    label: 'Add method',
                    onPressed: () async {
                      await Get.toNamed(
                        Routes.PAYMENT_METHOD,
                        arguments: {'returnOnSelect': true},
                      );
                      await pm.loadCards(showLoader: false);
                    },
                    type: ButtonType.primary,
                    bgColor: _red,
                    txtColor: Colors.white,
                    hPadding: 14,
                    vPadding: 10,
                    btnCornerRadius: 10,
                    textSize: 13,
                    isMax: false,
                  ),
                ],
              ),
            )
          else
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border.all(color: Colors.grey.shade300),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 26,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: Colors.grey.shade300),
                    ),
                    alignment: Alignment.center,
                    child: selected == null
                        ? const Icon(
                            Icons.credit_card_rounded,
                            size: 20,
                            color: _red,
                          )
                        : paymentMethodBrandLeading(selected),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: CommonText.bold(
                      title,
                      size: 15,
                      color: Colors.black,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  TextButton(
                    onPressed: () async {
                      await Get.toNamed(
                        Routes.PAYMENT_METHOD,
                        arguments: {'returnOnSelect': true},
                      );
                      await pm.loadCards(showLoader: false);
                    },
                    style: TextButton.styleFrom(
                      padding: EdgeInsets.zero,
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: CommonText.semiBold(
                      'Change >',
                      size: 14,
                      color: _red,
                    ),
                  ),
                ],
              ),
            ),
        ],
      );
    });
  }

  Widget _carWashLocationDropdown(BuildContext context) {
    return Obx(() {
      final hasLocations = controller.carWashOptions.isNotEmpty;
      final allLocations = controller.carWashOptions.toList(growable: false);
      final selected = controller.selectedCarWash.value;
      final dropdownSelected = controller.isServiceLocationDropdownSelected;
      final previewLocations = allLocations.take(5).toList(growable: true);
      if (selected != null &&
          selected.trim().isNotEmpty &&
          allLocations.contains(selected) &&
          !previewLocations.contains(selected)) {
        if (previewLocations.isNotEmpty) {
          previewLocations[previewLocations.length - 1] = selected;
        } else {
          previewLocations.add(selected);
        }
      }
      final dropdownItems = [
        ...previewLocations,
        _showAllCarWashLocationsLabel,
      ];

      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (hasLocations)
            CommonDropDownField(
              key: ValueKey(
                'car_wash_location_${controller.carWashLocationDropdownRenderVersion.value}_${controller.selectedCarWash.value ?? ''}',
              ),
              hintText: controller.isSearchingNearbyPlaces.value
                  ? 'Loading nearby locations...'
                  : 'Select',
              labelText: controller.isCombinedServiceFlow
                  ? 'Automatic Car Wash Locations Nearby.'
                  : 'Automatic Car Wash Locations Nearby.',
              labelColor: context.colorScheme.secondary,
              hintColor: _bookingFieldBorder(context),
              selectedTextColor: context.colorScheme.onSurface,
              selectedValue: controller.selectedCarWash.value,
              items: dropdownItems,
              dropdownItemMaxLines: 4,
              showDropdownItemSeparators: true,
              errorText: controller.isCombinedServiceFlow
                  ? 'Please select a service location'
                  : 'Please select a car wash',
              bgColor: dropdownSelected ? _locationSelectedBg : _bookingFieldBg,
              borderColor: _fieldBorderColor(
                context,
                selected: dropdownSelected,
              ),
              onSave: (value) {
                if (value == _showAllCarWashLocationsLabel) {
                  final previousSelected = controller.selectedCarWash.value;
                  controller.carWashLocationDropdownRenderVersion.value++;
                  unawaited(
                    _showAllCarWashLocationsBottomSheet(context).then((_) {
                      final currentSelected = controller.selectedCarWash.value;
                      final hasCurrentSelection =
                          currentSelected != null &&
                          currentSelected.trim().isNotEmpty &&
                          controller.carWashOptions.contains(currentSelected);
                      if (hasCurrentSelection) {
                        controller.selectedCarWash.refresh();
                        controller.carWashLocationDropdownRenderVersion.value++;
                        return;
                      }

                      final hasPreviousSelection =
                          previousSelected != null &&
                          previousSelected.trim().isNotEmpty &&
                          controller.carWashOptions.contains(previousSelected);
                      if (hasPreviousSelection) {
                        controller.setSelectedCarWash(previousSelected);
                        controller.selectedCarWash.refresh();
                      }
                      controller.carWashLocationDropdownRenderVersion.value++;
                    }),
                  );
                  return;
                }
                controller.setSelectedCarWash(value, userSelected: true);
              },
              highlightItems: {_showAllCarWashLocationsLabel},
              highlightItemTextColor: _red,
            ),
          if (dropdownSelected)
            _locationSelectedBanner(
              controller.isCombinedServiceFlow
                  ? 'Service location selected'
                  : 'Car wash location selected',
            ),
          if (controller.isSearchingNearbyPlaces.value)
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: LinearProgressIndicator(minHeight: 2),
            ),
          // if ((controller.selectedCarWashAddress.value ?? '').isNotEmpty) ...[
          //   const SizedBox(height: 8),
          //   CommonText.regular(
          //     controller.selectedCarWashAddress.value!,
          //     size: 12,
          //     color: Colors.grey.shade700,
          //   ),
          // ],
          // if (controller.selectedCarWashLatitude.value != null &&
          //     controller.selectedCarWashLongitude.value != null)
          //   Padding(
          //     padding: const EdgeInsets.only(top: 4),
          //     child: CommonText.regular(
          //       'Lat: ${controller.selectedCarWashLatitude.value!.toStringAsFixed(6)} | '
          //       'Lng: ${controller.selectedCarWashLongitude.value!.toStringAsFixed(6)}',
          //       size: 11,
          //       color: Colors.grey.shade600,
          //     ),
          //   ),
          if ((controller.nearbySearchError.value ?? '').isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: CommonText.regular(
                controller.nearbySearchError.value!,
                size: 12,
                color: context.colorScheme.error,
              ),
            ),
        ],
      );
    });
  }

  Future<void> _showAllCarWashLocationsBottomSheet(BuildContext context) async {
    final locations = controller.carWashOptions.toList(growable: false);
    if (locations.isEmpty) return;

    await showModalBottomSheet<void>(
      context: context,
      useSafeArea: true,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => Container(
        decoration: BoxDecoration(
          color: context.colorScheme.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          border: const Border(top: BorderSide(color: _red, width: 1.5)),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 10),
            Center(
              child: Container(
                width: 44,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade400,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: CommonText.medium(
                controller.isCombinedServiceFlow
                    ? 'All Service Locations'
                    : 'All Car Wash Locations',
                size: 15,
                color: Color(0xff6B6B6B),
                textAlign: TextAlign.center,
              ),
            ),
            const SizedBox(height: 10),
            Flexible(
              child: ListView.separated(
                shrinkWrap: true,
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 16),
                itemCount: locations.length,
                separatorBuilder: (_, __) =>
                    Divider(height: 1, color: Colors.grey.shade300),
                itemBuilder: (_, index) {
                  final option = locations[index];
                  final selected = option == controller.selectedCarWash.value;
                  return ListTile(
                    dense: true,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 2,
                    ),
                    title: CommonText.regular(
                      option,
                      size: 13,
                      color: Colors.black87,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    trailing: selected
                        ? const Icon(Icons.check_rounded, color: _red, size: 18)
                        : null,
                    onTap: () {
                      controller.setSelectedCarWash(option, userSelected: true);
                      Get.back<void>();
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );

    final selected = controller.selectedCarWash.value?.trim() ?? '';
    if (selected.isEmpty && locations.isNotEmpty) {
      controller.setSelectedCarWash(locations.first);
    }
  }

  Widget _bottomBar(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
        20,
        12,
        20,
        16 + MediaQuery.paddingOf(context).bottom,
      ),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 12,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Obx(
        () => Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (controller.currentStep.value ==
                controller.flowStepCount - 1) ...[
              Row(
                children: [
                  CommonText.regular(
                    'Total:',
                    size: 15,
                    color: Colors.grey.shade700,
                  ),
                  const SizedBox(width: 8),
                  CommonText.extraBold(
                    '\$${controller.reviewApiTotalPrice.toStringAsFixed(2)}',
                    size: 18,
                    color: _red,
                  ),
                ],
              ),
              const SizedBox(height: 12),
            ],
            SizedBox(
              width: double.infinity,
              child: AppButton(
                label: controller.primaryButtonLabel,
                // Accessing canProceed inside Obx makes it reactive: GetX
                // will re-render the button whenever any of the observables
                // that canProceed reads (battery status, charge limit, etc.)
                // change, keeping it disabled in real time.
                onPressed: controller.canProceed ? controller.goNext : null,
                type: ButtonType.primary,
                bgColor: controller.canProceed
                    ? _ctaRed
                    : _ctaRed.withValues(alpha: 0.45),
                txtColor: Colors.white,
                vPadding: 16,
                btnCornerRadius: 14,
                textSize: 16,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DashedRRectPainter extends CustomPainter {
  _DashedRRectPainter({
    required this.color,
    required this.dash,
    required this.gap,
    required this.radius,
    required this.strokeWidth,
  });

  final Color color;
  final double dash;
  final double gap;
  final double radius;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final rrect = RRect.fromRectAndRadius(
      Rect.fromLTWH(0, 0, size.width, size.height),
      Radius.circular(radius),
    );
    final path = Path()..addRRect(rrect);
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth;

    for (final metric in path.computeMetrics()) {
      double distance = 0;
      var index = 0;
      while (distance < metric.length) {
        final end = (distance + dash)
            .clamp(0.0, metric.length.toDouble())
            .toDouble();
        if (index.isEven) {
          canvas.drawPath(metric.extractPath(distance, end), paint);
        }
        distance = end + gap;
        index++;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DashedRRectPainter oldDelegate) {
    return oldDelegate.color != color ||
        oldDelegate.dash != dash ||
        oldDelegate.gap != gap ||
        oldDelegate.radius != radius ||
        oldDelegate.strokeWidth != strokeWidth;
  }
}
