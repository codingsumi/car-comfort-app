'use client';

import { useEffect, type ReactNode } from 'react';
import { useAdminThemeStore } from '@/store/adminTheme';
import { applyBrandingToDocument } from '@/lib/adminTheme';

export function AdminThemeProvider({ children }: { children: ReactNode }) {
  const branding = useAdminThemeStore((s) => s.branding);
  const fetchBranding = useAdminThemeStore((s) => s.fetchBranding);

  useEffect(() => {
    void fetchBranding();
  }, [fetchBranding]);

  useEffect(() => {
    applyBrandingToDocument(branding);
  }, [branding]);

  return <>{children}</>;
}
