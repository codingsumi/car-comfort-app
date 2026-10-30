'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Input, ImageUpload, ColorSwatchPicker } from '@/components/ui';
import { ADMIN_PRIMARY_OPTIONS, BRAND_COLORS, clampToPrimaryPalette } from '@/lib/brandColors';
import { settingsService } from '@/services/settings.service';
import { useAdminThemeStore } from '@/store/adminTheme';
import type { AdminPanelBranding } from '@/types/adminBranding';
import type { GroupSettings } from '@/types/settings';
import toast from 'react-hot-toast';
import { AdminLogo } from '@/components/theme/AdminLogo';
import { cn } from '@/lib/cn';

function groupToBranding(settings: GroupSettings): AdminPanelBranding {
  const val = (key: string) => settings[key]?.value;
  return {
    name: (val('admin_panel_name') as string) || 'Car Comfort',
    logo: (val('admin_panel_logo') as string) || null,
    favicon: (val('admin_panel_favicon') as string) || null,
    primary_color: clampToPrimaryPalette((val('admin_panel_primary_color') as string) || BRAND_COLORS.primary),
  };
}

export function AdminBrandingForm() {
  const setBranding = useAdminThemeStore((s) => s.setBranding);
  const [form, setForm] = useState<AdminPanelBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await settingsService.getByGroup('admin_panel');
      const branding = groupToBranding(data);
      setForm(branding);
      setBranding(branding);
    } catch {
      toast.error('Failed to load admin branding settings');
    } finally {
      setLoading(false);
    }
  }, [setBranding]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const updateField = <K extends keyof AdminPanelBranding>(key: K, value: AdminPanelBranding[K]) => {
    setForm((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [key]: value };
      setBranding(next);
      return next;
    });
  };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await settingsService.updateByGroup('admin_panel', {
        admin_panel_name: form.name,
        admin_panel_logo: form.logo,
        admin_panel_favicon: form.favicon,
        admin_panel_primary_color: form.primary_color,
      });
      toast.success('Admin panel branding saved');
      await loadSettings();
    } catch {
      toast.error('Failed to save branding settings');
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (file: File): Promise<string> => {
    const result = await settingsService.uploadFile(file);
    return result.url;
  };

  if (loading || !form) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-4 w-1/3 rounded bg-white border border-neutral-400/30" />
        <div className="h-32 rounded bg-white border border-neutral-400/30" />
        <div className="h-10 rounded bg-white border border-neutral-400/30" />
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-6">
        <div>
          <h3 className="text-base font-semibold text-secondary-900">Admin Panel Branding</h3>
          <p className="mt-1 text-sm text-neutral-300">
            Customize the admin dashboard appearance. Changes apply instantly across the panel.
          </p>
        </div>

        <Input
          label="Admin Panel Name"
          value={form.name}
          onChange={(e) => updateField('name', e.target.value)}
          hint="Shown in sidebar, header, and browser title"
        />

        <ImageUpload
          label="Admin Panel Logo"
          description="Displayed in sidebar and login page"
          value={form.logo}
          onChange={(url) => updateField('logo', url)}
          onUpload={handleUpload}
        />

        <ImageUpload
          label="Admin Panel Favicon"
          description="Browser tab icon"
          value={form.favicon}
          onChange={(url) => updateField('favicon', url)}
          onUpload={handleUpload}
        />

        <ColorSwatchPicker
          label="Primary Color"
          description="Accent color for buttons, links, and highlights"
          value={form.primary_color}
          options={ADMIN_PRIMARY_OPTIONS}
          onChange={(v) => updateField('primary_color', v)}
        />

        <div className="flex justify-end border-t border-neutral-400/30 pt-4">
          <Button onClick={handleSave} loading={saving}>
            Save to Database
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-secondary-900">Live Preview</h4>
        <BrandingPreview branding={form} />
      </div>
    </div>
  );
}

function BrandingPreview({ branding }: { branding: AdminPanelBranding }) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-400/30 shadow-sm">
      <div className="flex h-12 items-center justify-between border-b border-neutral-400/30 bg-white px-4">
        <span className="text-xs font-medium text-secondary-600">Header</span>
        <div className="h-6 w-6 rounded-full" style={{ backgroundColor: branding.primary_color }} />
      </div>
      <div className="flex h-64">
        <div className="w-40 border-r border-neutral-400/30 bg-white p-3">
          <AdminLogo size="sm" subtitle="Admin Panel" />
          <div className="mt-4 space-y-1">
            {['Dashboard', 'Bookings', 'Settings'].map((item, i) => (
              <div
                key={item}
                className={cn('rounded-lg px-2 py-1.5 text-xs font-medium', i !== 0 && 'text-neutral-400')}
                style={
                  i === 0
                    ? { backgroundColor: `${branding.primary_color}20`, color: branding.primary_color }
                    : undefined
                }
              >
                {item}
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 bg-white p-4">
          <div
            className="inline-flex rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
            style={{ backgroundColor: branding.primary_color }}
          >
            Primary Button
          </div>
        </div>
      </div>
    </div>
  );
}
