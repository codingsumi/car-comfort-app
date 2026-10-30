import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../gen/assets.gen.dart';
import '../widgets/button.dart';
import '../widgets/image.dart';
import '../widgets/text.dart';

class NoDataView extends StatelessWidget {
  const NoDataView({super.key, this.content, this.callback, this.buttonLabel});

  final VoidCallback? callback;
  final String? content;
  final String? buttonLabel;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        SquareSvgImageFromAsset(Assets.imagesNoData, size: context.mediaQuerySize.width * 0.45),
        CommonText.bold(content ?? "No Data Found", size: 16).marginOnly(top: 32, bottom: 16),
        Visibility(
          visible: callback != null,
          child: AppButton(label: buttonLabel ?? "Refresh", onPressed: callback).marginSymmetric(horizontal: 64),
        ),
      ],
    );
  }
}
