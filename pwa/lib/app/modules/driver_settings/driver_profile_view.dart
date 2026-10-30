import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';

import '../../routes/app_pages.dart';
import '../../theme/design_tokens.dart';
import '../../constants/service_provider_labels.dart';
import '../../utils/extensions/extension.dart';
import '../../widgets/blurred_image_screen_header.dart';
import '../../widgets/button.dart';
import '../../widgets/image.dart';
import '../../utils/media_url.dart';
import '../../utils/document_display_name.dart';
import '../../utils/driver_onboarding_progress.dart';
import '../../utils/open_uploaded_document.dart';
import '../../widgets/text.dart';
import '../../network/response/profile_response.dart';
import '../driver_dashboard/driver_dashboard_controller.dart';
import 'driver_profile_controller.dart';

/// Driver profile (read-only) — uses app [ColorScheme] and typography (no HTML palette).
class DriverProfileView extends GetView<DriverProfileController> {
  const DriverProfileView({super.key});

  static String _disp(dynamic value) {
    if (value == null) return '—';
    if (value is bool) return value ? 'Yes' : 'No';
    final s = value.toString().trim();
    return s.isEmpty ? '—' : s;
  }

  static String? _formatYmd(String? iso) {
    if (iso == null || iso.trim().isEmpty) return null;
    final d = DateTime.tryParse(iso.trim());
    if (d == null) return iso.trim();
    return DateFormat('yyyy-MM-dd').format(d.toLocal());
  }

  static String _maskSsn(String? raw) {
    final digits = (raw ?? '').replaceAll(RegExp(r'\D'), '');
    if (digits.length != 9) return _disp(raw);
    return '${digits.substring(0, 3)}-${digits.substring(3, 5)}-${digits.substring(5)}';
  }

  TextStyle _text(
    BuildContext context, {
    double size = 14,
    FontWeight? weight,
    Color? color,
    double letterSpacing = 0,
    double? height,
  }) {
    final base =
        Theme.of(context).textTheme.bodyMedium ??
        Theme.of(context).textTheme.bodyLarge!;
    return base.copyWith(
      fontSize: size,
      fontWeight: weight,
      color: color ?? context.colorScheme.onSurface,
      letterSpacing: letterSpacing,
      height: height != null ? height / size : null,
    );
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colorScheme;

    return Scaffold(
      backgroundColor: cs.surface,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          BlurredImageScreenHeader(
            title: ServiceProviderLabels.profileTitle,
            titleSize: 18,
            onBack: Get.back,
            trailing: HeaderCircleIconButton(
              icon: Icons.settings_outlined,
              iconSize: 20,
              onTap: () => Get.toNamed(Routes.DRIVER_PROFILE_SETTINGS),
            ),
          ),
          Expanded(
            child: Obx(() {
              if (controller.isLoading.value) {
                return Center(
                  child: CircularProgressIndicator(color: cs.primary),
                );
              }
              if (controller.errorMessage.value.isNotEmpty) {
                return Padding(
                  padding: const EdgeInsets.all(AppSpacing.xl),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      CommonText.regular(
                        controller.errorMessage.value,
                        textAlign: TextAlign.center,
                        color: cs.onSurfaceVariant,
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      AppButton(
                        label: 'Retry',
                        type: ButtonType.outline,
                        isMax: false,
                        bgColor: cs.surfaceContainer,
                        onPressed: controller.loadProfile,
                      ),
                    ],
                  ),
                );
              }
              final data = controller.profileData.value;
              if (data == null) {
                return Center(
                  child: CommonText.regular(
                    'No profile data',
                    color: cs.onSurfaceVariant,
                  ),
                );
              }

              final user = data.user;
              final dp = data.driverProfile;
              final step1 = dp?.step(1);
              final step2 = dp?.step(2);
              final step3 = dp?.step(3);
              final step4 = dp?.step(4);
              final step5 = dp?.step(5);
              final step8 = dp?.step(8);
              final backgroundCheckSigned =
                  step5?['background_check_signed_form']?.toString() ??
                  step8?['background_check_signed_form']?.toString();

              final avatar = (dp?.profilePicture ?? user?.profilePicture ?? '')
                  .trim();
              final displayName = (user?.name ?? '').trim();
              final verified = user?.isVerified == true;
              final onboardingProgress = DriverOnboardingProgress.fromProfile(
                profile: dp,
                apiTotalSteps: data.onboarding?.totalSteps,
              );
              final completedYmd = _formatYmd(dp?.completedAt);

              final make = _disp(step4?['vehicle_make']);
              final model = _disp(step4?['vehicle_model']);
              final year = _disp(step4?['vehicle_year']);
              final vType = _disp(step4?['vehicle_type']);
              final vColor = _disp(step4?['vehicle_color']);
              final plate = _disp(step4?['vehicle_license_plate']);
              final vehicleTitle = [
                if (make != '—') make,
                if (model != '—') model,
                if (year != '—') year,
              ].join(' ');
              final vehicleSubtitle = [
                if (vType != '—') vType,
                if (vColor != '—') vColor,
              ].join(' • ');
              final fuelRaw = _disp(step4?['fuel_type']);

              final termsOk = step1?['agreed_to_terms'] == true;

              return RefreshIndicator(
                color: cs.primary,
                onRefresh: controller.loadProfile,
                child: SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _profileHeader(
                        context,
                        avatar,
                        displayName.isEmpty
                            ? ServiceProviderLabels.fallbackName
                            : displayName,
                        verified,
                      ),
                      // ── License expiration banner ──────────────────────────────────
                      Obx(() {
                        final dash = Get.isRegistered<DriverDashboardController>()
                            ? Get.find<DriverDashboardController>()
                            : null;

                        var showBanner =
                            dash?.shouldShowDriverLicenseComplianceBanner ??
                                false;
                        var blocked =
                            dash?.isDriverLicenseAcceptBlocked ?? false;
                        var body = dash?.driverLicenseComplianceBannerMessage ??
                            '';

                        if (!showBanner) {
                          final dp = controller.profileData.value?.driverProfile;
                          final ymd = dp?.resolvedLicenseExpirationDate;
                          final days = DriverProfile.daysUntilExpirationIso(ymd);
                          if (days != null && days < 0) {
                            showBanner = true;
                            blocked = true;
                            body =
                                'Your driver license has expired. Your account is suspended until you upload a renewed license. You cannot accept new service requests.';
                          } else if (days != null && days <= 30) {
                            showBanner = true;
                            blocked = false;
                            final exp = ymd ?? '';
                            if (days == 0) {
                              body =
                                  'Your driver license expires today ($exp). Upload a renewed license now to avoid account suspension.';
                            } else if (days == 1) {
                              body =
                                  'Your driver license expires tomorrow ($exp). Renew it now to avoid account suspension.';
                            } else {
                              body =
                                  'Your driver license expires on $exp ($days days left). Renew it before expiration to avoid account suspension.';
                            }
                          }
                        }

                        if (!showBanner) {
                          return const SizedBox.shrink();
                        }

                        final bgColor = blocked
                            ? const Color(0xFFFEE2E2)
                            : const Color(0xFFFFF3CD);
                        final borderColor = blocked
                            ? const Color(0xFFF87171)
                            : const Color(0xFFFFBF00);
                        final iconColor = blocked
                            ? const Color(0xFFB91C1C)
                            : const Color(0xFF92400E);
                        final textColor = blocked
                            ? const Color(0xFF7F1D1D)
                            : const Color(0xFF78350F);
                        final headline = blocked
                            ? 'Driver license expired — account suspended'
                            : 'Driver license expiring soon';
                        return Container(
                          margin: const EdgeInsets.only(
                            top: AppSpacing.lg,
                            bottom: AppSpacing.sm,
                          ),
                          padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
                          decoration: BoxDecoration(
                            color: bgColor,
                            borderRadius: BorderRadius.circular(12),
                            border:
                                Border.all(color: borderColor, width: 1),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Row(
                                crossAxisAlignment:
                                    CrossAxisAlignment.start,
                                children: [
                                  Icon(
                                    blocked
                                        ? Icons.error_outline_rounded
                                        : Icons.warning_amber_rounded,
                                    color: iconColor,
                                    size: 20,
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        CommonText.bold(
                                          headline,
                                          size: 13,
                                          color: textColor,
                                        ),
                                        const SizedBox(height: 4),
                                        CommonText.regular(
                                          body,
                                          size: 12,
                                          color: textColor,
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 10),
                              AppButton(
                                label: blocked
                                    ? 'Upload Renewed License'
                                    : 'Renew License Now',
                                onPressed: dash?.openDriverLicenseRenewal ??
                                    () => Get.toNamed(Routes.UPLOAD_DRIVER_LICENSE),
                                bgColor: blocked
                                    ? const Color(0xFFB91C1C)
                                    : const Color(0xFF92400E),
                                txtColor: Colors.white,
                                btnCornerRadius: 10,
                                vPadding: 10,
                                textSize: 13,
                              ),
                            ],
                          ),
                        );
                      }),
                      // ───────────────────────────────────────────────────────────────
                      const SizedBox(height: AppSpacing.xxl),
                      _sectionTitle(context, 'Onboarding Status'),
                      const SizedBox(height: AppSpacing.md),
                      _onboardingCard(
                        context,
                        onboardingProgress,
                        completedYmd,
                      ),
                      const SizedBox(height: AppSpacing.xxl),
                      _ProfileAccordionCard(
                        title: 'Account Details',
                        subtitle: 'Tap to view email, phone, and profile info',
                        icon: Icons.person_outline_rounded,
                        child: _accountCard(context, [
                          ('Email Address', _disp(user?.email)),
                          ('Phone Number', _disp(user?.phone)),
                          // Show a formatted reference instead of the raw DB primary key.
                          (ServiceProviderLabels.idLabel,
                              user?.id != null
                                  ? 'SP-${user!.id.toString().padLeft(6, '0')}'
                                  : '—'),
                          // Personal-info fields: driver signup stores in step 2,
                          // admin panel stores in step 1 — fall back to the other.
                          ('Date of Birth',
                              _disp(step2?['date_of_birth'] ?? step1?['date_of_birth'])),
                          ('Address',
                              _disp(step2?['address'] ?? step1?['address'])),
                          ('Social Security #',
                              _maskSsn((step2?['social_security_number'] ??
                                      step1?['social_security_number'])
                                  ?.toString())),
                          ('T-Shirt Size',
                              _disp(step2?['tshirt_size'] ?? step1?['tshirt_size'])),
                          ('Driver License #', _disp(step3?['drivers_license_number'])),
                          ('License Issued',
                              _disp(step3?['drivers_license_issued_date'])),
                          ('License Expires',
                              _disp(step3?['drivers_license_expiration_date'])),
                        ]),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      _ProfileAccordionCard(
                        title: 'Vehicle Details',
                        subtitle: 'Tap to view vehicle info',
                        icon: Icons.directions_car_outlined,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            _vehicleCard(
                              context,
                              vehicleTitle.isEmpty ? '—' : vehicleTitle,
                              vehicleSubtitle.isEmpty ? '—' : vehicleSubtitle,
                              plate,
                              fuelRaw == '—' ? 'Gasoline' : fuelRaw,
                              embedded: true,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      _ProfileAccordionCard(
                        title: 'Documents',
                        subtitle: 'Tap to view license and background check files',
                        icon: Icons.folder_open_outlined,
                        child: _documentsGrid(
                          context,
                          step3?['drivers_license_front']?.toString(),
                          step3?['drivers_license_back']?.toString(),
                          backgroundCheckSigned,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xl),
                      _termsBar(context, termsOk),
                    ],
                  ),
                ),
              );
            }),
          ),
        ],
      ),
    );
  }

  Widget _sectionTitle(BuildContext context, String title) {
    return Padding(
      padding: const EdgeInsets.only(left: AppSpacing.xs),
      child: Text(
        title,
        style: _text(
          context,
          size: 18,
          weight: FontWeight.w600,
          color: context.colorScheme.onSurface,
          height: 24,
        ),
      ),
    );
  }

  Widget _profileHeader(
    BuildContext context,
    String avatarUrl,
    String name,
    bool verified,
  ) {
    final cs = context.colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
      child: Column(
        children: [
          Center(
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  width: 120,
                  height: 120,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: const Color(0xffDADAE1),
                      width: 2,
                    ),
                  ),
                  child: ClipOval(
                    child: avatarUrl.isNotEmpty
                        ? ImageFromNetwork(
                            avatarUrl,
                            fit: BoxFit.cover,
                            width: 120,
                            height: 120,
                            isAvatar: true,
                            placeholderWidget: Container(
                              color: cs.surfaceContainerHighest,
                              child: Icon(
                                Icons.person_rounded,
                                size: 48,
                                color: cs.onSurfaceVariant,
                              ),
                            ),
                          )
                        : Container(
                            color: cs.surfaceContainerHighest,
                            child: Icon(
                              Icons.person_rounded,
                              size: 48,
                              color: cs.onSurfaceVariant,
                            ),
                          ),
                  ),
                ),
                if (verified)
                  Positioned(
                    right: 4,
                    bottom: 4,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: cs.primary,
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: cs.surfaceContainer,
                          width: 2,
                        ),
                      ),
                      child: Icon(
                        Icons.check_rounded,
                        color: cs.onPrimary,
                        size: 16,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Text(
            name,
            textAlign: TextAlign.center,
            style: _text(
              context,
              size: 24,
              weight: FontWeight.w700,
              height: 32,
            ),
          ),
          if (verified) ...[
            const SizedBox(height: AppSpacing.sm),
            Center(
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md,
                  vertical: AppSpacing.xs,
                ),
                decoration: BoxDecoration(
                  color: cs.primaryContainer,
                  borderRadius: BorderRadius.circular(AppRadius.xxl),
                ),
                child: Text(
                  'VERIFIED DRIVER',
                  style: _text(
                    context,
                    size: 12,
                    weight: FontWeight.w600,
                    color: cs.onPrimaryContainer,
                    letterSpacing: 0.6,
                    height: 16,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _onboardingCard(
    BuildContext context,
    DriverOnboardingProgress progress,
    String? completedDate,
  ) {
    final displayStep = progress.displayStep;
    final totalSteps = progress.totalSteps;
    final progressValue = progress.progress;
    final isComplete = progress.isOnboardingComplete;
    final stepLabel = isComplete
        ? 'All $totalSteps steps complete'
        : 'Step $displayStep of $totalSteps';
    final cs = context.colorScheme;
    return Container(
      width: double.infinity,
      padding: AppInsets.card,
      decoration: BoxDecoration(
        color: cs.surfaceContainer,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: cs.outlineVariant),
        boxShadow: [
          BoxShadow(
            color: cs.shadow.withValues(alpha: 0.06),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(AppSpacing.sm),
                      decoration: BoxDecoration(
                        color: cs.primaryContainer.withValues(alpha: 0.6),
                        borderRadius: BorderRadius.circular(AppRadius.sm),
                      ),
                      child: Icon(
                        Icons.assignment_turned_in_rounded,
                        color: cs.primary,
                        size: 24,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'PROGRESS',
                            style: _text(
                              context,
                              size: 12,
                              weight: FontWeight.w600,
                              color: cs.onSurfaceVariant,
                              letterSpacing: 0.6,
                              height: 16,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            stepLabel,
                            style: _text(
                              context,
                              size: 15,
                              weight: FontWeight.w500,
                              height: 22,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    'COMPLETED',
                    style: _text(
                      context,
                      size: 12,
                      weight: FontWeight.w600,
                      color: cs.onSurfaceVariant,
                      letterSpacing: 0.6,
                      height: 16,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    completedDate ?? '—',
                    style: _text(
                      context,
                      size: 15,
                      weight: FontWeight.w500,
                      color: cs.primary,
                      height: 22,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: progressValue,
              minHeight: 8,
              backgroundColor: cs.surfaceContainerHighest,
              color: cs.primary,
            ),
          ),
          if (!isComplete) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Complete all steps to go live.',
              style: _text(
                context,
                size: 12,
                color: cs.onSurfaceVariant,
                height: 16,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _accountCard(BuildContext context, List<(String, String)> rows) {
    final cs = context.colorScheme;
    return Column(
      children: [
        for (int i = 0; i < rows.length; i++) ...[
          if (i > 0) Divider(height: 1, thickness: 1, color: cs.outlineVariant),
          Padding(
            padding: AppInsets.card,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    rows[i].$1,
                    style: _text(
                      context,
                      size: 14,
                      color: cs.onSurfaceVariant,
                      height: 20,
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Flexible(
                  child: Text(
                    rows[i].$2,
                    textAlign: TextAlign.right,
                    style: _text(
                      context,
                      size: 15,
                      weight: FontWeight.w500,
                      height: 22,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _vehicleCard(
    BuildContext context,
    String title,
    String subtitle,
    String plate,
    String fuelType, {
    bool embedded = false,
  }) {
    final cs = context.colorScheme;
    final plateStyle = _text(
      context,
      size: 15,
      weight: FontWeight.w700,
      letterSpacing: 1.1,
      height: 22,
    );

    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: cs.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(AppRadius.sm),
              ),
              child: Icon(
                Icons.directions_car_rounded,
                size: 32,
                color: cs.onSurfaceVariant,
              ),
            ),
            const SizedBox(width: AppSpacing.lg),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: _text(
                      context,
                      size: 18,
                      weight: FontWeight.w600,
                      height: 24,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: _text(
                      context,
                      size: 14,
                      color: cs.onSurfaceVariant,
                      height: 20,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        Row(
          children: [
            Expanded(
              child: _miniMetric(
                context,
                label: 'PLATE NUMBER',
                child: Text(plate, style: plateStyle),
              ),
            ),
            const SizedBox(width: AppSpacing.lg),
            Expanded(
              child: _miniMetric(
                context,
                label: 'FUEL TYPE',
                child: Text(
                  fuelType,
                  style: _text(
                    context,
                    size: 15,
                    weight: FontWeight.w500,
                    height: 22,
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );

    if (embedded) {
      return Padding(padding: AppInsets.card, child: content);
    }

    return Container(
      width: double.infinity,
      padding: AppInsets.card,
      decoration: BoxDecoration(
        color: cs.surfaceContainer,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: cs.outlineVariant),
      ),
      child: content,
    );
  }

  Widget _miniMetric(
    BuildContext context, {
    required String label,
    required Widget child,
  }) {
    final cs = context.colorScheme;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: cs.surfaceContainerLow,
        borderRadius: BorderRadius.circular(AppRadius.sm),
        border: Border.all(color: cs.outlineVariant.withValues(alpha: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: _text(
              context,
              size: 10,
              weight: FontWeight.w600,
              color: cs.onSurfaceVariant,
              letterSpacing: 0.5,
              height: 14,
            ),
          ),
          const SizedBox(height: 4),
          child,
        ],
      ),
    );
  }

  Widget _documentsGrid(
    BuildContext context,
    String? licenseFront,
    String? licenseBack,
    String? backgroundCheckSigned,
  ) {
    return Padding(
      padding: AppInsets.card,
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _docSlot(
                  context,
                  label: 'LICENSE FRONT',
                  url: licenseFront,
                  emptyIcon: Icons.badge_outlined,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: _docSlot(
                  context,
                  label: 'LICENSE BACK',
                  url: licenseBack,
                  emptyIcon: Icons.badge_outlined,
                ),
              ),
            ],
          ),
          if ((backgroundCheckSigned ?? '').trim().isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            _docSlot(
              context,
              label: 'BACKGROUND CHECK (SIGNED PDF)',
              url: backgroundCheckSigned,
              emptyIcon: Icons.picture_as_pdf_outlined,
              isPdf: true,
            ),
          ],
        ],
      ),
    );
  }

  Widget _docSlot(
    BuildContext context, {
    required String label,
    required String? url,
    IconData emptyIcon = Icons.add_photo_alternate_outlined,
    bool isPdf = false,
  }) {
    final cs = context.colorScheme;
    final resolved = MediaUrl.resolve(url);
    final has = resolved.isNotEmpty;
    final showAsPdf = isPdf || MediaUrl.isPdf(resolved);
    final displayName = formatDocumentDisplayName(label);

    return AspectRatio(
      aspectRatio: 3 / 2,
      child: Material(
        color: cs.surfaceContainer,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          side: BorderSide(
            color: has ? cs.outlineVariant : cs.outline,
            width: has ? 1 : 2,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: has
              ? () => openUploadedDocument(
                    url,
                    title: label,
                  )
              : null,
          child: has
              ? Stack(
                  fit: StackFit.expand,
                  children: [
                    if (showAsPdf)
                      ColoredBox(
                        color: cs.surfaceContainerHigh,
                        child: Center(
                          child: Icon(
                            Icons.picture_as_pdf_rounded,
                            size: 40,
                            color: cs.error,
                          ),
                        ),
                      )
                    else
                      ImageFromNetwork(
                        resolved,
                        fit: BoxFit.cover,
                        width: double.infinity,
                        height: double.infinity,
                        placeholderWidget: Container(
                          color: cs.surfaceContainerLow,
                        ),
                      ),
                    Positioned(
                      left: 0,
                      right: 0,
                      bottom: 0,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.bottomCenter,
                            end: Alignment.topCenter,
                            colors: [
                              Colors.black.withValues(alpha: 0.75),
                              Colors.transparent,
                            ],
                          ),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(
                            AppSpacing.sm,
                            AppSpacing.lg,
                            AppSpacing.sm,
                            AppSpacing.sm,
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  displayName,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: _text(
                                    context,
                                    size: 11,
                                    weight: FontWeight.w600,
                                    color: Colors.white,
                                    height: 14,
                                  ),
                                ),
                              ),
                              const SizedBox(width: AppSpacing.xs),
                              Icon(
                                showAsPdf
                                    ? Icons.open_in_new_rounded
                                    : Icons.visibility_rounded,
                                color: Colors.white,
                                size: 20,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                )
              : CustomPaint(
                  painter: _DashedRoundedPainter(
                    color: cs.outlineVariant,
                    radius: AppRadius.sm,
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(emptyIcon, size: 32, color: cs.outline),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        displayName,
                        textAlign: TextAlign.center,
                        style: _text(
                          context,
                          size: 10,
                          weight: FontWeight.w600,
                          color: cs.outline,
                          height: 14,
                        ),
                      ),
                    ],
                  ),
                ),
        ),
      ),
    );
  }

  Widget _termsBar(BuildContext context, bool agreed) {
    final cs = context.colorScheme;
    return Container(
      padding: AppInsets.card,
      decoration: BoxDecoration(
        color: cs.surfaceContainerHighest.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: cs.outlineVariant),
      ),
      child: Row(
        children: [
          Icon(
            Icons.gavel_rounded,
            color: agreed ? cs.primary : cs.onSurfaceVariant,
            size: 24,
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(
              agreed
                  ? 'Terms and conditions agreed'
                  : 'Agreement pending review',
              style: _text(context, size: 14, height: 20),
            ),
          ),
          Icon(
            agreed ? Icons.check_circle : Icons.pending_outlined,
            color: agreed ? cs.primary : cs.onSurfaceVariant,
            size: 24,
          ),
        ],
      ),
    );
  }
}

class _ProfileAccordionCard extends StatefulWidget {
  const _ProfileAccordionCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.child,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final Widget child;

  @override
  State<_ProfileAccordionCard> createState() => _ProfileAccordionCardState();
}

class _ProfileAccordionCardState extends State<_ProfileAccordionCard> {
  bool _expanded = false;

  TextStyle _headerText(
    BuildContext context, {
    required double size,
    FontWeight? weight,
    Color? color,
    double? height,
  }) {
    final base =
        Theme.of(context).textTheme.bodyMedium ??
        Theme.of(context).textTheme.bodyLarge!;
    final cs = Theme.of(context).colorScheme;
    return base.copyWith(
      fontSize: size,
      fontWeight: weight,
      color: color ?? cs.onSurface,
      height: height != null ? height / size : null,
    );
  }

  @override
  Widget build(BuildContext context) {
    final cs = context.colorScheme;

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: cs.surfaceContainer,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: cs.outlineVariant),
        boxShadow: [
          BoxShadow(
            color: cs.shadow.withValues(alpha: 0.06),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () => setState(() => _expanded = !_expanded),
              child: Padding(
                padding: AppInsets.card,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(AppSpacing.sm),
                      decoration: BoxDecoration(
                        color: cs.primaryContainer.withValues(alpha: 0.55),
                        borderRadius: BorderRadius.circular(AppRadius.sm),
                      ),
                      child: Icon(widget.icon, color: cs.primary, size: 22),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.title,
                            style: _headerText(
                              context,
                              size: 16,
                              weight: FontWeight.w600,
                              height: 22,
                            ),
                          ),
                          if (!_expanded) ...[
                            const SizedBox(height: 2),
                            Text(
                              widget.subtitle,
                              style: _headerText(
                                context,
                                size: 13,
                                color: cs.onSurfaceVariant,
                                height: 18,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    AnimatedRotation(
                      turns: _expanded ? 0.5 : 0,
                      duration: const Duration(milliseconds: 200),
                      child: Icon(
                        Icons.keyboard_arrow_down_rounded,
                        color: cs.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          AnimatedSize(
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeInOut,
            alignment: Alignment.topCenter,
            child: _expanded
                ? Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Divider(height: 1, thickness: 1, color: cs.outlineVariant),
                      widget.child,
                    ],
                  )
                : const SizedBox(width: double.infinity),
          ),
        ],
      ),
    );
  }
}

class _DashedRoundedPainter extends CustomPainter {
  _DashedRoundedPainter({required this.color, required this.radius});

  final Color color;
  final double radius;

  @override
  void paint(Canvas canvas, Size size) {
    final r = RRect.fromRectAndRadius(
      Offset.zero & size,
      Radius.circular(radius),
    );
    final path = Path()..addRRect(r);
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1.2
      ..style = PaintingStyle.stroke;
    const dash = 5.0;
    const gap = 4.0;
    for (final m in path.computeMetrics()) {
      var d = 0.0;
      while (d < m.length) {
        final len = dash.clamp(0.0, m.length - d);
        canvas.drawPath(m.extractPath(d, d + len), paint);
        d += dash + gap;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DashedRoundedPainter oldDelegate) =>
      oldDelegate.color != color || oldDelegate.radius != radius;
}
