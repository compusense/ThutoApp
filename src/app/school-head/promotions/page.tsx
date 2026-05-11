'use client';

import * as React from 'react';
import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, where, getCountFromServer, doc, FirestoreError } from 'firebase/firestore';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Class } from '@/app/school-head/classes/page';
import { PromoteClassDialog } from './components/promote-class-dialog';
import { School } from '@/app/super-admin/schools/page';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface ClassWithStudentCount extends Class {
  studentCount: number;
}

export default function PromotionsPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [fromYear, setFromYear] = useState<string>(new Date().getFullYear().toString());
  const [toYear, setToYear] = useState<string>((new Date().getFullYear() + 1).toString());

  const [school, setSchool] = useState<School | null>(null);
  const [classes, setClasses] = useState<ClassWithStudentCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [promotionClass, setPromotionClass] = useState<ClassWithStudentCount | null>(null);

  const academicYears = useMemo(() => Array.from({ length: 10 }, (_, i) => (new Date().getFullYear() - 5 + i).toString()), []);

  React.useEffect(() => {
    if (!firestore || !user?.schoolId) {
      setLoading(false);
      return;
    }

    const schoolRef = doc(firestore, 'schools', user.schoolId);
    const unsubSchool = onSnapshot(schoolRef, (docSnap) => {
        setSchool(docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as School : null);
    }, (err: FirestoreError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `schools/${user.schoolId}`,
            operation: 'get',
        }));
    });

    return () => unsubSchool();
  }, [firestore, user?.schoolId]);

  React.useEffect(() => {
    if (!firestore || !user?.schoolId || !fromYear) {
      setClasses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    console.log(`[PROMOTIONS_PAGE] Year changed to ${fromYear}. Refetching active classes.`);

    const classesQuery = query(collection(firestore, 'schools', user.schoolId, 'classes'));
    
    const unsubClasses = onSnapshot(classesQuery, async (snapshot) => {
        const classesWithCounts: ClassWithStudentCount[] = [];
        console.log(`[PROMOTIONS_PAGE] Found ${snapshot.size} total classes. Filtering for year ${fromYear}...`);
        for (const doc of snapshot.docs) {
            // Check if the class has subjects for the 'fromYear' to be considered active
            const subjectsQuery = query(collection(doc.ref, 'subjects'), where('academicYear', '==', fromYear));
            const subjectsSnap = await getCountFromServer(subjectsQuery);
            if (subjectsSnap.data().count > 0) {
                console.log(`[PROMOTIONS_PAGE] -> Class ${doc.data().name} IS active for ${fromYear}.`);
                const studentsQuery = query(collection(doc.ref, 'students'));
                const studentCountSnap = await getCountFromServer(studentsQuery);
                classesWithCounts.push({
                    id: doc.id,
                    ...doc.data(),
                    studentCount: studentCountSnap.data().count
                } as ClassWithStudentCount);
            } else {
                console.log(`[PROMOTIONS_PAGE] -> Class ${doc.data().name} is NOT active for ${fromYear}.`);
            }
        }
        console.log(`[PROMOTIONS_PAGE] Finished filtering. Found ${classesWithCounts.length} active classes.`);
        setClasses(classesWithCounts.sort((a, b) => a.name.localeCompare(b.name)));
        setLoading(false);
    }, (err: FirestoreError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `schools/${user.schoolId}/classes`,
            operation: 'list',
        }));
        setLoading(false);
    });

    return () => unsubClasses();
  }, [firestore, user?.schoolId, fromYear]);

  return (
    <>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Class Promotions</h2>
          <p className="text-muted-foreground">
            Promote students from one academic year to the next. This process will move selected students into new or existing classes for the upcoming year.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Select Academic Years</CardTitle>
            <CardDescription>Choose the year to promote from and the year to promote to.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <Select value={fromYear} onValueChange={setFromYear}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Promote From" />
              </SelectTrigger>
              <SelectContent>
                {academicYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
            <Select value={toYear} onValueChange={setToYear}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Promote To" />
              </SelectTrigger>
              <SelectContent>
                {academicYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Classes for {fromYear}</CardTitle>
            <CardDescription>Select a class to begin the promotion process for the {toYear} academic year.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
                <div className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            ) : classes.length > 0 ? (
                 <ul className="divide-y divide-border">
                    {classes.map((c) => (
                        <li key={c.id} className="flex items-center justify-between py-3">
                            <div>
                                <p className="font-medium">{c.name}</p>
                                <p className="text-sm text-muted-foreground">{c.studentCount} student(s)</p>
                            </div>
                            <Button onClick={() => setPromotionClass(c)} disabled={parseInt(fromYear) >= parseInt(toYear)}>
                                Promote
                            </Button>
                        </li>
                    ))}
                 </ul>
            ) : (
                <div className="text-center py-10 text-muted-foreground">
                    No active classes found for the {fromYear} academic year.
                </div>
            )}
          </CardContent>
        </Card>
      </div>
      {promotionClass && user?.schoolId && school && (
        <PromoteClassDialog
            isOpen={!!promotionClass}
            onOpenChange={() => setPromotionClass(null)}
            fromClass={promotionClass}
            schoolId={user.schoolId}
            schoolType={school.schoolType}
            fromYear={fromYear}
            toYear={toYear}
        />
      )}
    </>
  );
}
