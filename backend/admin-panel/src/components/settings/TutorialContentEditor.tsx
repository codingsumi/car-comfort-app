'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui';
import {
  tutorialService,
  type TutorialAudience,
  type TutorialData,
} from '@/services/tutorial.service';
import { cn } from '@/lib/cn';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  VideoCameraIcon,
  ListBulletIcon,
  CloudArrowUpIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

const MAX_VIDEO_SIZE = 400 * 1024 * 1024;
// MOV (QuickTime) is excluded — Android ExoPlayer does not support it.
// Admins must upload MP4 (or compatible) files.
const ACCEPTED_VIDEO_TYPES = [
  'video/mp4',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm',
  'video/mpeg',
];

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface TutorialContentEditorProps {
  audience: TutorialAudience;
  title: string;
  description: string;
  instructionsHint: string;
}

export function TutorialContentEditor({
  audience,
  title,
  description,
  instructionsHint,
}: TutorialContentEditorProps) {
  const queryClient = useQueryClient();
  const videoInputRef = useRef<HTMLInputElement>(null);
  const queryKey = ['tutorial', audience];

  const { data: tutorial, isLoading } = useQuery<TutorialData>({
    queryKey,
    queryFn: async () => {
      const res = await tutorialService.get(audience);
      return res.data.data;
    },
  });

  const [videoUrl, setVideoUrl] = useState('');
  const [instructions, setInstructions] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  if (tutorial && !initialized) {
    setVideoUrl(tutorial.video_url || '');
    setInstructions(tutorial.instructions.length ? [...tutorial.instructions] : ['']);
    setInitialized(true);
  }

  const mutation = useMutation({
    mutationFn: (data: { video_url: string; instructions: string[] }) =>
      tutorialService.upsert(data, audience),
    onSuccess: () => {
      toast.success('Tutorial content updated');
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => {
      toast.error('Failed to update tutorial content');
    },
  });

  const handleVideoUpload = async (file: File) => {
    if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
      toast.error('Please upload a valid video file (MP4, AVI, MKV, WebM). MOV is not supported on Android.');
      return;
    }
    if (file.size > MAX_VIDEO_SIZE) {
      toast.error(`Video must be under ${formatFileSize(MAX_VIDEO_SIZE)}`);
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const res = await tutorialService.uploadVideo(file, audience, setUploadProgress);
      setUploadProgress(100);
      setVideoUrl(res.data.data.video_url);
      toast.success('Video uploaded successfully');
      queryClient.invalidateQueries({ queryKey });
    } catch {
      toast.error('Failed to upload video');
    } finally {
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 500);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleVideoUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleVideoUpload(file);
  };

  const handleRemoveVideo = () => {
    setVideoUrl('');
  };

  const handleAddInstruction = () => {
    setInstructions((prev) => [...prev, '']);
  };

  const handleRemoveInstruction = (index: number) => {
    setInstructions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleInstructionChange = (index: number, value: string) => {
    setInstructions((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const handleMoveInstruction = (index: number, direction: 'up' | 'down') => {
    setInstructions((prev) => {
      const updated = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= updated.length) return prev;
      [updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]];
      return updated;
    });
  };

  const handleSave = () => {
    const filtered = instructions.map((i) => i.trim()).filter(Boolean);
    if (!filtered.length) {
      toast.error('Add at least one instruction');
      return;
    }
    mutation.mutate({ video_url: videoUrl.trim(), instructions: filtered });
  };

  if (isLoading) {
    return (
      <>
        <PageHeader title={title} description={description} />
        <div className="mt-6 flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-primary" />
            <p className="text-sm text-neutral-300">Loading...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          <Button onClick={handleSave} loading={mutation.isPending}>
            Save Changes
          </Button>
        }
      />

      <div className="mt-6 space-y-6">
        <div className="rounded-xl border border-neutral-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <VideoCameraIcon className="h-5 w-5 text-primary" />
            <h3 className="text-base font-semibold text-secondary-900">Tutorial Video</h3>
          </div>

          {videoUrl ? (
            <div className="overflow-hidden rounded-lg border border-neutral-100">
              <div className="flex items-center justify-between bg-neutral-50 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <VideoCameraIcon className="h-4 w-4 text-success" />
                  <span className="text-sm font-medium text-secondary-500">Video uploaded</span>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveVideo}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-danger hover:bg-danger-50 transition-colors"
                >
                  <XMarkIcon className="h-3.5 w-3.5" />
                  Remove
                </button>
              </div>
              <div className="p-4">
                <video src={videoUrl} controls className="w-full max-h-80 rounded-lg bg-black">
                  Your browser does not support the video element.
                </video>
                <p className="mt-2 text-xs text-neutral-300 break-all">{videoUrl}</p>
              </div>
            </div>
          ) : (
            <>
              {uploading ? (
                <div className="rounded-lg border-2 border-dashed border-primary-200 bg-primary-50/30 p-8">
                  <div className="flex flex-col items-center">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100">
                      <CloudArrowUpIcon className="h-6 w-6 animate-pulse text-primary" />
                    </div>
                    <p className="mb-3 text-sm font-medium text-secondary-500">
                      {uploadProgress >= 100 ? 'Saving video...' : 'Uploading video...'}
                    </p>
                    <div className="w-full max-w-xs">
                      <div className="h-2 overflow-hidden rounded-full bg-neutral-200">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-center text-xs text-neutral-300">
                        {Math.round(uploadProgress)}%
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => videoInputRef.current?.click()}
                  className={cn(
                    'cursor-pointer rounded-lg border-2 border-dashed p-8 transition-colors',
                    dragOver
                      ? 'border-primary bg-primary-50/30'
                      : 'border-neutral-200 hover:border-primary-300 hover:bg-neutral-50',
                  )}
                >
                  <div className="flex flex-col items-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
                      <CloudArrowUpIcon className="h-6 w-6 text-neutral-300" />
                    </div>
                    <p className="text-sm font-medium text-secondary-500">
                      Click to upload or drag and drop
                    </p>
                    <p className="mt-1 text-xs text-neutral-300">
                      MP4, AVI, MKV, WebM (max 400MB)
                    </p>
                    <p className="mt-1 text-xs text-danger">
                      ⚠ MOV files are not supported — Android cannot play them. Use MP4.
                    </p>
                  </div>
                </div>
              )}
              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/x-msvideo,video/x-matroska,video/webm,video/mpeg"
                onChange={handleFileChange}
                className="hidden"
              />
            </>
          )}
        </div>

        <div className="rounded-xl border border-neutral-100 bg-white p-6 shadow-sm">
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
          <p className="mb-4 text-sm text-neutral-300">{instructionsHint}</p>

          {instructions.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-200 py-12">
              <ListBulletIcon className="mb-3 h-10 w-10 text-neutral-200" />
              <p className="text-sm font-medium text-secondary-500">No instructions yet</p>
              <p className="mt-1 text-xs text-neutral-300">Add your first instruction step</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={handleAddInstruction}>
                Add Instruction
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {instructions.map((instruction, index) => (
                <div key={index} className="group flex items-start gap-3">
                  <div className="flex h-10 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary-50 text-sm font-semibold text-primary">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      value={instruction}
                      onChange={(e) => handleInstructionChange(index, e.target.value)}
                      placeholder={`Step ${index + 1} instruction...`}
                      className="block w-full rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-secondary-900 placeholder:text-neutral-300 transition-colors focus:outline-none focus:ring-1 focus:border-primary-500 focus:ring-primary-500"
                    />
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleMoveInstruction(index, 'up')}
                      disabled={index === 0}
                      className="rounded-lg p-2 text-neutral-300 hover:bg-neutral-100 hover:text-secondary-500 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ArrowUpIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveInstruction(index, 'down')}
                      disabled={index === instructions.length - 1}
                      className="rounded-lg p-2 text-neutral-300 hover:bg-neutral-100 hover:text-secondary-500 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ArrowDownIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveInstruction(index)}
                      disabled={instructions.length <= 1}
                      className="rounded-lg p-2 text-neutral-300 hover:bg-danger-50 hover:text-danger disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
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
