export type BookingChargeServiceApplicability = 'all' | 'car_wash' | 'ev_charging';

export interface BookingCharge {
  id: number;
  code: string;
  label: string;
  amount: string | number;
  is_active: boolean;
  sort_order: number;
  service_applicability: BookingChargeServiceApplicability;
  created_at: string;
  updated_at: string;
}

export interface BookingChargeForm {
  code: string;
  label: string;
  amount: string;
  is_active: boolean;
  service_applicability: BookingChargeServiceApplicability;
}

export interface BookingChargePayload {
  label: string;
  amount: number;
  is_active: boolean;
  service_applicability?: BookingChargeServiceApplicability;
}

export interface CreateBookingChargePayload extends BookingChargePayload {
  code: string;
}
