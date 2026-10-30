import 'package:flutter/material.dart';

import '../modules/settings/payment_methods_controller.dart';

class WebStripeCardField extends StatelessWidget {
  const WebStripeCardField({super.key, required this.controller});

  final PaymentMethodsController controller;

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
