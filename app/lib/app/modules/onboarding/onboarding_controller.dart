import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../routes/app_pages.dart';
import '../auth/auth_entry_navigation.dart';

class OnboardingSlide {
  final String title;
  final String subtitle;
  final List<String> bullets;
  final String primaryActionText;
  final bool showSkip;

  const OnboardingSlide({
    required this.title,
    required this.subtitle,
    required this.bullets,
    required this.primaryActionText,
    this.showSkip = true,
  });
}

class OnboardingController extends GetxController {
  final PageController pageController = PageController();
  final RxInt currentPage = 0.obs;

  final List<OnboardingSlide> slides = const [
    OnboardingSlide(
      title: 'Welcome to Car Comfort',
      subtitle: 'EV Charging and Car Wash Services',
      bullets: ["You're all set! Let's get started with your first service."],
      primaryActionText: 'Get Started',
    ),
    OnboardingSlide(
      title: 'How Car Comfort Works',
      subtitle: 'Watch this quick tutorial to get started',
      bullets: [
        'How to request a service',
        'Tracking your service provider in real-time',
        'Payment and safety features',
      ],
      primaryActionText: 'Watch Tutorial',
    ),
    OnboardingSlide(
      title: 'Enable Camera Access',
      subtitle: 'We need your camera to:',
      bullets: [
        'Connect you with nearby service providers',
        'Show real-time provider location and ETA',
      ],
      primaryActionText: 'Allow Camera Access',
    ),
    OnboardingSlide(
      title: 'Enable Location Services',
      subtitle: 'We need your location to:',
      bullets: [
        'Connect you with nearby service providers',
        'Show real-time provider location and ETA',
        'Ensure accurate service delivery to your location',
        'Provide the best service experience',
      ],
      primaryActionText: 'Allow Location Access',
    ),
  ];

  void onPageChanged(int index) => currentPage.value = index;

  void onPrimaryAction() {
    if (currentPage.value < slides.length - 1) {
      pageController.nextPage(duration: const Duration(milliseconds: 300), curve: Curves.easeOut);
      return;
    }
    navigateToAuthEntry();
  }

  void skip() => navigateToAuthEntry();

  @override
  void onClose() {
    pageController.dispose();
    super.onClose();
  }
}
