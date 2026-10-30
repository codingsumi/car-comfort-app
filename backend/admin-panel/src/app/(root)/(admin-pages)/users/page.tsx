'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function UsersIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/users/admins');
  }, [router]);

  return null;
}
