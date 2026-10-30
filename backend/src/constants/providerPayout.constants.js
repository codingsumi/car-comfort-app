'use strict';

/** Petty-cash advance released when the provider taps start service (billing spec). */
const SERVICE_START_ADVANCE_AMOUNT = 50;

/** When customer no-shows or cancels while provider is en route ($25 total fee). */
const EN_ROUTE_CANCELLATION_FEE_TOTAL = 25;
const EN_ROUTE_CANCELLATION_PROVIDER_SHARE = 20;
const EN_ROUTE_CANCELLATION_PLATFORM_SHARE = 5;

function toAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function roundTwo(n) {
  return Number(Number(n).toFixed(2));
}

/** Provider share of a customer cancellation / no-show fee (default $20 of $25). */
function computeProviderCancellationShareAmount(cancellationFee) {
  const fee = toAmount(cancellationFee);
  if (fee <= 0) return 0;
  if (fee >= EN_ROUTE_CANCELLATION_FEE_TOTAL) {
    return EN_ROUTE_CANCELLATION_PROVIDER_SHARE;
  }
  return roundTwo((fee * EN_ROUTE_CANCELLATION_PROVIDER_SHARE) / EN_ROUTE_CANCELLATION_FEE_TOTAL);
}

module.exports = {
  SERVICE_START_ADVANCE_AMOUNT,
  EN_ROUTE_CANCELLATION_FEE_TOTAL,
  EN_ROUTE_CANCELLATION_PROVIDER_SHARE,
  EN_ROUTE_CANCELLATION_PLATFORM_SHARE,
  computeProviderCancellationShareAmount,
};
