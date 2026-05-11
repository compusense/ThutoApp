
'use client';

import * as React from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { useUser } from '@/firebase/auth/use-user';

export default function DeveloperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useUser();

  if (loading) {
    return null;
  }

  if (user?.customClaims?.role === 'developer') {
    return <DashboardLayout>{children}</DashboardLayout>;
  }

  return null;
}
