
'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Student } from '@/app/school-head/students/page';
import { promoteStudents } from '../actions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { collection, getDocs, query, doc, getDoc } from 'firebase/firestore';
import { Class } from '@/app/school-head/classes/page';

interface PromoteClassDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  fromClass: Class;
  schoolId: string;
  schoolType: string | undefined;
  fromYear: string;
  toYear: string;
}

interface StudentWithDestination extends Student {
  destinationClassId: string;
}

const getNextGradeLevel = (current: string): string | null => {
    if (current === 'Reception') return 'Standard 1';
    
    const standardMatch = current.match(/Standard (\d+)/);
    if (standardMatch) {
        const num = parseInt(standardMatch[1]);
        if (num < 7) return `Standard ${num + 1}`;
        return null; // Standard 7 graduates
    }

    const formMatch = current.match(/Form (\d+)/);
    if (formMatch) {
        const num = parseInt(formMatch[1]);
        if (num < 5) return `Form ${num + 1}`; // Form 3 -> Form 4; Form 4 -> Form 5
        return null; // Form 5 graduates
    }

    return null; 
}

export function PromoteClassDialog({
  isOpen,
  onOpenChange,
  fromClass,
  schoolId,
  schoolType,
  fromYear,
  toYear,
}: PromoteClassDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [students, setStudents] = React.useState<StudentWithDestination[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const nextGradeLevel = React.useMemo(() => getNextGradeLevel(fromClass.gradeLevel), [fromClass.gradeLevel]);

  const destinationOptions = React.useMemo(() => {
    const options = [
      { value: fromClass.id, label: `Repeat ${fromClass.name}` },
    ];
    if (nextGradeLevel) {
        const stream = fromClass.name.replace(/(Standard|Form) \d+/, '').trim() || '';
        const nextClassName = `${nextGradeLevel} ${stream}`.trim();
        options.unshift({ value: 'promote', label: `Promote to ${nextClassName}` });
    } else if (fromClass.gradeLevel === 'Standard 7' && schoolType === 'Primary School') {
        options.unshift({ value: 'graduate', label: `Graduate (PSLE Class of ${toYear})` });
    } else if (fromClass.gradeLevel === 'Form 3' && schoolType === 'Junior Secondary School') {
        options.unshift({ value: 'graduate', label: `Graduate (JCE Class of ${toYear})` });
    } else if (fromClass.gradeLevel === 'Form 5' && schoolType === 'Senior Secondary School') {
        options.unshift({ value: 'graduate', label: `Graduate (BGCSE Class of ${toYear})` });
    }
    return options;
  }, [fromClass, nextGradeLevel, toYear, schoolType]);

  React.useEffect(() => {
    if (!isOpen) return;
    setLoading(true);

    const fetchStudents = async () => {
      try {
        const studentsQuery = query(collection(firestore, `schools/${schoolId}/classes/${fromClass.id}/students`));
        const studentsSnap = await getDocs(studentsQuery);
        const studentIds = studentsSnap.docs.map(s => s.id);
        
        if (studentIds.length > 0) {
            const studentDetailsPromises = studentIds.map(id => getDoc(doc(firestore, 'schools', schoolId, 'students', id)));
            const studentDocs = await Promise.all(studentDetailsPromises);
            
            const fetchedStudents = studentDocs
                .map(d => ({
                    ...d.data(),
                    id: d.id,
                    fullName: `${d.data()?.firstName} ${d.data()?.surname}`,
                    destinationClassId: destinationOptions[0].value,
                } as StudentWithDestination))
                .sort((a,b) => a.fullName!.localeCompare(b.fullName!));

            setStudents(fetchedStudents);
        } else {
            setStudents([]);
        }
      } catch (e) {
        console.error("Error fetching students for promotion:", e);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch student list.' });
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, [isOpen, firestore, schoolId, fromClass.id, destinationOptions, toast]);


  const handleDestinationChange = (studentId: string, destinationId: string) => {
    setStudents(prev =>
      prev.map(s => (s.id === studentId ? { ...s, destinationClassId: destinationId } : s))
    );
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const payload = {
      schoolId,
      fromClassId: fromClass.id,
      fromYear,
      toYear,
      studentPromotions: students.map(s => ({
        studentId: s.id,
        destination: s.destinationClassId,
      })),
      fromClassName: fromClass.name,
      nextGradeLevel: nextGradeLevel,
    };
    
    try {
      console.log('[DIALOG] Sending payload to server action:', JSON.stringify(payload, null, 2));
      const result = await promoteStudents(payload);
      console.log('[DIALOG] Received result from server action:', result);

      if (result.success) {
        toast({
          title: 'Promotion Successful',
          description: result.message,
        });
        onOpenChange(false);
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      console.error('[DIALOG] Error during submission:', error);
      toast({
        variant: 'destructive',
        title: 'Error during promotion',
        description: error.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Promote Students from {fromClass.name}</DialogTitle>
          <DialogDescription>
            Promoting from academic year {fromYear} to {toYear}. Assign a destination for each student.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
            {loading ? <Loader2 className="mx-auto my-10 h-8 w-8 animate-spin" /> : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Student Name</TableHead>
                            <TableHead>Admission No.</TableHead>
                            <TableHead className="w-[300px]">Destination for {toYear}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {students.map(student => (
                            <TableRow key={student.id}>
                                <TableCell className="font-medium">{student.fullName}</TableCell>
                                <TableCell>{student.admissionNumber}</TableCell>
                                <TableCell>
                                    <Select 
                                        value={student.destinationClassId}
                                        onValueChange={(value) => handleDestinationChange(student.id, value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {destinationOptions.map(opt => (
                                                <SelectItem key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || loading || students.length === 0}>
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Processing...</> : `Confirm Promotions`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
