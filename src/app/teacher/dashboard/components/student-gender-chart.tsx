
'use client';

import * as React from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { PieChart, Pie, Cell } from 'recharts';
import { Loader2, User } from 'lucide-react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export function StudentGenderChart() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [genderData, setGenderData] = React.useState<{ name: string; value: number }[]>([]);
  const [totalStudents, setTotalStudents] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!firestore || !user?.schoolId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    let unsubscribes: (() => void)[] = [];

    if (user.role === 'teacher') {
        const classesQuery = query(
            collection(firestore, 'schools', user.schoolId, 'classes'),
            where('teacherId', '==', user.uid)
        );
        
        const unsubscribeClasses = onSnapshot(classesQuery, async (classSnap) => {
            const classIds = classSnap.docs.map(doc => doc.id);
            if (classIds.length === 0) {
                setGenderData([]);
                setTotalStudents(0);
                setLoading(false);
                return;
            }
            
            const studentQueryForTeacher = query(
                collection(firestore, 'schools', user.schoolId!, 'students'), 
                where('classId', 'in', classIds)
            );
            
            const unsubscribeStudents = onSnapshot(studentQueryForTeacher, (studentSnap) => {
                processStudentSnapshot(studentSnap, classIds);
            }, async (err) => {
                const permissionError = new FirestorePermissionError({
                    path: `schools/${user.schoolId}/students`,
                    operation: 'list',
                });
                errorEmitter.emit('permission-error', permissionError);
                setLoading(false);
            });
            unsubscribes.push(unsubscribeStudents);

        }, async (err) => {
            const permissionError = new FirestorePermissionError({
                path: `schools/${user.schoolId}/classes`,
                operation: 'list',
            });
            errorEmitter.emit('permission-error', permissionError);
            setLoading(false);
        });
        unsubscribes.push(unsubscribeClasses);

    } else if (user.role === 'school-head') {
        const currentYear = new Date().getFullYear().toString();
        const classesQuery = query(
            collection(firestore, 'schools', user.schoolId, 'classes'),
            where('academicYear', '==', currentYear)
        );

        const unsubscribeClasses = onSnapshot(classesQuery, (classSnap) => {
            const classIds = classSnap.docs.map(doc => doc.id);
            
            const studentsQuery = query(collection(firestore, 'schools', user.schoolId!, 'students'));
            const unsubscribeStudents = onSnapshot(studentsQuery, (snapshot) => {
                processStudentSnapshot(snapshot, classIds);
            }, async (err) => {
                const permissionError = new FirestorePermissionError({
                    path: `schools/${user.schoolId}/students`,
                    operation: 'list',
                });
                errorEmitter.emit('permission-error', permissionError);
                setLoading(false);
            });
            unsubscribes.push(unsubscribeStudents);
        }, async (err) => {
            const permissionError = new FirestorePermissionError({
                path: `schools/${user.schoolId}/classes`,
                operation: 'list',
            });
            errorEmitter.emit('permission-error', permissionError);
            setLoading(false);
        });
        unsubscribes.push(unsubscribeClasses);
    } else {
        setLoading(false);
        return;
    }

    function processStudentSnapshot(snapshot: any, activeClassIds: string[]) {
        let maleCount = 0;
        let femaleCount = 0;

        snapshot.forEach((doc: any) => {
            const student = doc.data();
            if (student.status === 'Active' && student.classId && activeClassIds.includes(student.classId)) {
                if (student.gender === 'Male') {
                    maleCount++;
                } else if (student.gender === 'Female') {
                    femaleCount++;
                }
            }
        });

        setTotalStudents(maleCount + femaleCount);
        setGenderData([
            { name: 'Boys', value: maleCount },
            { name: 'Girls', value: femaleCount },
        ]);
        setLoading(false);
    }

    return () => unsubscribes.forEach(unsub => unsub());

  }, [firestore, user]);

  const chartConfig = {
    boys: { label: 'Boys', color: 'url(#gradientBoys)' },
    girls: { label: 'Girls', color: 'url(#gradientGirls)' },
  };

  if (loading) {
    return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    )
  }

  if (totalStudents === 0) {
     return (
        <div className="flex flex-col items-center justify-center text-center h-64 text-muted-foreground">
            <User className="h-10 w-10 mb-2" />
            <p>No students found in active classes.</p>
        </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <ChartContainer
        config={chartConfig}
        className="mx-auto aspect-square w-full max-w-[1800px] max-h-[180px]"
      >
        <PieChart>
          <defs>
            <linearGradient id="gradientBoys" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8884d8" stopOpacity={1}/>
              <stop offset="100%" stopColor="#413ea0" stopOpacity={1}/>
            </linearGradient>
            <linearGradient id="gradientGirls" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffc658" stopOpacity={1}/>
              <stop offset="100%" stopColor="#e57373" stopOpacity={1}/>
            </linearGradient>
          </defs>
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel />}
          />
          <Pie
            data={genderData}
            dataKey="value"
            nameKey="name"
            innerRadius={40}
            strokeWidth={2}
            paddingAngle={5}
            cornerRadius={8}
          >
            {genderData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.name === 'Boys' ? chartConfig.boys.color : chartConfig.girls.color}
              />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="flex items-center gap-4 text-sm mt-4">
        <div className="flex items-center gap-2">
          <div className="h-[10px] w-[5px] rounded-full bg-gradient-to-br from-[#8884d8] to-[#413ea0]"/>
          <div>
            <span className="font-semibold">{chartConfig.boys.label}: </span>
            <span className="text-muted-foreground">{genderData.find(d => d.name === 'Boys')?.value}</span>
          </div>
        </div>
         <div className="flex items-center gap-2">
          <div className="h-[10px] w-[5px] rounded-full bg-gradient-to-br from-[#ffc658] to-[#e57373]"/>
          <div>
            <span className="font-semibold">{chartConfig.girls.label}: </span>
            <span className="text-muted-foreground">{genderData.find(d => d.name === 'Girls')?.value}</span>
          </div>
        </div>
      </div>
      <p className="mt-2 text-lg font-bold">Total: {totalStudents} Students</p>
    </div>
  );
}
