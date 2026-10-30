'use client';

import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  TrashIcon,
  VideoCameraIcon,
  CloudArrowUpIcon,
  ListBulletIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from '@heroicons/react/24/outline';
import { PageHeader } from '@/components/shared/PageHeader';
import { TutorialNav } from '@/components/settings/TutorialNav';
import { Button } from '@/components/ui';
import {
  tutorialService,
  type TutorialAudience,
  type TutorialVideoItem,
} from '@/services/tutorial.service';

const MAX_VIDEO_SIZE = 400 * 1024 * 1024;

type TutorialForm = {
  category: string;
  title: string;
  instructions: string[];
  video_url: string;
  sort_order: number;
  is_published: boolean;
};

const EMPTY_FORM: TutorialForm = {
  category: 'Getting Started',
  title: '',
  instructions: [''],
  video_url: '',
  sort_order: 100,
  is_published: true,
};

export type TutorialLibraryManagerProps = {
  audience: TutorialAudience;
  title: string;
  description: string;
  defaultCategories: string[];
  publishedLabel: string;
  instructionsHint: string;
  emptyListHint: string;
};

function normalizeInstructions(values: string[]) {
  return values.map((item) => item.trim()).filter(Boolean);
}

export function TutorialLibraryManager({
  audience,
  title,
  description,
  defaultCategories,
  publishedLabel,
  instructionsHint,
  emptyListHint,
}: TutorialLibraryManagerProps) {
  const queryClient = useQueryClient();
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TutorialForm>({
    ...EMPTY_FORM,
    category: defaultCategories[0] ?? 'General',
  });
  const [uploading, setUploading] = useState(false);
  const queryKey = ['tutorial-videos', audience] as const;

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await tutorialService.listVideos(audience);
      return res.data.data;
    },
  });

  const items = data?.items;
  const grouped = useMemo(() => {
    const list = items ?? [];
    const map = new Map<string, TutorialVideoItem[]>();
    for (const item of list) {
      const key = item.category || 'General';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const instructions = normalizeInstructions(form.instructions);
      if (!instructions.length) throw new Error('Add at least one instruction step');

      const payload = {
        audience,
        category: form.category.trim() || 'General',
        title: form.title.trim(),
        description: null,
        instructions,
        video_url: form.video_url.trim() || null,
        sort_order: Number(form.sort_order) || 100,
        is_published: form.is_published,
      };
      if (!payload.title) throw new Error('Title is required');
      if (editingId) return tutorialService.updateVideo(editingId, payload);
      return tutorialService.createVideo(payload);
    },
    onSuccess: () => {
      toast.success(editingId ? 'Tutorial updated' : 'Tutorial added');
      queryClient.invalidateQueries({ queryKey });
      resetForm();
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save tutorial'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => tutorialService.deleteVideo(id),
    onSuccess: () => {
      toast.success('Tutorial deleted');
      queryClient.invalidateQueries({ queryKey });
      if (editingId) resetForm();
    },
    onError: () => toast.error('Failed to delete tutorial'),
  });

  function resetForm() {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      category: defaultCategories[0] ?? 'General',
    });
  }

  function startEdit(item: TutorialVideoItem) {
    const instructions =
      item.instructions && item.instructions.length
        ? [...item.instructions]
        : item.description
          ? item.description.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
          : [''];

    setEditingId(item.id);
    setForm({
      category: item.category,
      title: item.title,
      instructions: instructions.length ? instructions : [''],
      video_url: item.video_url || '',
      sort_order: item.sort_order,
      is_published: item.is_published,
    });
  }

  function handleAddInstruction() {
    setForm((prev) => ({ ...prev, instructions: [...prev.instructions, ''] }));
  }

  function handleRemoveInstruction(index: number) {
    setForm((prev) => ({
      ...prev,
      instructions: prev.instructions.filter((_, i) => i !== index),
    }));
  }

  function handleInstructionChange(index: number, value: string) {
    setForm((prev) => ({
      ...prev,
      instructions: prev.instructions.map((item, i) => (i === index ? value : item)),
    }));
  }

  function handleMoveInstruction(index: number, direction: 'up' | 'down') {
    setForm((prev) => {
      const updated = [...prev.instructions];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= updated.length) return prev;
      [updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]];
      return { ...prev, instructions: updated };
    });
  }

  async function handleVideoUpload(file: File) {
    if (file.size > MAX_VIDEO_SIZE) {
      toast.error('Video must be under 400MB');
      return;
    }
    if (/\.(mov)$/i.test(file.name)) {
      toast.error('MOV files are not supported on Android. Please convert to MP4 first.');
      return;
    }
    setUploading(true);
    try {
      const instructions = normalizeInstructions(form.instructions);
      if (editingId) {
        const res = await tutorialService.uploadLibraryVideo(editingId, file);
        setForm((prev) => ({ ...prev, video_url: res.data.data.video_url || '' }));
      } else {
        const created = await tutorialService.createVideo({
          audience,
          category: form.category.trim() || 'General',
          title: form.title.trim() || 'Untitled tutorial',
          description: null,
          instructions: instructions.length ? instructions : ['Draft instruction'],
          video_url: null,
          sort_order: Number(form.sort_order) || 100,
          is_published: form.is_published,
        });
        const newId = created.data.data.id;
        setEditingId(newId);
        const uploaded = await tutorialService.uploadLibraryVideo(newId, file);
        setForm((prev) => ({
          ...prev,
          video_url: uploaded.data.data.video_url || '',
          title: uploaded.data.data.title,
          instructions:
            uploaded.data.data.instructions?.length
              ? uploaded.data.data.instructions
              : prev.instructions,
        }));
      }
      toast.success('Video uploaded');
      queryClient.invalidateQueries({ queryKey });
    } catch {
      toast.error('Failed to upload video');
    } finally {
      setUploading(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  }

  return (
    <>
      <TutorialNav />
      <PageHeader title={title} description={description} />

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-xl border border-neutral-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-secondary-900">
              {editingId ? 'Edit tutorial' : 'Add tutorial'}
            </h3>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-secondary-700">Category</label>
              <input
                list="tutorial-categories"
                value={form.category}
                onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                className="block w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                placeholder={defaultCategories[0] ?? 'General'}
              />
              <datalist id="tutorial-categories">
                {defaultCategories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>

              <label className="block text-sm font-medium text-secondary-700">Title</label>
              <input
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                className="block w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                placeholder="How to charge a Tesla"
              />

              <label className="block text-sm font-medium text-secondary-700">Sort order</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, sort_order: Number(e.target.value) || 0 }))
                }
                className="block w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              />

              <label className="flex items-center gap-2 text-sm text-secondary-700">
                <input
                  type="checkbox"
                  checked={form.is_published}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, is_published: e.target.checked }))
                  }
                />
                {publishedLabel}
              </label>

              <div className="rounded-lg border border-dashed border-neutral-200 p-4">
                {form.video_url ? (
                  <div className="space-y-2">
                    <video src={form.video_url} controls className="w-full rounded-lg bg-black" />
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, video_url: '' }))}
                      className="text-xs text-danger"
                    >
                      Remove video
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => videoInputRef.current?.click()}
                    className="flex w-full flex-col items-center gap-2 py-4 text-sm text-secondary-500"
                  >
                    <CloudArrowUpIcon className="h-6 w-6" />
                    {uploading ? 'Uploading…' : 'Upload tutorial video (max 400MB)'}
                  </button>
                )}
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/x-msvideo,video/x-matroska,video/webm,video/mpeg"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleVideoUpload(file);
                  }}
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-neutral-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListBulletIcon className="h-5 w-5 text-primary" />
                <h3 className="text-base font-semibold text-secondary-900">Instructions</h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddInstruction}
                icon={<PlusIcon className="h-4 w-4" />}
              >
                Add Step
              </Button>
            </div>
            <p className="mb-4 text-sm text-neutral-400">{instructionsHint}</p>

            {form.instructions.length === 0 ? (
              <Button variant="outline" size="sm" onClick={handleAddInstruction}>
                Add Instruction
              </Button>
            ) : (
              <div className="space-y-3">
                {form.instructions.map((instruction, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="flex h-10 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary-50 text-sm font-semibold text-primary">
                      {index + 1}
                    </div>
                    <input
                      type="text"
                      value={instruction}
                      onChange={(e) => handleInstructionChange(index, e.target.value)}
                      placeholder={`Step ${index + 1} instruction...`}
                      className="block min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                    />
                    <div className="flex flex-shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveInstruction(index, 'up')}
                        disabled={index === 0}
                        className="rounded-lg p-2 text-neutral-300 hover:bg-neutral-100 disabled:opacity-30"
                      >
                        <ArrowUpIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveInstruction(index, 'down')}
                        disabled={index === form.instructions.length - 1}
                        className="rounded-lg p-2 text-neutral-300 hover:bg-neutral-100 disabled:opacity-30"
                      >
                        <ArrowDownIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveInstruction(index)}
                        disabled={form.instructions.length <= 1}
                        className="rounded-lg p-2 text-danger hover:bg-danger-50 disabled:opacity-30"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <Button
                className="flex-1"
                loading={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                {editingId ? 'Save changes' : 'Add tutorial'}
              </Button>
              {editingId ? (
                <Button variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-secondary-900">Tutorials</h3>
            <Button
              size="sm"
              variant="outline"
              icon={<PlusIcon className="h-4 w-4" />}
              onClick={resetForm}
            >
              New tutorial
            </Button>
          </div>

          {isLoading ? (
            <p className="text-sm text-neutral-400">Loading…</p>
          ) : grouped.length === 0 ? (
            <p className="text-sm text-neutral-400">{emptyListHint}</p>
          ) : (
            <div className="space-y-6">
              {grouped.map(([category, categoryItems]) => (
                <div key={category}>
                  <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">
                    {category}
                  </h4>
                  <div className="space-y-2">
                    {categoryItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 rounded-lg border border-neutral-100 p-3"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50">
                          <VideoCameraIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-secondary-900">{item.title}</p>
                          {item.instructions?.length ? (
                            <p className="mt-1 text-sm text-neutral-400">
                              {item.instructions.length} instruction
                              {item.instructions.length === 1 ? '' : 's'}
                            </p>
                          ) : null}
                          <p className="mt-1 text-xs text-neutral-300">
                            {item.is_published ? 'Published' : 'Draft'} · Sort {item.sort_order}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => startEdit(item)}>
                            Edit
                          </Button>
                          <button
                            type="button"
                            onClick={() => deleteMutation.mutate(item.id)}
                            className="rounded-lg p-2 text-danger hover:bg-danger-50"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
