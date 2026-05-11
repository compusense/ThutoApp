
"use client";

import * as React from "react";
import { PlusCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser, UserProfile } from "@/firebase/auth/use-user";
import { useFirestore } from "@/firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { Class } from "../classes/page";
import { useToast } from "@/hooks/use-toast";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { assignInvigilator, removeInvigilator } from "./actions";

interface Assignment {
  id: string;
  classId: string;
  teacherId: string;
  className: string;
  teacherName: string;
  term: string;
  academicYear: string;
}

export default function InvigilationPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [assignments, setAssignments] = React.useState<Assignment[]>([]);
  const [classes, setClasses] = React.useState<Class[]>([]);
  const [teachers, setTeachers] = React.useState<UserProfile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isDialogOpen, setDialogOpen] = React.useState(false);
  const [assignmentToDelete, setAssignmentToDelete] =
    React.useState<Assignment | null>(null);

  const academicYears = React.useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) =>
        (new Date().getFullYear() - 2 + i).toString()
      ),
    []
  );
  const [selectedYear, setSelectedYear] = React.useState<string>(
    new Date().getFullYear().toString()
  );
  const terms = ["Term 1", "Term 2", "Term 3"] as const;
  type Term = (typeof terms)[number];
  const [selectedTerm, setSelectedTerm] = React.useState<Term>(terms[0]);
  const [selectedClass, setSelectedClass] = React.useState("");
  const [selectedTeacher, setSelectedTeacher] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!firestore || !user?.schoolId) return;

    setLoading(true);
    const unsubs: (() => void)[] = [];

    // Fetch classes and teachers
    unsubs.push(
      onSnapshot(
        collection(firestore, "schools", user.schoolId, "classes"),
        (snap) =>
          setClasses(
            snap.docs.map((d) => ({ id: d.id, ...d.data() } as Class))
          )
      )
    );
    unsubs.push(
      onSnapshot(
        query(
          collection(firestore, "users"),
          where("schoolId", "==", user.schoolId),
          where("role", "==", "teacher")
        ),
        (snap) =>
          setTeachers(
            snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile))
          )
      )
    );

    setLoading(false);
    return () => unsubs.forEach((unsub) => unsub());
  }, [firestore, user?.schoolId]);

  React.useEffect(() => {
    if (!firestore || !user?.schoolId) return;
    setLoading(true);

    const q = query(
      collection(firestore, "schools", user.schoolId, "invigilations"),
      where("academicYear", "==", selectedYear),
      where("term", "==", selectedTerm)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const assignmentPromises = snapshot.docs.map(async (docData) => {
        const assignment = { id: docData.id, ...docData.data() };
        const classDoc = await getDocs(
          query(
            collection(firestore, `schools/${user.schoolId}/classes`),
            where("__name__", "==", assignment.classId)
          )
        );
        const teacherDoc = await getDocs(
          query(
            collection(firestore, "users"),
            where("__name__", "==", assignment.teacherId)
          )
        );

        return {
          ...assignment,
          className: classDoc.docs[0]?.data()?.name || "Unknown Class",
          teacherName:
            teacherDoc.docs[0]?.data()?.displayName || "Unknown Teacher",
        } as Assignment;
      });

      const resolvedAssignments = await Promise.all(assignmentPromises);
      setAssignments(
        resolvedAssignments.sort((a, b) => a.className.localeCompare(b.className))
      );
      setLoading(false);
    });

    return () => unsubscribe();
  }, [firestore, user?.schoolId, selectedYear, selectedTerm, classes, teachers]);

  const handleAssign = async () => {
    if (!selectedClass || !selectedTeacher) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please select a class and a teacher.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await assignInvigilator({
        schoolId: user!.schoolId!,
        classId: selectedClass,
        teacherId: selectedTeacher,
        academicYear: selectedYear,
        term: selectedTerm,
      });

      if (result.success) {
        toast({
          title: "Success",
          description: "Invigilator assigned successfully.",
        });
        setSelectedClass("");
        setSelectedTeacher("");
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error.message || "An unexpected error occurred during assignment.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!assignmentToDelete) return;
    try {
      const result = await removeInvigilator({
        schoolId: user!.schoolId!,
        invigilationId: assignmentToDelete.id,
      });
      if (result.success) {
        toast({
          title: "Success",
          description: "Invigilation assignment removed.",
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Could not remove assignment.",
      });
    } finally {
      setAssignmentToDelete(null);
    }
  };

  const filteredClasses = React.useMemo(() => {
    return classes.filter(c => c.academicYear === selectedYear);
  }, [classes, selectedYear]);

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    setSelectedClass('');
  };


  return (
    <>
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Exam Invigilation
          </h2>
          <p className="text-muted-foreground">
            Assign teachers to invigilate end-of-term exams for classes.
          </p>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Assign Invigilator</CardTitle>
          <CardDescription>
            Select a year, term, class, and teacher to create an assignment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <Select value={selectedYear} onValueChange={handleYearChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select Year" />
              </SelectTrigger>
              <SelectContent>
                {academicYears.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedTerm}
              onValueChange={(v) => setSelectedTerm(v as Term)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Term" />
              </SelectTrigger>
              <SelectContent>
                {terms.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedClass}
              onValueChange={setSelectedClass}
              disabled={loading || filteredClasses.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={filteredClasses.length === 0 ? "No classes for year" : "Select Class"} />
              </SelectTrigger>
              <SelectContent>
                {filteredClasses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedTeacher}
              onValueChange={setSelectedTeacher}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Teacher" />
              </SelectTrigger>
              <SelectContent>
                {teachers.map((t) => (
                  <SelectItem key={t.uid} value={t.uid}>
                    {t.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAssign} disabled={isSubmitting}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Assign
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>
            Assignments for {selectedTerm}, {selectedYear}
          </CardTitle>
          <CardDescription>
            List of teachers assigned to invigilate exams for this period.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : assignments.length > 0 ? (
            <ul className="divide-y divide-border">
              {assignments.map((assignment) => (
                <li
                  key={assignment.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="font-medium">
                      {assignment.teacherName}{" "}
                      <span className="text-muted-foreground">
                        {"->"} {assignment.className}
                      </span>
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setAssignmentToDelete(assignment)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                    <span className="sr-only">Remove assignment</span>
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-muted-foreground py-10">
              No invigilation assignments for the selected period.
            </p>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!assignmentToDelete}
        onOpenChange={(open) => !open && setAssignmentToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the invigilation assignment for{" "}
              {assignmentToDelete?.teacherName} from class{" "}
              {assignmentToDelete?.className}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
