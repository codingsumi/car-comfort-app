'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Input, Select, Toggle, ImageUpload, ColorPicker } from '@/components/ui';
import { settingsService } from '@/services/settings.service';
import type { GroupSettings, SettingGroup, SettingItem } from '@/types/settings';
import toast from 'react-hot-toast';

interface SettingsFormProps {
  group: SettingGroup;
  title: string;
  description?: string;
}

const REQUIRED_INVOICE_SETTINGS: Record<string, SettingItem> = {
  invoice_website: {
    key: 'invoice_website',
    value: '',
    type: 'url',
    label: 'Company Website',
    description: 'Website shown on customer receipts',
    is_sensitive: false,
    group_name: 'invoice',
    sort_order: 3,
  },
};

export function SettingsForm({ group, title, description }: SettingsFormProps) {
  const [settings, setSettings] = useState<GroupSettings | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await settingsService.getByGroup(group);
      // Older production databases may not yet have newer invoice fields.
      // Render them immediately so an admin can save without waiting on a migration.
      const completeSettings: GroupSettings = group === 'invoice'
        ? { ...REQUIRED_INVOICE_SETTINGS, ...data }
        : data;
      setSettings(completeSettings);
      const initial: Record<string, unknown> = {};
      Object.values(completeSettings).forEach((item: SettingItem) => {
        initial[item.key] = item.value;
      });
      setFormData(initial);
    } catch {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [group]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleChange = (key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleBooleanChange = async (item: SettingItem, checked: boolean) => {
    setFormData((prev) => ({ ...prev, [item.key]: checked }));
    try {
      await settingsService.updateByGroup(group, { [item.key]: checked });
      toast.success(`${item.label} ${checked ? 'enabled' : 'disabled'}`);
    } catch {
      toast.error(`Failed to save ${item.label}`);
      await loadSettings();
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsService.updateByGroup(group, formData);
      toast.success(`${title} updated successfully`);
      await loadSettings();
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (file: File): Promise<string> => {
    const result = await settingsService.uploadFile(file);
    return result.url;
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-4 w-1/3 rounded bg-neutral-100" />
        <div className="h-10 rounded bg-neutral-100" />
        <div className="h-10 rounded bg-neutral-100" />
        <div className="h-10 rounded bg-neutral-100" />
      </div>
    );
  }

  if (!settings) return null;

  const items = Object.values(settings).sort((a: SettingItem, b: SettingItem) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-secondary-900">{title}</h3>
        {description && <p className="mt-1 text-sm text-neutral-300">{description}</p>}
      </div>

      <div className="space-y-5">
        {items.map((item: SettingItem) => {
          const displayItem = group === 'invoice' && item.key === 'invoice_gst_vat_number'
            ? {
                ...item,
                label: 'Tax ID / GST/VAT Number',
                description: 'Tax registration number shown on customer receipts',
              }
            : item;

          return (
          <SettingField
            key={item.key}
            item={displayItem}
            value={formData[item.key]}
            onChange={(val) => handleChange(item.key, val)}
            onBooleanChange={(checked) => void handleBooleanChange(item, checked)}
            onUpload={handleUpload}
          />
          );
        })}
      </div>

      <div className="flex flex-col items-end gap-2 border-t border-neutral-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-neutral-300">
          Switches save immediately. Text fields use Save Changes.
        </p>
        <Button onClick={handleSave} loading={saving}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}

interface SettingFieldProps {
  item: SettingItem;
  value: unknown;
  onChange: (value: unknown) => void;
  onBooleanChange: (checked: boolean) => void;
  onUpload: (file: File) => Promise<string>;
}

function SettingField({ item, value, onChange, onBooleanChange, onUpload }: SettingFieldProps) {
  switch (item.type) {
    case 'boolean':
      return (
        <Toggle
          label={item.label}
          description={item.description}
          checked={value === true || value === 'true'}
          onChange={onBooleanChange}
        />
      );

    case 'image':
      return (
        <ImageUpload
          label={item.label}
          description={item.description}
          value={value as string | null}
          onChange={onChange}
          onUpload={onUpload}
        />
      );

    case 'color':
      return (
        <ColorPicker
          label={item.label}
          description={item.description}
          value={(value as string) || '#000000'}
          onChange={onChange}
        />
      );

    case 'password':
      return (
        <Input
          label={item.label}
          type="password"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          hint={item.description}
          placeholder={item.is_sensitive ? '••••••••' : ''}
        />
      );

    case 'number':
      return (
        <Input
          label={item.label}
          type="number"
          value={value !== null && value !== undefined ? String(value) : ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          hint={item.description}
        />
      );

    case 'email':
      return (
        <Input
          label={item.label}
          type="email"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          hint={item.description}
        />
      );

    case 'url':
      return (
        <Input
          label={item.label}
          type="url"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          hint={item.description}
          placeholder="https://"
        />
      );

    case 'json':
      return (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-secondary-500">{item.label}</label>
          <textarea
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 font-mono text-sm text-secondary-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            rows={6}
            value={typeof value === 'string' ? value : JSON.stringify(value ?? {}, null, 2)}
            onChange={(e) => {
              try {
                onChange(JSON.parse(e.target.value));
              } catch {
                onChange(e.target.value);
              }
            }}
          />
          {item.description && <p className="mt-1 text-xs text-neutral-300">{item.description}</p>}
        </div>
      );

    default:
      if (item.key === 'smtp_encryption') {
        return (
          <Select
            label={item.label}
            value={(value as string) || 'tls'}
            onChange={(e) => onChange(e.target.value)}
            options={[
              { label: 'None', value: 'none' },
              { label: 'TLS', value: 'tls' },
              { label: 'SSL', value: 'ssl' },
            ]}
          />
        );
      }

      if (item.key === 'stripe_payment_mode') {
        return (
          <Select
            label={item.label}
            value={(value as string) || 'test'}
            onChange={(e) => onChange(e.target.value)}
            options={[
              { label: 'Test', value: 'test' },
              { label: 'Live', value: 'live' },
            ]}
          />
        );
      }

      if (item.key === 'theme_sidebar_style') {
        return (
          <Select
            label={item.label}
            value={(value as string) || 'light'}
            onChange={(e) => onChange(e.target.value)}
            options={[
              { label: 'Light', value: 'light' },
              { label: 'Dark', value: 'dark' },
              { label: 'Brand', value: 'brand' },
            ]}
          />
        );
      }

      if (item.key === 'admin_panel_theme_mode') {
        return (
          <Select
            label={item.label}
            value={(value as string) || 'light'}
            onChange={(e) => onChange(e.target.value)}
            options={[
              { label: 'Light', value: 'light' },
              { label: 'Dark', value: 'dark' },
              { label: 'System', value: 'system' },
            ]}
          />
        );
      }

      return (
        <Input
          label={item.label}
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          hint={item.description}
        />
      );
  }
}
