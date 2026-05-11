
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, FirestoreError } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { UserProfile, useUser } from '@/firebase/auth/use-user';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { getInitials } from '@/lib/utils';
import { School } from '@/app/super-admin/schools/page';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

function DetailItem({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-1 md:gap-4 items-start">
      <p className="md:col-span-1 text-sm font-semibold text-muted-foreground">{label}</p>
      <p className="md:col-span-2 text-base">{value}</p>
    </div>
  );
}


export default function StaffDetailsPage() {
  const { staffId } = useParams();
  const firestore = useFirestore();
  const router = useRouter();

  const [staff, setStaff] = useState<UserProfile | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !staffId) {
      setLoading(false);
      return;
    }
    
    const staffRef = doc(firestore, 'users', staffId as string);
    const unsubStaff = onSnapshot(staffRef, (docSnap) => {
      if (docSnap.exists()) {
        const userData = { uid: docSnap.id, ...docSnap.data() } as UserProfile;
        setStaff(userData);

        if (userData.schoolId) {
          const schoolRef = doc(firestore, 'schools', userData.schoolId);
          const unsubSchool = onSnapshot(schoolRef, (schoolSnap) => {
            setSchool(schoolSnap.exists() ? { id: schoolSnap.id, ...schoolSnap.data() } as School : null);
            setLoading(false);
          }, (err: FirestoreError) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `schools/${userData.schoolId}`, operation: 'get' }));
            setLoading(false);
          });
          return () => unsubSchool();
        } else {
          setLoading(false);
        }
      } else {
        setStaff(null);
        setLoading(false);
      }
    }, (err: FirestoreError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `users/${staffId}`, operation: 'get' }));
        setLoading(false);
    });

    return () => unsubStaff();
  }, [firestore, staffId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Card>
          <CardHeader className="flex flex-col items-center text-center space-y-4">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {Array.from({length: 8}).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!staff) {
    return <div className="text-center p-8">Staff member not found.</div>;
  }
  
  const dob = staff.dateOfBirth ? format(new Date(staff.dateOfBirth), 'PPP') : 'N/A';

  return (
    <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4 -ml-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Staff List
        </Button>
        <Card>
            <CardHeader className="flex flex-col items-center text-center space-y-4">
                <Avatar className="h-24 w-24 text-3xl">
                    <AvatarImage src={staff.photoURL ?? undefined} alt={staff.displayName ?? ''} />
                    <AvatarFallback>{getInitials(staff.displayName)}</AvatarFallback>
                </Avatar>
                <div>
                    <CardTitle className="text-2xl">{staff.displayName}</CardTitle>
                    <CardDescription>{staff.email}</CardDescription>
                     {staff.isDeactivated && <p className="text-sm font-semibold text-destructive mt-1">DEACTIVATED</p>}
                </div>
            </CardHeader>
            <CardContent className="space-y-6 border-t pt-6">
                <DetailItem label="First Name(s)" value={staff.firstName} />
                <DetailItem label="Surname" value={staff.surname} />
                <DetailItem label="National ID" value={staff.idNumber} />
                <DetailItem label="Date of Birth" value={dob} />
                <DetailItem label="Gender" value={staff.gender} />
                <DetailItem label="Nationality" value={staff.nationality} />
                <DetailItem label="Role" value={staff.role?.replace('-', ' ')} />
                <DetailItem label="Assigned School" value={school?.name} />
                <DetailItem label="School REG.NO" value={school?.regNo} />
                <DetailItem label="Nature of Employment" value={staff.natureOfEmployment} />
                <DetailItem label="Post" value={staff.post} />
                <DetailItem label="Portfolio" value={staff.portfolio} />
                <DetailItem label="Salary Scale" value={staff.salaryScale} />
                <DetailItem label="Qualification" value={staff.qualification} />
                <DetailItem label="Qualification Details" value={staff.qualificationDetails} />
            </CardContent>
        </Card>
    </div>
  );
}
