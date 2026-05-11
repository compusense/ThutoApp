
'use client';

import Link, { LinkProps } from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAppState } from '@/hooks/use-app-state';
import { MouseEvent, forwardRef } from 'react';
import { useSidebar } from '@/components/ui/sidebar';

type AppLinkProps = LinkProps & {
  children: React.ReactNode;
  className?: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
};

export const AppLink = forwardRef<HTMLAnchorElement, AppLinkProps>(
  ({ href, children, className, onClick, ...props }, ref) => {
    const router = useRouter();
    const pathname = usePathname();
    const { setIsNavigating } = useAppState();
    
    // Safely use the hook by allowing it to be null
    let sidebar: ReturnType<typeof useSidebar> | null = null;
    try {
        sidebar = useSidebar();
    } catch (e) {
        // This will happen on pages without a SidebarProvider, which is expected.
        // We can safely ignore the error and leave the sidebar as null.
    }


    const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
      if (onClick) onClick(e);

      const url = typeof href === 'string' ? href : href.pathname;

      if (!url || e.ctrlKey || e.metaKey) {
        return;
      }
      
      const isExternal = url.startsWith('http');
      const isSamePage = pathname === url;

      if (isExternal) {
        if (sidebar?.isMobile) {
          sidebar.setOpenMobile(false);
        }
        return;
      }
      
      if (isSamePage) {
        if (sidebar?.isMobile) {
            sidebar.setOpenMobile(false);
        }
        return;
      }

      e.preventDefault();

      if (sidebar?.isMobile) {
        sidebar.setOpenMobile(false);
      }
      
      setIsNavigating(true);
      router.push(url);
    };

    return (
      <Link href={href} ref={ref} className={className} onClick={handleClick} {...props}>
        {children}
      </Link>
    );
  }
);

AppLink.displayName = 'AppLink';
