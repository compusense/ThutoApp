
'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Student } from '@/app/school-head/students/page';
import { addStudentsToClass } from './actions';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AddStudentsToClassDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  schoolId: string;
  classId: string;
  allSchoolStudents: Student[];
  enrolledStudentIds: string[];
}

export function AddStudentsToClassDialog({
  isOpen,
  onOpenChange,
  schoolId,
  classId,
  allSchoolStudents,
  enrolledStudentIds,
}: AddStudentsToClassDialogProps) {
  const [selectedStudents, setSelectedStudents] = React.useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { toast } = useToast();

  const availableStudents = React.useMemo(() => {
    // Only show students who are active and do not have a classId
    return allSchoolStudents.filter(student => student.status === 'Active' && !student.classId);
  }, [allSchoolStudents]);
  
  React.useEffect(() => {
    if (!isOpen) {
      setSelectedStudents([]);
    }
  }, [isOpen]);

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSubmit = async () => {
    if (selectedStudents.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No students selected',
        description: 'Please select at least one student to add.',
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await addStudentsToClass({
        schoolId,
        classId,
        studentIds: selectedStudents,
      });

      if (result.success) {
        toast({
          title: 'Students Added',
          description: `${selectedStudents.length} student(s) have been added to the class.`,
        });
        onOpenChange(false);
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error adding students',
        description: error.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Students to Class</DialogTitle>
          <DialogDescription>
            Select unassigned students from the registry to add to this class.
          </DialogDescription>
        </DialogHeader>
        <Command>
          <CommandInput placeholder="Search students..." />
          <ScrollArea className="h-64">
            <CommandList>
              <CommandEmpty>No unassigned students found.</CommandEmpty>
              <CommandGroup>
                {availableStudents.map(student => (
                  <CommandItem
                    key={student.id}
                    onSelect={() => handleSelectStudent(student.id)}
                    className="flex items-center justify-between"
                  >
                    <span>{student.firstName} {student.surname} ({student.admissionNumber})</span>
                    <Checkbox
                      checked={selectedStudents.includes(student.id)}
                      onCheckedChange={() => handleSelectStudent(student.id)}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </ScrollArea>
        </Command>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || selectedStudents.length === 0}>
            {isSubmitting ? 'Adding...' : `Add ${selectedStudents.length} Student(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
