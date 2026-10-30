'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PageHeader } from '@/components/shared/PageHeader';
import { NotificationSubNav } from '@/components/notifications/NotificationSubNav';
import { Table, Badge, Button, Modal, Input, Select, ConfirmModal, Toggle } from '@/components/ui';
import { notificationManagementService } from '@/services/notificationManagement.service';
import type { TableColumn } from '@/types';
import type { NotificationTemplate, TemplateType } from '@/types/notificationManagement';

const TYPES: TemplateType[] = ['booking', 'promotional', 'payment', 'refund', 'provider', 'support'];

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<NotificationTemplate | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({
    template_name: '',
    template_type: 'promotional' as TemplateType,
    title_template: '',
    body_template: '',
    is_active: true,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['notification-templates'],
    queryFn: () => notificationManagementService.listTemplates(),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      editing
        ? notificationManagementService.updateTemplate(editing.id, form)
        : notificationManagementService.createTemplate(form),
    onSuccess: () => {
      toast.success(editing ? 'Template updated' : 'Template created');
      setModalOpen(false);
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['notification-templates'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => notificationManagementService.deleteTemplate(id),
    onSuccess: () => {
      toast.success('Template deleted');
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['notification-templates'] });
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm({
      template_name: '',
      template_type: 'promotional',
      title_template: '',
      body_template: '',
      is_active: true,
    });
    setModalOpen(true);
  };

  const openEdit = (t: NotificationTemplate) => {
    setEditing(t);
    setForm({
      template_name: t.template_name,
      template_type: t.template_type,
      title_template: t.title_template,
      body_template: t.body_template,
      is_active: t.is_active,
    });
    setModalOpen(true);
  };

  const columns: TableColumn<NotificationTemplate>[] = [
    { key: 'template_name', label: 'Name' },
    {
      key: 'template_type',
      label: 'Type',
      render: (_, r) => <Badge variant="neutral">{r.template_type}</Badge>,
    },
    {
      key: 'is_active',
      label: 'Active',
      render: (_, r) => <Badge variant={r.is_active ? 'success' : 'neutral'}>{r.is_active ? 'Yes' : 'No'}</Badge>,
    },
    {
      key: 'id',
      label: '',
      render: (_, r) => (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => openEdit(r)}>
            Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDeleteId(r.id)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Templates"
        description="Reusable notification templates with dynamic variables"
        actions={<Button size="sm" onClick={openCreate}>Create template</Button>}
      />
      <div className="mb-6">
        <NotificationSubNav />
      </div>

      <Table columns={columns} data={data ?? []} isLoading={isLoading} rowKey={(r) => r.id} emptyMessage="No templates" />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit template' : 'Create template'}>
        <div className="space-y-4">
          <Input label="Name" value={form.template_name} onChange={(e) => setForm({ ...form, template_name: e.target.value })} />
          <Select
            label="Type"
            value={form.template_type}
            onChange={(e) => setForm({ ...form, template_type: e.target.value as TemplateType })}
            options={TYPES.map((t) => ({ value: t, label: t }))}
          />
          <Input label="Title template" value={form.title_template} onChange={(e) => setForm({ ...form, title_template: e.target.value })} />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-secondary-700">Body template</span>
            <textarea
              className="input w-full min-h-[120px]"
              value={form.body_template}
              onChange={(e) => setForm({ ...form, body_template: e.target.value })}
            />
          </label>
          <Toggle label="Active" checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} />
          <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
            Save
          </Button>
        </div>
      </Modal>

      <ConfirmModal
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Delete template"
        message="Delete this template permanently?"
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </>
  );
}
