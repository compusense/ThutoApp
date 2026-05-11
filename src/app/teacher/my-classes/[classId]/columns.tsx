
"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format } from 'date-fns';
import { Student } from "@/app/school-head/students/page";
import { Badge } from "@/components/ui/badge";

// This is a simplified column definition for the teacher's view.
// It doesn't need the complex actions from the school head's view.
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
      try {
        // Firestore date strings (YYYY-MM-DD) need to be parsed carefully to avoid timezone issues.
        // Appending 'T00:00:00Z' treats it as UTC.
        const date = new Date(dob + 'T00:00:00Z');
        return format(date, "PPP");
      } catch (e) {
        return "Invalid Date";
      }
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
];
