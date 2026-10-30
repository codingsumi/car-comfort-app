import 'package:flutter/material.dart';

/// Mobile fallback for the browser-only Mapbox GL JS widget.
class CustomerWebMap extends StatelessWidget {
  const CustomerWebMap({super.key, required this.accessToken});

  final String accessToken;

  @override
  Widget build(BuildContext context) => const SizedBox.expand();
}
