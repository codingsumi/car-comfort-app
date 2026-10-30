export type SettingType = 'text' | 'number' | 'boolean' | 'json' | 'image' | 'color' | 'email' | 'url' | 'password';

export type SettingGroup =
  | 'general'
  | 'stripe'
  | 'onesignal'
  | 'email'
  | 'social_links'
  | 'finance'
  | 'theme'
  | 'invoice'
  | 'admin_panel'
  | 'maintenance'
  | 'notifications'
  | 'services'
  | 'provider_performance';

export interface SettingItem {
  key: string;
  value: string | number | boolean | null;
  type: SettingType;
  label: string;
  description: string;
  is_sensitive: boolean;
  group_name: SettingGroup;
  sort_order: number;
}

export type GroupSettings = Record<string, SettingItem>;
export type AllSettings = Partial<Record<SettingGroup, GroupSettings>>;

export interface AuditLogEntry {
  id: number;
  user_id: number;
  group_name: string;
  setting_key: string;
  old_value: string | null;
  new_value: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user?: {
    id: number;
    name: string;
    email: string;
  };
}

export interface AuditLogsResponse {
  logs: AuditLogEntry[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

export interface ServiceArea {
  id: number;
  name: string;
  country: string | null;
  state: string | null;
  county: string | null;
  city: string | null;
  zip_codes: string[];
  boundary_geojson: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SettingGroupConfig {
  key: SettingGroup;
  label: string;
  description: string;
  icon: string;
}

export const SETTING_GROUP_CONFIG: SettingGroupConfig[] = [
  { key: 'general', label: 'General', description: 'Basic application settings', icon: 'Cog6ToothIcon' },
  { key: 'stripe', label: 'Stripe', description: 'Payment gateway configuration', icon: 'CreditCardIcon' },
  { key: 'onesignal', label: 'OneSignal', description: 'Push notification API keys', icon: 'BellIcon' },
  { key: 'notifications', label: 'Push Toggles', description: 'Notification channel preferences', icon: 'BellIcon' },
  { key: 'email', label: 'Email / SMTP', description: 'Email delivery configuration', icon: 'EnvelopeIcon' },
  { key: 'social_links', label: 'Social Links', description: 'Social media profile URLs', icon: 'GlobeAltIcon' },
  { key: 'finance', label: 'Finance', description: 'Tax, commission, and fee settings', icon: 'BanknotesIcon' },
  { key: 'invoice', label: 'Invoice', description: 'Invoice company details', icon: 'DocumentTextIcon' },
  { key: 'maintenance', label: 'Maintenance', description: 'Maintenance mode controls', icon: 'WrenchIcon' },
  { key: 'services', label: 'Services', description: 'Service defaults and EV stations', icon: 'WrenchScrewdriverIcon' },
];
