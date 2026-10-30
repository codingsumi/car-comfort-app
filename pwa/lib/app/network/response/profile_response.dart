import 'dart:convert';

class ProfileResponse {
  ProfileResponse({this.status, this.message, this.data});

  ProfileResponse.fromJson(dynamic json) {
    status = json['status']?.toString();
    message = json['message']?.toString();
    data = json['data'] != null ? ProfileData.fromJson(json['data']) : null;
  }

  String? status;
  String? message;
  ProfileData? data;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['status'] = status;
    map['message'] = message;
    if (data != null) map['data'] = data!.toJson();
    return map;
  }
}

class ProfileReferralParser {
  ProfileReferralParser._();

  static String? parseCode(dynamic json) {
    if (json is! Map) return null;
    final direct =
        json['referral_code'] ??
        json['refer_code'] ??
        json['invite_code'] ??
        json['referralCode'];
    if (direct != null) {
      final value = direct.toString().trim();
      if (value.isNotEmpty) return value;
    }
    final referral = json['referral'];
    if (referral is Map) {
      final nested =
          referral['code'] ??
          referral['referral_code'] ??
          referral['refer_code'];
      if (nested != null) {
        final value = nested.toString().trim();
        if (value.isNotEmpty) return value;
      }
    }
    return null;
  }

  /// `active_referrals_count` from profile API (includes 0 when key is present).
  static int? parseActiveReferralsCount(dynamic json) {
    if (json is! Map) return null;
    if (json.containsKey('active_referrals_count')) {
      return _toInt(json['active_referrals_count']) ?? 0;
    }
    final referral = json['referral'];
    if (referral is Map && referral.containsKey('active_referrals_count')) {
      return _toInt(referral['active_referrals_count']) ?? 0;
    }
    return null;
  }

  static int? parseCount(dynamic json) {
    if (json is! Map) return null;
    return _toInt(
      json['referral_share_count'] ??
          json['active_referrals_count'] ??
          json['referral_count'] ??
          json['total_referrals'] ??
          (json['referral'] is Map
              ? (json['referral'] as Map)['count'] ??
                    (json['referral'] as Map)['referral_count']
              : null),
    );
  }

  static int? _toInt(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse('${value ?? ''}');
  }
}

class ProfileData {
  ProfileData({
    this.user,
    this.driverProfile,
    this.onboarding,
    this.accountDeletionRequest,
  });

  ProfileData.fromJson(dynamic json) {
    user = json['user'] != null
        ? ProfileUser.fromJson(json['user'])
        : (json['customer'] != null
              ? ProfileUser.fromJson(json['customer'])
              : null);
    driverProfile = json['driver_profile'] != null
        ? DriverProfile.fromJson(json['driver_profile'])
        : null;
    onboarding = json['onboarding'] != null
        ? DriverOnboarding.fromJson(json['onboarding'])
        : null;
    accountDeletionRequest = json['account_deletion_request'] != null
        ? AccountDeletionRequestInfo.fromJson(json['account_deletion_request'])
        : null;
    _rootReferralCode = ProfileReferralParser.parseCode(json);
    _rootReferralCount = ProfileReferralParser.parseCount(json);
    _rootActiveReferralsCount = ProfileReferralParser.parseActiveReferralsCount(
      json,
    );
  }

  ProfileUser? user;
  DriverProfile? driverProfile;
  DriverOnboarding? onboarding;
  AccountDeletionRequestInfo? accountDeletionRequest;
  String? _rootReferralCode;
  int? _rootReferralCount;
  int? _rootActiveReferralsCount;

  String? get resolvedReferralCode {
    final fromUser = user?.referralCode?.trim();
    if (fromUser != null && fromUser.isNotEmpty) return fromUser;
    final root = _rootReferralCode?.trim();
    if (root != null && root.isNotEmpty) return root;
    return null;
  }

  int get resolvedReferralCount {
    final fromUser = user?.referralCount;
    if (fromUser != null) return fromUser;
    return _rootReferralCount ?? 0;
  }

  /// Prefer [ProfileUser.activeReferralsCount], then root `active_referrals_count`.
  int get resolvedActiveReferralsCount {
    final fromUser = user?.activeReferralsCount;
    if (fromUser != null) return fromUser;
    return _rootActiveReferralsCount ?? 0;
  }

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    if (user != null) map['user'] = user!.toJson();
    if (driverProfile != null) map['driver_profile'] = driverProfile!.toJson();
    if (onboarding != null) map['onboarding'] = onboarding!.toJson();
    if (accountDeletionRequest != null) {
      map['account_deletion_request'] = accountDeletionRequest!.toJson();
    }
    return map;
  }
}

class AccountDeletionRequestInfo {
  AccountDeletionRequestInfo({
    this.id,
    this.status,
    this.reason,
    this.source,
    this.requestedAt,
    this.processedAt,
    this.adminNote,
  });

  AccountDeletionRequestInfo.fromJson(dynamic json) {
    id = json['id'] is int ? json['id'] as int : int.tryParse('${json['id'] ?? ''}');
    status = json['status']?.toString();
    reason = json['reason']?.toString();
    source = json['source']?.toString();
    requestedAt = (json['requested_at'] ?? json['created_at'])?.toString();
    processedAt = json['processed_at']?.toString();
    adminNote = json['admin_note']?.toString();
  }

  int? id;
  String? status;
  String? reason;
  String? source;
  String? requestedAt;
  String? processedAt;
  String? adminNote;

  bool get isOpen {
    final s = status?.trim().toLowerCase();
    return s == 'pending' || s == 'otp_pending';
  }

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['id'] = id;
    map['status'] = status;
    map['reason'] = reason;
    map['source'] = source;
    map['requested_at'] = requestedAt;
    map['processed_at'] = processedAt;
    map['admin_note'] = adminNote;
    return map;
  }
}

class DriverProfile {
  DriverProfile({
    this.profilePicture,
    this.currentStep,
    this.isCompleted,
    this.completedAt,
    this.tutorialCompletedAt,
    this.approvalStatus,
    this.approvalReason,
    this.approvedAt,
    this.rejectedAt,
    this.stepEntries,
    this.driversLicenseExpirationDate,
    this.licenseHoldActive,
    this.isLicenseExpired,
    this.licenseDaysUntilExpiration,
    this.isLicenseExpiringSoon,
    this.canAcceptNewBookings,
  });

  DriverProfile.fromJson(dynamic json) {
    profilePicture = (json['profile_picture'] ?? json['profile'])?.toString();
    if (profilePicture != null && profilePicture!.trim().isEmpty) {
      profilePicture = null;
    }
    currentStep = json['current_step'] is int
        ? json['current_step'] as int
        : int.tryParse('${json['current_step'] ?? ''}');
    isCompleted = json['is_completed'] == true;
    completedAt = json['completed_at']?.toString();
    tutorialCompletedAt = json['tutorial_completed_at']?.toString();
    approvalStatus = json['approval_status']?.toString();
    approvalReason = json['approval_reason']?.toString();
    approvedAt = json['approved_at']?.toString();
    rejectedAt = json['rejected_at']?.toString();
    driversLicenseExpirationDate =
        json['drivers_license_expiration_date']?.toString();
    licenseHoldActive = json['license_hold_active'] == true;
    isLicenseExpired = json['is_license_expired'] == true;
    licenseDaysUntilExpiration = json['license_days_until_expiration'] is int
        ? json['license_days_until_expiration'] as int
        : int.tryParse('${json['license_days_until_expiration'] ?? ''}');
    isLicenseExpiringSoon = json['is_license_expiring_soon'] == true;
    if (json.containsKey('can_accept_new_bookings')) {
      canAcceptNewBookings = json['can_accept_new_bookings'] == true;
    }
    stepEntries = _parseStepEntries(json['step_data']);
  }

  /// Keys are step numbers as strings ("1".."8"). Values are decoded step payloads.
  Map<String, Map<String, dynamic>>? stepEntries;

  String? profilePicture;
  int? currentStep;
  bool? isCompleted;
  String? completedAt;
  String? tutorialCompletedAt;
  String? approvalStatus;
  String? approvalReason;
  String? approvedAt;
  String? rejectedAt;
  String? driversLicenseExpirationDate;
  bool? licenseHoldActive;
  bool? isLicenseExpired;
  int? licenseDaysUntilExpiration;
  bool? isLicenseExpiringSoon;
  bool? canAcceptNewBookings;

  bool get isApproved => approvalStatus?.trim().toLowerCase() == 'approved';

  bool get isLicenseComplianceBlocked =>
      licenseHoldActive == true ||
      isLicenseExpired == true ||
      canAcceptNewBookings == false;

  /// Top-level column, then onboarding step 3 (`YYYY-MM-DD`).
  String? get resolvedLicenseExpirationDate {
    final top = driversLicenseExpirationDate?.trim();
    if (top != null && top.isNotEmpty) return top;
    final step3 = step(3);
    final fromStep = step3?['drivers_license_expiration_date']?.toString().trim();
    if (fromStep != null && fromStep.isNotEmpty) return fromStep;
    return null;
  }

  static int? daysUntilExpirationIso(String? ymd) {
    final raw = (ymd ?? '').trim();
    if (!RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(raw)) return null;
    final parts = raw.split('-');
    final year = int.tryParse(parts[0]);
    final month = int.tryParse(parts[1]);
    final day = int.tryParse(parts[2]);
    if (year == null || month == null || day == null) return null;
    final expiry = DateTime(year, month, day);
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    return expiry.difference(today).inDays;
  }

  /// Client-side compliance when API fields are missing/stale.
  void applyLocalLicenseComplianceFallback() {
    final ymd = resolvedLicenseExpirationDate;
    if (ymd == null || ymd.isEmpty) return;

    driversLicenseExpirationDate ??= ymd;
    licenseDaysUntilExpiration ??= daysUntilExpirationIso(ymd);

    final days = licenseDaysUntilExpiration ?? daysUntilExpirationIso(ymd);
    if (days == null) return;

    if (days < 0) {
      isLicenseExpired = true;
      canAcceptNewBookings = false;
      isLicenseExpiringSoon = false;
      return;
    }

    if (isLicenseExpired != true && days <= 30) {
      isLicenseExpiringSoon = true;
    }
  }

  bool get hasCompletedTutorial {
    final at = tutorialCompletedAt?.trim() ?? '';
    return at.isNotEmpty;
  }

  static Map<String, Map<String, dynamic>>? _parseStepEntries(
    dynamic stepData,
  ) {
    if (stepData is! Map) return null;

    // The admin panel stores steps at the ROOT of step_data:
    //   { "1": {...}, "3": {...} }
    // The driver signup flow wraps them under a "steps" key:
    //   { "steps": { "2": {...}, "3": {...} } }
    // Support both formats so accounts created/edited by either path display correctly.
    final stepsNode = stepData['steps'];
    final inner = (stepsNode is Map) ? stepsNode : stepData;

    final out = <String, Map<String, dynamic>>{};
    for (final e in (inner as Map).entries) {
      final k = e.key.toString();
      final v = e.value;
      if (v is Map) {
        out[k] = Map<String, dynamic>.from(
          v.map((dynamic a, dynamic b) => MapEntry(a.toString(), b)),
        );
      }
    }
    return out.isEmpty ? null : out;
  }

  Map<String, dynamic>? step(int n) => stepEntries?['$n'];

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['profile_picture'] = profilePicture;
    map['current_step'] = currentStep;
    map['is_completed'] = isCompleted;
    map['completed_at'] = completedAt;
    map['tutorial_completed_at'] = tutorialCompletedAt;
    map['approval_status'] = approvalStatus;
    map['approval_reason'] = approvalReason;
    map['approved_at'] = approvedAt;
    map['rejected_at'] = rejectedAt;
    return map;
  }
}

class DriverOnboarding {
  DriverOnboarding({this.totalSteps});

  DriverOnboarding.fromJson(dynamic json) {
    totalSteps = json['total_steps'] is int
        ? json['total_steps'] as int
        : int.tryParse('${json['total_steps'] ?? ''}');
  }

  int? totalSteps;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['total_steps'] = totalSteps;
    return map;
  }
}

class ProfileUser {
  ProfileUser({
    this.id,
    this.name,
    this.email,
    this.phone,
    this.role,
    this.isVerified,
    this.profilePicture,
    this.referralCode,
    this.referralCount,
    this.activeReferralsCount,
    this.status,
    this.suspendedReason,
  });

  ProfileUser.fromJson(dynamic json) {
    id = json['id'] is int
        ? json['id'] as int
        : int.tryParse('${json['id'] ?? ''}');
    name = json['name']?.toString();
    email = json['email']?.toString();
    phone = json['phone']?.toString();
    role = json['role']?.toString();
    isVerified = json['is_verified'] == true;
    status = json['status']?.toString();
    suspendedReason = json['suspended_reason']?.toString();
    profilePicture = _extractProfilePicture(
      json['profile'] ?? json['image'] ?? json['avatar'],
    );
    referralCode = ProfileReferralParser.parseCode(json);
    activeReferralsCount = ProfileReferralParser.parseActiveReferralsCount(
      json,
    );
    referralCount = ProfileReferralParser.parseCount(json);
  }

  int? id;
  String? name;
  String? email;
  String? phone;
  String? role;
  bool? isVerified;
  String? profilePicture;
  String? referralCode;
  int? referralCount;
  int? activeReferralsCount;
  String? status;
  String? suspendedReason;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['id'] = id;
    map['name'] = name;
    map['email'] = email;
    map['phone'] = phone;
    map['role'] = role;
    map['is_verified'] = isVerified;
    map['profile'] = profilePicture;
    map['referral_code'] = referralCode;
    map['referral_count'] = referralCount;
    map['active_referrals_count'] = activeReferralsCount;
    return map;
  }

  String? _extractProfilePicture(dynamic rawProfile) {
    if (rawProfile == null) return null;
    if (rawProfile is String) {
      final v = rawProfile.trim();
      if (v.isEmpty) return null;
      if (!v.startsWith('{')) return v;
      try {
        final decoded = jsonDecode(v);
        if (decoded is Map<String, dynamic>) {
          return (decoded['avatar_url'] ??
                  decoded['url'] ??
                  decoded['profile'] ??
                  decoded['image'])
              ?.toString();
        }
      } catch (_) {
        return v;
      }
      return v;
    }
    if (rawProfile is Map<String, dynamic>) {
      return (rawProfile['avatar_url'] ??
              rawProfile['url'] ??
              rawProfile['profile'] ??
              rawProfile['image'])
          ?.toString();
    }
    return rawProfile.toString();
  }
}
