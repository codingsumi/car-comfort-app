import type { SettingGroup } from '@/types/settings';

export interface SettingsNavItem {
  href: string;
  label: string;
  description: string;
  group?: SettingGroup | SettingGroup[];
}

/** All settings sections — shown in the settings module sidebar */
export const SETTINGS_NAV: SettingsNavItem[] = [
  {
    href: '/settings/legal-pages',
    label: 'Legal Pages',
    description: 'Terms, privacy, waiver, and provider legal content for the apps',
  },
  { href: '/settings/general', label: 'General', description: 'App name, contact, timezone, currency', group: 'general' },
  { href: '/settings/admin-branding', label: 'Admin Branding', description: 'Admin panel logo, favicon, and colors' },
  { href: '/settings/email', label: 'Email', description: 'SMTP configuration', group: 'email' },
  { href: '/settings/notifications', label: 'Notifications', description: 'OneSignal and push toggles', group: ['onesignal', 'notifications'] },
  { href: '/settings/social-links', label: 'Social Links', description: 'Social media profiles', group: 'social_links' },
  { href: '/settings/maintenance', label: 'Maintenance', description: 'Maintenance mode controls', group: 'maintenance' },
  { href: '/settings/company', label: 'Company & Invoice', description: 'Invoice and company details', group: 'invoice' },
  { href: '/settings/audit-logs', label: 'Audit Logs', description: 'Settings change history' },
  { href: '/settings/tutorial', label: 'Customer Tutorials', description: 'Multiple tutorial videos for the customer app Settings menu' },
  { href: '/settings/tutorial/driver', label: 'Service Provider Tutorial', description: 'Onboarding tutorial video and instructions for new providers' },
  {
    href: '/settings/tutorial/driver/videos',
    label: 'Provider Learning Tutorials',
    description: 'Multiple learning videos for providers (EV charging, car wash, accidents, vehicle guides, etc.)',
  },
];
