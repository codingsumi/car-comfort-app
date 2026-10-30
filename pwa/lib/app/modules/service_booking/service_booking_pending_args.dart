/// Lightweight holder for service booking arguments passed between
/// DashboardController → ServiceBookingController.
///
/// On web, [Get.rootDelegate.toNamed] does not propagate the arguments map,
/// so we store them here just before navigating and read them in
/// [ServiceBookingController.onInit].
class ServiceBookingPendingArgs {
  ServiceBookingPendingArgs._();

  static String? serviceLabel;
  static int? serviceId;

  /// Set both fields atomically before navigating.
  static void set({required String label, required int id}) {
    serviceLabel = label;
    serviceId = id;
  }

  /// Read and immediately clear to prevent stale values on subsequent navigations.
  static ({String? label, int? id}) consume() {
    final label = serviceLabel;
    final id = serviceId;
    serviceLabel = null;
    serviceId = null;
    return (label: label, id: id);
  }
}
