'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button, Input } from '@/components/ui';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/store/auth';
import { formatJoinedDate } from '@/utils/formatDate';
import type { User } from '@/types';

function displayName(user: User | null | undefined) {
  if (!user) return '—';
  return (
    user.name?.trim() ||
    [user.first_name, user.last_name].filter(Boolean).join(' ').trim() ||
    user.email ||
    '—'
  );
}

export default function AdminProfilePage() {
  const { user: sessionUser, setToken } = useAuthStore();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const { data: profile, isLoading } = useQuery({
    queryKey: ['admin-profile'],
    queryFn: () => authService.getProfile().then((r) => r.data.data),
  });

  const user = profile ?? sessionUser;

  const changePasswordMutation = useMutation({
    mutationFn: () => authService.changePassword(oldPassword, newPassword),
    onSuccess: (res) => {
      const token = res.data.data?.token;
      if (token) {
        setToken(token);
        localStorage.setItem('admin_token', token);
      }
      toast.success('Password updated');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Failed to change password');
    },
  });

  const handleChangePassword = () => {
    if (!oldPassword.trim()) {
      toast.error('Enter your current password');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    changePasswordMutation.mutate();
  };

  if (isLoading && !user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="My profile" description="Your admin account details and password" />

      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-secondary-900">Account</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-neutral-400">Name</dt>
            <dd className="font-medium text-secondary-900">{displayName(user)}</dd>
          </div>
          <div>
            <dt className="text-neutral-400">Email</dt>
            <dd className="font-medium text-secondary-900">{user?.email || '—'}</dd>
          </div>
          <div>
            <dt className="text-neutral-400">Phone</dt>
            <dd className="font-medium text-secondary-900">{user?.phone || '—'}</dd>
          </div>
          <div>
            <dt className="text-neutral-400">Role</dt>
            <dd className="font-medium capitalize text-secondary-900">{user?.role || 'admin'}</dd>
          </div>
          <div>
            <dt className="text-neutral-400">Joined</dt>
            <dd className="font-medium text-secondary-900">
              {user ? formatJoinedDate(user) : '—'}
            </dd>
          </div>
        </dl>
      </div>

      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-secondary-900">Change password</h2>
        <p className="text-sm text-neutral-400">
          Updating your password will sign out other active sessions.
        </p>
        <Input
          label="Current password"
          type="password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          autoComplete="current-password"
        />
        <Input
          label="New password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
        />
        <Input
          label="Confirm new password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
        />
        <Button
          onClick={handleChangePassword}
          loading={changePasswordMutation.isPending}
          disabled={!oldPassword || !newPassword || !confirmPassword}
        >
          Update password
        </Button>
      </div>
    </div>
  );
}
