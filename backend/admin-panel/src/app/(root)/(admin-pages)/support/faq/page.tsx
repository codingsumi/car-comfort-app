'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge, Button, Modal, Pagination, Table } from '@/components/ui';
import type { TableColumn } from '@/types';
import { useTableState } from '@/hooks/useTableState';
import { supportService } from '@/services/support.service';
import { SupportNav } from '@/components/support/SupportNav';
import type { FaqRow, FaqCategory } from '@/types/support';
import toast from 'react-hot-toast';

export default function SupportFaqPage() {
  const qc = useQueryClient();
  const { page, search, filters, queryParams, setPage, handleSearch, handleFilter } = useTableState({
    defaultSortKey: 'sort_order',
    defaultSortDirection: 'asc',
  });

  const [show, setShow] = useState(false);
  const [catName, setCatName] = useState('');
  const [inlineNewCat, setInlineNewCat] = useState('');
  const [faq, setFaq] = useState({ category_id: 0, question: '', answer: '', status: 'draft', sort_order: 0 });

  const { data: cats } = useQuery({
    queryKey: ['faq-categories'],
    queryFn: () => supportService.listFaqCategories().then((r) => r.data.data as FaqCategory[]),
  });

  const params = {
    ...queryParams,
    search: search || undefined,
    category_id: filters.category_id || undefined,
    status: filters.status || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['support-faqs', params, page],
    queryFn: () => supportService.listFaqs({ ...params, page }).then((r) => r.data.data),
  });

  const createCat = useMutation({
    mutationFn: (name: string) => supportService.createFaqCategory({ name }),
    onSuccess: (res, name) => {
      toast.success('Category created');
      setCatName('');
      setInlineNewCat('');
      qc.invalidateQueries({ queryKey: ['faq-categories'] });
      // If created inline in modal, auto-select it
      const newId = (res.data as { data?: { id?: number } })?.data?.id;
      if (newId) setFaq((f) => ({ ...f, category_id: newId }));
    },
  });

  const createFaq = useMutation({
    mutationFn: () => supportService.createFaq(faq),
    onSuccess: () => {
      toast.success('FAQ created');
      qc.invalidateQueries({ queryKey: ['support-faqs'] });
      setShow(false);
      setFaq({ category_id: 0, question: '', answer: '', status: 'draft', sort_order: 0 });
      setInlineNewCat('');
    },
  });

  const cols: TableColumn<FaqRow>[] = [
    { key: 'question', label: 'Question' },
    { key: 'category', label: 'Category', render: (_, r) => r.category?.name || '—' },
    { key: 'status', label: 'Status', render: (_, r) => <Badge variant={r.status === 'published' ? 'success' : 'neutral'}>{r.status}</Badge> },
    { key: 'sort_order', label: 'Order' },
    {
      key: 'actions',
      label: '',
      render: (_, r) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              supportService
                .updateFaq(r.id, { status: r.status === 'published' ? 'draft' : 'published' })
                .then(() => {
                  toast.success('Updated');
                  qc.invalidateQueries({ queryKey: ['support-faqs'] });
                })
            }
          >
            {r.status === 'published' ? 'Unpublish' : 'Publish'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              supportService.deleteFaq(r.id).then(() => {
                toast.success('Deleted');
                qc.invalidateQueries({ queryKey: ['support-faqs'] });
              })
            }
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="FAQ management"
        description="Create, publish, and reorder help center articles"
        actions={
          <Button size="sm" onClick={() => { setFaq({ category_id: 0, question: '', answer: '', status: 'draft', sort_order: 0 }); setInlineNewCat(''); setShow(true); }}>
            New FAQ
          </Button>
        }
      />
      <SupportNav />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-neutral-400">Search</label>
          <input
            className="input text-sm"
            placeholder="Search questions..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-400">New category</label>
          <div className="flex gap-2">
            <input className="input text-sm" placeholder="Category name" value={catName} onChange={(e) => setCatName(e.target.value)} />
            <Button size="sm" variant="outline" loading={createCat.isPending} disabled={!catName.trim()} onClick={() => createCat.mutate(catName)}>
              Add
            </Button>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-400">Category</label>
          <select className="input text-sm" value={filters.category_id || ''} onChange={(e) => handleFilter('category_id', e.target.value)}>
            <option value="">All</option>
            {(cats || []).map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-400">Status</label>
          <select className="input text-sm" value={filters.status || ''} onChange={(e) => handleFilter('status', e.target.value)}>
            <option value="">Any</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
      </div>

      <div className="card p-0">
        <Table columns={cols} data={data?.faqs || []} isLoading={isLoading} rowKey={(r) => r.id} />
        <div className="border-t border-neutral-50 p-3">
          <Pagination currentPage={page} totalPages={data?.pagination.total_pages ?? 1} onPageChange={setPage} />
        </div>
      </div>

      <Modal open={show} onClose={() => { setShow(false); setFaq({ category_id: 0, question: '', answer: '', status: 'draft', sort_order: 0 }); setInlineNewCat(''); }} title="New FAQ" size="md">
        <div className="space-y-3">
          {/* Category selector or inline creation */}
          {(cats || []).length === 0 ? (
            <div className="rounded-lg border border-warning-100 bg-warning-50 p-3">
              <p className="mb-2 text-sm font-medium text-warning-700">No categories yet — create one first:</p>
              <div className="flex gap-2">
                <input
                  className="input flex-1 text-sm"
                  placeholder="e.g. Bookings, Payments, General..."
                  value={inlineNewCat}
                  onChange={(e) => setInlineNewCat(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && inlineNewCat.trim()) createCat.mutate(inlineNewCat); }}
                />
                <Button
                  size="sm"
                  variant="primary"
                  loading={createCat.isPending}
                  disabled={!inlineNewCat.trim()}
                  onClick={() => createCat.mutate(inlineNewCat)}
                >
                  Create
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary-700">Category <span className="text-danger">*</span></label>
              <div className="flex gap-2">
                <select
                  className="input flex-1"
                  value={faq.category_id || ''}
                  onChange={(e) => setFaq((f) => ({ ...f, category_id: Number(e.target.value) }))}
                >
                  <option value="">Select category</option>
                  {(cats || []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <input
                  className="input w-36 text-sm"
                  placeholder="+ New category"
                  value={inlineNewCat}
                  onChange={(e) => setInlineNewCat(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && inlineNewCat.trim()) createCat.mutate(inlineNewCat); }}
                />
                {inlineNewCat.trim() && (
                  <Button size="sm" variant="outline" loading={createCat.isPending} onClick={() => createCat.mutate(inlineNewCat)}>
                    Add
                  </Button>
                )}
              </div>
            </div>
          )}
          <input className="input w-full" placeholder="Question" value={faq.question} onChange={(e) => setFaq((f) => ({ ...f, question: e.target.value }))} />
          <textarea className="input w-full" rows={5} placeholder="Answer" value={faq.answer} onChange={(e) => setFaq((f) => ({ ...f, answer: e.target.value }))} />
          <select className="input w-full" value={faq.status} onChange={(e) => setFaq((f) => ({ ...f, status: e.target.value }))}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
          <input
            type="number"
            className="input w-full"
            placeholder="Sort order"
            value={faq.sort_order}
            onChange={(e) => setFaq((f) => ({ ...f, sort_order: Number(e.target.value) }))}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShow(false)}>
              Cancel
            </Button>
            <Button size="sm" loading={createFaq.isPending} onClick={() => createFaq.mutate()} disabled={!faq.category_id || !faq.question || !faq.answer}>
              Create
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
