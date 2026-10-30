import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_stripe/flutter_stripe.dart';
import 'package:get/get.dart';

import '../../constants/payment_method_category.dart';
import '../../network/repository/payment_repository.dart';
import '../../utils/app_snackbar.dart';
import '../../utils/custom_loader.dart';
import '../../utils/extensions/extension.dart';
import '../../utils/env_service.dart';
import '../../utils/stripe_client_config.dart';
import '../../utils/validator.dart';

class PaymentCardItem {
  PaymentCardItem({
    required this.id,
    required this.type,
    required this.brand,
    required this.last4,
    required this.expMonth,
    required this.expYear,
    required this.isDefault,
    this.displayName,
    this.walletType,
  });

  final String id;
  final String type;
  final String brand;
  final String last4;
  final int? expMonth;
  final int? expYear;
  final bool isDefault;
  final String? displayName;
  final String? walletType;

  String get title {
    final normalizedType = type.trim().toLowerCase();
    if (normalizedType == 'paypal') {
      final name = (displayName ?? '').trim();
      return name.isNotEmpty ? 'PayPal · $name' : 'PayPal';
    }
    if (normalizedType == 'link') {
      final name = (displayName ?? '').trim();
      return name.isNotEmpty ? 'Link · $name' : 'Link';
    }
    final wallet = (walletType ?? '').trim().toLowerCase();
    if (wallet == 'apple_pay') {
      return last4.isNotEmpty ? 'Apple Pay ·••• $last4' : 'Apple Pay';
    }
    if (wallet == 'google_pay') {
      return last4.isNotEmpty ? 'Google Pay ·••• $last4' : 'Google Pay';
    }
    return '${brand.isEmpty ? 'Card' : brand.toUpperCase()} ·••• $last4';
  }
}

class PaymentMethodsController extends GetxController {
  PaymentMethodsController(this._paymentRepository);

  final PaymentRepository _paymentRepository;

  final RxList<PaymentCardItem> cards = <PaymentCardItem>[].obs;
  final RxBool isLoading = false.obs;
  final RxBool isActionLoading = false.obs;
  final RxBool isAddPaymentPanelOpen = false.obs;
  bool _paymentActionActive = false;
  bool hasLoadedCardsAtLeastOnce = false;
  final TextEditingController paymentMethodIdController =
      TextEditingController();
  final TextEditingController cardNameController = TextEditingController();
  final TextEditingController cardNumberController = TextEditingController();
  final TextEditingController cardExpiryController = TextEditingController();
  final TextEditingController cardCvvController = TextEditingController();
  final RxBool isCardComplete = false.obs;
  final Rx<PaymentMethodCategory> selectedCategory =
      PaymentMethodCategory.debit.obs;
  /// Always read live from EnvService so mode changes (test ↔ live) take effect
  /// without an app restart. Updated by ensurePublishableKeySynced() on every
  /// payment screen open.
  String get _stripePaymentMode => EnvService.stripePaymentModeResolved;

  @override
  void onReady() {
    super.onReady();
    // Sync publishable key + mode from admin settings every time this screen opens.
    unawaited(StripeClientConfig.ensurePublishableKeySynced());
    loadCards();
  }

  Future<void> loadCards({bool showLoader = true}) async {
    isLoading.value = true;
    if (showLoader) {
      Loader.showLoading();
    }
    try {
      final result = await _paymentRepository.listCards();

      result.when(
        success: (res) {
          cards.assignAll(_parseCards(res.data));
        },
        error: (err) {
          _snack('Cards', err.message, isError: true);
        },
      );
    } finally {
      hasLoadedCardsAtLeastOnce = true;
      isLoading.value = false;
      Loader.hideLoading();
      if (showLoader && Get.isDialogOpen == true) {
        Get.back();
      }
    }
  }

  Future<void> addCard() async {
    final paymentMethodId = paymentMethodIdController.text.trim();
    if (paymentMethodId.isEmpty) {
      _snack('Add Card', 'Please enter payment method id', isError: true);
      return;
    }
    isActionLoading.value = true;
    final result = await _paymentRepository.addCard(
      paymentMethodId: paymentMethodId,
    );
    isActionLoading.value = false;

    result.when(
      success: (res) async {
        paymentMethodIdController.clear();
        await loadCards(showLoader: false);
      },
      error: (err) {
        _snack('Add Card', err.message, isError: true);
      },
    );
  }

  void syncCardFormComplete() {
    isCardComplete.value = _isCardFormValid();
  }

  bool _isCardFormValid() {
    try {
      return validateCardNumber(cardNumberController.text) == null &&
          validateCardExpiry(cardExpiryController.text.trim()) == null &&
          validateCvv(cardCvvController.text.trim()) == null;
    } catch (_) {
      return false;
    }
  }

  CardDetails? _cardDetailsFromForm() {
    final expiry = cardExpiryController.text.trim();
    final parts = expiry.split('/');
    if (parts.length != 2) return null;

    final month = int.tryParse(parts[0]);
    final year = int.tryParse('20${parts[1]}');
    final number = cardNumberController.text.replaceAll(RegExp(r'\s+'), '');
    final cvc = cardCvvController.text.trim();
    if (month == null || year == null || number.isEmpty || cvc.isEmpty) {
      return null;
    }

    return CardDetails(
      number: number,
      expirationMonth: month,
      expirationYear: year,
      cvc: cvc,
    );
  }

  Future<bool> addCardViaStripeCardForm() async {
    if (isActionLoading.value) return false;
    syncCardFormComplete();
    if (!isCardComplete.value) {
      _snack('Add Card', 'Please complete card details first', isError: true);
      return false;
    }
    isActionLoading.value = true;
    try {
      final publishableKey = await StripeClientConfig.ensurePublishableKeySynced();
      if (publishableKey.isEmpty) {
        _snack(
          'Stripe',
          'Stripe is not configured. Set keys in admin Settings → Payments → Stripe.',
          isError: true,
        );
        return false;
      }

      // Brief settle delay so SDK fully propagates the new key before creating a pm_
      await Future<void>.delayed(const Duration(milliseconds: 300));

      final cardDetails = _cardDetailsFromForm();
      if (cardDetails == null) {
        _snack('Add Card', 'Please enter valid card details', isError: true);
        return false;
      }

      await Stripe.instance.dangerouslyUpdateCardDetails(cardDetails);

      final cardholderName = cardNameController.text.trim();
      final paymentMethod = await Stripe.instance.createPaymentMethod(
        params: PaymentMethodParams.card(
          paymentMethodData: PaymentMethodData(
            billingDetails: cardholderName.isEmpty
                ? null
                : BillingDetails(name: cardholderName),
          ),
        ),
      );

      final result = await _paymentRepository.addCard(
        paymentMethodId: paymentMethod.id,
      );
      var didSucceed = false;
      result.when(
        success: (res) {
          didSucceed = true;
          _snack('Add Card', res.message ?? 'Card added successfully');
        },
        error: (err) {
          _snack('Add Card', err.message, isError: true);
        },
      );
      if (didSucceed) {
        await loadCards(showLoader: false);
      }
      return didSucceed;
    } on StripeException catch (e) {
      _snack(
        'Stripe',
        e.error.localizedMessage ?? 'Unable to create payment method',
        isError: true,
      );
      return false;
    } on PlatformException catch (e) {
      _snack(
        'Stripe',
        e.message ?? e.code,
        isError: true,
      );
      return false;
    } catch (e) {
      _snack('Stripe', 'Unable to add card right now: $e', isError: true);
      return false;
    } finally {
      isActionLoading.value = false;
    }
  }

  void resetCardFormState() {
    cardNameController.clear();
    cardNumberController.clear();
    cardExpiryController.clear();
    cardCvvController.clear();
    isCardComplete.value = false;
    selectedCategory.value = PaymentMethodCategory.debit;
  }

  bool get canOpenAddPaymentPanel =>
      !isAddPaymentPanelOpen.value && !isActionLoading.value;

  bool tryOpenAddPaymentPanel() {
    if (!canOpenAddPaymentPanel) return false;
    isAddPaymentPanelOpen.value = true;
    return true;
  }

  void closeAddPaymentPanel() {
    isAddPaymentPanelOpen.value = false;
  }

  Future<bool> addPaymentMethodForSelectedCategory() async {
    if (_paymentActionActive) return false;
    _paymentActionActive = true;
    try {
      final category = selectedCategory.value;
      if (category.usesCardForm) {
        return addCardViaStripeCardForm();
      }
      return addPaymentMethodViaPaymentSheet(category);
    } finally {
      _paymentActionActive = false;
    }
  }

  Future<bool> addPaymentMethodViaPaymentSheet(
    PaymentMethodCategory category,
  ) async {
    if (isActionLoading.value) return false;
    isActionLoading.value = true;
    try {
      final publishableKey = await StripeClientConfig.ensurePublishableKeySynced();
      if (publishableKey.isEmpty) {
        _snack(
          'Stripe',
          'Stripe is not configured. Set keys in admin Settings → Payments → Stripe.',
          isError: true,
        );
        return false;
      }

      final result = await _paymentRepository.createSetupIntent(
        category: category.apiCategory,
      );

      Map<String, dynamic>? payload;
      result.when(
        success: (res) {
          final data = res.data;
          if (data is Map) {
            payload = Map<String, dynamic>.from(data);
          }
        },
        error: (err) {
          _snack('Payment method', err.message, isError: true);
        },
      );
      if (payload == null) return false;

      final clientSecret =
          '${payload!['setup_intent_client_secret'] ?? ''}'.trim();
      final customerId = '${payload!['customer_id'] ?? ''}'.trim();
      final ephemeralKey =
          '${payload!['ephemeral_key_secret'] ?? ''}'.trim();

      if (clientSecret.isEmpty) {
        _snack(
          'Payment method',
          'Unable to start ${category.label} setup.',
          isError: true,
        );
        return false;
      }

      final googleTestEnv = _stripePaymentMode != 'live' || kDebugMode;

      await Stripe.instance.initPaymentSheet(
        paymentSheetParameters: SetupPaymentSheetParameters(
          setupIntentClientSecret: clientSecret,
          merchantDisplayName: 'CarComfort',
          customerId: customerId.isNotEmpty ? customerId : null,
          customerEphemeralKeySecret:
              ephemeralKey.isNotEmpty ? ephemeralKey : null,
          style: ThemeMode.light,
          allowsDelayedPaymentMethods: true,
          applePay: Platform.isIOS
              ? const PaymentSheetApplePay(merchantCountryCode: 'US')
              : null,
          googlePay: Platform.isAndroid
              ? PaymentSheetGooglePay(
                  merchantCountryCode: 'US',
                  testEnv: googleTestEnv,
                )
              : null,
        ),
      );

      await Stripe.instance.presentPaymentSheet();

      final setupIntent =
          await Stripe.instance.retrieveSetupIntent(clientSecret);
      final paymentMethodId = setupIntent.paymentMethodId.trim();
      if (paymentMethodId.isEmpty) {
        _snack(
          'Payment method',
          '${category.label} was not saved. Please try again.',
          isError: true,
        );
        return false;
      }

      final attachResult = await _paymentRepository.addCard(
        paymentMethodId: paymentMethodId,
      );
      var didSucceed = false;
      attachResult.when(
        success: (res) {
          didSucceed = true;
          _snack(
            'Payment method',
            res.message ?? '${category.label} added successfully',
          );
        },
        error: (err) {
          _snack('Payment method', err.message, isError: true);
        },
      );
      if (didSucceed) {
        await loadCards(showLoader: false);
      }
      return didSucceed;
    } on StripeException catch (e) {
      if (e.error.code != FailureCode.Canceled) {
        _snack(
          'Stripe',
          e.error.localizedMessage ?? 'Unable to add ${category.label}',
          isError: true,
        );
      }
      return false;
    } on PlatformException catch (e) {
      _snack('Stripe', e.message ?? e.code, isError: true);
      return false;
    } catch (e) {
      _snack(
        'Payment method',
        'Unable to add ${category.label} right now: $e',
        isError: true,
      );
      return false;
    } finally {
      isActionLoading.value = false;
    }
  }

  Future<void> setDefaultCard(String paymentMethodId) async {
    isActionLoading.value = true;

    try {
      Loader.showLoading();

      final result = await _paymentRepository.setDefaultCard(
        paymentMethodId: paymentMethodId,
      );
      result.when(
        success: (res) async {
          _snack('Default Card', res.message ?? 'Default card updated');

          await loadCards(showLoader: false);
        },
        error: (err) {
          _snack('Default Card', err.message, isError: true);
        },
      );
    } finally {
      isActionLoading.value = false;
      print("Loader is Hider");
      if (Get.isDialogOpen == true) {
        Get.back();
      }
    }
  }

  Future<void> removeCard(String paymentMethodId) async {
    isActionLoading.value = true;

    try {
      Loader.showLoading();

      final result = await _paymentRepository.removeCard(
        paymentMethodId: paymentMethodId,
      );

      result.when(
        success: (res) async {
          _snack('Remove Card', res.message ?? 'Card removed successfully');

          await loadCards(showLoader: false);
        },
        error: (err) {
          _snack('Remove Card', err.message, isError: true);
        },
      );
    } catch (e) {
      _snack('Remove Card', 'Something went wrong', isError: true);
    } finally {
      isActionLoading.value = false;

      if (Get.isDialogOpen == true) {
        Get.back();
      }
    }
  }

  List<PaymentCardItem> _parseCards(dynamic data) {
    if (data == null) return const <PaymentCardItem>[];

    if (data is Map) {
      final mode = data['payment_mode'];
      if (mode != null) {
        // Keep EnvService in sync so the live getter (_stripePaymentMode) reflects this too.
        final modeStr = '$mode'.trim().toLowerCase();
        if (modeStr == 'live' || modeStr == 'test') {
          EnvService.stripePaymentModeResolved = modeStr;
        }
      }
      final methods = data['payment_methods'];
      if (methods is List && methods.isNotEmpty) {
        return methods
            .whereType<Map>()
            .map(_parsePaymentMethodItem)
            .where((item) => item.id.isNotEmpty)
            .toList();
      }
    }

    final dynamic source = (data is Map && data['cards'] is List)
        ? data['cards']
        : data;
    if (source is! List) return const <PaymentCardItem>[];

    return source
        .whereType<Map>()
        .map(_parsePaymentMethodItem)
        .where((item) => item.id.isNotEmpty)
        .toList();
  }

  PaymentCardItem _parsePaymentMethodItem(Map json) {
    final id = '${json['id'] ?? json['payment_method_id'] ?? ''}';
    final type = '${json['type'] ?? 'card'}';
    final brand = '${json['brand'] ?? ''}';
    final last4 = '${json['last4'] ?? json['last_4'] ?? ''}';
    final expMonth = int.tryParse('${json['exp_month'] ?? ''}');
    final expYear = int.tryParse('${json['exp_year'] ?? ''}');
    final isDefault = json['is_default'] == true || json['default'] == true;
    final displayName = json['display_name']?.toString();
    final walletType = json['wallet_type']?.toString();
    return PaymentCardItem(
      id: id,
      type: type,
      brand: brand,
      last4: last4,
      expMonth: expMonth,
      expYear: expYear,
      isDefault: isDefault,
      displayName: displayName,
      walletType: walletType,
    );
  }

  void _snack(String title, String message, {bool isError = false}) {
    showAppSnackBar(
      title: title,
      message: message,
      isError: isError,
    );
  }

  @override
  void onClose() {
    paymentMethodIdController.dispose();
    cardNameController.dispose();
    cardNumberController.dispose();
    cardExpiryController.dispose();
    cardCvvController.dispose();
    super.onClose();
  }
}
