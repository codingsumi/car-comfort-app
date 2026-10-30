export interface ApiResponse<T = unknown> {
  status: 'success' | 'error';
  message: string;
  error_type?: string | null;
  data: T;
}

export interface PaginatedResponse<T> {
  rows: T[];
  count: number;
  totalPages: number;
  currentPage: number;
}

export interface User {
  id: number;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  country_code: string | null;
  role: 'customer' | 'driver' | 'garage' | 'admin';
  status: 'active' | 'suspended' | 'deactivated';
  suspended_reason: string | null;
  is_verified: boolean;
  auth_type: 'normal' | 'social';
  social_type: string | null;
  profile: Record<string, unknown> | null;
  stripe_customer_id: string | null;
  referral_code: string | null;
  referred_by_user_id: number | null;
  latitude: number | null;
  longitude: number | null;
  location_updated_at: string | null;
  agreed_to_terms: boolean;
  created_at: string;
  updated_at: string;
}

export interface DriverProfile {
  id: number;
  user_id: number;
  profile_picture: string | null;
  step_data: ({ steps?: Record<string, Record<string, unknown>> } & Record<string, unknown>) | null;
  current_step: number;
  is_completed: boolean;
  completed_at: string | null;
  approval_status: 'pending' | 'approved' | 'rejected';
  approval_reason: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
  user?: User;
  User?: User;
}

export interface Booking {
  id: number;
  booking_code: string;
  user_id: number;
  assigned_driver_user_id: number | null;
  vehicle_id: number | null;
  package_id: number | null;
  service_type: 'car_wash' | 'ev_charging' | 'combo';
  schedule_type: 'asap' | 'scheduled' | null;
  status: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  service_address: string | null;
  base_price: string | null;
  addon_price: string | null;
  service_fee: string | null;
  platform_fee: string | null;
  tax: string | null;
  total_price: string | null;
  scheduled_at: string | null;
  service_datetime?: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  cancellation_fee: string | null;
  refund_amount: string | null;
  dispute_status: 'open' | 'investigating' | 'resolved' | 'closed' | null;
  admin_cancellation_reason: string | null;
  current_battery_charge: string | null;
  rate_per_kw: string | null;
  ev_account_card_on_file: boolean | null;
  parking_instructions: string | null;
  service_notes?: {
    vehicle_parked_location: string | null;
    vehicle_parked_location_label: string | null;
    vehicle_parked_location_other: string | null;
    provider_park_location: string | null;
    provider_park_location_label: string | null;
    provider_park_location_other: string | null;
    vehicle_key_location: string | null;
    vehicle_key_location_label: string | null;
    vehicle_key_location_other: string | null;
    key_return_location: string | null;
    key_return_location_label: string | null;
    key_return_location_other: string | null;
    parking_instructions: string | null;
    notes: string | null;
  };
  notes: string | null;
  tracking_status: string | null;
  service_started_at: string | null;
  service_completed_at: string | null;
  service_duration_minutes: number | null;
  test_archived_at?: string | null;
  test_archived_by?: number | null;
  created_at: string;
  updated_at: string;
  user?: User;
  assigned_driver?: User;
  vehicle?: Vehicle;
  package?: ServicePackage;
  transactions?: BookingTransaction[];
  images?: BookingImage[];
  reviews?: Review[];
  addons?: AddOn[];
}

export type VehicleStatus = 'active' | 'inactive' | 'removed' | 'flagged';

export type VehicleFlagType =
  | 'fake_registration'
  | 'duplicate_vehicle'
  | 'suspicious_activity'
  | 'invalid_license_plate'
  | 'possible_duplicate';

export interface Vehicle {
  id: number;
  user_id: number;
  vehicle_type: string;
  make: string;
  model: string;
  year: number;
  color: string;
  nickname: string | null;
  is_default: boolean;
  license_plate: string;
  vin_number: string | null;
  notes: string | null;
  status: VehicleStatus;
  removed_at: string | null;
  removal_reason: string | null;
  fuel_type: 'GAS' | 'DIESEL' | 'ELECTRIC';
  battery_capacity_kwh: number | null;
  created_at: string;
  updated_at: string;
  user?: Pick<User, 'id' | 'name' | 'email' | 'phone' | 'role'>;
  images?: VehicleImage[];
  active_bookings_count?: number;
  completed_services_count?: number;
  open_flag_count?: number;
  flags?: VehicleFlag[];
  duplicate_hints?: { kind: string; other_vehicle_ids: number[] }[];
  customer_summary?: { total_vehicles_owned: number; total_bookings: number };
  activity_timeline?: VehicleActivityLog[];
  service_history?: VehicleServiceHistoryRow[];
  service_history_pagination?: { count: number; page: number; totalPages: number; limit: number };
  related_platform_reports?: VehiclePlatformReport[];
}

export interface VehicleImage {
  id: number;
  vehicle_id: number;
  image_path?: string;
  url: string;
  image_type?: string;
  is_flagged?: boolean;
  flagged_by?: number | null;
  flagged_at?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface VehicleFlag {
  id: number;
  vehicle_id: number;
  flag_type: VehicleFlagType | string;
  reason: string | null;
  review_status: 'open' | 'investigating' | 'resolved' | 'dismissed';
  resolution_notes: string | null;
  flagged_by: number | null;
  resolved_by: number | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  flagger?: Pick<User, 'id' | 'name' | 'email'>;
  resolver?: Pick<User, 'id' | 'name' | 'email'>;
  vehicle?: Pick<Vehicle, 'id' | 'make' | 'model' | 'license_plate'>;
}

export interface VehicleActivityLog {
  id: number;
  vehicle_id: number;
  activity_type: string;
  actor_type: string;
  actor_id: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface VehicleServiceHistoryRow {
  booking_id: number;
  booking_code: string | null;
  service_type: string;
  provider: { id: number; name: string | null } | null;
  booking_date: string;
  amount: string | number | null;
  status: string;
}

export interface VehiclePlatformReport {
  id: number;
  report_type: string;
  status: string;
  priority: string;
  description: string;
  created_at: string;
  booking?: { id: number; booking_code: string | null; status: string };
}

export interface VehiclesSummary {
  total_registered: number;
  active_vehicles: number;
  vehicles_with_active_bookings: number;
  flagged_vehicle_count: number;
  top_makes: { make: string; count: number }[];
  recently_added: Vehicle[];
  open_flags_sample: {
    id: number;
    vehicle_id: number;
    flag_type: string;
    review_status: string;
    created_at: string;
    vehicle?: Pick<Vehicle, 'id' | 'make' | 'model' | 'license_plate'>;
  }[];
}

export interface ServicePackage {
  id: number;
  name: string;
  service_id?: number;
  service?: Service;
}

/** @deprecated Use AdminService from @/types/catalog for admin services page */
export interface Service {
  id: number;
  name: string;
  description?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AddOn {
  id: number;
  name: string;
  price: string;
}

export interface BookingImage {
  id: number;
  booking_id: number;
  url: string;
  image_url: string;
  image_type?: string;
  type: string | null;
  created_at: string;
}

export interface BookingServiceImages {
  before: BookingImage[];
  after: BookingImage[];
  customer: BookingImage[];
}

export interface BookingTransaction {
  id: number;
  transaction_code: string;
  booking_id: number;
  user_id: number;
  currency: string;
  amount: string;
  status: string;
  stripe_payment_intent_id: string | null;
  payment_method_id: string | null;
  created_at: string;
  updated_at: string;
  booking?: Booking;
  user?: User;
}

export interface Review {
  id: number;
  booking_id: number;
  reviewer_user_id: number;
  reviewee_user_id: number;
  rating: number;
  message: string | null;
  created_at: string;
  reviewer?: User;
  reviewee?: User;
  images?: ReviewImage[];
}

export interface ReviewImage {
  id: number;
  review_id: number;
  url: string;
}

export interface Notification {
  id: number;
  user_id: number;
  booking_id: number | null;
  title: string;
  message: string;
  notification_type: string | null;
  data?: Record<string, unknown> | null;
  is_read: boolean;
  sent_status: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: number; name: string; email: string };
}

export interface BookingDispute {
  id: number;
  booking_id: number;
  customer_complaint: string | null;
  provider_response: string | null;
  admin_notes: string | null;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  resolved_by: number | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  booking?: Booking;
  resolver?: { id: number; name: string };
}

export interface BookingTimeline {
  id: number;
  source?: 'admin' | 'tracking';
  booking_id?: number;
  event_type: string;
  message: string | null;
  actor_type: string | null;
  actor_id: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface RefundRequest {
  id: number;
  booking_transaction_id: number;
  booking_id: number | null;
  user_id: number;
  amount: string | null;
  reason: string | null;
  status: 'requested' | 'approved' | 'rejected' | 'processing' | 'refunded';
  stripe_refund_id: string | null;
  processed_by: number | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
  booking_transaction?: BookingTransaction;
  user?: User;
}

export interface BookingDisputeStats {
  open: number;
  investigating: number;
  resolved: number;
  closed: number;
  total: number;
  avg_resolution_hours: number | null;
}

export interface FleetMapBooking {
  id: number;
  booking_code: string | null;
  status: string;
  tracking_status: string | null;
  service_type: string | null;
  scheduled_at: string | null;
  created_at: string | null;
  address: string | null;
  customer_lat: number | null;
  customer_lng: number | null;
  service_lat: number | null;
  service_lng: number | null;
  charging_lat: number | null;
  charging_lng: number | null;
  total_price: string | null;
  user: { id: number; name: string; email: string; phone: string | null } | null;
  provider: { id: number; name: string; email: string; phone: string | null } | null;
  provider_lat: number | null;
  provider_lng: number | null;
  provider_location_at: string | null;
}

export interface FleetMapFilters {
  status?: string;
  date_from?: string;
  date_to?: string;
  user_id?: number;
  provider_id?: number;
  page?: number;
  limit?: number;
}

export interface BookingDashboardStats {
  total_today: number;
  pending: number;
  active: number;
  // All-time totals (displayed on stat cards)
  completed: number;
  cancelled: number;
  disputed: number;
  total_revenue: number;
  // Today-only (kept for reference / future use)
  completed_today: number;
  cancelled_today: number;
  revenue_today: number;
}

export interface BookingDetailResponse {
  booking: Booking & {
    disputes?: BookingDispute[];
    timeline?: BookingTimeline[];
    refund_requests?: RefundRequest[];
    driver_locations?: { id: number; lat: string; lng: string; created_at: string }[];
    assigned_driver?: User & { driver_profile?: DriverProfile };
    service_images?: BookingServiceImages;
    vehicle?: Vehicle & { images?: (VehicleImage & { image_url?: string })[] };
    service_notes?: {
      vehicle_parked_location?: string | null;
      vehicle_parked_location_label?: string | null;
      provider_park_location?: string | null;
      provider_park_location_label?: string | null;
      vehicle_key_location?: string | null;
      vehicle_key_location_label?: string | null;
      key_return_location?: string | null;
      key_return_location_label?: string | null;
      parking_instructions?: string | null;
      notes?: string | null;
    };
  };
  providerRating: { avg_rating: string | null; review_count: number } | null;
}

export interface UserStats {
  total_bookings: number;
  status_breakdown: Record<string, number>;
  service_breakdown?: Record<string, number>;
  total_revenue?: string;
  total_paid?: string;
  total_transactions?: number;
  succeeded_transactions?: number;
  total_vehicles?: number;
  total_reviews: number;
  avg_rating: string | null;
  total_cancellations?: number;
  total_refunds?: string;
  total_cancellation_fees?: string;
  completion_rate: string;
  completed_bookings?: number;
  total_earnings?: string;
}

export interface UserDetailResponse {
  user: User;
  stats: UserStats | null;
  bookings: Booking[];
  transactions: BookingTransaction[];
  vehicles: Vehicle[];
  reviews: Review[];
  driverProfile: DriverProfile | null;
}

export interface DashboardStats {
  totalUsers: number;
  totalDrivers: number;
  totalCustomers: number;
  totalBookings: number;
  totalRevenue: number;
  activeBookings: number;
  pendingDriverApprovals: number;
  recentBookings: Booking[];
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  setToken: (token: string) => void;
}

export type SortDirection = 'asc' | 'desc';

export interface TableColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => React.ReactNode;
}

export interface FilterOption {
  label: string;
  value: string;
}
