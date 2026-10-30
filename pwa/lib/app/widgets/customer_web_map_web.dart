import 'dart:html' as html;
import 'dart:js_util' as js_util;
import 'dart:ui_web' as ui_web;

import 'package:flutter/material.dart';

int _nextMapId = 0;

/// Mapbox GL JS-backed map used only by the customer PWA.
class CustomerWebMap extends StatefulWidget {
  const CustomerWebMap({super.key, required this.accessToken});

  final String accessToken;

  @override
  State<CustomerWebMap> createState() => _CustomerWebMapState();
}

class _CustomerWebMapState extends State<CustomerWebMap> {
  late final String _viewType;
  late final html.DivElement _element;

  @override
  void initState() {
    super.initState();
    final id = _nextMapId++;
    _viewType = 'car-comfort-map-view-$id';
    _element = html.DivElement()
      ..style.width = '100%'
      ..style.height = '100%'
      // Flutter forwards drag gestures to Mapbox so the full-screen Flutter
      // event layer cannot swallow map movement. Overlay controls remain
      // ordinary Flutter hit targets.
      ..style.pointerEvents = 'none';

    ui_web.platformViewRegistry.registerViewFactory(_viewType, (viewId) {
      return _element;
    });

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || widget.accessToken.trim().isEmpty) return;
      final mapbox = js_util.getProperty<Object?>(
        js_util.globalThis,
        'carComfortMapbox',
      );
      if (mapbox == null) return;
      js_util.callMethod<void>(
        mapbox,
        'create',
        <Object?>[_element, widget.accessToken.trim()],
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    if (widget.accessToken.trim().isEmpty) {
      return const ColoredBox(
        color: Color(0xffDDE6ED),
        child: Center(child: Icon(Icons.map_outlined, size: 42)),
      );
    }
    return HtmlElementView(viewType: _viewType);
  }
}
