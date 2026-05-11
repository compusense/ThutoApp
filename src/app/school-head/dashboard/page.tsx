'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, BookOpen, GraduationCap, Building, User } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import { collection, query, where, onSnapshot, Unsubscribe, doc, FirestoreError } from 'firebase/firestore';
import { School } from '@/app/super-admin/schools/page';
import { Skeleton } from '@/components/ui/skeleton';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import { SchoolCalendar } from '@/app/teacher/dashboard/components/school-calendar';
import { TeacherChartCard } from '@/app/teacher/dashboard/components/teacher-chart-card';
import { StudentGenderChart } from '@/app/teacher/dashboard/components/student-gender-chart';

function StatCard({ title, value, description, icon: Icon, loading, className }: { title: string, value: string | number, description?: string, icon: React.ElementType, loading: boolean, className?: string }) {
  return (
    <Card className={cn("dashboard-card-gradient", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <>
            <Skeleton className="h-8 w-1/2 mb-2" />
            <Skeleton className="h-4 w-3/4" />
          </>
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function SchoolHeadDashboard() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [staffCount, setStaffCount] = useState(0);
  const [classCount, setClassCount] = useState(0);
  const [schoolRoll, setSchoolRoll] = useState(0);

  useEffect(() => {
    if (!firestore || !user?.uid) {
      setLoading(false);
      return;
    }

    let unsubscribes: Unsubscribe[] = [];
    let isMounted = true;

    const schoolQuery = query(collection(firestore, 'schools'), where('schoolHeadId', '==', user.uid));
    const schoolUnsub = onSnapshot(schoolQuery, (querySnapshot) => {
      if (!isMounted) return;

      if (!querySnapshot.empty) {
        const schoolDoc = querySnapshot.docs[0];
        const schoolData = { id: schoolDoc.id, ...schoolDoc.data() } as School;
        setSchool(schoolData);
        setError(null);

        // Fetch staff count (excluding students)
        const staffRoles = ['teacher', 'school-head', 'deputy-school-head', 'HOD', 'Senior Teacher 1', 'Senior Teacher 2'];
        const staffQuery = query(
            collection(firestore, 'users'), 
            where('schoolId', '==', schoolData.id),
            where('role', 'in', staffRoles)
        );
        const staffUnsub = onSnapshot(staffQuery, (snap) => {
            if (isMounted) setStaffCount(snap.size);
        });
        unsubscribes.push(staffUnsub);

        // Fetch active classes count
        const currentYear = new Date().getFullYear().toString();
        const classesQuery = query(
            collection(firestore, 'schools', schoolData.id, 'classes'),
            where('academicYear', '==', currentYear)
        );
        
        const classesUnsub = onSnapshot(classesQuery, (classSnap) => {
            if (!isMounted) return;
            const classIds = classSnap.docs.map(doc => doc.id);
            setClassCount(classIds.length);

            // Fetch school roll (only students currently enrolled in active classes for this year)
            const studentsQuery = query(
                collection(firestore, 'schools', schoolData.id, 'students'), 
                where('status', '==', 'Active')
            );
            
            const studentsUnsub = onSnapshot(studentsQuery, (studentSnap) => {
                if (!isMounted) return;
                let activeEnrollment = 0;
                studentSnap.forEach(doc => {
                    const studentData = doc.data();
                    if (studentData.classId && classIds.includes(studentData.classId)) {
                        activeEnrollment++;
                    }
                });
                setSchoolRoll(activeEnrollment);
            });
            unsubscribes.push(studentsUnsub);
        });
        unsubscribes.push(classesUnsub);

      } else {
        setSchool(null);
        setError('No school assigned to this school head.');
      }
      setLoading(false);
    }, (error: FirestoreError) => {
      if (isMounted) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `schools`,
            operation: 'list',
        }));
        setError('Failed to load school data.');
        setLoading(false);
      }
    });
    unsubscribes.push(schoolUnsub);

    return () => {
      isMounted = false;
      unsubscribes.forEach(unsub => unsub());
    };
  }, [firestore, user]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/3 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="Total Staff" value="" icon={Users} loading={true} />
                <StatCard title="Total Classes" value="" icon={BookOpen} loading={true} />
                <StatCard title="School Roll" value="" icon={GraduationCap} loading={true} />
            </div>
            <div className="lg:col-span-1">
                 <Card>
                    <CardHeader><Skeleton className="h-6 w-3/4"/></CardHeader>
                    <CardContent><Skeleton className="h-48 w-full"/></CardContent>
                </Card>
            </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Please try again or contact support if the issue persists.</p>
        </CardContent>
      </Card>
    );
  }

  if (!school) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Welcome!</CardTitle>
          <CardDescription>
            You are not yet assigned as the head of any school. Please contact the super-administrator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Once you are assigned to a school, you will see your dashboard here.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold leading-tight">School Head Dashboard for {school.name}</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
             <StatCard 
                title="Total Staff" 
                value={staffCount} 
                description="Teaching & Leadership staff" 
                icon={Users} 
                loading={false} 
            />
            <StatCard 
                title="Total Classes" 
                value={classCount} 
                description={`Active classes in ${new Date().getFullYear()}`} 
                icon={BookOpen} 
                loading={false} 
            />
            <StatCard 
                title="School Roll" 
                value={schoolRoll} 
                description="Students in active classes" 
                icon={GraduationCap} 
                loading={false} 
            />
            <div className="md:col-span-3">
                <TeacherChartCard
                    title="Student Gender Distribution"
                    description="Breakdown of male and female students currently enrolled in active classes."
                >
                    <StudentGenderChart />
                </TeacherChartCard>
            </div>
        </div>
        <div className="lg:col-span-1">
            <Card>
                <CardHeader>
                    <CardTitle>School Calendar of Events</CardTitle>
                    <CardDescription>
                    Upcoming events from your school's Action Plan.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <SchoolCalendar />
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
