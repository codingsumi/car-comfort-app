import { create } from 'zustand';
import axios from 'axios';
import type { AdminPanelBranding } from '@/types/adminBranding';
import { DEFAULT_ADMIN_BRANDING } from '@/types/adminBranding';
import { applyBrandingToDocument, cacheBranding, loadCachedBranding } from '@/lib/adminTheme';
import { getApiBaseUrl, normalizeBackendOrigin } from '@/lib/paths';

interface AdminThemeState {
  branding: AdminPanelBranding;
  isLoaded: boolean;
  isLoading: boolean;
  setBranding: (branding: Partial<AdminPanelBranding>) => void;
  applyBranding: (branding: AdminPanelBranding) => void;
  fetchBranding: () => Promise<void>;
}

export const useAdminThemeStore = create<AdminThemeState>((set, get) => ({
  branding: loadCachedBranding() || DEFAULT_ADMIN_BRANDING,
  isLoaded: false,
  isLoading: false,

  setBranding: (partial) => {
    const next = { ...get().branding, ...partial };
    set({ branding: next });
    applyBrandingToDocument(next);
    cacheBranding(next);
  },

  applyBranding: (branding) => {
    set({ branding });
    applyBrandingToDocument(branding);
    cacheBranding(branding);
  },

  fetchBranding: async () => {
    if (get().isLoading) return;
    set({ isLoading: true });

    try {
      const brandingUrl =
        typeof window !== 'undefined'
          ? `${getApiBaseUrl()}/admin/branding`
          : `${normalizeBackendOrigin(process.env.NEXT_PUBLIC_API_URL)}/api/admin/branding`;
      const { data } = await axios.get(brandingUrl);
      const branding: AdminPanelBranding = data.data;
      get().applyBranding(branding);
      set({ isLoaded: true, isLoading: false });
    } catch {
      const cached = loadCachedBranding();
      if (cached) {
        get().applyBranding(cached);
      }
      set({ isLoaded: true, isLoading: false });
    }
  },
}));
