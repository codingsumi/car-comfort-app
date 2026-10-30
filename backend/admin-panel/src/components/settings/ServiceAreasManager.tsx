'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { settingsService } from '@/services/settings.service';
import type { ServiceArea } from '@/types/settings';
import { Button, Input, Modal, ConfirmModal, Toggle, Badge } from '@/components/ui';

const emptyForm = {
  name: '',
  country: '',
  state: '',
  county: '',
  city: '',
  zip_codes: '',
  boundary_geojson: '',
  is_active: true,
};

export function ServiceAreasManager() {
  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editing, setEditing] = useState<ServiceArea | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await settingsService.getServiceAreas();
      setAreas(data);
    } catch {
      toast.error('Failed to load service areas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (area: ServiceArea) => {
    setEditing(area);
    setForm({
      name: area.name,
      country: area.country || '',
      state: area.state || '',
      county: area.county || '',
      city: area.city || '',
      zip_codes: area.zip_codes?.join(', ') || '',
      boundary_geojson: area.boundary_geojson ? JSON.stringify(area.boundary_geojson, null, 2) : '',
      is_active: area.is_active,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        country: form.country || null,
        state: form.state || null,
        county: form.county || null,
        city: form.city || null,
        zip_codes: form.zip_codes
          ? form.zip_codes.split(',').map((z) => z.trim()).filter(Boolean)
          : [],
        boundary_geojson: form.boundary_geojson ? JSON.parse(form.boundary_geojson) : null,
        is_active: form.is_active,
      };
      if (editing) {
        await settingsService.updateServiceArea(editing.id, payload);
        toast.success('Service area updated');
      } else {
        await settingsService.createServiceArea(payload);
        toast.success('Service area created');
      }
      setModalOpen(false);
      await load();
    } catch {
      toast.error('Failed to save service area');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await settingsService.deleteServiceArea(deleteId);
      toast.success('Service area deleted');
      setDeleteId(null);
      await load();
    } catch {
      toast.error('Failed to delete service area');
    }
  };

  if (loading) {
    return <div className="animate-pulse h-32 rounded-lg bg-neutral-100" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-secondary-900">Service Areas</h4>
          <p className="text-sm text-neutral-300">Geographic boundaries and zip code restrictions</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <PlusIcon className="mr-1 h-4 w-4" />
          Add Area
        </Button>
      </div>

      {areas.length === 0 ? (
        <p className="text-sm text-neutral-300">No service areas configured yet.</p>
      ) : (
        <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-100">
          {areas.map((area) => (
            <li key={area.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-secondary-900">{area.name}</p>
                <p className="text-xs text-neutral-300">
                  {[area.city, area.county, area.state, area.country].filter(Boolean).join(', ') || 'No location'}
                  {area.zip_codes?.length > 0 && ` · ${area.zip_codes.length} zip codes`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={area.is_active ? 'success' : 'neutral'}>
                  {area.is_active ? 'Active' : 'Inactive'}
                </Badge>
                <button type="button" onClick={() => openEdit(area)} className="text-neutral-300 hover:text-primary">
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setDeleteId(area.id)} className="text-neutral-300 hover:text-red-500">
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Service Area' : 'Add Service Area'}>
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <Input label="County" value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })} />
            <Input label="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
            <Input label="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          </div>
          <Input
            label="Zip Codes"
            value={form.zip_codes}
            onChange={(e) => setForm({ ...form, zip_codes: e.target.value })}
            hint="Comma-separated postal codes"
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary-700">Boundary GeoJSON</label>
            <textarea
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm font-mono"
              rows={4}
              value={form.boundary_geojson}
              onChange={(e) => setForm({ ...form, boundary_geojson: e.target.value })}
              placeholder='{"type":"Polygon","coordinates":[...]}'
            />
            <p className="mt-1 text-xs text-neutral-300">Optional GeoJSON polygon for map-based boundaries</p>
          </div>
          <Toggle label="Active" checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>Save</Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Service Area"
        message="Are you sure you want to delete this service area?"
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
