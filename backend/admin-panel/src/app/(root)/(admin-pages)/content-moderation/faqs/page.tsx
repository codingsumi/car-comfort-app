'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge, Button, Modal, Pagination, Table } from '@/components/ui';
import type { TableColumn } from '@/types';
import { useTableState } from '@/hooks/useTableState';
import { contentModerationService } from '@/services/contentModeration.service';
import type { FaqRow, FaqCategory } from '@/types/contentModeration';
import toast from 'react-hot-toast';

export default function FaqAdminPage() {
  const qc = useQueryClient();
  const { page, filters, queryParams, setPage, handleFilter } = useTableState({ defaultSortKey: 'sort_order', defaultSortDirection: 'asc' });

  const [show, setShow] = useState(false);
  const [catName, setCatName] = useState('');
  const [faq, setFaq] = useState({ category_id: 0, question: '', answer: '', status: 'draft', sort_order: 0 });

  const { data: cats } = useQuery({
    queryKey: ['faq-categories'],
    queryFn: () => contentModerationService.listFaqCategories().then((r) => r.data.data as FaqCategory[]),
  });

  const params = { ...queryParams, category_id: filters.category_id || undefined, status: filters.status || undefined };

  const { data, isLoading } = useQuery({
    queryKey: ['faqs', params, page],
    queryFn: () => contentModerationService.listFaqs({ ...params, page }).then((r) => r.data.data),
  });

  const createCat = useMutation({
    mutationFn: () => contentModerationService.createFaqCategory({ name: catName }),
    onSuccess: () => {
      toast.success('Category created');
      setCatName('');
      qc.invalidateQueries({ queryKey: ['faq-categories'] });
    },
  });

  const createFaq = useMutation({
    mutationFn: () => contentModerationService.createFaq(faq),
    onSuccess: () => {
      toast.success('FAQ created');
      qc.invalidateQueries({ queryKey: ['faqs'] });
      setShow(false);
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
              contentModerationService
                .updateFaq(r.id, { status: r.status === 'published' ? 'draft' : 'published' })
                .then(() => {
                  toast.success('Updated');
                  qc.invalidateQueries({ queryKey: ['faqs'] });
                })
            }
          >
            Toggle publish
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              contentModerationService.deleteFaq(r.id).then(() => {
                toast.success('Deleted');
                qc.invalidateQueries({ queryKey: ['faqs'] });
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
        description="Create categories, publish help articles, and control sort order."
        actions={
          <Button size="sm" onClick={() => setShow(true)}>
            New FAQ
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <input className="input text-sm" placeholder="New category name" value={catName} onChange={(e) => setCatName(e.target.value)} />
        <Button size="sm" variant="outline" onClick={() => createCat.mutate()} loading={createCat.isPending} disabled={!catName.trim()}>
          Add category
        </Button>
        <select className="input text-sm" value={filters.category_id || ''} onChange={(e) => handleFilter('category_id', e.target.value)}>
          <option value="">All categories</option>
          {(cats || []).map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="input text-sm" value={filters.status || ''} onChange={(e) => handleFilter('status', e.target.value)}>
          <option value="">Any status</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </div>

      <div className="card p-0">
        <Table columns={cols} data={data?.faqs || []} isLoading={isLoading} rowKey={(r) => r.id} />
        <div className="border-t border-neutral-50 p-3">
          <Pagination currentPage={page} totalPages={data?.pagination.total_pages ?? 1} onPageChange={setPage} />
        </div>
      </div>

      <Modal open={show} onClose={() => setShow(false)} title="New FAQ" size="md">
        <div className="space-y-3">
          <select
            className="input w-full"
            value={faq.category_id || ''}
            onChange={(e) => setFaq((f) => ({ ...f, category_id: Number(e.target.value) }))}
          >
            <option value="">Select category</option>
            {(cats || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input className="input w-full" placeholder="Question" value={faq.question} onChange={(e) => setFaq((f) => ({ ...f, question: e.target.value }))} />
          <textarea className="input w-full" rows={5} placeholder="Answer" value={faq.answer} onChange={(e) => setFaq((f) => ({ ...f, answer: e.target.value }))} />
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
