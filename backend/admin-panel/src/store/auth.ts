import { create } from 'zustand';
import axios from 'axios';
import api from '@/lib/api';
import type { AuthState, LoginCredentials, User } from '@/types';
import { BASE_PATH } from '@/lib/paths';

/**
 * Auth store — token is kept in an HttpOnly cookie set via /api/auth/session.
 * It is NOT stored in localStorage (XSS-safe).
 * The in-memory `token` field is used only to attach the Bearer header on
 * requests during the current page session; it is populated from the server
 * on checkAuth().
 */

/** Resolve the session API route URL accounting for Next.js basePath (/admin). */
function sessionApiUrl(): string {
  // In the browser the basePath is already part of the origin path.
  // fetch() relative URLs resolve against window.location, so we must
  // include the basePath prefix explicitly.
  const base = typeof window !== 'undefined' ? BASE_PATH : '';
  return `${base}/api/auth/session`;
}

async function setSessionCookie(token: string): Promise<void> {
  const res = await fetch(sessionApiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    throw new Error(`Failed to set session cookie: ${res.status}`);
  }
}

async function clearSessionCookie(): Promise<void> {
  await fetch(sessionApiUrl(), { method: 'DELETE' }).catch(() => {});
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (credentials: LoginCredentials) => {
    const { data } = await api.post('/admin/login', credentials);
    const { token, user } = data.data as { token: string; user: User };

    // Store token in HttpOnly cookie — NOT localStorage
    await setSessionCookie(token);

    set({
      user,
      token,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  logout: async () => {
    try {
      await api.post('/admin/logout');
    } catch {
      // proceed with local logout even if API fails
    }
    await clearSessionCookie();
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  checkAuth: async () => {
    // Skip API call on public pages — avoids the login-page infinite redirect loop.
    if (typeof window !== 'undefined') {
      const publicPrefixes = ['/login', '/forgot-password', '/reset-password'];
      const path = window.location.pathname;
      const strippedPath = path.replace(/^\/admin/, '') || '/';
      const isPublic = publicPrefixes.some((p) => strippedPath === p || strippedPath.startsWith(`${p}/`));
      if (isPublic) {
        set({ isLoading: false, isAuthenticated: false });
        return;
      }
    }

    // Use the server-side /api/auth/me proxy so the HttpOnly cookie is read
    // server-side and the token is returned to JS. This works on every page
    // refresh because the browser automatically sends the cookie to the
    // Next.js API route even though JS cannot read it directly.
    try {
      const res = await fetch(sessionApiUrl().replace('/session', '/me'), {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });

      if (!res.ok) {
        await clearSessionCookie();
        set({ user: null, token: null, isAuthenticated: false, isLoading: false });
        return;
      }

      const body = await res.json();
      const user: User = body.user;
      const token: string = body.token;

      // Hydrate the in-memory token so Axios can attach it for all subsequent requests
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch {
      // Network error — keep loading false so the UI doesn't hang
      set({ isLoading: false });
    }
  },

  setToken: (token: string) => {
    setSessionCookie(token).catch(() => {});
    set({ token });
  },
}));
