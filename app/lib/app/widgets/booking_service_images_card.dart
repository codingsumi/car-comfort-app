import 'package:flutter/material.dart';

import '../network/response/booking_detail_response.dart';
import 'image.dart';
import 'service_image_gallery_viewer.dart';
import 'text.dart';

class BookingServiceImagesCard extends StatelessWidget {
  const BookingServiceImagesCard({
    super.key,
    required this.serviceImages,
    this.title = 'Service Photos',
    this.beforeSectionTitle = 'Before Service',
    this.afterSectionTitle = 'After Service',
    this.customerSectionTitle = 'Customer Photos',
    this.showBeforeSection = true,
    this.showAfterSection = true,
    this.showCustomerSection = true,
    this.boxShadow = const [],
  });

  final BookingServiceImages serviceImages;
  final String title;
  final String beforeSectionTitle;
  final String afterSectionTitle;
  final String customerSectionTitle;
  final bool showBeforeSection;
  final bool showAfterSection;
  final bool showCustomerSection;
  final List<BoxShadow> boxShadow;

  static const int _gridColumns = 3;
  static const double _gridSpacing = 8;
  static const Color _labelGrey = Color(0xff636366);

  bool get _hasVisibleContent {
    if (showBeforeSection && serviceImages.beforeUrls.isNotEmpty) return true;
    if (showAfterSection && serviceImages.afterUrls.isNotEmpty) return true;
    if (showCustomerSection && serviceImages.customerUrls.isNotEmpty) {
      return true;
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    if (!_hasVisibleContent) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: boxShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: const Color(0xffF2F2F7),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.photo_library_outlined,
                  size: 18,
                  color: Color(0xff636366),
                ),
              ),
              const SizedBox(width: 10),
              CommonText.semiBold(
                title,
                size: 17,
                color: const Color(0xff1C1C1E),
              ),
            ],
          ),
          if (showBeforeSection && serviceImages.beforeUrls.isNotEmpty) ...[
            const SizedBox(height: 16),
            _ServiceImageSection(
              title: beforeSectionTitle,
              imageUrls: serviceImages.beforeUrls,
            ),
          ],
          if (showAfterSection && serviceImages.afterUrls.isNotEmpty) ...[
            const SizedBox(height: 16),
            _ServiceImageSection(
              title: afterSectionTitle,
              imageUrls: serviceImages.afterUrls,
            ),
          ],
          if (showCustomerSection && serviceImages.customerUrls.isNotEmpty) ...[
            const SizedBox(height: 16),
            _ServiceImageSection(
              title: customerSectionTitle,
              imageUrls: serviceImages.customerUrls,
            ),
          ],
        ],
      ),
    );
  }
}

class _ServiceImageSection extends StatelessWidget {
  const _ServiceImageSection({
    required this.title,
    required this.imageUrls,
  });

  final String title;
  final List<String> imageUrls;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final gridHeight = _servicePhotoGridHeight(
          maxWidth: constraints.maxWidth,
          itemCount: imageUrls.length,
        );

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            CommonText.medium(
              title.toUpperCase(),
              size: 12,
              letterSpacing: 0.8,
              color: BookingServiceImagesCard._labelGrey,
            ),
            const SizedBox(height: 10),
            SizedBox(
              height: gridHeight,
              child: GridView.builder(
                padding: EdgeInsets.zero,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: imageUrls.length,
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: BookingServiceImagesCard._gridColumns,
                  crossAxisSpacing: BookingServiceImagesCard._gridSpacing,
                  mainAxisSpacing: BookingServiceImagesCard._gridSpacing,
                  childAspectRatio: 1,
                ),
                itemBuilder: (context, index) {
                  final url = imageUrls[index];
                  return GestureDetector(
                    onTap: () => ServiceImageGalleryViewer.show(
                      context,
                      imageUrls: imageUrls,
                      initialIndex: index,
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: ColoredBox(
                        color: const Color(0xffF2F2F7),
                        child: ImageFromNetwork(
                          url,
                          width: double.infinity,
                          height: double.infinity,
                          fit: BoxFit.cover,
                          placeholderWidget: const Center(
                            child: Icon(
                              Icons.image_outlined,
                              color: Color(0xffC7C7CC),
                              size: 28,
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }

  static double _servicePhotoGridHeight({
    required double maxWidth,
    required int itemCount,
  }) {
    if (itemCount <= 0 || maxWidth <= 0) return 0;
    const columns = BookingServiceImagesCard._gridColumns;
    const spacing = BookingServiceImagesCard._gridSpacing;
    final cellWidth = (maxWidth - spacing * (columns - 1)) / columns;
    final rows = (itemCount + columns - 1) ~/ columns;
    return rows * cellWidth + (rows - 1) * spacing;
  }
}
