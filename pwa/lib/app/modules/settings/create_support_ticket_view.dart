import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../gen/assets.gen.dart';
import '../../utils/web_navigation.dart';
import '../../widgets/text.dart';
import '../driver_dashboard/driver_header_back_button.dart';
import 'create_support_ticket_controller.dart';

class CreateSupportTicketView extends GetView<CreateSupportTicketController> {
  const CreateSupportTicketView({super.key});

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    return Scaffold(
      backgroundColor: const Color(0xffFAFAFA),
      body: Column(
        children: [
          _Header(onBack: goBackToHome),
          Expanded(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(16, 20, 16, 24 + bottomInset),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const CommonText.regular(
                    'Tell us what you need help with. Our team will reply in this ticket thread.',
                    size: 13,
                    color: Color(0xff8B8B8B),
                  ),
                  const SizedBox(height: 20),
                  const CommonText.medium('Subject', size: 13),
                  const SizedBox(height: 8),
                  TextField(
                    controller: controller.subjectController,
                    textInputAction: TextInputAction.next,
                    maxLength: 255,
                    decoration: _inputDecoration(hint: 'Brief summary'),
                  ),
                  const SizedBox(height: 16),
                  const CommonText.medium('Message', size: 13),
                  const SizedBox(height: 8),
                  TextField(
                    controller: controller.messageController,
                    minLines: 5,
                    maxLines: 10,
                    decoration: _inputDecoration(
                      hint: 'Describe your issue in detail',
                    ),
                  ),
                  const SizedBox(height: 24),
                  Obx(
                    () => SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: FilledButton(
                        onPressed: controller.isSubmitting.value
                            ? null
                            : controller.submit,
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xffE70B1C),
                          disabledBackgroundColor: const Color(
                            0xffE70B1C,
                          ).withValues(alpha: 0.5),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: controller.isSubmitting.value
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const CommonText.semiBold(
                                'Submit ticket',
                                size: 15,
                                color: Colors.white,
                              ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  static InputDecoration _inputDecoration({required String hint}) {
    return InputDecoration(
      hintText: hint,
      filled: true,
      fillColor: Colors.white,
      counterText: '',
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xffE8E8EF)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xffE8E8EF)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xffE70B1C)),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.onBack});

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return ClipRRect(
      borderRadius: const BorderRadius.vertical(bottom: Radius.circular(20)),
      child: SizedBox(
        height: top + 66,
        child: Stack(
          fit: StackFit.expand,
          children: [
            Assets.imagesHomeHBg.image(fit: BoxFit.cover),
            Container(color: Colors.black.withValues(alpha: 0.45)),
            Padding(
              padding: EdgeInsets.fromLTRB(14, top + 12, 14, 8),
              child: Row(
                children: [
                  DriverHeaderBackButton(onTap: onBack),
                  const SizedBox(width: 10),
                  const Expanded(
                    child: CommonText.regular(
                      'New support ticket',
                      color: Colors.white,
                      size: 16,
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
