import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_cache_manager/flutter_cache_manager.dart';
import 'package:flutter_svg/svg.dart';

import '../gen/assets.gen.dart';
import '../utils/extensions/extension.dart';

/// Shown while a profile/avatar network image loads, or as a neutral fallback on error.
class IcUserAvatarPlaceholder extends StatelessWidget {
  const IcUserAvatarPlaceholder({
    super.key,
    required this.size,
    this.backgroundColor = const Color(0xffE8E8EF),
  });

  final double size;
  final Color backgroundColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      color: backgroundColor,
      alignment: Alignment.center,
      child: SvgPicture.asset(
        Assets.imagesIcUser,
        width: size * 0.5,
        height: size * 0.5,
        fit: BoxFit.contain,
      ),
    );
  }
}

class CustomCacheManager {
  static final CacheManager instance = CacheManager(
    Config(
      'customCacheKey',
      stalePeriod: const Duration(days: 30),
      maxNrOfCacheObjects: 200,
    ),
  );
}

class ImageFromNetwork extends StatelessWidget {
  final String originalUrl;
  final String? thumbnailUrl;
  final bool isAvatar;
  final bool useThumbnail;
  final AssetGenImage? placeholderImage;
  final Widget? placeholderWidget;
  final double height;
  final double width;
  final double? size;
  final BoxFit fit;
  final Color? color;

  const ImageFromNetwork(
    this.originalUrl, {
    super.key,
    this.thumbnailUrl,
    this.placeholderImage,
    this.placeholderWidget,
    this.height = 24,
    this.width = 24,
    this.size,
    this.fit = BoxFit.contain,
    this.color,
    this.isAvatar = false,
    this.useThumbnail = false,
  });

  @override
  Widget build(BuildContext context) {
    final w = size ?? width;
    final h = size ?? height;

    final Widget rasterPlaceholder =
        (placeholderImage ?? Assets.launcherLogo).image(
      fit: fit,
      width: w,
      height: h,
    );

    final defaultPlaceholder = placeholderWidget ??
        (isAvatar ? IcUserAvatarPlaceholder(size: w) : rasterPlaceholder);

    if (useThumbnail
        ? (thumbnailUrl?.isEmpty == true)
        : (originalUrl.isEmpty == true)) {
      return defaultPlaceholder;
    }

    final displayW = size ?? width;
    final displayH = size ?? height;
    // Downsample to display size in memory — prevents OOM from full-res bitmaps
    final memW = displayW.isFinite ? (displayW * 2).ceil() : null;
    final memH = displayH.isFinite ? (displayH * 2).ceil() : null;

    return CachedNetworkImage(
      imageUrl: useThumbnail ? (thumbnailUrl ?? "") : originalUrl,
      fit: fit,
      width: displayW,
      height: displayH,
      memCacheWidth: memW,
      memCacheHeight: memH,
      cacheManager: CustomCacheManager.instance,
      useOldImageOnUrlChange: true,
      filterQuality: FilterQuality.low,
      cacheKey: useThumbnail
          ? thumbnailUrl.hashCode.toString()
          : originalUrl.hashCode.toString(),
      //Prevent screen flicker don't change
      fadeOutDuration: Duration.zero,
      fadeInDuration: Duration.zero,
      placeholderFadeInDuration: Duration.zero,
      // placeholderFadeInDuration: const Duration(milliseconds: 200),
      placeholder: (context, url) {
        if (useThumbnail) {
          return defaultPlaceholder;
        }
        if (thumbnailUrl != null && thumbnailUrl!.isNotEmpty) {
          return ImageFromNetwork(
            thumbnailUrl ?? "",
            thumbnailUrl: thumbnailUrl ?? "",
            fit: fit,
            width: size ?? width,
            height: size ?? height,
            isAvatar: isAvatar,
          );
        }
        return defaultPlaceholder;
      },
      errorWidget: (context, url, error) {
        if (thumbnailUrl != null && thumbnailUrl!.isNotEmpty && !useThumbnail) {
          return ImageFromNetwork(
            thumbnailUrl ?? "",
            thumbnailUrl: thumbnailUrl ?? "",
            fit: fit,
            width: size ?? width,
            height: size ?? height,
            isAvatar: isAvatar,
          );
        }
        return defaultPlaceholder;
      },
    );
  }
}

/*class ImageFromNetwork extends StatelessWidget {
  final String imageUrl;
  final bool isAvatar;
  final AssetGenImage? placeholderImage;
  final Widget? placeholderWidget;
  final double height;
  final double width;
  final double? size;
  final BoxFit fit;
  final Color? color;

  const ImageFromNetwork(
    this.imageUrl, {
    super.key,
    this.placeholderImage,
    this.placeholderWidget,
    this.height = 24,
    this.width = 24,
    this.size,
    this.fit = BoxFit.contain,
    this.color,
    this.isAvatar = false,
  });

  @override
  Widget build(BuildContext context) {
    AssetGenImage? img;

    img = isAvatar ? Assets.imagesUserDefaultImage : placeholderImage ?? Assets.imagesPlaceholder;

    var placeholderW = placeholderWidget ??
        img.image(
          fit: fit,
          width: size ?? width,
          height: size ?? height,
        );

    if (imageUrl.isEmpty) {
      return placeholderW;
    }

    return CachedNetworkImage(
      fit: fit,
      imageUrl: imageUrl,
      width: size ?? width,
      height: size ?? height,
      cacheManager: CustomCacheManager.instance,
      useOldImageOnUrlChange: true,
      filterQuality: FilterQuality.low,
      cacheKey: imageUrl.hashCode.toString(),
      placeholder: (context, url) => placeholderW,
      placeholderFadeInDuration: const Duration(milliseconds: 100),
      errorWidget: (context, url, error) => placeholderW,
    );
  }
}*/

class SvgImageFromAsset extends StatelessWidget {
  final String image;
  final double? height;
  final double? width;
  final BoxFit fit;
  final Color? color;
  final bool matchTextDirection;

  const SvgImageFromAsset(
    this.image, {
    this.height,
    this.width,
    this.color,
    this.fit = BoxFit.contain,
    this.matchTextDirection = true,
    super.key,
  });

  const SvgImageFromAsset.square(
    this.image, {
    double size = 24,
    this.color,
    this.fit = BoxFit.contain,
    this.matchTextDirection = true,
    super.key,
  }) : height = size,
       width = size;

  @override
  Widget build(BuildContext context) {
    return SvgPicture.asset(
      image,
      fit: fit,
      width: width,
      height: height,
      matchTextDirection: matchTextDirection,
      colorFilter: color != null
          ? ColorFilter.mode(
              color ?? context.colorScheme.onPrimary,
              BlendMode.srcATop,
            )
          : null,
    );
  }
}

class SquareSvgImageFromAsset extends StatelessWidget {
  final String image;
  final double size;
  final BoxFit fit;
  final Color? color;
  final bool matchTextDirection;

  const SquareSvgImageFromAsset(
    this.image, {
    this.size = 24,
    this.fit = BoxFit.contain,
    this.color,
    this.matchTextDirection = true,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    return SvgPicture.asset(
      image,
      fit: fit,
      width: size,
      height: size,
      matchTextDirection: matchTextDirection,
      colorFilter: color != null
          ? ColorFilter.mode(
              color ?? context.colorScheme.onPrimary,
              BlendMode.srcATop,
            )
          : null,
    );
  }
}
