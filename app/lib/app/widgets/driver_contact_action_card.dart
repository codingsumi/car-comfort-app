import 'package:flutter/material.dart';

import 'text.dart';

/// Dark contact action tile (call / message) used on driver trip screens.
class DriverContactActionCard extends StatelessWidget {
  const DriverContactActionCard({
    super.key,
    required this.title,
    required this.icon,
    required this.onTap,
    this.height = 92,
  });

  final String title;
  final IconData icon;
  final VoidCallback onTap;
  final double height;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xff2E2E2E),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          height: height,
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CommonText.regular(title, size: 12, color: Colors.white70),
              const Spacer(),
              Align(
                alignment: Alignment.bottomRight,
                child: Icon(icon, size: 34, color: Colors.white70),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
