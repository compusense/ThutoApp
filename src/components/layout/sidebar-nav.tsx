
'use client';

import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  LayoutDashboard,
  Users,
  UserCog,
  LogOut,
  Map,
  MapPin,
  Building,
  UserCheck,
  BookCopy,
  ClipboardList,
  Menu,
  ClipboardCheck,
  ArrowRightLeft,
  BarChart,
  TrendingUp,
  FileText,
  FileArchive,
  Book,
  Bell,
  Newspaper,
  CalendarDays,
  LineChart,
  CreditCard,
  StickyNote,
  ScanLine,
  Gamepad2,
  ListChecks,
  UploadCloud,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import * as React from 'react';

import { useUser } from '@/firebase/auth/use-user';
import { useAuth, useFirestore } from '@/firebase';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  SidebarRail,
} from '@/components/ui/sidebar';
import { useToast } from '@/hooks/use-toast';
import { School } from '@/app/super-admin/schools/page';
import { Skeleton } from '@/components/ui/skeleton';
import { SubRegion } from '@/app/super-admin/sub-regions/page';
import { AppLink } from '../ui/app-link';

const superAdminLinks = [
  { href: '/super-admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/super-admin/users', label: 'User Management', icon: UserCog },
  { href: '/super-admin/regions', label: 'Regions', icon: Map },
  { href: '/super-admin/sub-regions', label: 'Sub-Regions', icon: MapPin },
  { href: '/super-admin/schools', label: 'Schools', icon: Building },
  { href: '/super-admin/subjects', label: 'Subjects', icon: BookCopy },
  { href: '/super-admin/syllabus', label: 'Syllabus', icon: BookCopy },
  { href: '/super-admin/games/review', label: 'Game Review', icon: ListChecks },
  { href: '/forms', label: 'Forms', icon: FileText },
  { href: '/super-admin/billing-explanation', label: 'Billing', icon: CreditCard },
];

const schoolHeadLinks = [
  { href: '/school-head/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/school-head/action-plans', label: 'School Events', icon: CalendarDays },
  { href: '/school-head/teachers', label: 'Teachers', icon: UserCog },
  { href: '/school-head/students', label: 'Students', icon: Users },
  { href: '/school-head/classes', label: 'Classes', icon: BookCopy },
  {
    href: '/school-head/results',
    label: 'Class Results',
    icon: ClipboardList,
  },
  {
    href: '/school-head/results-summary',
    label: 'Results Summary',
    icon: BarChart,
  },
   {
    href: '/school-head/results-metrics',
    label: 'Results Metrics',
    icon: LineChart,
  },
  {
    href: '/school-head/results-tracking',
    label: 'Results Tracking',
    icon: TrendingUp,
  },
  {
    href: '/school-head/invigilation',
    label: 'Invigilation',
    icon: ClipboardCheck,
  },
  { href: '/school-head/promotions', label: 'Promotions', icon: ArrowRightLeft },
  {
    href: '/school-head/exam-management',
    label: 'Exam Management',
    icon: Book,
  },
  { href: '/forms', label: 'Forms', icon: FileText },
];

const teacherLinks = [
  { href: '/teacher/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/teacher/my-classes', label: 'My Classes', icon: BookCopy },
  { href: '/teacher/syllabus', label: 'Syllabus', icon: Book },
  { href: '/teacher/notes', label: 'Class Activities', icon: StickyNote },
  { href: '/teacher/scanner', label: 'AI Scanner', icon: ScanLine },
  {
    href: '/teacher/reports',
    label: 'Assessment Reports',
    icon: Newspaper,
  },
  {
    href: '/teacher/class-reports',
    label: 'My Class Reports',
    icon: Newspaper,
  },
  { href: '/teacher/invigilation', label: 'Invigilation', icon: ClipboardCheck },
  { href: '/teacher/results', label: 'Class Results', icon: ClipboardList },
  {
    href: '/teacher/results-metrics',
    label: 'Results Metrics',
    icon: LineChart,
  },
  {
    href: '/teacher/results-tracking',
    label: 'Results Tracking',
    icon: TrendingUp,
  },
  {
    href: '/teacher/past-exam-papers',
    label: 'Past Exam Papers',
    icon: FileArchive,
  },
];

const subRegionAdminLinks = [
  {
    href: '/sub-region-admin/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  { href: '/sub-region-admin/staff', label: 'Staff', icon: UserCog },
  { href: '/sub-region-admin/results', label: 'Results', icon: BarChart },
  {
    href: '/sub-region-admin/exam-management',
    label: 'Exam Management',
    icon: Book,
  },
  { href: '/forms', label: 'Forms', icon: FileText },
  { href: '/sub-region-admin/details', label: 'My Details', icon: UserCheck },
];

const studentLinks = [
    { href: '/student/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/student/my-classes', label: 'My Class', icon: BookCopy },
    { href: '/student/results', label: 'My Results', icon: ClipboardList },
    { href: '/student/games', label: 'Game Center', icon: Gamepad2 },
];

const developerLinks = [
    { href: '/developer/dashboard', label: 'My Dashboard', icon: LayoutDashboard },
    { href: '/developer/games/upload', label: 'Upload New Game', icon: UploadCloud },
];


const roleLinks = {
  'super-admin': superAdminLinks,
  'school-head': schoolHeadLinks,
  teacher: teacherLinks,
  'sub-region-admin': subRegionAdminLinks,
  'student': studentLinks,
  'developer': developerLinks,
};

export function SidebarNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const firestore = useFirestore();
  const role = user?.customClaims?.role as keyof typeof roleLinks;
  
  const [unreadNotifications, setUnreadNotifications] = React.useState(0);

  React.useEffect(() => {
    if (!firestore || !user) return;

    let unsubs: (() => void)[] = [];

    if (user.role === 'school-head' && user.schoolId) {
      const notificationsQuery = query(
        collection(firestore, `schools/${user.schoolId}/notifications`),
        where('isRead', '==', false)
      );
      unsubs.push(
        onSnapshot(notificationsQuery, (snap) => {
          setUnreadNotifications(snap.size);
        })
      );
    }
    
    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [firestore, user]);

  const links = (role && roleLinks[role]) || [];

  if (!user || !role) {
    return null;
  }

  if (user.customClaims?.role !== role) {
    return null;
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarRail />
      <SidebarHeader />
      <SidebarContent>
        <SidebarMenu>
          {links.map((link) => {
            const showNotification =
              link.label === 'Exam Management' && unreadNotifications > 0;
            const isActive = pathname === link.href || (pathname.startsWith(link.href) && link.href !== '/' && pathname.charAt(link.href.length) === '/');

            return (
              <SidebarMenuItem key={link.href}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={link.label}
                >
                  <AppLink href={link.href}>
                    <link.icon />
                    <span>{link.label}</span>
                    {showNotification && (
                      <Bell className="ml-auto h-4 w-4 text-accent" />
                    )}
                  </AppLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarTrigger className="justify-start">
              <Menu />
              <span className="group-data-[collapsible=icon]:hidden">
                Collapse
              </span>
            </SidebarTrigger>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
