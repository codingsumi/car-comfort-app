import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import 'package:get/get.dart';

import '../../constants/app_strings.dart';
import '../../gen/assets.gen.dart';
import '../../routes/app_pages.dart';
import '../../theme/design_tokens.dart';
import '../../utils/extensions/extension.dart';
import '../../widgets/button.dart';
import '../../widgets/text.dart';
import '../../widgets/text_field.dart';
import '../../widgets/widgets.dart';
import 'driver_dashboard_controller.dart';

Widget _walletListLeadingIcon({required IconData icon}) {
  return Icon(icon, color: const Color(0xffF2051F), size: 22);
}

class MyWalletView extends StatefulWidget {
  const MyWalletView({super.key});

  @override
  State<MyWalletView> createState() => _MyWalletViewState();
}

class _MyWalletViewState extends State<MyWalletView>
    with WidgetsBindingObserver {
  static const Color _primaryRed = Color(0xffF2051F);
  static const Color _cardBg = Color(0xffF2F2F7);

  DriverDashboardController get controller =>
      Get.find<DriverDashboardController>();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(controller.refreshWalletTab(showKycErrorSnack: false));
    }
  }

  void _onWithdrawAmountPressed(BuildContext context) {
    if (!controller.canOpenPayoutBottomSheet) {
      controller.showPayoutUnavailableError();
      return;
    }
    unawaited(_openPayoutSheet(context));
  }

  Future<void> _openPayoutSheet(BuildContext context) async {
    controller.resetPayoutForm(prefillAvailablePayout: true);
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return SafeArea(
          top: false,
          child: Padding(
            padding: EdgeInsets.only(
              bottom: MediaQuery.viewInsetsOf(sheetContext).bottom,
            ),
            child: Container(
              decoration: const BoxDecoration(
                color: Color(0xffFAFAFA),
                borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
              ),
              padding: const EdgeInsets.fromLTRB(18, 14, 18, 18),
              child: Obx(
                () => SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Center(
                        child: Container(
                          width: 44,
                          height: 5,
                          decoration: BoxDecoration(
                            color: const Color(0xffD0D0D0),
                            borderRadius: BorderRadius.circular(999),
                          ),
                        ),
                      ),
                      const SizedBox(height: 18),
                      const CommonText.medium(
                        AppStrings.withdrawFunds,
                        size: 18,
                        color: Color(0xff1B1B1F),
                      ),
                      const SizedBox(height: 6),
                      const CommonText.regular(
                        'Enter the amount you want to withdraw to your linked account.',
                        size: 13,
                        color: Color(0xff6B7280),
                      ),
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 12,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xffE8E8EF)),
                        ),
                        child: Row(
                          children: [
                            const Expanded(
                              child: CommonText.regular(
                                'Available for payout',
                                size: 13,
                                color: Color(0xff6B7280),
                              ),
                            ),
                            CommonText.semiBold(
                              controller.formattedAvailableForPayout,
                              size: 15,
                              color: Color(0xff1B1B1F),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                      CommonTextField(
                        controller: controller.payoutAmountController,
                        labelText: 'Withdraw amount',
                        hintText: '0.00',
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        inputFormatters: [
                          FilteringTextInputFormatter.allow(
                            RegExp(r'^\d*\.?\d{0,2}'),
                          ),
                        ],
                        prefixIcon: const Padding(
                          padding: EdgeInsets.only(left: 12, right: 4),
                          child: CommonText.semiBold(
                            '\$',
                            size: 16,
                            color: Color(0xff1B1B1F),
                          ),
                        ),
                        borderRadius: 14,
                        borderColor: const Color(0xffE8E8EF),
                        bgColor: Colors.white,
                        textColor: const Color(0xff1B1B1F),
                        labelColor: const Color(0xff6B7280),
                        hintColor: const Color(0xff9CA3AF),
                      ),
                      const SizedBox(height: 8),
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton(
                          onPressed: controller.isPayoutLoading.value
                              ? null
                              : controller.fillPayoutWithAvailableBalance,
                          child: const Text(
                            'Use full available amount',
                            style: TextStyle(
                              color: _primaryRed,
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      AppButton(
                        label: controller.isPayoutLoading.value
                            ? 'Please wait...'
                            : AppStrings.withdraw,
                        onPressed: controller.isPayoutLoading.value
                            ? null
                            : () async {
                                FocusManager.instance.primaryFocus?.unfocus();
                                final didPayout = await controller
                                    .submitDriverWalletPayout();
                                if (!mounted) return;
                                if (didPayout) {
                                  Navigator.of(sheetContext).pop();
                                }
                              },
                        bgColor: _primaryRed,
                        btnCornerRadius: 14,
                      ),
                      const SizedBox(height: 10),
                      TextButton(
                        onPressed: controller.isPayoutLoading.value
                            ? null
                            : () => Navigator.of(sheetContext).pop(),
                        child: const Text(
                          'Cancel',
                          style: TextStyle(
                            color: Color(0xff4B5563),
                            fontSize: 15,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
    controller.resetPayoutForm();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _WalletHeader(
            onNotifications: () => Get.toNamed(Routes.DRIVER_NOTIFICATIONS),
          ),
          Expanded(
            child: Obx(() {
              if (controller.isWalletTabLoading) {
                return loader(context);
              }
              if (controller.needsStripeKycSetup) {
                return _StripeKycRequiredBody(
                  controller: controller,
                  primaryRed: _primaryRed,
                );
              }
              return _WalletBody(
                controller: controller,
                primaryRed: _primaryRed,
                onWithdraw: () => _onWithdrawAmountPressed(context),
              );
            }),
          ),
        ],
      ),
    );
  }
}

class _WalletBody extends StatelessWidget {
  final DriverDashboardController controller;
  final Color primaryRed;
  final VoidCallback onWithdraw;

  const _WalletBody({
    required this.controller,
    required this.primaryRed,
    required this.onWithdraw,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _BalanceCard(
            accountLabel: controller.displayName,
            balance: controller.isWalletLoading.value
                ? null
                : controller.formattedWalletBalance,
            availableForPayout: controller.isWalletLoading.value
                ? null
                : controller.formattedAvailableForPayout,
            pendingAmount: controller.isWalletLoading.value
                ? null
                : (controller.hasPendingNonWithdrawableBalance
                      ? controller.formattedPendingNonWithdrawableAmount
                      : null),
            isLoading: controller.isWalletLoading.value,
          ),
          const SizedBox(height: AppSpacing.lg),
          if (controller.showWalletPendingWithdrawNotice)
            _PendingWithdrawNotice(
              pendingAmount: controller.formattedPendingNonWithdrawableAmount,
              message: controller.walletPendingWithdrawNoticeBody,
            )
          else if (controller.canOpenPayoutBottomSheet)
            AppButton(
              label: 'Withdraw Amount',
              onPressed: controller.isWalletLoading.value ? null : onWithdraw,
              bgColor: primaryRed,
              btnCornerRadius: 14,
            ),
          const SizedBox(height: AppSpacing.lg),
          _WalletListTile(
            leading: _walletListLeadingIcon(icon: Icons.attach_money_rounded),
            title: 'Payment History',
            onTap: () => Get.toNamed(Routes.DRIVER_PAYMENT_HISTORY),
          ),
          const SizedBox(height: AppSpacing.md),
          _WalletListTile(
            leading: _walletListLeadingIcon(icon: Icons.headset_mic_outlined),
            title: 'Support',
            onTap: () => controller.homeNavIndex.value = 4,
          ),
        ],
      ),
    );
  }
}

class _StripeKycRequiredBody extends StatelessWidget {
  final DriverDashboardController controller;
  final Color primaryRed;

  const _StripeKycRequiredBody({
    required this.controller,
    required this.primaryRed,
  });

  @override
  Widget build(BuildContext context) {
    final kyc = controller.stripeConnectKycData.value;
    final requirements = kyc?.requirementsDue ?? const <String>[];

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: const Color(0xffF2F2F7),
              borderRadius: BorderRadius.circular(AppRadius.xl),
              border: Border.all(color: const Color(0xffE8E8EF)),
            ),
            child: Column(
              children: [
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: primaryRed.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.verified_user_outlined,
                    size: 32,
                    color: primaryRed,
                  ),
                ),
                const SizedBox(height: 16),
                const CommonText.semiBold(
                  'Complete Stripe verification',
                  size: 18,
                  color: Color(0xff1B1B1F),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                CommonText.regular(
                  controller.stripeKycUiMessage,
                  size: 13,
                  color: const Color(0xff6B7280),
                  textAlign: TextAlign.center,
                ),
                if (kyc?.disabledReason != null &&
                    kyc!.disabledReason!.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  CommonText.regular(
                    'Status: ${kyc.disabledReason}',
                    size: 12,
                    color: const Color(0xff9CA3AF),
                    textAlign: TextAlign.center,
                  ),
                ],
              ],
            ),
          ),
          if (requirements.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.lg),
            const CommonText.medium(
              'Information needed',
              size: 14,
              color: Color(0xff1B1B1F),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xffE8E8EF)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: requirements
                    .map(
                      (item) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(
                              Icons.circle,
                              size: 6,
                              color: primaryRed,
                            ).paddingOnly(top: 6, right: 8),
                            Expanded(
                              child: CommonText.regular(
                                _formatRequirement(item),
                                size: 13,
                                color: const Color(0xff4B5563),
                              ),
                            ),
                          ],
                        ),
                      ),
                    )
                    .toList(),
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.lg),
          AppButton(
            label: 'Complete verification',
            onPressed: kyc?.hasKycUrl == true
                ? controller.openStripeKycOnboarding
                : () => unawaited(
                    controller.refreshWalletTab(showKycErrorSnack: true),
                  ),
            bgColor: primaryRed,
            btnCornerRadius: 14,
          ),
          const SizedBox(height: 10),
          TextButton(
            onPressed: () => unawaited(
              controller.refreshWalletTab(showKycErrorSnack: false),
            ),
            child: const Text(
              'I\'ve completed verification — refresh',
              style: TextStyle(
                color: Color(0xff4B5563),
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  static String _formatRequirement(String raw) {
    return raw
        .replaceAll('_', ' ')
        .replaceAll('.', ' ')
        .split(RegExp(r'\s+'))
        .where((w) => w.isNotEmpty)
        .map(
          (w) => w.length <= 3
              ? w.toUpperCase()
              : '${w[0].toUpperCase()}${w.substring(1).toLowerCase()}',
        )
        .join(' ');
  }
}

class _WalletHeader extends StatelessWidget {
  final VoidCallback onNotifications;

  const _WalletHeader({required this.onNotifications});

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return ClipRRect(
      borderRadius: const BorderRadius.vertical(bottom: Radius.circular(18)),
      child: SizedBox(
        height: top + 84,
        child: Stack(
          fit: StackFit.expand,
          children: [
            Assets.imagesHomeHBg.image(fit: BoxFit.cover),
            Container(color: Colors.black.withValues(alpha: 0.45)),
            Padding(
              padding: EdgeInsets.fromLTRB(20, top + 16, 16, 12),
              child: Row(
                children: [
                  const Expanded(
                    child: CommonText.regular(
                      'My Wallet',
                      color: Colors.white,
                      size: 18,
                    ),
                  ),
                  Material(
                    color: Colors.white,
                    shape: const CircleBorder(),
                    child: InkWell(
                      onTap: onNotifications,
                      customBorder: const CircleBorder(),
                      child: const SizedBox(
                        width: 40,
                        height: 40,
                        child: Icon(
                          Icons.notifications_none_rounded,
                          color: Colors.black87,
                          size: 22,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PendingWithdrawNotice extends StatelessWidget {
  final String pendingAmount;
  final String message;

  const _PendingWithdrawNotice({
    required this.pendingAmount,
    required this.message,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xffFFF8E8),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xffF4D58A)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: const Color(0xffF4D58A).withValues(alpha: 0.35),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.schedule_rounded,
              color: Color(0xff9A6700),
              size: 22,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const CommonText.semiBold(
                  'Pending balance',
                  size: 15,
                  color: Color(0xff7A4E00),
                ),
                const SizedBox(height: 4),
                CommonText.bold(
                  pendingAmount,
                  size: 22,
                  color: Color(0xff7A4E00),
                ),
                const SizedBox(height: 8),
                CommonText.regular(
                  message,
                  size: 13,
                  color: const Color(0xff8A6A1A),
                ),
                const SizedBox(height: 6),
                const CommonText.regular(
                  'Withdrawals are enabled once funds move to your available balance.',
                  size: 12,
                  color: Color(0xff9A6700),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BalanceCard extends StatelessWidget {
  final String accountLabel;
  final String? balance;
  final String? availableForPayout;
  final String? pendingAmount;
  final bool isLoading;

  const _BalanceCard({
    required this.accountLabel,
    required this.balance,
    this.availableForPayout,
    this.pendingAmount,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 22),
      decoration: BoxDecoration(
        color: _MyWalletViewState._cardBg,
        borderRadius: BorderRadius.circular(AppRadius.xl),
        border: Border.all(color: const Color(0xffE8E8EF)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0D000000),
            blurRadius: 12,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            right: -8,
            top: 0,
            bottom: 0,
            child: Icon(
              Icons.account_balance_wallet_outlined,
              size: 88,
              color: Colors.grey.shade300.withValues(alpha: 0.55),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CommonText.regular(
                accountLabel,
                size: 13,
                color: const Color(0xff6F7D8F),
              ),
              const SizedBox(height: 8),
              if (isLoading)
                SizedBox(
                  height: 38,
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: SpinKitThreeBounce(
                      color: context.colorScheme.primary,
                      size: 20,
                    ),
                  ),
                )
              else ...[
                CommonText.bold(balance ?? '—', size: 32, color: Colors.black),
                if (availableForPayout != null || pendingAmount != null) ...[
                  const SizedBox(height: 14),
                  if (availableForPayout != null)
                    _BalanceDetailRow(
                      label: 'Available to withdraw',
                      value: availableForPayout!,
                      valueColor: const Color(0xff15803D),
                    ),
                  if (pendingAmount != null) ...[
                    if (availableForPayout != null) const SizedBox(height: 8),
                    _BalanceDetailRow(
                      label: 'Pending (not withdrawable)',
                      value: pendingAmount!,
                      valueColor: const Color(0xff9A6700),
                    ),
                  ],
                ],
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _BalanceDetailRow extends StatelessWidget {
  final String label;
  final String value;
  final Color valueColor;

  const _BalanceDetailRow({
    required this.label,
    required this.value,
    required this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: CommonText.regular(
            label,
            size: 13,
            color: const Color(0xff6F7D8F),
          ),
        ),
        CommonText.semiBold(value, size: 14, color: valueColor),
      ],
    );
  }
}

class _WalletListTile extends StatelessWidget {
  final Widget leading;
  final String title;
  final VoidCallback onTap;

  const _WalletListTile({
    required this.leading,
    required this.title,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(AppRadius.xl),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.xl),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.xl),
            border: Border.all(color: const Color(0xffE8E8EF)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x0A000000),
                blurRadius: 8,
                offset: Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            children: [
              leading,
              const SizedBox(width: 14),
              Expanded(child: CommonText.semiBold(title, size: 16)),
              Icon(
                Icons.chevron_right_rounded,
                color: Colors.grey.shade700,
                size: 26,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
