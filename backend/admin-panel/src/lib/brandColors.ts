/**
 * Approved brand palette for the admin panel.
 * Do NOT use mediumLight (#C4C9D1) or light (#ECEEF1) — excluded per brand guide.
 */
export const BRAND_COLORS = {
  primary: '#E4101F',
  secondary: '#000000',
  tertiary: '#FFFFFF',
  danger: '#FF7A00',
  warning: '#FFA92C',
  success: '#00A416',
  neutral: {
    black: '#000000',
    dark: '#2D3035',
    mediumDark: '#505761',
    medium: '#757D8B',
  },
} as const;

/** Selectable primary accent colors for admin branding */
export const ADMIN_PRIMARY_OPTIONS = [
  { label: 'Primary Red', value: BRAND_COLORS.primary },
  { label: 'Danger Orange', value: BRAND_COLORS.danger },
  { label: 'Warning', value: BRAND_COLORS.warning },
  { label: 'Success Green', value: BRAND_COLORS.success },
] as const;

/** Snap primary color to one of the allowed accent swatches */
export function clampToPrimaryPalette(hex: string): string {
  const normalized = hex?.toUpperCase?.() || '';
  const match = ADMIN_PRIMARY_OPTIONS.find((o) => o.value.toUpperCase() === normalized);
  return match?.value ?? BRAND_COLORS.primary;
}
