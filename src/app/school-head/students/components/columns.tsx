
"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format } from 'date-fns';
import { Student } from "../page";
import { StudentActions } from "./student-actions";
import { Badge } from "@/components/ui/badge";

export const getColumns = (): ColumnDef<Student>[] => [
  {
    accessorKey: "admissionNumber",
    header: "Admission No.",
  },
  {
    accessorKey: "fullName",
    header: "Name",
    cell: ({ row }) => {
      return (
        <div className="font-medium">
          {row.original.fullName}
        </div>
      );
    },
  },
  {
    accessorKey: "className",
    header: "Enrolled Class",
    filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: "gender",
    header: "Gender",
  },
  {
    accessorKey: "dateOfBirth",
    header: "Date of Birth",
    cell: ({ row }) => {
      const dob = row.original.dateOfBirth;
      if (!dob) return "N/A";
      // The value from firestore could be a string (YYYY-MM-DD).
      // Appending 'T00:00:00Z' treats it as a UTC date and avoids timezone shifts.
      const date = new Date(dob + 'T00:00:00Z');
      if (isNaN(date.getTime())) {
          return "Invalid Date";
      }
      return format(date, "PPP");
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
        const status = row.original.status;
        return <Badge variant={status === 'Active' ? 'secondary' : 'outline'}>{status}</Badge>
    }
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const student = row.original;
      return <StudentActions student={student} />;
    },
  },
];
