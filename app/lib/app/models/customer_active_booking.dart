/// Lightweight model returned by `GET /api/app/customer/active-booking`.
/// Contains only the fields needed for the Active Booking tab widget.
class CustomerActiveBookingDriver {
  final String? name;
  final String? phone;
  final String? avatar;
  final double? rating;

  const CustomerActiveBookingDriver({
    this.name,
    this.phone,
    this.avatar,
    this.rating,
  });

  factory CustomerActiveBookingDriver.fromJson(Map<String, dynamic> json) {
    return CustomerActiveBookingDriver(
      name: json['name'] as String?,
      phone: json['phone'] as String?,
      avatar: json['avatar'] as String?,
      rating: json['rating'] == null
          ? null
          : double.tryParse('${json['rating']}'),
    );
  }
}

class CustomerActiveBooking {
  final int id;
  final String? bookingCode;
  final String? serviceType;
  final String? status;
  final String? trackingStatus;
  final String? scheduledAt;
  final String? scheduleType;
  final double? totalPrice;
  final CustomerActiveBookingDriver? driver;
  final String? pickupAddress;
  final String? serviceAddress;
  final String? serviceLocationName;
  final int? chargeLimit;
  final double? estRadiusMiles;
  final String? createdAt;

  const CustomerActiveBooking({
    required this.id,
    this.bookingCode,
    this.serviceType,
    this.status,
    this.trackingStatus,
    this.scheduledAt,
    this.scheduleType,
    this.totalPrice,
    this.driver,
    this.pickupAddress,
    this.serviceAddress,
    this.serviceLocationName,
    this.chargeLimit,
    this.estRadiusMiles,
    this.createdAt,
  });

  factory CustomerActiveBooking.fromJson(Map<String, dynamic> json) {
    CustomerActiveBookingDriver? driver;
    if (json['driver'] is Map) {
      driver = CustomerActiveBookingDriver.fromJson(
        Map<String, dynamic>.from(json['driver'] as Map),
      );
    }
    return CustomerActiveBooking(
      id: int.tryParse('${json['id'] ?? ''}') ?? 0,
      bookingCode: (json['booking_code'] ?? json['bookingCode']) as String?,
      serviceType: (json['service_type'] ?? json['serviceType']) as String?,
      status: json['status'] as String?,
      trackingStatus: (json['tracking_status'] ?? json['trackingStatus']) as String?,
      scheduledAt: (json['scheduled_at'] ?? json['scheduledAt']) as String?,
      scheduleType: (json['schedule_type'] ?? json['scheduleType']) as String?,
      totalPrice: (json['total_price'] ?? json['totalPrice']) == null
          ? null
          : double.tryParse('${json['total_price'] ?? json['totalPrice']}'),
      driver: driver,
      pickupAddress: (json['pickup_address'] ?? json['pickupAddress']) as String?,
      serviceAddress: (json['service_address'] ?? json['serviceAddress']) as String?,
      serviceLocationName: (json['service_location_name'] ?? json['serviceLocationName']) as String?,
      chargeLimit: (json['charge_limit'] ?? json['chargeLimit']) == null ? null : int.tryParse('${json['charge_limit'] ?? json['chargeLimit']}'),
      estRadiusMiles: (json['est_radius_miles'] ?? json['estRadiusMiles']) == null ? null : double.tryParse('${json['est_radius_miles'] ?? json['estRadiusMiles']}'),
      createdAt: (json['created_at'] ?? json['createdAt']) as String?,
    );
  }
}
