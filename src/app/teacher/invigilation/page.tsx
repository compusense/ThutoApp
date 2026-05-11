
"use client";

import * as React from "react";
import { useUser } from "@/firebase/auth/use-user";
import { useFirestore } from "@/firebase";
import { collection, onSnapshot, query, where, getDocs, FirestoreError } from "firebase/firestore";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { FilePenLine, BarChart } from "lucide-react";
import { AppLink } from "@/components/ui/app-link";
import { useRouter } from "next/navigation";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

interface Assignment {
  id: string;
  classId: string;
  className: string;
  term: string;
  academicYear: string;
}

export default function TeacherInvigilationPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const [assignments, setAssignments] = React.useState<Assignment[]>([]);
  const [loading, setLoading] = React.useState(true);

  const academicYears = React.useMemo(
    () => Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString()),
    []
  );
  const [selectedYear, setSelectedYear] = React.useState<string>(new Date().getFullYear().toString());
  const terms = ["Term 1", "Term 2", "Term 3"] as const;
  type Term = (typeof terms)[number];
  const [selectedTerm, setSelectedTerm] = React.useState<Term>(terms[0]);

  React.useEffect(() => {
    if (!firestore || !user?.schoolId || !user.uid) {
        setLoading(false);
        return;
    };
    
    setLoading(true);

    const q = query(
      collection(firestore, "schools", user.schoolId, "invigilations"),
      where("teacherId", "==", user.uid),
      where("academicYear", "==", selectedYear),
      where("term", "==", selectedTerm)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const assignmentPromises = snapshot.docs.map(async (docData) => {
        const assignment = { id: docData.id, ...docData.data() };
        
        const classQuery = query(collection(firestore, `schools/${user.schoolId}/classes`), where('__name__', '==', assignment.classId));
        const classDoc = await getDocs(classQuery);

        return {
          id: assignment.id,
          classId: assignment.classId,
          className: classDoc.docs[0]?.data()?.name || "Unknown Class",
          term: assignment.term,
          academicYear: assignment.academicYear,
        } as Assignment;
      });

      const resolvedAssignments = await Promise.all(assignmentPromises);
      setAssignments(resolvedAssignments.sort((a,b) => a.className.localeCompare(b.className)));
      setLoading(false);
    }, (err: FirestoreError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `schools/${user.schoolId}/invigilations`, operation: 'list' }));
        setLoading(false);
    });

    return () => unsubscribe();
  }, [firestore, user, selectedYear, selectedTerm]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Invigilation Duties</h2>
          <p className="text-muted-foreground">
            Classes you are assigned to invigilate for end-of-term exams.
          </p>
        </div>
      </div>
      
      <Card>
        <CardHeader>
            <CardTitle>Filter Assignments</CardTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger><SelectValue placeholder="Select Year" /></SelectTrigger>
                    <SelectContent>{academicYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={selectedTerm} onValueChange={(v) => setSelectedTerm(v as Term)}>
                    <SelectTrigger><SelectValue placeholder="Select Term" /></SelectTrigger>
                    <SelectContent>{terms.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
            </div>
        </CardHeader>
        <CardContent>
          <h3 className="text-lg font-medium mb-4">Assignments for {selectedTerm}, {selectedYear}</h3>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : assignments.length > 0 ? (
             <ul className="divide-y divide-border">
              {assignments.map((assignment) => (
                <li key={assignment.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{assignment.className}</p>
                    <p className="text-sm text-muted-foreground">End of {assignment.term} Exam</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button asChild variant="outline">
                        <AppLink href={`/teacher/results?classId=${assignment.classId}&year=${assignment.academicYear}&term=${assignment.term}&assessment=End of ${assignment.term}`}>
                            <BarChart className="mr-2 h-4 w-4" />
                            View Results
                        </AppLink>
                    </Button>
                    <Button asChild>
                        <AppLink href={`/teacher/invigilation/${assignment.classId}?term=${assignment.term}&year=${assignment.academicYear}`}>
                            <FilePenLine className="mr-2 h-4 w-4" />
                            Enter Marks
                        </AppLink>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-muted-foreground py-10">
              You have no invigilation assignments for the selected period.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
