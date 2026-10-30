import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../constants/service_provider_labels.dart';
import 'image.dart';
import 'text.dart';

const Color _brandRed = Color(0xffC4101F);
const Color _labelGrey = Color(0xff8E8E93);

/// Service provider photo preview — bottom sheet styled like the rest of the app.
Future<void> openProfilePhotoPreview(
  BuildContext context, {
  required String imageUrl,
  String? providerName,
  double? rating,
}) {
  final url = imageUrl.trim();
  if (url.isEmpty) return Future<void>.value();

  final name = (providerName ?? '').trim();

  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    builder: (sheetContext) {
      final photoSize =
          (MediaQuery.sizeOf(sheetContext).width - 64).clamp(160.0, 240.0);

      return SafeArea(
        top: false,
        child: Container(
          margin: EdgeInsets.only(
            bottom: MediaQuery.of(sheetContext).viewInsets.bottom,
          ),
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            border: Border(
              top: BorderSide(color: _brandRed, width: 3),
            ),
            boxShadow: [
              BoxShadow(
                color: Color(0x33000000),
                blurRadius: 16,
                offset: Offset(0, -4),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                margin: const EdgeInsets.symmetric(vertical: 8),
                height: 4,
                width: 40,
                decoration: BoxDecoration(
                  color: const Color(0xffD1D1D6),
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 0, 8, 16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Align(
                      alignment: Alignment.centerRight,
                      child: IconButton(
                        onPressed: () => Navigator.of(sheetContext).pop(),
                        icon: const Icon(Icons.close_rounded),
                        color: const Color(0xff2C2C2E),
                        tooltip: 'Close',
                      ),
                    ),
                    _PreviewPhoto(url: url, size: photoSize),
                    if (name.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      CommonText.semiBold(
                        name,
                        size: 18,
                        textAlign: TextAlign.center,
                      ),
                    ],
                    if (rating != null && rating > 0) ...[
                      const SizedBox(height: 10),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.star_rounded,
                            color: Color(0xffF6B700),
                            size: 20,
                          ),
                          const SizedBox(width: 4),
                          CommonText.semiBold(
                            rating.toStringAsFixed(1),
                            size: 15,
                          ),
                        ],
                      ),
                    ],
                    const SizedBox(height: 10),
                    const CommonText.regular(
                      'Pinch to zoom · verify before arrival',
                      size: 11,
                      color: _labelGrey,
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}

class _PreviewPhoto extends StatelessWidget {
  const _PreviewPhoto({required this.url, required this.size});

  final String url;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size + 8,
      height: size + 8,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: _brandRed.withValues(alpha: 0.35), width: 3),
        boxShadow: const [
          BoxShadow(
            color: Color(0x14000000),
            blurRadius: 12,
            offset: Offset(0, 4),
          ),
        ],
      ),
      alignment: Alignment.center,
      child: ClipOval(
        child: SizedBox(
          width: size,
          height: size,
          child: InteractiveViewer(
            minScale: 1,
            maxScale: 4,
            child: ImageFromNetwork(
              url,
              width: size,
              height: size,
              fit: BoxFit.cover,
              placeholderWidget: _placeholder(),
            ),
          ),
        ),
      ),
    );
  }

  Widget _placeholder() {
    return Container(
      width: size,
      height: size,
      color: const Color(0xffE8E8EF),
      alignment: Alignment.center,
      child: Icon(
        Icons.person_rounded,
        size: size * 0.42,
        color: Colors.grey.shade400,
      ),
    );
  }
}

/// Circular profile image; opens an enlarged preview when a URL is present.
class TappableProfileAvatar extends StatelessWidget {
  const TappableProfileAvatar({
    super.key,
    required this.imageUrl,
    this.size = 60,
    this.backgroundColor = const Color(0xffE8E8EF),
    this.previewTitle = ServiceProviderLabels.fallbackName,
    this.previewProviderName,
    this.previewRating,
    this.showZoomBadge = true,
  });

  final String? imageUrl;
  final double size;
  final Color backgroundColor;
  final String previewTitle;
  final String? previewProviderName;
  final double? previewRating;
  final bool showZoomBadge;

  String? get _resolvedProviderName {
    final explicit = (previewProviderName ?? '').trim();
    if (explicit.isNotEmpty) return explicit;
    final title = previewTitle.trim();
    if (title.isNotEmpty && title != ServiceProviderLabels.fallbackName) {
      return title;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final url = (imageUrl ?? '').trim();
    final avatar = _buildAvatar(url);

    if (url.isEmpty) return avatar;

    return Semantics(
      button: true,
      label: 'View service provider photo',
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => openProfilePhotoPreview(
            context,
            imageUrl: url,
            providerName: _resolvedProviderName,
            rating: previewRating,
          ),
          customBorder: const CircleBorder(),
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              avatar,
              if (showZoomBadge && size >= 28)
                Positioned(
                  right: -1,
                  bottom: -1,
                  child: Container(
                    width: size * 0.34,
                    height: size * 0.34,
                    decoration: BoxDecoration(
                      color: const Color(0xff2C2C2E),
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 1.5),
                    ),
                    child: Icon(
                      Icons.zoom_in_rounded,
                      size: size * 0.2,
                      color: Colors.white,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAvatar(String url) {
    if (url.isNotEmpty) {
      return ClipOval(
        child: CachedNetworkImage(
          imageUrl: url,
          width: size,
          height: size,
          fit: BoxFit.cover,
          placeholder: (_, _) => IcUserAvatarPlaceholder(
            size: size,
            backgroundColor: backgroundColor,
          ),
          errorWidget: (_, _, _) => IcUserAvatarPlaceholder(
            size: size,
            backgroundColor: backgroundColor,
          ),
        ),
      );
    }
    return ClipOval(
      child: IcUserAvatarPlaceholder(
        size: size,
        backgroundColor: backgroundColor,
      ),
    );
  }
}
