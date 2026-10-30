import 'dart:html' as html;
import 'dart:ui_web' as ui_web;

import 'package:flutter/material.dart';

import '../modules/settings/payment_methods_controller.dart';
import '../utils/env_service.dart';
import '../utils/stripe_web_bridge_web.dart';
import '../constants/api_constants.dart';
import 'text_field.dart';

int _nextStripeFieldId = 0;

class WebStripeCardField extends StatefulWidget {
  const WebStripeCardField({super.key, required this.controller});

  final PaymentMethodsController controller;

  @override
  State<WebStripeCardField> createState() => _WebStripeCardFieldState();
}

class _WebStripeCardFieldState extends State<WebStripeCardField> {
  late final String _viewType;
  late final html.DivElement _rootElement;
  late final html.DivElement _numberElement;
  late final html.DivElement _expiryElement;
  late final html.DivElement _cvcElement;

  @override
  void initState() {
    super.initState();
    final id = _nextStripeFieldId++;
    _viewType = 'car-comfort-stripe-fields-$id';
    _numberElement = _fieldElement();
    _expiryElement = _fieldElement();
    _cvcElement = _fieldElement();

    final numberBlock = _fieldBlock('Card Number', _numberElement);
    final expiryBlock = _fieldBlock('Expiry Date', _expiryElement);
    final cvcBlock = _fieldBlock('CVV', _cvcElement);
    final bottomRow = html.DivElement()
      ..style.display = 'flex'
      ..style.gap = '12px';
    expiryBlock.style.flex = '1';
    cvcBlock.style.flex = '1';
    expiryBlock.style.marginBottom = '0';
    cvcBlock.style.marginBottom = '0';
    bottomRow.children.addAll([expiryBlock, cvcBlock]);

    _rootElement = html.DivElement()
      ..style.width = '100%'
      ..style.boxSizing = 'border-box'
      ..style.overflow = 'hidden'
      ..style.setProperty('pointer-events', 'auto');

    _rootElement.onKeyDown.listen((e) => e.stopPropagation());
    _rootElement.onKeyUp.listen((e) => e.stopPropagation());
    _rootElement.onKeyPress.listen((e) => e.stopPropagation());
    _rootElement.onMouseDown.listen((e) => e.stopPropagation());
    _rootElement.onMouseUp.listen((e) => e.stopPropagation());
    _rootElement.onClick.listen((e) => e.stopPropagation());
    _rootElement.onTouchStart.listen((e) => e.stopPropagation());
    _rootElement.onTouchEnd.listen((e) => e.stopPropagation());

    _rootElement.children.addAll([numberBlock, bottomRow]);

    ui_web.platformViewRegistry.registerViewFactory(_viewType, (viewId) => _rootElement);

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      html.window.console.log('[WebStripeCardField] PostFrameCallback started');
      try {
        // ApiConstants supplies the public web fallback when a local .env is
        // not present, while still preferring the configured environment key.
        final key = ApiConstants.stripePublishableKey.trim();
        html.window.console.log('[WebStripeCardField] Resolved Stripe Key: "$key"');
        if (key.isEmpty) {
          html.window.console.error('[WebStripeCardField] ERROR: Key is empty, skipping mount!');
          return;
        }
        if (!mounted) {
          html.window.console.log('[WebStripeCardField] Widget is not mounted, skipping mount!');
          return;
        }
        html.window.console.log('[WebStripeCardField] Calling mountWebStripeCard...');
        await mountWebStripeCard(_numberElement, _expiryElement, _cvcElement, key);
        html.window.console.log('[WebStripeCardField] mountWebStripeCard completed successfully!');
        if (mounted) widget.controller.isCardComplete.value = true;
      } catch (e, stack) {
        html.window.console.error('[WebStripeCardField] EXCEPTION during mount: $e\n$stack');
      }
    });
  }

  html.DivElement _fieldElement() => html.DivElement()
    ..style.width = '100%'
    ..style.height = '48px'
    ..style.boxSizing = 'border-box'
    ..style.padding = '14px'
    ..style.backgroundColor = '#FFFFFF'
    ..style.border = '1px solid #E5E7EB'
    ..style.borderRadius = '14px'
    ..style.setProperty('pointer-events', 'auto');

  html.DivElement _fieldBlock(String label, html.DivElement field) {
    final labelElement = html.DivElement()
      ..text = label
      ..style.color = '#1B1B1F'
      ..style.fontSize = '12px'
      ..style.fontWeight = '500'
      ..style.marginBottom = '6px';
    return html.DivElement()
      ..style.marginBottom = '14px'
      ..children.addAll([labelElement, field]);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CommonTextField(
          controller: widget.controller.cardNameController,
          labelText: 'Card Name',
          hintText: 'Name on card',
          textColor: const Color(0xFF1B1B1F),
          labelColor: const Color(0xFF1B1B1F),
          hintColor: const Color(0xFF6B7280),
          borderColor: const Color(0xFFE5E7EB),
          bgColor: Colors.white,
          borderRadius: 14,
        ),
        const SizedBox(height: 14),
        SizedBox(height: 150, child: HtmlElementView(viewType: _viewType)),
        const SizedBox(height: 8),
        const Text('Your card details are securely collected by Stripe.', style: TextStyle(color: Color(0xFF6B7280), fontSize: 12)),
      ],
    );
  }
}
