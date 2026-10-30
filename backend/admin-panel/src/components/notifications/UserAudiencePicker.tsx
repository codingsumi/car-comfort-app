'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usersService } from '@/services/users.service';
import type { User } from '@/types';

export interface AudienceUserOption {
  id: number;
  name: string;
  email: string;
  role: User['role'];
}

function displayName(user: Pick<User, 'name' | 'first_name' | 'last_name' | 'email'>) {
  const full =
    (user.name && user.name.trim()) ||
    [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return full || user.email || 'Unknown user';
}

function roleLabel(role: User['role']) {
  if (role === 'driver') return 'Provider';
  if (role === 'customer') return 'Customer';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

interface UserAudiencePickerProps {
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}

export function UserAudiencePicker({ selectedIds, onChange }: UserAudiencePickerProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<AudienceUserOption[]>([]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const { data: searchResults, isFetching } = useQuery({
    queryKey: ['admin-user-search', debouncedQuery],
    queryFn: async () => {
      const res = await usersService.search(debouncedQuery, 12);
      return res.data.data.users;
    },
    enabled: debouncedQuery.length >= 2 && open,
  });

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  useEffect(() => {
    setSelectedUsers((prev) => {
      const byId = new Map(prev.map((u) => [u.id, u]));
      const next: AudienceUserOption[] = [];
      for (const id of selectedIds) {
        const existing = byId.get(id);
        if (existing) next.push(existing);
      }
      return next;
    });
  }, [selectedIds]);

  const addUser = (user: User) => {
    if (selectedIdSet.has(user.id)) return;
    const option: AudienceUserOption = {
      id: user.id,
      name: displayName(user),
      email: user.email,
      role: user.role,
    };
    setSelectedUsers((prev) => [...prev, option]);
    onChange([...selectedIds, user.id]);
    setQuery('');
    setOpen(false);
  };

  const removeUser = (id: number) => {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== id));
    onChange(selectedIds.filter((x) => x !== id));
  };

  const suggestions = (searchResults || []).filter((u) => !selectedIdSet.has(u.id));

  return (
    <div ref={rootRef} className="w-full">
      <label className="mb-1.5 block text-sm font-medium text-secondary-500">Recipients</label>
      <p className="mb-2 text-xs text-neutral-400">Search by name, email, or phone</p>

      {selectedUsers.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {selectedUsers.map((user) => (
            <li
              key={user.id}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-secondary-800"
            >
              <span className="truncate font-medium">{user.name}</span>
              <span className="text-neutral-400">·</span>
              <span className="shrink-0 text-neutral-500">{roleLabel(user.role)}</span>
              <button
                type="button"
                className="ml-0.5 rounded-full p-0.5 text-neutral-500 hover:bg-primary/20 hover:text-secondary-900"
                aria-label={`Remove ${user.name}`}
                onClick={() => removeUser(user.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <input
          type="search"
          className="input w-full"
          placeholder="Type to search users…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          autoComplete="off"
        />

        {open && debouncedQuery.length >= 2 && (
          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-neutral-200 bg-white shadow-lg">
            {isFetching && (
              <p className="px-3 py-2 text-sm text-neutral-400">Searching…</p>
            )}
            {!isFetching && suggestions.length === 0 && (
              <p className="px-3 py-2 text-sm text-neutral-400">No users found</p>
            )}
            {!isFetching &&
              suggestions.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className="flex w-full flex-col items-start gap-0.5 border-b border-neutral-50 px-3 py-2.5 text-left last:border-0 hover:bg-neutral-50"
                  onClick={() => addUser(user)}
                >
                  <span className="text-sm font-medium text-secondary-900">{displayName(user)}</span>
                  <span className="text-xs text-neutral-500">
                    {user.email}
                    {user.phone ? ` · ${user.phone}` : ''}
                    {' · '}
                    {roleLabel(user.role)}
                  </span>
                </button>
              ))}
          </div>
        )}
      </div>

      {selectedIds.length === 0 && (
        <p className="mt-1 text-xs text-neutral-400">Select at least one user to send to a specific audience.</p>
      )}
    </div>
  );
}
