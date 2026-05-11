
'use client';

import { useState } from 'react';
import { MoreHorizontal, Edit, UserPlus, BookOpen, FilePenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Class } from '../page';
import { UserProfile } from '@/firebase/auth/use-user';
import { AssignTeacherDialog } from './assign-teacher-dialog';
import { useRouter } from 'next/navigation';


interface ClassActionsProps {
  classData: Class;
  teachers: UserProfile[];
}

export function ClassActions({ classData, teachers }: ClassActionsProps) {
  const [isAssignDialogOpen, setAssignDialogOpen] = useState(false);
  const router = useRouter();

  const navigateToSubjects = () => {
    router.push(`/school-head/classes/${classData.id}/subjects`);
  }

  const navigateToMarks = () => {
    router.push(`/school-head/classes/${classData.id}/marks`);
  }

  return (
    <>
      <AssignTeacherDialog
        isOpen={isAssignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        classData={classData}
        teachers={teachers}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setAssignDialogOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            <span>Assign Teacher</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={navigateToSubjects}>
            <BookOpen className="mr-2 h-4 w-4" />
            <span>Manage Subjects</span>
          </DropdownMenuItem>
           <DropdownMenuItem onClick={navigateToMarks}>
            <FilePenLine className="mr-2 h-4 w-4" />
            <span>Enter Marks</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
