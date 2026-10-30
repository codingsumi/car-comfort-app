import 'package:car_comfort/app/widgets/text.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';

import 'service_booking_controller.dart';

/// Horizontal stepper (always 4 slots). Combined flow passes a mapped visual step.
class ServiceBookingStepper extends StatelessWidget {
  final int currentStep;
  final int stepCount;
  final List<String> labels;

  const ServiceBookingStepper({
    super.key,
    required this.currentStep,
    this.stepCount = 4,
    required this.labels,
  }) : assert(labels.length == stepCount);

  @override
  Widget build(BuildContext context) {
    const red = ServiceBookingController.brandRed;
    final compact = stepCount > 4;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Column(
        children: [
          Row(
            children: [
              for (int i = 0; i < stepCount; i++) ...[
                _StepCircle(
                  index: i,
                  currentStep: currentStep,
                  stepCount: stepCount,
                ),
                if (i < stepCount - 1)
                  Expanded(
                    child: Container(
                      height: 2,
                      margin: const EdgeInsets.symmetric(horizontal: 1),
                      decoration: BoxDecoration(
                        color: currentStep > i ? red : Colors.grey.shade300,
                        borderRadius: BorderRadius.circular(1),
                      ),
                    ),
                  ),
              ],
            ],
          ).marginSymmetric(horizontal: compact ? 4 : 28),
          const SizedBox(height: 10),
          Row(
            children: List.generate(stepCount, (i) {
              final doneOrActive = i <= currentStep;
              return Expanded(
                child: CommonText.bold(
                  labels[i],
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  size: compact ? 10 : 12,
                  color: doneOrActive ? red : Colors.grey.shade600,
                ),
              );
            }),
          ),
        ],
      ),
    );
  }
}

class _StepCircle extends StatelessWidget {
  final int index;
  final int currentStep;
  final int stepCount;

  const _StepCircle({
    required this.index,
    required this.currentStep,
    required this.stepCount,
  });

  @override
  Widget build(BuildContext context) {
    const red = ServiceBookingController.brandRed;
    final last = stepCount - 1;
    final completed = index < currentStep || currentStep >= last;
    final active = index == currentStep && currentStep < last;

    if (completed) {
      return Container(
        width: 28,
        height: 28,
        decoration: const BoxDecoration(color: red, shape: BoxShape.circle),
        child: const Icon(Icons.check_rounded, color: Colors.white, size: 18),
      );
    }

    return Container(
      width: 28,
      height: 28,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: active ? red : Colors.white,
        shape: BoxShape.circle,
        border: Border.all(
          color: active ? red : Colors.grey.shade400,
          width: 1.5,
        ),
      ),
      child: CommonText.extraBold(
        '${index + 1}',
        size: 13,
        color: active ? Colors.white : Colors.grey.shade600,
      ),
    );
  }
}

InputDecoration bookingFieldDecoration({
  required String hint,
  Widget? suffix,
}) {
  return InputDecoration(
    hintText: hint,
    hintStyle: TextStyle(color: Colors.grey.shade500, fontSize: 15),
    filled: true,
    fillColor: Colors.white,
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: BorderSide(color: Colors.grey.shade300),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: BorderSide(color: Colors.grey.shade300),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: const BorderSide(color: ServiceBookingController.brandRed, width: 1.2),
    ),
    suffixIcon: suffix,
  );
}

InputDecoration bookingDropdownDecoration() {
  return InputDecoration(
    filled: true,
    fillColor: Colors.white,
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: BorderSide(color: Colors.grey.shade300),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: BorderSide(color: Colors.grey.shade300),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: const BorderSide(color: ServiceBookingController.brandRed, width: 1.2),
    ),
  );
}
