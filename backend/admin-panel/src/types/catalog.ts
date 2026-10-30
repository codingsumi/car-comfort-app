export type CatalogServiceType = 'car_wash' | 'ev_charging' | 'combo';

export interface AdminService {
  id: number;
  service_type: CatalogServiceType;
  name: string;
  icon: string | null;
  package_count: number;
  active_package_count: number;
  created_at: string;
  updated_at: string;
}

export interface AdminPackage {
  id: number;
  service_id: number;
  service_type: CatalogServiceType;
  service_type_label: string;
  package_name: string;
  price: string | number;
  base_price: string | number;
  provider_compensation_type: 'fixed' | 'percentage';
  provider_compensation_value: string | number;
  on_demand_provider_compensation_type: 'fixed' | 'percentage' | null;
  on_demand_provider_compensation_value: string | number | null;
  duration_minutes: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminPackageForm {
  package_name: string;
  price: string;
  provider_compensation_type: 'fixed' | 'percentage';
  provider_compensation_value: string;
  on_demand_provider_compensation_type: 'fixed' | 'percentage' | '';
  on_demand_provider_compensation_value: string;
  service_type: CatalogServiceType;
  is_active: boolean;
  duration_minutes: string;
  description: string;
}
