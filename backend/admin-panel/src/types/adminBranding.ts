export interface AdminPanelBranding {
  name: string;
  logo: string | null;
  favicon: string | null;
  primary_color: string;
}

export const DEFAULT_ADMIN_BRANDING: AdminPanelBranding = {
  name: 'Car Comfort',
  logo: null,
  favicon: null,
  primary_color: '#E4101F',
};

export const ADMIN_BRANDING_STORAGE_KEY = 'admin-panel-branding';
