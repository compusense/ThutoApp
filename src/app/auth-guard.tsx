
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { useEffect, useMemo } from 'react';
import { useAppState } from '@/hooks/use-app-state';

// Public pages that do not require authentication.
const PUBLIC_PATHS = ['/login'];

// Pages accessible to users who haven't completed their profile.
const INCOMPLETE_PROFILE_PATHS = [
  '/teacher/complete-profile',
  '/school-head/complete-profile',
];

// The root page is special, we check it separately.
const ROOT_PATH = '/';

// Pages that authenticated users should be redirected away from.
const AUTH_REDIRECT_PATHS = ['/login'];

// Paths that are universally accessible to any authenticated user, regardless of role.
const UNIVERSAL_AUTHED_PATHS = ['/forms'];

function TopProgressBar() {
  return (
    <div className="fixed top-0 left-0 z-[9999] w-full h-1 overflow-hidden">
      <div className="h-full w-full rainbow-progress-bar" />
    </div>
  );
}


export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useUser();
  const { isNavigating } = useAppState();
  const router = useRouter();
  const pathname = usePathname();

  const redirectPath = useMemo(() => {
    if (authLoading) return null;

    const isAuthenticated = !!user;
    const isUniversalPath = UNIVERSAL_AUTHED_PATHS.some(path => pathname.startsWith(path));

    if (isAuthenticated) {
      // Handle incomplete profiles for teachers and school heads
      if ((user.role === 'teacher' || user.role === 'school-head') && !user.detailsComplete) {
        const completionPath = `/${user.role}/complete-profile`;
        if (pathname !== completionPath) {
          return completionPath;
        }
        return null;
      }

      const role = user.customClaims?.role;
      if (!role) return null;

      // Students don't have a profile completion step yet.
      // If a student tries to access a completion path, redirect them.
      if (role === 'student' && INCOMPLETE_PROFILE_PATHS.includes(pathname)) {
          return '/student/dashboard';
      }

      const targetDashboard = `/${role}/dashboard`;

      if (AUTH_REDIRECT_PATHS.includes(pathname) || pathname === ROOT_PATH) {
        return targetDashboard;
      }

      // If the path is universal, don't apply role-based path checks.
      if (isUniversalPath) {
        return null;
      }
      
      if (!pathname.startsWith(`/${role}`)) {
        return targetDashboard;
      }
    } else {
      if (!PUBLIC_PATHS.includes(pathname) && pathname !== ROOT_PATH) {
        return '/login';
      }
    }
    return null;
  }, [user, authLoading, pathname]);

  useEffect(() => {
    if (redirectPath) {
      router.replace(redirectPath);
    }
  }, [redirectPath, router]);

  const showLoader = authLoading || !!redirectPath || isNavigating;

  return (
    <>
      {showLoader && <TopProgressBar />}
      {children}
    </>
  );
}
