const { sequelize } = require('../config/sequelize');

const User = require('./user.model')(sequelize);
const DriverProfile = require('./driverProfile.model')(sequelize);
const Service = require('./service.model')(sequelize);
const Package = require('./package.model')(sequelize);
const PackageFeature = require('./packageFeature.model')(sequelize);
const AddOn = require('./addOn.model')(sequelize);
const PackageAddonMap = require('./packageAddonMap.model')(sequelize);
const Booking = require('./booking.model')(sequelize);
const BookingAddonMap = require('./bookingAddonMap.model')(sequelize);
const BookingImage = require('./bookingImage.model')(sequelize);
const BookingTransaction = require('./bookingTransaction.model')(sequelize);
const BookingTip = require('./bookingTip.model')(sequelize);
const RefundRequest = require('./refundRequest.model')(sequelize);
const Vehicle = require('./vehicle.model')(sequelize);
const VehicleImage = require('./vehicleImage.model')(sequelize);
const VehicleFlag = require('./vehicleFlag.model')(sequelize);
const VehicleActivityLog = require('./vehicleActivityLog.model')(sequelize);
const VehicleType = require('./vehicleType.model')(sequelize);
const BookingCharge = require('./bookingCharge.model')(sequelize);
const Review = require('./review.model')(sequelize);
const ReviewImage = require('./reviewImage.model')(sequelize);
const DriverLocation = require('./driverLocation.model')(sequelize);
const NotificationLog = require('./notificationLog.model')(sequelize);
const NotificationState = require('./notificationState.model')(sequelize);
const UserDevice = require('./userDevice.model')(sequelize);
const AppNotification = require('./appNotification.model')(sequelize);
const BookingTrackingLog = require('./bookingTrackingLog.model')(sequelize);
const BookingChatTranscript = require('./bookingChatTranscript.model')(sequelize);
const TutorialContent = require('./tutorialContent.model')(sequelize);
const PromotionalDiscount = require('./promotionalDiscount.model')(sequelize);
const TutorialVideoItem = require('./tutorialVideoItem.model')(sequelize);
const LegalPage = require('./legalPage.model')(sequelize);
const AppSetting = require('./appSetting.model')(sequelize);
const SettingsAuditLog = require('./settingsAuditLog.model')(sequelize);
const AdminAuditLog = require('./adminAuditLog.model')(sequelize);
const BookingDispute = require('./bookingDispute.model')(sequelize);
const BookingTimeline = require('./bookingTimeline.model')(sequelize);
const Transaction = require('./transaction.model')(sequelize);
const ProviderPayout = require('./providerPayout.model')(sequelize);
const PricingRule = require('./pricingRule.model')(sequelize);
const FinancialAuditLog = require('./financialAuditLog.model')(sequelize);
const VacuumPenalty = require('./vacuumPenalty.model')(sequelize);
const ProviderFlag = require('./providerFlag.model')(sequelize);
const AccountDeletionRequest = require('./accountDeletionRequest.model')(sequelize);
const PlatformReport = require('./platformReport.model')(sequelize);
const PlatformReportNote = require('./platformReportNote.model')(sequelize);
const SupportTicket = require('./supportTicket.model')(sequelize);
const SupportMessage = require('./supportMessage.model')(sequelize);
const FaqCategory = require('./faqCategory.model')(sequelize);
const Faq = require('./faq.model')(sequelize);
const ServiceArea = require('./serviceArea.model')(sequelize);
const NotificationTemplate = require('./notificationTemplate.model')(sequelize);
const NotificationCampaign = require('./notificationCampaign.model')(sequelize);
const NotificationDeliveryLog = require('./notificationDeliveryLog.model')(sequelize);
const AnalyticsCache = require('./analyticsCache.model')(sequelize);
const ExportJob = require('./exportJob.model')(sequelize);
const AdminSession = require('./adminSession.model')(sequelize);
const AuthEvent = require('./authEvent.model')(sequelize);
const ComplianceRequest = require('./complianceRequest.model')(sequelize);
const SecurityAlert = require('./securityAlert.model')(sequelize);
const ProviderWallet = require('./providerWallet.model')(sequelize);
const ProviderWalletTransaction = require('./providerWalletTransaction.model')(sequelize);

User.hasOne(DriverProfile, { foreignKey: 'user_id', as: 'driver_profile' });
DriverProfile.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(Vehicle, { foreignKey: 'user_id', as: 'vehicles' });
Vehicle.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Vehicle.hasMany(VehicleImage, { foreignKey: 'vehicle_id', as: 'images' });
VehicleImage.belongsTo(Vehicle, { foreignKey: 'vehicle_id', as: 'vehicle' });

Vehicle.hasMany(VehicleFlag, { foreignKey: 'vehicle_id', as: 'flags' });
VehicleFlag.belongsTo(Vehicle, { foreignKey: 'vehicle_id', as: 'vehicle' });
VehicleFlag.belongsTo(User, { foreignKey: 'flagged_by', as: 'flagger' });
VehicleFlag.belongsTo(User, { foreignKey: 'resolved_by', as: 'resolver' });

Vehicle.hasMany(VehicleActivityLog, { foreignKey: 'vehicle_id', as: 'activity_logs' });
VehicleActivityLog.belongsTo(Vehicle, { foreignKey: 'vehicle_id', as: 'vehicle' });

Service.hasMany(Package, { foreignKey: 'service_id', as: 'packages' });
Package.belongsTo(Service, { foreignKey: 'service_id', as: 'service' });

Package.hasMany(PackageFeature, { foreignKey: 'package_id', as: 'features' });
PackageFeature.belongsTo(Package, { foreignKey: 'package_id', as: 'package' });

Package.belongsToMany(AddOn, {
  through: PackageAddonMap,
  foreignKey: 'package_id',
  otherKey: 'addon_id',
  as: 'addons'
});
AddOn.belongsToMany(Package, {
  through: PackageAddonMap,
  foreignKey: 'addon_id',
  otherKey: 'package_id',
  as: 'packages'
});

Booking.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(Booking, { foreignKey: 'user_id', as: 'bookings' });

Booking.belongsTo(User, { foreignKey: 'assigned_driver_user_id', as: 'assigned_driver' });
User.hasMany(Booking, { foreignKey: 'assigned_driver_user_id', as: 'assigned_bookings' });

Booking.belongsTo(Package, { foreignKey: 'package_id', as: 'package' });
Package.hasMany(Booking, { foreignKey: 'package_id', as: 'bookings' });

Booking.belongsTo(Vehicle, { foreignKey: 'vehicle_id', as: 'vehicle' });
Vehicle.hasMany(Booking, { foreignKey: 'vehicle_id', as: 'bookings' });

Booking.belongsToMany(AddOn, {
  through: BookingAddonMap,
  foreignKey: 'booking_id',
  otherKey: 'addon_id',
  as: 'addons'
});
AddOn.belongsToMany(Booking, {
  through: BookingAddonMap,
  foreignKey: 'addon_id',
  otherKey: 'booking_id',
  as: 'bookings'
});

Booking.hasMany(BookingImage, { foreignKey: 'booking_id', as: 'images' });
BookingImage.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });

Booking.hasMany(BookingTransaction, { foreignKey: 'booking_id', as: 'transactions' });
BookingTransaction.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });

Booking.hasOne(BookingTip, { foreignKey: 'booking_id', as: 'tip' });
BookingTip.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });
BookingTip.belongsTo(User, { foreignKey: 'customer_user_id', as: 'customer' });
BookingTip.belongsTo(User, { foreignKey: 'provider_user_id', as: 'provider' });
BookingTip.belongsTo(BookingTransaction, { foreignKey: 'booking_transaction_id', as: 'booking_transaction' });

User.hasMany(BookingTransaction, { foreignKey: 'user_id', as: 'booking_transactions' });
BookingTransaction.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

BookingTransaction.hasMany(RefundRequest, { foreignKey: 'booking_transaction_id', as: 'refund_requests' });
RefundRequest.belongsTo(BookingTransaction, { foreignKey: 'booking_transaction_id', as: 'booking_transaction' });

User.hasMany(RefundRequest, { foreignKey: 'user_id', as: 'refund_requests' });
RefundRequest.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Review.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });
Booking.hasMany(Review, { foreignKey: 'booking_id', as: 'reviews' });

Review.belongsTo(User, { foreignKey: 'reviewer_user_id', as: 'reviewer' });
Review.belongsTo(User, { foreignKey: 'reviewee_user_id', as: 'reviewee' });
User.hasMany(Review, { foreignKey: 'reviewer_user_id', as: 'reviews_written' });
User.hasMany(Review, { foreignKey: 'reviewee_user_id', as: 'reviews_received' });

Review.hasMany(ReviewImage, { foreignKey: 'review_id', as: 'images' });
ReviewImage.belongsTo(Review, { foreignKey: 'review_id', as: 'review' });

Booking.hasMany(DriverLocation, { foreignKey: 'booking_id', as: 'driver_locations' });
DriverLocation.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });
DriverLocation.belongsTo(User, { foreignKey: 'provider_id', as: 'provider' });

Booking.hasOne(NotificationState, { foreignKey: 'booking_id', as: 'notification_state' });
NotificationState.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });

Booking.hasMany(NotificationLog, { foreignKey: 'booking_id', as: 'notification_logs' });
NotificationLog.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });

Booking.hasMany(AppNotification, { foreignKey: 'booking_id', as: 'app_notifications' });
NotificationLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Booking.hasMany(BookingTrackingLog, { foreignKey: 'booking_id', as: 'tracking_logs' });
BookingTrackingLog.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });

Booking.hasOne(BookingChatTranscript, { foreignKey: 'booking_id', as: 'chat_transcript' });
BookingChatTranscript.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });

User.hasMany(UserDevice, { foreignKey: 'user_id', as: 'devices' });
UserDevice.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(AppNotification, { foreignKey: 'user_id', as: 'app_notifications' });
AppNotification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
AppNotification.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });

SettingsAuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(SettingsAuditLog, { foreignKey: 'user_id', as: 'settings_audit_logs' });

AdminAuditLog.belongsTo(User, { foreignKey: 'admin_id', as: 'admin' });
User.hasMany(AdminAuditLog, { foreignKey: 'admin_id', as: 'admin_audit_logs' });

AdminSession.belongsTo(User, { foreignKey: 'admin_id', as: 'admin' });
User.hasMany(AdminSession, { foreignKey: 'admin_id', as: 'admin_sessions' });

AuthEvent.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(AuthEvent, { foreignKey: 'user_id', as: 'auth_events' });

ComplianceRequest.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
ComplianceRequest.belongsTo(User, { foreignKey: 'processed_by', as: 'processor' });
User.hasMany(ComplianceRequest, { foreignKey: 'user_id', as: 'compliance_requests' });

SecurityAlert.belongsTo(User, { foreignKey: 'resolved_by', as: 'resolver' });

User.hasOne(ProviderWallet, { foreignKey: 'provider_id', as: 'provider_wallet' });
ProviderWallet.belongsTo(User, { foreignKey: 'provider_id', as: 'provider' });

User.hasMany(ProviderWalletTransaction, { foreignKey: 'provider_id', as: 'wallet_transactions' });
ProviderWalletTransaction.belongsTo(User, { foreignKey: 'provider_id', as: 'provider' });
ProviderWalletTransaction.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });
Booking.hasMany(ProviderWalletTransaction, { foreignKey: 'booking_id', as: 'wallet_transactions' });
ProviderWalletTransaction.belongsTo(ProviderPayout, { foreignKey: 'provider_payout_id', as: 'payout' });
ProviderPayout.hasMany(ProviderWalletTransaction, { foreignKey: 'provider_payout_id', as: 'wallet_transactions' });

AccountDeletionRequest.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
AccountDeletionRequest.belongsTo(User, { foreignKey: 'processed_by', as: 'processor' });
User.hasMany(AccountDeletionRequest, { foreignKey: 'user_id', as: 'account_deletion_requests' });

Booking.hasMany(BookingDispute, { foreignKey: 'booking_id', as: 'disputes' });
BookingDispute.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });
BookingDispute.belongsTo(User, { foreignKey: 'resolved_by', as: 'resolver' });

Booking.hasMany(BookingTimeline, { foreignKey: 'booking_id', as: 'timeline' });
BookingTimeline.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });

RefundRequest.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });
Booking.hasMany(RefundRequest, { foreignKey: 'booking_id', as: 'refund_requests' });

Transaction.belongsTo(User, { foreignKey: 'customer_id', as: 'customer' });
Transaction.belongsTo(User, { foreignKey: 'provider_id', as: 'provider' });
Transaction.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });
Transaction.belongsTo(BookingTransaction, { foreignKey: 'booking_transaction_id', as: 'booking_transaction' });
Booking.hasMany(Transaction, { foreignKey: 'booking_id', as: 'finance_transactions' });

ProviderPayout.belongsTo(User, { foreignKey: 'provider_id', as: 'provider' });
ProviderPayout.belongsTo(User, { foreignKey: 'processed_by', as: 'processor' });
User.hasMany(ProviderPayout, { foreignKey: 'provider_id', as: 'payouts' });

PricingRule.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
PricingRule.belongsTo(User, { foreignKey: 'updated_by', as: 'updater' });

FinancialAuditLog.belongsTo(User, { foreignKey: 'admin_id', as: 'admin' });

VacuumPenalty.belongsTo(User, { foreignKey: 'provider_id', as: 'provider' });
VacuumPenalty.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });
VacuumPenalty.belongsTo(User, { foreignKey: 'issued_by', as: 'issuer' });
User.hasMany(VacuumPenalty, { foreignKey: 'provider_id', as: 'vacuum_penalties' });

ProviderFlag.belongsTo(User, { foreignKey: 'provider_id', as: 'provider' });
ProviderFlag.belongsTo(User, { foreignKey: 'resolved_by', as: 'resolver' });
User.hasMany(ProviderFlag, { foreignKey: 'provider_id', as: 'provider_flags' });

Review.belongsTo(User, { foreignKey: 'moderated_by', as: 'moderator' });

PlatformReport.belongsTo(User, { foreignKey: 'reporter_user_id', as: 'reporter' });
PlatformReport.belongsTo(User, { foreignKey: 'target_user_id', as: 'target' });
PlatformReport.belongsTo(User, { foreignKey: 'assigned_to', as: 'assignee' });
PlatformReport.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });
User.hasMany(PlatformReport, { foreignKey: 'reporter_user_id', as: 'reports_filed' });
User.hasMany(PlatformReport, { foreignKey: 'target_user_id', as: 'reports_received' });
User.hasMany(PlatformReport, { foreignKey: 'assigned_to', as: 'reports_assigned' });

PlatformReportNote.belongsTo(PlatformReport, { foreignKey: 'report_id', as: 'report' });
PlatformReportNote.belongsTo(User, { foreignKey: 'admin_id', as: 'admin' });
PlatformReport.hasMany(PlatformReportNote, { foreignKey: 'report_id', as: 'notes' });

SupportTicket.belongsTo(User, { foreignKey: 'user_id', as: 'requester' });
SupportTicket.belongsTo(User, { foreignKey: 'assigned_to', as: 'assignee' });
SupportTicket.belongsTo(Booking, { foreignKey: 'linked_booking_id', as: 'linked_booking' });
User.hasMany(SupportTicket, { foreignKey: 'user_id', as: 'support_tickets' });

SupportMessage.belongsTo(SupportTicket, { foreignKey: 'ticket_id', as: 'ticket' });
SupportMessage.belongsTo(User, { foreignKey: 'sender_id', as: 'sender' });
SupportTicket.hasMany(SupportMessage, { foreignKey: 'ticket_id', as: 'messages' });

NotificationTemplate.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
User.hasMany(NotificationTemplate, { foreignKey: 'created_by', as: 'notification_templates_created' });

NotificationCampaign.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
NotificationCampaign.belongsTo(NotificationTemplate, { foreignKey: 'template_id', as: 'template' });
NotificationTemplate.hasMany(NotificationCampaign, { foreignKey: 'template_id', as: 'campaigns' });

NotificationDeliveryLog.belongsTo(NotificationCampaign, { foreignKey: 'campaign_id', as: 'campaign' });

ExportJob.belongsTo(User, { foreignKey: 'requested_by', as: 'requester' });
NotificationDeliveryLog.belongsTo(User, { foreignKey: 'recipient_id', as: 'recipient' });
NotificationDeliveryLog.belongsTo(AppNotification, { foreignKey: 'notification_id', as: 'app_notification' });
NotificationCampaign.hasMany(NotificationDeliveryLog, { foreignKey: 'campaign_id', as: 'delivery_logs' });

FaqCategory.hasMany(Faq, { foreignKey: 'category_id', as: 'faqs' });
Faq.belongsTo(FaqCategory, { foreignKey: 'category_id', as: 'category' });

const db = {
  sequelize,
  User,
  DriverProfile,
  Service,
  Package,
  PackageFeature,
  AddOn,
  PackageAddonMap,
  Booking,
  BookingAddonMap,
  BookingImage,
  BookingTransaction,
  BookingTip,
  RefundRequest,
  Vehicle,
  VehicleImage,
  VehicleFlag,
  VehicleActivityLog,
  VehicleType,
  BookingCharge,
  Review,
  ReviewImage,
  DriverLocation,
  NotificationLog,
  NotificationState,
  UserDevice,
  AppNotification,
  BookingTrackingLog,
  BookingChatTranscript,
  TutorialContent,
  TutorialVideoItem,
  LegalPage,
  AppSetting,
  SettingsAuditLog,
  AdminAuditLog,
  BookingDispute,
  BookingTimeline,
  Transaction,
  ProviderPayout,
  PricingRule,
  FinancialAuditLog,
  VacuumPenalty,
  ProviderFlag,
  AccountDeletionRequest,
  PlatformReport,
  PlatformReportNote,
  SupportTicket,
  SupportMessage,
  FaqCategory,
  Faq,
  ServiceArea,
  NotificationTemplate,
  NotificationCampaign,
  NotificationDeliveryLog,
  AnalyticsCache,
  ExportJob,
  AdminSession,
  AuthEvent,
  ComplianceRequest,
  SecurityAlert,
  ProviderWallet,
  ProviderWalletTransaction,
  PromotionalDiscount,
};

module.exports = db;

