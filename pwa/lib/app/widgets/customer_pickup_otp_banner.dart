import 'package:flutter/material.dart';

import 'text.dart';

/// Prominent pickup OTP for customers during driver handover (Rapido-style).
class CustomerPickupOtpBanner extends StatelessWidget {
  const CustomerPickupOtpBanner({
    super.key,
    required this.otp,
    this.showWaitingWhenEmpty = false,
    this.compact = false,
  });

  final String? otp;
  final bool showWaitingWhenEmpty;
  final bool compact;

  static const Color _boxBorder = Color(0xffD1D1D6);
  static const Color _boxFill = Color(0xffFFFFFF);

  @override
  Widget build(BuildContext context) {
    final code = (otp ?? '').trim();
    if (code.isEmpty && !showWaitingWhenEmpty) {
      return const SizedBox.shrink();
    }

    if (compact) {
      return _compactBanner(code);
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: const Color(0xffF2F2F7),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xffE5E5EA)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CommonText.medium(
            'Please provide OTP to your service provider',
            size: 14,
            color: Colors.black87,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 12),
          if (code.isNotEmpty)
            _otpDigitRow(code)
          else
            const CommonText.regular(
              'Waiting for pickup OTP…',
              size: 13,
              color: Colors.black54,
              textAlign: TextAlign.center,
            ),
        ],
      ),
    );
  }

  Widget _compactBanner(String code) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const CommonText.medium(
          'Please provide OTP to your service provider',
          size: 13,
          color: Colors.black87,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        if (code.isNotEmpty)
          _otpDigitRow(code, digitSize: 22, boxSize: 40)
        else
          const CommonText.regular(
            'Waiting for pickup OTP…',
            size: 12,
            color: Colors.black54,
            textAlign: TextAlign.center,
          ),
      ],
    );
  }

  Widget _otpDigitRow(String code, {double digitSize = 26, double boxSize = 48}) {
    final digits = code.split('');
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        for (var i = 0; i < digits.length; i++) ...[
          if (i > 0) const SizedBox(width: 8),
          _OtpDigitBox(
            digit: digits[i],
            size: boxSize,
            fontSize: digitSize,
          ),
        ],
      ],
    );
  }
}

class _OtpDigitBox extends StatelessWidget {
  const _OtpDigitBox({
    required this.digit,
    required this.size,
    required this.fontSize,
  });

  final String digit;
  final double size;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: CustomerPickupOtpBanner._boxFill,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: CustomerPickupOtpBanner._boxBorder, width: 1.5),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0D000000),
            blurRadius: 4,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: CommonText.bold(
        digit,
        size: fontSize,
        color: Colors.black87,
      ),
    );
  }
}
