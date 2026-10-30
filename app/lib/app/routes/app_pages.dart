import 'package:flutter/widgets.dart';

import 'package:get/get.dart';

import '../modules/auth/auth_binding.dart';
import '../modules/auth/camera_access_view.dart';
import '../modules/auth/customer/register_view.dart';
import '../modules/auth/driver/add_vehicle_information_view.dart';
import '../modules/auth/driver/approval_process_review_view.dart';
import '../modules/auth/driver/approve_complete_view.dart';
import '../modules/auth/driver/background_check_view.dart';
import '../modules/auth/driver/driver_otp_view.dart';
import '../modules/auth/driver/driver_register_view.dart';
import '../modules/auth/driver/driver_signup_binding.dart';
import '../modules/auth/driver/driver_tshirt_size_view.dart';
import '../modules/auth/driver/redirect_to_background_check_view.dart';
import '../modules/auth/driver/upload_driver_license_view.dart';
import '../modules/auth/forgot_password_view.dart';
import '../modules/auth/location_access_view.dart';
import '../modules/auth/login_view.dart';
import '../modules/auth/otp_view.dart';
import '../modules/auth/reset_password_view.dart';
import '../modules/auth/tutorial_binding.dart';
import '../modules/auth/tutorial_view.dart';
import '../modules/auth/welcome_to_car_comfort_view.dart';
import '../modules/auth/welcome_view.dart';
import '../modules/dashboard/dashboard_binding.dart';
import '../modules/dashboard/dashboard_view.dart';
import '../modules/dashboard/my_bookings_view.dart';
import '../modules/dashboard/service_detail_view.dart';
import '../modules/dashboard/service_provider_profile_view.dart';
import '../modules/driver_dashboard/about_service_view.dart';
import '../modules/driver_dashboard/booking_chat_binding.dart';
import '../modules/driver_dashboard/car_details_view.dart';
import '../modules/driver_dashboard/chat_view.dart';
import '../modules/driver_dashboard/driver_completed_bookings_view.dart';
import '../modules/driver_dashboard/driver_dashboard_binding.dart';
import '../modules/driver_dashboard/driver_dashboard_view.dart';
import '../modules/driver_dashboard/driver_payment_history_binding.dart';
import '../modules/driver_dashboard/driver_payment_history_view.dart';
import '../modules/driver_dashboard/driver_payment_method_view.dart';
import '../modules/driver_dashboard/driver_service_detail_view.dart';
import '../modules/driver_settings/driver_notifications_view.dart';
import '../modules/driver_settings/driver_privacy_terms_binding.dart';
import '../modules/driver_settings/driver_privacy_terms_view.dart';
import '../modules/driver_settings/driver_profile_binding.dart';
import '../modules/driver_settings/driver_profile_settings_view.dart';
import '../modules/driver_settings/driver_profile_view.dart';
import '../modules/driver_settings/driver_settings_builder.dart';
import '../modules/driver_settings/driver_support_binding.dart';
import '../modules/driver_settings/driver_support_view.dart';
import '../modules/onboarding/onboarding_binding.dart';
import '../modules/onboarding/onboarding_view.dart';
import '../modules/service_booking/service_booking_binding.dart';
import '../modules/service_booking/service_booking_view.dart';
import '../modules/settings/account_deletion_request_view.dart';
import '../modules/settings/create_support_ticket_view.dart';
import '../modules/settings/customer_profile_view.dart';
import '../modules/settings/legal_document_view.dart';
import '../modules/settings/legal_page_binding.dart';
import '../modules/settings/need_help_view.dart';
import '../modules/settings/notifications_view.dart';
import '../modules/settings/payment_method_view.dart';
import '../modules/settings/payment_methods_binding.dart';
import '../modules/settings/profile_settings_view.dart';
import '../modules/settings/refer_earn_view.dart';
import '../modules/settings/customer_billing_history_binding.dart';
import '../modules/settings/customer_billing_history_view.dart';
import '../modules/settings/customer_invoice_detail_binding.dart';
import '../modules/settings/customer_invoice_detail_view.dart';
import '../modules/settings/customer_tutorial_library_binding.dart';
import '../modules/settings/customer_tutorial_library_view.dart';
import '../modules/driver_settings/driver_learning_library_binding.dart';
import '../modules/driver_settings/driver_learning_library_view.dart';
import '../modules/settings/settings_binding.dart';
import '../modules/settings/settings_view.dart';
import '../modules/settings/customer_media_report_view.dart';
import '../modules/settings/support_binding.dart';
import '../modules/settings/support_ticket_detail_view.dart';
import '../modules/settings/support_tickets_list_view.dart';
import '../modules/settings/terms_privacy_view.dart';
import '../modules/maintenance/maintenance_binding.dart';
import '../modules/maintenance/maintenance_view.dart';
import '../modules/splash/splash_binding.dart';
import '../modules/splash/splash_view.dart';
import '../modules/vehicles/add_vehicle_view.dart';
import '../modules/vehicles/vehicles_binding.dart';
import '../modules/vehicles/vehicles_view.dart';
import '../utils/driver_onboarding_progress.dart';
import '../utils/pref.dart';

part 'app_routes.dart';

class AppPages {
  AppPages._();

  static const INITIAL = Routes.SPLASH;

  static final routes = [
    GetPage(
      name: _Paths.SPLASH,
      page: () => const SplashView(),
      binding: SplashBinding(),
    ),
    GetPage(
      name: _Paths.MAINTENANCE,
      page: () => const MaintenanceView(),
      binding: MaintenanceBinding(),
    ),
    GetPage(
      name: _Paths.ONBOARDING,
      page: () => const OnboardingView(),
      binding: OnboardingBinding(),
    ),
    GetPage(
      name: _Paths.LOGIN,
      page: () => const LoginView(),
      binding: AuthBinding(),
    ),
    GetPage(
      name: _Paths.REGISTER,
      page: () => const RegisterView(),
      binding: AuthBinding(),
    ),
    GetPage(name: _Paths.WELCOME, page: () => const WelcomeView()),
    GetPage(
      name: _Paths.DRIVERREGISTER,
      page: () => const DriverRegisterView(),
      binding: AuthBinding(),
    ),
    GetPage(
      name: _Paths.DRIVER_TSHIRT_SIZE,
      page: () => const DriverTShirtSizeView(),
      binding: DriverSignupBinding(),
    ),
    GetPage(
      name: _Paths.UPLOAD_DRIVER_LICENSE,
      page: () => const UploadDriverLicenseView(),
      binding: DriverSignupBinding(),
    ),
    GetPage(
      name: _Paths.ADD_VEHICLE_INFORMATION,
      page: () => const AddVehicleInformationView(),
      binding: DriverSignupBinding(),
    ),
    GetPage(
      name: _Paths.UPLOAD_VEHICLE_REGISTRATION_PHOTO,
      page: () => const RedirectToBackgroundCheckView(),
      binding: DriverSignupBinding(),
    ),
    GetPage(
      name: _Paths.BACKGROUND_CHECK,
      page: () => const BackgroundCheckView(),
      binding: DriverSignupBinding(),
    ),
    GetPage(
      name: _Paths.DRIVER_OTP,
      page: () => const DriverOtpView(),
      binding: DriverSignupBinding(),
    ),
    GetPage(
      name: _Paths.APPROVAL_PROCESS_REVIEW,
      page: () => const ApprovalProcessReviewView(),
      binding: AuthBinding(),
      middlewares: [DriverVerificationGuard()],
    ),
    GetPage(
      name: _Paths.APPROVE_COMPLETE,
      page: () => const ApproveCompleteView(),
      binding: AuthBinding(),
      middlewares: [DriverVerificationGuard()],
    ),
    GetPage(
      name: _Paths.WELCOME_TO_CAR_COMFORT,
      page: () => const WelcomeToCarComfortView(),
    ),
    GetPage(
      name: _Paths.TUTORIAL,
      page: () => const TutorialView(),
      binding: TutorialBinding(),
    ),
    GetPage(name: _Paths.CAMERA_ACCESS, page: () => const CameraAccessView()),
    GetPage(
      name: _Paths.LOCATION_ACCESS,
      page: () => const LocationAccessView(),
    ),
    GetPage(
      name: _Paths.OTP,
      page: () => const OtpView(),
      binding: AuthBinding(),
    ),
    GetPage(
      name: _Paths.FORGOT_PASSWORD,
      page: () => const ForgotPasswordView(),
      binding: AuthBinding(),
    ),
    GetPage(
      name: _Paths.RESET_PASSWORD,
      page: () => const ResetPasswordView(),
      binding: AuthBinding(),
    ),
    GetPage(
      name: _Paths.DASHBOARD,
      page: () => const DashboardView(),
      binding: DashboardBinding(),
    ),
    GetPage(
      name: _Paths.DRIVER_DASHBOARD,
      page: () => const DriverDashboardView(),
      binding: DriverDashboardBinding(),
      middlewares: [DriverApprovalGuard()],
    ),
    GetPage(
      name: _Paths.DRIVER_PAYMENT_METHOD,
      page: () => const DriverPaymentMethodView(),
      binding: PaymentMethodsBinding(),
      middlewares: [DriverApprovalGuard()],
    ),
    GetPage(
      name: _Paths.DRIVER_PAYMENT_HISTORY,
      page: () => const DriverPaymentHistoryView(),
      binding: DriverPaymentHistoryBinding(),
      middlewares: [DriverApprovalGuard()],
    ),
    GetPage(
      name: _Paths.DRIVER_PROFILE_SETTINGS,
      page: () => const DriverProfileSettingsView(),
      binding: DriverSettingsBuilder(),
      middlewares: [DriverApprovalGuard()],
    ),
    GetPage(
      name: _Paths.DRIVER_PROFILE,
      page: () => const DriverProfileView(),
      binding: DriverProfileBinding(),
      middlewares: [DriverApprovalGuard()],
    ),
    GetPage(
      name: _Paths.DRIVER_NOTIFICATIONS,
      page: () => const DriverNotificationsView(),
      binding: DriverSettingsBuilder(),
      middlewares: [DriverApprovalGuard()],
    ),
    GetPage(
      name: _Paths.DRIVER_SUPPORT,
      page: () => const DriverSupportView(),
      binding: DriverSupportBinding(),
      middlewares: [DriverApprovalGuard()],
    ),
    GetPage(
      name: _Paths.DRIVER_PRIVACY_TERMS,
      page: () => const DriverPrivacyTermsView(),
      binding: DriverPrivacyTermsBinding(),
      middlewares: [DriverApprovalGuard()],
    ),
    GetPage(
      name: _Paths.ABOUT_SERVICE,
      page: () => const AboutServiceView(),
      middlewares: [DriverApprovalGuard()],
    ),
    GetPage(
      name: _Paths.DRIVER_CAR_DETAILS,
      page: () => const CarDetailsView(),
      middlewares: [DriverApprovalGuard()],
    ),
    GetPage(
      name: _Paths.DRIVER_CHAT,
      page: () => const ChatView(),
      binding: BookingChatBinding(),
      middlewares: [DriverApprovalGuard()],
    ),
    GetPage(
      name: _Paths.SERVICE_PROVIDER_PROFILE,
      page: () => const ServiceProviderProfileView(),
      binding: DashboardBinding(),
    ),
    GetPage(
      name: _Paths.SERVICE_DETAIL,
      page: () => const ServiceDetailView(),
      binding: DashboardBinding(),
    ),
    GetPage(
      name: _Paths.DRIVER_SERVICE_DETAIL,
      page: () => const DriverServiceDetailView(),
      binding: DriverDashboardBinding(),
      middlewares: [DriverApprovalGuard()],
    ),
    GetPage(
      name: _Paths.MY_BOOKINGS,
      page: () => const MyBookingsView(),
      binding: DashboardBinding(),
    ),
    GetPage(
      name: _Paths.DRIVER_MY_BOOKINGS,
      page: () => const DriverBookingsView(),
      binding: DriverDashboardBinding(),
      middlewares: [DriverApprovalGuard()],
    ),
    GetPage(
      name: _Paths.SETTINGS,
      page: () => const SettingsView(),
      binding: SettingsBinding(),
    ),
    GetPage(
      name: _Paths.CUSTOMER_BILLING_HISTORY,
      page: () => const CustomerBillingHistoryView(),
      binding: CustomerBillingHistoryBinding(),
    ),
    GetPage(
      name: _Paths.CUSTOMER_INVOICE_DETAIL,
      page: () => const CustomerInvoiceDetailView(),
      binding: CustomerInvoiceDetailBinding(),
    ),
    GetPage(
      name: _Paths.CUSTOMER_TUTORIAL_LIBRARY,
      page: () => const CustomerTutorialLibraryView(),
      binding: CustomerTutorialLibraryBinding(),
    ),
    GetPage(
      name: _Paths.DRIVER_LEARNING_LIBRARY,
      page: () => const DriverLearningLibraryView(),
      binding: DriverLearningLibraryBinding(),
    ),
    GetPage(
      name: _Paths.PROFILE_SETTINGS,
      page: () => const ProfileSettingsView(),
      binding: SettingsBinding(),
    ),
    GetPage(
      name: '/customer-profile',
      page: () => const CustomerProfileView(),
      binding: SettingsBinding(),
    ),
    GetPage(
      name: _Paths.PAYMENT_METHOD,
      page: () => const PaymentMethodView(),
      binding: PaymentMethodsBinding(),
    ),
    GetPage(
      name: _Paths.NOTIFICATIONS,
      page: () => const NotificationsView(),
      binding: SettingsBinding(),
    ),
    GetPage(
      name: _Paths.REFER_EARN,
      page: () => const ReferEarnView(),
      binding: SettingsBinding(),
    ),
    GetPage(
      name: _Paths.NEED_HELP,
      page: () => const NeedHelpView(),
      binding: SettingsBinding(),
    ),
    GetPage(
      name: _Paths.SUPPORT_TICKETS,
      page: () => const SupportTicketsListView(),
      binding: SupportTicketsBinding(),
    ),
    GetPage(
      name: _Paths.SUPPORT_TICKET_DETAIL,
      page: () => const SupportTicketDetailView(),
      binding: SupportTicketDetailBinding(),
    ),
    GetPage(
      name: _Paths.CREATE_SUPPORT_TICKET,
      page: () => const CreateSupportTicketView(),
      binding: CreateSupportTicketBinding(),
    ),
    GetPage(
      name: _Paths.TERMS_PRIVACY,
      page: () => const TermsPrivacyView(),
      binding: SettingsBinding(),
    ),
    GetPage(
      name: _Paths.ACCOUNT_DELETION_REQUEST,
      page: () => const AccountDeletionRequestView(),
      binding: SettingsBinding(),
    ),
    GetPage(
      name: _Paths.REPORT_ACCIDENT_DAMAGE,
      page: () => const CustomerMediaReportView(),
      binding: ReportAccidentDamageBinding(),
    ),
    GetPage(
      name: _Paths.REPORT_MISSING_ITEM,
      page: () => const CustomerMediaReportView(),
      binding: ReportMissingItemBinding(),
    ),
    GetPage(
      name: _Paths.PRIVACY_POLICY,
      page: () => const LegalDocumentView(),
      binding: PrivacyPolicyLegalBinding(),
    ),
    GetPage(
      name: _Paths.TERMS_CONDITION,
      page: () => const LegalDocumentView(),
      binding: TermsConditionsLegalBinding(),
    ),
    GetPage(
      name: _Paths.LEGAL_DOCUMENT,
      page: () => const LegalDocumentView(),
      binding: LegalDocumentBinding(),
    ),
    GetPage(
      name: _Paths.SERVICE_BOOKING,
      page: () => const ServiceBookingView(),
      binding: ServiceBookingBinding(),
    ),
    GetPage(
      name: _Paths.VEHICLES,
      page: () => const VehiclesView(),
      binding: VehiclesBinding(),
    ),
    GetPage(
      name: _Paths.ADD_VEHICLE,
      page: () => const AddVehicleView(),
      binding: VehiclesBinding(),
    ),
  ];
}

RouteSettings? _driverOnboardingIncompleteRedirect() {
  final prefs = Prefs();
  if (!prefs.isDriverRole) return null;

  final onboardingComplete = prefs.getBool(Prefs.driverOnboardingComplete);
  if (onboardingComplete) return null;

  final savedStep =
      int.tryParse(prefs.getData(Prefs.driverCurrentStep).trim()) ?? 0;
  final completedSteps =
      int.tryParse(prefs.getData(Prefs.driverCompletedSteps).trim()) ?? 0;

  return RouteSettings(
    name: driverRouteWhenOnboardingIncomplete(
      savedStep: savedStep,
      onboardingComplete: false,
      isApproved: prefs.isDriverApproved,
      completedSteps: completedSteps,
    ),
  );
}

/// Blocks post-verification screens until driver OTP verification completes.
class DriverVerificationGuard extends GetMiddleware {
  @override
  RouteSettings? redirect(String? route) => _driverOnboardingIncompleteRedirect();
}

/// Blocks driver app surfaces until onboarding + verification complete, then approval.
class DriverApprovalGuard extends GetMiddleware {
  @override
  RouteSettings? redirect(String? route) {
    final incomplete = _driverOnboardingIncompleteRedirect();
    if (incomplete != null) return incomplete;

    final prefs = Prefs();
    if (!prefs.isDriverRole || prefs.isDriverApproved) return null;
    return const RouteSettings(name: Routes.APPROVAL_PROCESS_REVIEW);
  }
}
