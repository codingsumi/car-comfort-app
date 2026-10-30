import 'dart:async';

import 'package:car_comfort/app/utils/extensions/extension.dart';
import 'package:car_comfort/app/widgets/blurred_image_screen_header.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';

import '../../network/repository/auth_repository.dart';
import '../../network/response/profile_response.dart';
import '../../services/booking_live_socket_service.dart';
import '../../services/driver_dashboard_socket_service.dart';
import '../../services/onesignal_service.dart';
import '../../utils/app_snackbar.dart';
import '../../utils/pref.dart';
import '../../widgets/button.dart';
import '../../widgets/text.dart';
import '../../widgets/text_field.dart';

class AccountDeletionRequestView extends StatefulWidget {
  const AccountDeletionRequestView({super.key});

  @override
  State<AccountDeletionRequestView> createState() =>
      _AccountDeletionRequestViewState();
}

class _AccountDeletionRequestViewState
    extends State<AccountDeletionRequestView> {
  final TextEditingController _reasonController = TextEditingController();
  final AuthRepository _authRepository = Get.isRegistered<AuthRepository>()
      ? Get.find<AuthRepository>()
      : Get.put(AuthRepository());
  bool _submitting = false;
  bool _loadingProfile = true;
  AccountDeletionRequestInfo? _existingRequest;

  @override
  void initState() {
    super.initState();
    unawaited(_loadDeletionRequestState());
  }

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_existingRequest?.isOpen == true) return;
    final reason = _reasonController.text.trim();
    if (reason.isEmpty) {
      showAppSnackBar(
        title: 'Account deletion',
        message: 'Please enter a reason for deletion.',
        isError: true,
      );
      return;
    }

    setState(() => _submitting = true);
    final result = await _authRepository.submitAccountDeletionRequest(
      reason: reason,
    );
    if (!mounted) return;
    setState(() => _submitting = false);

    result.when(
      success: (res) {
        _reasonController.clear();
        showAppSnackBar(
          title: 'Account deletion',
          message:
              res.message ?? 'Your account deletion request was submitted.',
        );
        unawaited(_closeAppAfterSubmission());
      },
      error: (err) {
        showAppSnackBar(
          title: 'Account deletion',
          message: err.message,
          isError: true,
        );
      },
    );
  }

  Future<void> _loadDeletionRequestState() async {
    final result = Prefs().isDriverRole
        ? await _authRepository.getDriverMe()
        : await _authRepository.getCustomerMe();
    if (!mounted) return;
    result.when(
      success: (res) {
        setState(() {
          _existingRequest = res.data?.accountDeletionRequest;
          _loadingProfile = false;
        });
      },
      error: (_) {
        setState(() => _loadingProfile = false);
      },
    );
  }

  Future<void> _closeAppAfterSubmission() async {
    await Future<void>.delayed(const Duration(milliseconds: 900));
    if (Get.isRegistered<BookingLiveSocketService>()) {
      await Get.find<BookingLiveSocketService>().disconnect();
    }
    if (Get.isRegistered<DriverDashboardSocketService>()) {
      await Get.find<DriverDashboardSocketService>().disconnect();
    }
    await OneSignalService.logout();
    await Prefs().clear();
    await SystemNavigator.pop();
  }

  Widget _buildRequestContent(BuildContext context, {required bool isPwa}) {
    final requestForm = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_loadingProfile) ...[
          const LinearProgressIndicator(minHeight: 2),
          const SizedBox(height: 16),
        ],
        CommonText.regular(
          'We will review your request and suspend your account after approval. You cannot submit this request while a booking is pending or in progress, and only one request can stay pending at a time.',
          color: const Color(0xff6E6E78),
          size: 14,
        ),
        const SizedBox(height: 18),
        if (_existingRequest?.isOpen == true)
          _SubmittedRequestCard(request: _existingRequest!)
        else ...[
          const SizedBox(height: 8),
          CommonTextField(
            controller: _reasonController,
            hintText: 'Tell us why you want to delete your account',
            labelText: 'Reason for deletion',
            textColor: context.colorScheme.onSurface,
            labelColor: context.colorScheme.onSurface,
            hintColor: context.colorScheme.outlineVariant,
            maxLines: 7,
            minLines: 5,
            keyboardType: TextInputType.multiline,
            inputAction: TextInputAction.newline,
            bgColor: isPwa ? Colors.white : Colors.transparent,
            borderColor: context.colorScheme.outlineVariant,
          ),
          const SizedBox(height: 22),
          AppButton(
            label: _submitting ? 'Submitting...' : 'Submit Request',
            onPressed: _submitting || _loadingProfile ? null : _submit,
            btnCornerRadius: 14,
          ),
        ],
      ],
    );

    if (!isPwa) return requestForm;

    return Container(
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xffE8E8EF)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x12000000),
            blurRadius: 24,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(
                Icons.delete_outline_rounded,
                color: Color(0xffC4101F),
                size: 24,
              ),
              SizedBox(width: 10),
              CommonText.bold(
                'Delete your account',
                size: 22,
                color: Color(0xff1C1C1E),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const CommonText.regular(
            'This action starts a review request. Your account is not deleted immediately.',
            size: 14,
            color: Color(0xff6E6E78),
          ),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: Divider(height: 1, color: Color(0xffE8E8EF)),
          ),
          requestForm,
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isPwa = kIsWeb && MediaQuery.sizeOf(context).width >= 800;
    return Scaffold(
      backgroundColor: const Color(0xffFAFAFA),
      body: Column(
        children: [
          BlurredImageScreenHeader(title: "Delete Account"),
          Expanded(
            child: SingleChildScrollView(
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              padding: EdgeInsets.fromLTRB(
                isPwa ? 32 : 20,
                isPwa ? 40 : 22,
                isPwa ? 32 : 20,
                24 + MediaQuery.viewInsetsOf(context).bottom,
              ),
              child: Center(
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    maxWidth: isPwa ? 760 : double.infinity,
                  ),
                  child: _buildRequestContent(context, isPwa: isPwa),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SubmittedRequestCard extends StatelessWidget {
  const _SubmittedRequestCard({required this.request});

  final AccountDeletionRequestInfo request;

  @override
  Widget build(BuildContext context) {
    final status = (request.status ?? 'pending').replaceAll('_', ' ');
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xffFFF7E8),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xffF4C56A)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.hourglass_top_rounded, color: Color(0xffB7791F)),
              const SizedBox(width: 10),
              Expanded(
                child: CommonText.medium(
                  'Request already submitted',
                  size: 16,
                  color: const Color(0xff5F370E),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          CommonText.regular(
            'Your account deletion request is under review. You can submit another request only after this one is approved or rejected.',
            size: 13,
            color: const Color(0xff6E4A18),
          ),
          const SizedBox(height: 12),
          CommonText.medium(
            'Status: ${status[0].toUpperCase()}${status.substring(1)}',
            size: 13,
            color: const Color(0xff5F370E),
          ),
          if ((request.reason ?? '').trim().isNotEmpty) ...[
            const SizedBox(height: 8),
            CommonText.regular(
              'Reason: ${request.reason!.trim()}',
              size: 13,
              color: const Color(0xff6E4A18),
            ),
          ],
        ],
      ),
    );
  }
}
