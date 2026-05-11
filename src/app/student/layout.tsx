
"use client";

import * as React from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useUser } from "@/firebase/auth/use-user";
import './student.css';

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useUser();
  console.log('[LAYOUT LOG] StudentLayout rendered. Loading:', loading, 'User Role:', user?.customClaims?.role);

  if (loading) {
    // Return null or a loader, but the root AuthGuard should handle the main loading state.
    return null; 
  }

  // Check if the user is a student before rendering the student-specific layout
  if (user?.customClaims?.role === "student") {
    return (
        <div className="student-portal">
            <DashboardLayout>{children}</DashboardLayout>
        </div>
    );
  }

  // If not a student, AuthGuard will handle redirection. Render nothing here.
  return null;
}
