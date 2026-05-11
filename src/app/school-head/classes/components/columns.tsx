
"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Class } from "../page";
import { UserProfile } from "@/firebase/auth/use-user";
import { ClassActions } from "./class-actions";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";

export const getColumns = (teachers: UserProfile[]): ColumnDef<Class>[] => [
  {
    accessorKey: "name",
    header: "Class Name",
    cell: ({ row }) => {
      return (
        <Button variant="link" asChild className="p-0 font-medium">
          <AppLink href={`/school-head/classes/${row.original.id}`}>
            {row.original.name}
          </AppLink>
        </Button>
      );
    },
  },
  {
    accessorKey: "gradeLevel",
    header: "Grade Level",
  },
  {
    accessorKey: "stream",
    header: "Stream",
  },
  {
    accessorKey: "teacherId",
    header: "Assigned Teacher",
    cell: ({ row }) => {
      const teacherId = row.original.teacherId;
      if (!teacherId) return "Unassigned";
      const teacher = teachers.find(t => t.uid === teacherId);
      return teacher ? teacher.displayName : "Unknown Teacher";
    }
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const classData = row.original;
      return <ClassActions classData={classData} teachers={teachers} />;
    },
  },
];
