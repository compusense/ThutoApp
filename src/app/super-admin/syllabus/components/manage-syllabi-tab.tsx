
'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { useFirestore, auth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Trash2, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { deleteSyllabus } from '../actions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Subject } from '../../subjects/page';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export interface Syllabus {
  id: string;
  schoolLevel: string;
  gradeLevel: string;
  subjectId: string;
  uploadedAt: string;
  uploadedBy: string;
  modules: any[]; // Use any for simplicity here
}

interface EnrichedSyllabus extends Syllabus {
    subjectName: string;
}

interface ManageSyllabiTabProps {
  allSubjects: Subject[];
  onEdit: (syllabus: Syllabus) => void;
}

export function ManageSyllabiTab({ allSubjects, onEdit }: ManageSyllabiTabProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [syllabi, setSyllabi] = useState<EnrichedSyllabus[]>([]);
  const [loading, setLoading] = useState(true);
  const [syllabusToDelete, setSyllabusToDelete] = useState<EnrichedSyllabus | null>(null);

  useEffect(() => {
    if (!firestore) return;

    setLoading(true);
    const subjectMap = new Map(allSubjects.map(s => [s.id, s.name]));

    const unsub = onSnapshot(collection(firestore, 'syllabi'), (snapshot) => {
      const fetched = snapshot.docs.map((doc) => {
        const data = doc.data() as Syllabus;
        return {
          ...data,
          id: doc.id,
          subjectName: subjectMap.get(data.subjectId) || 'Unknown Subject',
        };
      });
      setSyllabi(fetched.sort((a,b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()));
      setLoading(false);
    });

    return () => unsub();
  }, [firestore, allSubjects]);

  const handleDelete = async () => {
    if (!syllabusToDelete) return;
    try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error("Authentication required.");

        const result = await deleteSyllabus(syllabusToDelete.id, idToken);
        if (result.success) {
            toast({ title: "Success", description: "Syllabus deleted successfully." });
        } else {
            throw new Error(result.message);
        }
    } catch(e: any) {
        toast({ variant: 'destructive', title: "Error", description: e.message });
    } finally {
        setSyllabusToDelete(null);
    }
  }

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Manage Syllabi</CardTitle>
        <CardDescription>View, edit, or delete all uploaded syllabi.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School Level</TableHead>
                <TableHead>Grade Level</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Uploaded At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : syllabi.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No syllabi found.
                  </TableCell>
                </TableRow>
              ) : (
                syllabi.map((syllabus) => (
                  <TableRow key={syllabus.id}>
                    <TableCell>{syllabus.schoolLevel}</TableCell>
                    <TableCell>{syllabus.gradeLevel}</TableCell>
                    <TableCell className="font-medium">{syllabus.subjectName}</TableCell>
                    <TableCell>{format(new Date(syllabus.uploadedAt), 'PPP')}</TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">Open menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onEdit(syllabus)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setSyllabusToDelete(syllabus)} className="text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                       </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
    <AlertDialog open={!!syllabusToDelete} onOpenChange={() => setSyllabusToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will permanently delete the syllabus for {syllabusToDelete?.subjectName} ({syllabusToDelete?.gradeLevel}). This action cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
