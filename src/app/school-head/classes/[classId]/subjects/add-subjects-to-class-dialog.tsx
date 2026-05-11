
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
import { Subject } from '@/app/super-admin/subjects/page';
import { addSubjectsToClass } from './actions';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AddSubjectsToClassDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  schoolId: string | undefined;
  classId: string;
  academicYear: string;
  availableSubjects: Subject[];
}

export function AddSubjectsToClassDialog({
  isOpen,
  onOpenChange,
  schoolId,
  classId,
  academicYear,
  availableSubjects,
}: AddSubjectsToClassDialogProps) {
  const [selectedSubjects, setSelectedSubjects] = React.useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    if (!isOpen) {
      setSelectedSubjects([]);
    }
  }, [isOpen]);

  const handleSelectSubject = (subjectId: string) => {
    setSelectedSubjects(prev =>
      prev.includes(subjectId)
        ? prev.filter(id => id !== subjectId)
        : [...prev, subjectId]
    );
  };

  const handleSubmit = async () => {
    if (selectedSubjects.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No subjects selected',
        description: 'Please select at least one subject to add.',
      });
      return;
    }
    if (!schoolId) {
        toast({ variant: 'destructive', title: 'Error', description: 'School ID is missing.' });
        return;
    }
    setIsSubmitting(true);
    try {
      const result = await addSubjectsToClass({
        schoolId,
        classId,
        subjectIds: selectedSubjects,
        academicYear,
      });

      if (result.success) {
        toast({
          title: 'Subjects Added',
          description: `${selectedSubjects.length} subject(s) have been added to the class for ${academicYear}.`,
        });
        onOpenChange(false);
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error adding subjects',
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
          <DialogTitle>Add Subjects for {academicYear}</DialogTitle>
          <DialogDescription>
            Select subjects from the master list to add to this class.
          </DialogDescription>
        </DialogHeader>
        <Command>
          <CommandInput placeholder="Search subjects..." />
          <ScrollArea className="h-64">
            <CommandList>
              <CommandEmpty>No available subjects found.</CommandEmpty>
              <CommandGroup>
                {availableSubjects.map(subject => (
                  <CommandItem
                    key={subject.id}
                    onSelect={() => handleSelectSubject(subject.id)}
                    className="flex items-center justify-between"
                  >
                    <span>{subject.name}</span>
                    <Checkbox
                      checked={selectedSubjects.includes(subject.id)}
                      onCheckedChange={() => handleSelectSubject(subject.id)}
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
          <Button onClick={handleSubmit} disabled={isSubmitting || selectedSubjects.length === 0}>
            {isSubmitting ? 'Adding...' : `Add ${selectedSubjects.length} Subject(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
