import 'dart:io';

import 'package:car_comfort/app/utils/extensions/extension.dart';
import 'package:flutter/material.dart';

import 'button.dart';
import 'text.dart';

/// Grey rounded slot + black Upload button; shows [Image.file] when [imagePath] is set.
class UploadImageSlot extends StatelessWidget {
  const UploadImageSlot({
    super.key,
    required this.imagePath,
    required this.placeholderLabel,
    required this.onUploadTap,
    this.slotColor = const Color(0xFFE6E6E6),
    this.previewHeight = 160,
  });

  final String? imagePath;
  final String placeholderLabel;
  final VoidCallback onUploadTap;
  final Color slotColor;
  final double previewHeight;

  bool get _hasImage => imagePath != null && imagePath!.isNotEmpty;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: slotColor,
        borderRadius: BorderRadius.circular(14),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            height: previewHeight,
            width: double.infinity,
            child: _hasImage
                ? ColoredBox(
                    color: slotColor,
                    child: Padding(
                      padding: const EdgeInsets.all(8),
                      child: Image.file(
                        File(imagePath!),
                        key: ValueKey<String>(imagePath!),
                        fit: BoxFit.contain,
                        width: double.infinity,
                        height: double.infinity,
                        cacheWidth: 800,
                        cacheHeight: 800,
                        errorBuilder: (context, error, stackTrace) {
                          return Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.broken_image_outlined,
                                size: 48,
                                color: context.colorScheme.outline,
                              ),
                              const SizedBox(height: 8),
                              CommonText.regular(
                                'Preview unavailable',
                                color: context.colorScheme.outline,
                                size: 13,
                              ),
                            ],
                          );
                        },
                      ),
                    ),
                  )
                : Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.image_outlined,
                        size: 58,
                        color: context.colorScheme.outline,
                      ),
                      const SizedBox(height: 8),
                      CommonText.regular(
                        placeholderLabel,
                        color: context.colorScheme.outline,
                        size: 16,
                      ),
                    ],
                  ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
            child: AppButton(
              label: 'Upload',
              onPressed: onUploadTap,
              bgColor: context.colorScheme.scrim,
              btnCornerRadius: 10,
              vPadding: 10,
            ),
          ),
        ],
      ),
    );
  }
}
