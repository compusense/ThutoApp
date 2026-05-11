'use client';

import * as React from 'react';
import Image from 'next/image';
import {
  doc,
  onSnapshot,
} from 'firebase/firestore';

import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { SidebarNav } from './sidebar-nav';
import { UserNav } from './user-nav';
import { AppLink } from '@/components/ui/app-link';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase';
import { School } from '@/app/super-admin/schools/page';
import { SubRegion } from '@/app/super-admin/sub-regions/page';
import { Skeleton } from '@/components/ui/skeleton';
import { GlobalSearch } from './global-search';
import { ModeToggle } from '../mode-toggle';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [school, setSchool] = React.useState<School | null>(null);
  const [subRegion, setSubRegion] = React.useState<SubRegion | null>(null);
  const [loadingContext, setLoadingContext] = React.useState(true);

  React.useEffect(() => {
    if (!firestore || !user) {
      setLoadingContext(false);
      return;
    }

    let unsubscribes: (() => void)[] = [];
    setLoadingContext(true);

    if (
      user.schoolId &&
      (user.role === 'teacher' || user.role === 'school-head' || user.role === 'student')
    ) {
      const schoolRef = doc(firestore, 'schools', user.schoolId);
      unsubscribes.push(
        onSnapshot(
          schoolRef,
          (docSnap) => {
            setSchool(
              docSnap.exists()
                ? ({ id: docSnap.id, ...docSnap.data() } as School)
                : null
            );
            setSubRegion(null);
            setLoadingContext(false);
          },
          () => setLoadingContext(false)
        )
      );
    } else if (user.subRegionId && user.role === 'sub-region-admin') {
      const subRegionRef = doc(firestore, 'subRegions', user.subRegionId);
      unsubscribes.push(
        onSnapshot(
          subRegionRef,
          (docSnap) => {
            setSubRegion(
              docSnap.exists()
                ? ({ id: docSnap.id, ...docSnap.data() } as SubRegion)
                : null
            );
            setSchool(null);
            setLoadingContext(false);
          },
          () => setLoadingContext(false)
        )
      );
    } else {
      setSchool(null);
      setSubRegion(null);
      setLoadingContext(false);
    }

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [firestore, user]);

  const contextName = school?.name || subRegion?.name || ' ';
  
  const showSearch = user?.role === 'teacher' || user?.role === 'school-head';

  return (
    <SidebarProvider>
      <SidebarNav />
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-16 sm:h-20 items-center gap-2 sm:gap-4 lg:gap-8 border-b bg-background/95 px-3 sm:px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:px-8">
          <div className="flex items-center gap-1 sm:gap-4 shrink-0 overflow-hidden">
            <SidebarTrigger className="md:hidden" />
            <AppLink
              href="/"
              className="flex flex-col items-start text-foreground"
            >
              <Image
                src="/logo.svg"
                alt="Thuto Logo"
                width={48}
                height={48}
                className="h-8 sm:h-14 w-auto"
                priority
              />
              <span className="font-semibold text-[10px] sm:text-[13px] mt-0.5 ml-1 sm:ml-2 truncate max-w-[100px] sm:max-w-[250px]">
                {loadingContext ? <Skeleton className="h-4 w-24" /> : contextName}
              </span>
            </AppLink>
          </div>
          
          {showSearch && (
            <div className="flex-1 max-w-2xl hidden md:block">
               <GlobalSearch />
            </div>
          )}

          <div className="flex items-center justify-end gap-1.5 sm:gap-2 ml-auto min-w-0">
            {showSearch && (
              <div className="md:hidden">
                <GlobalSearch />
              </div>
            )}
            <ModeToggle />
            <UserNav />
          </div>
        </header>
        <main className="p-3 sm:p-6 lg:p-8 overflow-x-hidden">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
