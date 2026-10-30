import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:path_provider/path_provider.dart';

/// Simple drawable signature pad that exports to a PNG file.
class SignaturePad extends StatefulWidget {
  const SignaturePad({
    super.key,
    required this.repaintKey,
    this.height = 140,
    this.strokeColor = Colors.black,
    this.onChanged,
  });

  final GlobalKey repaintKey;
  final double height;
  final Color strokeColor;
  final VoidCallback? onChanged;

  @override
  State<SignaturePad> createState() => SignaturePadState();
}

class SignaturePadState extends State<SignaturePad> {
  final List<List<Offset>> _strokes = [];
  List<Offset> _currentStroke = [];

  bool get hasSignature =>
      _strokes.any((stroke) => stroke.length > 1) ||
      (_currentStroke.length > 1);

  void clear() {
    setState(() {
      _strokes.clear();
      _currentStroke = [];
    });
    widget.onChanged?.call();
  }

  Future<String?> exportToPngFile() async {
    if (!hasSignature) return null;

    final boundary = widget.repaintKey.currentContext?.findRenderObject()
        as RenderRepaintBoundary?;
    if (boundary == null) return null;

    final image = await boundary.toImage(pixelRatio: 3);
    final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
    if (byteData == null) return null;

    final dir = await getTemporaryDirectory();
    final file = File(
      '${dir.path}/bg_check_signature_${DateTime.now().millisecondsSinceEpoch}.png',
    );
    await file.writeAsBytes(byteData.buffer.asUint8List());
    return file.path;
  }

  void _startStroke(Offset position) {
    setState(() {
      _currentStroke = [position];
      _strokes.add(_currentStroke);
    });
    widget.onChanged?.call();
  }

  void _appendStroke(Offset position) {
    setState(() {
      _currentStroke.add(position);
    });
    widget.onChanged?.call();
  }

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      key: widget.repaintKey,
      child: Container(
        height: widget.height,
        width: double.infinity,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xffE0E0E0)),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: GestureDetector(
            onPanStart: (d) => _startStroke(d.localPosition),
            onPanUpdate: (d) => _appendStroke(d.localPosition),
            child: CustomPaint(
              painter: _SignaturePainter(
                strokes: _strokes,
                color: widget.strokeColor,
              ),
              size: Size.infinite,
            ),
          ),
        ),
      ),
    );
  }
}

class _SignaturePainter extends CustomPainter {
  _SignaturePainter({required this.strokes, required this.color});

  final List<List<Offset>> strokes;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 2.2
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    for (final stroke in strokes) {
      if (stroke.length < 2) continue;
      final path = Path()..moveTo(stroke.first.dx, stroke.first.dy);
      for (var i = 1; i < stroke.length; i++) {
        path.lineTo(stroke[i].dx, stroke[i].dy);
      }
      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _SignaturePainter oldDelegate) => true;
}
