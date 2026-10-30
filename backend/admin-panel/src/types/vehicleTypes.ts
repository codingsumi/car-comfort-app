export type VehicleTypeStatus = 'active' | 'inactive';

export interface AdminVehicleType {
  id: number;
  name: string;
  status: VehicleTypeStatus;
  charges: string | number;
  vehicle_count: number;
  created_at: string;
  updated_at: string;
}

export interface AdminVehicleTypeForm {
  name: string;
  status: VehicleTypeStatus;
  charges: string;
}

export interface AdminVehicleTypePayload {
  name: string;
  status: VehicleTypeStatus;
  charges: number;
}
