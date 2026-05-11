
'use client';

import { useState } from 'react';
import { MoreHorizontal, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { School } from '../page';
import { UserProfile } from '@/firebase/auth/use-user';
import { AssignSchoolHeadDialog } from './assign-school-head-dialog';

interface SchoolActionsProps {
  school: School;
  schoolHeads: UserProfile[];
}

export function SchoolActions({ school, schoolHeads }: SchoolActionsProps) {
  const [isAssignDialogOpen, setAssignDialogOpen] = useState(false);

  return (
    <>
      <AssignSchoolHeadDialog
        isOpen={isAssignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        school={school}
        schoolHeads={schoolHeads}
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
            <Edit className="mr-2 h-4 w-4" />
            <span>Assign Head</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
