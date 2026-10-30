import 'dart:js_util' as js_util;

Future<void> mountWebStripeCard(
  Object numberElement,
  Object expiryElement,
  Object cvcElement,
  String publishableKey,
) async {
  final stripe = js_util.getProperty<Object?>(js_util.globalThis, 'carComfortStripe');
  if (stripe == null) throw StateError('Stripe.js is not loaded.');
  js_util.callMethod<void>(stripe, 'mountCardFields', <Object?>[
    numberElement,
    expiryElement,
    cvcElement,
    publishableKey,
  ]);
}

Future<String?> createWebStripePaymentMethod(String cardholderName) async {
  final stripe = js_util.getProperty<Object?>(js_util.globalThis, 'carComfortStripe');
  if (stripe == null) throw StateError('Stripe.js is not loaded.');
  final promise = js_util.callMethod<Object>(stripe, 'createPaymentMethod', <Object?>[cardholderName]);
  final result = await js_util.promiseToFuture<Object>(promise);
  final error = js_util.getProperty<Object?>(result, 'error');
  if (error != null) {
    final message = js_util.getProperty<Object?>(error, 'message');
    throw StateError(message?.toString() ?? 'Unable to create payment method.');
  }
  final paymentMethod = js_util.getProperty<Object?>(result, 'paymentMethod');
  if (paymentMethod == null) return null;
  return js_util.getProperty<String?>(paymentMethod, 'id');
}
