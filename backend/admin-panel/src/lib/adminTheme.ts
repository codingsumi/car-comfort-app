import type { AdminPanelBranding } from '@/types/adminBranding';
import { DEFAULT_ADMIN_BRANDING, ADMIN_BRANDING_STORAGE_KEY } from '@/types/adminBranding';
import { BRAND_COLORS } from '@/lib/brandColors';
import { BASE_PATH, resolveMediaUrl } from '@/lib/paths';

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace('#', '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized;

  if (full.length !== 6) return null;

  const num = parseInt(full, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function applyBrandingToDocument(branding: AdminPanelBranding): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const primary = branding.primary_color || DEFAULT_ADMIN_BRANDING.primary_color;
  const rgb = hexToRgb(primary) || hexToRgb(DEFAULT_ADMIN_BRANDING.primary_color)!;

  root.style.setProperty('--admin-primary', primary);
  root.style.setProperty('--admin-primary-rgb', `${rgb.r} ${rgb.g} ${rgb.b}`);
  root.style.setProperty('--admin-sidebar-bg', BRAND_COLORS.tertiary);
  root.style.setProperty('--admin-header-bg', BRAND_COLORS.tertiary);
  root.classList.remove('dark');
  root.dataset.adminTheme = 'light';

  if (branding.favicon) {
    updateFaviconLink(resolveMediaUrl(branding.favicon));
  }

  if (branding.name) {
    document.title = `${branding.name} Admin`;
  }
}

export function updateFaviconLink(href: string): void {
  if (typeof document === 'undefined') return;

  let link = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href;
}

export function loadCachedBranding(): AdminPanelBranding | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ADMIN_BRANDING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AdminPanelBranding>;
    return {
      name: parsed.name || DEFAULT_ADMIN_BRANDING.name,
      logo: parsed.logo ?? null,
      favicon: parsed.favicon ?? null,
      primary_color: parsed.primary_color || DEFAULT_ADMIN_BRANDING.primary_color,
    };
  } catch {
    return null;
  }
}

export function cacheBranding(branding: AdminPanelBranding): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ADMIN_BRANDING_STORAGE_KEY, JSON.stringify(branding));
}

/** Inline script injected before paint to prevent theme flash */
export const THEME_INIT_SCRIPT = `
(function() {
  try {
    var raw = localStorage.getItem('${ADMIN_BRANDING_STORAGE_KEY}');
    if (!raw) return;
    var b = JSON.parse(raw);
    var root = document.documentElement;
    var primary = b.primary_color || '#E4101F';
    root.style.setProperty('--admin-primary', primary);
    var hex = primary.replace('#','');
    if (hex.length === 3) hex = hex.split('').map(function(c){return c+c}).join('');
    var num = parseInt(hex, 16);
    var r = (num >> 16) & 255, g = (num >> 8) & 255, bl = num & 255;
    root.style.setProperty('--admin-primary-rgb', r + ' ' + g + ' ' + bl);
    root.style.setProperty('--admin-sidebar-bg', '#FFFFFF');
    root.style.setProperty('--admin-header-bg', '#FFFFFF');
    if (b.favicon) {
      var fav = b.favicon;
      var origin = window.location.origin || 'http://localhost:4002';
      var base = '${BASE_PATH}';
      if (fav.indexOf('http') !== 0) {
        if (fav.indexOf(base) === 0) fav = origin + fav;
        else if (fav.indexOf('/uploads') === 0) fav = origin + base + fav;
      }
      var link = document.querySelector("link[rel*='icon']");
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = fav;
    }
    if (b.name) document.title = b.name + ' Admin';
  } catch(e) {}
})();
`;
