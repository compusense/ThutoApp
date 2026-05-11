
"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Subject } from "../page";
import { Badge } from "@/components/ui/badge";

export const getColumns = (): ColumnDef<Subject>[] => [
  {
    accessorKey: "name",
    header: "Subject Name",
    cell: ({ row }) => {
      const subject = row.original;
      return (
        <div className="font-medium">
          {subject.name}
        </div>
      );
    },
  },
  {
    accessorKey: "subjectCode",
    header: "Subject Code",
  },
  {
    accessorKey: "schoolLevel",
    header: "School Level",
    cell: ({ row }) => {
      const subject = row.original;
      return (
        <Badge variant="outline">{subject.schoolLevel}</Badge>
      );
    }
  },
];
