import 'package:car_comfort/app/utils/extensions/extension.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../theme/design_tokens.dart';
import '../../widgets/button.dart';
import '../../widgets/image.dart';
import '../../widgets/text.dart';
import 'driver_header_back_button.dart';

Future<void> showAboutServiceBottomSheet(
  BuildContext context, {
  VoidCallback? onAccept,
  VoidCallback? onReject,
  String customerName = 'Frank Smith!',
  String customerAvatarUrl = '',
  String serviceType = 'DCC Fast Charging',
  String parkingSpot = 'House Parking',
  String location = 'House location lorem ipsum street 2',
  String descriptionText =
      "Lorem Ipsum is simply dummy text of the printing industry. Lorem Ipsum has been the industry's standard dummy text ever...",
  String servicesFee = '\$170.00',
  String dateTimeText = 'OCT,24,2024,8:26 PM',
  String estimatedPrice = '\$200',
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    builder: (_) => FractionallySizedBox(
      heightFactor: 1,
      child: Container(
        decoration: BoxDecoration(
          color: context.colorScheme.onPrimary,
          borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
        ),
        clipBehavior: Clip.antiAlias,
        child: _AboutServiceContent(
          onBack: () => Get.back(),
          onAccept: onAccept,
          onReject: onReject,
          customerName: customerName,
          customerAvatarUrl: customerAvatarUrl,
          serviceType: serviceType,
          parkingSpot: parkingSpot,
          location: location,
          descriptionText: descriptionText,
          servicesFee: servicesFee,
          dateTimeText: dateTimeText,
          estimatedPrice: estimatedPrice,
        ),
      ),
    ),
  );
}

class AboutServiceView extends StatelessWidget {
  const AboutServiceView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xffFAFAFA),
      body: _AboutServiceContent(onBack: () => Get.back()),
    );
  }
}

class _AboutServiceContent extends StatelessWidget {
  const _AboutServiceContent({
    required this.onBack,
    this.scrollController,
    this.onAccept,
    this.onReject,
    this.customerName = 'Frank Smith!',
    this.customerAvatarUrl = '',
    this.serviceType = 'DCC Fast Charging',
    this.parkingSpot = 'House Parking',
    this.location = 'House location lorem ipsum street 2',
    this.descriptionText =
        "Lorem Ipsum is simply dummy text of the printing industry. Lorem Ipsum has been the industry's standard dummy text ever...",
    this.servicesFee = '\$170.00',
    this.dateTimeText = 'OCT,24,2024,8:26 PM',
    this.estimatedPrice = '\$200',
  });

  final VoidCallback onBack;
  final ScrollController? scrollController;
  final VoidCallback? onAccept;
  final VoidCallback? onReject;
  final String customerName;
  final String customerAvatarUrl;
  final String serviceType;
  final String parkingSpot;
  final String location;
  final String descriptionText;
  final String servicesFee;
  final String dateTimeText;
  final String estimatedPrice;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            MediaQuery.paddingOf(context).top + 20,
            20,
            20,
          ),
          child: Column(
            children: [
              Row(
                children: [
                  DriverHeaderBackButton(
                    onTap: onBack,
                    outlined: false,
                    iconColor: context.colorScheme.scrim,
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: CommonText.regular(
                      'About Service',
                      size: 18,
                      color: Color(0xff4A4A4A),
                    ),
                  ),
                ],
              ).paddingOnly(bottom: 18),
              LayoutBuilder(
                builder: (context, constraints) {
                  final redWidth = constraints.maxWidth * 0.32;
                  return Stack(
                    children: [
                      Container(
                        height: 6,
                        decoration: BoxDecoration(
                          color: const Color(0xffD1D1D1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      Container(
                        height: 6,
                        width: redWidth,
                        decoration: BoxDecoration(
                          color: const Color(0xffE70B1C),
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                    ],
                  );
                },
              ),
            ],
          ),
        ),
        Expanded(
          child: SingleChildScrollView(
            controller: scrollController,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 96,
                    height: 96,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.grey.shade300,
                      border: Border.all(color: Colors.black87, width: 2),
                    ),
                    child: ClipOval(
                      child: customerAvatarUrl.trim().isEmpty
                          ? Icon(
                              Icons.person_rounded,
                              size: 52,
                              color: Colors.grey.shade100,
                            )
                          : ImageFromNetwork(
                              customerAvatarUrl.trim(),
                              width: 96,
                              height: 96,
                              fit: BoxFit.cover,
                              placeholderWidget: Container(
                                width: 96,
                                height: 96,
                                color: Colors.grey.shade300,
                              ),
                            ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Center(
                  child: CommonText.semiBold(
                    customerName,
                    size: 20,
                    color: Color(0xff3A3A3A),
                  ),
                ),
                const SizedBox(height: 12),
                const Divider(height: 1),
                const SizedBox(height: 8),
                _row('Service Type:', serviceType),
                _row('Parking Spot:', parkingSpot),
                _row('Location:', location),
                const SizedBox(height: 10),
                const CommonText.medium(
                  'Description:',
                  size: 14,
                  color: Color(0xff5E5E5E),
                ),
                const SizedBox(height: 8),
                CommonText.regular(
                  descriptionText,
                  size: 13,
                  color: Color(0xff5E5E5E),
                ),
                const SizedBox(height: 10),
                const Divider(height: 1),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.fromLTRB(8, 16, 8, 16),
                  decoration: BoxDecoration(
                    color: context.colorScheme.secondaryFixed,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xffE8E8EF)),
                  ),
                  child: Column(
                    children: [
                      _InfoRow('Services Fee:', servicesFee),
                      SizedBox(height: 8),
                      Divider(height: 1, color: context.colorScheme.secondaryFixedDim),
                      SizedBox(height: 8),
                      _InfoRow('Date & Time:', dateTimeText),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: CommonText.semiBold(
                        'Estimated Price',
                        size: 20,
                        color: Color(0xff3A3A3A),
                      ),
                    ),
                    CommonText.bold(
                      estimatedPrice,
                      size: 20,
                      color: Color(0xff2C2C2E),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                AppButton(
                  label: 'Accept',
                  onPressed: () {
                    onBack();
                    onAccept?.call();
                  },
                  bgColor: const Color(0xff273844),
                  btnCornerRadius: AppRadius.xl,
                  vPadding: 13,
                ),
                const SizedBox(height: 10),
                AppButton(
                  label: 'Reject',
                  onPressed: () {
                    onBack();
                    onReject?.call();
                  },
                  bgColor: const Color(0xffE70B1C),
                  btnCornerRadius: AppRadius.xl,
                  vPadding: 13,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: CommonText.medium(
                  label,
                  size: 14,
                  color: const Color(0xff5E5E5E),
                ),
              ),
              Flexible(
                child: CommonText.regular(
                  value,
                  size: 14,
                  color: const Color(0xff5E5E5E),
                  textAlign: TextAlign.right,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          const Divider(height: 1),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;

  const _InfoRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: CommonText.regular(
            label,
            size: 13,
            color: const Color(0xff8B8B8B),
          ),
        ),
        CommonText.regular(
          value,
          size: 12,
          color: const Color(0xff8B8B8B),
          textAlign: TextAlign.right,
        ),
      ],
    );
  }
}
