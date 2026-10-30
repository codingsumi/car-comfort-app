import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';

import '../constants/ui_constants.dart';
import '../gen/assets.gen.dart';
import '../utils/extensions/extension.dart';
import '../widgets/image.dart';
import 'text.dart';

class Header extends StatelessWidget {
  final String title;
  final String? subTitle;
  final bool hasBackIcon;
  final bool titleCentered;
  final List<Widget>? actions;
  final double size;
  final double subTitleSize;
  final double? titleMarginStart;
  final Color? bgColor;
  final Widget? leadingIcon;
  final SystemUiOverlayStyle? mStyle;
  final VoidCallback? onBackCLick;

  const Header(
      {required this.title,
      this.subTitle,
      this.hasBackIcon = false,
      this.titleCentered = false,
      this.actions,
      this.bgColor,
      this.size = 28,
      this.subTitleSize = 16,
      this.titleMarginStart = 16,
      super.key,
      this.mStyle,
      this.leadingIcon,
      this.onBackCLick});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.only(top: 8),
      decoration: BoxDecoration(
        color: bgColor ?? context.colorScheme.surface,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (hasBackIcon)
                IconButton(
                  onPressed: onBackCLick ?? () => Get.back(),
                  icon: Assets.imagesBack.image(
                    color: Get.context?.colorScheme.secondary,
                    width: 28,
                    height: 28,
                  ),
                ),
              leadingIcon ?? Container(),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.start,
                  crossAxisAlignment: titleCentered ? CrossAxisAlignment.center : CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: CommonText.extraBold(
                            title,
                            isTitle: true,
                            size: size,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          )
                              .marginOnly(
                            left: hasBackIcon ? 0 : (titleMarginStart ?? 16),
                          ),
                        ),
                        if (actions != null) ...[
                          const SizedBox(width: 8), // Space before actions
                          Row(
                            children: actions!,
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (subTitle?.isNotEmpty == true) ...[
            Row(children: [
              SizedBox(
                width: ((leadingIcon != null && hasBackIcon)
                        ? 80 + (titleMarginStart ?? 16)
                        : leadingIcon != null
                            ? 44
                            : hasBackIcon
                                ? 28 + (titleMarginStart ?? 16)
                                : 0) +
                    (8),
              ), // Check if subtitle is not empty
              CommonText.medium(
                subTitle ?? "",
                size: subTitleSize,
              ).marginSymmetric(horizontal: hasBackIcon ? 0 : (titleMarginStart ?? 16)),
            ]),
          ],
        ],
      ),
    );
  }
}

class CommonAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String? title;
  final VoidCallback? onBackTap;
  final PreferredSizeWidget? bottom;
  final bool hasBackIcon, hasBorder;
  final List<Widget>? actions;
  final Widget? titleWidget;
  final String? leadingIcon;
  final Color? bgColor;

  const CommonAppBar({
    this.title,
    this.onBackTap,
    this.bottom,
    this.hasBackIcon = true,
    this.hasBorder = true,
    this.actions,
    this.titleWidget,
    this.leadingIcon,
    this.bgColor,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        AppBar(
          backgroundColor: bgColor ?? context.colorScheme.surface,
          leading: hasBackIcon
              ? IconButton(
                  splashRadius: UIConstants.defaultIconSize,
                  onPressed: onBackTap ?? () => Navigator.of(context).pop(),
                  icon: (leadingIcon != null) ? SquareSvgImageFromAsset(
                    leadingIcon!,
                    color: Get.context?.colorScheme.secondary,
                  ): Assets.imagesBack.image(color: Get.context?.colorScheme.secondary,),
                ).marginOnly(left: UIConstants.defaultMargin)
              : const SizedBox(width: 0),
          title: titleWidget ??
              CommonText.bold(
                title ?? "",
                size: 18,
                color: Get.context?.colorScheme.secondary,
                textAlign: TextAlign.start,
              ),
          leadingWidth: 56,
          automaticallyImplyLeading: true,
          centerTitle: false,
          actions: actions,
          elevation: 0,
          bottomOpacity: 0.0,
          scrolledUnderElevation: 0.0,
        ),
      ],
    );
  }

  @override
  Size get preferredSize => Size.fromHeight(56 + (bottom?.preferredSize.height ?? 0));
}
