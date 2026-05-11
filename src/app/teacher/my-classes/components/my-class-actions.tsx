
'use client';

import { useState } from 'react';
import { MoreHorizontal, Users, FilePenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Class } from '@/app/school-head/classes/page';
import { useRouter } from 'next/navigation';

interface MyClassActionsProps {
  classData: Class;
}

export function MyClassActions({ classData }: MyClassActionsProps) {
  const router = useRouter();

  const navigateToRoll = () => {
    router.push(`/teacher/my-classes/${classData.id}`);
  };

  const navigateToMarks = () => {
    router.push(`/teacher/my-classes/${classData.id}/marks`);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={navigateToRoll}>
            <Users className="mr-2 h-4 w-4" />
            <span>View Roll</span>
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
