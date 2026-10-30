'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared/PageHeader';
import { Table, Pagination, Button, Badge, ConfirmModal, EmptyState } from '@/components/ui';
import { LegalPageFormModal } from '@/components/settings/LegalPageFormModal';
import { LegalPagesSortableTable } from '@/components/settings/LegalPagesSortableTable';
import {
  legalPagesService,
  type LegalPage,
  type LegalPageAudience,
  type LegalPagePayload,
} from '@/services/legalPages.service';
import type { TableColumn } from '@/types';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  UserGroupIcon,
  TruckIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';

const PAGE_SIZE = 100;

const AUDIENCE_LABEL: Record<LegalPageAudience, string> = {
  customer: 'Customer app',
  provider: 'Provider app',
  common: 'Both apps',
};

const AUDIENCE_TABS: Array<{
  id: LegalPageAudience;
  label: string;
  description: string;
  icon: typeof UserGroupIcon;
}> = [
  {
    id: 'customer',
    label: 'Customer app',
    description: 'Terms, privacy, waiver (required at signup), and support for customers',
    icon: UserGroupIcon,
  },
  {
    id: 'provider',
    label: 'Provider app',
    description:
      'NDA, contractor agreement, privacy, waiver, vehicle agreement, terms, and background check PDF (onboarding step 5)',
    icon: TruckIcon,
  },
  {
    id: 'common',
    label: 'Both apps',
    description: 'Shared pages shown to customers and providers (e.g. policies, FAQs)',
    icon: GlobeAltIcon,
  },
];

export default function LegalPagesPage() {
  const queryClient = useQueryClient();
  const [audience, setAudience] = useState<LegalPageAudience>('customer');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<LegalPage | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LegalPage | null>(null);
  const [moveTarget, setMoveTarget] = useState<{
    page: LegalPage;
    audience: LegalPageAudience;
  } | null>(null);

  const canReorder = !search && statusFilter === 'all';

  const { data, isLoading } = useQuery({
    queryKey: ['legal-pages', audience, page, search, statusFilter],
    queryFn: () =>
      legalPagesService.list({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        audience,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: LegalPagePayload) => legalPagesService.create(payload),
    onSuccess: () => {
      toast.success('Legal page created');
      queryClient.invalidateQueries({ queryKey: ['legal-pages'] });
      setFormOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data: payload }: { id: number; data: Partial<LegalPagePayload> }) =>
      legalPagesService.update(id, payload),
    onSuccess: () => {
      toast.success('Legal page updated');
      queryClient.invalidateQueries({ queryKey: ['legal-pages'] });
      setFormOpen(false);
      setEditingPage(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => legalPagesService.delete(id),
    onSuccess: () => {
      toast.success('Legal page deleted');
      queryClient.invalidateQueries({ queryKey: ['legal-pages'] });
      setDeleteTarget(null);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (ordered_ids: number[]) =>
      legalPagesService.reorder({ audience, ordered_ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legal-pages'] });
    },
    onError: () => {
      toast.error('Could not save order');
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({
      id,
      targetAudience,
    }: {
      id: number;
      targetAudience: LegalPageAudience;
    }) => legalPagesService.update(id, { audience: targetAudience }),
    onSuccess: (_data, variables) => {
      toast.success(`Moved to ${AUDIENCE_LABEL[variables.targetAudience]}`);
      queryClient.invalidateQueries({ queryKey: ['legal-pages'] });
      setMoveTarget(null);
      setAudience(variables.targetAudience);
      setPage(1);
    },
    onError: (err: unknown) => {
      const message =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        err.response &&
        typeof err.response === 'object' &&
        'data' in err.response &&
        err.response.data &&
        typeof err.response.data === 'object' &&
        'message' in err.response.data &&
        typeof err.response.data.message === 'string'
          ? err.response.data.message
          : 'Could not move page (slug may already exist in that collection)';
      toast.error(message);
    },
  });

  const handleFormSubmit = (payload: LegalPagePayload) => {
    if (editingPage) {
      updateMutation.mutate({ id: editingPage.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (legalPage: LegalPage) => {
    setAudience(legalPage.audience);
    setEditingPage(legalPage);
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditingPage(null);
  };

  const switchAudience = (next: LegalPageAudience) => {
    setAudience(next);
    setPage(1);
    setSearch('');
    setStatusFilter('all');
    setEditingPage(null);
    setFormOpen(false);
  };

  const rows = data?.rows ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalItems = data?.count ?? 0;
  const activeTab = AUDIENCE_TABS.find((t) => t.id === audience)!;

  const columns: TableColumn<LegalPage>[] = [
    {
      key: 'title',
      label: 'Title',
      render: (_value, row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50">
            <DocumentTextIcon className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-secondary-900">{row.title}</p>
            <p className="text-xs text-neutral-300">/{row.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (_value, row) => (
        <div className="flex flex-wrap gap-1">
          <Badge variant={row.status ? 'success' : 'warning'} dot>
            {row.status ? 'Published' : 'Draft'}
          </Badge>
          {row.requires_agreement && <Badge variant="primary">Signup required</Badge>}
        </div>
      ),
    },
    {
      key: 'meta_title',
      label: 'Content',
      render: (_value, row) => {
        if (row.slug === 'background-check-authorization') {
          const pdf = row.description_json?.pdf_url?.trim();
          return pdf ? (
            <Badge variant="primary">PDF uploaded</Badge>
          ) : (
            <Badge variant="warning">PDF required</Badge>
          );
        }
        return <span className="text-sm text-neutral-300">{row.meta_title || 'HTML'}</span>;
      },
    },
    {
      key: 'updated_at',
      label: 'Last Updated',
      render: (_value, row) => (
        <span className="text-sm text-neutral-300">
          {new Date(row.updated_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (_value, row) => (
        <div
          className="flex items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <select
            value=""
            onChange={(e) => {
              const next = e.target.value as LegalPageAudience;
              if (!next || next === row.audience) return;
              setMoveTarget({ page: row, audience: next });
              e.target.value = '';
            }}
            className="max-w-[8.5rem] rounded-lg border border-neutral-200 bg-white py-1.5 pl-2 pr-7 text-xs text-secondary-600 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            aria-label={`Move ${row.title} to another collection`}
          >
            <option value="">Move to…</option>
            {(['customer', 'provider', 'common'] as LegalPageAudience[])
              .filter((a) => a !== row.audience)
              .map((a) => (
                <option key={a} value={a}>
                  {AUDIENCE_LABEL[a]}
                </option>
              ))}
          </select>
          <button
            type="button"
            onClick={() => handleEdit(row)}
            className="rounded-lg p-2 text-neutral-300 hover:bg-neutral-100 hover:text-secondary-500"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(row)}
            className="rounded-lg p-2 text-neutral-300 hover:bg-danger-50 hover:text-danger"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Legal Pages"
        description="Manage legal content for customers, providers, or both apps"
        actions={
          <Button
            onClick={() => {
              setEditingPage(null);
              setFormOpen(true);
            }}
            icon={<PlusIcon className="h-4 w-4" />}
          >
            Add{' '}
            {audience === 'customer' ? 'Customer' : audience === 'provider' ? 'Provider' : 'Common'}{' '}
            Page
          </Button>
        }
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {AUDIENCE_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.id === audience;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => switchAudience(tab.id)}
              className={`rounded-xl border-2 bg-white p-4 text-left transition-colors ${
                active ? 'border-primary' : 'border-secondary-900 hover:border-neutral-700'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                  <Icon
                    className={`h-5 w-5 ${active ? 'text-primary' : 'text-neutral-400'}`}
                  />
                </div>
                <div>
                  <p className="font-semibold text-secondary-900">{tab.label}</p>
                  <p className="mt-1 text-sm text-neutral-400">{tab.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-sm text-neutral-400">
        Editing <span className="font-medium text-secondary-700">{activeTab.label}</span> content.
        Use <strong>Both apps</strong> for pages every user should see. Customer-only pages (e.g. waiver)
        stay under Customer. Slugs are unique per audience.
        {canReorder ? (
          <>
            {' '}
            <strong>Drag</strong> rows by the handle to set display order in the app; use{' '}
            <strong>Move to…</strong> to change collection.
          </>
        ) : (
          <>
            {' '}
            Clear search and status filters to reorder pages.
          </>
        )}
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-300" />
          <input
            type="text"
            placeholder="Search by title or slug..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="block w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-10 pr-4 text-sm text-secondary-900 placeholder:text-neutral-300 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-secondary-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="all">All Status</option>
          <option value="true">Published</option>
          <option value="false">Draft</option>
        </select>
      </div>

      <div className="mt-4 rounded-xl border border-neutral-100 bg-white shadow-sm">
        {!isLoading && rows.length === 0 && !search && statusFilter === 'all' ? (
          <EmptyState
            icon={<DocumentTextIcon className="h-8 w-8" />}
            title={
              audience === 'common' ? 'No shared legal pages yet' : `No ${audience} legal pages yet`
            }
            description={
              audience === 'common'
                ? 'Create pages that appear in both the customer and provider apps'
                : `Create privacy policy, terms, or support pages for the ${audience} app`
            }
            actionLabel="Create Page"
            onAction={() => {
              setEditingPage(null);
              setFormOpen(true);
            }}
          />
        ) : (
          <>
            {isLoading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-primary" />
              </div>
            ) : canReorder && rows.length > 0 ? (
              <LegalPagesSortableTable
                rows={rows}
                columns={columns}
                onReorder={(ordered_ids) => reorderMutation.mutate(ordered_ids)}
                onRowClick={handleEdit}
                isSaving={reorderMutation.isPending}
              />
            ) : (
              <Table
                columns={columns}
                data={rows}
                emptyMessage="No legal pages match your filters"
                rowKey={(row) => row.id}
                onRowClick={handleEdit}
              />
            )}
            <div className="border-t border-neutral-100 px-4">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </div>

      <LegalPageFormModal
        open={formOpen}
        onClose={handleCloseForm}
        onSubmit={handleFormSubmit}
        loading={createMutation.isPending || updateMutation.isPending}
        editingPage={editingPage}
        audience={audience}
      />

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete Legal Page"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMutation.isPending}
      />

      <ConfirmModal
        open={!!moveTarget}
        onClose={() => setMoveTarget(null)}
        onConfirm={() =>
          moveTarget &&
          moveMutation.mutate({
            id: moveTarget.page.id,
            targetAudience: moveTarget.audience,
          })
        }
        title="Move legal page"
        message={
          moveTarget
            ? `Move "${moveTarget.page.title}" from ${AUDIENCE_LABEL[moveTarget.page.audience]} to ${AUDIENCE_LABEL[moveTarget.audience]}? The slug may change if it already exists in the target collection.`
            : ''
        }
        confirmLabel="Move"
        loading={moveMutation.isPending}
      />
    </>
  );
}
