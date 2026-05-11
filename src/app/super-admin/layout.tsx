
"use client";

import * as React from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useUser } from "@/firebase/auth/use-user";

// The AuthGuard at the root layout now handles redirection.
// This layout's primary responsibility is to render the dashboard shell
// only if the user has the correct role. It should not perform redirects.

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useUser();

  // The AuthGuard shows a loader while loading=true.
  // We only need to decide what to render once loading is complete.
  if (loading) {
    return null; // The main AuthGuard loader is already covering the screen.
  }

  // If loading is finished and the user has the correct role, render the layout.
  if (user?.customClaims?.role === "super-admin") {
    return <DashboardLayout>{children}</DashboardLayout>;
  }

  // If the user doesn't have the right role, render nothing.
  // The AuthGuard is responsible for redirecting them away from this route.
  return null;
}
