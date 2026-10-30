import api from '@/lib/api';
import type { ApiResponse } from '@/types';

export type TutorialAudience = 'customer' | 'driver';

export interface TutorialData {
  video_url: string | null;
  instructions: string[];
  audience?: TutorialAudience;
}

export interface TutorialVideoItem {
  id: number;
  audience: TutorialAudience;
  category: string;
  title: string;
  description: string | null;
  instructions?: string[];
  video_url: string | null;
  sort_order: number;
  is_published: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TutorialVideoListData {
  items: TutorialVideoItem[];
  categories: string[];
}

type UploadProgressHandler = (progress: number) => void;

function tutorialBasePath(audience: TutorialAudience) {
  return audience === 'driver' ? '/admin/tutorial/driver' : '/admin/tutorial';
}

export const tutorialService = {
  get: (audience: TutorialAudience = 'customer') =>
    api.get<ApiResponse<TutorialData>>(tutorialBasePath(audience)),

  upsert: (
    data: { video_url: string; instructions: string[] },
    audience: TutorialAudience = 'customer',
  ) => api.put<ApiResponse<TutorialData>>(tutorialBasePath(audience), data),

  uploadVideo: (
    file: File,
    audience: TutorialAudience = 'customer',
    onProgress?: UploadProgressHandler,
  ) => {
    const formData = new FormData();
    formData.append('video', file);
    return api.post<ApiResponse<{ video_url: string }>>(
      `${tutorialBasePath(audience)}/upload-video`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 900_000,
        onUploadProgress: (event) => {
          if (!event.total || !onProgress) return;
          onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
        },
      },
    );
  },

  listVideos: (audience: TutorialAudience = 'customer') =>
    api.get<ApiResponse<TutorialVideoListData>>('/admin/tutorial/videos', {
      params: { audience },
    }),

  createVideo: (
    data: Omit<TutorialVideoItem, 'id' | 'created_at' | 'updated_at'>,
  ) => api.post<ApiResponse<TutorialVideoItem>>('/admin/tutorial/videos', {
    audience: data.audience,
    category: data.category,
    title: data.title,
    description: data.description,
    instructions: data.instructions,
    video_url: data.video_url,
    sort_order: data.sort_order,
    is_published: data.is_published,
  }),

  updateVideo: (
    id: number,
    data: Partial<Omit<TutorialVideoItem, 'id' | 'created_at' | 'updated_at'>>,
  ) => api.put<ApiResponse<TutorialVideoItem>>(`/admin/tutorial/videos/${id}`, {
    audience: data.audience,
    category: data.category,
    title: data.title,
    description: data.description,
    instructions: data.instructions,
    video_url: data.video_url,
    sort_order: data.sort_order,
    is_published: data.is_published,
  }),

  deleteVideo: (id: number) =>
    api.delete<ApiResponse<null>>(`/admin/tutorial/videos/${id}`),

  uploadLibraryVideo: (id: number, file: File) => {
    const formData = new FormData();
    formData.append('video', file);
    return api.post<ApiResponse<TutorialVideoItem>>(
      `/admin/tutorial/videos/${id}/upload-video`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 900_000,
      },
    );
  },
};
